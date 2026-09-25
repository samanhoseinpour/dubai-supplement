// The only path another module or an entrypoint may import (§5.3).
export { CatalogModule } from './catalog.module.js'
export { BrandService } from './application/brand.service.js'
// For a cross-module foreign key only (db.md): declare, never query.
export * as tables from './infrastructure/schema.js'
