const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Controllers
const {
  uploadPhoto,
  streamPhoto,
  getPhotoMeta,
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

// ✅ Upload image (multipart/form-data field: file)
router.post('/upload', upload.single('file'), uploadPhoto);

// ✅ Stream image content by GridFS id or stored fileId
router.get('/:id/stream', streamPhoto);

// ✅ Get single photo metadata
router.get('/:id/meta', getPhotoMeta);

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
    const image = await Image.findOne({ $or: [{ fileId: req.params.id }, { driveFileId: req.params.id }] });
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // If fileId looks like a GridFS ObjectId, stream through our API for bytes
    const looksLikeObjectId = /^[a-f0-9]{24}$/.test(image.fileId || '');
    if (looksLikeObjectId) {
      return res.redirect(`/photos/${image.fileId}/stream`);
    }

    // Else try direct media download from Google Drive using provided token
    if (image.driveFileId) {
      const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring('Bearer '.length)
        : (req.query.accessToken || null);

      if (!token) {
        // No token → fallback to view URL (may not render as <img>)
        return res.redirect(image.googleDriveUrl || `https://drive.google.com/file/d/${image.driveFileId}/view`);
      }

      // Proxy alt=media
      const axios = require('axios');
      const url = `https://www.googleapis.com/drive/v3/files/${image.driveFileId}?alt=media`;
      const upstream = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'stream'
      });
      if (image.mimeType) res.setHeader('Content-Type', image.mimeType);
      return upstream.data.pipe(res);
    }

    return res.status(404).json({ error: 'Image URL not available' });

  } catch (err) {
    console.error('❌ Image fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
