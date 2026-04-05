import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('./connections.service', () => ({
  connectionsService: {
    getRelationship: vi.fn(),
  },
}));

import { db } from '../db';
import { connectionsService } from './connections.service';
import { messagesService } from './messages.service';

type MockUser = {
  id: number;
  role: 'client' | 'freelancer';
  isActive: boolean;
};

function queueSelectResults(...results: unknown[]) {
  const pending = [...results];

  vi.mocked(db.select).mockImplementation(() => ({
    from: () => ({
      where: async () => (pending.shift() as unknown[]) ?? [],
    }),
  }) as any);
}

function queueAssertCanMessageData(options?: {
  sender?: Partial<MockUser>;
  recipient?: Partial<MockUser>;
  messagingOption?: 'everyone' | 'clients_only' | 'connections_only';
}) {
  queueSelectResults(
    [{ id: 1, role: 'freelancer', isActive: true, ...options?.sender }],
    [{ id: 2, role: 'freelancer', isActive: true, ...options?.recipient }],
    [{ userId: 2, messagingOption: options?.messagingOption ?? 'everyone' }],
  );
}

describe('messagesService.assertCanMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when the sender has blocked the recipient', async () => {
    queueAssertCanMessageData();
    vi.mocked(connectionsService.getRelationship).mockResolvedValueOnce({
      relationshipState: 'blocked',
      restriction: { direction: 'outgoing', type: 'blocked' },
    } as any);

    await expect(messagesService.assertCanMessage(1, 2)).rejects.toThrow('You have blocked this user');
  });

  it('rejects non-clients when the recipient only accepts client messages', async () => {
    queueAssertCanMessageData({ messagingOption: 'clients_only', sender: { role: 'freelancer' } });
    vi.mocked(connectionsService.getRelationship).mockResolvedValueOnce({
      relationshipState: 'none',
      restriction: null,
    } as any);

    await expect(messagesService.assertCanMessage(1, 2)).rejects.toThrow('This user only accepts messages from clients');
  });

  it('rejects non-connections when the recipient only accepts connection messages', async () => {
    queueAssertCanMessageData({ messagingOption: 'connections_only' });
    vi.mocked(connectionsService.getRelationship).mockResolvedValueOnce({
      relationshipState: 'outgoing',
      restriction: null,
    } as any);

    await expect(messagesService.assertCanMessage(1, 2)).rejects.toThrow('This user only accepts messages from connections');
  });

  it('allows accepted connections when connections_only is enabled', async () => {
    queueAssertCanMessageData({ messagingOption: 'connections_only' });
    vi.mocked(connectionsService.getRelationship).mockResolvedValueOnce({
      relationshipState: 'accepted',
      restriction: null,
    } as any);

    await expect(messagesService.assertCanMessage(1, 2)).resolves.toBeUndefined();
  });
});
