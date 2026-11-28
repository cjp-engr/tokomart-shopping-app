import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { ValidationChain } from 'express-validator';
import { createRefundRules, decideRefundRules, sellerRefundListRules, validateRefund } from '../refundValidators.js';
import { AppError } from '../../middleware/errorHandler.js';

/** Runs the rules in order and then `validateRefund`, the way the routes chain them. */
async function check(rules: ValidationChain[], body: unknown) {
  const req = { body } as unknown as Request;
  for (const rule of rules) await rule.run(req);
  const next = vi.fn();
  validateRefund(req, {} as Response, next);
  const arg = next.mock.calls[0]?.[0];
  return { passed: arg === undefined, error: arg as AppError | undefined };
}

const validRefund = () => ({
  items: [{ lineId: 'line-1', quantity: 1 }],
  reasonCode: 'damaged',
  description: 'The box arrived crushed',
  idempotencyKey: 'key-1',
});

describe('createRefundRules (REQ-REF-03)', () => {
  it('accepts a request with one line, a reason code, a description and a key', async () => {
    expect((await check(createRefundRules, validRefund())).passed).toBe(true);
  });

  it('answers a bad request with 400 and the refund_validation code', async () => {
    const { error } = await check(createRefundRules, { ...validRefund(), reasonCode: 'nope' });
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 400, code: 'refund_validation', message: 'Invalid refund request' });
  });

  it.each(['damaged', 'wrong_item', 'missing_items', 'not_as_described', 'other'])('accepts the reason code %s', async (reasonCode) => {
    expect((await check(createRefundRules, { ...validRefund(), reasonCode })).passed).toBe(true);
  });

  it.each([undefined, '', 'broken', 'Damaged', 5])('rejects the reason code %s', async (reasonCode) => {
    expect((await check(createRefundRules, { ...validRefund(), reasonCode })).passed).toBe(false);
  });

  describe('items', () => {
    it.each([
      ['missing', undefined],
      ['empty', []],
      ['not a list', 'line-1'],
    ])('rejects items that are %s', async (_label, items) => {
      expect((await check(createRefundRules, { ...validRefund(), items })).passed).toBe(false);
    });

    it('accepts 1000 lines and rejects 1001 (upper boundary)', async () => {
      const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ lineId: `l${i}`, quantity: 1 }));
      expect((await check(createRefundRules, { ...validRefund(), items: lines(1000) })).passed).toBe(true);
      expect((await check(createRefundRules, { ...validRefund(), items: lines(1001) })).passed).toBe(false);
    });

    it.each([undefined, '', 5])('rejects the line id %s', async (lineId) => {
      expect((await check(createRefundRules, { ...validRefund(), items: [{ lineId, quantity: 1 }] })).passed).toBe(false);
    });

    it('accepts a line id of 128 characters and rejects 129', async () => {
      expect((await check(createRefundRules, { ...validRefund(), items: [{ lineId: 'a'.repeat(128), quantity: 1 }] })).passed).toBe(true);
      expect((await check(createRefundRules, { ...validRefund(), items: [{ lineId: 'a'.repeat(129), quantity: 1 }] })).passed).toBe(false);
    });

    it('accepts a quantity of 1 (lower boundary)', async () => {
      expect((await check(createRefundRules, validRefund())).passed).toBe(true);
    });

    it.each([0, -1, 1.5, '1', null, undefined, Number.MAX_SAFE_INTEGER + 1, NaN])('rejects the quantity %s', async (quantity) => {
      expect((await check(createRefundRules, { ...validRefund(), items: [{ lineId: 'line-1', quantity }] })).passed).toBe(false);
    });

    it('validates every line, not only the first', async () => {
      const items = [{ lineId: 'line-1', quantity: 1 }, { lineId: 'line-2', quantity: 0 }];
      expect((await check(createRefundRules, { ...validRefund(), items })).passed).toBe(false);
    });
  });

  describe('description', () => {
    it('accepts 1 and 1000 characters and rejects 1001 (boundaries)', async () => {
      expect((await check(createRefundRules, { ...validRefund(), description: 'a' })).passed).toBe(true);
      expect((await check(createRefundRules, { ...validRefund(), description: 'a'.repeat(1000) })).passed).toBe(true);
      expect((await check(createRefundRules, { ...validRefund(), description: 'a'.repeat(1001) })).passed).toBe(false);
    });

    it.each([undefined, '', '   ', 5])('rejects the description %j', async (description) => {
      expect((await check(createRefundRules, { ...validRefund(), description })).passed).toBe(false);
    });

    it('counts the length after trimming, so padding does not push it over 1000', async () => {
      const description = `  ${'a'.repeat(1000)}  `;
      expect((await check(createRefundRules, { ...validRefund(), description })).passed).toBe(true);
    });
  });

  describe('idempotencyKey', () => {
    it('accepts 1 and 128 characters and rejects 129 (boundaries)', async () => {
      expect((await check(createRefundRules, { ...validRefund(), idempotencyKey: 'k' })).passed).toBe(true);
      expect((await check(createRefundRules, { ...validRefund(), idempotencyKey: 'k'.repeat(128) })).passed).toBe(true);
      expect((await check(createRefundRules, { ...validRefund(), idempotencyKey: 'k'.repeat(129) })).passed).toBe(false);
    });

    it.each([undefined, '', '   ', 5])('rejects the key %j', async (idempotencyKey) => {
      expect((await check(createRefundRules, { ...validRefund(), idempotencyKey })).passed).toBe(false);
    });
  });
});

