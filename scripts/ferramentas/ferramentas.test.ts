/**
 * Testes das páginas /ferramentas/ (SPEC §3, §4 e §7; SPEC-v2 §B, §D e §E). Uso: npm run test:ferramentas
 * (node:test via tsx). Sem rede: os dados são sintéticos (com a forma real de brapi_quotes e cvm_documents).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createContext, runInContext, Script } from 'node:vm';
import * as React from 'react';
import * as ts from 'typescript';
import { generateSitemap } from '../template';
import { macroLlmsSection } from '../macro';
import { bundleRefProblems, ferramentasLinkProblems, marcaHits, toolPageProblems, widgetInLinkProblems } from '../validate-html';
import { appHref, appHrefsIn, nextPath, parseAppHref, SCREENS } from './links';
import { DATA_JSON, HUB, HUB_URL, TOOLS, ctaId, toolById, toolPath, toolUrl } from './registry';
import {
  backtestOf, buildHubModel, buildToolModel, contentLinks, forbiddenHits, pageSchema, publishProblems, rankingRows, resolveHref, seoProblems,
  structureProblems, termId, toolText, type RenderEnv,
} from './model';
import { APP_HOME, renderHub, renderToolPage, withClicks, withTracks } from './render';
import {
  brtDate, brtTime, buildFatos, buildRanking, cvmTitle, parseTime, resolveDocPage, validateFatos, validateRanking,
  type DailyClose, type MonthlyRate,
} from './data';
import { buildBacktest } from './data';   // fixture do backtest (Ibovespa × CDI) para as páginas com dado
import { bundleSources, hashOf, minifyCss, minifyJs, stampAssetVersions, writeBundle, WIDGETS_DIR } from './bundle';
import { composeLlmsTxt, ferramentasLlmsSection } from './llms';
import { generateFerramentas, macroPagePublished } from './index';
import { SECTIONS, unknownSections } from './sections';
import { ExemploSecao } from './sections/exemplo';
import { ferramentasRefs, htmlAuthorText, PUBLICADAS_PATH, readPublished, stripExternal, toolPageExists, widgetsInsideLinks } from './site';
import type { CvmRow, FatosData, QuoteRow, RankingData, ToolContent, ToolId } from './types';

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

/**
 * Backtest (Ibovespa × CDI, DADOS-API §3): as mesmas séries sintéticas do teste "backtest (DADOS-API
 * §3 e §6)" — 2 pregões por mês, Ibovespa +1% ao mês, CDI 1% a.m. (out/2026 parcial, fica de fora).
 * BT_IBOV/BT_CDI vão no `data.backtest` do gerador; BT (o dados.json montado) vai no env() padrão,
 * porque a página do backtest (dataSource 'backtest') só sai com o dado.
 */
function btSeries(): { ibov: DailyClose[]; cdi: MonthlyRate[] } {
  const ibov: DailyClose[] = [];
  const cdi: MonthlyRate[] = [];
  let v = 17000;
  for (let y = 1999; y <= 2026; y++) {
    for (let mo = 1; mo <= 12; mo++) {
      const m = `${y}-${String(mo).padStart(2, '0')}`;
      if (m < '1999-12' || m > '2026-10') continue;
      ibov.push({ date: `${m}-10`, close: Math.round(v * 99) / 100 });
      v *= 1.01;
      ibov.push({ date: `${m}-${mo === 2 ? '27' : '28'}`, close: Math.round(v * 100) / 100 });
      if (m >= '2000-01') cdi.push({ month: m, rate: m === '2026-10' ? 0.2 : 1 });
    }
  }
  return { ibov, cdi };
}
const { ibov: BT_IBOV, cdi: BT_CDI } = btSeries();
const BT = buildBacktest(BT_IBOV, BT_CDI, { now: NOW }).data;

function env(o: Partial<RenderEnv> = {}): RenderEnv {
  return {
    published: new Set(TOOLS.filter((t) => t.status === 'pronto').map((t) => t.id)),
    macroPage: false,
    basePath: '',
    assets: { js: '/assets/js/ferramentas.js?v=abc1234567', css: '/assets/css/ferramentas.css?v=def1234567' },
    ranking,
    fatos,
    extra: { backtest: BT },
    ...o,
  };
}
const allEnv = () => env({ published: new Set(TOOLS.map((t) => t.id)) });
const PRONTAS = TOOLS.filter((t) => t.status === 'pronto');

/** Marca aposentada montada em pedaços: o literal reprovaria este arquivo no gate do validate-html. */
const DIAS = '14 ' + 'dias';

// ─── Helpers de HTML ──────────────────────────────────────────────────────

const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const ldBlocks = (html: string): any[] => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const ldOf = (html: string, type: string) => ldBlocks(html).find((o) => o['@type'] === type);
/** Todos os nós com @type do JSON-LD (inclusive aninhados). */
const ldNodes = (html: string): any[] => {
  const out: any[] = [];
  const walk = (v: any) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') { if ('@type' in v) out.push(v); Object.values(v).forEach(walk); }
  };
  ldBlocks(html).forEach(walk);
  return out;
};
/** Texto AUTORAL (visível sem os blocos data-fonte + JSON-LD): o que os gates de texto leem. */
const pageText = (html: string) => htmlAuthorText(html);
function visibleFaq(html: string): { q: string; a: string }[] {
  const faq = (html.split('id="faq"')[1] || '').split('</section>')[0];
  return [...faq.matchAll(/<details[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/summary><div[^>]*>([\s\S]*?)<\/div><\/details>/g)].map((m) => ({ q: decode(m[1]), a: decode(m[2]) }));
}
const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));

/** Destino do CTA principal de cada ferramenta (SPEC §2; SPEC-v2 §B9 para a Tese). */
const SPEC: Record<ToolId, { slug: string; next: string[] }> = {
  markowitz: { slug: 'markowitz', next: ['/?s=ialocador&t=optimization&_='] },
  backtest: { slug: 'backtest-de-carteira', next: ['/?s=ialocador&t=portfolio&_='] },
  fatos: { slug: 'fatos-relevantes', next: ['/?s=home&t=notificacoes&_='] },
  ranking: { slug: 'ranking-de-acoes', next: ['/?s=ialocador&t=rankings&_='] },
  radar: { slug: 'radar-de-oportunidades', next: ['/?s=ialocador&t=radar&_='] },
  nota: { slug: 'nota-qualitativa', next: ['/?s=ianalista&t=score&_='] },
  // SPEC-v2 §B9: CTA principal em Minhas Teses (o esqueleto ainda aponta para o Validador).
  tese: { slug: 'tese-de-investimento', next: ['/?s=ianalista&t=teses&_=', '/?s=ianalista&t=validador&_='] },
  calc: { slug: 'calculadora-preco-justo', next: ['/ativo/PETR4?tab=valuation&_='] },
  dcf: { slug: 'fluxo-de-caixa-descontado', next: ['/?s=ianalista&t=valuai&_='] },
};

// ─── Registro e modelo ────────────────────────────────────────────────────

test('registro: as 9 ferramentas do SPEC, na ordem, com slug e id únicos', () => {
  assert.deepEqual(TOOLS.map((t) => t.id), ['markowitz', 'backtest', 'fatos', 'ranking', 'radar', 'nota', 'tese', 'calc', 'dcf']);
  for (const t of TOOLS) assert.equal(t.slug, SPEC[t.id].slug, t.id);
  assert.equal(new Set(TOOLS.map((t) => t.slug)).size, 9);
  for (const t of TOOLS) assert.deepEqual(structureProblems(t), [], t.id);
  for (const t of TOOLS) assert.deepEqual(unknownSections(t), [], `${t.id}: seção SSR não registrada`);
  assert.equal(toolUrl(toolById('radar')), 'https://iacoes.com.br/ferramentas/radar-de-oportunidades/');
  assert.equal(ctaId(toolById('radar')), 'tool-radar');
});

test('Radar é a referência pronta; toda ferramenta pronta passa nas regras de publicação', () => {
  const radar = toolById('radar');
  assert.equal(radar.status, 'pronto');
  assert.equal(radar.title, 'Radar de Ações: Distorções de Valuation e Triagem | IAções');
  assert.equal(radar.h1, 'Radar de oportunidades: a triagem automática das ações da B3');
  for (const t of PRONTAS) assert.deepEqual(publishProblems(t), [], t.id);
  // Rascunho é rascunho de verdade: o marcador TODO aparece e a regra de publicação reprova.
  for (const t of TOOLS.filter((x) => x.status === 'rascunho')) assert.ok(publishProblems(t).length > 0, t.id);
});

