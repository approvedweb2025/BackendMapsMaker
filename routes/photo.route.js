// routes/photo.route.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getGridFSBucket } = require('../config/gridfs');
const ensureAuth = require('../middleware/ensureAuth');

const {
  getImageStatsByMonth,
  syncImages,
  getPhotos,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,
} = require('../controllers/photo.controller');

// protect sync
router.get('/sync-images', ensureAuth, syncImages);

// public listing (or protect if needed)
router.get('/get-photos', getPhotos);

// stats
router.get('/get-image-by-month', getImageStatsByMonth);

// by uploader
router.get('/getImages/:uploadedBy', getImagesByUploadedBy);

// shortcuts
router.get('/get1stEmailPhotos', getFirstEmailImage);
router.get('/get2ndEmailPhotos', getSecondEmailImage);
router.get('/get3rdEmailPhotos', getThirdEmailImage);

// optional: GridFS fetch
router.get('/file/:id', async (req, res) => {
  try {
    const bucket = getGridFSBucket();
    const fileId = new ObjectId(req.params.id);
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on('error', () => res.status(404).json({ error: 'File not found in GridFS' }));
    res.set('Content-Type', 'image/jpeg');
    downloadStream.pipe(res);
  } catch (err) {
    console.error('❌ GridFS fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
