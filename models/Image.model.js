// models/Image.model.js
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    // keep if you want a general URL field:
    ImageURL: { type: String, default: null },

    fileId: { type: String, unique: true, required: true }, // Google Drive file id
    name: String,
    mimeType: String,

    // Geo
    latitude: Number,
    longitude: Number,
    district: String,
    village: String,
    tehsil: String,
    country: String,

    // Uploader & time
    uploadedBy: String,
    timestamp: { type: Date, required: true, index: true },
    lastCheckedAt: { type: Date, default: null },

    // Storage
    s3Key: { type: String, default: null }, // e.g. images/<fileId>.jpg
    s3Url: { type: String, default: null }, // full https url
    localPath: { type: String, default: null }, // legacy, not used on AWS
  },
  { timestamps: true }
);

module.exports = mongoose.model('Image', imageSchema);
