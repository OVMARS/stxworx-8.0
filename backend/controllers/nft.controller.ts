import { type Request, type Response } from "express";
import { nftService } from "../services/nft.service";

export const nftController = {
  async getMine(req: Request, res: Response) {
    try {
      const nfts = await nftService.getByUserId(req.user!.id);
      return res.status(200).json(nfts);
    } catch (error) {
      console.error("Get my NFTs error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getByAddress(req: Request, res: Response) {
    try {
      const nfts = await nftService.getByAddress(req.params.address);
      if (!nfts) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json(nfts);
    } catch (error) {
      console.error("Get NFTs by address error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
