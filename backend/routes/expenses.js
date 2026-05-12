const express = require('express');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all expenses
router.get('/', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId })
      .populate('propertyId')
      .sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Create expense
router.post('/', auth, async (req, res) => {
  try {
    const { date, propertyId, category, amount, note } = req.body;
    const expense = new Expense({
      userId: req.userId,
      date,
      propertyId,
      category,
      amount,
      note
    });
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Update expense
router.put('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    ).populate('propertyId');
    if (!expense) return res.status(404).json({ message: 'Pengeluaran tidak ditemukan' });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!expense) return res.status(404).json({ message: 'Pengeluaran tidak ditemukan' });
    res.json({ message: 'Pengeluaran berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;
