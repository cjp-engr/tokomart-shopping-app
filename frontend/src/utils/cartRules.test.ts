import { describe, expect, it } from 'vitest';
import {
  addLine, buildCartKey, calculateCartTotals, capToStock, cartItemKey, effectiveStock, selectedItems, setLineQuantity, setLineSelected, staleCartKeys, stockOf,
} from './cartRules';
import type { CartItem, SelectedVariant } from '../types/cart';
import type { Product } from '../types/product';

// The web cart rules (REQ-INV-07, REQ-CART-06, REQ-PRC-04): kept in a pure module so they need no browser.
const product = (overrides: Partial<Product> = {}): Product => ({ id: 'p1', price: 20, stock: 5, ...overrides } as Product);
const variant = (overrides: Partial<SelectedVariant> = {}): SelectedVariant =>
  ({ _id: 'v1', attributes: { Size: 'M' }, price: 30, stock: 3, key: 'Size:M', ...overrides });
const line = (overrides: Partial<CartItem> = {}): CartItem => ({ product: product(), quantity: 1, isSelected: true, ...overrides });

describe('the cart key', () => {
  it('is the product id alone, or the product id and the variant key', () => {
    expect(buildCartKey('p1')).toBe('p1');
    expect(buildCartKey('p1', 'Size:M')).toBe('p1|Size:M');
  });
  it('tells two variants of one product apart', () => {
    expect(cartItemKey(line({ selectedVariant: variant({ key: 'Size:M' }) }))).not.toBe(cartItemKey(line({ selectedVariant: variant({ key: 'Size:L' }) })));
  });
});

describe('the stock a line can use', () => {
  it('is the variant stock when a variant is chosen, even when it is 0', () => {
    expect(effectiveStock(product({ stock: 9 }), variant({ stock: 3 }))).toBe(3);
    expect(effectiveStock(product({ stock: 9 }), variant({ stock: 0 }))).toBe(0);
  });
  it('is the product stock without a variant', () => {
    expect(effectiveStock(product({ stock: 9 }))).toBe(9);
  });
});

describe('capping a quantity at the stock (REQ-INV-07)', () => {
  it.each([
    ['one below the stock', 4, 5, 4],
    ['exactly the stock', 5, 5, 5],
    ['one above the stock', 6, 5, 5],
    ['far above the stock', 99, 5, 5],
    ['a stock of 0', 1, 0, 0],
  ])('%s', (_label, quantity, stock, expected) => {
    expect(capToStock(quantity, stock)).toBe(expected);
  });
});

describe('adding a line', () => {
  it('adds a new selected line, capped at the stock', () => {
    const items = addLine([], product({ stock: 5 }), 9);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 5, isSelected: true });
  });
  it('adds to the quantity of an existing line and caps the sum at the stock', () => {
    const start = [line({ quantity: 3 })];
    expect(addLine(start, product({ stock: 5 }), 1)[0].quantity).toBe(4);
    expect(addLine(start, product({ stock: 5 }), 2)[0].quantity).toBe(5);
    expect(addLine(start, product({ stock: 5 }), 3)[0].quantity).toBe(5);
  });
  it('keeps two variants of one product as two lines, each capped by its own stock', () => {
    const m = variant({ key: 'Size:M', stock: 2 });
    const l = variant({ key: 'Size:L', stock: 4 });
    let items = addLine([], product({ stock: 0 }), 3, m);
    items = addLine(items, product({ stock: 0 }), 3, l);
    expect(items.map(i => i.quantity)).toEqual([2, 3]);
  });
  it('does not change the list it was given', () => {
    const start = [line({ quantity: 1 })];
    addLine(start, product(), 2);
    expect(start[0].quantity).toBe(1);
  });
});

describe('changing a quantity', () => {
  it('caps the new quantity at the stock of that line and leaves the other lines alone', () => {
    const items = [line({ product: product({ id: 'a', stock: 4 }), quantity: 1 }), line({ product: product({ id: 'b', stock: 9 }), quantity: 2 })];
    const next = setLineQuantity(items, 'a', 7);
    expect(next.map(i => i.quantity)).toEqual([4, 2]);
  });
});

