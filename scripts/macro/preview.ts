/**
 * Prévia LOCAL das páginas macro, ignorando a trava de publicação. Escreve em ./preview/
 * (no .gitignore), sem mexer em sitemap, índices nem nas páginas publicadas.
 * Uso: npx tsx scripts/macro/preview.ts  →  npx serve .  →  /preview/macro/indicador-de-buffett/
 */
import 'dotenv/config';
import { join } from 'path';
import { generateMacro } from './index';

async function main() {
  const root = join(__dirname, '..', '..');
  const entries = await generateMacro({ outRoot: join(root, 'preview'), enabled: true });
  console.log(entries.length ? '  ✓ prévia em preview/macro/ — sirva a raiz (npx serve .) e abra /preview/macro/indicador-de-buffett/' : '  ✗ nada gerado (ver avisos acima)');
}

main().catch((e) => { console.error(e); process.exit(1); });
