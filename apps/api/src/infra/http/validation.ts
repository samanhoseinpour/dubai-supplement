import { type ArgumentMetadata, StandardSchemaValidationPipe } from '@nestjs/common'
import { ValidationError } from '../../shared/errors/index.js'

/**
 * Nest's pipe hands `exceptionFactory` the issues alone, never the argument's
 * metadata, so a scalar schema on `@Param('id', { schema })` or
 * `@Query('page', { schema })` fails with an empty path and a client cannot
 * tell which argument was wrong — two such params on one route would reject
 * byte-identically. This prefixes the argument's name (the decorator's
 * `data`) to every issue path. The whole-object forms — `@Body({ schema })`,
 * `@Query({ schema })` — carry no name and are left alone, so `page`,
 * `pageSize` and the body root `''` come out as before.
 */
class NamedArgumentValidationPipe extends StandardSchemaValidationPipe {
  override async transform<T>(value: T, metadata: ArgumentMetadata): Promise<T> {
    try {
      return await super.transform(value, metadata)
    } catch (error) {
      const name = metadata.data
      if (error instanceof ValidationError && name !== undefined) {
        throw new ValidationError(
          error.issues.map((issue) => ({ ...issue, path: [name, ...(issue.path ?? [])] })),
        )
      }
      throw error
    }
  }
}

/**
 * `exceptionFactory` receives Standard Schema issues. Ours is the AppError
 * subclass from src/shared/errors — NOT the interface of the same name that
 * @nestjs/common exports, which is not constructable.
 */
export function buildValidationPipe(): StandardSchemaValidationPipe {
  return new NamedArgumentValidationPipe({
    exceptionFactory: (issues) => new ValidationError(issues),
  })
}
