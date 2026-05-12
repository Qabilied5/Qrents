const express = require('express');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all tenants
router.get('/', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ userId: req.userId })
      .populate('propertyId')
      .sort({ createdAt: -1 });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Get tenants by property
router.get('/property/:propertyId', auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ userId: req.userId, propertyId: req.params.propertyId });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Get tenant by id
router.get('/:id', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, userId: req.userId }).populate('propertyId');
    if (!tenant) return res.status(404).json({ message: 'Penyewa tidak ditemukan' });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Create tenant
router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, email, ktp, propertyId, start, end, rent, deposit, notes } = req.body;
    const tenant = new Tenant({
      userId: req.userId,
      name,
      phone,
      email,
      ktp,
      propertyId,
      start,
      end,
      rent,
      deposit,
      notes
    });
    await tenant.save();
    if (propertyId) {
      await Property.findByIdAndUpdate(propertyId, { status: 'terisi' });
    }
    res.status(201).json(tenant);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Update tenant
router.put('/:id', auth, async (req, res) => {
  try {
    const existingTenant = await Tenant.findOne({ _id: req.params.id, userId: req.userId });
    if (!existingTenant) return res.status(404).json({ message: 'Penyewa tidak ditemukan' });

    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    ).populate('propertyId');

    if (req.body.propertyId) {
      await Property.findByIdAndUpdate(req.body.propertyId, { status: 'terisi' });
    }

    if (existingTenant.propertyId && req.body.propertyId && existingTenant.propertyId.toString() !== req.body.propertyId) {
      const remaining = await Tenant.countDocuments({ propertyId: existingTenant.propertyId.toString(), userId: req.userId });
      if (remaining === 0) {
        await Property.findByIdAndUpdate(existingTenant.propertyId, { status: 'kosong' });
      }
    }

    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Delete tenant
router.delete('/:id', auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!tenant) return res.status(404).json({ message: 'Penyewa tidak ditemukan' });
    if (tenant.propertyId) {
      const remaining = await Tenant.countDocuments({ propertyId: tenant.propertyId.toString(), userId: req.userId });
      if (remaining === 0) {
        await Property.findByIdAndUpdate(tenant.propertyId, { status: 'kosong' });
      }
    }
    res.json({ message: 'Penyewa berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;
