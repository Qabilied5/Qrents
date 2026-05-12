const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  amount: { type: Number, required: true },
  category: { type: String, enum: ['Sewa Bulanan', 'Deposit', 'Denda Keterlambatan', 'Biaya Tambahan', 'Lainnya'], required: true },
  method: { type: String, enum: ['Transfer Bank', 'Tunai', 'QRIS', 'OVO', 'GoPay'], required: true },
  note: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Income', incomeSchema);
