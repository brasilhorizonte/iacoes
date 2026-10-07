/**
 * Páginas que já existiam e passam a receber o tráfego das ferramentas: ticker, /airton/,
 * /airton/{T}/, /acoes/, setores e a seção "E as ações que você acompanha?" do Buffett.
 * Uso: npx tsx --test scripts/paginas-existentes.test.ts
 *
 * 1. Honestidade (crítica §a17/§a18, honestidade-rotas.md): o Validador audita a ARGUMENTAÇÃO
 *    contra Fatos Relevantes e Comunicados (não "cruza com os números reais"); ITR/DFP não geram
 *    alerta; alerta em tempo real no WhatsApp é dos planos pagos; DCF sem "cenários"; nada de
 *    perguntas prontas com &prompt= (o app ignora).
 * 2. Links internos para /ferramentas/<slug>/ só quando a página está no disco (mesmo critério do
 *    hub), sem _iaClick.
 * 3. Aviso de proventos ajustados por desdobramento/grupamento/bonificação.
 * 4. FAQ visível == FAQPage (JSON-LD) no /airton/ e no /airton/{T}/; CTAs do /airton/ no formato
 *    do SPEC §2.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComprehensiveValuation, CvmDocument, FinancialData, TickerIndexEntry } from './types';
import { buildModel, dividends, type TickerModel } from './ticker/model';
import { TickerPage } from './ticker/page';
import { renderTickerPage } from './ticker/render';
import { renderBuffettPage } from './macro/render';
import { Aside, CvmDocs, Dividends, FinalCta, proventosAjustados } from './ticker/components/content';
import { Calculators } from './ticker/components/calculators';
import { Hero } from './ticker/components/hero';
import { FERRAMENTAS_LINKADAS, linkFerramenta, usarRaizDasFerramentas } from './ticker/components/links-ferramentas';
import { generateAirtonTickerHTML } from './airton-template';
import { generateIndexHTML, generateSectorPage } from './template';
import { buildBuffettModel } from './macro/model';
import { BuffettPage } from './macro/page';
import type { BuffettData, Point } from './macro/data';
import { forbiddenHits, htmlAuthorText } from './ferramentas/site';
import { parseAppHref, SECTION_TABS } from './ferramentas/links';
import { TOOLS } from './ferramentas/registry';

const ROOT = join(__dirname, '..');
const T = 'PETR4';

// ── Raiz com e sem as páginas de ferramenta ────────────────────────────────────────

const comPaginas = mkdtempSync(join(tmpdir(), 'iacoes-links-com-'));
const semPaginas = mkdtempSync(join(tmpdir(), 'iacoes-links-sem-'));
for (const slug of Object.values(FERRAMENTAS_LINKADAS)) {
  mkdirSync(join(comPaginas, 'ferramentas', slug), { recursive: true });
  writeFileSync(join(comPaginas, 'ferramentas', slug, 'index.html'), '<!DOCTYPE html><title>ok</title>', 'utf-8');
}
after(() => {
  usarRaizDasFerramentas(null);
  rmSync(comPaginas, { recursive: true, force: true });
  rmSync(semPaginas, { recursive: true, force: true });
});

function comRaiz<T>(raiz: string, fn: () => T): T {
  usarRaizDasFerramentas(raiz);
  try { return fn(); } finally { usarRaizDasFerramentas(null); }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────────────

function modeloTicker(docs: CvmDocument[] = [{ docType: 'FR', docTypeLabel: 'Fato Relevante', title: 'Documento de exemplo', date: '2026-10-01', excerpt: 'Resumo de exemplo.', link: 'https://www.rad.cvm.gov.br/' }]): TickerModel {
  const fundamentals = {
    symbol: T, name: 'Petróleo Brasileiro S.A. - Petrobras', sector: 'Petróleo, Gás e Biocombustíveis', subSector: 'Exploração e Refino', type: 'PN',
    price: 30, date: '2026-10-06', min52Week: 25, max52Week: 40, volMed2m: 5e8, marketCap: 4e11, firmValue: 6e11,
    lastBalanceDate: '2026-06-30', sharesOutstanding: 1.3e10, changeDay: 0.01, change12m: 0.1,
    pl: 5, pvp: 1.1, pebit: 3, psr: 0.8, divYield: 0.12, evEbitda: 3, evEbit: 4, lpa: 6, vpa: 27,
    grossMargin: 0.5, ebitMargin: 0.3, ebitdaMargin: 0.4, netMargin: 0.2, roic: 0.15, roe: 0.22,
    currentLiquidity: 1.1, debtEquity: 0.8, debtEbitda: 1.2,
  };
  const data = {
    ticker: T, price: 30, fundamentals, businessSummary: null,
    _rawIncome: [], _rawBalance: [], _rawCashFlow: [],
    _rawDividends: [{ symbol: T, amount: 1.5, exDate: '2026-05-02', paymentDate: '2026-06-01', dividendType: 'DIVIDENDO', currency: 'BRL' }],
  } as unknown as FinancialData;
  const val = { results: [], calculatedWacc: 0.14, sensitivityMatrix: [] } as unknown as ComprehensiveValuation;
  const all: TickerIndexEntry[] = [{ ticker: T, name: 'Petrobras', sector: fundamentals.sector, price: 30, pl: 5, divYield: 0.12, marketCap: 4e11, hasPage: true }];
  return buildModel(data, val, all, docs);
}

/** Mesma série sintética do macro.test.ts / deeplinks.test.ts (322 meses, nível conhecido). */
function serieBuffett(): BuffettData {
  const monthly: Point[] = [];
  const mcapMonthly: Point[] = [];
  const pib: Point[] = [];
  for (let i = 0; i < 321; i++) {
    const y = 2000 + Math.floor(i / 12);
    const mo = String((i % 12) + 1).padStart(2, '0');
    const value = 30 + (i % 40);
    monthly.push({ date: `${y}-${mo}-28`, value });
    mcapMonthly.push({ date: `${y}-${mo}-28`, value: value * 1000 });
    if (`${y}-${mo}` < '2026-07') pib.push({ date: `${y}-${mo}-01`, value: 100000 });
  }
  monthly.push({ date: '2026-10-02', value: 40.43 });
  pib.push({ date: '2026-07-01', value: 13258459.8 }, { date: '2026-08-01', value: 13342452.6 });
  return { monthly, mcapMonthly, mcapDaily: [{ date: '2026-10-02', value: 5393880.66 }], pib };
}

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const decodificar = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Tags <a> que apontam para um caminho (atributos decodificados). */
function ancoras(h: string, prefixo: string): { tag: string; href: string; texto: string }[] {
  return [...h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ tag: m[1], href: decodificar(/href="([^"]*)"/.exec(m[1])?.[1] ?? ''), texto: decodificar(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() }))
    .filter((a) => a.href.startsWith(prefixo));
}

