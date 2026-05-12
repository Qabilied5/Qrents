const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  category: { type: String, enum: ['Perbaikan & Renovasi', 'Pajak PBB', 'Listrik / Air', 'Kebersihan', 'Asuransi', 'Biaya Agen', 'Perabot', 'Lainnya'], required: true },
  amount: { type: Number, required: true },
  note: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Expense', expenseSchema);
