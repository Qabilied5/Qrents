const express = require('express');
const Income = require('../models/Income');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all income
router.get('/', auth, async (req, res) => {
  try {
    const income = await Income.find({ userId: req.userId })
      .populate('propertyId')
      .populate('tenantId')
      .sort({ date: -1 });
    res.json(income);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Get income by id
router.get('/:id', auth, async (req, res) => {
  try {
    const income = await Income.findOne({ _id: req.params.id, userId: req.userId })
      .populate('propertyId')
      .populate('tenantId');
    if (!income) return res.status(404).json({ message: 'Pendapatan tidak ditemukan' });
    res.json(income);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Create income
router.post('/', auth, async (req, res) => {
  try {
    const { date, propertyId, tenantId, amount, category, method, note } = req.body;
    const income = new Income({
      userId: req.userId,
      date,
      propertyId,
      tenantId: tenantId || null,
      amount,
      category,
      method,
      note
    });
    await income.save();
    res.status(201).json(income);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Update income
router.put('/:id', auth, async (req, res) => {
  try {
    const income = await Income.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    ).populate('propertyId').populate('tenantId');
    if (!income) return res.status(404).json({ message: 'Pendapatan tidak ditemukan' });
    res.json(income);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Delete income
router.delete('/:id', auth, async (req, res) => {
  try {
    const income = await Income.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!income) return res.status(404).json({ message: 'Pendapatan tidak ditemukan' });
    res.json({ message: 'Pendapatan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;
