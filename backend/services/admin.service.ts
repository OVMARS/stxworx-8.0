import { db } from "../db";
import {
  users,
  projects,
  disputes,
  reputationNfts,
  milestoneSubmissions,
} from "@shared/schema";
import { eq, sql, and, lt, ne, count, sum, inArray } from "drizzle-orm";
import { notificationService } from "./notification.service";

export const adminService = {
  async getDashboard() {
    const [userCount] = await db
      .select({ count: count() })
      .from(users);

    const [projectCount] = await db
      .select({ count: count() })
      .from(projects);

    const [activeProjectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.status, "active"));

    const [completedProjectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.status, "completed"));

    const [refundedProjectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.status, "refunded"));

    const [openDisputeCount] = await db
      .select({ count: count() })
      .from(disputes)
      .where(eq(disputes.status, "open"));

    const [resolvedDisputeCount] = await db
      .select({ count: count() })
      .from(disputes)
      .where(eq(disputes.status, "resolved"));

    // Funded projects = those with an escrow TX
    const [fundedProjectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(
        and(
          sql`${projects.escrowTxId} IS NOT NULL`,
          sql`${projects.escrowTxId} != ''`
        )
      );

    // Milestone submission stats
    const [totalSubmissions] = await db
      .select({ count: count() })
      .from(milestoneSubmissions);

    const [approvedSubmissions] = await db
      .select({ count: count() })
      .from(milestoneSubmissions)
      .where(eq(milestoneSubmissions.status, "approved"));

    const [pendingSubmissions] = await db
      .select({ count: count() })
      .from(milestoneSubmissions)
      .where(eq(milestoneSubmissions.status, "submitted"));

    const [rejectedSubmissions] = await db
      .select({ count: count() })
      .from(milestoneSubmissions)
      .where(eq(milestoneSubmissions.status, "rejected"));

    // Freelancer count
    const [freelancerCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "freelancer"));

    const [clientCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "client"));

    return {
      totalUsers: userCount.count,
      totalProjects: projectCount.count,
      activeProjects: activeProjectCount.count,
      completedProjects: completedProjectCount.count,
      refundedProjects: refundedProjectCount.count,
      fundedProjects: fundedProjectCount.count,
      openDisputes: openDisputeCount.count,
      resolvedDisputes: resolvedDisputeCount.count,
      totalSubmissions: totalSubmissions.count,
      approvedSubmissions: approvedSubmissions.count,
      pendingSubmissions: pendingSubmissions.count,
      rejectedSubmissions: rejectedSubmissions.count,
      freelancerCount: freelancerCount.count,
      clientCount: clientCount.count,
    };
  },

  async getAllProjects(filters?: {
    status?: string;
    search?: string;
  }) {
    // Re-use project service with admin-level access (no ownership filter)
    const { projectService } = await import("./project.service");
    return projectService.getAll(filters);
  },

  async getProjectDetail(projectId: number) {
    const { projectService } = await import("./project.service");
    const project = await projectService.getById(projectId);
    if (!project) return null;

    const submissions = await db
      .select()
      .from(milestoneSubmissions)
      .where(eq(milestoneSubmissions.projectId, projectId));

    const projectDisputes = await db
      .select()
      .from(disputes)
      .where(eq(disputes.projectId, projectId));

    return { project, submissions, disputes: projectDisputes };
  },

  async getAllDisputes() {
    return db
      .select()
      .from(disputes);
  },

  async resolveDispute(
    disputeId: number,
    adminId: number,
    data: { resolution: string; resolutionTxId: string; favorFreelancer: boolean }
  ) {
    // Get the dispute first to know the project/milestone
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
    if (!dispute || dispute.status !== 'open') return null;

    await db
      .update(disputes)
      .set({
        status: "resolved",
        resolution: data.resolution,
        resolvedBy: adminId,
        resolutionTxId: data.resolutionTxId,
        resolvedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId));
    const [updated] = await db.select().from(disputes).where(eq(disputes.id, disputeId));

    // If the project was stuck in "disputed" status (legacy), restore it to "active"
    // Check if there are any remaining open disputes on this project
    const remainingOpen = await db
      .select()
      .from(disputes)
      .where(and(eq(disputes.projectId, dispute.projectId), eq(disputes.status, 'open')));
    if (remainingOpen.length === 0) {
      const [project] = await db.select().from(projects).where(eq(projects.id, dispute.projectId));
      if (project && project.status === 'disputed') {
        await db.update(projects).set({ status: 'active' }).where(eq(projects.id, dispute.projectId));
      }
    }

    // Notify both parties about the resolution
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, dispute.projectId));
      if (project) {
        const outcome = data.favorFreelancer ? 'released to freelancer' : 'refunded to client';
        const notifyIds = [project.clientId, project.freelancerId].filter(Boolean) as number[];
        for (const userId of notifyIds) {
          await notificationService.create({
            userId,
            type: 'dispute_resolved',
            title: `Dispute Resolved — Milestone ${dispute.milestoneNum}`,
            message: `The dispute on Milestone ${dispute.milestoneNum} of "${project.title}" has been resolved. Funds ${outcome}. Resolution: ${data.resolution.slice(0, 100)}`,
            projectId: dispute.projectId,
          });
        }
      }
    } catch (e) {
      console.error('Failed to send dispute resolution notifications:', e);
    }

    return updated || null;
  },

  async resetDispute(
    disputeId: number,
    adminId: number,
    data: { resolution: string; resolutionTxId: string; favorFreelancer: boolean }
  ) {
    // Get the dispute first
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
    if (!dispute || dispute.status !== 'open') return null;

    await db
      .update(disputes)
      .set({
        status: "reset",
        resolution: data.resolution,
        resolvedBy: adminId,
        resolutionTxId: data.resolutionTxId,
        resolvedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId));
    const [updated] = await db.select().from(disputes).where(eq(disputes.id, disputeId));

    // If the project was stuck in "disputed" status (legacy), restore to "active"
    const remainingOpen = await db
      .select()
      .from(disputes)
      .where(and(eq(disputes.projectId, dispute.projectId), eq(disputes.status, 'open')));
    if (remainingOpen.length === 0) {
      const [project] = await db.select().from(projects).where(eq(projects.id, dispute.projectId));
      if (project && project.status === 'disputed') {
        await db.update(projects).set({ status: 'active' }).where(eq(projects.id, dispute.projectId));
      }
    }

    // Notify both parties about the reset
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, dispute.projectId));
      if (project) {
        const notifyIds = [project.clientId, project.freelancerId].filter(Boolean) as number[];
        for (const userId of notifyIds) {
          await notificationService.create({
            userId,
            type: 'dispute_resolved',
            title: `Dispute Reset — Milestone ${dispute.milestoneNum}`,
            message: `The dispute on Milestone ${dispute.milestoneNum} of "${project.title}" has been reset by admin. The milestone is now open for normal workflow. Note: ${data.resolution.slice(0, 100)}`,
            projectId: dispute.projectId,
          });
        }
      }
    } catch (e) {
      console.error('Failed to send dispute reset notifications:', e);
    }

    return updated || null;
  },

  async getAbandonedProjects() {
    // Projects that have been active for a long time with no recent milestone submissions
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.status, "active"),
          lt(projects.updatedAt, sevenDaysAgo)
        )
      );
  },

  async forceRelease(data: { projectId: number; milestoneNum: number; txId: string }) {
    // Update the milestone submission
    await db
      .update(milestoneSubmissions)
      .set({ releaseTxId: data.txId, status: "approved", reviewedAt: new Date() })
      .where(
        and(
          eq(milestoneSubmissions.projectId, data.projectId),
          eq(milestoneSubmissions.milestoneNum, data.milestoneNum)
        )
      );

    const [submission] = await db
      .select()
      .from(milestoneSubmissions)
      .where(
        and(
          eq(milestoneSubmissions.projectId, data.projectId),
          eq(milestoneSubmissions.milestoneNum, data.milestoneNum)
        )
      );

    return submission || null;
  },

  async forceRefund(data: { projectId: number; txId: string }) {
    const { projectService } = await import("./project.service");
    return projectService.update(data.projectId, { status: "refunded" });
  },

  async getAllUsers() {
    return db.select().from(users);
  },

  async updateUserStatus(userId: number, isActive: boolean) {
    await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));
    const [updated] = await db.select().from(users).where(eq(users.id, userId));
    return updated || null;
  },

  // NFT management
  async createNft(data: {
    recipientId: number;
    nftType: "milestone_streak" | "top_freelancer" | "top_client" | "loyalty" | "custom";
    name: string;
    description?: string;
    metadataUrl?: string;
    issuedBy: number;
  }) {
    const result = await db.insert(reputationNfts).values(data);
    const [nft] = await db.select().from(reputationNfts).where(eq(reputationNfts.id, result[0].insertId));
    return nft;
  },

  async getAllNfts(filters?: { nftType?: string; minted?: boolean }) {
    let query = db.select().from(reputationNfts);
    const conditions = [];

    if (filters?.nftType) {
      conditions.push(eq(reputationNfts.nftType, filters.nftType as any));
    }
    if (filters?.minted !== undefined) {
      conditions.push(eq(reputationNfts.minted, filters.minted));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query;
  },

  async confirmNftMint(nftId: number, mintTxId: string) {
    await db
      .update(reputationNfts)
      .set({ minted: true, mintTxId })
      .where(eq(reputationNfts.id, nftId));
    const [updated] = await db.select().from(reputationNfts).where(eq(reputationNfts.id, nftId));
    return updated || null;
  },

  async getNftsByUser(userId: number) {
    return db
      .select()
      .from(reputationNfts)
      .where(eq(reputationNfts.recipientId, userId));
  },
};
