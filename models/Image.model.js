const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  ImageURL: { type: String, default: null },
  fileId: { type: String, unique: true, required: true },
  driveFileId: { type: String, default: null },
  name: String,
  mimeType: String,
  latitude: Number,
  longitude: Number,
  uploadedBy: String,
  localPath: String,   // ✅ legacy field
  googleDriveUrl: String, // ✅ new field for serverless
  cloudinaryUrl: String,
  lastCheckedAt: { type: Date, default: null },
  district: String,
  village: String,
  tehsil: String,
  country: String,
  timestamp: { type: Date, required: true, index: true }
}, { timestamps: true });

module.exports = mongoose.model('Image', imageSchema);
