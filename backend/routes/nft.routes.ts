import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { nftController } from "../controllers/nft.controller";

export const nftRoutes = Router();

nftRoutes.get("/me", requireAuth, nftController.getMine);
nftRoutes.get("/user/:address", nftController.getByAddress);
