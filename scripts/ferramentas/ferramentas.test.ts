/**
 * Testes das páginas /ferramentas/ (SPEC §3, §4 e §7). Uso: npm run test:ferramentas (node:test via tsx).
 * Sem rede: os dados são sintéticos (com a forma real de brapi_quotes e cvm_documents).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createContext, runInContext, Script } from 'node:vm';
import * as ts from 'typescript';
import { generateSitemap } from '../template';
import { macroLlmsSection } from '../macro';
import { appHref, appHrefsIn, nextPath, parseAppHref, SCREENS } from './links';
import { DATA_JSON, HUB, HUB_URL, TOOLS, ctaId, toolById, toolPath, toolUrl } from './registry';
import {
  buildHubModel, buildToolModel, forbiddenHits, publishProblems, rankingRows, resolveHref, seoProblems, structureProblems, toolText,
  type RenderEnv,
} from './model';
import { APP_HOME, renderHub, renderToolPage, withClicks, withTracks } from './render';
import {
  brtDate, brtTime, buildFatos, buildRanking, cvmTitle, parseTime, resolveDocPage, validateFatos, validateRanking,
} from './data';
import { bundleSources, hashOf, stampAssetVersions, writeBundle, WIDGETS_DIR } from './bundle';
import { composeLlmsTxt, ferramentasLlmsSection } from './llms';
import { generateFerramentas } from './index';
import type { CvmRow, FatosData, QuoteRow, RankingData, ToolId } from './types';

// ─── Dados sintéticos ─────────────────────────────────────────────────────

const NOW = new Date('2026-10-06T23:00:00Z');   // terça, 20h BRT (horário do cron)
const T_TODAY = '2026-10-06T19:45:00+00:00';

let seq = 0;
function q(symbol: string, o: Partial<QuoteRow> = {}): QuoteRow {
  seq += 1;
  return {
    symbol,
    price: 10 + (seq % 7),
    marketCap: 2e9 + seq * 1e8,
    pl: 4 + (seq % 13),
    pvp: 0.5 + (seq % 9) / 4,
    roePct: 5 + (seq % 25),
    sector: ['Financeiro', 'Utilidade Pública', 'Consumo Cíclico', 'Materiais Básicos'][seq % 4],
    time: T_TODAY,
    volume: 1e6 + seq * 1000,
    shortName: `Empresa ${symbol}`,
    longName: `Empresa ${symbol} S.A.`,
    archived: false,
    ...o,
  };
}

/** 90 papéis válidos (raízes AAA0..) + casos especiais. */
function quotesFixture(): QuoteRow[] {
  const out: QuoteRow[] = [];
  for (let i = 0; i < 90; i++) {
    const root = `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}A`;
    out.push(q(`${root}3`));
  }
  out.push(
    q('TAEE11', { volume: 5e6, price: 40, marketCap: 1.4e10 }),   // unit, a mais negociada em R$
    q('TAEE3', { volume: 1e6, price: 13, marketCap: 1.4e10 }),
    q('TAEE4', { volume: 2e6, price: 13, marketCap: 1.4e10 }),
    q('MSFT34', { marketCap: 5e12 }),                                // BDR: fora
    q('PEQN3', { marketCap: 5e8 }),                                  // micro cap: fora
    q('ARQV3', { archived: true }),                                  // arquivado: fora
    q('SEMP3'),                                                       // sem página: fora
    q('VELH3', { time: '2026-09-15T19:00:00Z' }),                    // cotação velha: fora
    q('FIIS11', { sector: 'Fundos Imobiliários' }),                  // FII: fora
    q('BIGD3', { price: 10, roePct: 300, pl: 0.05, pvp: -1 }),       // ROE absurdo, P/L ~0, P/VP negativo
    q('LATE3', { time: '2026-10-06T23:30:00Z' }),                    // 20h30 BRT: ainda é 06/10
    q('KLBN11', { volume: 8e6, price: 18, marketCap: null }),        // unit: brapi_quotes traz market_cap nulo
    q('KLBN4', { volume: 3e6, price: 3.7, marketCap: 2.3e10 }),
    q('SOLO11', { marketCap: null }),                                // unit sem classe irmã: valor de mercado desconhecido
  );
  return out;
}

const NO_PAGE = new Set(['SEMP3']);
const hasPage = (t: string) => !NO_PAGE.has(t);

function dividendsFixture(quotes: QuoteRow[]): Record<string, { divTTM: number }> {
  const d: Record<string, { divTTM: number }> = {};
  quotes.forEach((x, i) => { if (i % 5 !== 4) d[x.symbol] = { divTTM: (x.price ?? 10) * (0.01 + (i % 10) / 100) }; });
  d.TAEE11 = { divTTM: 4 };       // DY 10%
  d.BIGD3 = { divTTM: 7 };        // DY 70%: fora (provento extraordinário?)
  return d;
}

const cvmRow = (o: Partial<CvmRow>): CvmRow => ({
  ticker: 'DXCO3', doc_type: 'FR', date: '2026-10-06', published_date: '2026-10-06',
  summary: 'Fato Relevante - cisão parcial da Duratex Floresta Ltda., - Date 2026-10-06',
  ai_summary: '**A Dexco S.A.**, companhia negociada na B3 sob o ticker DXCO3, comunicou ao mercado a convocação de uma assembleia geral extraordinária para deliberar sobre a cisão parcial.',
  link: 'https://www.rad.cvm.gov.br/doc/1', source_created_at: '2026-10-06T10:00:07.72038+00:00', company_name: 'DEXCO S.A.',
  ...o,
});

function cvmFixture(): CvmRow[] {
  const rows: CvmRow[] = [cvmRow({})];
  for (let i = 2; i <= 9; i++) {
    rows.push(cvmRow({
      ticker: `A${String.fromCharCode(64 + i)}AA3`, doc_type: i % 2 ? 'CM' : 'PR',
      summary: `Comunicado ao Mercado - Aquisição de participação relevante ${i} - Date 2026-10-0${i % 6 + 1}`,
      date: `2026-10-0${i % 6 + 1}`, published_date: `2026-10-0${i % 6 + 1}`,
      link: `https://www.rad.cvm.gov.br/doc/${i}`, source_created_at: `2026-10-0${i % 6 + 1}T1${i}:30:00Z`,
    }));
  }
  rows.push(cvmRow({ doc_type: 'ITR', link: 'https://x/itr' }));                                   // ITR: fora
  rows.push(cvmRow({ link: 'https://www.rad.cvm.gov.br/doc/1' }));                                // link repetido: fora
  rows.push(cvmRow({ date: '2026-12-31', published_date: '2026-12-31', link: 'https://x/fut' })); // futuro: fora
  rows.push(cvmRow({ ai_summary: 'curto', link: 'https://x/curto' }));                            // resumo vazio: fora
  rows.push(cvmRow({ ticker: 'SEMP3', link: 'https://x/sem' }));                                   // sem página: fora
  return rows;
}

const AIRTON = new Set(['DXCO3', 'ABAA3']);
const look = { page: (t: string) => hasPage(t) && t !== 'DXCO4', airton: (t: string) => AIRTON.has(t), known: [...quotesFixture().map((x) => x.symbol), 'DXCO3'] };

const ranking: RankingData = buildRanking(quotesFixture(), dividendsFixture(quotesFixture()), { hasPage }).data;
const fatos: FatosData = buildFatos(cvmFixture(), { ...look, names: new Map([['DXCO3', 'Dexco']]), now: NOW });

