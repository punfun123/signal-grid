import { build } from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDisabledGridRoute } from '../shared/grid-profile.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = join(root, 'api');
const output = join(root, '.vercel', 'output');
const apiFunction = join(output, 'functions', '__grid_api.func');
const middlewareFunction = join(output, 'functions', 'middleware.func');
const routeExports = /^export\s+(?:default\b|\{\s*default\s*\}|(?:async\s+)?function\s+(?:GET|POST|OPTIONS|HEAD|PATCH|PUT|DELETE)\b)/m;
const routes = [];

for (const file of await readdir(apiRoot, { recursive: true, withFileTypes: true })) {
  if (!file.isFile() || file.name.startsWith('_') || /(?:\.d|\.test)\.[cm]?[jt]s$/.test(file.name)) continue;
  if (!/\.[cm]?[jt]s$/.test(file.name)) continue;

  const fullPath = join(file.parentPath, file.name);
  const modulePath = relative(root, fullPath).replaceAll('\\', '/');
  const routePath = '/' + modulePath.replace(/\.[^.]+$/, '').replace(/\/index$/, '');
  if (isDisabledGridRoute(routePath)) continue;
  if (!routeExports.test(await readFile(fullPath, 'utf8'))) continue;
  routes.push({ routePath, modulePath });
}
routes.sort((a, b) => a.routePath.localeCompare(b.routePath));

const manifest = routes.map(({ routePath, modulePath }) => {
  return `[${JSON.stringify(routePath)}, () => import(${JSON.stringify('./' + modulePath)})]`;
}).join(',\n');

// Rebuild only the generated output directory. The project link remains in .vercel/.
await rm(output, { recursive: true, force: true });
await Promise.all([mkdir(apiFunction, { recursive: true }), mkdir(middlewareFunction, { recursive: true })]);
await Promise.all([
  build({
    stdin: {
      contents: `import { createVercelApiHandler } from './scripts/grid-vercel-api.mjs';\nexport default createVercelApiHandler([${manifest}]);`,
      sourcefile: 'grid-api.mjs',
      resolveDir: root,
    },
    absWorkingDir: root,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    splitting: true,
    minify: true,
    outdir: apiFunction,
    entryNames: 'index',
    chunkNames: 'chunks/[name]-[hash]',
    outExtension: { '.js': '.mjs' },
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  }),
  build({
    absWorkingDir: root,
    entryPoints: ['middleware.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    outfile: join(middlewareFunction, 'index.js'),
  }),
  cp(join(root, 'dist'), join(output, 'static'), { recursive: true }),
]);

// @vercel/og loads these assets relative to its bundled module at runtime.
const ogAssets = join(root, 'node_modules', '@vercel', 'og', 'dist');
await cp(ogAssets, join(apiFunction, 'chunks'), {
  recursive: true,
  filter: (path) => path === ogAssets || /\.(?:ttf|wasm)$/.test(path),
});

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

await Promise.all([
  writeJson(join(apiFunction, '.vc-config.json'), {
    runtime: 'nodejs24.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    supportsResponseStreaming: true,
    maxDuration: 60,
  }),
  writeJson(join(middlewareFunction, '.vc-config.json'), {
    runtime: 'edge',
    entrypoint: 'index.js',
  }),
]);

// The project-level redirects, headers, and rewrites in vercel.json still apply.
await writeJson(join(output, 'config.json'), {
  version: 3,
  routes: [
    {
      src: '^/(?:mcp/?|api(?:/.*)?|(?!(?:api|mcp)(?:/|$))(?!.*\\.[^/]+$).*)$',
      middlewarePath: 'middleware',
      continue: true,
      override: true,
    },
    { src: '^/__grid_api$', status: 404 },
    { src: '^/api/(.+)$', dest: '/__grid_api?__grid_path=$1' },
  ],
});
console.log(`Packaged ${routes.length} upstream API entry points into one Node.js function.`);
