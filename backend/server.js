// server.js
require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const session        = require('express-session');
const passport       = require('passport');
const connectDB      = require('./config/db');
const path           = require('path');

const app = express();

// 1. Middleware Utama
app.use(cors());
app.use(express.json());

// 2. Session (dibutuhkan Passport untuk OAuth handshake)
app.use(
  session({
    secret:            process.env.JWT_SECRET || 'qrents_session_secret',
    resave:            false,
    saveUninitialized: false,
    cookie:            { secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60 * 1000 },
  })
);

// 3. Passport (harus setelah session)
app.use(passport.initialize());
app.use(passport.session());

// 4. Koneksi Database
connectDB();

// 5. Rute API
app.use('/api/auth',               require('./routes/auth'));
app.use('/api/properties',         require('./routes/properties'));
app.use('/api/tenants',            require('./routes/tenants'));
app.use('/api/income',             require('./routes/income'));
app.use('/api/expenses',           require('./routes/expenses'));
app.use('/api/internal-incomes',   require('./routes/internalIncomes'));
app.use('/api/internal-expenses',  require('./routes/internalExpenses'));
app.use('/api/cicilan',            require('./routes/cicilan'));
app.use('/api/chat',               require('./routes/chat'));

// Shortcut route agar Google Callback URL yang terdaftar di Google Console
// (https://qrents.onrender.com/auth/google/callback) tetap berfungsi
// walaupun API prefix-nya /api/auth


// USELESS Ah 
// app.get(
//   '/auth/google/callback',
//   (req, res, next) => {
//     // Forward ke router auth yang sudah terdaftar
//     req.url = '/google/callback';
//     app._router.handle(
//       Object.assign(req, { url: req.url }),
//       res,
//       next
//     );
//   }
// );

const jwt = require('jsonwebtoken'); // tambah di atas jika belum ada

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?googleError=1', session: false }),
  (req, res) => {
    const user  = req.user;
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    const params = new URLSearchParams({
      token,
      name:     user.name,
      username: user.username,
      id:       user._id.toString(),
    });
    res.redirect(`/?${params.toString()}`);
  }
);

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// 6. Static & SPA fallback
app.use(express.static(path.join(__dirname, '../')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});