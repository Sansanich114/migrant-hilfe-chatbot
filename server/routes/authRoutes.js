const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
// Removed the /verify/:token route since email verification is no longer used

module.exports = router;
