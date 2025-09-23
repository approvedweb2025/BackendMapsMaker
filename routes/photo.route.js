const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getGridFSBucket } = require('../config/gridfs');

// Controllers
const {
  getImageStatsByMonth,
  syncImages,
  getPhotos,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage
} = require('../controllers/photo.controller');

// ✅ SYNC IMAGES AND SAVE IN DB (GridFS + Metadata)
router.get('/sync-images', syncImages);

// ✅ GET ALL PHOTOS (Metadata only)
router.get('/get-photos', getPhotos);

// ✅ GET IMAGE STATS BY MONTH
router.get('/get-image-by-month', getImageStatsByMonth);

// ✅ GET IMAGES BY UPLOADER EMAIL
router.get('/getImages/:uploadedBy', getImagesByUploadedBy);

// ✅ SHORTCUT ROUTES FOR SPECIFIC EMAILS
router.get('/get1stEmailPhotos', getFirstEmailImage);
router.get('/get2ndEmailPhotos', getSecondEmailImage);
router.get('/get3rdEmailPhotos', getThirdEmailImage);

// ✅ SERVE IMAGE FROM GRIDFS BY ID
router.get('/file/:id', async (req, res) => {
  try {
    const bucket = getGridFSBucket();
    const fileId = new ObjectId(req.params.id);

    const downloadStream = bucket.openDownloadStream(fileId);

    // Agar file not found hui
    downloadStream.on('error', () => {
      return res.status(404).json({ error: 'File not found in GridFS' });
    });

    // ✅ Stream image to client
    res.set('Content-Type', 'image/jpeg'); // optionally adjust mimeType
    downloadStream.pipe(res);

  } catch (err) {
    console.error('❌ GridFS fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
