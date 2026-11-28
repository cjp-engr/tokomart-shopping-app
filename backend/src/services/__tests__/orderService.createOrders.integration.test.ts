import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import Cart from '../../models/Cart.js';
import Coupon from '../../models/Coupon.js';
import { createOrders } from '../orderService.js';
import { connectIntegrationDb } from './integrationDb.js';

const buyer = new mongoose.Types.ObjectId();
const seller = new mongoose.Types.ObjectId();
const address = { street: '1 Main', city: 'Town', state: 'ST', zipCode: '12345', country: 'PH' };
const cod = { type: 'cash-on-delivery' };

async function makeProduct(overrides: Record<string, unknown> = {}) {
  return Product.create({
    name: 'Item', description: 'd', category: 'Books', price: 20, stock: 8, soldCount: 2, image: 'i.png', sellerId: seller,
    ...overrides,
  });
}

async function makeVariantProduct(variantStock = 3) {
  return Product.create({
    name: 'Shirt', description: 'd', category: 'Clothing', price: 0, stock: 0, soldCount: 0, image: 'i.png', sellerId: seller,
    variantAttributes: [{ name: 'Size', values: ['M'] }],
    variants: [{ attributes: { Size: 'M' }, price: 12, stock: variantStock }],
  });
}

function place(items: Array<{ productId: string; variantId?: string; quantity: number }>, shippingAddress: object = address) {
  return createOrders({ userId: buyer.toString(), items, shippingAddress, paymentMethod: cod });
}

/** Everything a failed order must leave exactly as it was. */
async function snapshot(productIds: mongoose.Types.ObjectId[]) {
  const products = await Product.find({ _id: { $in: productIds } }).sort({ _id: 1 }).lean();
  const cart = await Cart.findOne({ userId: buyer }).lean();
  return {
    orders: await Order.countDocuments(),
    products: products.map(p => ({ id: String(p._id), stock: p.stock, soldCount: p.soldCount, variants: (p.variants ?? []).map(v => v.stock) })),
    cartLines: cart ? cart.sellers.flatMap(s => s.items.map(i => `${i.product}:${i.quantity}`)) : [],
  };
}

