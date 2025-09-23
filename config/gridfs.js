// config/gridfs.js
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let bucket = null;

function initGridFS() {
  const db = mongoose.connection.db;
  if (!db) {
    console.warn('GridFS init skipped: no db connection yet.');
    return;
  }
  bucket = new GridFSBucket(db, { bucketName: 'uploads' });
  console.log('✅ GridFSBucket initialized (bucket: uploads)');
}

function getGridFSBucket() {
  if (!bucket) {
    throw new Error('GridFS bucket not initialized yet.');
  }
  return bucket;
}

module.exports = { initGridFS, getGridFSBucket };
