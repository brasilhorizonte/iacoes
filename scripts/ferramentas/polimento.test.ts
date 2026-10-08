/**
 * Polimento da base (revisões de 07/10/2026): validate-html fora dos diretórios gitignored, JSON de
 * ranking/backtest só com a ferramenta `pronto` (+ aviso no do ranking), {n} da calculadora na
 * execução parcial, links do conteúdo para /{TICKER}/ e /airton/{T}/ e nome de empresa limpo.
 * Uso: npm run -s test:ferramentas (node:test via tsx). Sem rede.
 *
 * Os status das ferramentas mudam enquanto os autores trabalham: todo teste que depende de status
 * força o que precisa e devolve o original no fim (este arquivo roda em processo próprio).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bundleRefProblems, collectHTMLFiles, gitignoreMatcher } from '../validate-html';
import { dataJsonPublishable, generateFerramentas, valuationsInfo } from './index';
import { buildFatos, buildRanking, RANKING_AVISO, type DailyClose, type MonthlyRate } from './data';
import { buildToolModel, forbiddenHits, resolveHref, type RenderEnv } from './model';
import { renderToolPage } from './render';
import { bundleSources, WIDGETS_DIR } from './bundle';
import { DATA_JSON, TOOLS, toolById } from './registry';
import { PUBLICADAS_PATH, readPublished } from './site';
import type { CvmRow, QuoteRow, ToolContent, ToolId, ToolStatus } from './types';

const ROOT = join(__dirname, '..', '..');
const NOW = new Date('2026-10-06T23:00:00Z');
const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const silence = async <T>(fn: () => Promise<T>): Promise<T> => {
  const w = console.warn; const l = console.log;
  console.warn = () => {}; console.log = () => {};
  try { return await fn(); } finally { console.warn = w; console.log = l; }
};
/** Força status de ferramentas durante `fn` (os autores mudam o status enquanto trabalham). */
async function withStatus<T>(status: Partial<Record<ToolId, ToolStatus>>, fn: () => Promise<T>): Promise<T> {
  const orig = new Map(TOOLS.map((t) => [t.id, t.status]));
  for (const [id, s] of Object.entries(status) as [ToolId, ToolStatus][]) toolById(id).status = s;
  try { return await fn(); } finally { for (const t of TOOLS) t.status = orig.get(t.id)!; }
}

// ─── Dados sintéticos (forma real de brapi_quotes, cvm_documents e das séries) ──────

