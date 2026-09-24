import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

// Foundation §7.1. Every flag here is binding; none reads the environment,
// so `next typegen` and `next build` load it identically.
const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
}

export default nextConfig
