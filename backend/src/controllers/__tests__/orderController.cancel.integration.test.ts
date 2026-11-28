import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import type { NextFunction, Response } from 'express';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import PaymentOperation from '../../models/PaymentOperation.js';
import { updateOrderStatus } from '../orderController.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { cancelPaymentIntent } from '../../services/stripeService.js';
import { connectIntegrationDb } from '../../services/__tests__/integrationDb.js';
import type { AuthRequest } from '../../middleware/auth.js';

vi.mock('../../services/stripeService.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/stripeService.js')>('../../services/stripeService.js');
  return { ...actual, cancelPaymentIntent: vi.fn(), retrievePaymentIntent: vi.fn(), retrieveIntentWithCharge: vi.fn() };
});

const buyer = new mongoose.Types.ObjectId();
const seller = new mongoose.Types.ObjectId();
const address = { street: '1 Main', city: 'Town', state: 'ST', zipCode: '12345', country: 'PH' };

async function makeProduct() {
  return Product.create({ name: 'Item', description: 'd', category: 'Books', price: 20, stock: 8, soldCount: 2, image: 'i.png', sellerId: seller });
}

function makeOrder(product: { _id: mongoose.Types.ObjectId }, overrides: Record<string, unknown> = {}) {
  return Order.create({
    userId: buyer,
    sellerId: seller,
    items: [{ product: product._id, productName: 'Item', productPrice: 20, productImage: 'i.png', quantity: 2 }],
    shippingAddress: address,
    paymentMethod: { type: 'cash-on-delivery' },
    subtotal: 40, discount: 0, tax: 0, shipping: 0, total: 40,
    status: 'pending',
    ...overrides,
  });
}

/** PUT /api/orders/:id/status with the real controller and the real error handler, the way Express chains them. */
async function putStatus(orderId: string, userId: string, body: Record<string, unknown> = {}) {
  const req = { params: { id: orderId }, user: { id: userId, email: 'b@test.com' }, body, method: 'PUT', originalUrl: `/api/orders/${orderId}/status` } as unknown as AuthRequest;
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as any).mockReturnValue(res);
  const next: NextFunction = err => errorHandler(err, req, res, vi.fn());
  await updateOrderStatus(req, res, next);
  return {
    status: (res.status as any).mock.calls[0]?.[0] as number,
    body: (res.json as any).mock.calls[0]?.[0] as Record<string, any>,
  };
}