describe('createOrders refusals change nothing (REQ-ORD-03, REQ-INV-02; replica set)', () => {
  beforeAll(async () => {
    await connectIntegrationDb();
    await Promise.all([Product.init(), Order.init(), Cart.init()]);
  });

  beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), Cart.deleteMany({}), Coupon.deleteMany({})]);
  });

  afterEach(async () => {
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), Cart.deleteMany({}), Coupon.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  async function cartWith(product: { _id: mongoose.Types.ObjectId }) {
    await Cart.create({
      userId: buyer,
      sellers: [{ sellerId: seller, items: [{ product: product._id, price: 20, quantity: 2, isSelected: true }] }],
    });
  }

  it('answers 404 "Product not found" for an unknown product and creates nothing', async () => {
    const product = await makeProduct();
    await cartWith(product);
    const before = await snapshot([product._id]);
    const unknown = new mongoose.Types.ObjectId().toString();

    await expect(place([{ productId: unknown, quantity: 1 }])).rejects.toMatchObject({
      statusCode: 404,
      message: `Product not found: ${unknown}`,
    });

    expect(await snapshot([product._id])).toEqual(before);
  });

  it('creates nothing when one line is valid and a second product is unknown (all or nothing)', async () => {
    const product = await makeProduct();
    await cartWith(product);
    const before = await snapshot([product._id]);
    const unknown = new mongoose.Types.ObjectId().toString();

    await expect(place([
      { productId: product._id.toString(), quantity: 2 },
      { productId: unknown, quantity: 1 },
    ])).rejects.toMatchObject({ statusCode: 404 });

    const after = await snapshot([product._id]);
    expect(after).toEqual(before);
    expect(after.products[0].stock).toBe(8);
    expect(after.orders).toBe(0);
  });

  it('answers 404 "Variant not found" for an unknown variant of a real product and creates nothing', async () => {
    const product = await makeVariantProduct();
    const before = await snapshot([product._id]);

    await expect(place([
      { productId: product._id.toString(), variantId: new mongoose.Types.ObjectId().toString(), quantity: 1 },
    ])).rejects.toMatchObject({ statusCode: 404, message: 'Variant not found for: Shirt' });

    expect(await snapshot([product._id])).toEqual(before);
  });

  it('answers 400 for a product with too little stock and creates nothing', async () => {
    const product = await makeProduct({ stock: 1 });
    await cartWith(product);
    const before = await snapshot([product._id]);

    await expect(place([{ productId: product._id.toString(), quantity: 2 }])).rejects.toMatchObject({
      statusCode: 400,
      message: 'Insufficient stock for: Item',
    });

    expect(await snapshot([product._id])).toEqual(before);
  });

  it('accepts a quantity equal to the stock (the upper boundary) and takes it all', async () => {
    const product = await makeProduct({ stock: 2 });

    const orders = await place([{ productId: product._id.toString(), quantity: 2 }]);

    expect(orders).toHaveLength(1);
    expect((await Product.findById(product._id).lean())!.stock).toBe(0);
  });

  it('answers 400 for a variant with too little stock and leaves the variant stock alone', async () => {
    const product = await makeVariantProduct(1);
    const variantId = String((product.variants as unknown as Array<{ _id: mongoose.Types.ObjectId }>)[0]._id);
    const before = await snapshot([product._id]);

    await expect(place([{ productId: product._id.toString(), variantId, quantity: 2 }])).rejects.toMatchObject({
      statusCode: 400,
      message: 'Insufficient stock for variant of: Shirt',
    });

    const after = await snapshot([product._id]);
    expect(after).toEqual(before);
    expect(after.products[0].variants).toEqual([1]);
  });

  // POST /api/orders accepts shippingAddress: {} (the route rule only checks that the value is not empty), so
  // Order.create fails on the required address fields after the stock was taken. A refused order must give
  // the stock, the sold count and the coupon use back (Open question 18; it was a known defect until 2026-11-28).
  describe('an order refused after the stock was taken gives everything back', () => {
    it('restores stock and sold count when the address is missing a required field', async () => {
      const product = await makeProduct();
      const before = await snapshot([product._id]);

      await expect(place([{ productId: product._id.toString(), quantity: 2 }], {})).rejects.toBeDefined();

      expect(await snapshot([product._id])).toEqual(before);
    });

    it('restores the stock of a variant line', async () => {
      const product = await makeVariantProduct(3);
      const variantId = String((product.variants as unknown as Array<{ _id: mongoose.Types.ObjectId }>)[0]._id);
      const before = await snapshot([product._id]);

      await expect(place([{ productId: product._id.toString(), variantId, quantity: 2 }], {})).rejects.toBeDefined();

      const after = await snapshot([product._id]);
      expect(after).toEqual(before);
      expect(after.products[0].variants).toEqual([3]);
    });

    it('does not use up a coupon for an order that was refused', async () => {
      const product = await makeProduct();
      await Coupon.create({ code: 'SAVE10', sellerId: seller, discountType: 'percentage', discountValue: 10, usageLimit: 5, usedCount: 1, isActive: true });
      const before = await snapshot([product._id]);

      await expect(createOrders({
        userId: buyer.toString(),
        items: [{ productId: product._id.toString(), quantity: 2 }],
        shippingAddress: {},
        paymentMethod: cod,
        couponCodes: { [seller.toString()]: 'SAVE10' },
      })).rejects.toBeDefined();

      expect(await snapshot([product._id])).toEqual(before);
      expect((await Coupon.findOne({ code: 'SAVE10' }).lean())!.usedCount).toBe(1);
    });

    it('removes the orders already made when a later seller\'s order fails (all or nothing)', async () => {
      const otherSeller = new mongoose.Types.ObjectId();
      const a = await makeProduct();
      const b = await makeProduct({ sellerId: otherSeller });
      const before = await snapshot([a._id, b._id]);

      const realCreate = Order.create.bind(Order) as (...args: unknown[]) => Promise<unknown>;
      let calls = 0;
      const spy = vi.spyOn(Order, 'create').mockImplementation(((...args: unknown[]) => {
        calls += 1;
        return calls === 2 ? Promise.reject(new Error('second order failed')) : realCreate(...args);
      }) as never);
      try {
        await expect(place([
          { productId: a._id.toString(), quantity: 2 },
          { productId: b._id.toString(), quantity: 3 },
        ])).rejects.toThrow('second order failed');
      } finally { spy.mockRestore(); }

      expect(calls).toBe(2);
      expect(await snapshot([a._id, b._id])).toEqual(before);
    });

    it('keeps the original error when the order fails, not an error from the clean-up', async () => {
      const product = await makeProduct();

      await expect(place([{ productId: product._id.toString(), quantity: 2 }], {})).rejects.toMatchObject({ name: 'ValidationError' });
    });
  });
});
