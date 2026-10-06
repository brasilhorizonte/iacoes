/**
 * Páginas macro (/macro/ e /macro/indicador-de-buffett/) — geração no build diário.
 *
 * TRAVA DE PUBLICAÇÃO: só gera com MACRO_BUFFETT_ENABLED=true. Desligada, nada é escrito,
 * nada entra no sitemap e nenhum link interno aponta para cá — o site sai idêntico.
 *
 * Nunca derruba o build: dado velho, fora da faixa ou erro de rede viram aviso no log do
 * CI (::warning::) e a página anterior, se existir, continua no ar e no sitemap.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fetchBuffettData, headline, validate, type BuffettData } from './data';
import { buildBuffettModel, CSV_NAME, HUB_PATH, JSON_NAME, PAGE_PATH, type BuffettModel } from './model';
import { buildMacroCss, renderBuffettPage, renderMacroHub } from './render';

export const macroEnabled = (): boolean => process.env.MACRO_BUFFETT_ENABLED === 'true';

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

const warn = (msg: string) => console.warn(`::warning title=Página macro::${msg}`);
const SITE = 'https://iacoes.com.br';

function existingEntries(outRoot: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const [path, priority] of [[HUB_PATH, '0.7'], [PAGE_PATH, '0.85']] as const) {
    const file = join(outRoot, path, 'index.html');
    if (existsSync(file)) out.push({ loc: `${SITE}${path}`, lastmod: statSync(file).mtime.toISOString().slice(0, 10), changefreq: 'daily', priority });
  }
  return out;
}

export function llmsTxt(m: BuffettModel): string {
  return `# IAções
> Análise fundamentalista e valuation de ações da B3, da Brasil Horizonte: preço justo por Graham, Bazin, Gordon e DCF, sem conflito de interesse.

## Indicadores macro
- [Indicador de Buffett Brasil](${m.url}): valor de mercado das empresas listadas na B3 ÷ PIB de 12 meses. Hoje: ${m.v}% (fechamento oficial de ${m.dateBR}); média desde ${m.s.since}: ${m.s.mean}%; faixa histórica (p25–p75): ${m.s.p25}% a ${m.s.p75}%. Série mensal em CSV (CC BY 4.0): ${m.csvUrl}

## Ações
- [Todas as ações da B3](${SITE}/acoes/): preço justo e indicadores fundamentalistas de cada ação, atualizados todo dia útil.
- [AIrton](${SITE}/airton/): alertas de documentos da CVM com resumo por inteligência artificial.
`;
}

/**
 * Resumo público para a landing (e quem mais quiser): número do dia, régua histórica e a
 * série mensal com 1 casa. A landing só mostra a seção "A bolsa está cara?" quando este
 * arquivo existe — com a trava desligada ele não é gerado e a seção fica escondida, sem
 * link apontando para página que ainda não existe.
 */
export function resumoJson(m: BuffettModel): string {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const series: [string, number][] = m.monthly.map((p) => [p.date.slice(0, 7), r1(p.value)]);
  // O último ponto é sempre a manchete (fechamento oficial D-1), não o mensal da série.
  const month = m.h.date.slice(0, 7);
  if (series.length && series[series.length - 1][0] === month) series[series.length - 1][1] = r1(m.h.value);
  else series.push([month, r1(m.h.value)]);
  return JSON.stringify({
    value: m.h.value,
    date: m.h.date,
    dateBR: m.dateBR,
    band: m.faixa,
    percentile: m.percentile,
    since: m.s.since,
    mean: r1(m.stats.mean),
    p25: r1(m.stats.p25),
    p75: r1(m.stats.p75),
    min: { value: r1(m.stats.min.value), month: m.s.minMonth },
    max: { value: r1(m.stats.max.value), month: m.s.maxMonth },
    url: PAGE_PATH,
    series,
  });
}

/**
 * Gera as páginas macro em `outRoot` (raiz do site no build; outra pasta no preview).
 * Devolve as entradas do sitemap (vazio com a trava desligada).
 */
export async function generateMacro(opts: {
  outRoot: string;
  enabled?: boolean;
  data?: BuffettData;
}): Promise<SitemapEntry[]> {
  const enabled = opts.enabled ?? macroEnabled();
  if (!enabled) {
    console.log('📉 Páginas macro: trava ligada (MACRO_BUFFETT_ENABLED != true) — nada gerado');
    return [];
  }
  try {
    const data = opts.data ?? (await fetchBuffettData());
    let h = null;
    try { h = headline(data); } catch (e) { warn(String(e instanceof Error ? e.message : e)); }
    const { problems, warnings } = validate(data, h);
    warnings.forEach(warn);
    if (problems.length) {
      warn(`não regerada (a anterior continua no ar): ${problems.join('; ')}`);
      return existingEntries(opts.outRoot);
    }
    const m = buildBuffettModel(data);
    buildMacroCss();
    const pageDir = join(opts.outRoot, PAGE_PATH);
    mkdirSync(pageDir, { recursive: true });
    writeFileSync(join(opts.outRoot, HUB_PATH, 'index.html'), renderMacroHub(m), 'utf-8');
    writeFileSync(join(pageDir, 'index.html'), renderBuffettPage(m), 'utf-8');
    writeFileSync(join(pageDir, CSV_NAME), m.csv, 'utf-8');
    writeFileSync(join(pageDir, JSON_NAME), resumoJson(m), 'utf-8');
    writeFileSync(join(opts.outRoot, 'llms.txt'), llmsTxt(m), 'utf-8');
    console.log(`📉 Indicador de Buffett: ${m.v}% (fechamento oficial de ${m.dateBR}) — ${PAGE_PATH}, ${HUB_PATH}, CSV, ${JSON_NAME} e llms.txt gerados`);
    return [
      { loc: m.hubUrl, lastmod: m.h.date, changefreq: 'daily', priority: '0.7' },
      { loc: m.url, lastmod: m.h.date, changefreq: 'daily', priority: '0.85' },
    ];
  } catch (e) {
    warn(`erro ao gerar (a anterior continua no ar): ${e instanceof Error ? e.message : String(e)}`);
    return existingEntries(opts.outRoot);
  }
}
