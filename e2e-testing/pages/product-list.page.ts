import { Locator, Page } from '@playwright/test';

export class ProductListPage {
  readonly page: Page;
  readonly root: Locator;
  readonly loadingSpinner: Locator;
  readonly searchInput: Locator;
  readonly grid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId('products-page');
    this.loadingSpinner = page.getByTestId('products-loading');
    this.searchInput = page.getByTestId('product-search-input');
    this.grid = page.getByTestId('products-grid');
  }

  async goto(): Promise<void> {
    await this.page.goto('/products');
    await this.root.waitFor();
    await this.loadingSpinner.waitFor({ state: 'hidden' });
  }

  async search(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
    await this.searchInput.press('Enter');
    await this.loadingSpinner.waitFor({ state: 'hidden' });
  }

  async clickFirstProduct(): Promise<void> {
    await this.page.locator('[data-testid^="product-card-"]').first().click();
  }

  productCard(id: string): Locator {
    return this.page.getByTestId(`product-card-${id}`);
  }
}
