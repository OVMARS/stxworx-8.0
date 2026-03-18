import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { connectionsController } from "../controllers/connections.controller";

export const connectionsRoutes = Router();

connectionsRoutes.get("/", requireAuth, connectionsController.list);
connectionsRoutes.get("/suggestions", requireAuth, connectionsController.suggestions);
connectionsRoutes.post("/request", requireAuth, connectionsController.request);
connectionsRoutes.patch("/:id/accept", requireAuth, connectionsController.accept);
connectionsRoutes.patch("/:id/decline", requireAuth, connectionsController.decline);
