// routes/chat.js — Gemini API
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const https   = require('https');

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data   = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 25000,
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

// GET /api/chat/test — debug tanpa auth
router.get('/test', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ ok: false, error: 'GEMINI_API_KEY tidak ditemukan di env' });
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=' + key;
  try {
    const result = await httpsPost(url, {
      contents: [{ role: 'user', parts: [{ text: 'Balas dengan kata OK saja' }] }],
      generationConfig: { maxOutputTokens: 10 }
    });
    let parsed;
    try { parsed = JSON.parse(result.text); } catch(e) { parsed = result.text; }
    res.json({ httpStatus: result.status, keyPrefix: key.slice(0, 8) + '...', response: parsed });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// POST /api/chat
router.post('/', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    const context = req.body.context || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages harus berupa array' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'GEMINI_API_KEY belum dikonfigurasi' });
    }

    const p = (arr) => Array.isArray(arr) ? arr : [];
    const n = (v)   => (typeof v === 'number' ? v : 0);

    const propsText = p(context.properties).length
      ? p(context.properties).map(p2 =>
          '- ' + p2.name + ' (' + p2.type + ', ' + p2.status + ') — Sewa: Rp ' +
          (p2.rent || 0).toLocaleString('id-ID') + ' | Kota: ' + (p2.city || p2.address || '-')
        ).join('\n')
      : 'Belum ada data properti.';

    const tenantsText = p(context.tenants).length
      ? p(context.tenants).map(t =>
          '- ' + t.name + ' -> ' + (t.propertyId?.name || '?') +
          ' | Sewa: Rp ' + (t.rent || 0).toLocaleString('id-ID') +
          ' | Kontrak s/d: ' + (t.end ? new Date(t.end).toLocaleDateString('id-ID') : '-')
        ).join('\n')
      : 'Belum ada data penyewa.';

    const incomeText = p(context.recentIncome).length
      ? p(context.recentIncome).map(i =>
          '- ' + new Date(i.date).toLocaleDateString('id-ID') + ' | ' +
          (i.propertyId?.name || '?') + ' | ' + i.category +
          ' | Rp ' + (i.amount || 0).toLocaleString('id-ID') + ' | ' + (i.note || '')
        ).join('\n')
      : 'Tidak ada pendapatan 30 hari terakhir.';

    const expText = p(context.recentExpenses).length
      ? p(context.recentExpenses).map(e =>
          '- ' + new Date(e.date).toLocaleDateString('id-ID') + ' | ' +
          (e.propertyId?.name || '?') + ' | ' + e.category +
          ' | Rp ' + (e.amount || 0).toLocaleString('id-ID') + ' | ' + (e.note || '')
        ).join('\n')
      : 'Tidak ada pengeluaran 30 hari terakhir.';

    const intInText = p(context.recentIntIncomes).length
      ? p(context.recentIntIncomes).map(i =>
          '- ' + new Date(i.date).toLocaleDateString('id-ID') + ' | ' +
          i.category + ' | ' + i.name + ' | Rp ' + (i.amount || 0).toLocaleString('id-ID')
        ).join('\n')
      : 'Tidak ada kas masuk 30 hari terakhir.';

    const intOutText = p(context.recentIntExpenses).length
      ? p(context.recentIntExpenses).map(i =>
          '- ' + new Date(i.date).toLocaleDateString('id-ID') + ' | ' +
          i.category + ' | ' + i.name + ' | Rp ' + (i.amount || 0).toLocaleString('id-ID')
        ).join('\n')
      : 'Tidak ada kas keluar 30 hari terakhir.';

    const s = context.summary || {};

    const systemPrompt =
      'Kamu adalah asisten keuangan pribadi untuk aplikasi Qrents Pro — aplikasi manajemen properti sewa.\n' +
      'Jawab dalam Bahasa Indonesia, singkat, jelas, dan langsung ke intinya.\n' +
      'Jika ditanya soal angka, tampilkan dalam format Rupiah (Rp xxx.xxx).\n' +
      'Jangan menyebutkan bahwa kamu AI atau model bahasa — cukup jawab pertanyaannya.\n\n' +
      'Berikut adalah DATA AKTUAL milik pengguna saat ini:\n\n' +
      '=== PROPERTI ===\n' + propsText + '\n\n' +
      '=== PENYEWA AKTIF ===\n' + tenantsText + '\n\n' +
      '=== PENDAPATAN (30 hari terakhir) ===\n' + incomeText + '\n\n' +
      '=== PENGELUARAN (30 hari terakhir) ===\n' + expText + '\n\n' +
      '=== KAS MASUK (30 hari terakhir) ===\n' + intInText + '\n\n' +
      '=== KAS KELUAR (30 hari terakhir) ===\n' + intOutText + '\n\n' +
      '=== RINGKASAN BULAN INI ===\n' +
      '- Total Pendapatan : Rp ' + n(s.totalIncomeMonth).toLocaleString('id-ID') + '\n' +
      '- Total Pengeluaran: Rp ' + n(s.totalExpenseMonth).toLocaleString('id-ID') + '\n' +
      '- Keuntungan Bersih: Rp ' + n(s.profitMonth).toLocaleString('id-ID') + '\n' +
      '- Properti Terisi  : ' + (s.occupied || 0) + ' dari ' + (s.totalProps || 0) + '\n\n' +
      'Jawab berdasarkan data di atas. Jika data tidak tersedia, katakan "belum ada data".';

    const geminiHistory = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1];

    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=' + process.env.GEMINI_API_KEY;

    const requestBody = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: lastMessage.content }] }
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
    try {
      data = JSON.parse(result.text);
    } catch(e) {
      console.error('Gemini JSON parse error:', result.text.slice(0, 300));
      return res.status(502).json({ message: 'Respons AI tidak valid (parse error)' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, tidak ada respons dari AI.';
    res.json({ reply });

  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

module.exports = router;