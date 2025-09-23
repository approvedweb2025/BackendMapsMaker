// config/gridfs.js
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

let gfsBucket; // GridFS bucket instance

/**
 * Initialize GridFS after MongoDB connection opens
 */
const initGridFS = () => {
  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ MongoDB connection not ready for GridFS");
    return;
  }

  gfsBucket = new GridFSBucket(db, { bucketName: "uploads" });
  console.log("✅ GridFS initialized with bucket name: uploads");
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

module.exports = { initGridFS, getGridFSBucket };
