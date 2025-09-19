// // controllers/photoController.js
// const axios = require('axios');
// const path = require('path');
// const os = require('os');
// const fs = require('fs');
// const exifr = require('exifr');
// const Image = require('../models/Image.model');
// const { getFreshThumbnail } = require('../utils/googleDrive');

// // const getImageStatsByMonth = async (req, res) => {
// //     try {
// //         const monthlyStats = await Image.aggregate([
// //             {
// //                 $group: {
// //                     _id: {
// //                         $dateToString: { format: "%Y-%m", date: "$createdAt" }
// //                     },
// //                     count: { $sum: 1 }
// //                 }
// //             },
// //             { $sort: { _id: 1 } }
// //         ]);

// //         res.status(200).json({ stats: monthlyStats });
// //     } catch (err) {
// //         console.error('❌ Error getting monthly stats:', err.message);
// //         res.status(500).json({ message: 'Failed to get image stats', error: err.message });
// //     }
// // };

// // Using in Reload Method
// const getPhotos = async (req, res) => {
//     try {
//         const photos = await Image.find().sort({ createdAt: -1 });
//         res.status(200).json({ photos });

//     } catch (err) {
//         console.error('❌ Error fetching photos:', err);
//         res.status(500).json({ error: 'Something went wrong' });
//     }
// };

// const syncImages = async (req, res) => {
//     if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');

//     const accessToken = req.user.accessToken;

//     try {
//         const driveResponse = await axios.get(
//             'https://www.googleapis.com/drive/v3/files',
//             {
//                 headers: {
//                     Authorization: `Bearer ${accessToken}`,
//                 },
//                 params: {
//                     q: "mimeType='image/jpeg' and trashed = false",
//                     // fields: 'files(id, name, mimeType, thumbnailLink)',
//                     fields: 'files(id, name, mimeType, thumbnailLink, createdTime)',
//                     pageSize: 1000
//                 }
//             }
//         );

//         const files = driveResponse.data.files || [];

//         for (const file of files) {
//             const exists = await Image.findOne({ fileId: file.id });
//             if (exists) continue;

//             const tempPath = path.join(os.tmpdir(), `${file.id}.jpg`);
//             const writer = fs.createWriteStream(tempPath);

//             const fileStream = await axios.get(
//                 `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
//                 {
//                     headers: { Authorization: `Bearer ${accessToken}` },
//                     responseType: 'stream'
//                 }
//             );

//             await new Promise((resolve, reject) => {
//                 fileStream.data.pipe(writer);
//                 writer.on('finish', resolve);
//                 writer.on('error', reject);
//             });

//             // ✅ Extract GPS
//             let latitude = null;
//             let longitude = null;

//             // 🕒 Use createdTime from Google Drive
// let timestamp = file.createdTime ? new Date(file.createdTime) : new Date();

// try {
//   if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
//     const exifData = await exifr.parse(tempPath);
//     if (exifData?.latitude && exifData?.longitude) {
//       latitude = exifData.latitude;
//       longitude = exifData.longitude;
//     }

//     if (exifData?.DateTimeOriginal) {
//       timestamp = new Date(exifData.DateTimeOriginal); // override if available
//     }
//   }
// } catch (err) {
//   console.error(`❌ EXIF error for ${file.name}:`, err.message);
// }

// // ✅ Save image with timestamp
// const savedImage = await Image.create({
//   fileId: file.id,
//   name: file.name,
//   mimeType: file.mimeType,
//   latitude,
//   longitude,
//   timestamp, // 🟢 save timestamp here
//   uploadedBy: req.user.email,
//   lastCheckedAt: new Date(),
// });

// const monthlyStats = await Image.aggregate([
//   {
//     $group: {
//       _id: {
//         $dateToString: { format: "%Y-%m", date: "$timestamp" }
//       },
//       count: { $sum: 1 }
//     }
//   },
//   { $sort: { _id: 1 } }
// ]);


//             // try {
//             //     if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
//             //         const exifData = await exifr.gps(tempPath);
//             //         if (exifData?.latitude && exifData?.longitude) {
//             //             latitude = exifData.latitude;
//             //             longitude = exifData.longitude;
//             //         }
//             //     } else {
//             //         console.warn(`⚠️ Skipped EXIF for unsupported format: ${file.name}`);
//             //     }
//             // } catch (err) {
//             //     console.error(`❌ EXIF error for ${file.name}:`, err.message);
//             // }

