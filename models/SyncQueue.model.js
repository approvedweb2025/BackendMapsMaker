// models/SyncQueue.model.js
const mongoose = require('mongoose');

const SyncQueueSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mimeType: { type: String },
  createdTime: { type: Date },
  uploadedBy: { type: String, required: true },
  accessToken: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'failed'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('SyncQueue', SyncQueueSchema);
