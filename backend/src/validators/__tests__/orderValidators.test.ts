import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createOrderRules } from '../orderValidators.js';
import { validate } from '../validate.js';

const validBody = () => ({
  items: [{ productId: 'p1', quantity: 1 }],
  shippingAddress: { street: '1 Main', city: 'Town', state: 'ST', zipCode: '12345' },
  paymentMethod: { type: 'cash-on-delivery' },
});

/** Runs the order rules and then the shared `validate` middleware, the way the route does. */
async function check(body: unknown) {
  const req = { body } as unknown as Request;
  for (const rule of createOrderRules) await rule.run(req); // in order, like the route
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as any).mockReturnValue(res);
  const next = vi.fn();
  validate(req, res, next);
  return {
    passed: next.mock.calls.length === 1,
    status: (res.status as any).mock.calls[0]?.[0] as number | undefined,
    body: (res.json as any).mock.calls[0]?.[0] as { success: boolean; message: string; errors: unknown[] } | undefined,
  };
}

describe('createOrderRules (REQ-ORD-02)', () => {
  it('accepts a body with one item, an address and a payment method', async () => {
    expect((await check(validBody())).passed).toBe(true);
  });

  it('accepts a quantity of exactly 1 (the lower boundary)', async () => {
    const body = { ...validBody(), items: [{ productId: 'p1', quantity: 1 }] };
    expect((await check(body)).passed).toBe(true);
  });

  it.each([
    ['items is missing', { ...validBody(), items: undefined }],
    ['items is empty', { ...validBody(), items: [] }],
    ['items is not a list', { ...validBody(), items: 'p1' }],
  ])('rejects the order when %s with the "at least one item" message', async (_label, body) => {
    const result = await check(body);
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ success: false, message: 'Order must contain at least one item' });
  });

  it('rejects an item without a product id', async () => {
    const result = await check({ ...validBody(), items: [{ quantity: 1 }] });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Each item must have a productId');
  });

  it.each([0, -1, 1.5, 'abc'])('rejects the quantity %s (min - 1 and non-whole values)', async (quantity) => {
    const result = await check({ ...validBody(), items: [{ productId: 'p1', quantity }] });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Quantity must be a positive integer');
  });

  it.each([
    ['missing', undefined],
    ['an empty string', ''],
  ])('rejects the order when the shipping address is %s', async (_label, shippingAddress) => {
    const result = await check({ ...validBody(), shippingAddress });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Shipping address is required');
  });

  it.each([
    ['missing', undefined],
    ['an empty string', ''],
  ])('rejects the order when the payment method is %s', async (_label, paymentMethod) => {
    const result = await check({ ...validBody(), paymentMethod });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Payment method is required');
  });

  it('reports the first problem as the message and lists every problem in errors', async () => {
    const result = await check({ items: [], shippingAddress: undefined, paymentMethod: undefined });
    expect(result.status).toBe(400);
    expect(result.body!.message).toBe('Order must contain at least one item');
    expect(result.body!.errors.length).toBeGreaterThanOrEqual(3);
  });
});