/** FAQ visível (<details><summary>…</summary><p>…</p>) e o FAQPage do JSON-LD, como texto puro. */
function faqs(h: string): { visivel: [string, string][]; ld: [string, string][] } {
  const texto = (s: string) => decodificar(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const visivel = [...h.matchAll(/<details[^>]*><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => [texto(m[1]), texto(m[2])] as [string, string]);
  let ld: [string, string][] = [];
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const parsed = JSON.parse(m[1]);
    for (const o of Array.isArray(parsed) ? parsed : [parsed]) {
      if (o['@type'] === 'FAQPage') ld = o.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text]);
    }
  }
  return { visivel, ld };
}

/** Links para o app, com data-cta e o `next` decodificado (aceita os refs do site e do /airton/). */
function ctasDoApp(h: string): { cta: string; onclick: string; href: string; next: string }[] {
  return [...h.matchAll(/<a\b[^>]*href="(https:\/\/app\.brasilhorizonte\.com\.br[^"]*)"[^>]*>/g)].map((m) => {
    const tag = m[0];
    const href = decodificar(m[1]);
    // Mesmo parser dos testes das ferramentas: troca o ref do /airton/ e tira o utm_content do fim.
    const normal = href.replace(/\?ref=iacoes-airton&/, '?ref=iacoes&').replace(/&utm_content=[a-z0-9-]+$/, '');
    const p = parseAppHref(normal);
    assert.ok(p.ok, `CTA fora do formato do SPEC §2: ${href} (${p.ok ? '' : p.reason})`);
    return { cta: /data-cta="([^"]*)"/.exec(tag)?.[1] ?? '', onclick: /onclick="([^"]*)"/.exec(tag)?.[1] ?? '', href, next: p.ok ? p.next : '' };
  });
}

// ── Links para /ferramentas/ ─────────────────────────────────────────────────────────

test('os slugs linkados batem com o registro das ferramentas', () => {
  for (const [id, slug] of Object.entries(FERRAMENTAS_LINKADAS)) {
    assert.ok(TOOLS.some((t) => t.id === id && t.slug === slug), `${id} → ${slug} não está no registro (scripts/ferramentas/registry.ts)`);
  }
});

test('linkFerramenta: só com o index.html no disco (mesmo critério do hub)', () => {
  comRaiz(semPaginas, () => { for (const id of Object.keys(FERRAMENTAS_LINKADAS)) assert.equal(linkFerramenta(id as keyof typeof FERRAMENTAS_LINKADAS), null); });
  comRaiz(comPaginas, () => { assert.equal(linkFerramenta('dcf'), '/ferramentas/fluxo-de-caixa-descontado/'); });
});

test('ticker: sem página publicada, nenhum link para /ferramentas/<slug>/', () => {
  const pagina = comRaiz(semPaginas, () => html(React.createElement(TickerPage, { m: modeloTicker() })));
  assert.deepEqual(ancoras(pagina, '/ferramentas/').filter((a) => a.href !== '/ferramentas/'), []);
});

