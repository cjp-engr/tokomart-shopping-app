// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../test/dom';
import { Products } from './Products';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../types/product';

// The products page: loading, empty and result states (REQ-CAT-09, TC-040), and what it asks the list for
// (REQ-CAT-03, REQ-CAT-10).
vi.mock('../hooks/useProducts', () => ({ useProducts: vi.fn() }));
vi.mock('../hooks/useGridColumns', () => ({ useGridColumns: () => 3, PAGE_SIZE_BY_COLUMNS: { 1: 8, 2: 10, 3: 9 } }));
vi.mock('../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn(), getItemQuantity: () => 0 }) }));
const authUser: { user: { id: string } | null } = { user: null };
vi.mock('../context/AuthContext', () => ({ useAuth: () => authUser }));

const product = (id: string, name: string): Product => ({
  id, name, description: 'd', category: 'Books', price: 10, image: 'i.png', stock: 5, rating: 4, reviews: 0, createdAt: '2026-01-01T00:00:00.000Z', sellerId: 's1',
} as Product);

const listing = (over: Partial<ReturnType<typeof useProducts>> = {}) =>
  vi.mocked(useProducts).mockReturnValue({ products: [], loading: false, error: null, totalPages: 1, total: 0, ...over });
const open = () => render(<MemoryRouter><Products /></MemoryRouter>);

describe('the products page', () => {
  beforeEach(() => {
    vi.mocked(useProducts).mockReset();
    authUser.user = null;
  });

  it('shows a spinner and "Loading…" while the products load, and marks the grid busy', () => {
    listing({ loading: true });
    open();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByTestId('products-grid')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('products-empty')).toBeNull();
  });

  it('says "No products found" with a way to reset the filters when nothing matches', () => {
    listing({ products: [], total: 0 });
    open();
    expect(screen.getByTestId('products-empty')).toBeInTheDocument();
    expect(screen.getByText('No products found')).toBeInTheDocument();
    expect(screen.getByText('0 products found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
  });

  it('lists the products and the count when there are some', () => {
    listing({ products: [product('1', 'Novel'), product('2', 'Atlas')], total: 2 });
    open();
    expect(screen.getByText('2 products found')).toBeInTheDocument();
    expect(screen.getByText('Novel')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
    expect(screen.queryByTestId('products-empty')).toBeNull();
    expect(screen.getByTestId('products-grid')).toHaveAttribute('aria-busy', 'false');
  });

  it('asks for the chosen category, and for all categories again after Reset Filters', async () => {
    listing();
    const user = userEvent.setup();
    open();
    await user.click(screen.getByTestId('category-filter-books'));
    expect(vi.mocked(useProducts).mock.lastCall![0]).toMatchObject({ category: 'Books' });
    await user.click(screen.getByRole('button', { name: 'Reset Filters' }));
    expect(vi.mocked(useProducts).mock.lastCall![0]!.category).toBeUndefined();
  });

  it('leaves out the logged-in seller\'s own products by asking the server to exclude them (TC-015)', () => {
    authUser.user = { id: 'seller-1' };
    listing();
    open();
    expect(vi.mocked(useProducts).mock.lastCall![0]).toMatchObject({ excludeSellerId: 'seller-1' });
  });

  it('does not exclude anyone for a guest', () => {
    listing();
    open();
    expect(vi.mocked(useProducts).mock.lastCall![0]!.excludeSellerId).toBeUndefined();
  });
});