let seq = 0;
function q(symbol: string, o: Partial<QuoteRow> = {}): QuoteRow {
  seq += 1;
  return {
    symbol, price: 10 + (seq % 7), marketCap: 2e9 + seq * 1e8, pl: 4 + (seq % 13), pvp: 0.5 + (seq % 9) / 4,
    roePct: 5 + (seq % 25), sector: ['Financeiro', 'Utilidade Pública', 'Consumo Cíclico'][seq % 3],
    time: '2026-10-06T19:45:00+00:00', volume: 1e6 + seq * 1000, shortName: symbol, longName: `Empresa ${symbol} SA Pfd`, archived: false, ...o,
  };
}
function quotes(): QuoteRow[] {
  const out: QuoteRow[] = [];
  for (let i = 0; i < 80; i++) out.push(q(`A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}A3`));
  out.push(
    q('ITSA4', { shortName: 'ITSA4', longName: 'Itausa SA Non-Cum Perp Pfd Registered Shs' }),
    q('BPAC11', { shortName: 'BPAC11', longName: 'Banco BTG Pactual SA Units Cons of 1 Sh + 2 Pfd Shs A' }),
    q('CTKA4', { shortName: 'KARSTEN     ON', longName: 'Karsten S.A.Non-Cum Perp Pfd Registered Shs' }),
  );
  return out;
}
const divs = (qs: QuoteRow[]) => Object.fromEntries(qs.map((x, i) => [x.symbol, { divTTM: (x.price ?? 10) * (0.01 + (i % 9) / 100) }]));
const hasPage = () => true;
const cvmRow = (o: Partial<CvmRow>): CvmRow => ({
  ticker: 'PETR4', doc_type: 'FR', date: '2026-10-06', published_date: '2026-10-06', summary: 'Fato Relevante - Aquisição de ativos - Date 2026-10-06',
  ai_summary: 'A companhia comunicou ao mercado a aquisição de ativos de exploração, com pagamento em parcelas ao longo de dois anos.',
  link: 'https://www.rad.cvm.gov.br/doc/x', source_created_at: '2026-10-06T13:00:00Z', company_name: 'PETROLEO BRASILEIRO S.A. PETROBRAS', ...o,
});
const cvm = (): CvmRow[] => Array.from({ length: 6 }, (_, i) => cvmRow({ ticker: i ? `A${String.fromCharCode(65 + i)}AA3` : 'PETR4', link: `https://www.rad.cvm.gov.br/doc/${i}` }));
function bt(): { ibov: DailyClose[]; cdi: MonthlyRate[] } {
  const ibov: DailyClose[] = []; const cdi: MonthlyRate[] = [];
  let v = 17000;
  for (let y = 1999; y <= 2026; y++) for (let mo = 1; mo <= 12; mo++) {
    const m = `${y}-${String(mo).padStart(2, '0')}`;
    if (m < '1999-12' || m > '2026-10') continue;
    ibov.push({ date: `${m}-10`, close: Math.round(v * 99) / 100 });
    v *= 1.01;
    ibov.push({ date: `${m}-${mo === 2 ? '27' : '28'}`, close: Math.round(v * 100) / 100 });
    if (m >= '2000-01') cdi.push({ month: m, rate: m === '2026-10' ? 0.2 : 1 });
  }
  return { ibov, cdi };
}
const run = (outRoot: string, extra: Record<string, unknown> = {}) => silence(() => generateFerramentas({
  outRoot, fetch: false, now: NOW, stampLanding: false,
  data: { quotes: quotes(), cvm: cvm(), backtest: bt() },
  build: { valuations: divs(quotes()), hasPage, airton: new Set(['PETR4']) },
  ...extra,
}));

// ─── 1. validate-html: nada gitignored é varrido ─────────────────────────────────

test('validate-html: .gitignore — pasta em qualquer nível, padrão ancorado, glob e reinclusão (!)', () => {
  const ig = gitignoreMatcher('# prévias\npreview/\nnode_modules/\nscripts/ticker/.build/\n_bmad-output/specs/\nseo-audit-*.html\n*.log\n!guarda.log\n');
  assert.equal(ig('preview', true), true);
  assert.equal(ig('preview', false), false);                      // "dir/" só vale para pasta
  assert.equal(ig('a/b/preview', true), true);                     // sem '/' no meio: qualquer nível
  assert.equal(ig('scripts/ticker/.build', true), true);
  assert.equal(ig('outro/scripts/ticker/.build', true), false);    // com '/': ancorado na raiz
  assert.equal(ig('_bmad-output/specs', true), true);
  assert.equal(ig('_bmad-output/gsc', true), false);
  assert.equal(ig('seo-audit-2026.html', false), true);
  assert.equal(ig('erro.log', false), true);
  assert.equal(ig('guarda.log', false), false);                    // a última regra que casa decide
  assert.equal(ig('PETR4', true), false);
  assert.equal(ig('ferramentas', true), false);
});