function env(o: Partial<RenderEnv> = {}): RenderEnv {
  return {
    published: new Set(TOOLS.filter((t) => t.status === 'pronto').map((t) => t.id)),
    macroPage: false,
    basePath: '',
    assets: { js: '/assets/js/ferramentas.js?v=abc1234567', css: '/assets/css/ferramentas.css?v=def1234567' },
    ranking,
    fatos,
    ...o,
  };
}
const allEnv = () => env({ published: new Set(TOOLS.map((t) => t.id)) });

// ─── Helpers de HTML ──────────────────────────────────────────────────────

const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const ldBlocks = (html: string): any[] => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const ldOf = (html: string, type: string) => ldBlocks(html).find((o) => o['@type'] === type);
/** Texto visível (sem <style>/<script>, que não são texto) + JSON-LD. */
const pageText = (html: string) => {
  const ld = ldBlocks(html).map((o) => JSON.stringify(o)).join(' ');
  const body = html.replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ');
  return `${decode(body.replace(/<[^>]+>/g, ' '))} ${ld}`;
};
function visibleFaq(html: string): { q: string; a: string }[] {
  const faq = (html.split('id="faq"')[1] || '').split('</section>')[0];
  return [...faq.matchAll(/<details[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/summary><div[^>]*>([\s\S]*?)<\/div><\/details>/g)].map((m) => ({ q: decode(m[1]), a: decode(m[2]) }));
}

const SPEC: Record<ToolId, { slug: string; next: string }> = {
  markowitz: { slug: 'markowitz', next: '/?s=ialocador&t=optimization&_=' },
  backtest: { slug: 'backtest-de-carteira', next: '/?s=ialocador&t=portfolio&_=' },
  fatos: { slug: 'fatos-relevantes', next: '/?s=home&t=notificacoes&_=' },
  ranking: { slug: 'ranking-de-acoes', next: '/?s=ialocador&t=rankings&_=' },
  radar: { slug: 'radar-de-oportunidades', next: '/?s=ialocador&t=radar&_=' },
  nota: { slug: 'nota-qualitativa', next: '/?s=ianalista&t=score&_=' },
  tese: { slug: 'tese-de-investimento', next: '/?s=ianalista&t=validador&_=' },
  calc: { slug: 'calculadora-preco-justo', next: '/ativo/PETR4?tab=valuation&_=' },
  dcf: { slug: 'fluxo-de-caixa-descontado', next: '/?s=ianalista&t=valuai&_=' },
};

// ─── Registro e modelo ────────────────────────────────────────────────────

test('registro: as 9 ferramentas do SPEC, na ordem, com slug e id únicos', () => {
  assert.deepEqual(TOOLS.map((t) => t.id), ['markowitz', 'backtest', 'fatos', 'ranking', 'radar', 'nota', 'tese', 'calc', 'dcf']);
  for (const t of TOOLS) assert.equal(t.slug, SPEC[t.id].slug, t.id);
  assert.equal(new Set(TOOLS.map((t) => t.slug)).size, 9);
  for (const t of TOOLS) assert.deepEqual(structureProblems(t), [], t.id);
  assert.equal(toolUrl(toolById('radar')), 'https://iacoes.com.br/ferramentas/radar-de-oportunidades/');
  assert.equal(ctaId(toolById('radar')), 'tool-radar');
});

test('Radar é a referência pronta; toda ferramenta pronta passa nas regras de publicação', () => {
  const radar = toolById('radar');
  assert.equal(radar.status, 'pronto');
  assert.equal(radar.title, 'Radar de Ações: Distorções de Valuation e Triagem | IAções');
  assert.equal(radar.h1, 'Radar de oportunidades: a triagem automática das ações da B3');
  for (const t of TOOLS.filter((x) => x.status === 'pronto')) assert.deepEqual(publishProblems(t), [], t.id);
  // Rascunho é rascunho de verdade: o marcador TODO aparece e a regra de publicação reprova.
  for (const t of TOOLS.filter((x) => x.status === 'rascunho')) assert.ok(publishProblems(t).length > 0, t.id);
});

test('SEO: title ≤ 60 com " | IAções", description ≤ 155, H1 e frase-resposta (com os tokens de dado expandidos)', () => {
  for (const t of TOOLS) {
    const m = buildToolModel(t, allEnv());
    assert.deepEqual(seoProblems(m), [], t.id);
  }
  assert.deepEqual(seoProblems({ title: HUB.title, description: HUB.description, h1: HUB.h1 }), []);
  // Pior caso dos tokens: {n} com 4 dígitos e data com 10 caracteres.
  const big = { ...ranking, count: 1234 };
  for (const id of ['ranking', 'fatos'] as const) {
    const m = buildToolModel(toolById(id), env({ ranking: big, fatos: { ...fatos, count: 1234 }, published: new Set([id]) }));
    assert.deepEqual(seoProblems(m), [], id);
  }
});

test('Radar: conteúdo honesto (6 regras e nomes reais das listas, sem termos proibidos, sem tickers)', () => {
  const radar = toolById('radar');
  const text = toolText(radar);
  for (const nome of ['Oportunidades Claras', 'Reprecificação (Momentum)', 'Distorções de Valuation', 'PEG Ratio (< 1)', 'Small Caps Ignoradas', 'Riscos Elevados']) assert.ok(text.includes(nome), nome);
  assert.match(text, /6 regras fixas/);
  assert.match(text, /ROA/);                                   // o "ROIC" da tela é ROA
  assert.match(text, /não envia alertas/i);
  assert.doesNotMatch(text, /\b[A-Z]{4}(3|4|11)\b/);           // nenhum ticker real na página evergreen
  assert.deepEqual(forbiddenHits(text, 'radar'), []);
  // Alerta: só nos pagos, resumo diário (nunca "instantâneo").
  assert.doesNotMatch(text, /instantâne/i);
  assert.ok(radar.faq.length >= 6 && radar.faq.length <= 10);
});

test('termos proibidos: a regra pega o que deve pegar', () => {
  assert.ok(forbiddenHits('Compre agora', 'page').length);
  assert.ok(forbiddenHits('a melhores ações do ano', 'page').length);
  assert.ok(forbiddenHits('anomalias estatísticas', 'page').length);
  assert.ok(forbiddenHits('cobre todas as ações da B3', 'page').length);
  assert.ok(forbiddenHits('alertas grátis no WhatsApp', 'page').length);
  assert.ok(forbiddenHits('Testamos 1 milhão de carteiras', 'page').length);
  assert.ok(forbiddenHits('As ações mais baratas', 'ranking').length);
  assert.deepEqual(forbiddenHits('As ações mais baratas', 'page'), []);   // regra só do ranking
  assert.deepEqual(forbiddenHits('Não constitui recomendação de compra, venda ou manutenção de ativos', 'page'), []);
  // Marca aposentada montada em pedaços (o literal seria acusado pelo gate do validate-html).
  assert.ok(forbiddenHits(`plano ${'IAn' + 'alista'}`, 'page').length);
});

// ─── Deep links (SPEC §2) ─────────────────────────────────────────────────

test('deep link de cada ferramenta: formato do SPEC §2 e tela certa', () => {
  for (const t of TOOLS) {
    const href = appHref(t.cta.target);
    const p = parseAppHref(href);
    assert.ok(p.ok, `${t.id}: ${!p.ok && p.reason}`);
    assert.equal(p.ok && p.next, SPEC[t.id].next, t.id);
    assert.match(href, /^https:\/\/app\.brasilhorizonte\.com\.br\/authnew\?ref=iacoes&utm_medium=ferramentas&next=%2F/);
    assert.ok(href.endsWith('%26_%3D'), `${t.id}: next precisa terminar em &_=`);
  }
  assert.equal(nextPath(SCREENS.airton), '/?s=workspace&_=');
  assert.equal(nextPath({ kind: 'tool', s: 'ianalista', t: 'validador', ticker: 'PETR4', autorun: true }), '/?s=ianalista&t=validador&ticker=PETR4&autorun=1&_=');
  assert.ok(appHref(SCREENS.radar, { ref: 'iacoes-lp' }).includes('ref=iacoes-lp'));
});

test('deep link: formatos que quebram no app são recusados', () => {
  const enc = encodeURIComponent;
  const base = 'https://app.brasilhorizonte.com.br/authnew?ref=iacoes&next=';
  assert.equal(parseAppHref(`${base}${enc('/?s=ialocador&t=radar')}`).ok, false);           // sem &_=: o ref vira "radar?ref=…"
  assert.equal(parseAppHref(`${base}/?s=ialocador&t=radar&_=`).ok, false);                    // next sem codificar
  assert.equal(parseAppHref(`${base}${enc('/?s=ialocador&t=foo&_=')}`).ok, false);            // aba inexistente
  assert.equal(parseAppHref(`${base}${enc('/?s=ialocador&t=radar&intent=x&_=')}`).ok, false); // parâmetro que o app não lê
  assert.equal(parseAppHref(`${base}${enc('/ativo/PETR4?tab=foo&_=')}`).ok, false);
  assert.equal(parseAppHref('https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker=PETR4&intent=dcf').ok, false);
  assert.equal(parseAppHref('https://app.brasilhorizonte.com.br/?s=ialocador&t=radar').ok, false);
});

// ─── Render, JSON-LD e FAQ ────────────────────────────────────────────────

test('página do Radar: H1, canonical, OG/Twitter e JSON-LD (WebPage com speakable, Breadcrumb, FAQPage, WebApplication)', () => {
  const m = buildToolModel(toolById('radar'), env());
  const html = renderToolPage(m);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<h1 id="tool-title"[^>]*>Radar de oportunidades: a triagem automática das ações da B3<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/iacoes\.com\.br\/ferramentas\/radar-de-oportunidades\/">/);
  assert.match(html, /<meta property="og:title" content="Radar de Ações: Distorções de Valuation e Triagem">/);
  assert.match(html, /<meta name="twitter:image:alt" content="[^"]+">/);
  assert.match(html, /<meta name="robots" content="index, follow/);
  const page = ldOf(html, 'WebPage');
  assert.deepEqual(page.speakable.cssSelector, ['#tool-title', '#tool-resumo']);
  assert.equal(page.dateModified, '2026-10-06');            // revisão do conteúdo, nunca "hoje"
  const crumbs = ldOf(html, 'BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map((c: any) => c.item), ['https://iacoes.com.br/', HUB_URL, m.url]);
  const app = ldOf(html, 'WebApplication');
  assert.equal(app.applicationCategory, 'FinanceApplication');
  assert.equal(app.isAccessibleForFree, true);
  assert.deepEqual(app.offers, { '@type': 'Offer', price: '0', priceCurrency: 'BRL' });
  assert.equal(app.aggregateRating, undefined);              // nada de avaliação inventada
  assert.equal(ldOf(html, 'ItemList'), undefined);           // evergreen: sem lista de links
  assert.match(html, /id="tool-resumo"/);
  assert.match(html, /Exemplo ilustrativo/);
  assert.match(html, /data-ia-widget="radar" data-size="page"/);
  assert.match(html, /<script src="\/assets\/js\/ferramentas\.js\?v=abc1234567" defer><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/css\/ferramentas\.css\?v=def1234567">/);
  assert.match(html, /function _iaClick\(/);                 // head tracking compartilhado
  assert.match(html, /set\('utm_source'/);
});

test('FAQ visível == FAQPage do JSON-LD, em todas as páginas (prontas e rascunhos)', () => {
  for (const t of TOOLS) {
    const html = renderToolPage(buildToolModel(t, allEnv()));
    const visible = visibleFaq(html);
    const ld = ldOf(html, 'FAQPage').mainEntity.map((x: any) => ({ q: x.name, a: x.acceptedAnswer.text }));
    assert.equal(visible.length, t.faq.length, t.id);
    assert.deepEqual(visible, ld, t.id);
    assert.deepEqual(ld, t.faq.map((f) => ({ q: f.q, a: f.a })), t.id);
  }
});

test('nenhum termo proibido no HTML (texto e JSON-LD) de nenhuma página, nem no hub', () => {
  for (const t of TOOLS) {
    const html = renderToolPage(buildToolModel(t, allEnv()));
    assert.deepEqual(forbiddenHits(pageText(html), 'page'), [], t.id);
    assert.deepEqual(forbiddenHits(toolText(t), t.id), [], `${t.id} (regras próprias)`);
  }
  assert.deepEqual(forbiddenHits(pageText(renderHub(buildHubModel(allEnv()))), 'page'), []);
});

test('todo link para o app de toda página está no formato do SPEC e todo data-cta tem onclick logo antes', () => {
  for (const t of TOOLS) {
    const html = renderToolPage(buildToolModel(t, allEnv()));
    const hrefs = appHrefsIn(html);
    assert.ok(hrefs.length >= 5, t.id);   // nav (2), topo, fim, barra fixa, aviso legal
    for (const h of hrefs) { const p = parseAppHref(h); assert.ok(p.ok, `${t.id}: ${!p.ok && p.reason}`); }
    const ctas = [...html.matchAll(/data-cta="([^"]+)"/g)].map((m) => m[1]);
    for (const c of ctas) assert.ok(['nav-app', 'nav-assinar', 'disclaimer', `tool-${t.id}`, `tool-${t.id}-final`, `tool-${t.id}-sticky`].includes(c), `${t.id}: data-cta ${c}`);
    assert.ok(ctas.includes(`tool-${t.id}`) && ctas.includes(`tool-${t.id}-final`));
    assert.equal((html.match(/ data-cta="/g) || []).length, (html.match(/ onclick="_iaClick\(event\)" data-cta="/g) || []).length, t.id);
    assert.doesNotMatch(html, /href="[^"]*"[^>]*data-track="[^"]*"[^>]*data-cta=/);
  }
  const hub = renderHub(buildHubModel(allEnv()));
  for (const h of appHrefsIn(hub)) assert.ok(h === APP_HOME || parseAppHref(h).ok, h);
});

test('links internos: produção não linka rascunho; macro só com a página publicada', () => {
  const html = renderToolPage(buildToolModel(toolById('radar'), env()));
  for (const t of TOOLS.filter((x) => x.status !== 'pronto')) assert.ok(!html.includes(`href="${toolPath(t)}"`), `link para rascunho ${t.slug}`);
  assert.match(html, /href="\/acoes\/"/);
  assert.match(html, /fluxo de caixa descontado/);           // o texto fica, sem link
  assert.ok(!html.includes('href="/macro/indicador-de-buffett/"'));
  const withMacro = renderToolPage(buildToolModel(toolById('radar'), env({ macroPage: true })));
  assert.match(withMacro, /href="\/macro\/indicador-de-buffett\/"/);
  assert.equal(resolveHref('/ferramentas/markowitz/', { published: new Set(['radar']), macroPage: false, basePath: '' }), null);
  assert.equal(resolveHref('/ferramentas/radar-de-oportunidades/', { published: new Set(['radar']), macroPage: false, basePath: '/preview' }), '/preview/ferramentas/radar-de-oportunidades/');
  assert.equal(resolveHref('https://externo.com/', { published: new Set(), macroPage: false, basePath: '' }), null);
  // Link interno medido sem redirect: data-track ganha _iaTrack.
  assert.match(html, /onclick="_iaTrack\('cta_click','tool-radar-rel-[a-z0-9-]+'\)" data-track="/);
});

test('pós-processamento: onclick entra antes do data-cta; data-track vira _iaTrack', () => {
  assert.equal(withClicks('<a href="x" data-cta="y">'), '<a href="x" onclick="_iaClick(event)" data-cta="y">');
  assert.equal(withTracks('<a href="/x/" data-track="hub-x">'), `<a href="/x/" onclick="_iaTrack('cta_click','hub-x')" data-track="hub-x">`);
  assert.equal(withTracks('<a data-track="x\'); alert(1)//">'), '<a data-track="x\'); alert(1)//">');   // id fora do padrão não vira JS
});

test('página com dado real: data no texto, data-ref-date, dateModified do dado e ItemList só com URLs internas', () => {
  const m = buildToolModel(toolById('ranking'), allEnv());
  const html = renderToolPage(m);
  assert.match(m.answer, /06\/10\/2026/);
  assert.match(html, /data-ref-date="2026-10-06"/);
  assert.equal(ldOf(html, 'WebPage').dateModified, '2026-10-06');
  const list = ldOf(html, 'ItemList');
  assert.ok(list.itemListElement.length > 0);
  for (const it of list.itemListElement) assert.match(it.url, /^https:\/\/iacoes\.com\.br\/[A-Z0-9]+\/$/);
  assert.match(html, /data-src="\/ferramentas\/ranking-de-acoes\/dados\.json"/);
  const f = renderToolPage(buildToolModel(toolById('fatos'), allEnv()));
  for (const it of ldOf(f, 'ItemList').itemListElement) assert.match(it.url, /^https:\/\/iacoes\.com\.br\/(airton\/)?[A-Z0-9]+\/$/);
  assert.match(f, /gerados por IA/);
  // Sem o dado, a página com dado não é montada (a anterior continua).
  assert.throws(() => buildToolModel(toolById('ranking'), env({ ranking: null })));
});

test('prévia local não suja a analytics de produção (GA4, Pixel e iacoes_page_views desligados)', () => {
  const prod = renderToolPage(buildToolModel(toolById('radar'), env()));
  assert.match(prod, /googletagmanager\.com\/gtag\/js\?id=G-858T7GLTMJ/);
  assert.match(prod, /fbevents\.js/);
  assert.match(prod, /_iaB='https:\/\/[a-z0-9]+\.supabase\.co'/);
  for (const html of [renderToolPage(buildToolModel(toolById('radar'), env({ basePath: '/preview' }))), renderHub(buildHubModel(env({ basePath: '/preview' })))]) {
    assert.doesNotMatch(html, /googletagmanager|fbevents|fbq\('init'|supabase\.co'/);
    assert.match(html, /function _iaTrack\(/);       // o validate-html também varre preview/
    assert.match(html, /function _iaClick\(/);
    assert.match(html, /set\('utm_source'/);
  }
});

test('rascunho: noindex e faixa de aviso (só existe na prévia)', () => {
  const html = renderToolPage(buildToolModel(toolById('markowitz'), allEnv()));
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /Rascunho: esta página só existe na prévia local/);
});

test('hub: CollectionPage + BreadcrumbList, só ferramentas publicadas e as páginas do site', () => {
  const hub = renderHub(buildHubModel(env()));
  assert.match(hub, /<h1 id="hub-title"[^>]*>Ferramentas para analisar ações da B3<\/h1>/);
  const col = ldOf(hub, 'CollectionPage');
  assert.deepEqual(col.hasPart.map((p: any) => p.url), ['https://iacoes.com.br/ferramentas/radar-de-oportunidades/']);
  for (const it of col.mainEntity.itemListElement) assert.match(it.url, /^https:\/\/iacoes\.com\.br\//);
  assert.ok(ldOf(hub, 'BreadcrumbList'));
  assert.match(hub, /href="\/ferramentas\/radar-de-oportunidades\/"/);
  assert.match(hub, /href="\/airton\/"/);
  assert.match(hub, /href="\/acoes\/"/);
  assert.ok(!hub.includes('href="/ferramentas/markowitz/"'));
  assert.ok(!hub.includes('/assets/js/ferramentas.js'));    // o hub não tem widget
  const withMacro = renderHub(buildHubModel(env({ macroPage: true })));
  assert.match(withMacro, /href="\/macro\/indicador-de-buffett\/"/);
});

test('HTML sem regex quebrada por template literal (regra regex-escaping do validate-html)', () => {
  for (const html of [renderToolPage(buildToolModel(toolById('radar'), env())), renderHub(buildHubModel(env()))]) {
    assert.doesNotMatch(html, /\/[A-Za-z|]+\/\/[a-z]\.test/);
    assert.doesNotMatch(html, /\.replace\(\/\//);
    assert.doesNotMatch(html, /JSON\.stringify\(\{[^}]*\n/);
  }
});

// ─── Dados reais: ranking ─────────────────────────────────────────────────

test('ranking: universo (sem BDR, micro cap, arquivado, FII, sem página ou cotação velha), uma classe por empresa', () => {
  const { data, excluded } = buildRanking(quotesFixture(), dividendsFixture(quotesFixture()), { hasPage });
  const ts = data.rows.map((r) => r.t);
  for (const out of ['MSFT34', 'PEQN3', 'ARQV3', 'SEMP3', 'VELH3', 'FIIS11', 'TAEE3', 'TAEE4']) assert.ok(!ts.includes(out), out);
  assert.ok(ts.includes('TAEE11'));                          // a classe mais negociada em R$
  // Unit com market_cap nulo herda o valor de mercado da companhia (raiz) e disputa a vaga.
  assert.ok(ts.includes('KLBN11') && !ts.includes('KLBN4'), 'KLBN11 (unit mais negociada) no lugar de KLBN4');
  assert.equal(data.rows.find((r) => r.t === 'KLBN11')!.mcap, 2.3e10);
  assert.ok(!ts.includes('SOLO11'));                         // sem valor de mercado conhecido: fora
  assert.ok(ts.includes('LATE3'));
  assert.equal(data.date, '2026-10-06');                     // 23h30 UTC ainda é 06/10 em BRT
  assert.equal(data.dateBR, '06/10/2026');
  const taee = data.rows.find((r) => r.t === 'TAEE11')!;
  assert.equal(taee.dy, 0.1);
  const big = data.rows.find((r) => r.t === 'BIGD3')!;
  assert.equal(big.dy, null);                                // 70%: não publicado
  assert.equal(big.roe, null);                               // 300%: não publicado
  assert.ok(excluded.some((x) => x.t === 'BIGD3' && /DY/.test(x.reason)));
  assert.ok(excluded.some((x) => x.t === 'BIGD3' && /ROE/.test(x.reason)));
  assert.ok(!data.top.pl.includes('BIGD3'));                 // P/L 0,05 < 0,1
  assert.ok(!data.top.pvp.includes('BIGD3'));                // P/VP negativo
  const anyRow = data.rows.find((r) => r.roe !== null)!;
  assert.ok(anyRow.roe! < 1);                                // ROE em fração
});

test('ranking: ordem de cada aba e linhas para a página', () => {
  const val = (k: 'dy' | 'pl' | 'pvp' | 'roe') => rankingRows(ranking, k).map((r) => r[k] as number);
  const dy = val('dy');
  assert.equal(dy.length, 20);
  for (let i = 1; i < dy.length; i++) assert.ok(dy[i - 1] >= dy[i]);
  const pl = val('pl');
  for (let i = 1; i < pl.length; i++) assert.ok(pl[i - 1] <= pl[i]);
  assert.ok(pl.every((x) => x >= 0.1));
  const roe = val('roe');
  for (let i = 1; i < roe.length; i++) assert.ok(roe[i - 1] >= roe[i]);
  assert.equal(rankingRows(ranking, 'pvp', 5).length, 5);
  assert.ok(JSON.stringify(ranking).length < 60_000);        // leve para a landing
});

test('ranking: validação bloqueia dado incompleto ou velho', () => {
  assert.deepEqual(validateRanking(ranking, NOW).problems, []);
  assert.match(validateRanking({ ...ranking, count: 10, rows: ranking.rows.slice(0, 10) }, NOW).problems.join(), /mínimo 60/);
  assert.match(validateRanking({ ...ranking, rows: ranking.rows.map((r) => ({ ...r, dy: null })) }, NOW).problems.join(), /proventos/);
  assert.match(validateRanking(ranking, new Date('2026-10-20T12:00:00Z')).problems.join(), /dias/);
  assert.match(validateRanking({ ...ranking, top: { ...ranking.top, roe: [] } }, NOW).problems.join(), /aba roe/);
});

// ─── Dados reais: fatos relevantes ────────────────────────────────────────

test('fatos: só FR/CM/PR com resumo, sem repetido nem futuro, link interno e hora em BRT', () => {
  assert.equal(fatos.items.length, 9);
  assert.ok(fatos.items.every((i) => ['FR', 'CM', 'PR'].includes(i.type)));
  const dx = fatos.items.find((i) => i.t === 'DXCO3')!;
  assert.equal(dx.typeLabel, 'Fato Relevante');
  assert.equal(dx.title, 'Cisão parcial da Duratex Floresta Ltda.');
  assert.equal(dx.url, '/airton/DXCO3/');
  assert.equal(dx.time, '07:00');                            // 10:00 UTC = 07:00 BRT
  assert.equal(dx.name, 'Dexco');
  assert.ok(!dx.summary.includes('**'));
  assert.equal(fatos.updated, '2026-10-06');
  for (let i = 1; i < fatos.items.length; i++) assert.ok(fatos.items[i - 1].date >= fatos.items[i].date);
  assert.ok(fatos.items.every((i) => /^\/(airton\/)?[A-Z0-9]+\/$/.test(i.url)));
  assert.equal(fatos.items.find((i) => i.type === 'PR')!.typeLabel, 'Press Release');
});

test('fatos: página pela raiz do emissor, título cru limpo e validação', () => {
  assert.deepEqual(resolveDocPage('DXCO4', look), { t: 'DXCO3', url: '/airton/DXCO3/' });
  assert.deepEqual(resolveDocPage('ACAA4', { ...look, known: ['ACAA3'] }), { t: 'ACAA4', url: '/ACAA4/' });
  assert.equal(resolveDocPage('ZZZZ3', { page: () => false, airton: () => false, known: [] }), null);
  assert.equal(cvmTitle('Fato Relevante - - Date 2026-10-06', 'FR'), '');
  assert.equal(cvmTitle('Comunicado ao Mercado - Comunicado ao Mercado - Data 2026-10-06', 'CM'), '');
  assert.deepEqual(validateFatos(fatos, NOW).problems, []);
  assert.match(validateFatos({ ...fatos, count: 2, items: fatos.items.slice(0, 2) }, NOW).problems.join(), /mínimo 5/);
  assert.match(validateFatos(fatos, new Date('2026-10-20T12:00:00Z')).problems.join(), /dias/);
});

test('datas em BRT: fuso de São Paulo, sem depender da máquina', () => {
  assert.equal(brtDate(Date.parse('2026-10-07T02:30:00Z')), '2026-10-06');
  assert.equal(brtTime(Date.parse('2026-10-06T19:45:00Z')), '16:45');
  assert.equal(parseTime('2026-10-06 19:45:00'), Date.parse('2026-10-06T19:45:00Z'));
  assert.equal(parseTime(''), null);
});

// ─── Bundle dos widgets e runtime ─────────────────────────────────────────

test('bundle: runtime primeiro, cada widget isolado, hash estável e CSS junto', () => {
  const a = bundleSources();
  const b = bundleSources();
  assert.equal(hashOf(a.js), hashOf(b.js));
  assert.ok(a.widgets.includes('radar'));
  assert.ok(a.js.indexOf('window.IAFerr = {') < a.js.indexOf('/* --- widgets/radar.js --- */'));
  assert.match(a.js, /\/\* --- widgets\/radar\.js --- \*\/\n;\(function \(\) \{\ntry \{/);
  assert.match(a.css, /\.iaw-seal/);
  assert.match(a.css, /\.iaw-radar-card/);
  assert.doesNotThrow(() => new Script(a.js));               // JS válido
  const dir = mkdtempSync(join(tmpdir(), 'ferr-bundle-'));
  try {
    const r = writeBundle(dir);
    assert.equal(readFileSync(join(dir, 'assets', 'js', 'ferramentas.js'), 'utf-8'), a.js);
    assert.equal(r.jsHash, hashOf(a.js));
    assert.equal(r.jsUrl, `/assets/js/ferramentas.js?v=${r.jsHash}`);
    assert.equal(readFileSync(join(dir, 'assets', 'css', 'ferramentas.css'), 'utf-8'), a.css);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Construções de ES2015+ que não rodam inline em in-app browser antigo. */
function es5Violations(code: string): string[] {
  const sf = ts.createSourceFile('w.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out: string[] = [];
  const at = (n: ts.Node) => `linha ${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const visit = (n: ts.Node) => {
    if (ts.isArrowFunction(n)) out.push(`arrow function (${at(n)})`);
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(`template literal (${at(n)})`);
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) out.push(`class (${at(n)})`);
    if (ts.isVariableDeclarationList(n) && (n.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) out.push(`let/const (${at(n)})`);
    if (ts.isSpreadElement(n) || ts.isSpreadAssignment(n)) out.push(`spread (${at(n)})`);
    if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) out.push(`destructuring (${at(n)})`);
    if (ts.isForOfStatement(n)) out.push(`for…of (${at(n)})`);
    if (ts.isParameter(n) && n.initializer) out.push(`parâmetro com valor padrão (${at(n)})`);
    if (ts.isShorthandPropertyAssignment(n)) out.push(`propriedade abreviada (${at(n)})`);
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isExportAssignment(n)) out.push(`import/export (${at(n)})`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

test('widgets e runtime em JS puro ES5 (sem import/export, arrow, let/const, template literal)', () => {
  const files = readdirSync(WIDGETS_DIR).filter((f) => f.endsWith('.js'));
  assert.ok(files.includes('_runtime.js'));
  for (const f of files) assert.deepEqual(es5Violations(readFileSync(join(WIDGETS_DIR, f), 'utf-8')), [], f);
  assert.deepEqual(es5Violations(readFileSync(join(__dirname, 'page.client.js'), 'utf-8')), [], 'page.client.js');
});

test('landing: o ?v= do bundle é atualizado e o resto do HTML fica igual', () => {
  const html = '<link rel="stylesheet" href="/assets/css/ferramentas.css?v=0"><script src="/assets/js/ferramentas.js?v=old_1" defer></script><a href="/ferramentas/">x</a>';
  const out = stampAssetVersions(html, { jsHash: 'aaaa111111', cssHash: 'bbbb222222' });
  assert.equal(out, '<link rel="stylesheet" href="/assets/css/ferramentas.css?v=bbbb222222"><script src="/assets/js/ferramentas.js?v=aaaa111111" defer></script><a href="/ferramentas/">x</a>');
  assert.equal(stampAssetVersions('<p>sem bundle</p>', { jsHash: 'a', cssHash: 'b' }), '<p>sem bundle</p>');
});

// DOM mínimo para rodar o runtime e o widget de verdade num vm (sem jsdom).
class FakeNode {
  parent: FakeEl | null = null;
}
class FakeText extends FakeNode {
  constructor(public data: string) { super(); }
}
class FakeEl extends FakeNode {
  children: FakeNode[] = [];
  attrs: Record<string, string> = {};
  listeners: Record<string, Function[]> = {};
  style: Record<string, string> = {};
  raw: string | null = null;
  constructor(public tagName: string, public ns: string | null = null) { super(); }
  getAttribute(k: string) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); }
  removeAttribute(k: string) { delete this.attrs[k]; }
  get className() { return this.attrs.class || ''; }
  set className(v: string) { this.attrs.class = v; }
  appendChild(c: FakeNode) { c.parent = this; this.children.push(c); this.raw = null; return c; }
  contains(n: FakeNode | null): boolean { for (let p = n; p; p = p.parent) if (p === this) return true; return false; }
  addEventListener(t: string, f: Function) { (this.listeners[t] ||= []).push(f); }
  dispatch(t: string) { for (const f of this.listeners[t] || []) f({ type: t, currentTarget: this, target: this }); }
  get textContent(): string { return this.raw ?? this.children.map((c) => (c instanceof FakeText ? c.data : (c as FakeEl).textContent)).join(''); }
  set textContent(v: string) { this.children = []; this.raw = null; if (v) this.appendChild(new FakeText(v)); }
  get innerHTML(): string { return this.raw ?? this.children.map((c) => (c instanceof FakeText ? c.data : `<${(c as FakeEl).tagName}>`)).join(''); }
  set innerHTML(v: string) { this.children = []; this.raw = v || null; }
  all(): FakeEl[] { const out: FakeEl[] = []; const walk = (e: FakeEl) => { for (const c of e.children) if (c instanceof FakeEl) { out.push(c); walk(c); } }; walk(this); return out; }
  querySelectorAll(sel: string): FakeEl[] {
    if (sel === '[data-ia-widget]') return this.all().filter((e) => 'data-ia-widget' in e.attrs);
    throw new Error(`seletor não suportado no DOM de teste: ${sel}`);
  }
  querySelector(sel: string): FakeEl | null {
    if (sel === 'script[type="application/json"]') return this.all().find((e) => e.tagName === 'script' && e.attrs.type === 'application/json') ?? null;
    throw new Error(`seletor não suportado no DOM de teste: ${sel}`);
  }
}

function runtimeSandbox(o: { io?: boolean; reduced?: boolean } = {}) {
  const body = new FakeEl('body');
  const docListeners: Record<string, Function[]> = {};
  const document = {
    readyState: 'complete',
    hidden: false,
    body,
    createElement: (t: string) => new FakeEl(t),
    createElementNS: (ns: string, t: string) => new FakeEl(t, ns),
    createTextNode: (s: string) => new FakeText(s),
    querySelectorAll: (s: string) => body.querySelectorAll(s),
    addEventListener: (t: string, f: Function) => { (docListeners[t] ||= []).push(f); },
  };
  const observed: FakeEl[] = [];
  let ioCallback: Function | null = null;
  const frames: Function[] = [];
  const tracked: [string, string][] = [];
  const window: any = {
    console: { warn: () => {} },
    matchMedia: () => ({ matches: !!o.reduced, addEventListener: () => {} }),
    requestAnimationFrame: (f: Function) => { frames.push(f); return frames.length; },
    setTimeout: (f: Function) => { f(); return 0; },
    Promise,
    _iaTrack: (ev: string, id: string) => { tracked.push([ev, id]); },
  };
  if (o.io) window.IntersectionObserver = function (cb: Function) { ioCallback = cb; return { observe: (el: FakeEl) => observed.push(el), unobserve: () => {} }; };
  const ctx = createContext({ window, document });
  const flushFrames = (t: number) => { const fs = frames.splice(0); for (const f of fs) f(t); };
  return {
    window, document, body, ctx, observed, tracked,
    run: (code: string) => runInContext(code, ctx),
    intersect: (el: FakeEl, on: boolean) => ioCallback!([{ target: el, isIntersecting: on }]),
    setHidden: (h: boolean) => { document.hidden = h; for (const f of docListeners.visibilitychange || []) f(); },
    flushFrames,
  };
}

const RUNTIME = readFileSync(join(WIDGETS_DIR, '_runtime.js'), 'utf-8');
const tick = () => new Promise((r) => setImmediate(r));

test('runtime: monta, liga/desliga por visibilidade e IntersectionObserver, reduced motion e track único', async () => {
  const sb = runtimeSandbox({ io: true });
  const host = new FakeEl('div');
  host.setAttribute('data-ia-widget', 'teste');
  host.setAttribute('data-size', 'page');
  host.setAttribute('data-src', '/x.json');
  const cfg = new FakeEl('script'); cfg.setAttribute('type', 'application/json'); cfg.textContent = '{"a":1}';
  host.appendChild(cfg);
  sb.body.appendChild(host);
  const log: string[] = [];
  sb.window.__log = log;
  sb.run(RUNTIME);
  sb.run(`window.IAFerr.register('teste', function (el, ctx) {
    window.__ctx = ctx;
    return { start: function () { window.__log.push('start'); }, stop: function () { window.__log.push('stop'); } };
  });`);
  await tick();
  assert.equal(host.getAttribute('data-ia-state'), 'ok');
  const c = sb.window.__ctx;
  assert.equal(c.size, 'page');
  assert.equal(c.reduced, false);
  assert.equal(c.config.a, 1);
  assert.equal(c.src('/padrao.json'), '/x.json');
  assert.equal(c.fmt.pct(0.0677), '6,8%');
  assert.equal(c.fmt.brl(1234.5), 'R$ 1.234,50');
  assert.equal(c.fmt.date('2026-10-06'), '06/10/2026');
  assert.deepEqual(sb.observed, [host]);
  assert.deepEqual(log, []);                 // fora da tela: não anima
  sb.intersect(host, true);
  assert.deepEqual(log, ['start']);
  sb.setHidden(true);
  assert.deepEqual(log, ['start', 'stop']);  // aba escondida: para
  sb.setHidden(false);
  sb.intersect(host, false);
  assert.deepEqual(log, ['start', 'stop', 'start', 'stop']);
  c.track('teste'); c.track('teste');
  assert.deepEqual(sb.tracked, [['tool_interact', 'teste']]);
  // loop só roda com o widget ligado
  let n = 0;
  c.loop(() => { n++; });
  sb.flushFrames(16);
  assert.equal(n, 0);
  sb.intersect(host, true);
  sb.flushFrames(32);
  assert.equal(n, 1);

  const reduced = runtimeSandbox({ reduced: true });
  const h2 = new FakeEl('div'); h2.setAttribute('data-ia-widget', 'r'); reduced.body.appendChild(h2);
  reduced.run(RUNTIME);
  reduced.run(`window.IAFerr.register('r', function (el, ctx) { window.__r = ctx.reduced; window.__size = ctx.size; return { start: function () { window.__started = true; }, stop: function () {} }; });`);
  await tick();
  assert.equal(reduced.window.__r, true);
  assert.equal(reduced.window.__size, 'tile');
  assert.equal(reduced.window.__started, true);   // sem IntersectionObserver: liga direto
});

test('runtime: fetchJSON com cache por URL (um pedido só) e sem cache de erro', async () => {
  const sb = runtimeSandbox();
  const calls: string[] = [];
  let fail = true;
  sb.window.fetch = (url: string) => {
    calls.push(url);
    return Promise.resolve(fail ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ date: '2026-10-06' }) });
  };
  sb.run(RUNTIME);
  const IAFerr = sb.window.IAFerr;
  await assert.rejects(IAFerr.fetchJSON('/d.json'), /HTTP 500/);
  await tick();
  fail = false;
  const [a, b] = await Promise.all([IAFerr.fetchJSON('/d.json'), IAFerr.fetchJSON('/d.json')]);
  assert.equal(a.date, '2026-10-06');
  assert.equal(a, b);
  assert.deepEqual(calls, ['/d.json', '/d.json']);   // o erro não ficou em cache; o sucesso, sim
  delete sb.window.fetch;
});

test('runtime: factory com erro devolve o conteúdo do servidor; widget sem registro fica intacto', async () => {
  const sb = runtimeSandbox();
  const a = new FakeEl('div'); a.setAttribute('data-ia-widget', 'quebra'); a.innerHTML = 'conteúdo do servidor';
  const b = new FakeEl('div'); b.setAttribute('data-ia-widget', 'ausente'); b.innerHTML = 'fallback';
  sb.body.appendChild(a); sb.body.appendChild(b);
  sb.run(RUNTIME);
  sb.run(`window.IAFerr.register('quebra', function (el) { el.innerHTML = ''; throw new Error('x'); });`);
  await tick();
  assert.equal(a.getAttribute('data-ia-state'), 'erro');
  assert.equal(a.innerHTML, 'conteúdo do servidor');
  assert.equal(b.getAttribute('data-ia-state'), null);
  assert.equal(b.innerHTML, 'fallback');
});

test('widget radar: 6 listas com nomes reais, selo, sem ticker; clique mostra a regra e a sequência avança', async () => {
  const sb = runtimeSandbox({ io: true });
  const host = new FakeEl('div'); host.setAttribute('data-ia-widget', 'radar'); host.setAttribute('data-size', 'page'); host.innerHTML = 'fallback';
  sb.body.appendChild(host);
  sb.run(RUNTIME);
  sb.run(readFileSync(join(WIDGETS_DIR, 'radar.js'), 'utf-8'));
  await tick();
  assert.equal(host.getAttribute('data-ia-state'), 'ok');
  const all = host.all();
  const cards = all.filter((e) => /iaw-radar-card/.test(e.className));
  assert.equal(cards.length, 6);
  assert.deepEqual(cards.map((c) => c.attrs['aria-label'].split(':')[0]), ['Oportunidades Claras', 'Reprecificação (Momentum)', 'Distorções de Valuation', 'PEG Ratio (< 1)', 'Small Caps Ignoradas', 'Riscos Elevados']);
  const text = host.textContent;
  assert.match(text, /Exemplo ilustrativo/);
  assert.doesNotMatch(text, /\b[A-Z]{4}\d{1,2}\b/);           // nenhum ticker
  assert.doesNotMatch(text, /\d+ (ações|papéis) encontrad/);  // nenhuma contagem
  const rule = all.find((e) => e.className === 'iaw-radar-rule')!;
  assert.match(rule.textContent, /^Oportunidades Claras:/);
  // Oportunidades Claras acende as mesmas ações nas outras listas (convergência de sinais).
  assert.ok(all.filter((e) => /is-match/.test(e.className)).length >= 3);
  cards[5].dispatch('click');
  assert.equal(cards[5].getAttribute('aria-pressed'), 'true');
  assert.match(rule.textContent, /^Riscos Elevados: Dívida líquida\/EBITDA acima de 3,5/);
  assert.equal(rule.getAttribute('aria-live'), 'polite');      // escolha da pessoa é anunciada
  assert.deepEqual(sb.tracked, [['tool_interact', 'radar']]);
  // Sequência automática: liga em tela e avança depois da pausa do clique (6 s) + 1 passo (2,6 s).
  sb.intersect(host, true);
  for (let t = 0; t <= 9000; t += 50) sb.flushFrames(t);
  assert.notEqual(cards.findIndex((c) => c.getAttribute('aria-pressed') === 'true'), 5);
  assert.equal(rule.getAttribute('aria-live'), 'off');         // troca automática não é anunciada
  // Pausar
  const pause = all.find((e) => /iaw-radar-pause/.test(e.className))!;
  pause.dispatch('click');
  assert.equal(pause.getAttribute('aria-pressed'), 'true');
  const before = cards.findIndex((c) => c.getAttribute('aria-pressed') === 'true');
  for (let t = 9000; t <= 20000; t += 50) sb.flushFrames(t);
  assert.equal(cards.findIndex((c) => c.getAttribute('aria-pressed') === 'true'), before);

  // Tile (landing): nomes curtos, regra resumida e pausa compacta com rótulo acessível.
  const tile = runtimeSandbox({ io: true });
  const th = new FakeEl('div'); th.setAttribute('data-ia-widget', 'radar');
  tile.body.appendChild(th);
  tile.run(RUNTIME);
  tile.run(readFileSync(join(WIDGETS_DIR, 'radar.js'), 'utf-8'));
  await tick();
  const tAll = th.all();
  assert.deepEqual(tAll.filter((e) => e.className === 'iaw-radar-name').map((e) => e.textContent), ['Oportunidades', 'Reprecificação', 'Distorções', 'PEG < 1', 'Small Caps', 'Riscos']);
  const icon = tAll.find((e) => e.className === 'iaw-radar-pause-icon')!;
  assert.equal(icon.getAttribute('aria-label'), 'Pausar a sequência das listas');
  assert.ok(tAll.some((e) => e.className === 'iaw-seal'));
  assert.ok(!tAll.some((e) => e.className === 'iaw-radar-rows'));
});

// ─── Integração: gerador, sitemap, llms.txt ───────────────────────────────

const silence = async <T>(fn: () => Promise<T>): Promise<{ out: T; warnings: string[] }> => {
  const warnings: string[] = [];
  const w = console.warn; const l = console.log;
  console.warn = (m: unknown) => { warnings.push(String(m)); };
  console.log = () => {};
  try { return { out: await fn(), warnings }; } finally { console.warn = w; console.log = l; }
};

test('generateFerramentas: escreve hub, página pronta, JSONs e bundle; rascunho não vai para a raiz', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ferr-gen-'));
  try {
    const quotes = quotesFixture();
    writeFileSync(join(dir, 'index.html'), '<script src="/assets/js/ferramentas.js?v=0" defer></script>');
    const { out: entries } = await silence(() => generateFerramentas({
      outRoot: dir, fetch: false, now: NOW,
      data: { quotes, cvm: cvmFixture() },
      build: { valuations: dividendsFixture(quotes), hasPage, airton: AIRTON },
    }));
    assert.deepEqual(entries.map((e) => e.loc), [HUB_URL, 'https://iacoes.com.br/ferramentas/radar-de-oportunidades/']);
    assert.equal(entries[1].lastmod, toolById('radar').contentRevised);
    assert.equal(entries[1].changefreq, 'monthly');
    assert.ok(existsSync(join(dir, 'ferramentas', 'index.html')));
    assert.ok(existsSync(join(dir, 'ferramentas', 'radar-de-oportunidades', 'index.html')));
    for (const t of TOOLS.filter((x) => x.status !== 'pronto')) assert.ok(!existsSync(join(dir, toolPath(t), 'index.html')), t.slug);
    const r = JSON.parse(readFileSync(join(dir, DATA_JSON.ranking), 'utf-8'));
    assert.equal(r.date, '2026-10-06');
    assert.ok(r.rows.length >= 60);
    const f = JSON.parse(readFileSync(join(dir, DATA_JSON.fatos), 'utf-8'));
    assert.equal(f.items.length, 9);
    const js = readFileSync(join(dir, 'assets', 'js', 'ferramentas.js'), 'utf-8');
    const page = readFileSync(join(dir, 'ferramentas', 'radar-de-oportunidades', 'index.html'), 'utf-8');
    assert.ok(page.includes(`/assets/js/ferramentas.js?v=${hashOf(js)}`));
    assert.equal(readFileSync(join(dir, 'index.html'), 'utf-8'), `<script src="/assets/js/ferramentas.js?v=${hashOf(js)}" defer></script>`);
    // Mesmas regras do validate-html (checkToolPages) na saída real.
    for (const rel of ['ferramentas/index.html', 'ferramentas/radar-de-oportunidades/index.html']) {
      const html = readFileSync(join(dir, rel), 'utf-8');
      assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, rel);
      assert.ok(ldBlocks(html).length >= 2, rel);
      assert.match(html, /href="https:\/\/app\.brasilhorizonte\.com\.br\/authnew[^"]*"[^>]*data-cta="/);
      assert.doesNotMatch(html, /noindex/);
    }

    // 2ª execução com dado ruim: o JSON anterior não é sobrescrito e o log avisa.
    const before = readFileSync(join(dir, DATA_JSON.ranking), 'utf-8');
    const beforeFatos = readFileSync(join(dir, DATA_JSON.fatos), 'utf-8');
    const { out: again, warnings } = await silence(() => generateFerramentas({
      outRoot: dir, fetch: false, now: NOW, stampLanding: false,
      data: { quotes: quotes.slice(0, 5), cvm: [] },
      build: { valuations: {}, hasPage, airton: AIRTON },
    }));
    assert.equal(readFileSync(join(dir, DATA_JSON.ranking), 'utf-8'), before);
    assert.equal(readFileSync(join(dir, DATA_JSON.fatos), 'utf-8'), beforeFatos);
    assert.ok(warnings.some((w) => /^::warning title=Ferramentas::ranking não atualizado/.test(w)));
    assert.ok(warnings.some((w) => /^::warning title=Ferramentas::fatos relevantes não atualizados/.test(w)));
    assert.deepEqual(again.map((e) => e.loc), entries.map((e) => e.loc));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateFerramentas (prévia): rascunhos com noindex, links e assets com basePath, entradas só das prontas', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ferr-prev-'));
  try {
    const quotes = quotesFixture();
    const { out: entries } = await silence(() => generateFerramentas({
      outRoot: dir, siteRoot: dir, basePath: '/preview', includeDrafts: true, fetch: false, now: NOW,
      data: { quotes, cvm: cvmFixture(), dividends: dividendsFixture(quotes) },
      build: { hasPage, airton: AIRTON },
    }));
    assert.equal(entries.length, 2);
    for (const t of TOOLS) assert.ok(existsSync(join(dir, toolPath(t), 'index.html')), t.slug);
    const draft = readFileSync(join(dir, 'ferramentas', 'markowitz', 'index.html'), 'utf-8');
    assert.match(draft, /noindex/);
    const radar = readFileSync(join(dir, 'ferramentas', 'radar-de-oportunidades', 'index.html'), 'utf-8');
    assert.match(radar, /src="\/preview\/assets\/js\/ferramentas\.js\?v=/);
    assert.match(radar, /href="\/preview\/ferramentas\/"/);
    assert.match(radar, /<link rel="canonical" href="https:\/\/iacoes\.com\.br\/ferramentas\/radar-de-oportunidades\/">/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sitemap aceita as entradas novas (sem duplicata nem URL de fora) e llms.txt tem dono único', () => {
  const entries = [
    { loc: HUB_URL, lastmod: '2026-10-06', changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://iacoes.com.br/ferramentas/radar-de-oportunidades/', lastmod: '2026-10-06', changefreq: 'monthly', priority: '0.8' },
    { loc: HUB_URL, lastmod: '2026-01-01', changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://outro.site/x/', lastmod: '2026-10-06', changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://iacoes.com.br/x/', lastmod: 'hoje', changefreq: 'weekly', priority: '0.8' },
  ];
  const xml = generateSitemap([], [], {}, [], entries);
  assert.equal((xml.match(/<loc>https:\/\/iacoes\.com\.br\/ferramentas\/<\/loc><lastmod>2026-10-06<\/lastmod>/g) || []).length, 1);
  assert.match(xml, /<loc>https:\/\/iacoes\.com\.br\/ferramentas\/radar-de-oportunidades\/<\/loc>/);
  assert.doesNotMatch(xml, /outro\.site|iacoes\.com\.br\/x\//);

  const llms = composeLlmsTxt({ toolEntries: entries.slice(0, 2), macroSection: '## Indicadores macro\n- [Indicador de Buffett Brasil](https://iacoes.com.br/macro/indicador-de-buffett/): x' });
  assert.ok(llms.startsWith('# IAções\n> '));
  assert.ok(llms.indexOf('## Ferramentas') < llms.indexOf('## Indicadores macro'));
  assert.ok(llms.indexOf('## Indicadores macro') < llms.indexOf('## Ações'));
  assert.match(llms, /- \[Radar de oportunidades\]\(https:\/\/iacoes\.com\.br\/ferramentas\/radar-de-oportunidades\/\): /);
  assert.ok(!llms.includes('/ferramentas/markowitz/'));
  const semMacro = composeLlmsTxt({ toolEntries: entries.slice(0, 2), macroSection: '' });
  assert.ok(!semMacro.includes('## Indicadores macro'));
  assert.equal(ferramentasLlmsSection([]), '');
  assert.deepEqual(forbiddenHits(llms, 'page'), []);
});

test('seção do macro no llms.txt: lida do dados.json no disco, só com a trava ligada', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ferr-macro-'));
  try {
    const page = join(dir, 'macro', 'indicador-de-buffett');
    mkdirSync(page, { recursive: true });
    writeFileSync(join(page, 'index.html'), '<html></html>');
    writeFileSync(join(page, 'dados.json'), JSON.stringify({ value: 43.45, date: '2026-10-05', dateBR: '05/10/2026', since: '2000', mean: 47.7, p25: 38.1, p75: 55.4 }));
    const s = macroLlmsSection(dir, true);
    assert.match(s, /^## Indicadores macro\n- \[Indicador de Buffett Brasil\]\(https:\/\/iacoes\.com\.br\/macro\/indicador-de-buffett\/\): /);
    assert.match(s, /Hoje: 43,45% \(fechamento oficial de 05\/10\/2026\); média desde 2000: 47,7%; faixa histórica \(p25–p75\): 38,1% a 55,4%/);
    assert.equal(macroLlmsSection(dir, false), '');
    writeFileSync(join(page, 'dados.json'), '{lixo');
    assert.equal(macroLlmsSection(dir, true), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
