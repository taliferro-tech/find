import { ProductPagesConfig } from '@taliferro/ui/platform/product-pages.model';

/** Find's Help and About pages (the shared template, 2026-11-22). */
export const PRODUCT_PAGES_CONFIG: ProductPagesConfig = {
  key: 'find',
  logo: 'assets/brand/products/svg/light/11-find.svg',
  logoFill: true,
  openRoute: '/',
  // Find's own pages have no header Menu, so Help and About carry it.
  ownMenu: true,
};
