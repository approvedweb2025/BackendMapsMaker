// config/db.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { initGridFS } = require('./gridfs'); // 🆕 import gridfs.js

// Prefer IPv4 for DNS (prevents some SRV resolution issues)
try {
  require('dns').setDefaultResultOrder('ipv4first');
} catch (_) {
  // ignore if not supported on your Node version
}

dotenv.config();

mongoose.set('strictQuery', false); // optional, quiets deprecation warnings

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const fallbackUri = process.env.MONGO_URI_SEEDLIST; // optional seedlist

  if (!uri) {
    console.error('Error: MONGO_URI is not set in your environment.');
    if (process.env.VERCEL === '1') {
      console.error('Running in Vercel - skipping DB connection');
      return;
    }
    process.exit(1);
  }

  const isSrv = uri.startsWith('mongodb+srv://');

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // 🆕 Initialize GridFS after DB connection is open
    mongoose.connection.once('open', () => {
      initGridFS();
    });

  } catch (error) {
    console.error('❌ MongoDB connect error:');
    console.error(error?.message || error);

    // If SRV fails due to DNS TXT/SRV refusal
    const msg = String(error?.message || '');
    const looksLikeDnsRefused =
      msg.includes('querySrv') || msg.includes('queryTxt') || msg.includes('ENOTFOUND') || msg.includes('EREFUSED');

    if (isSrv && looksLikeDnsRefused) {
      console.error('\nIt looks like your DNS resolver is refusing SRV/TXT lookups required by mongodb+srv.\n' +
        'Fix options:\n' +
        '  1) Switch your DNS to 1.1.1.1 and/or 8.8.8.8 and flush DNS.\n' +
        '  2) Or bypass SRV entirely by using a standard mongodb:// seedlist.\n');

      if (fallbackUri) {
        console.error('Attempting fallback to MONGO_URI_SEEDLIST...\n');
        try {
          const conn2 = await mongoose.connect(fallbackUri, {
            serverSelectionTimeoutMS: 10000,
            retryWrites: true,
          });
          console.log(`✅ MongoDB Connected via seedlist: ${conn2.connection.host}`);

          // 🆕 Init GridFS for seedlist case
          mongoose.connection.once('open', () => {
            initGridFS();
          });

          return;
        } catch (e2) {
          console.error('❌ Fallback (seedlist) also failed:', e2?.message || e2);
        }
      } else {
        console.error(
          'No fallback seedlist provided. In Atlas, go to "Connect → Drivers → Standard connection string".\n'
        );
      }
    }

    process.exit(1); // Exit on failure (PM2/nodemon will restart)
  }

  // Helpful connection lifecycle logs (optional)
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err?.message || err);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
  });
};

module.exports = connectDB;
