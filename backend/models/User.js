// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  username:  { type: String, required: true, unique: true },
  password:  { type: String },           // opsional — user Google tidak punya password
  googleId:  { type: String, sparse: true, index: true }, // ID dari Google
  createdAt: { type: Date, default: Date.now },
});

// Hash password sebelum simpan (hanya jika password diisi dan berubah)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt    = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false; // user Google tidak bisa login via password
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);