describe('PUT /api/orders/:id/status, the buyer cancel route (REQ-CAN-01, REQ-CAN-02; replica set, Stripe mocked)', () => {
  beforeAll(async () => {
    await connectIntegrationDb();
    await Promise.all([Product.init(), Order.init(), PaymentOperation.init()]);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), PaymentOperation.deleteMany({})]);
  });

  afterEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), PaymentOperation.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('409 cancellation_conflict once the seller has taken the order', () => {
    it('answers a card order whose payment is already being captured', async () => {
      const product = await makeProduct();
      const order = await makeOrder(product, {
        paymentMethod: { type: 'credit-card' }, paymentFlowVersion: 'manual_capture', paymentStatus: 'capture_pending',
        paymentIntentId: 'pi_conflict_1', amountMinor: 4000, currency: 'USD',
      });

      const result = await putStatus(order.id, buyer.toString());

      expect(result.status).toBe(409);
      expect(result.body).toEqual({
        success: false,
        message: 'The seller has already accepted this order or its payment is being captured',
        code: 'cancellation_conflict',
      });
      expect((await Order.findById(order.id))!.status).toBe('pending');
      expect((await Product.findById(product._id))!.stock).toBe(8);
      expect(cancelPaymentIntent).not.toHaveBeenCalled();
    });

    it('answers a cash-on-delivery order the seller has already accepted', async () => {
      const product = await makeProduct();
      const order = await makeOrder(product, { paymentStatus: 'not_required', status: 'preparing', acceptBy: new Date(Date.now() + 3600000) });

      const result = await putStatus(order.id, buyer.toString());

      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ success: false, code: 'cancellation_conflict' });
      expect((await Order.findById(order.id))!.status).toBe('preparing');
      expect((await Product.findById(product._id))!.stock).toBe(8);
    });

    it('answers a legacy card order that is no longer pending with "Only pending orders can be cancelled"', async () => {
      const product = await makeProduct();
      const order = await makeOrder(product, {
        paymentMethod: { type: 'credit-card' }, paymentFlowVersion: 'legacy', paymentStatus: 'captured',
        paymentIntentId: 'pi_legacy_1', status: 'preparing',
      });

      const result = await putStatus(order.id, buyer.toString());

      expect(result.status).toBe(409);
      expect(result.body).toEqual({ success: false, message: 'Only pending orders can be cancelled', code: 'cancellation_conflict' });
      expect((await Order.findById(order.id))!.status).toBe('preparing');
      expect(await PaymentOperation.countDocuments()).toBe(0);
    });
  });

  describe('the legacy "only pending" rule for orders without a payment status', () => {
    it('answers 400 "You can only cancel pending orders" for a legacy cash-on-delivery order that has shipped', async () => {
      const product = await makeProduct();
      const order = await makeOrder(product, { status: 'shipped' }); // legacy: no paymentStatus, no acceptBy

      const result = await putStatus(order.id, buyer.toString());

      expect(result.status).toBe(400);
      expect(result.body).toEqual({ success: false, message: 'You can only cancel pending orders' }); // no code, unlike the 409s
      expect((await Order.findById(order.id))!.status).toBe('shipped');
      expect((await Product.findById(product._id))!.stock).toBe(8);
    });

    it.each(['preparing', 'processing', 'delivered'])('refuses a legacy order that is %s', async (status) => {
      const order = await makeOrder(await makeProduct(), { status });

      const result = await putStatus(order.id, buyer.toString());

      expect(result.status).toBe(400);
      expect(result.body.message).toBe('You can only cancel pending orders');
    });

    it('cancels a pending legacy order, gives the stock back and keeps the reason', async () => {
      const product = await makeProduct();
      const order = await makeOrder(product);

      const result = await putStatus(order.id, buyer.toString(), { cancelReason: 'Changed my mind' });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, order: { status: 'cancelled', cancelReason: 'Changed my mind' } });
      expect((await Product.findById(product._id))!.stock).toBe(10);
    });
  });

  describe('the other answers of the route', () => {
    it('answers 400 invalid_cancel_reason for a reason of 501 characters and leaves the order alone', async () => {
      const product = await makeProduct();
      const order = await makeOrder(product);

      const result = await putStatus(order.id, buyer.toString(), { cancelReason: 'a'.repeat(501) });

      expect(result.status).toBe(400);
      expect(result.body).toEqual({
        success: false, message: 'Cancellation reason must be text of at most 500 characters', code: 'invalid_cancel_reason',
      });
      expect((await Order.findById(order.id))!.status).toBe('pending');
    });

    it('accepts a reason of exactly 500 characters', async () => {
      const order = await makeOrder(await makeProduct());

      const result = await putStatus(order.id, buyer.toString(), { cancelReason: 'a'.repeat(500) });

      expect(result.status).toBe(200);
      expect(result.body.order.cancelReason).toHaveLength(500);
    });

    it('answers 403 for another buyer and 404 for an unknown order, without changing the order', async () => {
      const order = await makeOrder(await makeProduct());

      const other = await putStatus(order.id, new mongoose.Types.ObjectId().toString());
      expect(other.status).toBe(403);
      expect(other.body).toMatchObject({ success: false, message: 'Not authorized' });

      const unknown = await putStatus(new mongoose.Types.ObjectId().toString(), buyer.toString());
      expect(unknown.status).toBe(404);
      expect(unknown.body).toMatchObject({ success: false, message: 'Order not found' });

      expect((await Order.findById(order.id))!.status).toBe('pending');
    });

    it('answers 404 for an unfinished checkout draft (awaiting_payment)', async () => {
      const order = await makeOrder(await makeProduct(), { status: 'awaiting_payment', paymentFlowVersion: 'manual_capture' });

      const result = await putStatus(order.id, buyer.toString());

      expect(result.status).toBe(404);
      expect(result.body.message).toBe('Order not found');
    });
  });
});
