// pnpm demo:fixture          writes src/data/demo/fixture.json from the seed
// pnpm demo:fixture --check  exits 1 if the committed fixture is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDemoFixture, PATIENT_MIGRATION_FILE, SEED_FILE, serializeFixture } from './fixture-from-sql';

const root = join(__dirname, '..', '..');
const out = join(root, 'src/data/demo/fixture.json');

const json = serializeFixture(buildDemoFixture({
  seedSql: readFileSync(join(root, SEED_FILE), 'utf8'),
  patientMigrationSql: readFileSync(join(root, PATIENT_MIGRATION_FILE), 'utf8'),
}));

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(out, 'utf8'); } catch { /* missing counts as stale */ }
  if (current !== json) {
    console.error('src/data/demo/fixture.json is out of date with the seed. Run: pnpm demo:fixture');
    process.exit(1);
  }
  console.log('src/data/demo/fixture.json matches the seed.');
} else {
  writeFileSync(out, json);
  const t = JSON.parse(json).tables;
  console.log(`Wrote src/data/demo/fixture.json: ${Object.entries(t).map(([k, v]) => `${(v as unknown[]).length} ${k}`).join(', ')}`);
}
