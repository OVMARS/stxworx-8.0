import { type Request, type Response } from "express";
import { z } from "zod";
import { messagesService } from "../services/messages.service";

const startConversationSchema = z.object({
  participantId: z.number().int().positive(),
  message: z.string().max(4000).optional(),
});

const chatAttachmentSchema = z.object({
  dataUrl: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(5 * 1024 * 1024),
});

const sendMessageSchema = z.object({
  body: z.string().max(4000).optional(),
  attachment: chatAttachmentSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.body?.trim() && !value.attachment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Message body or attachment is required",
      path: ["body"],
    });
  }
});

const updateMessageSchema = z.object({
  body: z.string().max(4000),
});

const pinMessageSchema = z.object({
  isPinned: z.boolean(),
});

export const messagesController = {
  async listConversations(req: Request, res: Response) {
    try {
      const conversations = await messagesService.listForUser(req.user!.id);
      return res.status(200).json(conversations);
    } catch (error) {
      console.error("List conversations error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async unreadCount(req: Request, res: Response) {
    try {
      const count = await messagesService.getUnreadCount(req.user!.id);
      return res.status(200).json({ count });
    } catch (error) {
      console.error("Unread message count error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async startConversation(req: Request, res: Response) {
    try {
      const result = startConversationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: result.error.errors[0]?.message || "Validation error",
          errors: result.error.errors,
        });
      }

      const conversation = await messagesService.startConversation(req.user!.id, result.data.participantId, result.data.message);
      return res.status(201).json(conversation);
    } catch (error) {
      console.error("Start conversation error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to start conversation" });
    }
  },

  async getMessages(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      const conversationMessages = await messagesService.getMessages(id, req.user!.id);
      return res.status(200).json(conversationMessages);
    } catch (error) {
      console.error("Get messages error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to load messages" });
    }
  },

  async sendMessage(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      const result = sendMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: result.error.errors[0]?.message || "Validation error",
          errors: result.error.errors,
        });
      }

      const message = await messagesService.sendMessage(id, req.user!.id, {
        body: result.data.body,
        attachment: result.data.attachment,
      });
      return res.status(201).json(message);
    } catch (error) {
      console.error("Send message error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to send message" });
    }
  },

  async updateMessage(req: Request, res: Response) {
    try {
      const conversationId = parseInt(req.params.id);
      const messageId = parseInt(req.params.messageId);
      if (isNaN(conversationId) || isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message request" });
      }

      const result = updateMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: result.error.errors[0]?.message || "Validation error",
          errors: result.error.errors,
        });
      }

      const message = await messagesService.updateMessage(conversationId, messageId, req.user!.id, result.data.body);
      return res.status(200).json(message);
    } catch (error) {
      console.error("Update message error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update message" });
    }
  },

  async deleteMessage(req: Request, res: Response) {
    try {
      const conversationId = parseInt(req.params.id);
      const messageId = parseInt(req.params.messageId);
      if (isNaN(conversationId) || isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message request" });
      }

      const message = await messagesService.deleteMessage(conversationId, messageId, req.user!.id);
      return res.status(200).json(message);
    } catch (error) {
      console.error("Delete message error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to delete message" });
    }
  },

  async pinMessage(req: Request, res: Response) {
    try {
      const conversationId = parseInt(req.params.id);
      const messageId = parseInt(req.params.messageId);
      if (isNaN(conversationId) || isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message request" });
      }

      const result = pinMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: result.error.errors[0]?.message || "Validation error",
          errors: result.error.errors,
        });
      }

      const message = await messagesService.setPinned(conversationId, messageId, req.user!.id, result.data.isPinned);
      return res.status(200).json(message);
    } catch (error) {
      console.error("Pin message error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to pin message" });
    }
  },
};
