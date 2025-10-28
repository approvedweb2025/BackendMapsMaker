// controllers/user.controller.js
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// NOTE: Make sure you have this errorHandler utility file in your project
// It should contain the AppError class and the catchAsync function I provided earlier.
const { catchAsync, AppError } = require('../utils/errorHandler');

// =================================================================
// AUTHENTICATION CONTROLLERS
// =================================================================

/**
 * @desc    Register a new user
 * @route   POST /api/users/register
 * @access  Public
 */
const registerUser = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return next(new AppError('Please provide name, email, and password.', 400));
  }

  if (await User.findOne({ email })) {
    return next(new AppError('A user with this email already exists.', 400));
  }
  if (await User.findOne({ name })) {
    return next(new AppError('This username is already taken.', 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const isFirstUser = (await User.countDocuments()) === 0;

  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
    role: isFirstUser ? 'admin' : 'user',
    statusaccess: isFirstUser ? 'approved' : 'pending',
    permissions: isFirstUser ? ['*'] : ['Dashboard', 'MyInfo'], // '*' for admin means all permissions
  });

  const { password: _, ...userToReturn } = newUser.toObject();

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully. Waiting for admin approval.',
    data: { user: userToReturn }
  });
});

/**
 * @desc    Login a user
 * @route   POST /api/users/login
 * @access  Public
 */
const loginUser = catchAsync(async (req, res, next) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return next(new AppError('Please provide username and password.', 400));
  }

  const user = await User.findOne({ name }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AppError('Incorrect username or password.', 401)); // 401 for Unauthorized
  }

  if (user.role === 'user') {
    if (user.statusaccess === 'denied') {
      return next(new AppError('Your account access has been denied by the admin.', 403));
    }
    if (user.statusaccess === 'pending') {
      return next(new AppError('Your account is pending approval from the admin.', 403));
    }
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    sameSite: 'None',
    secure: true
  };

  res.cookie('token', token, cookieOptions);

  const { password: _, ...userData } = user.toObject();

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    token,
    data: { user: userData }
  });
});

/**
 * @desc    Logout a user
 * @route   POST /api/users/logout
 * @access  Public
 */
const logoutUser = (req, res) => {
  res.cookie('token', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    sameSite: 'None',
    secure: true
  });
  res.status(200).json({ status: 'success', message: 'Logout successful.' });
};

/**
 * @desc    Get current logged-in user's details
 * @route   GET /api/users/me
 * @access  Private
 */
const me = (req, res) => {
  res.status(200).json({ status: 'success', data: { user: req.user } });
};

// =================================================================
// USER MANAGEMENT CONTROLLERS
// =================================================================

/**
 * @desc    Update user details (username, password)
 * @route   PUT /api/users/user/:id
 * @access  Private
 */
const updateUserDetails = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  const { id } = req.params;

  if (!username) {
    return next(new AppError('Username is required.', 400));
  }

  const existingUser = await User.findOne({ name: username });
  if (existingUser && existingUser._id.toString() !== id) {
    return next(new AppError('Username already exists.', 409)); // 409 Conflict
  }

  const updateData = { name: username };
  if (password && password.trim() !== '') {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
  if (!updatedUser) {
    return next(new AppError('User not found.', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'User updated successfully.',
    data: { user: updatedUser }
  });
});

// =================================================================
// ADMIN-ONLY CONTROLLERS
// =================================================================

/**
 * @desc    Get all non-admin users
 * @route   GET /api/users
 * @access  Admin
 */
const getUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({ role: { $ne: 'admin' } }).select('-password');
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});

/**
 * @desc    Get users by status (pending, denied, approved)
 * @route   GET /api/users/requests/:status
 * @access  Admin
 */
const getUsersByStatus = catchAsync(async (req, res, next) => {
    const { status } = req.params;
    const validStatuses = ['pending', 'denied', 'approved'];

    if (!validStatuses.includes(status)) {
        return next(new AppError('Invalid status provided.', 400));
    }
    
    const users = await User.find({ statusaccess: status, role: { $ne: 'admin' } }).select('-password');
    
    res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users }
    });
});

// Note: getrequest, getdeniedrequest, and getapprovedrequest can be replaced by the single getUsersByStatus function.
// This reduces code duplication. I am leaving them commented below for reference.
/*
const getrequest = getUsersByStatus; // Simply reuse the main function
const getdeniedrequest = getUsersByStatus;
const getapprovedrequest = getUsersByStatus;
*/

/**
 * @desc    Approve or deny a user's access
 * @route   POST /api/users/status
 * @access  Admin
 */
const allowUser = catchAsync(async (req, res, next) => {
  const { Id, status } = req.body;
  if (!Id || !status || !['approved', 'denied'].includes(status)) {
    return next(new AppError('User ID and a valid status (approved/denied) are required.', 400));
  }

  const user = await User.findByIdAndUpdate(Id, { statusaccess: status }, { new: true });
  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `User status successfully updated to ${status}.`
  });
});

/**
 * @desc    Add a new user by an admin
 * @route   POST /api/users/userbyadmin
 * @access  Admin
 */
const addUser = catchAsync(async (req, res, next) => {
  const { name, email, password, statusaccess } = req.body;

  if (!name || !email || !password || !statusaccess) {
    return next(new AppError('All fields are required.', 400));
  }
  
  if (await User.findOne({ $or: [{ email }, { name }] })) {
    return next(new AppError('A user with this email or username already exists.', 409));
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({
    name, email, password: hashedPassword, statusaccess,
    permissions: ['Dashboard', 'MyInfo']
  });

  res.status(201).json({
    status: 'success',
    message: 'User created successfully by admin.'
  });
});

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/delete/:id
 * @access  Admin
 */
const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const deletedUser = await User.findByIdAndDelete(id);

  if (!deletedUser) {
    return next(new AppError('User not found.', 404));
  }

  res.status(204).json({ // 204 No Content is standard for successful deletions
    status: 'success',
    data: null
  });
});

/**
 * @desc    Update a user's page permissions
 * @route   POST /api/users/give-access/:username
 * @access  Admin
 */
const userAccess = catchAsync(async (req, res, next) => {
  const { username } = req.params;
  const { pages } = req.body;

  if (!Array.isArray(pages)) {
    return next(new AppError('Permissions must be provided as an array.', 400));
  }

  const updatedUser = await User.findOneAndUpdate(
    { name: username },
    { $set: { permissions: pages } },
    { new: true }
  ).select('-password');

  if (!updatedUser) {
    return next(new AppError('User not found.', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Permissions updated successfully.',
    data: { user: updatedUser }
  });
});

/**
 * @desc    Check a user's permissions
 * @route   GET /api/users/permissions/:username
 * @access  Admin
 */
const checkPermissions = catchAsync(async (req, res, next) => {
  const { username } = req.params;
  const user = await User.findOne({ name: username });

  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  const filteredPermissions = (user.permissions || []).filter(
    (perm) => perm !== 'Dashboard' && perm !== 'MyInfo'
  );

  res.status(200).json({
    status: 'success',
    message: 'Permissions fetched successfully.',
    data: { permissions: filteredPermissions }
  });
});

// =================================================================
// EXPORTS
// =================================================================
module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  me,
  updateUserDetails,
  getUsers,
  // getrequest, // Replaced by getUsersByStatus
  // getdeniedrequest, // Replaced by getUsersByStatus
  // getapprovedrequest, // Replaced by getUsersByStatus
  getUsersByStatus, // Use this one in your routes
  allowUser,
  addUser,
  deleteUser,
  userAccess,
  checkPermissions,
};
