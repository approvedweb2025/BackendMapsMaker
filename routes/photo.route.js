const express = require('express');
const router = express.Router();

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

// ✅ SERVE IMAGE FROM GOOGLE DRIVE BY FILE ID
router.get('/file/:id', async (req, res) => {
  try {
    const Image = require('../models/Image.model');
    const image = await Image.findOne({ fileId: req.params.id });
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Redirect to Google Drive URL for serverless compatibility
    if (image.googleDriveUrl) {
      return res.redirect(image.googleDriveUrl);
    }

    // Fallback to local path if available
    if (image.localPath) {
      return res.redirect(image.localPath);
    }

    res.status(404).json({ error: 'Image URL not available' });

  } catch (err) {
    console.error('❌ Image fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
