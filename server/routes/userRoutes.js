// server/routes/userRoutes.js
import express from "express";
import {
  createProfile,
  createConversation,
  getProfile,
  renameConversation,
  deleteConversation,
  deleteAllChatHistory,
  intro,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/createProfile", createProfile);
router.post("/createConversation", createConversation);
router.get("/profile/:userId", getProfile);
router.patch("/renameConversation", renameConversation);
router.delete("/deleteConversation", deleteConversation);
router.delete("/deleteAllChatHistory", deleteAllChatHistory);
router.get("/intro", intro);

export default router;
