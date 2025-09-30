const express = require('express');
const axios = require('axios');
const Image = require('../models/Image.model');
const router = express.Router();
const exifr = require('exifr');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getImageStatsByMonth, syncImages, getPhotos, getImagesByUploadedBy, getFirstEmailImage, getSecondEmailImage, getThirdEmailImage } = require('../controllers/photo.controller');

// ✅ SYNC IMAGES AND SAVE IN DB
router.get('/sync-images', syncImages);

// ✅ GET PHOTOS
router.get('/get-photos', getPhotos);

router.get('/get-image-by-month', getImageStatsByMonth)

router.get('/getImages/:uploadedBy', getImagesByUploadedBy);

router.get('/get1stEmailPhotos', getFirstEmailImage)

router.get('/get2ndEmailPhotos', getSecondEmailImage)

router.get('/get3rdEmailPhotos', getThirdEmailImage)

module.exports = router;
