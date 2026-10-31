import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const blueprint = await read('render.yaml');
const manifest = JSON.parse(await read('package.json'));
const api = JSON.parse(await read('apps/api/package.json'));
const workspace = await read('pnpm-workspace.yaml');
const example = await read('apps/api/.env.example');

// Contrato estatico del formato simple del Blueprint; no ejecuta build, red ni SQL.
const field = (name) => blueprint.match(new RegExp(`^    ${name}: (.+)$`, 'm'))?.[1];
const env = new Map([...blueprint.matchAll(
  /^      - key: (\w+)\r?\n        (value|sync): (.+)$/gm,
)].map(([, key, kind, value]) => [key, { kind, value: value.replace(/^"|"$/g, '') }]));

test('API nativa desde raiz, plan free y despliegue manual con liveness publica', () => {
  assert.match(blueprint, /^services:\r?\n  - type: web$/m);
  assert.equal((blueprint.match(/^  - type:/gm) ?? []).length, 1);
  assert.equal(field('runtime'), 'node');
  assert.equal(field('plan'), 'free');
  assert.equal(field('autoDeployTrigger'), 'off');
  assert.equal(field('rootDir'), undefined);
  assert.equal(field('startCommand'), 'node apps/api/dist/main.js');
  assert.equal(field('healthCheckPath'), '/api/v1/health');
  assert.doesNotMatch(blueprint, /^\s*(docker\w*|databases|disk|preDeployCommand|initialDeployHook):/m);
});

test('build reproducible conserva herramientas de build y dependencias nativas', () => {
  assert.equal(manifest.packageManager, 'pnpm@10.34.7');
  assert.equal(field('buildCommand'), `corepack enable && corepack prepare ${manifest.packageManager} --activate && pnpm install --frozen-lockfile --prod=false && pnpm --filter ${api.name} build`);
  assert.ok(api.dependencies.argon2);
  assert.match(workspace, /onlyBuiltDependencies:\s*\n\s*- argon2/);
  assert.deepEqual(env.get('NODE_VERSION'), { kind: 'value', value: '24' });
  assert.deepEqual(env.get('NODE_ENV'), { kind: 'value', value: 'production' });
});

test('secretos y destinos reales se completan fuera del repositorio; puerto del proveedor', () => {
  for (const key of ['JWT_SECRET', 'DB_PASSWORD', 'FRONTEND_ORIGIN', 'DB_SERVER', 'DB_NAME', 'DB_USER']) {
    assert.deepEqual(env.get(key), { kind: 'sync', value: 'false' }, key);
  }
  assert.equal(env.has('PORT'), false);
  assert.equal(env.has('API_PORT'), false);
  assert.equal(env.has('VITE_API_URL'), false);
  assert.equal((blueprint.match(/^      - key:/gm) ?? []).length, env.size);
});

test('TLS verificado y presupuestos SQL coinciden con defaults documentados', () => {
  for (const [key, value] of Object.entries({
    DB_PORT: '1433', DB_ENCRYPT: 'true', DB_TRUST_SERVER_CERTIFICATE: 'false',
    DB_CONNECTION_TIMEOUT_MS: '60000', DB_REQUEST_TIMEOUT_MS: '60000', JWT_EXPIRES_IN: '1h',
  })) {
    assert.deepEqual(env.get(key), { kind: 'value', value }, key);
    assert.match(example, new RegExp(`^${key}=${value}$`, 'm'));
  }
});
