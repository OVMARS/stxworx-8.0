import { db } from "../db";
import { userConnections, userConnectionRestrictions, users } from "@shared/schema";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";

async function getOtherUser(userId: number) {
  const [user] = await db
    .select({
      id: users.id,
      stxAddress: users.stxAddress,
      name: users.name,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      specialty: users.specialty,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, userId));

  return user || null;
}

type ConnectionDirection = "incoming" | "outgoing" | "none";
type RelationshipState = "none" | "outgoing" | "incoming" | "accepted" | "blocked" | "disconnected";
type RelationshipAction =
  | "send_request"
  | "accept_request"
  | "decline_request"
  | "cancel_request"
  | "remove_connection"
  | "block_user"
  | "unblock_user";

type ConnectionRecord = typeof userConnections.$inferSelect;
type RestrictionRecord = typeof userConnectionRestrictions.$inferSelect;
type OtherUser = Awaited<ReturnType<typeof getOtherUser>>;

type RelationshipRestriction = {
  id: number;
  type: RestrictionRecord["type"];
  direction: Exclude<ConnectionDirection, "none">;
  reason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function getConnectionDirection(connection: ConnectionRecord | null, userId: number): ConnectionDirection {
  if (!connection) {
    return "none";
  }

  return connection.requesterId === userId ? "outgoing" : "incoming";
}

function pickBlock(userId: number, restrictions: RestrictionRecord[]): RelationshipRestriction | null {
  const outgoingBlocked = restrictions.find((entry) => entry.type === "blocked" && entry.sourceUserId === userId) || null;
  if (outgoingBlocked) {
    return {
      id: outgoingBlocked.id,
      type: outgoingBlocked.type,
      direction: "outgoing",
      reason: outgoingBlocked.reason,
      createdAt: outgoingBlocked.createdAt,
      updatedAt: outgoingBlocked.updatedAt,
    };
  }

  const incomingBlocked = restrictions.find((entry) => entry.type === "blocked" && entry.targetUserId === userId) || null;
  if (incomingBlocked) {
    return {
      id: incomingBlocked.id,
      type: incomingBlocked.type,
      direction: "incoming",
      reason: incomingBlocked.reason,
      createdAt: incomingBlocked.createdAt,
      updatedAt: incomingBlocked.updatedAt,
    };
  }

  return null;
}

function getRelationshipState(connection: ConnectionRecord | null, userId: number, block: RelationshipRestriction | null): RelationshipState {
  if (block?.type === "blocked") {
    return "blocked";
  }

  if (!connection) {
    return "none";
  }

  if (connection.status === "accepted") {
    return "accepted";
  }

  if (connection.status === "pending") {
    return connection.requesterId === userId ? "outgoing" : "incoming";
  }

  return "disconnected";
}

function getAvailableActions(state: RelationshipState, block: RelationshipRestriction | null): RelationshipAction[] {
  switch (state) {
    case "incoming":
      return ["accept_request", "decline_request", "block_user"];
    case "outgoing":
      return ["cancel_request"];
    case "accepted":
      return ["remove_connection", "block_user"];
    case "blocked":
      return block?.direction === "outgoing" ? ["unblock_user"] : [];
    case "disconnected":
    case "none":
      return ["send_request", "block_user"];
  }
}

async function getActiveRestrictionsBetween(userId: number, otherUserId: number) {
  return db
    .select()
    .from(userConnectionRestrictions)
    .where(
      and(
        isNull(userConnectionRestrictions.liftedAt),
        or(
          and(eq(userConnectionRestrictions.sourceUserId, userId), eq(userConnectionRestrictions.targetUserId, otherUserId)),
          and(eq(userConnectionRestrictions.sourceUserId, otherUserId), eq(userConnectionRestrictions.targetUserId, userId)),
        ),
      ),
    );
}

async function buildRelationshipSummary(userId: number, otherUserId: number, connection: ConnectionRecord | null, restrictionRows?: RestrictionRecord[]) {
  const otherUser = await getOtherUser(otherUserId);
  const restrictions = restrictionRows ?? await getActiveRestrictionsBetween(userId, otherUserId);
  const block = pickBlock(userId, restrictions);
  const relationshipState = getRelationshipState(connection, userId, block);
  const direction = block?.direction || getConnectionDirection(connection, userId);
  const updatedAtCandidates = [connection?.updatedAt, block?.updatedAt, block?.createdAt, connection?.createdAt].filter(Boolean) as Date[];

  return {
    id: connection?.id ?? null,
    connectionId: connection?.id ?? null,
    requesterId: connection?.requesterId ?? null,
    addresseeId: connection?.addresseeId ?? null,
    status: connection?.status ?? null,
    direction,
    relationshipState,
    availableActions: getAvailableActions(relationshipState, block),
    otherUser,
    restriction: block,
    createdAt: connection?.createdAt ?? block?.createdAt ?? null,
    updatedAt: updatedAtCandidates[0] ?? null,
    acceptedAt: connection?.acceptedAt ?? null,
    declinedAt: connection?.declinedAt ?? null,
    cancelledAt: connection?.cancelledAt ?? null,
    removedAt: connection?.removedAt ?? null,
  };
}

export const connectionsService = {
  async findBetween(userId: number, otherUserId: number) {
    const [connection] = await db
      .select()
      .from(userConnections)
      .where(
        or(
          and(eq(userConnections.requesterId, userId), eq(userConnections.addresseeId, otherUserId)),
          and(eq(userConnections.requesterId, otherUserId), eq(userConnections.addresseeId, userId)),
        ),
      );

    return connection || null;
  },

  async getRelationship(userId: number, otherUserId: number) {
    const connection = await this.findBetween(userId, otherUserId);
    const restrictions = await getActiveRestrictionsBetween(userId, otherUserId);
    return buildRelationshipSummary(userId, otherUserId, connection, restrictions);
  },

  async areConnected(userId: number, otherUserId: number) {
    const relationship = await this.getRelationship(userId, otherUserId);
    return relationship.relationshipState === "accepted";
  },

  async assertCanInteract(userId: number, otherUserId: number) {
    const relationship = await this.getRelationship(userId, otherUserId);

    if (relationship.relationshipState === "blocked") {
      if (relationship.restriction?.direction === "outgoing") {
        throw new Error("You have blocked this user");
      }
      throw new Error("This user has blocked you");
    }

    return relationship;
  },

  async listForUser(userId: number) {
    const rows = await db
      .select()
      .from(userConnections)
      .where(or(eq(userConnections.requesterId, userId), eq(userConnections.addresseeId, userId)))
      .orderBy(desc(userConnections.updatedAt));

    const restrictionRows = await db
      .select()
      .from(userConnectionRestrictions)
      .where(
        and(
          isNull(userConnectionRestrictions.liftedAt),
          or(eq(userConnectionRestrictions.sourceUserId, userId), eq(userConnectionRestrictions.targetUserId, userId)),
        ),
      )
      .orderBy(desc(userConnectionRestrictions.updatedAt));

    const pairMap = new Map<number, { connection: ConnectionRecord | null; restrictions: RestrictionRecord[] }>();

    rows.forEach((row) => {
      const otherUserId = row.requesterId === userId ? row.addresseeId : row.requesterId;
      pairMap.set(otherUserId, {
        connection: row,
        restrictions: pairMap.get(otherUserId)?.restrictions || [],
      });
    });

    restrictionRows.forEach((row) => {
      const otherUserId = row.sourceUserId === userId ? row.targetUserId : row.sourceUserId;
      const existing = pairMap.get(otherUserId);
      pairMap.set(otherUserId, {
        connection: existing?.connection || null,
        restrictions: [...(existing?.restrictions || []), row],
      });
    });

    const summaries = await Promise.all(
      Array.from(pairMap.entries()).map(([otherUserId, entry]) => buildRelationshipSummary(userId, otherUserId, entry.connection, entry.restrictions)),
    );

    return summaries.sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime());
  },

  async getSuggestions(userId: number) {
    const existingRelationships = await this.listForUser(userId);
    const excludedIds = new Set<number>([userId]);

    existingRelationships.forEach((relationship) => {
      const otherUserId = relationship.otherUser?.id;
      if (!otherUserId) {
        return;
      }

      if (relationship.relationshipState !== "disconnected") {
        excludedIds.add(otherUserId);
      }
    });

    const candidates = await db
      .select({
        id: users.id,
        stxAddress: users.stxAddress,
        name: users.name,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        specialty: users.specialty,
        avatar: users.avatar,
      })
      .from(users)
      .where(and(eq(users.isActive, true), ne(users.id, userId)));

    return candidates.filter((candidate) => !excludedIds.has(candidate.id)).slice(0, 8);
  },

  async request(userId: number, otherUserId: number) {
    if (userId === otherUserId) {
      throw new Error("You cannot connect with yourself");
    }

    const otherUser = await getOtherUser(otherUserId);
    if (!otherUser?.isActive) {
      throw new Error("User not available");
    }

    await this.assertCanInteract(userId, otherUserId);

    const existing = await this.findBetween(userId, otherUserId);

    if (existing?.status === "accepted") {
      throw new Error("You are already connected");
    }

    if (existing?.status === "pending") {
      if (existing.requesterId === userId) {
        throw new Error("Connection request already sent");
      }
      throw new Error("This user has already sent you a connection request");
    }

    if (existing) {
      await db
        .update(userConnections)
        .set({
          requesterId: userId,
          addresseeId: otherUserId,
          status: "pending",
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: null,
          removedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, existing.id));
      return this.getRelationship(userId, otherUserId);
    }

    await db.insert(userConnections).values({
      requesterId: userId,
      addresseeId: otherUserId,
    });
    return this.getRelationship(userId, otherUserId);
  },

  async accept(connectionId: number, userId: number) {
    const [existing] = await db.select().from(userConnections).where(eq(userConnections.id, connectionId));
    if (!existing) {
      return null;
    }
    if (existing.addresseeId !== userId) {
      throw new Error("Not authorized to respond to this request");
    }
    if (existing.status !== "pending") {
      throw new Error("Only pending requests can be accepted");
    }

    await this.assertCanInteract(userId, existing.requesterId);

    await db
      .update(userConnections)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        declinedAt: null,
        cancelledAt: null,
        removedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userConnections.id, connectionId));

    return this.getRelationship(userId, existing.requesterId);
  },

  async decline(connectionId: number, userId: number) {
    const [existing] = await db.select().from(userConnections).where(eq(userConnections.id, connectionId));
    if (!existing) {
      return null;
    }
    if (existing.addresseeId !== userId) {
      throw new Error("Not authorized to decline this request");
    }
    if (existing.status !== "pending") {
      throw new Error("Only pending requests can be declined");
    }

    await db
      .update(userConnections)
      .set({
        status: "declined",
        acceptedAt: null,
        declinedAt: new Date(),
        cancelledAt: null,
        removedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userConnections.id, connectionId));

    return this.getRelationship(userId, existing.requesterId);
  },

  async cancel(connectionId: number, userId: number) {
    const [existing] = await db.select().from(userConnections).where(eq(userConnections.id, connectionId));
    if (!existing) {
      return null;
    }
    if (existing.requesterId !== userId) {
      throw new Error("Not authorized to cancel this request");
    }
    if (existing.status !== "pending") {
      throw new Error("Only pending requests can be cancelled");
    }

    await db
      .update(userConnections)
      .set({
        status: "cancelled",
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: new Date(),
        removedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(userConnections.id, connectionId));

    return this.getRelationship(userId, existing.addresseeId);
  },

  async remove(connectionId: number, userId: number) {
    const [existing] = await db.select().from(userConnections).where(eq(userConnections.id, connectionId));
    if (!existing) {
      return null;
    }

    const isParticipant = existing.requesterId === userId || existing.addresseeId === userId;
    if (!isParticipant) {
      throw new Error("Not authorized to remove this connection");
    }
    if (existing.status !== "accepted") {
      throw new Error("Only accepted connections can be removed");
    }

    await db
      .update(userConnections)
      .set({
        status: "removed",
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        removedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userConnections.id, connectionId));

    const otherUserId = existing.requesterId === userId ? existing.addresseeId : existing.requesterId;
    return this.getRelationship(userId, otherUserId);
  },

  async block(userId: number, otherUserId: number, reason?: string) {
    if (userId === otherUserId) {
      throw new Error("You cannot block yourself");
    }

    const otherUser = await getOtherUser(otherUserId);
    if (!otherUser?.isActive) {
      throw new Error("User not available");
    }

    const existingConnection = await this.findBetween(userId, otherUserId);
    if (existingConnection?.status === "pending") {
      const nextStatus = existingConnection.requesterId === userId ? "cancelled" : "declined";
      await db
        .update(userConnections)
        .set({
          status: nextStatus,
          acceptedAt: null,
          declinedAt: nextStatus === "declined" ? new Date() : null,
          cancelledAt: nextStatus === "cancelled" ? new Date() : null,
          removedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, existingConnection.id));
    } else if (existingConnection?.status === "accepted") {
      await db
        .update(userConnections)
        .set({
          status: "removed",
          acceptedAt: null,
          declinedAt: null,
          cancelledAt: null,
          removedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, existingConnection.id));
    }

    await db
      .update(userConnectionRestrictions)
      .set({
        liftedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userConnectionRestrictions.sourceUserId, userId),
          eq(userConnectionRestrictions.targetUserId, otherUserId),
          isNull(userConnectionRestrictions.liftedAt),
        ),
      );

    await db.insert(userConnectionRestrictions).values({
      sourceUserId: userId,
      targetUserId: otherUserId,
      type: "blocked",
      reason: reason?.trim() || null,
    });

    return this.getRelationship(userId, otherUserId);
  },

  async unblock(restrictionId: number, userId: number) {
    const [existing] = await db
      .select()
      .from(userConnectionRestrictions)
      .where(and(eq(userConnectionRestrictions.id, restrictionId), eq(userConnectionRestrictions.sourceUserId, userId), isNull(userConnectionRestrictions.liftedAt)));

    if (!existing) {
      return null;
    }

    await db
      .update(userConnectionRestrictions)
      .set({
        liftedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userConnectionRestrictions.id, restrictionId));

    return this.getRelationship(userId, existing.targetUserId);
  },
};
