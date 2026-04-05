import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/connections.service', () => ({
  connectionsService: {
    listForUser: vi.fn(),
    getSuggestions: vi.fn(),
    getRelationship: vi.fn(),
    request: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    cancel: vi.fn(),
    remove: vi.fn(),
    block: vi.fn(),
    unblock: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    create: vi.fn(),
  },
}));

import { connectionsController } from './connections.controller';
import { connectionsService } from '../services/connections.service';
import { notificationService } from '../services/notification.service';

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function createRequest(overrides: Partial<Request> = {}) {
  return {
    body: {},
    params: {},
    user: {
      id: 5,
      stxAddress: 'SP123TESTADDRESS',
      role: 'freelancer',
    },
    ...overrides,
  } as Request;
}

describe('connectionsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a connection request and sends a dedicated notification', async () => {
    const req = createRequest({ body: { userId: 7 } });
    const res = createResponse();
    const relationship = { connectionId: 11, relationshipState: 'outgoing' } as any;

    vi.mocked(connectionsService.request).mockResolvedValueOnce(relationship);

    await connectionsController.request(req, res);

    expect(connectionsService.request).toHaveBeenCalledWith(5, 7);
    expect(notificationService.create).toHaveBeenCalledWith({
      userId: 7,
      type: 'connection_request_received',
      title: 'New Connection Request',
      message: 'SP123TESTADDRESS sent you a connection request.',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(relationship);
  });

  it('returns a validation error for duplicate requests', async () => {
    const req = createRequest({ body: { userId: 7 } });
    const res = createResponse();

    vi.mocked(connectionsService.request).mockRejectedValueOnce(new Error('Connection request already sent'));

    await connectionsController.request(req, res);

    expect(notificationService.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Connection request already sent' });
  });

  it.each([
    ['accept', 'connection_request_accepted', 'Connection Request Accepted', 'accepted your connection request.'],
    ['decline', 'connection_request_declined', 'Connection Request Declined', 'declined your connection request.'],
    ['cancel', 'connection_request_cancelled', 'Connection Request Cancelled', 'cancelled a pending connection request.'],
    ['remove', 'connection_removed', 'Connection Removed', 'removed this connection.'],
  ] as const)('handles %s actions with dedicated notifications', async (action, type, title, messageSuffix) => {
    const req = createRequest({ params: { id: '11' } });
    const res = createResponse();
    const relationship = { connectionId: 11, otherUser: { id: 7 } } as any;

    vi.mocked(connectionsService[action]).mockResolvedValueOnce(relationship);

    await connectionsController[action](req, res);

    expect(connectionsService[action]).toHaveBeenCalledWith(11, 5);
    expect(notificationService.create).toHaveBeenCalledWith({
      userId: 7,
      type,
      title,
      message: `SP123TESTADDRESS ${messageSuffix}`,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(relationship);
  });

  it('creates a block through the controller', async () => {
    const req = createRequest({ body: { userId: 7, reason: 'abuse' } });
    const res = createResponse();
    const relationship = {
      relationshipState: 'blocked',
      restriction: { id: 3, type: 'blocked', direction: 'outgoing' },
    } as any;

    vi.mocked(connectionsService.block).mockResolvedValueOnce(relationship);

    await connectionsController.block(req, res);

    expect(connectionsService.block).toHaveBeenCalledWith(5, 7, 'abuse');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(relationship);
  });
});
