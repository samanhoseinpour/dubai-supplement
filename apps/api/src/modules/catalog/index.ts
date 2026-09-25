// The only path another module or an entrypoint may import (§5.3).
export { CatalogModule } from './catalog.module.js'
export { BrandService } from './application/brand.service.js'
export { SEED_BRANDS, seedBrands, type SeedReport } from './application/seed-brands.js'
// For a cross-module foreign key only (db.md): declare, never query.
export * as tables from './infrastructure/schema.js'
