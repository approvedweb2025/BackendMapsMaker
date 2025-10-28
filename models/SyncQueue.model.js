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
    enum: ['pending', 'processing', 'failed', 'completed'],
    default: 'pending'
  },
  errorMessage: { type: String } // Ghalti hone par message store karne ke liye
}, { timestamps: true }); // createdAt aur updatedAt automatically add ho jayenge

module.exports = mongoose.model('SyncQueue', SyncQueueSchema);
