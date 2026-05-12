const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: String,
  ktp: String,
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  start: { type: Date, required: true },
  end: Date,
  rent: { type: Number, required: true },
  deposit: { type: Number, default: 0 },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tenant', tenantSchema);
