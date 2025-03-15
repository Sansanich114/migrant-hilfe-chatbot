const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Existing routes
router.post('/createProfile', userController.createProfile);
router.post('/createConversation', userController.createConversation);
router.get('/profile/:userId', userController.getProfile);
router.patch('/renameConversation', userController.renameConversation);
router.delete('/deleteConversation', userController.deleteConversation);
router.delete('/deleteAllUserData', userController.deleteAllUserData);

// NEW: Intro Route
// Calls userController.intro to get an AI-generated greeting
router.get('/intro', userController.intro);

module.exports = router;
