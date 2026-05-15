const express = require('express');
const router = express.Router();
const InternalIncome = require('../models/InternalIncome');
const auth = require('../middleware/auth');

// GET semua
router.get('/', auth, async (req, res) => {
  try {
    const data = await InternalIncome.find({ userId: req.userId }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET satu by id
router.get('/:id', auth, async (req, res) => {
  try {
    const item = await InternalIncome.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Data tidak ditemukan' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST tambah baru
router.post('/', auth, async (req, res) => {
  try {
    const { date, name, amount, note } = req.body;
    if (!date || !name || !amount) {
      return res.status(400).json({ message: 'Tanggal, nama, dan jumlah wajib diisi' });
    }
    const item = new InternalIncome({ userId: req.userId, date, name, amount, note });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT edit
router.put('/:id', auth, async (req, res) => {
  try {
    const { date, name, amount, note } = req.body;
    const item = await InternalIncome.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { date, name, amount, note },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Data tidak ditemukan' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await InternalIncome.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Data tidak ditemukan' });
    res.json({ message: 'Data berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;