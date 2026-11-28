import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import type { Response } from 'express';
import Coupon from '../../models/Coupon.js';
import { validateCoupon } from '../couponController.js';
import { connectIntegrationDb } from '../../services/__tests__/integrationDb.js';
import type { AuthRequest } from '../../middleware/auth.js';

// POST /api/coupons/validate: why a voucher is accepted or refused (REQ-CPN-03, REQ-CPN-04, REQ-CPN-05; TC-019, TC-020, TC-057, TC-238 to TC-241).
const seller = new mongoose.Types.ObjectId();
const otherSeller = new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60 * 1000;

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return Coupon.create({ code: 'SAVE10', sellerId: seller, discountType: 'percentage', discountValue: 10, isActive: true, ...overrides });
}

async function validate(body: Record<string, unknown>) {
  const req = { body, user: { id: new mongoose.Types.ObjectId().toString() } } as unknown as AuthRequest;
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as any).mockReturnValue(res);
  await validateCoupon(req, res);
  return {
    status: ((res.status as any).mock.calls[0]?.[0] as number | undefined) ?? 200, // res.json alone means 200
    body: (res.json as any).mock.calls[0][0] as Record<string, any>,
  };
}
const ask = (overrides: Record<string, unknown> = {}) => validate({ code: 'SAVE10', sellerId: seller.toString(), orderAmount: 100, ...overrides });

describe('validating a voucher against a real database', () => {
  beforeAll(async () => { await connectIntegrationDb(); await Coupon.init(); });
  beforeEach(async () => { await Coupon.deleteMany({}); });
  afterEach(async () => { await Coupon.deleteMany({}); });
  afterAll(async () => { await mongoose.disconnect(); });

  it('accepts a good code and quotes the discount (TC-019)', async () => {
    await makeCoupon();
    const result = await ask();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, discountAmount: 10, coupon: { code: 'SAVE10', discountType: 'percentage', discountValue: 10 } });
  });

  it('ignores the case of the code', async () => {
    await makeCoupon();
    expect((await ask({ code: 'save10' })).status).toBe(200);
  });

  it('quotes a fixed amount, and a percentage stopped at its maximum', async () => {
    await makeCoupon({ code: 'FIVE', discountType: 'fixed', discountValue: 5 });
    await makeCoupon({ code: 'HALF', discountValue: 50, maxDiscount: 20 });
    expect((await ask({ code: 'FIVE' })).body.discountAmount).toBe(5);
    expect((await ask({ code: 'HALF', orderAmount: 100 })).body.discountAmount).toBe(20);
  });

  describe('refusals', () => {
    it('answers 400 when the code or the seller is missing', async () => {
      expect((await validate({ sellerId: seller.toString() })).status).toBe(400);
      expect((await validate({ code: 'SAVE10' })).body).toMatchObject({ success: false, message: 'code and sellerId are required' });
    });

    it('answers 404 "Invalid voucher code" for an unknown code (TC-238)', async () => {
      const result = await ask({ code: 'NOPE' });
      expect(result.status).toBe(404);
      expect(result.body).toMatchObject({ success: false, message: 'Invalid voucher code' });
    });

    it("answers 404 for another seller's code: a voucher only works at its own seller", async () => {
      await makeCoupon({ sellerId: otherSeller });
      expect((await ask()).status).toBe(404);
    });

    it('answers 400 for a voucher that is switched off', async () => {
      await makeCoupon({ isActive: false });
      expect(await ask()).toMatchObject({ status: 400, body: { message: 'This voucher is no longer active' } });
    });

    it('answers 400 for an expired voucher, and accepts one that expires later', async () => {
      await makeCoupon({ expiresAt: new Date(Date.now() - 1000) });
      expect(await ask()).toMatchObject({ status: 400, body: { message: 'This voucher has expired' } });
      await Coupon.deleteMany({});
      await makeCoupon({ expiresAt: new Date(Date.now() + DAY) });
      expect((await ask()).status).toBe(200);
    });

    it('answers 400 once the usage limit is reached, and accepts one use before it (TC-241)', async () => {
      await makeCoupon({ usageLimit: 3, usedCount: 3 });
      expect(await ask()).toMatchObject({ status: 400, body: { message: 'This voucher has reached its usage limit' } });
      await Coupon.deleteMany({});
      await makeCoupon({ usageLimit: 3, usedCount: 2 });
      expect((await ask()).status).toBe(200);
    });

    it('has no limit when the usage limit is not set', async () => {
      await makeCoupon({ usedCount: 9999 });
      expect((await ask()).status).toBe(200);
    });
  });

  describe('the minimum order amount (TC-057)', () => {
    beforeEach(async () => { await makeCoupon({ minOrderAmount: 50 }); });

    it('refuses an order one cent below the minimum, with the amount in the message', async () => {
      expect(await ask({ orderAmount: 49.99 })).toMatchObject({ status: 400, body: { message: 'Minimum order amount is $50.00' } });
    });
    it('accepts exactly the minimum and anything above it', async () => {
      expect((await ask({ orderAmount: 50 })).status).toBe(200);
      expect((await ask({ orderAmount: 50.01 })).status).toBe(200);
    });
    // Current behaviour, recorded rather than approved: with no order amount the minimum is not checked.
    it('does not check the minimum when no order amount is sent (current behaviour)', async () => {
      const result = await validate({ code: 'SAVE10', sellerId: seller.toString() });
      expect(result.status).toBe(200);
      expect(result.body.discountAmount).toBe(0);
    });
  });
});
