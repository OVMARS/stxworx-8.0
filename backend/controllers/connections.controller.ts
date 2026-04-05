import { type Request, type Response } from "express";
import { z } from "zod";
import { connectionsService } from "../services/connections.service";
import { notificationService } from "../services/notification.service";

const requestSchema = z.object({
  userId: z.number().int().positive(),
});

const blockSchema = z.object({
  userId: z.number().int().positive(),
  reason: z.string().trim().max(1000).optional(),
});

function parseNumericParam(value: string) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

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

  async relationship(req: Request, res: Response) {
    try {
      const otherUserId = parseNumericParam(req.params.userId);
      if (!otherUserId) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const relationship = await connectionsService.getRelationship(req.user!.id, otherUserId);
      return res.status(200).json(relationship);
    } catch (error) {
      console.error("Relationship lookup error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to load relationship" });
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
          type: "connection_request_received",
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
      const id = parseNumericParam(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }

      const updated = await connectionsService.accept(id, req.user!.id);
      if (!updated) {
        return res.status(404).json({ message: "Connection request not found" });
      }

      if (updated.otherUser?.id) {
        await notificationService.create({
          userId: updated.otherUser.id,
          type: "connection_request_accepted",
          title: "Connection Request Accepted",
          message: `${req.user!.stxAddress} accepted your connection request.`,
        });
      }

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Accept connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to accept request" });
    }
  },

  async decline(req: Request, res: Response) {
    try {
      const id = parseNumericParam(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }

      const updated = await connectionsService.decline(id, req.user!.id);
      if (!updated) {
        return res.status(404).json({ message: "Connection request not found" });
      }

      if (updated.otherUser?.id) {
        await notificationService.create({
          userId: updated.otherUser.id,
          type: "connection_request_declined",
          title: "Connection Request Declined",
          message: `${req.user!.stxAddress} declined your connection request.`,
        });
      }

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Decline connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to decline request" });
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      const id = parseNumericParam(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }

      const updated = await connectionsService.cancel(id, req.user!.id);
      if (!updated) {
        return res.status(404).json({ message: "Connection request not found" });
      }

      if (updated.otherUser?.id) {
        await notificationService.create({
          userId: updated.otherUser.id,
          type: "connection_request_cancelled",
          title: "Connection Request Cancelled",
          message: `${req.user!.stxAddress} cancelled a pending connection request.`,
        });
      }

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Cancel connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to cancel request" });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = parseNumericParam(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }

      const updated = await connectionsService.remove(id, req.user!.id);
      if (!updated) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (updated.otherUser?.id) {
        await notificationService.create({
          userId: updated.otherUser.id,
          type: "connection_removed",
          title: "Connection Removed",
          message: `${req.user!.stxAddress} removed this connection.`,
        });
      }

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Remove connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to remove connection" });
    }
  },

  async block(req: Request, res: Response) {
    try {
      const result = blockSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const updated = await connectionsService.block(req.user!.id, result.data.userId, result.data.reason);
      return res.status(200).json(updated);
    } catch (error) {
      console.error("Block connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to block user" });
    }
  },

  async unblock(req: Request, res: Response) {
    try {
      const id = parseNumericParam(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid block ID" });
      }

      const updated = await connectionsService.unblock(id, req.user!.id);
      if (!updated) {
        return res.status(404).json({ message: "Block not found" });
      }

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Unblock connection error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to unblock user" });
    }
  },
};
