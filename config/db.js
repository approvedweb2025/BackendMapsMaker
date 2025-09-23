// config/db.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { initGridFS } = require('./gridfs');

try {
  require('dns').setDefaultResultOrder('ipv4first');
} catch (_) {}

dotenv.config();
mongoose.set('strictQuery', false);

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const fallbackUri = process.env.MONGO_URI_SEEDLIST;

  if (!uri) {
    console.error('Error: MONGO_URI is not set in your environment.');
    process.exit(1);
  }

  const isSrv = uri.startsWith('mongodb+srv://');

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.once('open', () => {
      initGridFS();
    });
  } catch (error) {
    console.error('❌ MongoDB connect error:', error?.message || error);
    const msg = String(error?.message || '');
    const looksLikeDnsRefused =
      msg.includes('querySrv') ||
      msg.includes('queryTxt') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('EREFUSED');

    if (isSrv && looksLikeDnsRefused) {
      console.error(
        '\nSRV/TXT lookup issue detected.\n' +
          'Fix:\n' +
          '  1) DNS change (1.1.1.1 / 8.8.8.8) and flush DNS\n' +
          '  2) Or use mongodb:// seedlist connection string\n'
      );

      if (fallbackUri) {
        console.error('Attempting fallback to MONGO_URI_SEEDLIST...\n');
        try {
          const conn2 = await mongoose.connect(fallbackUri, {
            serverSelectionTimeoutMS: 10000,
            retryWrites: true,
          });
          console.log(`✅ MongoDB Connected via seedlist: ${conn2.connection.host}`);
          mongoose.connection.once('open', () => initGridFS());
          return;
        } catch (e2) {
          console.error('❌ Fallback (seedlist) also failed:', e2?.message || e2);
        }
      } else {
        console.error('No fallback seedlist provided.');
      }
    }
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err?.message || err));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));
};

module.exports = connectDB;
