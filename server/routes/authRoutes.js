// server/routes/authRoutes.js
import express from "express";
import { signup, login, verifyEmail } from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
// Removed the /verify/:token route since email verification is no longer used

export default router;
