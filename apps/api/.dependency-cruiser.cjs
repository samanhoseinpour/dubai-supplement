/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-internals',
      comment: 'modules/A may import modules/B/index.ts and nothing deeper (§5.3)',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/(?!index\\.ts)', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'domain-is-pure',
      comment: 'domain/** is plain TypeScript: no framework, no driver (§5.3)',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: 'node_modules/(@nestjs|drizzle-orm|pg|ioredis)/' },
    },
    {
      name: 'application-uses-ports',
      comment: 'only the module file wires ports to adapters (§5.3)',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/infrastructure/' },
    },
    {
      name: 'shared-and-infra-are-leaves',
      comment: 'shared/** and infra/** never import modules/** (§5.3)',
      severity: 'error',
      from: { path: '^src/(shared|infra)/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}
