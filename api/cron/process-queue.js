// File Path: api/cron/process-queue.js

// Path: ../../controllers/photo.controller
// ../ -> 'cron' folder se bahar nikle -> 'api' folder mein aa gaye
// ../ -> 'api' folder se bahar nikle -> root folder mein aa gaye
// Ab 'controllers' folder mein jaakar file import karo
const { processSyncQueue } = require('../../controllers/photo.controller');

// Path: ../../config/db
// Waisa hi logic hai
const connectDB = require('../../config/db');

// Vercel is function ko call karega
module.exports = async (req, res) => {
  try {
    // Har baar cron job chalne par database se connect karein
    await connectDB();
    // Controller se queue processor function ko call karein
    await processSyncQueue(req, res);
  } catch (error) {
    // Yeh error Vercel logs mein dikhega agar koi ghalti hui
    console.error('[CRON JOB HANDLER FAILED]', error);
    res.status(500).json({ error: 'Cron job handler failed.' });
  }
};
