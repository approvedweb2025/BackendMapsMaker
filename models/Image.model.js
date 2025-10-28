const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  //  Store image data directly in the database as a Buffer
  imageData: { type: Buffer, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  timestamp: { type: Date },
  uploadedBy: { type: String },
  lastCheckedAt: { type: Date },
  district: { type: String },
  tehsil: { type: String },
  village: { type: String },
  country: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Image', ImageSchema);
