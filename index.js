const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/user.route.js');
const photoRoutes = require('./routes/photo.route.js');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Your routes
app.use('/api/users', userRoutes);
app.use('/api/photos', photoRoutes);

// ❌ DO NOT use app.listen()
// ✅ Instead export handler
module.exports = app;
module.exports.handler = serverless(app);
