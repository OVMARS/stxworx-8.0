import { Router } from "express";
import { categoryController } from "../controllers/category.controller";

export const categoryRoutes = Router();

// Public
categoryRoutes.get("/", categoryController.getAll);
