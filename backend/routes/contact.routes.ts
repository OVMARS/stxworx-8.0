import { Router } from "express";
import { contactController } from "../controllers/contact.controller";

const router = Router();

// POST /api/contact - Submit contact form
router.post("/", contactController.submitContactForm);

export default router;
