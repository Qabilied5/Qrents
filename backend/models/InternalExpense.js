const mongoose = require('mongoose');

const internalExpenseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:     { type: Date, required: true },
  name:     { type: String, required: true, trim: true },
  amount:   { type: Number, required: true },
  category: { type: String, trim: true, default: '' },
  note:     { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('InternalExpense', internalExpenseSchema, 'internal_expenses');