// models/Image.model.js
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    ImageURL: { type: String, default: null }, // optional; you can map this to localPath if you want
    fileId: { type: String, unique: true, required: true },
    name: String,
    mimeType: String,
    latitude: Number,
    longitude: Number,
    uploadedBy: String,
    localPath: String, // e.g. "/uploads/<fileId>.jpg"
    lastCheckedAt: { type: Date, default: null },
    district: String,
    village: String,
    tehsil: String,
    country: String,
    timestamp: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Image', imageSchema);