test('publicação: nota de acesso sem link para /#precos (SPEC-v2 §B2)', () => {
  const radar = toolById('radar');
  assert.deepEqual(contentLinks(radar).filter((h) => h.startsWith('/#precos')), []);
  const comPrecos: ToolContent = { ...radar, cta: { ...radar.cta, note: 'Comece grátis e [veja os planos](/#precos).' } };
  assert.ok(publishProblems(comPrecos).some((p) => /#precos/.test(p)));
  const html = renderToolPage(buildToolModel(radar, env()));
  assert.ok(!html.includes('href="/#precos"'), 'nem a página nem o rodapé linkam a tabela de planos');
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

test('Radar: H2 e FAQ com demanda e honestos (barata ou cara, PEG, armadilha de valor) — SPEC-v2 §C', () => {
  const radar = toolById('radar');
  const qs = radar.faq.map((f) => f.q);
  for (const q of ['Como saber se uma ação está barata ou cara?', 'O que é PEG ratio e por que o corte é 1?', 'O que é armadilha de valor?']) assert.ok(qs.includes(q), q);
  assert.ok(radar.sections.some((s) => s.id === 'barata-ou-cara' && /barata ou cara/.test(s.title)));
  const armadilha = radar.faq.find((f) => f.q === 'O que é armadilha de valor?')!;
  assert.match(armadilha.a, /não identifica armadilhas de valor sozinho/);   // não promete detectar
  const gratis = radar.faq.find((f) => f.q === 'O Radar é grátis?')!;
  assert.match(gratis.a, /planos pagos/);
  assert.doesNotMatch(gratis.a, /página de preços/);
});

test('Radar: layout compacto abaixo de 400 px; só transform/opacity animam (SPEC-v2 §C e §E5)', () => {
  const css = readFileSync(join(WIDGETS_DIR, 'radar.css'), 'utf-8');
  const compact = css.split('@media (max-width: 400px)')[1] ?? '';
  assert.ok(compact, 'falta o @media (max-width: 400px)');
  assert.match(compact, /\.iaw-radar--page \.iaw-radar-row-pre/);   // "Ação " some: etiquetas A, C, F
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
    if (m[1].trim() === 'none') continue;
    for (const part of m[1].split(',')) assert.match(part.trim(), /^(transform|opacity)\b/, `transição de ${part.trim()}`);
  }
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
  assert.ok(forbiddenHits(`teste de ${DIAS}`, 'page').length);
});

// ─── Deep links (SPEC §2) ─────────────────────────────────────────────────

test('deep link de cada ferramenta: formato do SPEC §2 e tela certa', () => {
  for (const t of TOOLS) {
    const href = appHref(t.cta.target);
    const p = parseAppHref(href);
    assert.ok(p.ok, `${t.id}: ${!p.ok && p.reason}`);
    assert.ok(p.ok && SPEC[t.id].next.includes(p.next), `${t.id}: ${p.ok && p.next}`);
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

test('página do Radar: H1, canonical, OG/Twitter, "Atualizado em" e JSON-LD de ferramenta paga (WebPage, sem oferta grátis)', () => {
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
  assert.equal(page.dateModified, toolById('radar').contentRevised);   // atualização do conteúdo, nunca "hoje"
  const crumbs = ldOf(html, 'BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map((c: any) => c.item), ['https://iacoes.com.br/', HUB_URL, m.url]);
  assert.ok(ldOf(html, 'FAQPage'));
  // SPEC-v2 §D: o Radar é pago — nada de WebApplication, offers ou isAccessibleForFree.
  assert.deepEqual(ldNodes(html).filter((n) => n['@type'] === 'WebApplication' || 'offers' in n || 'isAccessibleForFree' in n), []);
  assert.equal(ldOf(html, 'CollectionPage'), undefined);
  assert.equal(page.aggregateRating, undefined);              // nada de avaliação inventada
  assert.match(html, /id="tool-resumo"/);
  assert.match(html, /Exemplo ilustrativo/);
  assert.match(html, /data-ia-widget="radar" data-size="page"/);
  assert.match(html, /<script src="\/assets\/js\/ferramentas\.js\?v=abc1234567" defer><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/css\/ferramentas\.css\?v=def1234567">/);
  assert.ok(!html.includes('ferramentas-calc'));              // o widget pesado só vai na calculadora
  assert.match(html, /function _iaClick\(/);                 // head tracking compartilhado
  assert.match(html, /set\('utm_source'/);
  // SPEC-v2 §B6: "Atualizado em" (não alega revisão humana).
  const d = toolById('radar').contentRevised;
  assert.match(html, new RegExp(`Atualizado em <time dateTime="${d}">${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}</time>`, 'i'));
  assert.doesNotMatch(html, /revisado em/i);
});

test('JSON-LD por tipo de página (SPEC-v2 §D): WebApplication só na calculadora; CollectionPage + ItemList em fatos e ranking; WebPage nas demais', () => {
  assert.equal(pageSchema(toolById('calc')), 'WebApplication');
  assert.equal(pageSchema(toolById('fatos')), 'CollectionPage');
  assert.equal(pageSchema(toolById('ranking')), 'CollectionPage');
  for (const id of ['markowitz', 'backtest', 'radar', 'nota', 'tese', 'dcf'] as const) assert.equal(pageSchema(toolById(id)), 'WebPage', id);
  for (const t of TOOLS) {
    const html = renderToolPage(buildToolModel(t, allEnv()));
    const nodes = ldNodes(html);
    const free = nodes.filter((n) => n['@type'] === 'WebApplication' || 'offers' in n || 'isAccessibleForFree' in n);
    if (t.id === 'calc') {
      const app = ldOf(html, 'WebApplication');
      assert.equal(app.isAccessibleForFree, true);
      assert.deepEqual(app.offers, { '@type': 'Offer', price: '0', priceCurrency: 'BRL' });
      assert.equal(app.applicationCategory, 'FinanceApplication');
      assert.deepEqual(ldOf(html, 'WebPage').mainEntity, { '@id': `${toolUrl(t)}#ferramenta` });
    } else {
      assert.deepEqual(free, [], `${t.id}: oferta grátis no JSON-LD`);
    }
    if (pageSchema(t) === 'CollectionPage') {
      const col = ldOf(html, 'CollectionPage');
      assert.equal(col.mainEntity['@type'], 'ItemList');
      assert.ok(col.mainEntity.itemListElement.length > 0, t.id);
      for (const it of col.mainEntity.itemListElement) assert.match(it.url, /^https:\/\/iacoes\.com\.br\/(airton\/)?[A-Z0-9]+\/$/);
      assert.equal(ldOf(html, 'WebPage'), undefined);
    } else {
      assert.ok(ldOf(html, 'WebPage'), t.id);
    }
    assert.ok(ldOf(html, 'BreadcrumbList') && ldOf(html, 'FAQPage'), t.id);
    // Mesmas regras do validate-html (parte de JSON-LD) na saída do render.
    assert.deepEqual(toolPageProblems(t.slug, html).filter((p) => /JSON-LD|ItemList|WebApplication/.test(p)), [], t.id);
  }
  // O validate-html acusa oferta grátis fora da calculadora.
  const radar = renderToolPage(buildToolModel(toolById('radar'), env()));
  const fake = radar.replace('"@type":"FAQPage"', '"@type":"FAQPage","isAccessibleForFree":true');
  assert.ok(toolPageProblems('radar-de-oportunidades', fake).some((p) => /só a calculadora/.test(p)));
});

test('páginas prontas passam em todas as regras do validate-html (toolPageProblems)', () => {
  for (const t of PRONTAS) {
    const html = renderToolPage(buildToolModel(t, env()));
    assert.deepEqual(toolPageProblems(t.slug, html), [], t.id);
  }
  assert.deepEqual(toolPageProblems('', renderHub(buildHubModel(env()))), []);
});

test('termos definidos: glossário visível e DefinedTermSet com o MESMO texto (opcional por ferramenta)', () => {
  const base = toolById('radar');
  const t: ToolContent = {
    ...base,
    definedTerms: [
      { name: 'PEG ratio', description: 'P/L dividido pelo crescimento do lucro em porcentagem, com os dois positivos.' },
      { name: 'Distorção de valuation', description: 'No Radar, P/L positivo abaixo da metade da média de P/L do setor.' },
    ],
  };
  assert.deepEqual(structureProblems(t), []);
  const html = renderToolPage(buildToolModel(t, env()));
  const set = ldOf(html, 'DefinedTermSet');
  assert.equal(set['@id'], `${toolUrl(t)}#glossario`);
  assert.deepEqual(set.hasDefinedTerm.map((d: any) => [d.name, d.description]), t.definedTerms!.map((d) => [d.name, d.description]));
  for (const d of set.hasDefinedTerm) assert.deepEqual(d.inDefinedTermSet, { '@id': set['@id'] });
  assert.deepEqual(ldOf(html, 'WebPage').about, t.definedTerms!.map((d) => ({ '@id': `${toolUrl(t)}#${termId(d.name)}` })));
  // Visível, com as mesmas palavras e a âncora do @id, antes do FAQ.
  const gloss = (html.split('id="glossario"')[1] || '').split('</section>')[0];
  for (const d of t.definedTerms!) {
    assert.ok(gloss.includes(`id="${termId(d.name)}"`), d.name);
    assert.ok(decode(gloss).includes(d.description), d.name);
  }
  assert.ok(html.indexOf('id="glossario"') < html.indexOf('id="faq"'));
  assert.equal(termId('Índice de Sharpe'), 'termo-indice-de-sharpe');
  // Sem termos: nem glossário nem DefinedTermSet.
  const plain = renderToolPage(buildToolModel(base, env()));
  assert.equal(ldOf(plain, 'DefinedTermSet'), undefined);
  assert.ok(!plain.includes('id="glossario"'));
  // Termo com marcação ou curto demais é acusado.
  assert.ok(structureProblems({ ...base, definedTerms: [{ name: 'X', description: '**curto**' }] }).length >= 1);
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

test('nenhum termo proibido no texto autoral (visível e JSON-LD) de nenhuma página, nem no hub', () => {
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
    // tool-<id> (topo), -final, -sticky e as variações das seções SSR (tool-<id>-<algo>).
    const ok = new RegExp(`^(nav-app|nav-assinar|disclaimer|tool-${t.id}(-[a-z0-9-]+)?)$`);
    for (const c of ctas) assert.match(c, ok, `${t.id}: data-cta ${c}`);
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

test('página com dado real: data no texto, data-ref-date, dateModified e "Atualizado em" do dado, ItemList só com URLs internas e texto autoral', () => {
  const m = buildToolModel(toolById('ranking'), allEnv());
  const html = renderToolPage(m);
  assert.match(m.answer, /06\/10\/2026/);
  assert.match(html, /data-ref-date="2026-10-06"/);
  const col = ldOf(html, 'CollectionPage');
  assert.equal(col.dateModified, '2026-10-06');
  assert.match(html, /Atualizado em <time dateTime="2026-10-06">06\/10\/2026<\/time>/i);
  const list = col.mainEntity;
  assert.ok(list.itemListElement.length > 0);
  for (const it of list.itemListElement) {
    assert.match(it.url, /^https:\/\/iacoes\.com\.br\/[A-Z0-9]+\/$/);
    assert.match(it.name, /^[A-Z0-9]{4}\d{1,2}$/);          // nome de empresa é dado externo: fora do JSON-LD
  }
  assert.match(html, /data-src="\/ferramentas\/ranking-de-acoes\/dados\.json"/);
  const f = renderToolPage(buildToolModel(toolById('fatos'), allEnv()));
  for (const it of ldOf(f, 'CollectionPage').mainEntity.itemListElement) {
    assert.match(it.url, /^https:\/\/iacoes\.com\.br\/(airton\/)?[A-Z0-9]+\/$/);
    assert.match(it.name, /^[A-Z0-9]+: (Fato Relevante|Comunicado ao Mercado|Press Release) de \d{2}\/\d{2}\/\d{4}$/);   // sem o título da CVM
  }
  assert.match(f, /gerados por IA/);
  assert.match(f, /entrou no feed (às|em) /);                // hora rotulada: é a entrada no feed, não a publicação
  assert.doesNotMatch(f, /publicad[oa] às/);
  // Sem o dado, a página com dado não é montada (a anterior continua).
  assert.throws(() => buildToolModel(toolById('ranking'), env({ ranking: null })));
});

test('calculadora: data do valuations.json só data a página quando o HTML a mostra (sem frescor falso)', () => {
  const calc = toolById('calc');
  const e = allEnv();
  e.valuations = { date: '2026-10-06', dateBR: '06/10/2026', n: 335 };
  const semToken: ToolContent = { ...calc, title: calc.title.replace(/\{(data|n)\}/g, ''), description: calc.description.replace(/\{(data|n)\}/g, ''), h1: calc.h1.replace(/\{(data|n)\}/g, ''), answer: calc.answer.replace(/\{(data|n)\}/g, ''), widget: { ...calc.widget, caption: 'Premissas padrão do site.' } };
  const m1 = buildToolModel(semToken, e);
  assert.equal(m1.refDate, null);
  assert.equal(m1.dateModified, calc.contentRevised);
  const comToken: ToolContent = { ...semToken, widget: { ...semToken.widget, caption: 'Cotações de {data} ({n} ações).' } };
  const m2 = buildToolModel(comToken, e);
  assert.equal(m2.caption, 'Cotações de 06/10/2026 (335 ações).');
  assert.equal(m2.refDate, '2026-10-06');
  assert.equal(m2.dateModified, '2026-10-06');
  assert.equal(m2.dataSrc, null);                            // a calculadora lê /valuations.json (fora de /ferramentas/)
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
  // Rascunho sintético: não depende do status atual de nenhuma ferramenta.
  const draft: ToolContent = { ...toolById('radar'), status: 'rascunho' };
  const html = renderToolPage(buildToolModel(draft, allEnv()));
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /Rascunho: esta página só existe na prévia local/);
});

test('hub: CollectionPage + BreadcrumbList, só ferramentas publicadas e as páginas do site', () => {
  const hub = renderHub(buildHubModel(env()));
  assert.match(hub, /<h1 id="hub-title"[^>]*>Ferramentas para analisar ações da B3<\/h1>/);
  const col = ldOf(hub, 'CollectionPage');
  assert.deepEqual(col.hasPart.map((p: any) => p.url), PRONTAS.map(toolUrl));
  for (const it of col.mainEntity.itemListElement) assert.match(it.url, /^https:\/\/iacoes\.com\.br\//);
  assert.ok(ldOf(hub, 'BreadcrumbList'));
  for (const t of PRONTAS) assert.ok(hub.includes(`href="${toolPath(t)}"`), t.slug);
  for (const t of TOOLS.filter((x) => x.status !== 'pronto')) assert.ok(!hub.includes(`href="${toolPath(t)}"`), t.slug);
  assert.match(hub, /href="\/airton\/"/);
  assert.match(hub, /href="\/acoes\/"/);
  assert.ok(!hub.includes('/assets/js/ferramentas.js'));    // o hub não tem widget
  assert.deepEqual(ldNodes(hub).filter((n) => 'offers' in n || 'isAccessibleForFree' in n), []);
  // Card do Painel macro: só com a página do Buffett publicada.
  assert.ok(!hub.includes('href="/macro/indicador-de-buffett/"'));
  const withMacro = renderHub(buildHubModel(env({ macroPage: true })));
  assert.match(withMacro, /href="\/macro\/indicador-de-buffett\/"[^>]*>[\s\S]*?Painel macro/);
  assert.match(withMacro, /Atualizado em <time/i);
});

test('macroPagePublished: card do Painel macro quando a página do Buffett está no disco (e não é noindex)', () => {
  const dir = tmp('ferr-macro-card-');
  try {
    assert.equal(macroPagePublished(dir), false);
    const page = join(dir, 'macro', 'indicador-de-buffett');
    mkdirSync(page, { recursive: true });
    writeFileSync(join(page, 'index.html'), '<!DOCTYPE html><html><head><meta name="robots" content="index, follow"></head><body></body></html>');
    assert.equal(macroPagePublished(dir), true);
    writeFileSync(join(page, 'index.html'), '<!DOCTYPE html><html><head><meta name="robots" content="noindex, nofollow"></head></html>');
    assert.equal(macroPagePublished(dir), false);
    writeFileSync(join(page, 'index.html'), '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/"></head></html>');
    assert.equal(macroPagePublished(dir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('HTML sem regex quebrada por template literal (regra regex-escaping do validate-html)', () => {
  for (const html of [renderToolPage(buildToolModel(toolById('radar'), env())), renderHub(buildHubModel(env()))]) {
    assert.doesNotMatch(html, /\/[A-Za-z|]+\/\/[a-z]\.test/);
    assert.doesNotMatch(html, /\.replace\(\/\//);
    assert.doesNotMatch(html, /JSON\.stringify\(\{[^}]*\n/);
  }
});

// ─── Dado externo fora das checagens de texto (SPEC-v2 §E1) ───────────────

test('data-fonte: resumo real da CVM com a duração do teste antigo e "potencial" não reprova a página', () => {
  const rows = cvmFixture();
  rows[0] = cvmRow({
    summary: `Fato Relevante - Prazo de ${DIAS} para o potencial exercício de direitos - Date 2026-10-06`,
    ai_summary: `A Dexco S.A. informou ao mercado um prazo de ${DIAS} para o potencial exercício do direito de preferência dos acionistas na operação anunciada.`,
  });
  const fx = buildFatos(rows, { ...look, names: new Map([['DXCO3', 'Potencial Dexco']]), now: NOW });
  const dx = fx.items.find((i) => i.t === 'DXCO3')!;
  assert.ok(dx.summary.includes(DIAS) && /potencial/i.test(dx.title), 'o dado real chega à página como veio');
  // Página de fatos de verdade (conteúdo mínimo e controlado: o texto autoral não é o assunto aqui).
  const base = toolById('fatos');
  const t: ToolContent = {
    ...base,
    status: 'pronto',
    cta: { ...base.cta, note: 'Nota de acesso.' },
    sections: [{ id: 'lista', title: 'Documentos mais recentes', blocks: [{ type: 'fatos-list', limit: 12 }] }],
    faq: [{ q: 'O resumo substitui o documento?', a: 'Não. O resumo é gerado por IA e pode errar.' }],
  };
  const html = renderToolPage(buildToolModel(t, env({ fatos: fx, published: new Set(['fatos']) })));
  assert.ok(html.includes(DIAS), 'o resumo aparece na página');
  assert.match(html, /<p[^>]*data-fonte="cvm"[^>]*>[^<]*potencial/);
  // Sem a marcação, o gate de marca do validate-html reprovaria o build do dia...
  assert.ok(marcaHits(html).length > 0);
  // ...com ela, só o texto autoral é conferido: nada de marca nem termo proibido.
  assert.deepEqual(marcaHits(stripExternal(html)), []);
  assert.deepEqual(forbiddenHits(htmlAuthorText(html), 'page'), []);
  for (const o of ldBlocks(html)) assert.ok(!/potencial|14 d/i.test(JSON.stringify(o)), 'JSON-LD só com texto autoral');
  assert.deepEqual(toolPageProblems('fatos-relevantes', html), []);
  // Ranking: nome de empresa e setor vêm da base de mercado (data-fonte="b3").
  const quotes = quotesFixture().map((x) => (x.symbol === 'TAEE11' ? { ...x, shortName: 'Potencial Transmissora', longName: 'Potencial Transmissora S.A.' } : x));
  const rk = buildRanking(quotes, dividendsFixture(quotes), { hasPage }).data;
  const rhtml = renderToolPage(buildToolModel(toolById('ranking'), env({ ranking: rk, published: new Set(['ranking']) })));
  assert.match(rhtml, /<span[^>]*data-fonte="b3"[^>]*>Potencial Transmissora<\/span>/);
  assert.deepEqual(forbiddenHits(htmlAuthorText(rhtml), 'page'), []);
});

test('regras próprias da ferramenta valem no HTML das seções SSR (o ranking nunca diz "baratas"), fora de "Outras ferramentas"', () => {
  const base = toolById('ranking');
  const html0 = renderToolPage(buildToolModel(base, allEnv()));
  // "Radar de oportunidades" em "Outras ferramentas" é nome de outra ferramenta: não reprova.
  assert.match(html0, /Radar de oportunidades/);
  assert.deepEqual(toolPageProblems(base.slug, html0).filter((p) => /regra de ranking/.test(p)), []);
  SECTIONS['ranking-teste'] = () => React.createElement('p', null, 'As ações mais baratas do mês.');
  try {
    const t: ToolContent = { ...base, sections: [...base.sections, { id: 'teste', title: 'Teste', blocks: [{ type: 'ssr', id: 'ranking-teste' }] }] };
    assert.deepEqual(forbiddenHits(toolText(t), 'ranking'), [], 'o conteúdo em si está limpo: o termo vem da seção SSR');
    const html = renderToolPage(buildToolModel(t, allEnv()));
    assert.ok(toolPageProblems(base.slug, html).some((p) => /regra de ranking.*baratas/.test(p)), 'seção SSR com "baratas" reprova');
  } finally {
    delete SECTIONS['ranking-teste'];
  }
});

test('stripExternal: tira o elemento marcado inteiro (com aninhamento), respeita <script> e não esconde o resto', () => {
  const strip = (s: string) => stripExternal(s).replace(/\s+/g, ' ');
  assert.equal(strip('<p>a</p><div data-fonte="cvm"><div>x</div><p>y</p></div><p>b</p>'), '<p>a</p> <p>b</p>');
  assert.equal(strip('<li><span class="x" data-fonte="b3">Nome <b>S.A.</b></span> fim</li>'), '<li> fim</li>');
  const js = `<script>var s = '<p data-fonte="cvm">';</script><p>b</p>`;
  assert.equal(stripExternal(js), js);                                  // marcação dentro de script não conta
  assert.equal(strip('<p data-fonte="cvm">x<p>y'), ' x<p>y');            // sem fechamento: só a tag sai
  assert.equal(strip('<img data-fonte="cvm" src="x">texto'), ' texto');   // elemento vazio
  const plain = '<p>nada marcado</p>';
  assert.equal(stripExternal(plain), plain);
  assert.equal(htmlAuthorText('<style>.potencial{}</style><p>Olá &amp; <span data-fonte="cvm">potencial</span></p>'), 'Olá &');
});

// ─── Links e quadros da landing (SPEC-v2 §E2 e §E6) ───────────────────────

test('validate-html: todo /ferramentas/... linkado existe no disco (landing e JS inline inclusive)', () => {
  const dir = tmp('ferr-links-');
  try {
    mkdirSync(join(dir, 'ferramentas', 'radar-de-oportunidades'), { recursive: true });
    mkdirSync(join(dir, 'ferramentas', 'ranking-de-acoes'), { recursive: true });
    writeFileSync(join(dir, 'ferramentas', 'index.html'), '');
    writeFileSync(join(dir, 'ferramentas', 'radar-de-oportunidades', 'index.html'), '');
    writeFileSync(join(dir, 'ferramentas', 'ranking-de-acoes', 'dados.json'), '{}');
    const exists = (rel: string) => existsSync(join(dir, rel));
    const html = [
      '<a href="/ferramentas/">hub</a>',
      '<a href="/ferramentas/radar-de-oportunidades/#faq">radar</a>',
      '<a href="/ferramentas/markowitz/">rascunho</a>',
      '<div data-ia-widget="ranking" data-src="/ferramentas/ranking-de-acoes/dados.json?v=1"></div>',
      `<script>var u = '<a href="/ferramentas/backtest-de-carteira/">b</a>'; var d = '<a href="/ferramentas/' + slug + '/">';</script>`,
    ].join('\n');
    assert.deepEqual(ferramentasRefs(html).map((r) => r.path), ['/ferramentas/', '/ferramentas/radar-de-oportunidades/', '/ferramentas/markowitz/', '/ferramentas/ranking-de-acoes/dados.json', '/ferramentas/backtest-de-carteira/']);
    const p = ferramentasLinkProblems(html, exists);
    assert.equal(p.length, 2, p.join('\n'));
    assert.match(p[0], /markowitz\/index\.html, que não existe/);
    assert.match(p[1], /backtest-de-carteira/);                          // literal no JS também conta
    assert.match(ferramentasLinkProblems('<a href="/ferramentas/">x</a>', () => false)[0], /hub é escrito por generateFerramentas/);
    // Aspas simples também contam; concatenação no JS continua fora (não é literal).
    assert.deepEqual(ferramentasRefs(`<a href='/ferramentas/markowitz/'>m</a><script>var e = "<a href='/ferramentas/" + slug + "/'>";</script>`).map((r) => r.path), ['/ferramentas/markowitz/']);
    assert.deepEqual(bundleRefProblems('<script src="/assets/js/ferramentas.js?v=1" defer></script>', exists).length, 1);
    assert.deepEqual(bundleRefProblems('<section id="ferramentas" data-bundle="/assets/js/ferramentas.js?v=0">', exists).length, 1);   // carga sob demanda da landing
    assert.deepEqual(bundleRefProblems('<script src="/preview/x/assets/js/ferramentas-calc.js?v=1" defer></script>', (r) => r === 'preview/x/assets/js/ferramentas-calc.js'), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validate-html: nenhum widget dentro de <a> (o link fica fora do quadro)', () => {
  assert.deepEqual(widgetsInsideLinks('<a href="/ferramentas/radar-de-oportunidades/"><div data-ia-widget="radar"><button>p</button></div></a>'), ['radar']);
  assert.deepEqual(widgetsInsideLinks('<a href="/x/">Ver</a><div data-ia-widget="radar"></div>'), []);
  assert.deepEqual(widgetsInsideLinks('<article><h3>Radar</h3><div data-ia-widget="radar"></div><a href="/x/">Abrir</a></article>'), []);
  assert.deepEqual(widgetsInsideLinks(`<script>var x = '<a href="/x/">';</script><div data-ia-widget="radar"></div>`), []);
  assert.deepEqual(widgetsInsideLinks('<a data-ia-widget="radar" href="/x/"></a>'), ['radar']);
  assert.equal(widgetInLinkProblems('<a href="/x"><span><div data-ia-widget="ranking"></div></span></a>').length, 1);
  for (const t of TOOLS) assert.deepEqual(widgetsInsideLinks(renderToolPage(buildToolModel(t, allEnv()))), [], t.id);
});

// ─── Seções SSR por ferramenta (ponto de extensão) ────────────────────────

test('seções SSR: componente registrado em SECTIONS renderiza na posição indicada pelo conteúdo', () => {
  const base = toolById('radar');
  const comoFunciona = base.sections.find((s) => s.id === 'como-funciona')!;
  const t: ToolContent = {
    ...base,
    sections: base.sections.map((s) => (s.id === 'como-funciona'
      ? { ...s, blocks: [s.blocks[0], { type: 'ssr' as const, id: 'exemplo', props: { itens: ['primeiro', 'segundo'] } }, ...s.blocks.slice(1)] }
      : s)),
  };
  assert.deepEqual(unknownSections(t), ['exemplo']);
  assert.throws(() => renderToolPage(buildToolModel(t, env())), /seção SSR "exemplo" não registrada/);
  SECTIONS.exemplo = ExemploSecao;
  try {
    assert.deepEqual(unknownSections(t), []);
    assert.deepEqual(structureProblems(t), []);
    const html = renderToolPage(buildToolModel(t, env()));
    const sec = (html.split('id="como-funciona"')[1] || '').split('</section>')[0];
    const at = sec.indexOf('data-ssr="exemplo"');
    assert.ok(at > 0, 'a seção SSR está dentro de "Como funciona"');
    assert.ok(sec.indexOf(decode(comoFunciona.blocks[0].type === 'p' ? comoFunciona.blocks[0].text : '').slice(0, 30)) < at, 'depois do 1º bloco');
    assert.ok(at < sec.indexOf('<table'), 'antes da tabela, que era o 2º bloco');
    assert.match(sec, /<li>primeiro<\/li><li>segundo<\/li>/);
    assert.match(sec, /Seção SSR de exemplo da página Radar de oportunidades/);
    assert.deepEqual(forbiddenHits(pageText(html), 'page'), []);
  } finally {
    delete SECTIONS.exemplo;
  }
  assert.ok(structureProblems({ ...t, sections: [{ id: 'x', title: 'X', blocks: [{ type: 'ssr', id: 'Fora do Padrão' }] }] }).some((p) => /SSR fora do padrão/.test(p)));
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

test('ItemList vindo da seção SSR (props itemList/itemLimit): só /TICKER/ internas, sem URL repetida, name = ticker, teto de 30', () => {
  const base = toolById('ranking');
  // Conteúdo mínimo: só a seção SSR do ranking, com ou sem as props que viram ItemList.
  const mk = (props?: Record<string, unknown>): ToolContent => ({
    ...base,
    sections: [{ id: 'lista', title: 'Lista', blocks: [props ? { type: 'ssr', id: 'ranking', props } : { type: 'ssr', id: 'ranking' }] }],
  });
  const items = (t: ToolContent) => buildToolModel(t, env({ published: new Set(['ranking']) })).itemList;
  // Sem props, a seção só desenha: nenhum item.
  assert.deepEqual(items(mk()), []);
  const keys = ['dy', 'pl', 'pvp', 'roe'] as const;
  const all = items(mk({ itemList: [...keys], itemLimit: 7 }));
  const expected = [...new Set(keys.flatMap((k) => rankingRows(ranking, k, 7).map((r) => r.t)))];
  assert.ok(expected.length > 7 && expected.length <= 28);
  assert.deepEqual(all.map((it) => it.name), expected);          // ordem das abas, sem repetir o ticker que aparece em duas
  assert.equal(new Set(all.map((it) => it.url)).size, all.length);
  for (const it of all) assert.equal(it.url, `https://iacoes.com.br/${it.name}/`);
  for (const it of all) assert.match(it.name, /^[A-Z0-9]{4}\d{1,2}$/);   // nada de nome de empresa (dado externo)
  // Lixo nas props é ignorado; itemLimit padrão = 10; teto de 30 itens.
  assert.deepEqual(items(mk({ itemList: ['xx', 42, null, 'toString'] })), []);
  assert.deepEqual(items(mk({ itemList: ['dy'] })).map((it) => it.name), rankingRows(ranking, 'dy', 10).map((r) => r.t));
  assert.deepEqual(items(mk({ itemList: 'dy' })), []);
  assert.equal(items(mk({ itemList: [...keys], itemLimit: 20 })).length, 30);
  // No JSON-LD: CollectionPage > ItemList com os mesmos itens, e o validate-html aceita.
  const t = mk({ itemList: ['dy', 'roe'], itemLimit: 5 });
  const html = renderToolPage(buildToolModel(t, env({ published: new Set(['ranking']) })));
  const list = ldOf(html, 'CollectionPage').mainEntity;
  assert.equal(list['@type'], 'ItemList');
  assert.deepEqual(list.itemListElement.map((x: any) => x.url), items(t).map((it) => it.url));
  assert.deepEqual(toolPageProblems(base.slug, html).filter((p) => /ItemList|JSON-LD/.test(p)), []);
});

// ─── Dados reais: fatos relevantes ────────────────────────────────────────

test('fatos: só FR/CM com resumo (PR não tem resumo), sem repetido nem futuro, link interno e hora em BRT', () => {
  assert.equal(fatos.items.length, 5);                       // os 4 PR da fixture ficam fora
  assert.ok(fatos.items.every((i) => ['FR', 'CM'].includes(i.type)));
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
  assert.ok(!fatos.items.some((i) => i.type === 'PR'));
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

// ─── Bundle dos widgets ───────────────────────────────────────────────────

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

test('bundle: runtime primeiro, cada widget isolado, hash estável, CSS junto e o hash do CSS gravado no runtime', () => {
  const a = bundleSources();
  const b = bundleSources();
  assert.equal(hashOf(a.js), hashOf(b.js));
  assert.ok(a.widgets.includes('radar'));
  assert.ok(!a.widgets.includes('calc'));                    // widget pesado nunca vai no arquivo principal
  const rt = a.js.indexOf('w.IAFerr = {');
  assert.ok(rt > 0 && rt < a.js.indexOf('/* --- widgets/radar.js --- */'));
  assert.match(a.js, /\/\* --- widgets\/radar\.js --- \*\/\n;\(function \(\) \{\ntry \{/);
  assert.match(a.css, /\.iaw-seal/);
  assert.match(a.css, /\.iaw-radar-card/);
  assert.match(a.js, new RegExp(`var CSS_VERSION = '${hashOf(a.css)}';`));   // injeção não-bloqueante pede o CSS certo
  assert.doesNotThrow(() => new Script(a.js));               // JS válido
  const dir = tmp('ferr-bundle-');
  try {
    const r = writeBundle(dir);
    const js = readFileSync(join(dir, 'assets', 'js', 'ferramentas.js'), 'utf-8');
    const css = readFileSync(join(dir, 'assets', 'css', 'ferramentas.css'), 'utf-8');
    assert.equal(js, bundleSources(undefined, { minify: true }).js);
    assert.equal(r.jsHash, hashOf(js));
    assert.equal(r.cssHash, hashOf(css));
    assert.equal(r.jsUrl, `/assets/js/ferramentas.js?v=${r.jsHash}`);
    assert.match(js, new RegExp(`var CSS_VERSION = '${r.cssHash}';`));
    assert.ok(js.length < a.js.length * 0.8, `minificado (${js.length} de ${a.js.length})`);
    assert.doesNotMatch(js.slice(js.indexOf('\n') + 1), /^[ \t]*\/[*/]|^[ \t]{2,}\S/m);   // sem comentário nem recuo além do cabeçalho
    assert.doesNotThrow(() => new Script(js));
    assert.deepEqual(es5Violations(js), []);
    assert.doesNotMatch(css.slice(css.indexOf('\n') + 1), /\/\*/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bundle: widget pesado em arquivo separado (calc), espera o runtime, e erro de sintaxe tira só o widget quebrado', async () => {
  const src = tmp('ferr-widgets-');
  const out = tmp('ferr-out-');
  try {
    for (const f of ['_runtime.js', '_runtime.css', 'radar.js', 'radar.css']) copyFileSync(join(WIDGETS_DIR, f), join(src, f));
    writeFileSync(join(src, 'calc.js'), `window.IAFerr.register('calc', function (el, ctx) {\n  el.setAttribute('data-calc', ctx.size);\n  return { start: function () {}, stop: function () {} };\n});\n`);
    writeFileSync(join(src, 'calc.css'), '/* calc */\n.iaw-calc-x { color: #093848; }\n');
    writeFileSync(join(src, 'quebrado.js'), "window.IAFerr.register('quebrado', function ( {\n");
    const s = bundleSources(src);
    assert.deepEqual(s.widgets, ['radar']);
    assert.deepEqual(s.groups.map((g) => [g.name, g.widgets]), [['calc', ['calc']]]);
    assert.deepEqual(s.skipped.map((x) => x.id), ['quebrado']);
    assert.ok(!s.js.includes("register('calc'") && !s.js.includes('quebrado\''));
    assert.ok(s.groups[0].js.includes("register('calc'"));
    assert.match(s.groups[0].js, /iaferr:ready/);
    assert.ok(!s.css.includes('.iaw-calc-x') && s.groups[0].css.includes('.iaw-calc-x'));

    const r = writeBundle(out, src);
    assert.deepEqual(r.skipped.map((x) => x.id), ['quebrado']);
    const calcJs = readFileSync(join(out, 'assets', 'js', 'ferramentas-calc.js'), 'utf-8');
    assert.ok(existsSync(join(out, 'assets', 'css', 'ferramentas-calc.css')));
    assert.deepEqual(r.byWidget.calc, { js: `/assets/js/ferramentas-calc.js?v=${r.groups.calc.js.hash}`, css: `/assets/css/ferramentas-calc.css?v=${r.groups.calc.css!.hash}` });
    assert.deepEqual(es5Violations(calcJs), []);
    const mainJs = readFileSync(join(out, 'assets', 'js', 'ferramentas.js'), 'utf-8');

    // O arquivo do calc chega ANTES do runtime: espera o 'iaferr:ready' e monta do mesmo jeito.
    const sb = runtimeSandbox({ io: true });
    const host = mkHost(sb.body, 'calc', 'page');
    sb.run(calcJs);
    sb.run(mainJs);
    await tick();
    assert.equal(host.getAttribute('data-ia-state'), 'ok');
    assert.equal(host.getAttribute('data-calc'), 'page');

    // Página da calculadora carrega os dois arquivos, na ordem; as outras, só o principal.
    const e = env({ published: new Set(TOOLS.map((t) => t.id)), assets: { js: `/assets/js/ferramentas.js?v=${r.jsHash}`, css: `/assets/css/ferramentas.css?v=${r.cssHash}`, byWidget: r.byWidget } });
    const calcHtml = renderToolPage(buildToolModel(toolById('calc'), e));
    const iMain = calcHtml.indexOf(`/assets/js/ferramentas.js?v=${r.jsHash}`);
    const iCalc = calcHtml.indexOf(r.byWidget.calc.js);
    assert.ok(iMain > 0 && iCalc > iMain, 'runtime antes do widget pesado');
    assert.ok(calcHtml.includes(`<link rel="stylesheet" href="${r.byWidget.calc.css}">`));
    const radarHtml = renderToolPage(buildToolModel(toolById('radar'), e));
    assert.ok(!radarHtml.includes('ferramentas-calc'));
    // ?v= dos arquivos separados também é carimbado na landing.
    const stamped = stampAssetVersions('<script src="/assets/js/ferramentas-calc.js?v=0"></script><link href="/assets/css/ferramentas-calc.css?v=0">', r);
    assert.equal(stamped, `<script src="/assets/js/ferramentas-calc.js?v=${r.groups.calc.js.hash}"></script><link href="/assets/css/ferramentas-calc.css?v=${r.groups.calc.css!.hash}">`);
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test('minificação: CSS sem comentários e espaços sobrando, strings intactas; JS sem comentários nem recuo', () => {
  assert.equal(minifyCss('/* x */\n.a  .b , .c {\n  content: "a ; { b";\n  color : red ;\n}\n@media (max-width: 400px) {\n  .d { top: calc(1px + 2px); }\n}\n'),
    '.a .b , .c{content: "a ; { b";color : red}@media (max-width: 400px){.d{top: calc(1px + 2px)}}');
  const js = minifyJs("/* doc */\nvar a = 'x /* não é comentário */'; // fim\nfunction f() {\n    return a + '\\\n  continua';\n}\n");
  assert.doesNotMatch(js, /doc|fim/);
  assert.match(js, /'x \/\* não é comentário \*\/'/);
  assert.match(js, /\n {2}continua'/);                       // linha após a barra de continuação fica intacta
  assert.doesNotThrow(() => new Script(js));
});

test('widgets e runtime em JS puro ES5 (sem import/export, arrow, let/const, template literal)', () => {
  const files = readdirSync(WIDGETS_DIR).filter((f) => f.endsWith('.js'));
  assert.ok(files.includes('_runtime.js'));
  for (const f of files) assert.deepEqual(es5Violations(readFileSync(join(WIDGETS_DIR, f), 'utf-8')), [], f);
  assert.deepEqual(es5Violations(readFileSync(join(__dirname, 'page.client.js'), 'utf-8')), [], 'page.client.js');
  assert.deepEqual(es5Violations(bundleSources(undefined, { minify: true }).js), [], 'bundle minificado');
});

test('landing: o ?v= do bundle é atualizado e o resto do HTML fica igual', () => {
  const html = '<link rel="stylesheet" href="/assets/css/ferramentas.css?v=0"><script src="/assets/js/ferramentas.js?v=old_1" defer></script><a href="/ferramentas/">x</a>';
  const out = stampAssetVersions(html, { jsHash: 'aaaa111111', cssHash: 'bbbb222222' });
  assert.equal(out, '<link rel="stylesheet" href="/assets/css/ferramentas.css?v=bbbb222222"><script src="/assets/js/ferramentas.js?v=aaaa111111" defer></script><a href="/ferramentas/">x</a>');
  assert.equal(stampAssetVersions('<p>sem bundle</p>', { jsHash: 'a', cssHash: 'b' }), '<p>sem bundle</p>');
});

// ─── Runtime (DOM mínimo num vm, sem jsdom) ───────────────────────────────

class FakeNode {
  parent: FakeEl | null = null;
}
class FakeText extends FakeNode {
  constructor(public data: string) { super(); }
}
/** Seletores que o runtime usa: tag, #id, [attr], [attr="v"] e tag[attr="v"]. */
function matches(e: FakeEl, sel: string): boolean {
  const m = /^([a-z]+)?(?:#([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(sel.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) throw new Error(`seletor não suportado no DOM de teste: ${sel}`);
  if (m[1] && e.tagName !== m[1]) return false;
  if (m[2] && e.attrs.id !== m[2]) return false;
  if (m[3] && !(m[3] in e.attrs)) return false;
  if (m[3] && m[4] !== undefined && e.attrs[m[3]] !== m[4]) return false;
  return true;
}
class FakeEl extends FakeNode {
  /** Propriedades livres que o runtime usa em <link> (rel, media, sheet, onload, onerror). */
  [k: string]: any;
  children: FakeNode[] = [];
  attrs: Record<string, string> = {};
  listeners: Record<string, Function[]> = {};
  style: Record<string, string> = {};
  raw: string | null = null;
  nodeType = 1;
  /** No <html>: entrega ao document o evento que borbulhou até o topo. */
  onTop: ((ev: any) => void) | null = null;
  constructor(public tagName: string, public ns: string | null = null) { super(); }
  get parentNode(): FakeEl | null { return this.parent; }
  getAttribute(k: string) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k: string, v: string) { this.attrs[k] = String(v); }
  removeAttribute(k: string) { delete this.attrs[k]; }
  get className() { return this.attrs.class || ''; }
  set className(v: string) { this.attrs.class = v; }
  appendChild(c: FakeNode) { c.parent = this; this.children.push(c); this.raw = null; return c; }
  contains(n: FakeNode | null): boolean { for (let p = n; p; p = p.parent) if (p === this) return true; return false; }
  addEventListener(t: string, f: Function) { (this.listeners[t] ||= []).push(f); }
  /** Evento de usuário (sem bolha), como um clique. */
  dispatch(t: string) { for (const f of this.listeners[t] || []) f.call(this, { type: t, currentTarget: this, target: this }); }
  dispatchEvent(ev: any) {
    ev.target = ev.target || this;
    for (let n: FakeEl | null = this; n; n = n.parent) {
      for (const f of n.listeners[ev.type] || []) f.call(n, Object.assign(ev, { currentTarget: n }));
      if (!ev.bubbles) break;
      if (!n.parent && n.onTop) n.onTop(ev);
    }
    return true;
  }
  get textContent(): string { return this.raw ?? this.children.map((c) => (c instanceof FakeText ? c.data : (c as FakeEl).textContent)).join(''); }
  set textContent(v: string) { this.children = []; this.raw = null; if (v) this.appendChild(new FakeText(v)); }
  get innerHTML(): string { return this.raw ?? this.children.map((c) => (c instanceof FakeText ? c.data : `<${(c as FakeEl).tagName}>`)).join(''); }
  set innerHTML(v: string) { this.children = []; this.raw = v || null; }
  all(): FakeEl[] { const out: FakeEl[] = []; const walk = (e: FakeEl) => { for (const c of e.children) if (c instanceof FakeEl) { out.push(c); walk(c); } }; walk(this); return out; }
  querySelectorAll(sel: string): FakeEl[] { return this.all().filter((e) => matches(e, sel)); }
  querySelector(sel: string): FakeEl | null { return this.all().find((e) => matches(e, sel)) ?? null; }
}

interface SandboxOpts {
  io?: boolean;
  reduced?: boolean;
  /** src do <script> do bundle (document.currentScript): liga a injeção de CSS. */
  script?: string;
}

function runtimeSandbox(o: SandboxOpts = {}) {
  const html = new FakeEl('html');
  const head = new FakeEl('head');
  const body = new FakeEl('body');
  html.appendChild(head);
  html.appendChild(body);
  const docListeners: Record<string, Function[]> = {};
  let current: FakeEl | null = null;
  if (o.script) { current = new FakeEl('script'); current.setAttribute('src', o.script); head.appendChild(current); }
  const document: any = {
    readyState: 'complete',
    hidden: false,
    head,
    body,
    currentScript: current,
    createElement: (t: string) => new FakeEl(t),
    createElementNS: (ns: string, t: string) => new FakeEl(t, ns),
    createTextNode: (s: string) => new FakeText(s),
    querySelectorAll: (s: string) => html.querySelectorAll(s),
    querySelector: (s: string) => html.querySelector(s),
    getElementsByTagName: (t: string) => html.all().filter((e) => e.tagName === t),
    addEventListener: (t: string, f: Function) => { (docListeners[t] ||= []).push(f); },
    dispatchEvent: (ev: any) => { ev.target = ev.target || document; for (const f of docListeners[ev.type] || []) f(ev); return true; },
  };
  html.onTop = (ev) => document.dispatchEvent(ev);
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
    CustomEvent: function (this: any, type: string, init?: { bubbles?: boolean; detail?: unknown }) { this.type = type; this.bubbles = !!(init && init.bubbles); this.detail = init && init.detail; },
    _iaTrack: (ev: string, id: string) => { tracked.push([ev, id]); },
  };
  if (o.io) window.IntersectionObserver = function (cb: Function) { ioCallback = cb; return { observe: (el: FakeEl) => observed.push(el), unobserve: () => {} }; };
  const ctx = createContext({ window, document });
  const flushFrames = (t: number) => { const fs = frames.splice(0); for (const f of fs) f(t); };
  return {
    window, document, html, head, body, ctx, observed, tracked, frames,
    run: (code: string) => runInContext(code, ctx),
    intersect: (el: FakeEl, on: boolean) => ioCallback!([{ target: el, isIntersecting: on }]),
    setHidden: (h: boolean) => { document.hidden = h; for (const f of docListeners.visibilitychange || []) f(); },
    on: (t: string, f: Function) => { (docListeners[t] ||= []).push(f); },
    flushFrames,
  };
}

function mkHost(parent: FakeEl, id: string, size?: 'page' | 'tile'): FakeEl {
  const host = new FakeEl('div');
  host.setAttribute('data-ia-widget', id);
  if (size) host.setAttribute('data-size', size);
  host.innerHTML = 'conteúdo do servidor';
  parent.appendChild(host);
  return host;
}

const RUNTIME = readFileSync(join(WIDGETS_DIR, '_runtime.js'), 'utf-8');
const tick = () => new Promise((r) => setImmediate(r));
/** Widget de teste: guarda o ctx e registra start/stop por elemento. */
const PROBE = `window.__log = []; window.__ctx = {};
window.IAFerr.register('probe', function (el, ctx) {
  var id = el.getAttribute('id') || 'x';
  window.__ctx[id] = ctx;
  return { start: function () { window.__log.push('start:' + id); }, stop: function () { window.__log.push('stop:' + id); } };
});`;

test('runtime: monta, liga/desliga por visibilidade e IntersectionObserver, data-ia-run, reduced motion e track único', async () => {
  const sb = runtimeSandbox({ io: true });
  const host = new FakeEl('div');
  host.setAttribute('data-ia-widget', 'teste');
  host.setAttribute('data-size', 'page');
  host.setAttribute('data-span', '2x2');
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
  assert.equal(host.getAttribute('data-ia-run'), '0');
  const c = sb.window.__ctx;
  assert.equal(c.size, 'page');
  assert.equal(c.span, '2x2');
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
  assert.equal(host.getAttribute('data-ia-run'), '1');
  sb.setHidden(true);
  assert.deepEqual(log, ['start', 'stop']);  // aba escondida: para
  assert.equal(host.getAttribute('data-ia-run'), '0');
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
  reduced.run(`window.IAFerr.register('r', function (el, ctx) { window.__r = ctx.reduced; window.__size = ctx.size; window.__span = ctx.span; return { start: function () { window.__started = true; }, stop: function () {} }; });`);
  await tick();
  assert.equal(reduced.window.__r, true);
  assert.equal(reduced.window.__size, 'tile');
  assert.equal(reduced.window.__span, '1x1');
  assert.equal(reduced.window.__started, true);   // sem IntersectionObserver: liga direto
});

test('runtime: laço único com teto de 30 fps para loops decorativos (60 e 120 Hz), fps opcional até 60 e dt real', async () => {
  const sb = runtimeSandbox({ io: true });
  const host = mkHost(sb.body, 'probe');
  host.setAttribute('id', 'a');
  sb.run(RUNTIME);
  sb.run(PROBE);
  await tick();
  const c = sb.window.__ctx.a;
  let n30 = 0; let sum30 = 0; let n60 = 0;
  c.loop((dt: number) => { n30++; sum30 += dt; });
  c.loop(() => { n60++; }, { fps: 60 });
  sb.intersect(host, true);
  const at60 = 1000 / 60;
  for (let k = 1; k <= 60; k++) sb.flushFrames(k * at60);
  assert.equal(n30, 30, '30 fps a 60 Hz');
  assert.equal(n60, 60, '60 fps a 60 Hz');
  assert.ok(Math.abs(sum30 - 1000) < 40, `dt somado ≈ 1 s (${sum30})`);
  // Monitor de 120 Hz: o teto continua 30 fps.
  n30 = 0; n60 = 0;
  const t0 = 60 * at60;
  for (let k = 1; k <= 120; k++) sb.flushFrames(t0 + (k * 1000) / 120);
  assert.equal(n30, 30, '30 fps a 120 Hz');
  assert.equal(n60, 60, '60 fps a 120 Hz');
  assert.equal(sb.frames.length, 1, 'um único requestAnimationFrame pendente para todos os loops');
});

test('runtime: movimento reduzido — start roda (quadro final), mas nenhum loop anima', async () => {
  const sb = runtimeSandbox({ io: true, reduced: true });
  const host = mkHost(sb.body, 'probe');
  host.setAttribute('id', 'a');
  sb.run(RUNTIME);
  sb.run(PROBE);
  await tick();
  const c = sb.window.__ctx.a;
  assert.equal(c.reduced, true);
  let n = 0;
  c.loop(() => { n++; });
  sb.intersect(host, true);
  for (let k = 1; k <= 30; k++) sb.flushFrames(k * 16.7);
  assert.equal(n, 0);
  assert.deepEqual([...sb.window.__log], ['start:a']);         // array do vm: copia para este realm
  assert.equal(sb.window.IAFerr.reduced(), true);
});

test('runtime: pauseAll/resumeAll por seção, eventos e botão data-ia-pause "Pausar animações" (WCAG 2.2.2)', async () => {
  const sb = runtimeSandbox({ io: true });
  const section = new FakeEl('section'); section.setAttribute('id', 'ferramentas');
  sb.body.appendChild(section);
  const btn = new FakeEl('button'); btn.setAttribute('type', 'button'); btn.setAttribute('data-ia-pause', '#ferramentas'); btn.textContent = 'Pausar animações';
  section.appendChild(btn);
  const a = mkHost(section, 'probe'); a.setAttribute('id', 'a');
  const b = mkHost(sb.body, 'probe'); b.setAttribute('id', 'b');
  sb.run(RUNTIME);
  sb.run(PROBE);
  await tick();
  sb.intersect(a, true);
  sb.intersect(b, true);
  const IAFerr = sb.window.IAFerr;
  const events: [string, boolean, unknown][] = [];
  sb.on('iaferr:pause', (e: any) => events.push(['pause', e.detail.paused, e.target]));
  sb.on('iaferr:resume', (e: any) => events.push(['resume', e.detail.paused, e.target]));
  let na = 0;
  sb.window.__ctx.a.loop(() => { na++; });
  assert.equal(btn.getAttribute('aria-pressed'), 'false');

  btn.dispatch('click');
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  assert.equal(btn.textContent, 'Retomar animações');
  assert.equal(a.getAttribute('data-ia-paused'), 'true');
  assert.equal(a.getAttribute('data-ia-run'), '0');
  assert.equal(b.getAttribute('data-ia-run'), '1');           // fora da seção: continua
  assert.deepEqual([...sb.window.__log.slice(-1)], ['stop:a']);
  assert.deepEqual(events, [['pause', true, section]]);        // evento na seção, borbulha até o document
  assert.equal(IAFerr.paused(section), true);
  assert.equal(IAFerr.paused(), false);
  for (let k = 1; k <= 10; k++) sb.flushFrames(k * 16.7);
  assert.equal(na, 0, 'pausado não anima');

  btn.dispatch('click');
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  assert.equal(btn.textContent, 'Pausar animações');
  assert.equal(a.getAttribute('data-ia-paused'), null);
  assert.equal(a.getAttribute('data-ia-run'), '1');
  assert.deepEqual(events.slice(-1), [['resume', false, section]]);
  sb.flushFrames(500);
  assert.ok(na > 0, 'retomado anima de novo');

  // Página inteira, por código.
  IAFerr.pauseAll();
  assert.equal(a.getAttribute('data-ia-run'), '0');
  assert.equal(b.getAttribute('data-ia-run'), '0');
  assert.equal(IAFerr.paused(), true);
  assert.equal(btn.getAttribute('aria-pressed'), 'true');      // o botão da seção acompanha
  // Widget montado depois, dentro de raiz pausada, já nasce pausado.
  const c2 = mkHost(section, 'probe'); c2.setAttribute('id', 'c');
  IAFerr.mount();
  await tick();
  assert.equal(c2.getAttribute('data-ia-paused'), 'true');
  sb.intersect(c2, true);
  assert.equal(c2.getAttribute('data-ia-run'), '0');
  IAFerr.resumeAll();
  for (const el of [a, b, c2]) assert.equal(el.getAttribute('data-ia-run'), '1');
});

test('runtime: widget dentro de <a> não monta (o link fica fora do quadro)', async () => {
  const sb = runtimeSandbox({ io: true });
  const a = new FakeEl('a'); a.setAttribute('href', '/ferramentas/radar-de-oportunidades/');
  sb.body.appendChild(a);
  const host = mkHost(a, 'probe'); host.setAttribute('id', 'a');
  sb.run(RUNTIME);
  sb.run(PROBE);
  await tick();
  assert.equal(host.getAttribute('data-ia-state'), 'erro');
  assert.equal(host.innerHTML, 'conteúdo do servidor');
  assert.equal(sb.window.__ctx.a, undefined);
});

test('runtime: data-ia-tool só liga o quadro de ferramenta publicada (publicadas.json) e published() usa cache', async () => {
  const sb = runtimeSandbox({ io: true });
  const calls: string[] = [];
  sb.window.fetch = (url: string) => {
    calls.push(url);
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ v: 1, ids: ['radar'], tools: [{ id: 'radar', path: '/ferramentas/radar-de-oportunidades/' }] }) });
  };
  const on = mkHost(sb.body, 'probe'); on.setAttribute('id', 'on'); on.setAttribute('data-ia-tool', 'radar');
  const off = mkHost(sb.body, 'probe'); off.setAttribute('id', 'off'); off.setAttribute('data-ia-tool', 'markowitz');
  const free = mkHost(sb.body, 'probe'); free.setAttribute('id', 'free');
  sb.run(RUNTIME);
  sb.run(PROBE);
  await tick();
  await tick();
  assert.equal(on.getAttribute('data-ia-state'), 'ok');
  assert.equal(off.getAttribute('data-ia-state'), 'indisponivel');
  assert.equal(off.innerHTML, 'conteúdo do servidor');
  assert.equal(free.getAttribute('data-ia-state'), 'ok');    // sem data-ia-tool: monta sempre (páginas de ferramenta)
  const p = await sb.window.IAFerr.published();
  assert.deepEqual(p.ids, ['radar']);
  assert.deepEqual(calls, ['/ferramentas/publicadas.json']);  // um pedido só
});

test('runtime: measure() antes de mutate() no mesmo quadro do laço único (FLIP sem thrash)', async () => {
  const sb = runtimeSandbox({ io: true });
  const host = mkHost(sb.body, 'probe'); host.setAttribute('id', 'a');
  sb.run(RUNTIME);
  sb.run(PROBE);
  await tick();
  const c = sb.window.__ctx.a;
  const order: string[] = [];
  c.mutate(() => order.push('w1'));
  c.measure(() => order.push('r1'));
  c.mutate(() => order.push('w2'));
  c.measure(() => order.push('r2'));
  assert.deepEqual(order, []);
  sb.flushFrames(16);
  assert.deepEqual(order, ['r1', 'r2', 'w1', 'w2']);
  sb.flushFrames(32);
  assert.equal(sb.frames.length, 0, 'sem trabalho, o laço para');
});

test('runtime: CSS sem bloquear na landing — injeta com o ?v= do build e só monta depois do load', async () => {
  const src = bundleSources();
  // 1. Sem <link> na página: injeta e espera.
  const sb = runtimeSandbox({ io: true, script: '/preview/infra/assets/js/ferramentas.js?v=1' });
  const host = mkHost(sb.body, 'radar', 'tile');
  sb.run(src.js);
  await tick();
  assert.equal(host.getAttribute('data-ia-state'), null, 'espera o CSS: fica o conteúdo do servidor');
  const link = sb.head.all().find((e) => e.tagName === 'link')!;
  assert.equal(link.getAttribute('href'), `/preview/infra/assets/css/ferramentas.css?v=${hashOf(src.css)}`);
  assert.equal(link.rel, 'stylesheet');
  link.onload();
  assert.equal(host.getAttribute('data-ia-state'), 'ok');
  assert.equal(host.all().filter((e) => /iaw-radar-card/.test(e.className)).length, 6);

  // 2. Página com <link> comum (páginas /ferramentas/): não injeta, monta direto.
  const sb2 = runtimeSandbox({ io: true, script: '/assets/js/ferramentas.js?v=1' });
  const l2 = new FakeEl('link'); l2.setAttribute('rel', 'stylesheet'); l2.setAttribute('href', '/assets/css/ferramentas.css?v=1'); sb2.head.appendChild(l2);
  const h2 = mkHost(sb2.body, 'radar', 'page');
  sb2.run(src.js);
  await tick();
  assert.equal(h2.getAttribute('data-ia-state'), 'ok');
  assert.equal(sb2.head.all().filter((e) => e.tagName === 'link').length, 1);

  // 3. <link media="print" onload=...> ainda não carregado: espera o load e liga o CSS.
  const sb3 = runtimeSandbox({ io: true, script: '/assets/js/ferramentas.js?v=1' });
  const l3 = new FakeEl('link'); l3.setAttribute('href', '/assets/css/ferramentas.css?v=1'); l3.media = 'print'; sb3.head.appendChild(l3);
  const h3 = mkHost(sb3.body, 'radar');
  sb3.run(src.js);
  await tick();
  assert.equal(h3.getAttribute('data-ia-state'), null);
  l3.dispatch('load');
  assert.equal(l3.media, 'all');
  assert.equal(h3.getAttribute('data-ia-state'), 'ok');

  // 4. CSS que não carrega: o conteúdo do servidor fica (widget sem CSS é pior).
  const sb4 = runtimeSandbox({ io: true, script: '/assets/js/ferramentas.js?v=1' });
  const h4 = mkHost(sb4.body, 'radar');
  sb4.run(src.js);
  await tick();
  sb4.head.all().find((e) => e.tagName === 'link')!.onerror();
  sb4.window.IAFerr.mount();
  await tick();
  assert.equal(h4.getAttribute('data-ia-state'), null);
  assert.equal(h4.innerHTML, 'conteúdo do servidor');
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

test('widget radar: 6 listas com nomes reais, selo, sem ticker; clique mostra a regra e a sequência avança (também no bundle minificado)', async () => {
  for (const code of [`${RUNTIME}\n${readFileSync(join(WIDGETS_DIR, 'radar.js'), 'utf-8')}`, bundleSources(undefined, { minify: true }).js]) {
    const sb = runtimeSandbox({ io: true });
    const host = new FakeEl('div'); host.setAttribute('data-ia-widget', 'radar'); host.setAttribute('data-size', 'page'); host.innerHTML = 'fallback';
    sb.body.appendChild(host);
    sb.run(code);
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
    assert.ok(all.some((e) => e.className === 'iaw-radar-row-pre' && e.textContent === 'Ação '));   // some no layout compacto
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
  }

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

test('generateFerramentas: escreve hub, páginas prontas, JSONs, publicadas.json e bundle; rascunho não vai para a raiz', async () => {
  const dir = tmp('ferr-gen-');
  try {
    const quotes = quotesFixture();
    writeFileSync(join(dir, 'index.html'), '<script src="/assets/js/ferramentas.js?v=0" defer></script>');
    const { out: entries } = await silence(() => generateFerramentas({
      outRoot: dir, fetch: false, now: NOW,
      data: { quotes, cvm: cvmFixture(), backtest: { ibov: BT_IBOV, cdi: BT_CDI } },
      build: { valuations: dividendsFixture(quotes), hasPage, airton: AIRTON },
    }));
    assert.deepEqual(entries.map((e) => e.loc), [HUB_URL, ...PRONTAS.map(toolUrl)]);
    const radarEntry = entries.find((e) => e.loc === toolUrl(toolById('radar')))!;
    assert.equal(radarEntry.lastmod, toolById('radar').contentRevised);
    assert.equal(radarEntry.changefreq, 'monthly');
    assert.ok(existsSync(join(dir, 'ferramentas', 'index.html')));
    for (const t of PRONTAS) assert.ok(existsSync(join(dir, toolPath(t), 'index.html')), t.slug);
    for (const t of TOOLS.filter((x) => x.status !== 'pronto')) assert.ok(!existsSync(join(dir, toolPath(t), 'index.html')), t.slug);
    const r = JSON.parse(readFileSync(join(dir, DATA_JSON.ranking), 'utf-8'));
    assert.equal(r.date, '2026-10-06');
    assert.ok(r.rows.length >= 60);
    const f = JSON.parse(readFileSync(join(dir, DATA_JSON.fatos), 'utf-8'));
    assert.equal(f.items.length, 5);                           // só FR e CM (os PR da fixture ficam fora)
    const js = readFileSync(join(dir, 'assets', 'js', 'ferramentas.js'), 'utf-8');
    const page = readFileSync(join(dir, 'ferramentas', 'radar-de-oportunidades', 'index.html'), 'utf-8');
    assert.ok(page.includes(`/assets/js/ferramentas.js?v=${hashOf(js)}`));
    assert.equal(readFileSync(join(dir, 'index.html'), 'utf-8'), `<script src="/assets/js/ferramentas.js?v=${hashOf(js)}" defer></script>`);

    // publicadas.json: só as prontas com página no disco, caminhos e JSONs que existem, bundle com hash.
    const pub = readPublished(dir)!;
    assert.deepEqual(pub, JSON.parse(readFileSync(join(dir, PUBLICADAS_PATH), 'utf-8')));
    assert.deepEqual(pub.ids, PRONTAS.map((t) => t.id));
    assert.deepEqual(pub.tools.map((t) => t.path), PRONTAS.map(toolPath));
    assert.equal(pub.hub, '/ferramentas/');
    assert.deepEqual(pub.data, { ranking: DATA_JSON.ranking, fatos: DATA_JSON.fatos, backtest: DATA_JSON.backtest });
    assert.equal(pub.assets!.js, `/assets/js/ferramentas.js?v=${hashOf(js)}`);
    assert.ok(!JSON.stringify(pub).includes('2026-'), 'sem data: o arquivo só muda quando o que está no ar muda');
    assert.equal(toolPageExists('radar-de-oportunidades', dir), true);
    assert.equal(toolPageExists('markowitz', dir), toolById('markowitz').status === 'pronto');

    // Mesmas regras do validate-html na saída real: páginas, links internos e bundle.
    const exists = (rel: string) => existsSync(join(dir, rel));
    for (const t of [{ slug: '' }, ...PRONTAS]) {
      const rel = t.slug ? `ferramentas/${t.slug}/index.html` : 'ferramentas/index.html';
      const html = readFileSync(join(dir, rel), 'utf-8');
      assert.deepEqual(toolPageProblems(t.slug, html), [], rel);
      assert.deepEqual(ferramentasLinkProblems(html, exists), [], rel);
      assert.deepEqual(bundleRefProblems(html, exists), [], rel);
      assert.deepEqual(widgetInLinkProblems(html), [], rel);
      assert.deepEqual(marcaHits(stripExternal(html)), [], rel);
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
    assert.deepEqual(readPublished(dir)!.ids, pub.ids);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateFerramentas: card do Painel macro no hub quando a página do Buffett está publicada no disco', async () => {
  const dir = tmp('ferr-hub-macro-');
  try {
    const quotes = quotesFixture();
    const run = () => silence(() => generateFerramentas({ outRoot: dir, fetch: false, now: NOW, data: { quotes, cvm: cvmFixture() }, build: { valuations: dividendsFixture(quotes), hasPage, airton: AIRTON } }));
    await run();
    assert.ok(!readFileSync(join(dir, 'ferramentas', 'index.html'), 'utf-8').includes('/macro/indicador-de-buffett/'));
    mkdirSync(join(dir, 'macro', 'indicador-de-buffett'), { recursive: true });
    writeFileSync(join(dir, 'macro', 'indicador-de-buffett', 'index.html'), '<!DOCTYPE html><html><head><meta name="robots" content="index, follow"></head></html>');
    await run();
    const hub = readFileSync(join(dir, 'ferramentas', 'index.html'), 'utf-8');
    assert.match(hub, /href="\/macro\/indicador-de-buffett\/"[^>]*>[\s\S]*?Painel macro/);
    assert.ok(ldOf(hub, 'CollectionPage').mainEntity.itemListElement.some((it: any) => it.url === 'https://iacoes.com.br/macro/indicador-de-buffett/'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateFerramentas: dado ruim não derruba, mas seção SSR não registrada derruba só aquela página (a anterior continua)', async () => {
  const dir = tmp('ferr-ssr-');
  const radar = toolById('radar');
  const original = radar.sections;
  try {
    const quotes = quotesFixture();
    const opts = { outRoot: dir, fetch: false, now: NOW, data: { quotes, cvm: cvmFixture() }, build: { valuations: dividendsFixture(quotes), hasPage, airton: AIRTON } } as const;
    await silence(() => generateFerramentas(opts));
    const file = join(dir, 'ferramentas', 'radar-de-oportunidades', 'index.html');
    const before = readFileSync(file, 'utf-8');
    radar.sections = [...original, { id: 'extra', title: 'Extra', blocks: [{ type: 'ssr', id: 'nao-existe' }] }];
    const { out: entries, warnings } = await silence(() => generateFerramentas(opts));
    assert.ok(warnings.some((w) => /radar: página não regerada \(a anterior continua\): .*nao-existe/.test(w)), warnings.join('\n'));
    assert.equal(readFileSync(file, 'utf-8'), before);
    assert.ok(entries.some((e) => e.loc === toolUrl(radar)), 'a página anterior continua no sitemap');
  } finally {
    radar.sections = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateFerramentas: ferramenta nova que falha na 1ª publicação não deixa link quebrado nas páginas montadas antes dela', async () => {
  // dcf vem depois do radar em TOOLS: o radar é montado antes e linkaria uma página que não existe,
  // o que reprovaria o build do dia inteiro na regra ferramentas-links do validate-html.
  const dir = tmp('ferr-nova-falha-');
  const dcf = toolById('dcf');
  const original = { status: dcf.status, sections: dcf.sections };
  try {
    dcf.status = 'pronto';
    dcf.sections = [...original.sections, { id: 'extra', title: 'Extra', blocks: [{ type: 'ssr', id: 'nao-registrada' }] }];
    const quotes = quotesFixture();
    const { out: entries, warnings } = await silence(() => generateFerramentas({
      outRoot: dir, fetch: false, now: NOW, stampLanding: false,
      data: { quotes, cvm: cvmFixture(), backtest: { ibov: BT_IBOV, cdi: BT_CDI } },
      build: { valuations: dividendsFixture(quotes), hasPage, airton: AIRTON },
    }));
    assert.ok(warnings.some((w) => /dcf: página não regerada .*nao-registrada/.test(w)), warnings.join('\n'));
    assert.ok(!existsSync(join(dir, toolPath(dcf), 'index.html')));
    assert.ok(!entries.some((e) => e.loc === toolUrl(dcf)));
    assert.ok(!readPublished(dir)!.ids.includes('dcf'));
    const exists = (rel: string) => existsSync(join(dir, rel));
    // O dcf é a ferramenta forçada a falhar: fica fora da lista mesmo quando o conteúdo dele está 'pronto'.
    for (const t of [{ slug: '' }, ...PRONTAS.filter((x) => x.id !== 'dcf')]) {
      const rel = t.slug ? `ferramentas/${t.slug}/index.html` : 'ferramentas/index.html';
      const html = readFileSync(join(dir, rel), 'utf-8');
      assert.ok(!html.includes(`href="${toolPath(dcf)}"`), `${rel} linka a ferramenta que não foi publicada`);
      assert.deepEqual(ferramentasLinkProblems(html, exists), [], rel);
    }
  } finally {
    dcf.status = original.status;
    dcf.sections = original.sections;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('backtest (DADOS-API §3 e §6): o gerador chama o produtor, publica o JSON e entrega o dado às seções SSR (env.extra.backtest)', async () => {
  const dir = tmp('ferr-bt-');
  const radar = toolById('radar');
  const original = radar.sections;
  // Séries sintéticas no formato das fontes (como em data.test.ts): 2 pregões por mês, CDI 1% a.m.
  const ibov: DailyClose[] = [];
  const cdi: MonthlyRate[] = [];
  let v = 17000;
  for (let y = 1999; y <= 2026; y++) {
    for (let mo = 1; mo <= 12; mo++) {
      const m = `${y}-${String(mo).padStart(2, '0')}`;
      if (m < '1999-12' || m > '2026-10') continue;
      ibov.push({ date: `${m}-10`, close: Math.round(v * 99) / 100 });
      v *= 1.01;
      ibov.push({ date: `${m}-${mo === 2 ? '27' : '28'}`, close: Math.round(v * 100) / 100 });
      if (m >= '2000-01') cdi.push({ month: m, rate: m === '2026-10' ? 0.2 : 1 });
    }
  }
  SECTIONS['bt-teste'] = ({ m }) => React.createElement('p', { 'data-bt': '' }, `dados até ${backtestOf(m.env)?.updated ?? '—'}`);
  try {
    radar.sections = [...original, { id: 'bt', title: 'Ibovespa e CDI', blocks: [{ type: 'ssr', id: 'bt-teste' }] }];
    const quotes = quotesFixture();
    const base = { outRoot: dir, fetch: false, now: NOW, build: { valuations: dividendsFixture(quotes), hasPage, airton: AIRTON } } as const;
    await silence(() => generateFerramentas({ ...base, data: { quotes, cvm: cvmFixture(), backtest: { ibov, cdi } } }));
    const bt = JSON.parse(readFileSync(join(dir, DATA_JSON.backtest), 'utf-8'));
    assert.equal(bt.updated, '2026-09-28');                     // último pregão do último mês completo
    assert.equal(readPublished(dir)!.data.backtest, DATA_JSON.backtest);
    assert.match(readFileSync(join(dir, toolPath(radar), 'index.html'), 'utf-8'), /<p data-bt="">dados até 2026-09-28<\/p>/);
    // 2ª execução sem dado novo: o arquivo anterior chega à página do mesmo jeito.
    await silence(() => generateFerramentas({ ...base, data: { quotes, cvm: cvmFixture() } }));
    assert.match(readFileSync(join(dir, toolPath(radar), 'index.html'), 'utf-8'), /dados até 2026-09-28/);
    // Página com dataSource 'backtest': {data} expandido, data-src no JSON; sem o dado, não sai.
    const t: ToolContent = { ...toolById('backtest'), dataSource: 'backtest', answer: 'Ibovespa e CDI com dados até {data}, numa série de {n} meses, para comparar com a sua carteira na plataforma.', widget: { ...toolById('backtest').widget, illustrative: false } };
    const m = buildToolModel(t, env({ extra: { backtest: bt } }));
    assert.match(m.answer, /dados até 28\/09\/2026, numa série de \d{3} meses/);
    assert.equal(m.dataSrc, DATA_JSON.backtest);
    assert.equal(m.refDate, '2026-09-28');
    assert.throws(() => buildToolModel(t, env({ extra: {} })), /sem dado/);   // env() padrão já traz o BT da fixture
    assert.deepEqual(structureProblems(t), []);
  } finally {
    radar.sections = original;
    delete SECTIONS['bt-teste'];
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateFerramentas (prévia): rascunhos com noindex, links e assets com basePath, entradas só das prontas', async () => {
  const dir = tmp('ferr-prev-');
  try {
    const quotes = quotesFixture();
    const { out: entries } = await silence(() => generateFerramentas({
      outRoot: dir, siteRoot: dir, basePath: '/preview', includeDrafts: true, fetch: false, now: NOW,
      data: { quotes, cvm: cvmFixture(), dividends: dividendsFixture(quotes), backtest: { ibov: BT_IBOV, cdi: BT_CDI } },
      build: { hasPage, airton: AIRTON },
    }));
    assert.equal(entries.length, 1 + PRONTAS.length);
    for (const t of TOOLS) assert.ok(existsSync(join(dir, toolPath(t), 'index.html')), t.slug);
    const draft = readFileSync(join(dir, 'ferramentas', 'markowitz', 'index.html'), 'utf-8');
    if (toolById('markowitz').status !== 'pronto') assert.match(draft, /noindex/);
    const radar = readFileSync(join(dir, 'ferramentas', 'radar-de-oportunidades', 'index.html'), 'utf-8');
    assert.match(radar, /src="\/preview\/assets\/js\/ferramentas\.js\?v=/);
    assert.match(radar, /href="\/preview\/ferramentas\/"/);
    assert.match(radar, /<link rel="canonical" href="https:\/\/iacoes\.com\.br\/ferramentas\/radar-de-oportunidades\/">/);
    const pub = readPublished(dir)!;
    assert.deepEqual(pub.ids, PRONTAS.map((t) => t.id));        // rascunho da prévia não conta como publicado
    assert.ok(pub.tools.every((t) => t.path.startsWith('/preview/ferramentas/')));
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
  const dir = tmp('ferr-macro-');
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
