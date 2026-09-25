import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { ON_DOMAIN_EVENT } from '../../../infra/outbox/index.js'
import { BrandCreatedLogger } from './brand-created.logger.js'

describe('BrandCreatedLogger', () => {
  // What OutboxRelay's discovery scan reads: the metadata sits on the method.
  it('subscribes to catalog.brand.created', () => {
    // Looked up as a value on the prototype, the way the relay's scan does
    // (`Record<string, unknown>`, then `typeof`): `unbound-method` rejects
    // `BrandCreatedLogger.prototype.onBrandCreated` as a method reference.
    const prototype: object = BrandCreatedLogger.prototype
    const method: unknown = (prototype as Record<string, unknown>)['onBrandCreated']
    const type: unknown =
      typeof method === 'function' ? Reflect.getMetadata(ON_DOMAIN_EVENT, method) : undefined
    expect(type).toBe('catalog.brand.created')
  })

  it('logs one object naming the brand', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    new BrandCreatedLogger().onBrandCreated({ id: 'x', slug: 'muscletech', name: 'ماسل‌تک' })
    expect(log).toHaveBeenCalledWith({ msg: 'brand created', id: 'x', slug: 'muscletech' })
    log.mockRestore()
  })
})
