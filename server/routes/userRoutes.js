const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/createProfile', userController.createProfile);
router.post('/createConversation', userController.createConversation);
router.get('/profile/:userId', userController.getProfile);
router.patch('/renameConversation', userController.renameConversation);
router.delete('/deleteConversation', userController.deleteConversation);
router.delete('/deleteAllChatHistory', userController.deleteAllChatHistory); // renamed endpoint
router.get('/intro', userController.intro);

module.exports = router;
