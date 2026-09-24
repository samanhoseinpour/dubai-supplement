import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'

export { ApiZodResponse } from './api-zod-response.js'

export function buildDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Dubai Supplement API')
    .setDescription('Internal API for the Dubai Supplement storefront.')
    .setVersion('0.0.0')
    .build()

  // No `standardSchemaConverter`: Nest falls back to ~standard.jsonSchema,
  // which Zod 4 implements. Supplying one would be dead code.
  return SwaggerModule.createDocument(app, config)
}
