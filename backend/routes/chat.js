// routes/chat.js — menggunakan Google Gemini API (Free Tier)
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');

// POST /api/chat
router.post('/', auth, async (req, res) => {
  try {
    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages harus berupa array' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'GEMINI_API_KEY belum dikonfigurasi di .env' });
    }

    const systemPrompt = `Kamu adalah asisten keuangan pribadi untuk aplikasi Qrents Pro — aplikasi manajemen properti sewa.
Jawab dalam Bahasa Indonesia, singkat, jelas, dan langsung ke intinya.
Jika ditanya soal angka, tampilkan dalam format Rupiah (Rp xxx.xxx).
Jangan menyebutkan bahwa kamu AI atau model bahasa — cukup jawab pertanyaannya.

Berikut adalah DATA AKTUAL milik pengguna saat ini:

=== PROPERTI ===
${(context.properties?.length
  ? context.properties.map(p =>
      `- ${p.name} (${p.type}, ${p.status}) — Sewa: Rp ${p.rent?.toLocaleString('id-ID')} | Kota: ${p.city || p.address}`
    ).join('\n')
  : 'Belum ada data properti.')}

=== PENYEWA AKTIF ===
${(context.tenants?.length
  ? context.tenants.map(t =>
      `- ${t.name} -> ${t.propertyId?.name || '?'} | Sewa: Rp ${t.rent?.toLocaleString('id-ID')} | Kontrak s/d: ${t.end ? new Date(t.end).toLocaleDateString('id-ID') : '-'}`
    ).join('\n')
  : 'Belum ada data penyewa.')}

=== PENDAPATAN (30 hari terakhir) ===
${(context.recentIncome?.length
  ? context.recentIncome.map(i =>
      `- ${new Date(i.date).toLocaleDateString('id-ID')} | ${i.propertyId?.name || '?'} | ${i.category} | Rp ${i.amount?.toLocaleString('id-ID')} | ${i.note || ''}`
    ).join('\n')
  : 'Tidak ada pendapatan 30 hari terakhir.')}

=== PENGELUARAN (30 hari terakhir) ===
${(context.recentExpenses?.length
  ? context.recentExpenses.map(e =>
      `- ${new Date(e.date).toLocaleDateString('id-ID')} | ${e.propertyId?.name || '?'} | ${e.category} | Rp ${e.amount?.toLocaleString('id-ID')} | ${e.note || ''}`
    ).join('\n')
  : 'Tidak ada pengeluaran 30 hari terakhir.')}

=== KAS MASUK (30 hari terakhir) ===
${(context.recentIntIncomes?.length
  ? context.recentIntIncomes.map(i =>
      `- ${new Date(i.date).toLocaleDateString('id-ID')} | ${i.category} | ${i.name} | Rp ${i.amount?.toLocaleString('id-ID')}`
    ).join('\n')
  : 'Tidak ada kas masuk 30 hari terakhir.')}

=== KAS KELUAR (30 hari terakhir) ===
${(context.recentIntExpenses?.length
  ? context.recentIntExpenses.map(i =>
      `- ${new Date(i.date).toLocaleDateString('id-ID')} | ${i.category} | ${i.name} | Rp ${i.amount?.toLocaleString('id-ID')}`
    ).join('\n')
  : 'Tidak ada kas keluar 30 hari terakhir.')}

=== RINGKASAN BULAN INI ===
- Total Pendapatan : Rp ${context.summary?.totalIncomeMonth?.toLocaleString('id-ID') || 0}
- Total Pengeluaran: Rp ${context.summary?.totalExpenseMonth?.toLocaleString('id-ID') || 0}
- Keuntungan Bersih: Rp ${context.summary?.profitMonth?.toLocaleString('id-ID') || 0}
- Properti Terisi  : ${context.summary?.occupied || 0} dari ${context.summary?.totalProps || 0}

Jawab berdasarkan data di atas. Jika data tidak tersedia, katakan "belum ada data".`;

    // Konversi history ke format Gemini (role: 'user' | 'model')
    const geminiHistory = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1];

    const GEMINI_MODEL = 'gemini-2.0-flash-001';
    const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: lastMessage.content }] }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      return res.status(502).json({ message: 'Gagal menghubungi AI. Coba lagi.' });
    }

    const data  = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
                  || 'Maaf, tidak ada respons dari AI.';

    res.json({ reply });

  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

module.exports = router;