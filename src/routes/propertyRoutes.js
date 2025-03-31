import express from "express";
import { getProperties } from "../controllers/propertyController.js";

const router = express.Router();

// GET /properties?location=Mitte&budget=500000&type=wohnung
router.get("/", getProperties);

export default router;
