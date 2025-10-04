// config/gridfs.js
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

let gfsBucket; // GridFS bucket instance
let uploadsBucketName = "uploads";

/**
 * Initialize GridFS after MongoDB connection opens
 */
const initGridFS = (bucketName) => {
  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ MongoDB connection not ready for GridFS");
    return;
  }

  uploadsBucketName = bucketName || uploadsBucketName;
  gfsBucket = new GridFSBucket(db, { bucketName: uploadsBucketName });
  console.log("✅ GridFS initialized with bucket name: " + uploadsBucketName);
};

/**
 * Get current GridFS bucket
 */
const getGridFSBucket = () => {
  if (!gfsBucket) {
    throw new Error("GridFS not initialized yet. Call initGridFS after DB connect.");
  }
  return gfsBucket;
};

/**
 * Upload a buffer to GridFS
 */
const uploadBufferToGridFS = async ({ filename, contentType, buffer, metadata }) => {
  const bucket = getGridFSBucket();
  return await new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: metadata || {}
    });
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
};

/**
 * Open a readable stream from GridFS by fileId
 */
const openDownloadStreamById = (id) => {
  const bucket = getGridFSBucket();
  return bucket.openDownloadStream(id);
};

module.exports = { initGridFS, getGridFSBucket, uploadBufferToGridFS, openDownloadStreamById };