test('ticker: com as páginas publicadas, DCF, calculadora, nota e CVM linkam a ferramenta (sem _iaClick)', () => {
  const m = modeloTicker();
  const pagina = comRaiz(comPaginas, () => html(React.createElement(TickerPage, { m })));
  const links = ancoras(pagina, '/ferramentas/').filter((a) => a.href !== '/ferramentas/');
  const por = (href: string) => links.filter((a) => a.href === href);
  assert.equal(por('/ferramentas/fluxo-de-caixa-descontado/').length, 1, 'card DCF → /ferramentas/fluxo-de-caixa-descontado/');
  assert.equal(por('/ferramentas/calculadora-preco-justo/').length, 1, 'calculadoras → /ferramentas/calculadora-preco-justo/');
  assert.equal(por('/ferramentas/calculadora-preco-justo/')[0].texto, 'calculadora de preço justo e preço teto', 'âncora da calculadora');
  assert.equal(por('/ferramentas/nota-qualitativa/').length, 1, 'nota → /ferramentas/nota-qualitativa/');
  assert.equal(por('/ferramentas/fatos-relevantes/').length, 1, 'bloco da CVM → /ferramentas/fatos-relevantes/');
  for (const a of links) {
    assert.doesNotMatch(a.tag, /data-cta=/, `link interno com data-cta vira _iaClick: ${a.href}`);
    assert.match(a.tag, /data-track="tk-[a-z-]+"/, `link interno sem data-track: ${a.href}`);
  }
  // O DCF fica dentro do card da matriz de sensibilidade; a calculadora, no topo das calculadoras.
  const calc = pagina.slice(pagina.indexOf('id="calculadoras"'));
  assert.ok(calc.indexOf('/ferramentas/calculadora-preco-justo/') < calc.indexOf('data-calc="graham"'), 'link da calculadora no cabeçalho da seção');
  assert.ok(pagina.indexOf('/ferramentas/fluxo-de-caixa-descontado/') > pagina.indexOf('dcf-lock-msg'), 'link do DCF no card da matriz');
  // Sem documento da CVM, sem bloco da CVM e sem o link dos fatos relevantes.
  const semCvm = comRaiz(comPaginas, () => html(React.createElement(TickerPage, { m: modeloTicker([]) })));
  assert.equal(ancoras(semCvm, '/ferramentas/fatos-relevantes/').length, 0);
});

test('ticker (página inteira): o data-track dos links para /ferramentas/ vira _iaTrack, sem _iaClick', () => {
  const pagina = comRaiz(comPaginas, () => renderTickerPage(modeloTicker()));
  for (const id of ['tk-dcf', 'tk-calculadora', 'tk-nota-qualitativa', 'tk-fatos-relevantes']) {
    assert.ok(pagina.includes(`onclick="_iaTrack('cta_click','${id}')" data-track="${id}"`), `${id} sem _iaTrack`);
  }
  for (const a of ancoras(pagina, '/ferramentas/')) assert.doesNotMatch(a.tag, /_iaClick/, `link interno com _iaClick: ${a.href}`);
});

// ── Honestidade nas páginas de ticker ────────────────────────────────────────────────

test('ticker: card de auditoria leva ao Validador e diz o que ele faz (argumentação × CVM)', () => {
  const m = modeloTicker();
  const aside = html(React.createElement(Aside, { m }));
  assert.match(aside, /Validador de Teses/);
  assert.match(aside, /audita a argumentação/);
  assert.match(aside, /Fatos Relevantes e Comunicados/);
  assert.doesNotMatch(aside, /números reais/i);
  assert.doesNotMatch(aside, /prompt=/, 'o app ignora &prompt=');
  assert.equal(m.links.airton.includes(encodeURIComponent('t=validador')), true, 'm.links.airton é o Validador');
  assert.match(aside, /data-cta="airton-audit"/);
  // Prova social sintética fica como está (decisão do dono).
  assert.match(aside, /investidores já validaram teses em PETR4/);
});

test('ticker: sem ITR/DFP "assim que saem", sem alerta grátis no WhatsApp, DCF sem "cenários"', () => {
  const m = modeloTicker();
  const blocos = [Hero, Aside, Calculators, CvmDocs, FinalCta, Dividends].map((C) => html(React.createElement(C, { m })));
  const texto = htmlAuthorText(blocos.join('\n'));
  for (const re of [/ITR, DFP/i, /assim que saem/i, /no WhatsApp com sua conta grátis/i, /cen[áa]rios?/i, /Grátis para começar\. Sem cartão/i, /Salvar e criar alerta/i, /cruza a tese/i]) {
    assert.doesNotMatch(texto, re, `texto proibido: ${re}`);
  }
  assert.deepEqual(forbiddenHits(texto, 'page'), []);
  // Card do DCF no topo: o modelo do app (10 anos + perpetuidade; a IA propõe, você decide).
  assert.match(texto, /10 anos \+ perpetuidade/);
  assert.match(texto, /a IA propõe, você decide/);
  // Alerta em tempo real: sempre dito como dos planos pagos.
  assert.match(texto, /tempo real no WhatsApp e no Telegram nos planos pagos/);
  assert.match(texto, /Nos planos pagos: Fato Relevante e Comunicado em tempo real/);
  // O botão das calculadoras leva à tese do ativo e não promete alerta.
  const calc = html(React.createElement(Calculators, { m }));
  assert.match(calc, /Registrar meu preço-alvo/);
  assert.doesNotMatch(calc, /WhatsApp/);
  for (const id of ['graham', 'bazin', 'gordon']) assert.match(calc, new RegExp(`data-cta="calc-alerta-${id}"`));
});

