import express from "express";
import { captureLead } from "../controllers/leadController.js";

const router = express.Router();

router.post("/", captureLead);

export default router;
