const express = require('express');
const router = express.Router();
const InternalExpense = require('../models/InternalExpense');
const auth = require('../middleware/auth');

// GET semua
router.get('/', auth, async (req, res) => {
  try {
    const data = await InternalExpense.find({ user: req.user.id }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET satu by id
router.get('/:id', auth, async (req, res) => {
  try {
    const item = await InternalExpense.findOne({ _id: req.params.id, user: req.user.id });
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
    const item = new InternalExpense({ date, name, amount, note, user: req.user.id });
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
    const item = await InternalExpense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
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
    const item = await InternalExpense.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!item) return res.status(404).json({ message: 'Data tidak ditemukan' });
    res.json({ message: 'Data berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;