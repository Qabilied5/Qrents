const express = require('express');
const Cicilan = require('../models/Cicilan');
const auth = require('../middleware/auth');

const router = express.Router();

// GET all cicilan
router.get('/', auth, async (req, res) => {
  try {
    const data = await Cicilan.find({ userId: req.userId }).sort({ date: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// GET cicilan by id
router.get('/:id', auth, async (req, res) => {
  try {
    const item = await Cicilan.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Cicilan tidak ditemukan' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// POST create cicilan
router.post('/', auth, async (req, res) => {
  try {
    const { date, name, category, totalAmount, totalBulan, bulanan, bunga, note } = req.body;
    const cicilan = new Cicilan({
      userId: req.userId,
      date,
      name,
      category:    category || '',
      totalAmount: Number(totalAmount),
      totalBulan:  Number(totalBulan),
      bulanan:     Number(bulanan) || Math.ceil(Number(totalAmount) / Number(totalBulan)),
      bunga:       Number(bunga) || 0,
      note:        note || '',
      payments:    [],
    });
    await cicilan.save();
    res.status(201).json(cicilan);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// PUT update cicilan
router.put('/:id', auth, async (req, res) => {
  try {
    const item = await Cicilan.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Cicilan tidak ditemukan' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// DELETE cicilan (beserta semua payments)
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Cicilan.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Cicilan tidak ditemukan' });
    res.json({ message: 'Cicilan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// ===== PAYMENT SUB-ROUTES =====

// POST catat pembayaran cicilan
router.post('/:id/payments', auth, async (req, res) => {
  try {
    const { date, amount, note } = req.body;
    const item = await Cicilan.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Cicilan tidak ditemukan' });

    item.payments.push({ date, amount: Number(amount), note: note || '' });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// DELETE hapus satu catatan pembayaran
router.delete('/:id/payments/:paymentId', auth, async (req, res) => {
  try {
    const item = await Cicilan.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Cicilan tidak ditemukan' });

    const before = item.payments.length;
    item.payments = item.payments.filter(p => p._id.toString() !== req.params.paymentId);
    if (item.payments.length === before) {
      return res.status(404).json({ message: 'Catatan pembayaran tidak ditemukan' });
    }

    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;