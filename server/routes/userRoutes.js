import express from "express";
import { createConversation, intro } from "../controllers/userController.js";

const router = express.Router();

router.post("/createConversation", createConversation);
router.get("/intro", intro);

export default router;
