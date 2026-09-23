import { StandardSchemaValidationPipe } from '@nestjs/common'
import { ValidationError } from '../../shared/errors/index.js'

/**
 * `exceptionFactory` receives Standard Schema issues. Ours is the AppError
 * subclass from src/shared/errors — NOT the interface of the same name that
 * @nestjs/common exports, which is not constructable.
 */
export function buildValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => new ValidationError(issues),
  })
}
