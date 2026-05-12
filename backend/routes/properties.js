const express = require('express');
const Property = require('../models/Property');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all properties
router.get('/', auth, async (req, res) => {
  try {
    const properties = await Property.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Get one property
router.get('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, userId: req.userId });
    if (!property) return res.status(404).json({ message: 'Properti tidak ditemukan' });
    res.json(property);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Create property
router.post('/', auth, async (req, res) => {
  try {
    const { name, address, city, type, rent, status, notes } = req.body;
    const property = new Property({
      userId: req.userId,
      name,
      address,
      city,
      type,
      rent,
      status,
      notes
    });
    await property.save();
    res.status(201).json(property);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Update property
router.put('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!property) return res.status(404).json({ message: 'Properti tidak ditemukan' });
    res.json(property);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Delete property
router.delete('/:id', auth, async (req, res) => {
  try {
    const property = await Property.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!property) return res.status(404).json({ message: 'Properti tidak ditemukan' });
    res.json({ message: 'Properti berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;