test('validate-html: prévia (preview/) e outros diretórios gitignored ficam fora de TODAS as regras', () => {
  const dir = tmp('val-ignore-');
  try {
    // O .gitignore de verdade do repositório (preview/, node_modules/, .build/...).
    writeFileSync(join(dir, '.gitignore'), readFileSync(join(ROOT, '.gitignore'), 'utf-8'));
    const page = (rel: string, html = '<!DOCTYPE html><p>ok</p>') => { mkdirSync(join(dir, rel, '..'), { recursive: true }); writeFileSync(join(dir, rel), html); };
    page('index.html');
    page('PETR4/index.html');
    page('acoes/index.html');
    page('ferramentas/radar-de-oportunidades/index.html');
    // Prévia de outro agente: carrega um bundle que só existiria depois do build dela.
    const previa = '<script src="/preview/rev-infra/assets/js/ferramentas.js?v=1" defer></script>';
    page('preview/rev-infra/ferramentas/radar-de-oportunidades/index.html', previa);
    page('preview/index.html');
    page('node_modules/pacote/index.html');
    const files = collectHTMLFiles(dir).map((f) => f.slice(dir.length + 1).replace(/\\/g, '/')).sort();
    assert.deepEqual(files, ['PETR4/index.html', 'acoes/index.html', 'ferramentas/radar-de-oportunidades/index.html', 'index.html']);
    // Antes, a regra ferramentas-bundle reprovava essa prévia (e o npm test local saía com 1).
    assert.equal(bundleRefProblems(previa, (rel) => existsSync(join(dir, rel))).length, 1);
    // Sem .gitignore: nada ignorado (só as pastas fixas do gate).
    rmSync(join(dir, '.gitignore'));
    assert.ok(collectHTMLFiles(dir).some((f) => f.includes('preview')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // No próprio worktree: nenhuma página coletada sai de preview/ ou node_modules/.
  const real = collectHTMLFiles().map((f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'));
  assert.ok(real.includes('index.html'));
  assert.deepEqual(real.filter((f) => /^(preview|node_modules)\//.test(f)), []);
});

// ─── 2. JSON de ranking e backtest só com a ferramenta `pronto` ──────────────────

test('dataJsonPublishable: fatos sempre; ranking e backtest só `pronto` (na prévia, sempre)', () => {
  const tools = (r: ToolStatus, b: ToolStatus) => [{ id: 'ranking' as ToolId, status: r }, { id: 'backtest' as ToolId, status: b }];
  assert.equal(dataJsonPublishable('fatos', { tools: tools('rascunho', 'rascunho') }), true);
  assert.equal(dataJsonPublishable('ranking', { tools: tools('rascunho', 'pronto') }), false);
  assert.equal(dataJsonPublishable('backtest', { tools: tools('pronto', 'rascunho') }), false);
  assert.equal(dataJsonPublishable('ranking', { tools: tools('pronto', 'rascunho') }), true);
  assert.equal(dataJsonPublishable('backtest', { tools: tools('rascunho', 'pronto') }), true);
  assert.equal(dataJsonPublishable('ranking', { tools: tools('rascunho', 'rascunho'), includeDrafts: true }), true);
  assert.equal(dataJsonPublishable('backtest', { tools: tools('rascunho', 'rascunho'), includeDrafts: true }), true);
});

test('generateFerramentas: ranking e backtest em rascunho não gravam dados.json na raiz nem entram no publicadas.json; fatos sai sempre', async () => {
  const dir = tmp('ferr-json-rasc-');
  const prev = tmp('ferr-json-prev-');
  try {
    await withStatus({ ranking: 'rascunho', backtest: 'rascunho' }, async () => {
      await run(dir);
      assert.ok(!existsSync(join(dir, DATA_JSON.ranking)), 'ranking em rascunho: sem dados.json na raiz');
      assert.ok(!existsSync(join(dir, DATA_JSON.backtest)), 'backtest em rascunho: sem dados.json na raiz');
      assert.ok(existsSync(join(dir, DATA_JSON.fatos)), 'fatos sai sempre (a landing usa)');
      const pub = readPublished(dir)!;
      assert.deepEqual(pub.data, { fatos: DATA_JSON.fatos });
      assert.ok(!pub.ids.includes('ranking') && !pub.ids.includes('backtest'));
      assert.ok(!JSON.stringify(readFileSync(join(dir, PUBLICADAS_PATH), 'utf-8')).includes('ranking-de-acoes/dados.json'));
      // Prévia (com rascunhos): os JSONs continuam saindo e entram no publicadas.json da prévia.
      await run(prev, { siteRoot: dir, basePath: '/preview/x', includeDrafts: true });
      assert.ok(existsSync(join(prev, DATA_JSON.ranking)) && existsSync(join(prev, DATA_JSON.backtest)));
      assert.deepEqual(readPublished(prev)!.data, { ranking: `/preview/x${DATA_JSON.ranking}`, fatos: `/preview/x${DATA_JSON.fatos}`, backtest: `/preview/x${DATA_JSON.backtest}` });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(prev, { recursive: true, force: true });
  }
});

test('generateFerramentas: com ranking e backtest `pronto`, os JSONs vão para a raiz e para o publicadas.json; o do ranking leva o aviso', async () => {
  const dir = tmp('ferr-json-pronto-');
  try {
    await withStatus({ ranking: 'pronto', backtest: 'pronto' }, async () => {
      await run(dir);
      const pub = readPublished(dir)!;
      assert.deepEqual(pub.data, { ranking: DATA_JSON.ranking, fatos: DATA_JSON.fatos, backtest: DATA_JSON.backtest });
      const r = JSON.parse(readFileSync(join(dir, DATA_JSON.ranking), 'utf-8'));
      assert.equal(r.aviso, RANKING_AVISO);
      assert.equal(Object.keys(r).at(-1), 'aviso', 'campo novo no fim (formato só cresce)');
      assert.equal(JSON.parse(readFileSync(join(dir, DATA_JSON.backtest), 'utf-8')).updated, '2026-09-28');
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ranking: aviso "não é recomendação" no JSON (SPEC-v2 §B3), sem termo proibido', () => {
  assert.equal(RANKING_AVISO, 'Ordenação por indicador objetivo, não é recomendação de investimento.');
  const { data } = buildRanking(quotes(), Object.fromEntries(Object.entries(divs(quotes())).map(([k, v]) => [k, { divTTM: v.divTTM }])), { hasPage });
  assert.equal(data.aviso, RANKING_AVISO);
  assert.deepEqual(forbiddenHits(RANKING_AVISO, 'ranking'), []);
  assert.deepEqual(forbiddenHits(RANKING_AVISO, 'page'), []);
});

// ─── 3. {n} da calculadora na execução parcial ───────────────────────────────────

test('valuationsInfo: {n} = total do valuations.json mesclado (execução parcial), não os papéis da execução', () => {
  const dir = tmp('ferr-val-');
  try {
    // Execução `generate-pages.ts PETR4`: 1 papel nesta execução, 335 no arquivo mesclado.
    assert.deepEqual(valuationsInfo(dir, { valuations: { PETR4: { divTTM: 3 } }, valuationsCount: 335, quoteDate: '2026-10-06' }), { date: '2026-10-06', dateBR: '06/10/2026', n: 335 });
    // Sem a contagem (chamadas antigas): as chaves de `valuations`, como antes.
    assert.equal(valuationsInfo(dir, { valuations: { PETR4: { divTTM: 3 } }, quoteDate: '2026-10-06' })!.n, 1);
    assert.equal(valuationsInfo(dir, { valuations: { PETR4: { divTTM: 3 } }, valuationsCount: 0, quoteDate: '2026-10-06' })!.n, 1);
    // Sem nada no build: o arquivo no disco.
    writeFileSync(join(dir, 'valuations.json'), JSON.stringify({ _quoteDate: '2026-10-05', PETR4: {}, VALE3: {}, WEGE3: {} }));
    assert.deepEqual(valuationsInfo(dir), { date: '2026-10-05', dateBR: '05/10/2026', n: 3 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── 7. Links do texto rico para /{TICKER}/ e /airton/{T}/ ───────────────────────

test('resolveHref: /{TICKER}/ e /airton/{T}/ só com a página no disco (env.pages); sem env.pages, como antes', () => {
  const base = { published: new Set<ToolId>(), macroPage: false, basePath: '' };
  const pages = { ticker: (t: string) => t === 'PETR4', airton: (t: string) => t === 'PETR4' };
  assert.equal(resolveHref('/PETR4/', { ...base, pages }), '/PETR4/');
  assert.equal(resolveHref('/PETR4/#dividendos', { ...base, pages }), '/PETR4/#dividendos');
  assert.equal(resolveHref('/XPTO3/', { ...base, pages }), null);
  assert.equal(resolveHref('/airton/PETR4/', { ...base, pages }), '/airton/PETR4/');
  assert.equal(resolveHref('/airton/VALE3/', { ...base, pages }), null);
  assert.equal(resolveHref('/airton/', { ...base, pages }), '/airton/');          // a página do AIrton existe sempre
  assert.equal(resolveHref('/acoes/', { ...base, pages }), '/acoes/');
  // Sem env.pages (testes dos autores, rascunho fora do build): o link fica.
  assert.equal(resolveHref('/XPTO3/', base), '/XPTO3/');
  assert.equal(resolveHref('/airton/VALE3/', base), '/airton/VALE3/');
});

test('texto rico: link para ticker sem página vira texto (render e gerador passam env.pages)', async () => {
  const radar = toolById('radar');
  const original = radar.sections;
  const texto = 'Veja [PETR4](/PETR4/), [XPTO3](/XPTO3/), [o AIrton de PETR4](/airton/PETR4/) e [o de VALE3](/airton/VALE3/).';
  const comLinks: ToolContent = { ...radar, sections: [...original, { id: 'links-teste', title: 'Links', blocks: [{ type: 'p', text: texto }] }] };
  const env: RenderEnv = {
    published: new Set(TOOLS.filter((t) => t.status === 'pronto').map((t) => t.id)), macroPage: false, basePath: '',
    assets: { js: null, css: null }, ranking: null, fatos: null,
    pages: { ticker: (t) => t === 'PETR4', airton: (t) => t === 'PETR4' },
  };
  const secao = (html: string) => (html.split('id="links-teste"')[1] || '').split('</section>')[0];
  const s = secao(renderToolPage(buildToolModel(comLinks, env)));
  assert.match(s, /<a href="\/PETR4\/"[^>]*>PETR4<\/a>/);
  assert.match(s, /<a href="\/airton\/PETR4\/"[^>]*>o AIrton de PETR4<\/a>/);
  assert.doesNotMatch(s, /href="\/XPTO3\/"|href="\/airton\/VALE3\/"/);
  assert.match(s, /XPTO3/);
  assert.match(s, /o de VALE3/);
  // O gerador passa as páginas do build (hasPage e /airton/ do disco) para o conteúdo.
  const dir = tmp('ferr-links-tk-');
  try {
    radar.sections = comLinks.sections;
    await silence(() => generateFerramentas({
      outRoot: dir, fetch: false, now: NOW, stampLanding: false,
      data: { quotes: quotes(), cvm: cvm(), backtest: bt() },
      build: { valuations: divs(quotes()), hasPage: (t) => t === 'PETR4', airton: new Set(['PETR4']) },
    }));
    const g = secao(readFileSync(join(dir, 'ferramentas', radar.slug, 'index.html'), 'utf-8'));
    assert.match(g, /href="\/PETR4\/"/);
    assert.match(g, /href="\/airton\/PETR4\/"/);
    assert.doesNotMatch(g, /href="\/XPTO3\/"|href="\/airton\/VALE3\/"/);
  } finally {
    radar.sections = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── 5. Nome de empresa limpo no ranking e nos fatos ─────────────────────────────

test('ranking e fatos: nome de empresa limpo (scripts/lib/company-name.ts), não o long_name cru da brapi', () => {
  const qs = quotes();
  const { data } = buildRanking(qs, Object.fromEntries(Object.entries(divs(qs)).map(([k, v]) => [k, { divTTM: v.divTTM }])), { hasPage });
  const nome = (t: string) => data.rows.find((r) => r.t === t)!.name;
  assert.equal(nome('ITSA4'), 'Itausa');
  assert.equal(nome('BPAC11'), 'Banco BTG Pactual');
  assert.equal(nome('CTKA4'), 'Karsten');
  assert.equal(nome('AAAA3'), 'Empresa AAAA3');
  for (const r of data.rows) assert.doesNotMatch(r.name, /\b(Pfd|Shs|Units?|Non-Cum|Registered)\b|\sSA$/, `${r.t}: ${r.name}`);
  // Fatos: nome da brapi (já limpo pelo gerador) e, sem ele, o da CVM limpo.
  const look = { page: () => true, airton: () => false, known: ['PETR4'] };
  const f = buildFatos(cvm(), { ...look, names: new Map([['PETR4', 'Petroleo Brasileiro']]), now: NOW });
  assert.equal(f.items.find((i) => i.t === 'PETR4')!.name, 'Petroleo Brasileiro');
  const semNome = buildFatos([cvmRow({ company_name: 'BCO BTG PACTUAL S.A.' })], { ...look, names: new Map(), now: NOW });
  assert.equal(semNome.items[0].name, 'BCO BTG PACTUAL');
});

// ─── 4. Altura reservada do Radar na página (sem CLS no celular) ─────────────────

test('Radar na página: a cascata de min-height do radar.css cobre a altura medida no Chrome (montagem e troca de lista)', () => {
  const css = readFileSync(join(WIDGETS_DIR, 'radar.css'), 'utf-8');
  const base = /^\[data-ia-widget="radar"\]\[data-size="page"\] \{ min-height: (\d+)px; \}/m.exec(css);
  assert.ok(base, 'reserva base do quadro da página');
  const faixas = [...css.matchAll(/@media \(max-width: (\d+)px\) \{ \[data-ia-widget="radar"\]\[data-size="page"\] \{ min-height: (\d+)px; \} \}/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
  assert.ok(faixas.length >= 10, `faixas por largura (${faixas.length})`);
  // Cascata como o navegador aplica: a base e, na ordem do arquivo, toda faixa que inclui a largura.
  const reserva = (w: number) => faixas.reduce((h, [max, px]) => (w <= max ? px : h), Number(base![1]));
  // Maior altura entre as 6 listas, medida no Chrome (07/10/2026, DM Sans, sem barra de rolagem).
  const medido: [number, number][] = [[300, 513], [305, 513], [314, 496], [320, 479], [346, 479], [360, 461], [371, 461], [375, 447], [380, 447], [390, 423],
    [393, 423], [400, 409], [401, 609], [412, 609], [414, 609], [430, 590], [433, 590], [450, 574], [463, 574], [480, 559], [500, 540], [540, 524], [639, 506],
    [640, 524], [641, 427], [768, 408], [800, 392], [1000, 388], [1024, 443], [1100, 427], [1280, 408], [1440, 408]];
  for (const [w, h] of medido) {
    assert.ok(reserva(w) >= h, `${w}px: reserva ${reserva(w)} < ${h} medido (o conteúdo abaixo pularia)`);
    assert.ok(reserva(w) - h <= 40, `${w}px: reserva ${reserva(w)} sobra ${reserva(w) - h} px em branco`);
  }
  // A reserva vai para o bundle (CSS bloqueante nas páginas de ferramenta) e não toca nos tiles da landing.
  assert.match(bundleSources(undefined, { minify: true }).css, /\[data-ia-widget="radar"\]\[data-size="page"\]\{min-height: ?609px\}/);
  assert.doesNotMatch(css, /data-size="tile"\]\s*\{\s*min-height/);
});
