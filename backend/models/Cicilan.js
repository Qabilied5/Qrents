const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  date:   { type: Date, required: true },
  amount: { type: Number, required: true },
  note:   { type: String, default: '' },
}, { timestamps: true });

const cicilanSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:        { type: Date, required: true },
  name:        { type: String, required: true, trim: true },
  category:    { type: String, default: '' },
  totalAmount: { type: Number, required: true },
  totalBulan:  { type: Number, required: true },
  bulanan:     { type: Number, required: true },
  bunga:       { type: Number, default: 0 },
  note:        { type: String, default: '' },
  payments:    [paymentSchema],
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('Cicilan', cicilanSchema);