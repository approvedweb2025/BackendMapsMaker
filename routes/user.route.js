// routes/user.route.js

const express = require('express');
const {
  registerUser,
  loginUser,
  logoutUser,
  getUsers,
  getUserByEmail,
  getrequest,
  allowUser,
  getapprovedrequest,
  getdeniedrequest,
  getAdmin,
  deleteUser,
  userAccess,
  getAdminWrapper,
  checkPermissions,
  me,
  addUser,
  updateUserDetails,
} = require('../controllers/user.controller');

// Import your security middlewares
// Make sure the path is correct
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// --- Public Routes (No login required) ---
// Anyone can register or try to log in.
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser); // Note: Logout might be better as a protected route, but this works too.

// --- Authenticated User Routes (Login required) ---
// Any logged-in user can access their own profile.
// The authMiddleware will check for a valid token/session.
router.get('/me', authMiddleware, me);

// --- Admin-Only Routes (Login and Admin privileges required) ---
// Wajahat: In routes ko 'authMiddleware' aur 'isAdmin' se protect kiya gaya hai.
// Ab sirf admin hi in routes ko access kar sakta hai.

// Fetching user lists and requests
router.get('/', authMiddleware, isAdmin, getUsers);
router.get('/requests/pending', authMiddleware, isAdmin, getrequest); // Renamed for clarity
router.get('/requests/approved', authMiddleware, isAdmin, getapprovedrequest); // Renamed for clarity
router.get('/requests/denied', authMiddleware, isAdmin, getdeniedrequest); // Renamed for clarity
router.get('/admins', authMiddleware, isAdmin, getAdmin); // Renamed to be more RESTful

// Managing users
router.post('/add-user', authMiddleware, isAdmin, addUser); // Renamed for clarity
router.put('/allow-status', authMiddleware, isAdmin, allowUser); // Changed to PUT as it updates a resource
router.put('/access/:username', authMiddleware, isAdmin, userAccess); // Changed to PUT
router.put('/:id', authMiddleware, isAdmin, updateUserDetails); // Use user's ID in the path
router.delete('/:id', authMiddleware, isAdmin, deleteUser); // Use user's ID in the path

// Getting specific user info (Admin only)
router.get('/by-email', authMiddleware, isAdmin, getUserByEmail); // Use query params instead of GET body
router.get('/permissions/:username', authMiddleware, isAdmin, checkPermissions); // Changed to GET
router.get('/admin-wrapper', authMiddleware, isAdmin, getAdminWrapper); // Changed to GET

module.exports = router;
