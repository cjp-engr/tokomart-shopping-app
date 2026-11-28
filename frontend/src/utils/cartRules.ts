import type { Cart, CartItem, SelectedVariant } from '../types/cart';
import type { Product } from '../types/product';
import { TAX_RATE } from './constants';

// The web cart's rules as pure functions, so they can be tested without a browser. `CartContext` only keeps the
// state and calls these.

export const buildCartKey = (productId: string, variantKey?: string): string =>
  variantKey ? `${productId}|${variantKey}` : productId;

export const cartItemKey = (item: CartItem): string =>
  buildCartKey(item.product.id, item.selectedVariant?.key);

export const getEffectivePrice = (price: number, discount?: number | null): number =>
  discount && discount > 0 ? price * (1 - discount / 100) : price;

export const calculateCartTotals = (items: CartItem[]): Cart => {
  const subtotal = items.reduce((sum, item) => {
    const sv = item.selectedVariant;
    const price = sv ? getEffectivePrice(sv.price, sv.discount) : item.product.price;
    return sum + price * item.quantity;
  }, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const tax = subtotal * TAX_RATE;

  return { items, totalItems, subtotal, tax, shipping: 0, total: subtotal + tax };
};

/** The stock a line can use: the chosen variant's stock when there is one (even 0), else the product's. */
export const effectiveStock = (product: Pick<Product, 'stock'>, variant?: Pick<SelectedVariant, 'stock'>): number =>
  variant?.stock ?? product.stock;

/** A quantity never goes above the stock (REQ-INV-07). */
export const capToStock = (quantity: number, stock: number): number => Math.min(quantity, stock);

/** Adds `quantity` of a product (and variant) to the lines: a new selected line, or more of an existing one, capped at the stock. */
export function addLine(items: CartItem[], product: Product, quantity: number, variant?: SelectedVariant): CartItem[] {
  const key = buildCartKey(product.id, variant?.key);
  const stock = effectiveStock(product, variant);
  if (items.some(i => cartItemKey(i) === key)) {
    return items.map(i => (cartItemKey(i) === key ? { ...i, quantity: capToStock(i.quantity + quantity, stock) } : i));
  }
  return [...items, { product, quantity: capToStock(quantity, stock), selectedVariant: variant, isSelected: true }];
}

/** Sets the quantity of one line, capped at that line's stock. The caller removes the line for a quantity of 0 or less. */
export function setLineQuantity(items: CartItem[], productId: string, quantity: number, variantKey?: string): CartItem[] {
  const key = buildCartKey(productId, variantKey);
  return items.map(i => (cartItemKey(i) === key ? { ...i, quantity: capToStock(quantity, effectiveStock(i.product, i.selectedVariant)) } : i));
}

/** The stock the server reports for a product, or for one of its variants; 0 when the variant is gone. */
export function stockOf(
  fetched: { stock?: number; variants?: Array<{ _id?: string; stock?: number }> },
  variantId?: string,
): number {
  if (variantId) return fetched.variants?.find(v => v._id?.toString() === variantId.toString())?.stock ?? 0;
  return fetched.stock ?? 0;
}

/** The cart keys of the lines the server says are gone or sold out (REQ-CART-06). */
export function staleCartKeys(results: Array<{ id: string; variantKey?: string; remove: boolean }>): Set<string> {
  return new Set(results.filter(r => r.remove).map(r => buildCartKey(r.id, r.variantKey)));
}

/** Checks or unchecks one line for checkout (REQ-CART-05). */
export function setLineSelected(items: CartItem[], productId: string, isSelected: boolean, variantKey?: string): CartItem[] {
  const key = buildCartKey(productId, variantKey);
  return items.map(i => (cartItemKey(i) === key ? { ...i, isSelected } : i));
}

/** The lines that go to checkout: only the checked ones. */
export const selectedItems = (items: CartItem[]): CartItem[] => items.filter(i => i.isSelected);
