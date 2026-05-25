// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// ─── Passport Google Strategy ───────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email    = profile.emails?.[0]?.value || '';
        const googleId = profile.id;
        const name     = profile.displayName || 'Google User';

        // Cari user berdasarkan googleId atau email
        let user = await User.findOne({ $or: [{ googleId }, { username: email }] });

        if (!user) {
          // Buat akun baru otomatis
          user = new User({
            name,
            username: email || `google_${googleId}`,
            googleId,
            // password kosong — user ini tidak bisa login via username/pass
          });
          await user.save();
        } else if (!user.googleId) {
          // Akun lama pakai email yang sama — tautkan Google
          user.googleId = googleId;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Passport session (minimal — hanya untuk OAuth handshake)
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (e) {
    done(e, null);
  }
});

// ─── Google OAuth Routes ─────────────────────────────────────────────────────

// 1. Mulai alur login Google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. Callback dari Google
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/?googleError=1', session: false }),
  (req, res) => {
    const user  = req.user;
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // Redirect ke frontend dengan token di query string
    // Frontend akan mengambil token ini lalu menyimpan ke localStorage
    const params = new URLSearchParams({
      token,
      name:     user.name,
      username: user.username,
      id:       user._id.toString(),
    });
    res.redirect(`/?${params.toString()}`);
  }
);

// ─── Standard Auth Routes ────────────────────────────────────────────────────

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ message: 'Lengkapi semua field' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username sudah terdaftar' });
    }

    const user = new User({ name, username, password });
    await user.save();

    res.status(201).json({
      message: 'Akun berhasil dibuat',
      user: { id: user._id, name: user.name, username: user.username },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registrasi', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password harus diisi' });
    }

    const user = await User.findOne({ username });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login berhasil',
      token,
      user: { id: user._id, name: user.name, username: user.username },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error login', error: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;