test('ticker: FAQ (visível e FAQPage) sem "cenários" no DCF; a IA propõe as premissas, o WACC é calculado', () => {
  const m = modeloTicker();
  // Os cenários bear/base/bull não existem no modelo editável do Valuation (honestidade-rotas.md).
  assert.doesNotMatch(m.faq.map((f) => `${f.q} ${f.a}`).join('\n'), /cen[áa]rios?/i);
  const dcf = m.faq.find((f) => /pelo DCF/.test(f.q));
  assert.ok(dcf, 'pergunta do DCF');
  assert.match(dcf.a, /a IA propõe as premissas/);
  assert.match(dcf.a, /você decide/);
  assert.doesNotMatch(dcf.a, /IA propõe[^.;]*WACC/, 'o WACC não é premissa proposta pela IA');
  assert.deepEqual(forbiddenHits(dcf.a, 'page'), []);
});

// ── Proventos ajustados ──────────────────────────────────────────────────────────────

test('dividendos: aviso de ajuste só quando algum provento foi ajustado', () => {
  const base = modeloTicker();
  const AVISO = 'Valores por ação ajustados por desdobramento, grupamento e bonificação.';
  const comDiv = (div: Record<string, unknown>) => ({ ...base, div: { ...base.div, ...div } }) as TickerModel;
  const render = (m: TickerModel) => decodificar(html(React.createElement(Dividends, { m })));

  // Sem marcação nenhuma (modelo atual): sem aviso.
  assert.equal(proventosAjustados(base.div), false);
  assert.ok(!render(base).includes(AVISO));
  // Flag da lista inteira no modelo.
  assert.ok(render(comDiv({ adjusted: true })).includes(AVISO));
  assert.ok(!render(comDiv({ adjusted: false })).includes(AVISO));
  // Campos do ajuste (scripts/lib/splits.ts) nas linhas da tabela.
  const recent = base.div.recent.map((r, i) => (i === 0 ? { ...r, amountDeclared: r.amount * 5, splitDivisor: 5 } : r));
  assert.ok(render(comDiv({ recent })).includes(AVISO));
  const naoAjustado = base.div.recent.map((r) => ({ ...r, splitDivisor: 1 }));
  assert.ok(!render(comDiv({ recent: naoAjustado })).includes(AVISO));
});

test('dividendos: o modelo marca div.adjusted quando a fonte ajustou algum provento (ex.: SBSP3, 5:1)', () => {
  // Sem esse campo o aviso acima nunca aparecia na página real: as linhas de `recent` não levam
  // splitDivisor/amountDeclared. Linhas como as que scripts/lib/splits.ts devolve.
  const agora = new Date('2026-10-06T12:00:00Z');
  const linha = (amount: number, exDate: string, extra: Record<string, unknown> = {}) =>
    ({ symbol: T, amount, exDate, paymentDate: exDate, dividendType: 'JCP', currency: 'BRL', ...extra });
  const ajustado = dividends({ price: 30, _rawDividends: [linha(0.52, '2025-04-29', { amountDeclared: 2.6, splitDivisor: 5 }), linha(0.4, '2026-06-01')] } as unknown as FinancialData, agora);
  const semAjuste = dividends({ price: 30, _rawDividends: [linha(0.4, '2026-06-01'), linha(0.3, '2025-06-01', { splitDivisor: 1 })] } as unknown as FinancialData, agora);
  assert.equal(ajustado.adjusted, true);
  assert.equal(semAjuste.adjusted, false);
  const base = modeloTicker();
  const AVISO = 'Valores por ação ajustados por desdobramento, grupamento e bonificação.';
  const render = (div: TickerModel['div']) => decodificar(html(React.createElement(Dividends, { m: { ...base, div } })));
  assert.ok(render(ajustado).includes(AVISO), 'modelo ajustado → aviso na página');
  assert.ok(!render(semAjuste).includes(AVISO), 'sem ajuste → sem aviso');
});

// ── /airton/{T}/ ─────────────────────────────────────────────────────────────────────

