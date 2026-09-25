import { Controller, Get, Param, Query } from '@nestjs/common'
import {
  type Brand,
  type BrandListQuery,
  type BrandListResponse,
  BrandListQuerySchema,
  BrandListResponseSchema,
  BrandSchema,
  ProblemDetailsSchema,
  slug,
} from '@ds/contracts'
import { ApiZodResponse } from '../../../shared/openapi/index.js'
import { BrandService, toDto } from '../application/brand.service.js'

/**
 * Read-only (§5.7): no unauthenticated write exists anywhere. Validation is
 * the global StandardSchemaValidationPipe over the contract schemas; a
 * failure is a 400 problem naming the member, before the handler runs.
 */
@Controller('catalog/brands')
export class BrandsController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  @ApiZodResponse(200, BrandListResponseSchema)
  @ApiZodResponse(400, ProblemDetailsSchema)
  list(@Query({ schema: BrandListQuerySchema }) query: BrandListQuery): Promise<BrandListResponse> {
    return this.brands.list(query)
  }

  @Get(':slug')
  @ApiZodResponse(200, BrandSchema)
  @ApiZodResponse(400, ProblemDetailsSchema)
  @ApiZodResponse(404, ProblemDetailsSchema)
  async get(@Param('slug', { schema: slug }) brandSlug: string): Promise<Brand> {
    return toDto(await this.brands.getBySlug(brandSlug))
  }
}