//             // // ✅ Save image in DB WITHOUT ImageURL
//             // const savedImage = await Image.create({
//             //     fileId: file.id,
//             //     name: file.name,
//             //     mimeType: file.mimeType,
//             //     latitude,
//             //     longitude,
//             //     uploadedBy: req.user.email,
//             //     lastCheckedAt: new Date(),
//             // });

//             // ✅ Save image permanently in /public/uploads/<fileId>.jpg
//             const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
//             if (!fs.existsSync(uploadsDir)) {
//                 fs.mkdirSync(uploadsDir, { recursive: true });
//             }

//             const permanentPath = path.join(uploadsDir, `${file.id}.jpg`);
//             fs.copyFileSync(tempPath, permanentPath);

//             // ✅ Cleanup temp file
//             fs.rm(tempPath, { force: true }, (err) => {
//                 if (err) console.error(`❌ Failed to delete temp file: ${tempPath}`, err.message);
//             });
//         }

//         res.redirect(`${process.env.FRONTEND_URL}/home`);
//     } catch (err) {
//         console.error('❌ Sync error:', err.message);
//         res.status(500).send('Failed to sync images');
//     }
// };

//   const getImageStatsByMonth = async (req, res) => {
//   try {
//     const monthlyStats = await Image.aggregate([
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m", date: "$timestamp" }  // 👈 use timestamp
//           },
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ]);

//     res.status(200).json({ stats: monthlyStats });
//   } catch (err) {
//     console.error('❌ Error getting monthly stats:', err.message);
//     res.status(500).json({ message: 'Failed to get image stats', error: err.message });
//   }
// };


// const getImagesByUploadedBy =  async (req, res) => {
//   try {
//     const { uploadedBy } = req.params;


//     const photos = await Image.find({
//       uploadedBy
//     });

//     res.status(200).json({ photos });
//   } catch (err) {
//     console.error('❌ Server error:', err); // more verbose logging
//     res.status(500).json({ error: 'Internal server error' });
//   }
// }


// const getFirstEmailImage = async (req, res) => {
//   try {
//     const email = 'peenaykapani@gmail.com';
//     const images = await Image.find({
//       uploadedBy: email,
//       longitude: { $ne: null },
//       latitude: { $ne: null }
//     });

//     res.status(200).json(images);
//   } catch (err) {
//     console.error('❌ Server error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

// const getSecondEmailImage = async (req, res) => {
//   try {
//     const email = 'homesinsindh@gmail.com'; // <-- Replace with actual second email
//     const images = await Image.find({
//       uploadedBy: email,
//       longitude: { $ne: null },
//       latitude: { $ne: null }
//     });

//     res.status(200).json(images);
//   } catch (err) {
//     console.error('❌ Server error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

// const getThirdEmailImage = async (req, res) => {
//   try {
//     const email = 'muhammadjig8@gmail.com'; // <-- Replace with actual third email
//     const images = await Image.find({
//       uploadedBy: email,
//       longitude: { $ne: null },
//       latitude: { $ne: null }
//     });

//     res.status(200).json(images);
//   } catch (err) {
//     console.error('❌ Server error:', err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };














// module.exports = { getImageStatsByMonth, getPhotos, syncImages, getImagesByUploadedBy, getFirstEmailImage, getSecondEmailImage, getThirdEmailImage };


// controllers/photoController.js
// const axios = require('axios');
// const path = require('path');
// const os = require('os');
// const fs = require('fs');
// const exifr = require('exifr');
// const Image = require('../models/Image.model');

// // Helper: download file from Drive
// const downloadFile = async (fileId, accessToken, destPath) => {
//     const response = await axios.get(
//         `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
//         {
//             headers: { Authorization: `Bearer ${accessToken}` },
//             responseType: 'stream'
//         }
//     );

//     const writer = fs.createWriteStream(destPath);
//     await new Promise((resolve, reject) => {
//         response.data.pipe(writer);
//         writer.on('finish', resolve);
//         writer.on('error', reject);
//     });
// };

// const syncImages = async (req, res) => {
//     if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');
//     const accessToken = req.user.accessToken;

//     try {
//         let files = [];
//         let nextPageToken = null;

//         // Fetch all files in Google Drive with pagination
//         do {
//             const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
//                 headers: { Authorization: `Bearer ${accessToken}` },
//                 params: {
//                     q: "mimeType='image/jpeg' and trashed=false",
//                     fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, createdTime)',
//                     pageToken: nextPageToken
//                 }
//             });

