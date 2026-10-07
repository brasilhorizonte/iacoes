/**
 * Prévia LOCAL das páginas /ferramentas/, inclusive as em rascunho (com noindex e faixa de aviso).
 * Escreve só em ./preview/ (no .gitignore): ferramentas/, assets/js/ferramentas.js e
 * assets/css/ferramentas.css. Não mexe em sitemap, llms.txt, index.html nem nas páginas publicadas.
 *
 * Uso: npm run preview:ferramentas  →  npx serve .  →  /preview/ferramentas/
 *      npm run preview:ferramentas -- --prontas   (só as ferramentas prontas, como em produção)
 *      npm run preview:ferramentas -- --offline   (sem Supabase: ranking e fatos ficam de fora)
 * Com SUPABASE_URL/SUPABASE_ANON_KEY no .env, ranking e fatos usam dado real (leitura anon);
 * os proventos vêm do valuations.json da raiz (último build).
 */
import 'dotenv/config';
import { join } from 'path';
import { generateFerramentas } from './index';

async function main() {
  const root = join(__dirname, '..', '..');
  const offline = process.argv.includes('--offline') || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;
  const entries = await generateFerramentas({
    outRoot: join(root, 'preview'),
    siteRoot: root,
    basePath: '/preview',
    includeDrafts: !process.argv.includes('--prontas'),
    stampLanding: false,
    fetch: !offline,
  });
  console.log(`  ✓ prévia em preview/ferramentas/ (${entries.length} entradas de sitemap em produção: ${entries.map((e) => e.loc.replace('https://iacoes.com.br', '')).join(', ')})`);
  console.log('    sirva a raiz (npx serve .) e abra /preview/ferramentas/');
}

main().catch((e) => { console.error(e); process.exit(1); });
