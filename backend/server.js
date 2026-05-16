require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');

const app = express();

// 1. Middleware Utama
app.use(cors());
app.use(express.json());

// 2. Koneksi Database
connectDB();

// 3. Rute API
app.use('/api/auth',               require('./routes/auth'));
app.use('/api/properties',         require('./routes/properties'));
app.use('/api/tenants',            require('./routes/tenants'));
app.use('/api/income',             require('./routes/income'));
app.use('/api/expenses',           require('./routes/expenses'));
app.use('/api/internal-incomes',   require('./routes/internalIncomes'));
app.use('/api/internal-expenses',  require('./routes/internalExpenses'));
app.use('/api/cicilan',            require('./routes/cicilan'));   // ← Cicilan & pembayaran
app.use('/api/chat',               require('./routes/chat'));       // ← AI Chatbot

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.use(express.static(path.join(__dirname, '../')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});