// routes/chat.js — AI Chatbot, context: Cicilan + Kas Keluar
const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const https    = require('https');

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const data    = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout:  25000,
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, text: raw }));
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(data);
    req.end();
  });
}

// ─── Load models ─────────────────────────────────────────────────────────────
let _models = null;
function getModels() {
  if (_models) return _models;
  _models = {
    Cicilan:         require('../models/Cicilan'),
    InternalExpense: require('../models/InternalExpense'),
  };
  return _models;
}

// ─── Build systemPrompt ───────────────────────────────────────────────────────
function buildPrompt(cicilan, kasKeluar) {
  const fmt  = (n) => (n || 0).toLocaleString('id-ID');
  const date = (d) => new Date(d).toLocaleDateString('id-ID');

  // Cicilan: hitung sisa & status tiap item
  const cicilanText = cicilan.length
    ? cicilan.map(c => {
        const totalBayar = (c.payments || []).reduce((s, p) => s + p.amount, 0);
        const sisaAmount = c.totalAmount - totalBayar;
        const bulanBayar = (c.payments || []).length;
        const sisaBulan  = c.totalBulan - bulanBayar;
        const status     = sisaBulan <= 0 ? 'LUNAS' : `sisa ${sisaBulan} bln (Rp ${fmt(sisaAmount)})`;
        return `- ${c.name} | ${c.category || '-'} | Total: Rp ${fmt(c.totalAmount)} | Cicilan: Rp ${fmt(c.bulanan)}/bln | ${status}`;
      }).join('\n')
    : 'Tidak ada data cicilan.';

  // Kas Keluar: 30 hari terakhir
  const kasText = kasKeluar.length
    ? kasKeluar.map(k =>
        `- ${date(k.date)} | ${k.category || '-'} | ${k.name} | Rp ${fmt(k.amount)}${k.note ? ' | ' + k.note : ''}`
      ).join('\n')
    : 'Tidak ada kas keluar 30 hari terakhir.';

  // Ringkasan kas keluar bulan ini
  const now        = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalKasBulan = kasKeluar
    .filter(k => new Date(k.date) >= startMonth)
    .reduce((s, k) => s + k.amount, 0);

  // Ringkasan cicilan aktif
  const cicilanAktif  = cicilan.filter(c => (c.payments || []).length < c.totalBulan);
  const totalCicilan  = cicilanAktif.reduce((s, c) => s + c.bulanan, 0);

  return [
    'Kamu adalah asisten keuangan pribadi untuk aplikasi Qrents Pro (manajemen properti sewa).',
    'Jawab dalam Bahasa Indonesia, singkat, jelas, langsung ke intinya.',
    'Format angka sebagai Rp xxx.xxx. Jangan sebut dirimu AI.\n',

    '=== CICILAN ===',
    cicilanText,
    `\nTotal kewajiban cicilan/bulan (aktif): Rp ${fmt(totalCicilan)}`,
    `Jumlah cicilan aktif: ${cicilanAktif.length} dari ${cicilan.length} total\n`,

    '=== KAS KELUAR (30 hari terakhir) ===',
    kasText,
    `\nTotal kas keluar bulan ini: Rp ${fmt(totalKasBulan)}`,

    '\nJawab berdasarkan data di atas. Jika data tidak tersedia, katakan "belum ada data".',
  ].join('\n');
}

// ─── GET /api/chat/test ──────────────────────────────────────────────────────
router.get('/test', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ ok: false, error: 'GEMINI_API_KEY tidak ditemukan' });
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=' + key;
  try {
    const result = await httpsPost(url, {
      contents: [{ role: 'user', parts: [{ text: 'Balas OK saja' }] }],
      generationConfig: { maxOutputTokens: 5 }
    });
    let parsed; try { parsed = JSON.parse(result.text); } catch(e) { parsed = result.text; }
    res.json({ httpStatus: result.status, keyPrefix: key.slice(0, 8) + '...', response: parsed });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ─── POST /api/chat ──────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'messages harus berupa array' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'GEMINI_API_KEY belum dikonfigurasi' });
    }

    // Fetch cicilan + kas keluar langsung dari DB
    const { Cicilan, InternalExpense } = getModels();
    const userId  = req.userId;
    const since30 = new Date(); since30.setDate(since30.getDate() - 30);

    const [cicilan, kasKeluar] = await Promise.all([
      Cicilan.find({ userId }).lean(),
      InternalExpense.find({ userId, date: { $gte: since30 } }).sort({ date: -1 }).lean(),
    ]);

    const systemPrompt = buildPrompt(cicilan, kasKeluar);

    const geminiHistory = messages.slice(0, -1).map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastText = messages[messages.length - 1]?.content || '';

    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=' + process.env.GEMINI_API_KEY;

    const requestBody = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: lastText }] },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    let result;
    try {
      result = await httpsPost(GEMINI_URL, requestBody);
    } catch (fetchErr) {
      console.error('Gemini network error:', fetchErr.message);
      return res.status(502).json({ message: 'Koneksi ke Gemini gagal: ' + fetchErr.message });
    }

    if (result.status !== 200) {
      console.error('Gemini HTTP', result.status, result.text.slice(0, 300));
      return res.status(502).json({ message: 'Gemini error ' + result.status + ': ' + result.text.slice(0, 200) });
    }

    let data;
    try { data = JSON.parse(result.text); }
    catch(e) { return res.status(502).json({ message: 'Respons AI tidak valid' }); }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, tidak ada respons dari AI.';
    res.json({ reply });

  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

module.exports = router;