//             files.push(...(driveResponse.data.files || []));
//             nextPageToken = driveResponse.data.nextPageToken;
//         } while (nextPageToken);

//         console.log(`✅ Total files fetched: ${files.length}`);

//         for (const file of files) {
//             const exists = await Image.findOne({ fileId: file.id });
//             if (exists) continue;

//             const tempPath = path.join(os.tmpdir(), `${file.id}.jpg`);
//             await downloadFile(file.id, accessToken, tempPath);

//             // Extract EXIF GPS and timestamp
//             let latitude = null;
//             let longitude = null;
//             let timestamp = file.createdTime ? new Date(file.createdTime) : new Date();

//             try {
//                 if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
//                     const exifData = await exifr.parse(tempPath);
//                     if (exifData?.latitude && exifData?.longitude) {
//                         latitude = exifData.latitude;
//                         longitude = exifData.longitude;
//                     }
//                     if (exifData?.DateTimeOriginal) {
//                         timestamp = new Date(exifData.DateTimeOriginal);
//                     }
//                 }
//             } catch (err) {
//                 console.error(`❌ EXIF error for ${file.name}:`, err.message);
//             }

//             // Save to database
//             await Image.create({
//                 fileId: file.id,
//                 name: file.name,
//                 mimeType: file.mimeType,
//                 latitude,
//                 longitude,
//                 timestamp,
//                 uploadedBy: req.user.email,
//                 lastCheckedAt: new Date(),
//             });

//             // Save permanently in /public/uploads
//             const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
//             if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
//             const permanentPath = path.join(uploadsDir, `${file.id}.jpg`);
//             fs.copyFileSync(tempPath, permanentPath);
//             fs.rm(tempPath, { force: true }, (err) => {
//                 if (err) console.error(`❌ Failed to delete temp file: ${tempPath}`, err.message);
//             });
//         }

//         res.redirect(`${process.env.FRONTEND_URL}/home`);
//     } catch (err) {
//         console.error('❌ Sync error:', err.message);
//         res.status(500).send('Failed to sync images');
//     }
// };

// // Get all photos
// const getPhotos = async (req, res) => {
//     try {
//         const photos = await Image.find().sort({ createdAt: -1 });
//         res.status(200).json({ photos });
//     } catch (err) {
//         console.error('❌ Error fetching photos:', err);
//         res.status(500).json({ error: 'Something went wrong' });
//     }
// };

// // Get monthly image stats
// const getImageStatsByMonth = async (req, res) => {
//     try {
//         const monthlyStats = await Image.aggregate([
//             {
//                 $group: {
//                     _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
//                     count: { $sum: 1 }
//                 }
//             },
//             { $sort: { _id: 1 } }
//         ]);
//         res.status(200).json({ stats: monthlyStats });
//     } catch (err) {
//         console.error('❌ Error getting monthly stats:', err.message);
//         res.status(500).json({ message: 'Failed to get image stats', error: err.message });
//     }
// };

// // Get images uploaded by a specific user
// const getImagesByUploadedBy = async (req, res) => {
//     try {
//         const { uploadedBy } = req.params;
//         const photos = await Image.find({ uploadedBy });
//         res.status(200).json({ photos });
//     } catch (err) {
//         console.error('❌ Server error:', err);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// // Get images for specific emails
// const getFirstEmailImage = async (req, res) => {
//     try {
//         const email = 'peenaykapani@gmail.com';
//         const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
//         res.status(200).json(images);
//     } catch (err) {
//         console.error('❌ Server error:', err);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// const getSecondEmailImage = async (req, res) => {
//     try {
//         const email = 'homesinsindh@gmail.com';
//         const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
//         res.status(200).json(images);
//     } catch (err) {
//         console.error('❌ Server error:', err);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// const getThirdEmailImage = async (req, res) => {
//     try {
//         const email = 'muhammadjig8@gmail.com';
//         const images = await Image.find({ uploadedBy: email, longitude: { $ne: null }, latitude: { $ne: null } });
//         res.status(200).json(images);
//     } catch (err) {
//         console.error('❌ Server error:', err);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// };

// module.exports = {
//     syncImages,
//     getPhotos,
//     getImageStatsByMonth,
//     getImagesByUploadedBy,
//     getFirstEmailImage,
//     getSecondEmailImage,
//     getThirdEmailImage
// };


const axios = require('axios');
const path = require('path');
const os = require('os');
const fs = require('fs');
const exifr = require('exifr');
const Image = require('../models/Image.model');

