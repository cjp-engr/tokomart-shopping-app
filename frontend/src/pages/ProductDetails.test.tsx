// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../test/dom';
import { ProductDetails } from './ProductDetails';
import productService from '../services/productService';
import type { Product } from '../types/product';

// The product page as a buyer sees it: the price (REQ-PRC-08, TC-012), the variant guard (REQ-PRC-02, TC-014),
// stock and the loading and error states.
const addToCart = vi.fn();
vi.mock('../services/productService', () => ({ default: { getProductById: vi.fn(), getRelatedProductsAsync: vi.fn() } }));
vi.mock('../context/CartContext', () => ({ useCart: () => ({ addToCart, getItemQuantity: () => 0 }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Desk Lamp', description: 'A lamp', category: 'Home & Garden', price: 100, image: 'lamp.png', stock: 5,
  rating: 4, reviews: 0, createdAt: '2026-01-01T00:00:00.000Z', sellerId: 's1', ...overrides,
} as Product);

const shirt = (): Product => product({
  name: 'Shirt', price: 0, stock: 0,
  variantAttributes: [{ name: 'Size', values: ['M', 'L'] }],
  variants: [
    { _id: 'v-m', attributes: { Size: 'M' }, price: 40, stock: 3 },
    { _id: 'v-l', attributes: { Size: 'L' }, price: 50, stock: 0 },
  ],
} as unknown as Partial<Product>);

function open(p: Product | null | Error) {
  const get = vi.mocked(productService.getProductById);
  if (p instanceof Error) get.mockRejectedValue(p); else get.mockResolvedValue(p as Product);
  vi.mocked(productService.getRelatedProductsAsync).mockResolvedValue([]);
  return render(
    <MemoryRouter initialEntries={['/products/p1']}>
      <Routes><Route path="/products/:id" element={<ProductDetails />} /></Routes>
    </MemoryRouter>,
  );
}

describe('the product page', () => {
  beforeEach(() => {
    addToCart.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('loading and errors (TC-040 on the detail page)', () => {
    it('shows a spinner while the product loads', () => {
      vi.mocked(productService.getProductById).mockReturnValue(new Promise(() => {}));
      vi.mocked(productService.getRelatedProductsAsync).mockResolvedValue([]);
      render(<MemoryRouter initialEntries={['/products/p1']}><Routes><Route path="/products/:id" element={<ProductDetails />} /></Routes></MemoryRouter>);
      expect(screen.getByTestId('product-detail-loading')).toBeInTheDocument();
    });
    it('says the product was not found when the server has none', async () => {
      open(null);
      expect(await screen.findByText('Product not found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to products/i })).toBeInTheDocument();
    });
    it('says the product could not be loaded when the request fails', async () => {
      open(new Error('network'));
      expect(await screen.findByText('Failed to load product details')).toBeInTheDocument();
    });
  });

  describe('the price (TC-012)', () => {
    it('shows a sale price with the original struck through and the percentage off', async () => {
      open(product({ price: 100, discount: 20 }));
      const price = await screen.findByTestId('product-price');
      expect(within(price).getByText('$80.00')).toBeInTheDocument();
      const original = within(price).getByText('$100.00');
      expect(original).toHaveClass('line-through');
      expect(within(price).getByText('-20%')).toBeInTheDocument();
    });
    it('shows one plain price when there is no discount', async () => {
      open(product({ price: 100 }));
      const price = await screen.findByTestId('product-price');
      expect(within(price).getByText('$100.00')).toBeInTheDocument();
      expect(price.querySelector('.line-through')).toBeNull();
      expect(within(price).queryByText(/%/)).toBeNull();
    });
    it('does not show the discount of the product on a variant product', async () => {
      open({ ...shirt(), discount: 50 } as Product);
      const price = await screen.findByTestId('product-price');
      expect(price.querySelector('.line-through')).toBeNull();
    });
    it('shows a variant sale price once the variant is chosen', async () => {
      const p = shirt();
      p.variants![0] = { ...p.variants![0], price: 40, discount: 25 } as never;
      open(p);
      await userEvent.click(await screen.findByTestId('variant-value-Size-M'));
      const price = screen.getByTestId('product-price');
      expect(within(price).getByText('$30.00')).toBeInTheDocument();
      expect(within(price).getByText('$40.00')).toHaveClass('line-through');
    });
  });

  describe('choosing a variant before adding to the cart (TC-014)', () => {
    it('offers no Add to Cart and says to select all options, until every option is chosen', async () => {
      open(shirt());
      await screen.findByTestId('variant-attr-Size');
      expect(screen.queryByTestId('add-to-cart-btn')).toBeNull();
      expect(screen.getByText('Please select all options to add to cart.')).toBeInTheDocument();
    });
    it('shows a starting price instead of one price before a variant is chosen', async () => {
      open(shirt());
      const price = await screen.findByTestId('product-price');
      expect(within(price).getByText(/^From \$40\.00/)).toBeInTheDocument();
    });
    it('offers Add to Cart once the variant is chosen, and adds that variant', async () => {
      open(shirt());
      await userEvent.click(await screen.findByTestId('variant-value-Size-M'));
      expect(screen.queryByText('Please select all options to add to cart.')).toBeNull();
      await userEvent.click(screen.getByTestId('add-to-cart-btn'));
      expect(addToCart).toHaveBeenCalledTimes(1);
      const [added, quantity, variant] = addToCart.mock.calls[0];
      expect(added.id).toBe('p1');
      expect(quantity).toBe(1);
      expect(variant).toMatchObject({ _id: 'v-m', key: 'Size:M', price: 40, stock: 3 });
    });
    it('does not let a sold-out variant be chosen', async () => {
      open(shirt());
      expect(await screen.findByTestId('variant-value-Size-L')).toBeDisabled();
      expect(screen.getByTestId('variant-value-Size-M')).toBeEnabled();
    });
  });

  describe('stock and quantity', () => {
    it('says Out of Stock and offers no Add to Cart for a product with no stock', async () => {
      open(product({ stock: 0 }));
      expect(await screen.findByText('Out of Stock')).toBeInTheDocument();
      expect(screen.queryByTestId('add-to-cart-btn')).toBeNull();
    });
    it('warns when only a few are left, and says In Stock above 10', async () => {
      open(product({ stock: 3 }));
      expect(await screen.findByText('Only 3 left in stock')).toBeInTheDocument();
    });
    it('says In Stock for more than 10', async () => {
      open(product({ stock: 11 }));
      expect(await screen.findByText('In Stock')).toBeInTheDocument();
    });
    it('stops the quantity at the stock and at 1', async () => {
      open(product({ stock: 2 }));
      const user = userEvent.setup();
      await screen.findByTestId('add-to-cart-btn');
      expect(screen.getByTestId('qty-decrement')).toBeDisabled();
      await user.click(screen.getByTestId('qty-increment'));
      expect(screen.getByTestId('qty-increment')).toBeDisabled();
      await user.click(screen.getByTestId('add-to-cart-btn'));
      expect(addToCart.mock.calls[0][1]).toBe(2);
    });
  });
});
