const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  ImageURL: { type: String, default: null },
  fileId: { type: String, unique: true, required: true },
  name: String,
  mimeType: String,
  latitude: Number,
  longitude: Number,
  uploadedBy: String,
  localPath: String,   // ✅ legacy field
  googleDriveUrl: String, // ✅ legacy field for Google Drive
  cloudinaryUrl: String, // ✅ Cloudinary URL
  cloudinaryPublicId: String, // ✅ Cloudinary public ID for management
  cloudinarySecureUrl: String, // ✅ Cloudinary secure URL
  lastCheckedAt: { type: Date, default: null },
  district: String,
  village: String,
  tehsil: String,
  country: String,
  timestamp: { type: Date, required: true, index: true }
}, { timestamps: true });

module.exports = mongoose.model('Image', imageSchema);
