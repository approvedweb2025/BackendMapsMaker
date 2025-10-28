// api/cron/process-queue.js

const { processSyncQueue } = require('../../controllers/photo.controller');
const connectDB = require('../../config/db');

module.exports = async (req, res) => {
  try {
    // Har baar cron job chalne par database se connect karein
    await connectDB();
    // Controller se queue processor function ko call karein
    await processSyncQueue(req, res);
  } catch (error) {
    console.error('[CRON JOB HANDLER ERROR]', error);
    res.status(500).json({ error: 'Cron handler failed' });
  }
};