function paginaAirton(): string {
  // O resumo da CVM traz termos que o texto autoral não pode ter ("14 dias", "potencial"): ficam
  // no bloco data-fonte="cvm" e não podem acusar a página. Montado em pedaços para nenhum gate de
  // fonte tropeçar no literal.
  const resumoComTermosProibidos = `O Conselho aprovou dividendos. Prazo de ${'14 ' + 'dias'} para ${'poten' + 'cial'} ajuste.`;
  const docs: CvmDocument[] = [
    { docType: 'FR', docTypeLabel: 'Fato Relevante', title: 'Aprovação de dividendos intercalares', date: '2026-10-01', excerpt: resumoComTermosProibidos, link: 'https://www.rad.cvm.gov.br/a' },
    { docType: 'CM', docTypeLabel: 'Comunicado ao Mercado', title: 'Esclarecimento sobre notícia', date: '2026-09-20', excerpt: 'A companhia esclarece notícia veiculada.', link: 'https://www.rad.cvm.gov.br/b' },
    { docType: 'ITR', docTypeLabel: 'ITR', title: 'Informações trimestrais', date: '2026-08-10', excerpt: '', link: 'https://www.rad.cvm.gov.br/c' },
  ];
  return generateAirtonTickerHTML({ symbol: T, name: 'Petrobras', sector: 'Petróleo, Gás e Biocombustíveis', docs, docsIn90Days: 3, docsIn90DaysCapped: false });
}

test('/airton/{T}/: FAQ visível idêntico ao FAQPage e sem as promessas falsas', () => {
  const h = paginaAirton();
  const { visivel, ld } = faqs(h);
  assert.ok(ld.length >= 4);
  assert.deepEqual(visivel, ld, 'texto visível e JSON-LD idênticos');
  const texto = htmlAuthorText(h);
  for (const re of [/Grátis, sem cartão/i, /antes do mercado/i, /no instante/i, /já vem selecionado/i, /cinco métodos/i, /em segundos/i, /resumo do AIrton pronto/i, /cada alerta/i]) {
    assert.doesNotMatch(texto, re, `texto proibido: ${re}`);
  }
  // Os resumos da CVM ficam marcados como dado externo (data-fonte="cvm") e fora das checagens.
  assert.match(h, /data-fonte="cvm"/);
  assert.deepEqual(forbiddenHits(texto, 'page'), []);
  assert.match(texto, /ITR e DFP não geram alerta/);
  assert.match(texto, /planos pagos/);
  assert.doesNotMatch(h, /prompt=|intent=/, 'o app ignora prompt e intent');
});

test('/airton/{T}/: CTAs no formato do SPEC §2 (Notificações, AIrton, Validador, Documentos do ativo)', () => {
  const ctas = ctasDoApp(paginaAirton());
  assert.ok(ctas.length >= 8);
  const esperado: Record<string, string[]> = {
    'nav-comecar': ['/?s=workspace&_='],
    'footer-link': ['/?s=workspace&_='],
    'hero-alerta': [`/?s=home&t=notificacoes&ticker=${T}&_=`],
    'final-alerta': [`/?s=home&t=notificacoes&ticker=${T}&_=`],
    'sticky-mobile': [`/?s=home&t=notificacoes&ticker=${T}&_=`],
    'doc-open': [`/ativo/${T}?tab=docs&_=`],
    'airton-prompt': ['/?s=workspace&_=', `/?s=ianalista&t=validador&ticker=${T}&autorun=1&_=`],
  };
  for (const c of ctas) {
    assert.ok(c.cta, `CTA sem data-cta: ${c.href}`);
    assert.equal(c.onclick, '_iaClick(event)', `${c.cta}: sem _iaClick`);
    assert.ok(esperado[c.cta], `CTA inesperado: ${c.cta}`);
    assert.ok(esperado[c.cta].includes(c.next), `${c.cta} → ${c.next}`);
    assert.match(c.href, /^https:\/\/app\.brasilhorizonte\.com\.br\/authnew\?ref=iacoes-airton&next=/);
  }
  assert.ok(ctas.some((c) => c.next.includes('t=validador')), 'a pergunta da tese leva ao Validador');
  assert.ok(ctas.filter((c) => c.cta === 'doc-open').every((c) => /&utm_content=doc-[a-z]+-\d{4}-\d{2}-\d{2}$/.test(c.href)), 'doc-open identifica o documento');
});

