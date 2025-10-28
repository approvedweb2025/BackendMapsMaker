// controllers/photo.controller.js

const axios = require('axios');
const exifr = require('exifr');
const Image = require('../models/Image.model');
const SyncQueue = require('../models/SyncQueue.model'); // ✅ Naya model import karein

// ... downloadFileToBuffer aur getPlaceDetails functions waise hi rahenge ...
const downloadFileToBuffer = async (fileId, accessToken) => { /* ... no change ... */ };
const getPlaceDetails = async (lat, lng) => { /* ... no change ... */ };


// ✅ MODIFIED: syncImages ab sirf queue banayega
const syncImages = async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');
  const { accessToken, email } = req.user;

  try {
    let files = [];
    let nextPageToken = null;

    // Sirf file list fetch karein
    do {
      const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: "mimeType contains 'image/' and trashed=false",
          fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
          pageToken: nextPageToken
        }
      });
      files.push(...(driveResponse.data.files || []));
      nextPageToken = driveResponse.data.nextPageToken;
    } while (nextPageToken);

    console.log(`✅ Fetched ${files.length} file IDs to be queued.`);

    // Har file ko queue mein daalein
    for (const file of files) {
      // Check karein ki image pehle se process toh nahi ho chuki
      const imageExists = await Image.findOne({ fileId: file.id });
      if (imageExists) continue;

      // Queue mein daalne se pehle check karein ki wahan pehle se toh nahi hai
      await SyncQueue.updateOne(
        { fileId: file.id },
        {
          $set: {
            name: file.name,
            mimeType: file.mimeType,
            createdTime: file.createdTime,
            uploadedBy: email,
            accessToken: accessToken, // Har item ke saath token save karein
            status: 'pending'
          }
        },
        { upsert: true } // Agar nahi hai toh create karega, hai toh update karega
      );
    }

    // Foran user ko redirect kar dein
    res.redirect(`${process.env.FRONTEND_URL}?sync=started`);

  } catch (err) {
    console.error('❌ Error starting sync:', err);
    res.status(500).redirect(`${process.env.FRONTEND_URL}?sync=failed`);
  }
};


// ✅ NEW FUNCTION: Background mein queue ko process karega
const processSyncQueue = async (req, res) => {
  // Security: Yeh endpoint sirf Vercel Cron Job se call hona chahiye
  // Aap Vercel env mein ek SECRET set kar sakte hain
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('Unauthorized');
  }

  const BATCH_LIMIT = 5; // Ek baar mein kitni images process karni hain

  try {
    const itemsToProcess = await SyncQueue.find({ status: 'pending' }).limit(BATCH_LIMIT);

    if (itemsToProcess.length === 0) {
      return res.status(200).json({ message: 'Queue is empty. Nothing to process.' });
    }

    console.log(`Processing ${itemsToProcess.length} items from the queue...`);

    for (const item of itemsToProcess) {
      try {
        // Asal image processing logic yahan hai
        const imageBuffer = await downloadFileToBuffer(item.fileId, item.accessToken);

        let latitude = null, longitude = null;
        let timestamp = new Date(item.createdTime || Date.now());

        try {
            const exifData = await exifr.parse(imageBuffer);
            if (exifData) {
              latitude = exifData.latitude || null;
              longitude = exifData.longitude || null;
              if (exifData.DateTimeOriginal) timestamp = new Date(exifData.DateTimeOriginal);
            }
        } catch (exifErr) {
            console.warn(`⚠️ EXIF error for ${item.name}:`, exifErr.message);
        }

        let placeDetails = {};
        if (latitude && longitude) {
            placeDetails = await getPlaceDetails(latitude, longitude);
        }

        await Image.create({
          fileId: item.fileId,
          name: item.name,
          mimeType: item.mimeType,
          imageData: imageBuffer,
          latitude,
          longitude,
          timestamp,
          uploadedBy: item.uploadedBy,
          lastCheckedAt: new Date(),
          ...placeDetails
        });

        // Process hone ke baad queue se delete kar dein
        await SyncQueue.deleteOne({ _id: item._id });

      } catch (fileErr) {
        console.error(`❌ Error processing file ${item.name}:`, fileErr.message);
        // Agar fail ho toh status update kar dein taaki dobara try na ho
        await SyncQueue.updateOne({ _id: item._id }, { $set: { status: 'failed' } });
      }
    }

    res.status(200).json({ message: `Successfully processed ${itemsToProcess.length} items.` });

  } catch (err) {
    console.error('❌ Error in queue processor:', err);
    res.status(500).json({ error: 'Queue processing failed' });
  }
};


// Apne module.exports ko update karein
module.exports = {
  syncImages,
  processSyncQueue, // ✅ Naya function export karein
  getPhotos,
  getImageDataById,
  // ... baaki saare exports
};