describe('decideRefundRules (REQ-REF-05)', () => {
  it('accepts an approval without a reason', async () => {
    expect((await check(decideRefundRules, { decision: 'approve' })).passed).toBe(true);
  });

  it('does not require a rejection reason when approving, even if one is sent badly', async () => {
    expect((await check(decideRefundRules, { decision: 'approve', rejectionReason: 5 })).passed).toBe(true);
  });

  it('accepts a rejection with a reason', async () => {
    expect((await check(decideRefundRules, { decision: 'reject', rejectionReason: 'Item was used' })).passed).toBe(true);
  });

  it('answers a bad decision with 400 and the refund_validation code', async () => {
    const { error } = await check(decideRefundRules, { decision: 'maybe' });
    expect(error).toMatchObject({ statusCode: 400, code: 'refund_validation' });
  });

  it.each([undefined, '', 'approved', 'Approve', 5])('rejects the decision %j', async (decision) => {
    expect((await check(decideRefundRules, { decision })).passed).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['only spaces', '   '],
    ['not text', 5],
  ])('requires a rejection reason that is not %s', async (_label, rejectionReason) => {
    expect((await check(decideRefundRules, { decision: 'reject', rejectionReason })).passed).toBe(false);
  });

  it('accepts a rejection reason of 1000 characters and rejects 1001 (upper boundary)', async () => {
    expect((await check(decideRefundRules, { decision: 'reject', rejectionReason: 'a'.repeat(1000) })).passed).toBe(true);
    expect((await check(decideRefundRules, { decision: 'reject', rejectionReason: 'a'.repeat(1001) })).passed).toBe(false);
  });
});

// Seller refund list filters (kept from the original file; REQ-REF-05)
async function validateListQuery(query: Record<string, string>) {
  const req = { query } as unknown as Request;
  await Promise.all(sellerRefundListRules.map(rule => rule.run(req)));
  const next = vi.fn();
  validateRefund(req, {} as Response, next);
  return next.mock.calls[0][0] as { statusCode?: number; code?: string } | undefined;
}

describe('seller refund list query', () => {
  it.each(['in_progress', 'approved', 'rejected'])('accepts the %s group', async (status) => {
    expect(await validateListQuery({ status, page: '1', limit: '20' })).toBeUndefined();
  });

  it('accepts no group', async () => {
    expect(await validateListQuery({})).toBeUndefined();
  });

  it.each(['everything', 'requested', 'refunded', '', 'APPROVED'])('rejects the group "%s" with 400 refund_validation', async (status) => {
    expect(await validateListQuery({ status })).toMatchObject({ statusCode: 400, code: 'refund_validation' });
  });
});