test('/airton/{T}/: ITR/DFP não viram alerta na simulação; o botão só promete resumo quando ele existe', () => {
  const doc = (docType: string, docTypeLabel: string, date: string, excerpt: string): CvmDocument =>
    ({ docType, docTypeLabel, title: `Título do ${docTypeLabel}`, date, excerpt, link: 'https://www.rad.cvm.gov.br/x' });
  const gerar = (docs: CvmDocument[]) =>
    generateAirtonTickerHTML({ symbol: T, name: 'Petrobras', sector: 'Petróleo, Gás e Biocombustíveis', docs, docsIn90Days: docs.length, docsIn90DaysCapped: false });
  const cartoes = (h: string) => [...h.matchAll(/<li class="card-msg"[\s\S]*?<\/li>/g)].map((m) => m[0]);

  // Último documento é ITR (não gera alerta no app): sem push, og:title sem "avisou", cartão marcado.
  const itr = gerar([
    doc('ITR', 'Informações Trimestrais', '2026-08-10', ''),
    doc('FR', 'Fato Relevante', '2026-08-01', 'Resumo do fato.'),
    doc('CM', 'Comunicado ao Mercado', '2026-07-20', ''),
  ]);
  assert.doesNotMatch(itr, /id="push"/, 'sem push de WhatsApp para ITR');
  assert.doesNotMatch(itr, /avisou: Informações Trimestrais/);
  assert.match(itr, /property="og:title" content="AIrton avisa quando PETR4 publica Fato Relevante ou Comunicado"/);
  assert.match(itr, /if\(push\)\{/, 'o JS da simulação aguenta a página sem push');
  const [cItr, cFr, cCm] = cartoes(itr);
  assert.match(cItr, /não gera alerta/);
  assert.doesNotMatch(cItr, /resumo completo/, 'o leitor do app não mostra resumo de ITR/DFP');
  assert.match(cFr, /Ler o resumo completo na plataforma/);
  assert.doesNotMatch(cFr, /não gera alerta/);
  assert.match(cCm, /Abrir os documentos de PETR4 na plataforma/, 'CM sem resumo não promete resumo');
  assert.doesNotMatch(cCm, /não gera alerta/);

  // Último documento é Fato Relevante: push e og:title com ele.
  const fr = gerar([doc('FR', 'Fato Relevante', '2026-08-01', 'Resumo do fato.')]);
  assert.match(fr, /id="push"/);
  assert.match(fr, /AIrton avisou: Fato Relevante de PETR4 em 01\/08\/2026/);
  assert.match(htmlAuthorText(fr), /com o resumo pronto/);
  // FR sem resumo: a frase do topo não promete resumo pronto.
  assert.doesNotMatch(htmlAuthorText(gerar([doc('FR', 'Fato Relevante', '2026-08-01', '')])), /com o resumo pronto/);
});

// ── /airton/ (HTML escrito à mão) ────────────────────────────────────────────────────

test('/airton/: FAQ visível idêntico ao FAQPage, sem promessas falsas, CTAs com deep link', () => {
  const h = readFileSync(join(ROOT, 'airton', 'index.html'), 'utf-8');
  const { visivel, ld } = faqs(h);
  assert.equal(ld.length, 7);
  assert.deepEqual(visivel, ld, 'texto visível e JSON-LD idênticos');
  const texto = htmlAuthorText(h);
  for (const re of [/Grátis, sem cartão/i, /antes do mercado/i, /números reais/i, /no instante/i, /na hora/i, /CVM inteira/i, /cen[áa]rios/i, /ITR e DFP\b(?! não)/]) {
    assert.doesNotMatch(texto, re, `texto proibido: ${re}`);
  }
  assert.deepEqual(forbiddenHits(texto, 'page'), []);
  assert.doesNotMatch(h, /prompt=|intent=/, 'o app ignora prompt e intent');
  const ctas = ctasDoApp(h);
  const destino: Record<string, (next: string) => boolean> = {
    'nav-comecar': (n) => n === '/?s=workspace&_=',
    'plano-free': (n) => n === '/?s=workspace&_=',
    'footer-link': (n) => n === '/?s=workspace&_=',
    'hero-trial': (n) => n === '/?s=home&t=notificacoes&_=',
    'final-trial': (n) => n === '/?s=home&t=notificacoes&_=',
    'sticky-mobile': (n) => n === '/?s=home&t=notificacoes&_=',
    'plano-ianalista': (n) => n === '/?s=home&t=notificacoes&_=',
    'airton-prompt': (n) => n === '/?s=workspace&_=' || n === '/?s=ianalista&t=validador&ticker=ITUB4&autorun=1&_=',
  };
  assert.equal(ctas.length, 10);
  for (const c of ctas) {
    assert.ok(destino[c.cta], `CTA inesperado: ${c.cta}`);
    assert.ok(destino[c.cta](c.next), `${c.cta} → ${c.next}`);
    assert.equal(c.onclick, '_iaClick(event)');
  }
  assert.ok(SECTION_TABS.home.includes('notificacoes'));
});

// ── /acoes/, setores e Buffett ───────────────────────────────────────────────────────

const tickersIndice: TickerIndexEntry[] = [
  { ticker: 'PETR4', name: 'Petrobras', sector: 'Petróleo, Gás e Biocombustíveis', price: 30, pl: 5, divYield: 0.12, marketCap: 4e11, hasPage: true },
  { ticker: 'PRIO3', name: 'PRIO', sector: 'Petróleo, Gás e Biocombustíveis', price: 40, pl: 7, divYield: 0.02, marketCap: 3e10, hasPage: true },
];

test('/acoes/ e setores: "ordenar por indicador" → ranking só com a página publicada (sem _iaClick)', () => {
  const sem = comRaiz(semPaginas, () => [generateIndexHTML(tickersIndice), generateSectorPage('Petróleo, Gás e Biocombustíveis', tickersIndice)]);
  for (const h of sem) assert.equal(ancoras(h, '/ferramentas/ranking-de-acoes/').length, 0);

  const [indice, setor] = comRaiz(comPaginas, () => [generateIndexHTML(tickersIndice), generateSectorPage('Petróleo, Gás e Biocombustíveis', tickersIndice)]);
  const li = ancoras(indice, '/ferramentas/ranking-de-acoes/');
  assert.equal(li.length, 1);
  // A página do ranking só ordena (sem filtro): o rótulo não promete "filtrar".
  assert.match(li[0].texto, /^Ordenar por indicador: ranking de ações da B3 por dividendos, P\/L, P\/VP e ROE/);
  assert.doesNotMatch(li[0].texto, /filtrar/i);
  assert.match(li[0].tag, /onclick="_iaTrack\('cta_click','acoes-ranking'\)"/);
  assert.doesNotMatch(li[0].tag, /data-cta=|_iaClick/);
  const ls = ancoras(setor, '/ferramentas/ranking-de-acoes/');
  assert.equal(ls.length, 1);
  assert.match(ls[0].texto, /^Ordenar por indicador/);
  // Setor não carrega o tracking: link simples, sem onclick.
  assert.doesNotMatch(ls[0].tag, /onclick=/);
  // Rodapé com o nome do site (dizia "ValuAI by Brasil Horizonte"). O título "Todas as Ações da B3"
  // do /acoes/ é a identidade da página (lista de todas as páginas de ação) e fica como está.
  assert.doesNotMatch(htmlAuthorText(indice), /ValuAI/);
  assert.deepEqual(forbiddenHits(htmlAuthorText(setor), 'page'), []);
});

test('Buffett: "E as ações que você acompanha?" linka o ranking só com a página publicada', () => {
  const m = buildBuffettModel(serieBuffett(), { today: new Date('2026-10-06T12:00:00Z') });
  const secao = (h: string) => h.slice(h.indexOf('id="acoes"'), h.indexOf('id="metodologia"'));
  const sem = comRaiz(semPaginas, () => html(React.createElement(BuffettPage, { m })));
  assert.equal(ancoras(secao(sem), '/ferramentas/').length, 0);
  const com = comRaiz(comPaginas, () => html(React.createElement(BuffettPage, { m })));
  const links = ancoras(secao(com), '/ferramentas/ranking-de-acoes/');
  assert.equal(links.length, 1);
  assert.match(links[0].tag, /data-track="buffett-ranking"/);
  assert.doesNotMatch(links[0].tag, /data-cta=/);
  // O link para /acoes/ continua na seção, e a seção não promete "todas as ações da B3".
  assert.equal(ancoras(secao(com), '/acoes/').length, 1);
  assert.deepEqual(forbiddenHits(htmlAuthorText(secao(com)), 'page'), []);
  // Na página inteira, o data-track vira _iaTrack (link interno medido, sem redirect).
  const pagina = comRaiz(comPaginas, () => renderBuffettPage(m));
  assert.ok(pagina.includes(`onclick="_iaTrack('cta_click','buffett-ranking')" data-track="buffett-ranking"`), 'buffett-ranking sem _iaTrack');
});

// ── Polimento da base (07/10/2026): nome limpo, título cru da CVM e textos ────────────

/** Modelo de ticker com o nome como a brapi grava (long_name em inglês, com a classe). */
function modeloComNome(nome: string, nomeIndice: string, docs: CvmDocument[] = []): TickerModel {
  const S = 'BPAC11';
  const fundamentals = {
    symbol: S, name: nome, sector: 'Financeiro', subSector: 'Bancos', type: 'UNT',
    price: 40, date: '2026-10-06', min52Week: 30, max52Week: 45, volMed2m: 3e8, marketCap: 2e11, firmValue: 2e11,
    lastBalanceDate: '2026-06-30', sharesOutstanding: 5e9, changeDay: 0.01, change12m: 0.1,
    pl: 9, pvp: 2, pebit: 5, psr: 3, divYield: 0.03, evEbitda: 6, evEbit: 7, lpa: 4, vpa: 20,
    grossMargin: 0.5, ebitMargin: 0.4, ebitdaMargin: 0.45, netMargin: 0.3, roic: 0.15, roe: 0.2,
    currentLiquidity: 1.1, debtEquity: 0.8, debtEbitda: 1.2,
  };
  const data = { ticker: S, price: 40, fundamentals, businessSummary: null, _rawIncome: [], _rawBalance: [], _rawCashFlow: [], _rawDividends: [] } as unknown as FinancialData;
  const val = { results: [], calculatedWacc: 0.14, sensitivityMatrix: [] } as unknown as ComprehensiveValuation;
  const all: TickerIndexEntry[] = [{ ticker: S, name: nomeIndice, sector: 'Financeiro', price: 40, pl: 9, divYield: 0.03, marketCap: 2e11, hasPage: true }];
  return buildModel(data, val, all, docs);
}

/** ITR como chega de cvm_documents: o metadado cru no lugar do título. */
const ITR_CRU: CvmDocument = { docType: 'ITR', docTypeLabel: 'Informações Trimestrais', title: 'BCO BTG PACTUAL S.A. | ref 2026-06-30 | v3 | id 160881', date: '2026-08-14', excerpt: '', link: 'https://www.rad.cvm.gov.br/i' };

test('/airton/{T}/: nome limpo no title (≤ 60), na frase do topo, no FAQ e no JSON-LD; título cru de ITR/DFP some', () => {
  const docs: CvmDocument[] = [
    ITR_CRU,
    { docType: 'FR', docTypeLabel: 'Fato Relevante', title: 'Aquisição de participação', date: '2026-08-01', excerpt: 'Resumo do fato relevante.', link: 'https://www.rad.cvm.gov.br/f' },
  ];
  const h = generateAirtonTickerHTML({ symbol: 'BPAC11', name: 'Banco BTG Pactual SA Units Cons of 1 Sh + 2 Pfd Shs A', sector: 'Financeiro', docs, docsIn90Days: 2, docsIn90DaysCapped: false });
  const titulo = decodificar(/<title>([^<]*)<\/title>/.exec(h)![1]);
  assert.equal(titulo, 'BPAC11: Fatos Relevantes de Banco BTG Pactual | iAções');
  assert.ok(titulo.length <= 60, `${titulo.length} caracteres`);
  // Nada do nome cru da brapi nem do metadado da CVM em lugar nenhum da página (visível, meta ou JSON-LD).
  assert.doesNotMatch(h, /Units Cons|Pfd Shs|\| ref 20\d\d|\| v3 \||id 160881/);
  assert.match(/<p class="hero-sub">([\s\S]*?)<\/p>/.exec(h)![1], /Banco BTG Pactual enviou à CVM/);
  const { visivel, ld } = faqs(h);
  assert.deepEqual(visivel, ld);
  assert.ok(visivel.some(([, a]) => a.includes('de Banco BTG Pactual chega')), 'FAQ com o nome limpo');
  assert.match(h, /"@type": "Corporation", "name": "Banco BTG Pactual"/);
  // O cartão do ITR mostra o período de referência no lugar do título cru (e a meta description também).
  assert.match(h, /<span class="ttl">Trimestre encerrado em 30\/06\/2026<\/span>/);
  assert.match(/<meta name="description" content="([^"]*)"/.exec(h)![1], /Informações Trimestrais de 14\/08\/2026 — Trimestre encerrado em 30\/06\/2026/);
  // title: com o nome quando cabe em 60; senão, sem o nome.
  const titleDe = (symbol: string, name: string) => decodificar(/<title>([^<]*)<\/title>/.exec(generateAirtonTickerHTML({ symbol, name, sector: '', docs: [], docsIn90Days: 0, docsIn90DaysCapped: false }))![1]);
  assert.equal(titleDe('WEGE3', 'WEG SA'), 'WEGE3: Fatos Relevantes e Comunicados de WEG | iAções');
  assert.equal(titleDe('SBSP3', 'Companhia de Saneamento Basico do Estado de Sao Paulo SABESP'), 'SBSP3: Fatos Relevantes e Comunicados na CVM | iAções');
});

