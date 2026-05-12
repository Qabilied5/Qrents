const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  city: String,
  type: { type: String, enum: ['Rumah', 'Kos', 'Ruko', 'Kontrakan', 'Apartemen'], required: true },
  rent: { type: Number, required: true },
  status: { type: String, enum: ['kosong', 'terisi'], default: 'kosong' },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', propertySchema);
