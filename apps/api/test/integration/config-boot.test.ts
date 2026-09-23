import { describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { AppModule } from '../../src/app.module.js'
import { AppConfig, ConfigModule } from '../../src/infra/config/index.js'

describe('boot-time env validation', () => {
  it('refuses to construct the module when DATABASE_URL is absent', async () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      await expect(Test.createTestingModule({ imports: [ConfigModule] }).compile()).rejects.toThrow(
        /DATABASE_URL/u,
      )
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved
    }
  })

  it('exposes AppConfig through AppModule, built from the validated environment', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    try {
      expect(moduleRef.get(AppConfig).databaseUrl).toBe(process.env.DATABASE_URL)
    } finally {
      await moduleRef.close()
    }
  })
})
