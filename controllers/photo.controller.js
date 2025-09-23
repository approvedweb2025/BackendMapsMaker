// controllers/photo.controller.js
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const exifr = require('exifr');
const Image = require('../models/Image.model');

// Download file from Google Drive directly into permanent path
const downloadFile = async (fileId, accessToken, destPath) => {
  const response = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` }, responseType: 'stream' }
  );

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  const writer = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

// Reverse Geocoding via Google API
const getPlaceDetails = async (lat, lng) => {
  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { latlng: `${lat},${lng}`, key: process.env.GOOGLE_GEOCODING_API_KEY },
    });

    if (res.data.status === 'OK' && res.data.results.length > 0) {
      const components = res.data.results[0].address_components;
      const extract = (type) => components.find((c) => c.types.includes(type))?.long_name || '';

      return {
        district:
          extract('administrative_area_level_2') || extract('administrative_area_level_1') || '',
        tehsil: extract('administrative_area_level_3') || extract('sublocality_level_1') || '',
        village: extract('locality') || extract('sublocality') || extract('neighborhood') || '',
        country: extract('country') || '',
      };
    }
    return { district: '', tehsil: '', village: '', country: '' };
  } catch (err) {
    console.error('❌ Geocode error:', err.message);
    return { district: '', tehsil: '', village: '', country: '' };
  }
};

// Sync Google Drive images → DB + uploads folder
const syncImages = async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const accessToken = req.user.accessToken;

  try {
    let files = [];
    let nextPageToken = null;

    do {
      const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: "mimeType contains 'image/' and trashed=false",
          fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
          pageToken: nextPageToken,
          pageSize: 1000,
        },
      });

      files.push(...(driveResponse.data.files || []));
      nextPageToken = driveResponse.data.nextPageToken;
    } while (nextPageToken);

    console.log(`✅ Total files fetched: ${files.length}`);

    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    for (const file of files) {
      try {
        const exists = await Image.findOne({ fileId: file.id });
        const ext = path.extname(file.name) || '.jpg';
        const permanentPath = path.join(uploadsDir, `${file.id}${ext}`);

        if (exists || fs.existsSync(permanentPath)) {
          console.log(`⏭️ Skipping ${file.name} (already saved)`);
          continue;
        }

        await downloadFile(file.id, accessToken, permanentPath);

        let latitude = null,
          longitude = null;
        let timestamp = new Date(file.createdTime || Date.now());

        // Safe EXIF parse
        let exifData = null;
        try {
          if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
            exifData = (await exifr.parse(permanentPath)) || {};
          }
        } catch (err) {
          console.warn(`⚠️ EXIF error for ${file.name}:`, err.message);
        }

        latitude = exifData?.latitude ?? null;
        longitude = exifData?.longitude ?? null;
        if (exifData?.DateTimeOriginal) {
          const dt = new Date(exifData.DateTimeOriginal);
          if (!isNaN(dt)) timestamp = dt;
        }

        let placeDetails = { district: '', tehsil: '', village: '', country: '' };
        if (latitude && longitude) {
          placeDetails = await getPlaceDetails(latitude, longitude);
        }

        await Image.create({
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          latitude,
          longitude,
          timestamp,
          uploadedBy: req.user?.email || 'unknown',
          lastCheckedAt: new Date(),
          localPath: `/uploads/${file.id}${ext}`,
          // optionally mirror:
          ImageURL: `/uploads/${file.id}${ext}`,
          ...placeDetails,
        });
      } catch (fileErr) {
        console.error(`❌ Error processing file ${file.name}:`, fileErr.message || fileErr);
      }
    }

    const synced = await Image.find().sort({ createdAt: -1 });
    res.status(200).json({
      message: '✅ Sync complete',
      total: synced.length,
      photos: synced,
    });
  } catch (err) {
    console.error('❌ Sync error:', err.message || err);
    res.status(500).json({ error: 'Failed to sync images', details: err.message });
  }
};

// Get all photos
const getPhotos = async (req, res) => {
  try {
    const photos = await Image.find().sort({ createdAt: -1 });
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Monthly Stats (month + uploader + count)
const getImageStatsByMonth = async (req, res) => {
  try {
    const monthlyStats = await Image.aggregate([
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$timestamp' } },
            uploadedBy: '$uploadedBy',
          },
          count: { $sum: 1 },
        },
      },
      { $project: { month: '$_id.month', uploadedBy: '$_id.uploadedBy', count: 1, _id: 0 } },
      { $sort: { month: 1 } },
    ]);

    const uniqueUploaders = [...new Set(monthlyStats.map((s) => s.uploadedBy).filter(Boolean))];
    res.status(200).json({ stats: monthlyStats, uniqueUploaders });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get monthly stats', error: err.message });
  }
};

// Yearly Stats
const getImageStatsByYear = async (req, res) => {
  try {
    const yearlyStats = await Image.aggregate([
      {
        $group: {
          _id: {
            year: { $dateToString: { format: '%Y', date: '$timestamp' } },
            uploadedBy: '$uploadedBy',
          },
          count: { $sum: 1 },
        },
      },
      { $project: { year: '$_id.year', uploadedBy: '$_id.uploadedBy', count: 1, _id: 0 } },
      { $sort: { year: 1 } },
    ]);
    res.status(200).json({ stats: yearlyStats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get yearly stats', error: err.message });
  }
};

// Daily Stats
const getImageStatsByDay = async (req, res) => {
  try {
    const dailyStats = await Image.aggregate([
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            uploadedBy: '$uploadedBy',
          },
          count: { $sum: 1 },
        },
      },
      { $project: { date: '$_id.date', uploadedBy: '$_id.uploadedBy', count: 1, _id: 0 } },
      { $sort: { date: 1 } },
    ]);
    res.status(200).json({ stats: dailyStats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get daily stats', error: err.message });
  }
};

const getImagesByUploadedBy = async (req, res) => {
  try {
    const { uploadedBy } = req.params;
    const photos = await Image.find({ uploadedBy });
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Shortcuts
const getFirstEmailImage = async (req, res) => {
  try {
    const email = 'mhuzaifa8519@gmail.com';
    const images = await Image.find({
      uploadedBy: email,
      longitude: { $ne: null },
      latitude: { $ne: null },
    });
    res.status(200).json(images);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSecondEmailImage = async (req, res) => {
  try {
    const email = 'mhuzaifa86797@gmail.com';
    const images = await Image.find({
      uploadedBy: email,
      longitude: { $ne: null },
      latitude: { $ne: null },
    });
    res.status(200).json(images);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getThirdEmailImage = async (req, res) => {
  try {
    const email = 'muhammadjig8@gmail.com';
    const images = await Image.find({
      uploadedBy: email,
      longitude: { $ne: null },
      latitude: { $ne: null },
    });
    res.status(200).json(images);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  syncImages,
  getPhotos,
  getImageStatsByMonth,
  getImageStatsByYear,
  getImageStatsByDay,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,
};
