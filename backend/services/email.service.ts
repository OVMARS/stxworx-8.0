import nodemailer from "nodemailer";
import crypto from "crypto";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@stxworx.com";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "info@stxworx.com";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  }: undefined,
  requireTLS: true,
});

export const emailService = {
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  },

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verificationUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - STXWORX</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    .link { word-break: break-all; color: #f97316; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">STXWORX</div>
    </div>
    <div class="content">
      <h2>Verify Your Email Address</h2>
      <p>Thank you for using STXWORX. Please click the button below to verify your email address:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" class="button">Verify Email</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p class="link">${verificationUrl}</p>
      <p>This link will expire in 24 hours for security reasons.</p>
    </div>
    <div class="footer">
      <p>If you didn't request this email, you can safely ignore it.</p>
      <p>&copy; ${new Date().getFullYear()} STXWORX. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
Verify Your Email - STXWORX

Thank you for using STXWORX. Please verify your email address by visiting:
${verificationUrl}

This link will expire in 24 hours for security reasons.

If you didn't request this email, you can safely ignore it.

© ${new Date().getFullYear()} STXWORX. All rights reserved.
    `.trim();

    // Skip sending if SMTP is not configured (dev mode)
    if (!SMTP_HOST || !SMTP_USER) {
      console.log("[Email] SMTP not configured. Verification URL:", verificationUrl);
      return;
    }

    await transporter.sendMail({
      from: `"STXWORX" <${EMAIL_FROM}>`,
      to,
      subject: "Verify your email address",
      text,
      html,
    });
  },

  async sendContactEmail(fromName: string, fromEmail: string, message: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Form Submission - STXWORX</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
    .field { margin-bottom: 20px; }
    .label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { margin-top: 5px; font-size: 14px; }
    .message { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #f97316; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">STXWORX</div>
    </div>
    <div class="content">
      <h2>New Contact Form Submission</h2>
      <div class="field">
        <div class="label">From</div>
        <div class="value">${fromName} &lt;${fromEmail}&gt;</div>
      </div>
      <div class="field">
        <div class="label">Message</div>
        <div class="message">${message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      <p>This message was sent from the STXWORX contact form.</p>
      <p>&copy; ${new Date().getFullYear()} STXWORX. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
New Contact Form Submission - STXWORX

From: ${fromName} <${fromEmail}>

Message:
${message}

---
This message was sent from the STXWORX contact form.
© ${new Date().getFullYear()} STXWORX. All rights reserved.
    `.trim();

    // Skip sending if SMTP is not configured (dev mode)
    if (!SMTP_HOST || !SMTP_USER) {
      console.log("[Email] SMTP not configured. Contact form submission:");
      console.log(`  From: ${fromName} <${fromEmail}>`);
      console.log(`  Message: ${message}`);
      return;
    }

    await transporter.sendMail({
      from: `"STXWORX Contact" <${EMAIL_FROM}>`,
      to: CONTACT_EMAIL,
      replyTo: fromEmail,
      subject: `Contact Form: Message from ${fromName}`,
      text,
      html,
    });
  },
};
