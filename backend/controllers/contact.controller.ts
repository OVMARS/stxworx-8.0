import { Request, Response } from "express";
import { emailService } from "../services/email.service";

export interface ContactFormInput {
  name: string;
  email: string;
  message: string;
}

export const contactController = {
  async submitContactForm(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, message } = req.body as ContactFormInput;

      // Validate input
      if (!name || !email || !message) {
        res.status(400).json({ error: "Name, email, and message are required" });
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: "Invalid email address" });
        return;
      }

      // Validate message length
      if (message.length < 10 || message.length > 5000) {
        res.status(400).json({ error: "Message must be between 10 and 5000 characters" });
        return;
      }

      // Send the contact email
      await emailService.sendContactEmail(name.trim(), email.trim(), message.trim());

      res.status(200).json({ success: true, message: "Message sent successfully" });
    } catch (error) {
      console.error("[Contact] Error submitting contact form:", error);
      res.status(500).json({ error: "Failed to send message. Please try again later." });
    }
  },
};
