// routes/user.route.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  getUsers,
  getrequest,
  getapprovedrequest,
  getdeniedrequest,
  allowUser,
  deleteUser,
  userAccess,
  checkPermissions,
  me,
  addUser,
  updateUserDetails,
} = require('../controllers/user.controller');
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);

// Protected Routes (user must be logged in)
router.get('/me', authMiddleware, me);
router.put('/user/:id', authMiddleware, updateUserDetails);

// Admin Only Routes
router.get('/', authMiddleware, isAdmin, getUsers);
router.get('/getrequest', authMiddleware, isAdmin, getrequest);
router.get('/approved-request', authMiddleware, isAdmin, getapprovedrequest);
router.get('/denied-request', authMiddleware, isAdmin, getdeniedrequest);
router.post('/status', authMiddleware, isAdmin, allowUser);
router.delete('/delete/:id', authMiddleware, isAdmin, deleteUser);
router.post('/give-access/:username', authMiddleware, isAdmin, userAccess);
router.post('/permissions/:username', authMiddleware, isAdmin, checkPermissions);
router.post('/userbyadmin', authMiddleware, isAdmin, addUser);

module.exports = router;