test('/airton/: o H2 dos exemplos não sugere que a pergunta escolhida vai pronta para o app', () => {
  const h = readFileSync(join(ROOT, 'airton', 'index.html'), 'utf-8');
  assert.match(h, /<h2 class="sec-title reveal">Exemplos para começar\. O <span class="ai">AI<\/span>rton responde assim que sua conta existir\.<\/h2>/);
  assert.doesNotMatch(h, />Escolha\. O /);
});

test('ticker: meta description "faça o DCF completo na plataforma"; sem o campo morto airtonQuestions; nota qualitativa → página do ativo', () => {
  const m = modeloTicker();
  assert.match(m.seo.description, /Graham, Bazin e Gordon e faça o DCF completo na plataforma\./);
  assert.doesNotMatch(m.seo.description, /veja o DCF completo/);
  assert.equal('airtonQuestions' in m, false);
  const aside = html(React.createElement(Aside, { m }));
  const nota = ancoras(aside, 'https://app.brasilhorizonte.com.br').find((a) => /data-cta="nota-qualitativa"/.test(a.tag));
  assert.ok(nota, 'item "Nota qualitativa" do card "Na plataforma"');
  assert.equal(nota.href, m.links.asset, 'a nota de cada empresa abre na página do ativo, não na Home');
});

test('ticker: nome curto pela limpeza única (brapi em inglês com a classe) e título cru de ITR fora do bloco da CVM', () => {
  const m = modeloComNome('Banco BTG Pactual SA Units Cons of 1 Sh + 2 Pfd Shs A', 'Banco BTG Pactual SA Units Cons of 1 Sh + 2 Pfd Shs A', [ITR_CRU]);
  assert.equal(m.shortName, 'Banco BTG Pactual');
  assert.match(m.seo.h1Sub, /^Banco BTG Pactual: /);
  assert.match(m.seo.description, /preço justo de Banco BTG Pactual por Graham/);
  const cvm = html(React.createElement(CvmDocs, { m }));
  assert.doesNotMatch(cvm, /\| ref 20\d\d|id 160881/);
  assert.match(cvm, /Trimestre encerrado em 30\/06\/2026/);
  // A abreviação da B3 ("KARSTEN     ON") só vale sem o nome longo.
  assert.equal(modeloComNome('Karsten S.A.Non-Cum Perp Pfd Registered Shs', 'KARSTEN     ON').shortName, 'Karsten');
  assert.equal(modeloTicker().shortName, 'Petrobras');
});
