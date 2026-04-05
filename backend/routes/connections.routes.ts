import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { connectionsController } from "../controllers/connections.controller";

export const connectionsRoutes = Router();

connectionsRoutes.get("/", requireAuth, connectionsController.list);
connectionsRoutes.get("/suggestions", requireAuth, connectionsController.suggestions);
connectionsRoutes.get("/relationship/:userId", requireAuth, connectionsController.relationship);
connectionsRoutes.post("/request", requireAuth, connectionsController.request);
connectionsRoutes.post("/block", requireAuth, connectionsController.block);
connectionsRoutes.patch("/blocks/:id/unblock", requireAuth, connectionsController.unblock);
connectionsRoutes.patch("/:id/accept", requireAuth, connectionsController.accept);
connectionsRoutes.patch("/:id/decline", requireAuth, connectionsController.decline);
connectionsRoutes.patch("/:id/cancel", requireAuth, connectionsController.cancel);
connectionsRoutes.patch("/:id/remove", requireAuth, connectionsController.remove);
