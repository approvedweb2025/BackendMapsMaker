// config/db.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { initGridFS } = require('./gridfs');

try { require('dns').setDefaultResultOrder('ipv4first'); } catch (_) {}
dotenv.config();
mongoose.set('strictQuery', false);

// ✅ Cache connection for server restarts (PM2/EB reuse)
let cached = global._mongooseCached || { conn: null, promise: null };
global._mongooseCached = cached;

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('Error: MONGO_URI is not set.');
      process.exit(1);
    }

    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
      // bufferCommands false prevents queue buildup during cold start
      bufferCommands: false,
    }).then((m) => {
      console.log(`✅ MongoDB Connected: ${m.connection.host}`);
      m.connection.once('open', () => initGridFS());
      return m;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

mongoose.connection.on('error', (err) => console.error('MongoDB error:', err?.message || err));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));

module.exports = connectDB;
