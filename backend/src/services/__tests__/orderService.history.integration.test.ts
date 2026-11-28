import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import '../../models/User.js'; // getUserOrders populates the seller, so the User model must be registered
import { createOrders, getUserOrders } from '../orderService.js';
import { connectIntegrationDb } from './integrationDb.js';

const seller = new mongoose.Types.ObjectId();
const buyer = new mongoose.Types.ObjectId();
const otherBuyer = new mongoose.Types.ObjectId();
const address = { street: '1 Main', city: 'Town', state: 'ST', zipCode: '12345', country: 'PH' };
const cod = { type: 'cash-on-delivery' };

async function placeFor(userId: mongoose.Types.ObjectId, name: string, createdAt: Date) {
  const product = await Product.create({
    name, description: 'd', category: 'Books', price: 10, stock: 5, image: 'i.png', sellerId: seller,
  });
  const [order] = await createOrders({
    userId: userId.toString(),
    items: [{ productId: product._id.toString(), quantity: 1 }],
    shippingAddress: address,
    paymentMethod: cod,
  });
  // Give each order a known creation time, so the ordering does not depend on how fast the test runs.
  // createdAt is immutable in the Mongoose schema, so it is set on the raw collection.
  await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt } });
  return order._id.toString();
}

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 12));

describe('getUserOrders (REQ-ORD-12; replica set)', () => {
  beforeAll(async () => {
    await connectIntegrationDb();
    await Promise.all([Product.init(), Order.init()]);
  });

  beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({})]);
  });

  afterEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('lists the buyer\'s orders newest first, whatever order they were placed in', async () => {
    const middle = await placeFor(buyer, 'Middle', at(10));
    const newest = await placeFor(buyer, 'Newest', at(20));
    const oldest = await placeFor(buyer, 'Oldest', at(1));

    const orders = await getUserOrders(buyer.toString());

    expect(orders.map(o => o._id.toString())).toEqual([newest, middle, oldest]);
  });

  it('never lists another buyer\'s orders', async () => {
    const mine = await placeFor(buyer, 'Mine', at(5));
    await placeFor(otherBuyer, 'Theirs', at(6));

    const orders = await getUserOrders(buyer.toString());

    expect(orders.map(o => o._id.toString())).toEqual([mine]);
  });

  it('leaves out draft orders from an unfinished card checkout', async () => {
    const placed = await placeFor(buyer, 'Placed', at(5));
    const draft = await placeFor(buyer, 'Draft', at(9));
    await Order.updateOne({ _id: draft }, { $set: { status: 'awaiting_payment' } });

    const orders = await getUserOrders(buyer.toString());

    expect(orders.map(o => o._id.toString())).toEqual([placed]);
  });

  it('returns an empty list for a buyer with no orders', async () => {
    await placeFor(otherBuyer, 'Theirs', at(6));

    expect(await getUserOrders(buyer.toString())).toEqual([]);
  });
});
