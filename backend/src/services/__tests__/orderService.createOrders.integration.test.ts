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

  // The stock check reads the product first and the decrement happens later, so buyers racing for the last units
  // all pass the check. The decrement itself must refuse to go below zero (Open question 18).
  describe('buyers racing for the last units never oversell', () => {
    const racers = (n: number, productId: string, variantId?: string) => Promise.allSettled(
      Array.from({ length: n }, () => createOrders({
        userId: new mongoose.Types.ObjectId().toString(),
        items: [{ productId, variantId, quantity: 1 }],
        shippingAddress: address,
        paymentMethod: cod,
      })),
    );

    it('lets exactly as many buyers through as there is stock, and the rest get 400 Insufficient stock', async () => {
      const product = await makeProduct({ stock: 2, soldCount: 0 });

      const results = await racers(6, product._id.toString());

      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
      const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(refused).toHaveLength(4);
      for (const r of refused) expect(r.reason).toMatchObject({ statusCode: 400, message: 'Insufficient stock for: Item' });
      const stored = await Product.findById(product._id).lean();
      expect(stored).toMatchObject({ stock: 0, soldCount: 2 });
      expect(await Order.countDocuments()).toBe(2);
    });

    it('does the same for the stock of a variant', async () => {
      const product = await makeVariantProduct(2);
      const variantId = String((product.variants as unknown as Array<{ _id: mongoose.Types.ObjectId }>)[0]._id);

      const results = await racers(6, product._id.toString(), variantId);

      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
      for (const r of results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
        expect(r.reason).toMatchObject({ statusCode: 400, message: 'Insufficient stock for variant of: Shirt' });
      }
      const stored = await Product.findById(product._id).lean();
      expect(stored!.variants!.map(v => v.stock)).toEqual([0]);
      expect(stored!.soldCount).toBe(2);
      expect(await Order.countDocuments()).toBe(2);
    });

    it('gives back the first line when the second line sells out under the buyer', async () => {
      const scarce = await makeProduct({ stock: 2, soldCount: 0 });
      const plenty = await makeProduct({ stock: 10, soldCount: 0 });

      const results = await Promise.allSettled(Array.from({ length: 5 }, () => createOrders({
        userId: new mongoose.Types.ObjectId().toString(),
        items: [{ productId: plenty._id.toString(), quantity: 1 }, { productId: scarce._id.toString(), quantity: 1 }],
        shippingAddress: address,
        paymentMethod: cod,
      })));

      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
      expect(await Product.findById(scarce._id).lean()).toMatchObject({ stock: 0, soldCount: 2 });
      // The three refused buyers must not keep the unit of the plentiful product they took first.
      expect(await Product.findById(plenty._id).lean()).toMatchObject({ stock: 8, soldCount: 2 });
      expect(await Order.countDocuments()).toBe(2);
    });
  });
});
