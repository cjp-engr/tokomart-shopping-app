import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import mongoose from 'mongoose';
import type { Response } from 'express';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import Review from '../../models/Review.js';
import '../../models/User.js'; // createReview populates the reviewer, so the User model must be registered
import { createOrders } from '../../services/orderService.js';
import { connectIntegrationDb } from '../../services/__tests__/integrationDb.js';
import { createReview } from '../reviewController.js';
import type { AuthRequest } from '../../middleware/auth.js';

const seller = new mongoose.Types.ObjectId();
const address = { street: '1 Main', city: 'Town', state: 'ST', zipCode: '12345', country: 'PH' };

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as any).mockReturnValue(res);
  return res;
}
const statusOf = (res: Response) => (res.status as any).mock.calls[0]?.[0] as number | undefined;
const bodyOf = (res: Response) => (res.json as any).mock.calls[0]?.[0] as { success: boolean; message?: string };

async function makeProduct() {
  return Product.create({ name: 'Item', description: 'd', category: 'Books', price: 10, stock: 50, image: 'i.png', sellerId: seller });
}

/** A buyer with a delivered order for the product: the only thing that lets them review it. */
async function deliveredBuyer(productId: string) {
  const userId = new mongoose.Types.ObjectId();
  const [order] = await createOrders({
    userId: userId.toString(),
    items: [{ productId, quantity: 1 }],
    shippingAddress: address,
    paymentMethod: { type: 'cash-on-delivery' },
  });
  await Order.updateOne({ _id: order._id }, { $set: { status: 'delivered', deliveredAt: new Date() } });
  return { userId: userId.toString(), orderId: order._id.toString() };
}

function review(buyer: { userId: string; orderId: string }, productId: string, rating: number, comment = 'Good') {
  const req = { user: { id: buyer.userId, email: 'b@test.com' }, body: { productId, orderId: buyer.orderId, rating, comment } } as unknown as AuthRequest;
  const res = makeRes();
  return createReview(req, res).then(() => res);
}

describe('createReview against a real database (REQ-REV-03, REQ-REV-04, REQ-REV-08)', () => {
  beforeAll(async () => {
    await connectIntegrationDb();
    // The unique index on (buyer, product) is what the duplicate rules rest on, so wait until it exists.
    await Promise.all([Product.init(), Order.init(), Review.init()]);
  });

  beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), Review.deleteMany({})]);
  });

  afterEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), Review.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('creates the review and sets the product rating and review count', async () => {
    const product = await makeProduct();
    const buyer = await deliveredBuyer(product._id.toString());

    const res = await review(buyer, product._id.toString(), 4);

    expect(statusOf(res)).toBe(201);
    const stored = await Product.findById(product._id).lean();
    expect(stored!.rating).toBe(4);
    expect(stored!.reviews).toBe(1);
  });

  it('averages the ratings and rounds the product rating to one decimal', async () => {
    const product = await makeProduct();
    const id = product._id.toString();
    for (const rating of [5, 4, 4]) await review(await deliveredBuyer(id), id, rating);

    const stored = await Product.findById(product._id).lean();
    expect(stored!.reviews).toBe(3);
    expect(stored!.rating).toBe(4.3); // (5 + 4 + 4) / 3 = 4.333…
  });

  it('answers 409 to a second review of the same product by the same buyer and keeps one review', async () => {
    const product = await makeProduct();
    const id = product._id.toString();
    const buyer = await deliveredBuyer(id);
    await review(buyer, id, 5);

    const res = await review(buyer, id, 1, 'Changed my mind');

    expect(statusOf(res)).toBe(409);
    expect(bodyOf(res)).toMatchObject({ success: false, message: 'You have already reviewed this product' });
    expect(await Review.countDocuments({ productId: product._id })).toBe(1);
    expect((await Product.findById(product._id).lean())!.rating).toBe(5);
  });

  it('creates exactly one review when the same buyer sends two at the same moment', async () => {
    const product = await makeProduct();
    const id = product._id.toString();
    const buyer = await deliveredBuyer(id);

    const [a, b] = await Promise.all([review(buyer, id, 5), review(buyer, id, 5)]);

    expect([statusOf(a), statusOf(b)].sort()).toEqual([201, 409]);
    expect(await Review.countDocuments({ productId: product._id })).toBe(1);
    expect((await Product.findById(product._id).lean())!.reviews).toBe(1);
  });

  it('lets two different buyers each review the same product', async () => {
    const product = await makeProduct();
    const id = product._id.toString();

    const first = await review(await deliveredBuyer(id), id, 5);
    const second = await review(await deliveredBuyer(id), id, 3);

    expect([statusOf(first), statusOf(second)]).toEqual([201, 201]);
    expect(await Review.countDocuments({ productId: product._id })).toBe(2);
  });
});
