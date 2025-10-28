// models/Image.model.js
const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  imageData: { type: Buffer, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  timestamp: { type: Date },
  uploadedBy: { type: String, required: true },
  lastCheckedAt: { type: Date, default: Date.now },
  district: { type: String },
  tehsil: { type: String },
  village: { type: String },
  country: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Image', ImageSchema);
