import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const personalitiesPath = resolve(root, '../backend/src/main/resources/data/personalities.json');
const publicDir = resolve(root, 'public');
const personalities = JSON.parse(readFileSync(personalitiesPath, 'utf8'));

const errors = [];
const women = personalities.filter((personality) => personality.representation === 'female');

for (const personality of women) {
  const imagePath = personality.imagePath?.trim();

  if (!imagePath) {
    errors.push(`${personality.id}: imagePath ausente`);
    continue;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    errors.push(`${personality.id}: retrato remoto não permitido (${imagePath})`);
    continue;
  }

  const normalized = imagePath.replace(/^\/+/, '').replace(/^public\//, '');
  const assetPath = resolve(publicDir, normalized);

  if (!existsSync(assetPath)) {
    errors.push(`${personality.id}: asset não encontrado em frontend/public/${normalized}`);
  }
}

if (errors.length > 0) {
  console.error('Falha na validação dos retratos femininos:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: ${women.length} retratos femininos locais encontrados.`);
