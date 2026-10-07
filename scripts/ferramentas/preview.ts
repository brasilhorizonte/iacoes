/**
 * Prévia LOCAL das páginas /ferramentas/, inclusive as em rascunho (com noindex e faixa de aviso).
 * Escreve só em ./preview/ (no .gitignore): ferramentas/, ferramentas/publicadas.json, os dados.json
 * e o bundle (assets/js/ferramentas*.js, assets/css/ferramentas*.css). Não mexe em sitemap,
 * llms.txt, index.html nem nas páginas publicadas.
 *
 * Uso: npm run preview:ferramentas                 →  preview/ (abra /preview/ferramentas/)
 *      npm run preview:ferramentas -- --id markowitz →  preview/markowitz/ (abra /preview/markowitz/ferramentas/)
 *      npm run preview:ferramentas -- --prontas      (só as ferramentas prontas, como em produção)
 *      npm run preview:ferramentas -- --offline      (sem Supabase: ranking, fatos e backtest ficam de fora)
 * Depois: npx serve . (na raiz do worktree).
 * Com SUPABASE_URL/SUPABASE_ANON_KEY no .env, ranking, fatos e backtest usam dado real (leitura
 * anon); os proventos vêm do valuations.json da raiz (último build).
 */
import 'dotenv/config';
import { join } from 'path';
import { generateFerramentas } from './index';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}

async function main() {
  const root = join(__dirname, '..', '..');
  const id = arg('--id');
  if (id !== null && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error(`--id inválido: ${id} (use letras minúsculas, números e hífen)`);
  const offline = process.argv.includes('--offline') || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;
  const outRoot = id ? join(root, 'preview', id) : join(root, 'preview');
  const basePath = id ? `/preview/${id}` : '/preview';
  const entries = await generateFerramentas({
    outRoot,
    siteRoot: root,
    basePath,
    includeDrafts: !process.argv.includes('--prontas'),
    stampLanding: false,
    fetch: !offline,
  });
  console.log(`  ✓ prévia em ${basePath.slice(1)}/ferramentas/ (${entries.length} entradas de sitemap em produção: ${entries.map((e) => e.loc.replace('https://iacoes.com.br', '')).join(', ')})`);
  console.log(`    sirva a raiz (npx serve .) e abra ${basePath}/ferramentas/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
