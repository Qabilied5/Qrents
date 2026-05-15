const mongoose = require('mongoose');

const internalIncomeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:   { type: Date, required: true },
  name:   { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  note:   { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('InternalIncome', internalIncomeSchema, 'internal_incomes');