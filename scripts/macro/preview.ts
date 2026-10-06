/**
 * Prévia LOCAL das páginas macro, ignorando a trava de publicação. Escreve em ./preview/
 * (no .gitignore), sem mexer em sitemap, índices nem nas páginas publicadas.
 * Uso: npx tsx scripts/macro/preview.ts  →  npx serve .  →  /preview/macro/indicador-de-buffett/
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getAllTickersWithSector } from '../supabase';
import { generateMacro } from './index';

async function main() {
  const root = join(__dirname, '..', '..');
  const all = await getAllTickersWithSector();
  const valuationsPath = join(root, 'valuations.json');
  const valuations = existsSync(valuationsPath) ? JSON.parse(readFileSync(valuationsPath, 'utf-8')) : undefined;
  const entries = await generateMacro({ outRoot: join(root, 'preview'), all, valuations, enabled: true });
  console.log(entries.length ? '  ✓ prévia em preview/macro/ — sirva a raiz (npx serve .) e abra /preview/macro/indicador-de-buffett/' : '  ✗ nada gerado (ver avisos acima)');
}

main().catch((e) => { console.error(e); process.exit(1); });
