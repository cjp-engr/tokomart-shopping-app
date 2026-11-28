import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import Product from '../../models/Product.js';
import '../../models/User.js'; // the list populates the seller, so the User model must be registered
import { getProducts } from '../productController.js';
import { connectIntegrationDb } from '../../services/__tests__/integrationDb.js';

// GET /api/products: what a buyer can find (REQ-CAT-01, REQ-CAT-03, REQ-CAT-04, REQ-CAT-07, REQ-CAT-10; TC-010, TC-011, TC-015, TC-065, TC-066).
const sellerA = new mongoose.Types.ObjectId();
const sellerB = new mongoose.Types.ObjectId();

async function make(overrides: Record<string, unknown> = {}) {
  return Product.create({
    name: 'Item', description: 'A plain item', category: 'Books', price: 10, stock: 5, image: 'i.png', sellerId: sellerA, ...overrides,
  });
}

async function list(query: Record<string, string> = {}) {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as any).mockReturnValue(res);
  await getProducts({ query } as unknown as Request, res);
  const body = (res.json as any).mock.calls[0][0] as { success: boolean; count: number; total: number; page: number; pages: number; products: Array<{ name: string; _id: unknown }> };
  return { status: (res.status as any).mock.calls[0][0] as number, body, names: body.products.map(p => p.name) };
}

describe('the product list against a real database', () => {
  beforeAll(async () => {
    await connectIntegrationDb();
    await Product.init(); // creates the text index that search needs
  });
  beforeEach(async () => { await Product.deleteMany({}); });
  afterEach(async () => { await Product.deleteMany({}); });
  afterAll(async () => { await mongoose.disconnect(); });

  describe('search by keyword (TC-010)', () => {
    beforeEach(async () => {
      await make({ name: 'Wireless Headphones', description: 'Over-ear bluetooth' });
      await make({ name: 'Desk Lamp', description: 'Warm light for a desk' });
      await make({ name: 'Notebook', description: 'Wireless pairing is not included' });
    });

    it('finds products whose name or description has the word', async () => {
      expect((await list({ search: 'wireless' })).names.sort()).toEqual(['Notebook', 'Wireless Headphones']);
    });
    it('ignores upper and lower case', async () => {
      expect((await list({ search: 'DESK' })).names.sort()).toEqual(['Desk Lamp']);
    });
    it('finds nothing for a word no product has, and still answers 200', async () => {
      const result = await list({ search: 'zeppelin' });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ success: true, count: 0, total: 0, pages: 0 });
    });
    it('lists everything when the search is empty', async () => {
      expect((await list({ search: '' })).body.total).toBe(3);
    });
    it('does not use the text as a pattern: symbols match nothing and do not fail', async () => {
      const result = await list({ search: '.*' });
      expect(result.status).toBe(200);
      expect(result.body.total).toBe(0);
    });
  });

  describe('filter by category (TC-011)', () => {
    it('lists only that category', async () => {
      await make({ name: 'Novel', category: 'Books' });
      await make({ name: 'Radio', category: 'Electronics' });
      expect((await list({ category: 'Electronics' })).names).toEqual(['Radio']);
    });
    it('combines with the search (TC-066)', async () => {
      await make({ name: 'Radio', category: 'Electronics', description: 'Portable radio' });
      await make({ name: 'Radio history', category: 'Books', description: 'A book about radio' });
      expect((await list({ search: 'radio', category: 'Books' })).names).toEqual(['Radio history']);
    });
    it('finds nothing in an unknown category', async () => {
      await make();
      expect((await list({ category: 'Nope' })).body.total).toBe(0);
    });
  });

  describe("a seller's own products (TC-015)", () => {
    it('are left out when the page asks to exclude that seller', async () => {
      await make({ name: 'Mine', sellerId: sellerA });
      await make({ name: 'Theirs', sellerId: sellerB });
      expect((await list({ excludeSellerId: sellerA.toString() })).names).toEqual(['Theirs']);
    });
    it('are listed when no seller is excluded', async () => {
      await make({ name: 'Mine', sellerId: sellerA });
      await make({ name: 'Theirs', sellerId: sellerB });
      expect((await list()).names.sort()).toEqual(['Mine', 'Theirs']);
    });
  });

  describe('what is for sale (TC-065)', () => {
    it('lists a new product with stock', async () => {
      await make({ name: 'Fresh listing', stock: 1 });
      expect((await list()).names).toEqual(['Fresh listing']);
    });
    it('hides a product with no stock', async () => {
      await make({ name: 'Sold out', stock: 0 });
      expect((await list()).body.total).toBe(0);
    });
    it('lists a variant product when at least one variant has stock, even if the product stock is 0', async () => {
      await make({
        name: 'Shirt', stock: 0, variantAttributes: [{ name: 'Size', values: ['M', 'L'] }],
        variants: [{ attributes: { Size: 'M' }, price: 12, stock: 0 }, { attributes: { Size: 'L' }, price: 12, stock: 2 }],
      });
      expect((await list()).names).toEqual(['Shirt']);
    });
    it('hides a variant product whose variants are all sold out', async () => {
      await make({
        name: 'Gone shirt', stock: 0, variantAttributes: [{ name: 'Size', values: ['M'] }],
        variants: [{ attributes: { Size: 'M' }, price: 12, stock: 0 }],
      });
      expect((await list()).body.total).toBe(0);
    });
  });

  describe('price range, order and pages', () => {
    beforeEach(async () => {
      await make({ name: 'C', price: 30 });
      await make({ name: 'A', price: 10 });
      await make({ name: 'B', price: 20 });
    });
    it('keeps both ends of the price range', async () => {
      expect((await list({ minPrice: '10', maxPrice: '20', sort: 'name' })).names).toEqual(['A', 'B']);
    });
    it.each([
      ['price-asc', ['A', 'B', 'C']],
      ['price-desc', ['C', 'B', 'A']],
      ['name', ['A', 'B', 'C']],
    ])('sorts by %s', async (sort, expected) => {
      expect((await list({ sort })).names).toEqual(expected);
    });
    it('pages the list and counts the pages', async () => {
      const first = await list({ sort: 'name', limit: '2', page: '1' });
      const second = await list({ sort: 'name', limit: '2', page: '2' });
      expect(first.names).toEqual(['A', 'B']);
      expect(second.names).toEqual(['C']);
      expect(first.body).toMatchObject({ total: 3, pages: 2, page: 1 });
    });
  });
});
