const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// If you're using app.use('/', userRoutes), these become /createProfile, etc.
router.post('/createProfile', userController.createProfile);
router.post('/createConversation', userController.createConversation);
router.get('/profile/:userId', userController.getProfile);
router.patch('/renameConversation', userController.renameConversation);
router.delete('/deleteConversation', userController.deleteConversation);
router.delete('/deleteAllUserData', userController.deleteAllUserData);

module.exports = router;