// Helper: download file from Drive
const downloadFile = async (fileId, accessToken, destPath) => {
    const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'stream'
        }
    );

    const writer = fs.createWriteStream(destPath);
    await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

const syncImages = async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Not authenticated');
    const accessToken = req.user.accessToken;

    try {
        let files = [];
        let nextPageToken = null;

        // Fetch all files in Google Drive with pagination
        do {
            const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                    q: "mimeType contains 'image/' and trashed=false",
                    fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, createdTime)',
                    pageToken: nextPageToken
                }
            });

            files.push(...(driveResponse.data.files || []));
            nextPageToken = driveResponse.data.nextPageToken;
        } while (nextPageToken);

        // console.log(`✅ Total files fetched: ${files.length}`);

        for (const file of files) {
            try {
                const exists = await Image.findOne({ fileId: file.id });
                if (exists) continue;

                const tempPath = path.join(os.tmpdir(), `${file.id}.jpg`);
                await downloadFile(file.id, accessToken, tempPath);

                // Extract EXIF GPS and timestamp
                let latitude = null;
                let longitude = null;
                let timestamp = new Date(file.createdTime || Date.now());

                try {
                    if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
                        const exifData = await exifr.parse(tempPath);
                        if (exifData) {
                            if (exifData.latitude && exifData.longitude) {
                                latitude = exifData.latitude;
                                longitude = exifData.longitude;
                            }
                            if (exifData.DateTimeOriginal) {
                                timestamp = new Date(exifData.DateTimeOriginal);
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ EXIF error for ${file.name}:`, err.message);
                }

                // Save to database
                await Image.create({
                    fileId: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    latitude,
                    longitude,
                    timestamp,
                    uploadedBy: req.user.email,
                    lastCheckedAt: new Date(),
                });

                // Save permanently in /public/uploads
                const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                const permanentPath = path.join(uploadsDir, `${file.id}.jpg`);
                fs.copyFileSync(tempPath, permanentPath);

                fs.rm(tempPath, { force: true }, (err) => {
                    if (err) console.error(`❌ Failed to delete temp file: ${tempPath}`, err.message);
                });
            } catch (fileErr) {
                console.error(`❌ Error processing file ${file.name}:`, fileErr);
            }
        }

        res.redirect(`${process.env.FRONTEND_URL}/home`);
    } catch (err) {
        console.error('❌ Sync error:', err); // log full error
        res.status(500).send('Failed to sync images');
    }
};

// Get all photos
const getPhotos = async (req, res) => {
    try {
        const photos = await Image.find().sort({ createdAt: -1 });
        res.status(200).json({ photos });
    } catch (err) {
        console.error('❌ Error fetching photos:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

// Get monthly image stats
const getImageStatsByMonth = async (req, res) => {
    try {
        const monthlyStats = await Image.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        res.status(200).json({ stats: monthlyStats });
    } catch (err) {
        console.error('❌ Error getting monthly stats:', err);
        res.status(500).json({ message: 'Failed to get image stats', error: err.message });
    }
};

// Get images uploaded by a specific user
const getImagesByUploadedBy = async (req, res) => {
    try {
        const { uploadedBy } = req.params;
        const photos = await Image.find({ uploadedBy });
        res.status(200).json({ photos });
    } catch (err) {
        console.error('❌ Server error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get images for specific emails
const getFirstEmailImage = async (req, res) => {
    try {
        const email = 'peenaykapani@gmail.com';
        const images = await Image.find({
            uploadedBy: email,
            longitude: { $ne: null },
            latitude: { $ne: null }
        });
        res.status(200).json(images);
    } catch (err) {
        console.error('❌ Server error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getSecondEmailImage = async (req, res) => {
    try {
        const email = 'homesinsindh@gmail.com';
        const images = await Image.find({
            uploadedBy: email,
            longitude: { $ne: null },
            latitude: { $ne: null }
        });
        res.status(200).json(images);
    } catch (err) {
        console.error('❌ Server error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getThirdEmailImage = async (req, res) => {
    try {
        const email = 'muhammadjig8@gmail.com';
        const images = await Image.find({
            uploadedBy: email,
            longitude: { $ne: null },
            latitude: { $ne: null }
        });
        res.status(200).json(images);
    } catch (err) {
        console.error('❌ Server error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    syncImages,
    getPhotos,
    getImageStatsByMonth,
    getImagesByUploadedBy,
    getFirstEmailImage,
    getSecondEmailImage,
    getThirdEmailImage
};