describe('the totals (REQ-PRC-04)', () => {
  it('adds 8% tax to the subtotal and counts every unit', () => {
    const cart = calculateCartTotals([line({ quantity: 2 }), line({ product: product({ id: 'p2', price: 10 }), quantity: 1 })]);
    expect(cart.subtotal).toBe(50);
    expect(cart.totalItems).toBe(3);
    expect(cart.tax).toBeCloseTo(4, 10);
    expect(cart.total).toBeCloseTo(54, 10);
    expect(cart.shipping).toBe(0);
  });
  it('prices a variant line with its own price and discount, not the product price', () => {
    const cart = calculateCartTotals([line({ quantity: 2, selectedVariant: variant({ price: 100, discount: 10 }) })]);
    expect(cart.subtotal).toBeCloseTo(180, 10);
  });
  it('is zero for an empty cart', () => {
    expect(calculateCartTotals([])).toMatchObject({ subtotal: 0, tax: 0, total: 0, totalItems: 0 });
  });
});

describe('the stock found on the server (REQ-CART-06)', () => {
  it('reads the product stock, or the stock of the chosen variant', () => {
    const fetched = { stock: 7, variants: [{ _id: 'v1', stock: 2 }, { _id: 'v2', stock: 0 }] };
    expect(stockOf(fetched)).toBe(7);
    expect(stockOf(fetched, 'v1')).toBe(2);
    expect(stockOf(fetched, 'v2')).toBe(0);
  });
  it('is 0 for a variant the product no longer has, or a product without a stock field', () => {
    expect(stockOf({ stock: 7, variants: [] }, 'gone')).toBe(0);
    expect(stockOf({})).toBe(0);
  });
});

describe('the lines to drop when the cart loads (REQ-CART-06)', () => {
  it('names the lines the server says to remove, by their cart keys', () => {
    const keys = staleCartKeys([
      { id: 'p1', remove: true },
      { id: 'p2', variantKey: 'Size:M', remove: true },
      { id: 'p3', remove: false },
    ]);
    expect([...keys].sort()).toEqual(['p1', 'p2|Size:M']);
  });
  it('is empty when nothing is stale', () => {
    expect(staleCartKeys([{ id: 'p1', remove: false }]).size).toBe(0);
  });
});

describe('selecting lines for checkout (REQ-CART-05)', () => {
  const items = [
    line({ product: product({ id: 'a' }), isSelected: true }),
    line({ product: product({ id: 'b' }), isSelected: true, selectedVariant: variant({ key: 'Size:M' }) }),
    line({ product: product({ id: 'c' }), isSelected: false }),
  ];
  it('unchecks one line and leaves the others', () => {
    const next = setLineSelected(items, 'a', false);
    expect(next.map(i => i.isSelected)).toEqual([false, true, false]);
  });
  it('finds a variant line by its variant key', () => {
    expect(setLineSelected(items, 'b', false, 'Size:M').map(i => i.isSelected)).toEqual([true, false, false]);
    expect(setLineSelected(items, 'b', false).map(i => i.isSelected)).toEqual([true, true, false]);
  });
  it('checks a line again', () => {
    expect(setLineSelected(items, 'c', true).map(i => i.isSelected)).toEqual([true, true, true]);
  });
  it('sends only the checked lines to checkout', () => {
    expect(selectedItems(items).map(i => i.product.id)).toEqual(['a', 'b']);
    expect(selectedItems(setLineSelected(items, 'a', false)).map(i => i.product.id)).toEqual(['b']);
  });
  it('sends nothing when no line is checked', () => {
    expect(selectedItems(items.map(i => ({ ...i, isSelected: false })))).toEqual([]);
  });
  it('does not change the list it was given', () => {
    setLineSelected(items, 'a', false);
    expect(items[0].isSelected).toBe(true);
  });
});
