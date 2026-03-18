import { type Request, type Response } from "express";
import { z } from "zod";
import { connectionsService } from "../services/connections.service";
import { notificationService } from "../services/notification.service";

const requestSchema = z.object({
  userId: z.number().int().positive(),
});

export const connectionsController = {
  async list(req: Request, res: Response) {
    try {
      const connections = await connectionsService.listForUser(req.user!.id);
      return res.status(200).json(connections);
    } catch (error) {
      console.error("List connections error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async suggestions(req: Request, res: Response) {
    try {
      const suggestions = await connectionsService.getSuggestions(req.user!.id);
      return res.status(200).json(suggestions);
    } catch (error) {
      console.error("Connection suggestions error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async request(req: Request, res: Response) {
    try {
      const result = requestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const connection = await connectionsService.request(req.user!.id, result.data.userId);
      if (connection) {
        await notificationService.create({
          userId: result.data.userId,
          type: "proposal_received",
          title: "New Connection Request",
          message: `${req.user!.stxAddress} sent you a connection request.`,
        });
      }
      return res.status(201).json(connection);
    } catch (error) {
      console.error("Create connection request error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to send request" });
    }
  },

  async accept(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }

      const updated = await connectionsService.respond(id, req.user!.id, "accepted");
      if (!updated) {
        return res.status(404).json({ message: "Connection request not found" });
      }
      return res.status(200).json(updated);
    } catch (error) {
      console.error("Accept connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to accept request" });
    }
  },

  async decline(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }

      const updated = await connectionsService.respond(id, req.user!.id, "declined");
      if (!updated) {
        return res.status(404).json({ message: "Connection request not found" });
      }
      return res.status(200).json(updated);
    } catch (error) {
      console.error("Decline connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to decline request" });
    }
  },
};
