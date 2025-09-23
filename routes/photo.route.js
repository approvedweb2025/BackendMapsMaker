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

// Sync images (protected)
router.get('/sync-images', ensureAuth, syncImages);

// All photos (public or protect if you want)
router.get('/get-photos', getPhotos);

// Stats
router.get('/get-image-by-month', getImageStatsByMonth);

// By uploader
router.get('/getImages/:uploadedBy', getImagesByUploadedBy);

// Shortcuts
router.get('/get1stEmailPhotos', getFirstEmailImage);
router.get('/get2ndEmailPhotos', getSecondEmailImage);
router.get('/get3rdEmailPhotos', getThirdEmailImage);

// Serve image from GridFS by file id (if you ever store into GridFS)
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
