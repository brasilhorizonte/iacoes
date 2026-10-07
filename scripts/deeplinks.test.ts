/**
 * Deep links do site para o app (SPEC §2): o clique inteiro, do href até a tela que abre.
 * Uso: npx tsx --test scripts/deeplinks.test.ts
 *
 * 1. href: páginas de ticker e do Buffett renderizadas a partir do modelo; landing lida do
 *    index.html (inclusive o trecho de JS da calculadora que monta o alerta e o "Recalcular").
 * 2. Navegador: roda o tracking DE VERDADE (scripts/ticker/head-tracking.html e os <script> da
 *    landing) num vm com DOM de mentira: fbclid propagado no DOMContentLoaded e utm_* do _iaClick.
 * 3. App: o Auth.tsx cola '?' + o resto da query no `next`; pelo Google só o `next` volta. O React
 *    Router corta a query no PRIMEIRO '?'; o App.tsx lê s/t; a página do ativo lê `tab`; Validador
 *    e Valuation leem `ticker`/`autorun`.
 *
 * O app mora em outro repositório (dashbrasilhorizonte) e o CI daqui não o enxerga: as regras do
 * passo 3 são cópia de src/pages/Auth.tsx:309-317, src/lib/safeRedirect.ts, src/auth/useAuth.tsx:366-371,
 * App.tsx:115-173, src/lib/sectionTools.ts:43-78, src/lib/assetRoute.ts:12-28 e src/lib/b3Ticker.ts:41,
 * lidas em 06/10/2026. Se o app mudar, atualize aqui.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createContext, runInContext } from 'node:vm';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComprehensiveValuation, CvmDocument, FinancialData, TickerIndexEntry } from './types';
import { buildModel, type TickerModel } from './ticker/model';
import { TickerPage } from './ticker/page';
import { buildBuffettModel } from './macro/model';
import { BuffettPage, MacroHubPage } from './macro/page';
import type { BuffettData, Point } from './macro/data';

const ROOT = join(__dirname, '..');
const APP_ORIGIN = 'https://app.brasilhorizonte.com.br';
const FB = 'IwAR0teste_fbclid-123';
const HEAD_TRACKING = readFileSync(join(ROOT, 'scripts', 'ticker', 'head-tracking.html'), 'utf-8');
const LANDING = readFileSync(join(ROOT, 'index.html'), 'utf-8');

// ── App (cópia das regras; ver cabeçalho) ──────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\\\x00-\x1f\x7f]/;
/** src/lib/safeRedirect.ts */
function isSafeInternalPath(next: string | null): next is string {
  if (typeof next !== 'string' || next.length === 0) return false;
  if (next[0] !== '/') return false;
  if (FORBIDDEN_CHARS.test(next)) return false;
  if (next.length > 1 && (next[1] === '/' || next[1] === '\\')) return false;
  return true;
}

/** Auth.tsx:309-317 — login por e-mail e quem já está logado: navigate(next + '?' + resto da query). */
function aposLoginEmail(authUrl: string): string {
  const params = new URL(authUrl).searchParams;
  const next = params.get('next');
  if (isSafeInternalPath(next)) {
    const forwarded = new URLSearchParams(params);
    forwarded.delete('next');
    const qs = forwarded.toString();
    return qs ? `${next}?${qs}` : next;
  }
  return '/';
}

/** useAuth.tsx:366-371 — o Google volta para /auth?next=<só o next>, e o Auth.tsx segue o next. */
function aposLoginGoogle(authUrl: string): string {
  const next = new URL(authUrl).searchParams.get('next') || '/';
  return aposLoginEmail(`${APP_ORIGIN}/auth?next=${encodeURIComponent(isSafeInternalPath(next) ? next : '/')}`);
}

/** sectionTools.ts:43-78 (abas roteáveis) e App.tsx:124-130 (aba padrão de cada seção). */
const ABAS: Record<string, string[]> = {
  home: ['overview', 'notificacoes'],
  research: ['reports', 'content', 'carteiras', 'valuation', 'planejar'],
  ialocador: ['dashboard', 'rankings', 'radar', 'portfolio', 'optimization', 'macro', 'dividendos', 'cape'],
  ianalista: ['score', 'qualitativo', 'valuai', 'validador', 'teses'],
  workspace: ['chat', 'settings'],
};
const ABA_PADRAO: Record<string, string> = { home: 'overview', research: 'reports', ialocador: 'dashboard', ianalista: 'valuai', workspace: 'chat' };
/** assetRoute.ts:12-28 — aba fora da lista abre a Visão geral. */
const ABAS_ATIVO = ['overview', 'valuation', 'raiox', 'dividendos', 'risco', 'governanca', 'tese', 'docs', 'noticias'];
/** b3Ticker.ts:41 — Validador e Valuation só aceitam `ticker` nesse formato. */
const B3_TICKER_RE = /^[A-Z][A-Z0-9]{3}[0-9]{1,2}$/;

interface Tela {
  /** 'ianalista/validador', 'home/overview', 'ativo/PETR4/tese'... */
  nome: string;
  /** A query como o app a enxerga (useSearchParams / window.location.search). */
  q: URLSearchParams;
}

/** navigate(destino): o React Router corta a query no PRIMEIRO '?'; depois App.tsx (s/t) ou AssetPage (tab). */
function tela(destino: string): Tela {
  let path = destino.split('#')[0];
  let search = '';
  const i = path.indexOf('?');
  if (i >= 0) { search = path.slice(i); path = path.slice(0, i); }
  const q = new URLSearchParams(search);
  const ativo = /^\/ativo\/([^/]+)$/.exec(path);
  if (ativo) {
    const tab = (q.get('tab') ?? '').trim().toLowerCase();
    return { nome: `ativo/${decodeURIComponent(ativo[1]).toUpperCase()}/${ABAS_ATIVO.includes(tab) ? tab : 'overview'}`, q };
  }
  assert.equal(path, '/', `rota que o site não usa: ${destino}`);
  let s = q.get('s');
  const t = q.get('t');
  if ((s === 'ianalista' || s === 'workspace') && t === 'notificacoes') s = 'home'; // App.tsx:156-162
  const secao = s && Object.keys(ABAS).includes(s) ? s : 'home';
  return { nome: `${secao}/${t && ABAS[secao].includes(t) ? t : ABA_PADRAO[secao]}`, q };
}

// ── Navegador: o tracking de verdade num vm ──────────────────────────────────────────

const decodificar = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

interface Cta { href: string; cta: string; attrs: Record<string, string> }

/** Todo <a> que leva ao app, com os atributos (entidades decodificadas). */
function ctasDoApp(html: string): Cta[] {
  return [...html.matchAll(/<a\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(`href="${APP_ORIGIN}`))
    .map((tag) => {
      const attrs: Record<string, string> = {};
      for (const a of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = decodificar(a[2]);
      return { href: attrs.href, cta: attrs['data-cta'] ?? '', attrs };
    });
}

interface Pagina {
  /** Clica num link: fbclid do DOMContentLoaded + _iaClick (se tem data-cta). Devolve a URL aberta. */
  clicar(c: Cta): string;
}

const SELETOR_FBCLID = 'a[href*="brasilhorizonte.com"]';

function abrirPagina(html: string, url: string): Pagina {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((js) => js.includes('function _iaClick(') || js.includes(SELETOR_FBCLID));
  assert.ok(scripts.some((js) => js.includes('function _iaClick(')), 'página sem _iaClick');
  assert.ok(scripts.some((js) => js.includes(SELETOR_FBCLID)), 'página sem a propagação do fbclid');

  const pagina = new URL(url);
  let aberto = '';
  const aoCarregar: Array<() => void> = [];
  const links: Array<{ href: string; getAttribute(nome: string): string | null }> = [];
  const location = { pathname: pagina.pathname, search: pagina.search, href: pagina.href };
  // window.location.href = destino (no setTimeout do _iaClick) é a navegação.
  Object.defineProperty(location, 'href', { get: () => pagina.href, set: (v: string) => { aberto = v; } });
  const g: Record<string, unknown> = {
    URL, URLSearchParams, console, location,
    document: {
      referrer: '',
      addEventListener: (ev: string, fn: () => void) => { if (ev === 'DOMContentLoaded') aoCarregar.push(fn); },
      querySelectorAll: (sel: string) => (sel === SELETOR_FBCLID ? links : []),
    },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', languages: ['pt-BR'], webdriver: false },
    screen: { width: 1440 },
    sessionStorage: { getItem: () => 'sessao-teste', setItem: () => undefined },
    crypto: { randomUUID: () => 'uuid-teste' },
    fetch: () => Promise.resolve({ ok: true }),
    addEventListener: () => undefined,
    setTimeout: (fn: () => void) => fn(),
  };
  g.window = g;
  createContext(g);
  for (const js of scripts) runInContext(js, g);
  const iaClick = g._iaClick as (e: unknown) => void;
  assert.equal(typeof iaClick, 'function');

  return {
    clicar(c) {
      const el = { href: c.href, getAttribute: (nome: string) => c.attrs[nome] ?? null };
      links.splice(0, links.length, el);
      aoCarregar.forEach((fn) => fn());
      // Sem data-cta não há onclick (o pós-processamento só liga o _iaClick em quem tem): segue o href.
      if (!c.cta) return el.href;
      aberto = '';
      iaClick({ currentTarget: el, metaKey: false, ctrlKey: false, shiftKey: false, button: 0, preventDefault: () => undefined });
      assert.ok(aberto, `_iaClick não navegou (${c.cta})`);
      return aberto;
    },
  };
}

// ── Viagem: clique → /authnew → login → tela ─────────────────────────────────────────

interface Viagem { clicado: URL; email: Tela; google: Tela }

function viajar(p: Pagina, c: Cta): Viagem {
  const aberto = p.clicar(c);
  const clicado = new URL(aberto);
  assert.equal(clicado.origin + clicado.pathname, `${APP_ORIGIN}/authnew`, `${c.cta}: não passa pelo /authnew`);
  return { clicado, email: tela(aposLoginEmail(aberto)), google: tela(aposLoginGoogle(aberto)) };
}

/**
 * Vale para QUALQUER link do site: o `next` chega inteiro (mesma tela e mesmos parâmetros de quem
 * fosse direto ao next), por e-mail e pelo Google; a aba pedida existe (aba inválida cai na padrão
 * em silêncio); e next com query termina no descartável `&_=`.
 */
function conferirNext(rotulo: string, v: Viagem) {
  const next = v.clicado.searchParams.get('next');
  if (!next) {
    assert.equal(v.email.nome, 'home/overview', `${rotulo}: sem next, cai na Home`);
    return;
  }
  const direto = tela(next);
  for (const [via, t] of [['e-mail', v.email], ['Google', v.google]] as const) {
    assert.equal(t.nome, direto.nome, `${rotulo} (${via}): a tela mudou no caminho — next=${next}`);
    for (const [k, val] of direto.q) if (k !== '_') assert.equal(t.q.get(k), val, `${rotulo} (${via}): "${k}" chegou errado`);
  }
  const pedida = direto.q.get('t') ?? direto.q.get('tab');
  if (pedida) assert.ok(direto.nome.endsWith(`/${pedida}`), `${rotulo}: a aba "${pedida}" não existe no app (cairia na padrão)`);
  if (next.includes('?')) assert.match(next, /&_=$/, `${rotulo}: next com query sem o "&_=" no fim`);
}

/** utm_* e fbclid no /authnew (o app guarda a 1ª visita) e, quando há next, também na tela de destino. */
function conferirAtribuicao(rotulo: string, v: Viagem, utm: Record<string, string>, fbclid: string | null) {
  const comNext = v.clicado.searchParams.has('next');
  for (const [k, val] of Object.entries(utm)) {
    assert.equal(v.clicado.searchParams.get(k), val, `${rotulo}: ${k} no /authnew`);
    if (comNext) assert.equal(v.email.q.get(k), val, `${rotulo}: ${k} na tela de destino`);
  }
  assert.equal(v.clicado.searchParams.get('fbclid'), fbclid, `${rotulo}: fbclid no /authnew`);
  if (comNext && fbclid) assert.equal(v.email.q.get('fbclid'), fbclid, `${rotulo}: fbclid na tela de destino`);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────────────

const T = 'PETR4';

function modeloTicker(): TickerModel {
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
    _rawDividends: [{ symbol: T, amount: 1.5, exDate: '2026-05-02', paymentDate: '2026-06-01', dividendType: 'Dividendo', currency: 'BRL' }],
  } as unknown as FinancialData;
  const val = { results: [], calculatedWacc: 0.14, sensitivityMatrix: [] } as unknown as ComprehensiveValuation;
  const all: TickerIndexEntry[] = [{ ticker: T, name: 'Petrobras', sector: fundamentals.sector, price: 30, pl: 5, divYield: 0.12, marketCap: 4e11, hasPage: true }];
  // Com documento da CVM a página mostra também o botão de alerta do bloco da CVM.
  const docs: CvmDocument[] = [{ docType: 'FR', docTypeLabel: 'Fato Relevante', title: 'Documento de exemplo', date: '2026-10-01', excerpt: '', link: 'https://www.rad.cvm.gov.br/' }];
  return buildModel(data, val, all, docs);
}

/** Mesma série sintética do macro.test.ts (322 meses, nível conhecido). */
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

function trecho(html: string, de: string, ate: string): string {
  const i = html.indexOf(de);
  assert.ok(i >= 0, `trecho não encontrado: ${de}`);
  const j = html.indexOf(ate, i);
  assert.ok(j > i, `fim do trecho não encontrado: ${ate}`);
  return html.slice(i, j + ate.length);
}

// ── Páginas de ticker ────────────────────────────────────────────────────────────────

const ESPERADO_TICKER: Record<string, { tela: string; q?: Record<string, string> }> = {
  'nav-app': { tela: 'home/overview' },
  'nav-assinar': { tela: 'home/overview' },
  disclaimer: { tela: 'home/overview' },
  'nota-qualitativa': { tela: 'home/overview' },
  'hero-dcf': { tela: 'ianalista/valuai', q: { ticker: T } },
  'dcf-locked': { tela: 'ianalista/valuai', q: { ticker: T } },
  'sticky-mobile': { tela: 'ianalista/valuai', q: { ticker: T } },
  footer: { tela: 'ianalista/valuai', q: { ticker: T } },
  'airton-audit': { tela: 'ianalista/validador', q: { ticker: T, autorun: '1' } },
  'airton-intro': { tela: 'workspace/chat' },
  'alerta-cvm-topo': { tela: `ativo/${T}/tese` },
  'alerta-cvm': { tela: `ativo/${T}/tese` },
  'calc-alerta-graham': { tela: `ativo/${T}/tese`, q: { metodo: 'graham' } },
  'calc-alerta-bazin': { tela: `ativo/${T}/tese`, q: { metodo: 'bazin' } },
  'calc-alerta-gordon': { tela: `ativo/${T}/tese`, q: { metodo: 'gordon' } },
  'asset-page': { tela: `ativo/${T}/overview` },
};

test('ticker: cada CTA abre a tela certa, com utm e fbclid, por e-mail e pelo Google', () => {
  const ctas = ctasDoApp(renderToStaticMarkup(React.createElement(TickerPage, { m: modeloTicker() })));
  const ids = new Set(ctas.map((c) => c.cta));
  for (const id of ['hero-dcf', 'dcf-locked', 'airton-audit', 'alerta-cvm-topo', 'alerta-cvm', 'calc-alerta-graham', 'asset-page', 'nav-app']) {
    assert.ok(ids.has(id), `o CTA ${id} sumiu da página de ticker`);
  }
  const visitas = [
    { url: `https://iacoes.com.br/${T}/`, utm: { utm_source: 'iacoes', utm_medium: 'ticker', utm_campaign: 'seo-organico' }, fbclid: null },
    { url: `https://iacoes.com.br/${T}/?utm_source=facebook&utm_medium=cpc&utm_campaign=lancamento&fbclid=${FB}`, utm: { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'lancamento' }, fbclid: FB },
  ];
  for (const visita of visitas) {
    const p = abrirPagina(HEAD_TRACKING, visita.url);
    for (const c of ctas) {
      const rotulo = `${c.cta || c.href} (${visita.url})`;
      assert.ok(c.cta, `link para o app sem data-cta (sem _iaClick, sem utm): ${c.href}`);
      const v = viajar(p, c);
      conferirNext(rotulo, v);
      conferirAtribuicao(rotulo, v, { ...visita.utm, utm_content: c.cta }, visita.fbclid);
      const esperado = ESPERADO_TICKER[c.cta];
      if (!esperado) continue; // CTA novo: valem as regras gerais acima
      assert.equal(v.email.nome, esperado.tela, rotulo);
      for (const [k, val] of Object.entries(esperado.q ?? {})) assert.equal(v.email.q.get(k), val, `${rotulo}: ${k}`);
    }
  }
});

test('ticker: Validador e Valuation recebem o que os componentes do app leem', () => {
  const m = modeloTicker();
  const p = abrirPagina(HEAD_TRACKING, `https://iacoes.com.br/${T}/?fbclid=${FB}`);
  const cta = (href: string, id: string): Cta => ({ href, cta: id, attrs: { href, 'data-cta': id } });

  // 'Validador - import/App.tsx':236-252: autorun=1 + ticker válido → preenche o ticker e foca a tese.
  for (const href of [m.links.airton, `${m.links.airton}&prompt=${encodeURIComponent(m.airtonQuestions[0])}`]) {
    const v = viajar(p, cta(href, 'airton-audit'));
    for (const t of [v.email, v.google]) {
      assert.equal(t.nome, 'ianalista/validador');
      assert.equal(t.q.get('autorun'), '1');
      assert.match((t.q.get('ticker') || '').toUpperCase(), B3_TICKER_RE);
    }
  }
  // ValuAIApp.tsx:190-195: lê só o ticker; sem autorun, não gasta a análise do dia sozinho.
  const dcf = viajar(p, cta(m.links.dcf, 'hero-dcf'));
  assert.equal(dcf.email.q.get('ticker'), T);
  assert.equal(dcf.google.q.get('ticker'), T);
  assert.equal(dcf.email.q.get('autorun'), null);
  // Efeito colateral conhecido: o 1º parâmetro repassado (o ref) fica preso no descartável.
  assert.equal(dcf.email.q.get('_'), '?ref=iacoes');
  // AIrton (sem CTA na página hoje, mas o link existe no modelo).
  assert.equal(viajar(p, cta(m.links.airtonIntro, 'airton-intro')).email.nome, 'workspace/chat');
  // Formato do item 2 da SPEC, literal.
  assert.equal(m.links.alerta, `${APP_ORIGIN}/authnew?ref=iacoes&ticker=${T}&intent=alerta&next=%2Fativo%2F${T}%3Ftab%3Dtese%26_%3D`);
  assert.equal(m.links.asset, `${APP_ORIGIN}/authnew?ref=iacoes&ticker=${T}&next=%2Fativo%2F${T}`);
});

test('a simulação pega os defeitos que o "&_=" resolve', () => {
  const p = abrirPagina(HEAD_TRACKING, `https://iacoes.com.br/${T}/`);
  const cta = (href: string): Cta => ({ href, cta: 'teste', attrs: { href, 'data-cta': 'teste' } });
  // next com query e sem o descartável: o ref grudaria no t ("macro?ref=iacoes") e abriria o Dashboard.
  assert.equal(viajar(p, cta(`${APP_ORIGIN}/authnew?ref=iacoes&next=${encodeURIComponent('/?s=ialocador&t=macro')}`)).email.nome, 'ialocador/dashboard');
  // tab solto fora do next (formato antigo): chegava por e-mail, mas pelo Google abria a Visão geral.
  const solto = viajar(p, cta(`${APP_ORIGIN}/authnew?ref=iacoes&next=${encodeURIComponent(`/ativo/${T}`)}&tab=tese`));
  assert.equal(solto.email.nome, `ativo/${T}/tese`);
  assert.equal(solto.google.nome, `ativo/${T}/overview`);
});

// ── Página do Buffett e hub /macro/ ──────────────────────────────────────────────────

test('Buffett: todo CTA do app abre o Painel Macro (página e hub /macro/)', () => {
  const m = buildBuffettModel(serieBuffett(), { today: new Date('2026-10-06T12:00:00Z') });
  const paginas = [
    { url: 'https://iacoes.com.br/macro/indicador-de-buffett/', html: renderToStaticMarkup(React.createElement(BuffettPage, { m })) },
    { url: 'https://iacoes.com.br/macro/', html: renderToStaticMarkup(React.createElement(MacroHubPage, { m })) },
  ];
  for (const { url, html } of paginas) {
    const ctas = ctasDoApp(html);
    assert.ok(ctas.length >= 2, `${url}: CTAs do app sumiram`);
    const p = abrirPagina(HEAD_TRACKING, url);
    for (const c of ctas) {
      const rotulo = `${c.cta} (${url})`;
      const v = viajar(p, c);
      conferirNext(rotulo, v);
      assert.equal(v.email.nome, 'ialocador/macro', rotulo);
      assert.equal(v.google.nome, 'ialocador/macro', rotulo);
      // utm_medium=macro já vem no link; o _iaClick só completa o que falta.
      conferirAtribuicao(rotulo, v, { utm_source: 'iacoes', utm_medium: 'macro', utm_campaign: 'seo-organico', utm_content: c.cta }, null);
    }
  }
  assert.ok(ctasDoApp(paginas[0].html).some((c) => c.cta === 'macro-buffett'), 'CTA macro-buffett ausente');
});

// ── Landing ──────────────────────────────────────────────────────────────────────────

const ESPERADO_LANDING: Record<string, string> = {
  metodologias: 'ianalista/valuai',          // passo do DCF → Valuation
  'alerta-cvm': 'home/notificacoes',         // passo dos alertas → Notificações
  'lp-calc-alerta': 'home/notificacoes',     // antes de a calculadora escolher um ticker (ou sem JS)
  'lp-calc-recalcular': 'ativo/PETR4/valuation', // idem, coerente com o "PETR4" do texto padrão
};
const GERAIS_LANDING = ['nav-comecar', 'hero', 'preco-iacoes', 'preco-fundamentalista', 'footer', 'sticky-mobile'];

test('landing: DCF → Valuation, alertas → Notificações; CTAs gerais sem next', () => {
  const ctas = ctasDoApp(LANDING);
  for (const id of [...Object.keys(ESPERADO_LANDING), ...GERAIS_LANDING]) assert.ok(ctas.some((c) => c.cta === id), `o CTA ${id} sumiu da landing`);
  const p = abrirPagina(LANDING, `https://iacoes.com.br/?fbclid=${FB}`);
  for (const c of ctas) {
    assert.ok(c.cta, `link para o app sem data-cta: ${c.href}`);
    const v = viajar(p, c);
    conferirNext(c.cta, v);
    conferirAtribuicao(c.cta, v, { utm_source: 'iacoes', utm_medium: 'landing', utm_campaign: 'seo-organico', utm_content: c.cta }, FB);
    if (ESPERADO_LANDING[c.cta]) {
      assert.equal(v.email.nome, ESPERADO_LANDING[c.cta], c.cta);
      assert.equal(v.google.nome, ESPERADO_LANDING[c.cta], `${c.cta} (Google)`);
    }
    if (GERAIS_LANDING.includes(c.cta)) assert.equal(v.clicado.searchParams.get('next'), null, `${c.cta}: cadastro genérico, sem next`);
  }
});

test('landing: a calculadora do topo leva alerta e "Recalcular" à aba certa do ativo (sem tab solto)', () => {
  assert.doesNotMatch(LANDING, /searchParams\.set\(\s*'tab'/, 'tab solto fora do next: pelo Google ele se perde');
  const ctas = ctasDoApp(LANDING);
  const alertaTag = ctas.find((c) => c.attrs.id === 'calc-alerta');
  const recalcTag = ctas.find((c) => c.attrs.id === 'adj-link');
  assert.ok(alertaTag && recalcTag, 'botões da calculadora não encontrados');
  // O JS de verdade que monta os links (trechos do index.html).
  const jsAlerta = trecho(LANDING, 'var u = new URL(alerta.href);', 'alerta.href = u.toString();');
  const jsRecalc = trecho(LANDING, 'var u = new URL(adjLink.href);', 'adjLink.href = u.toString();');
  const p = abrirPagina(LANDING, `https://iacoes.com.br/?fbclid=${FB}`);
  const utm = (id: string) => ({ utm_source: 'iacoes', utm_medium: 'landing', utm_campaign: 'seo-organico', utm_content: id });

  const alerta = { href: alertaTag.href };
  runInContext(jsAlerta, createContext({ URL, alerta, curT: 'VALE3', fb: FB }));
  const va = viajar(p, { ...alertaTag, href: alerta.href });
  assert.equal(va.email.nome, 'ativo/VALE3/tese');
  assert.equal(va.google.nome, 'ativo/VALE3/tese');
  conferirNext('lp-calc-alerta', va);
  conferirAtribuicao('lp-calc-alerta', va, utm('lp-calc-alerta'), FB);

  const adjLink = { href: recalcTag.href };
  runInContext(jsRecalc, createContext({ URL, adjLink, curT: 'VALE3', fb: FB, v: { margem: 10, dy: 7, r: 14, g: 4 } }));
  const vr = viajar(p, { ...recalcTag, href: adjLink.href });
  assert.equal(vr.email.nome, 'ativo/VALE3/valuation');
  assert.equal(vr.google.nome, 'ativo/VALE3/valuation');
  assert.equal(vr.email.q.get('marginOfSafety'), '0.1', 'as premissas seguem junto, para quando o app ler da URL');
  conferirNext('lp-calc-recalcular', vr);
  conferirAtribuicao('lp-calc-recalcular', vr, utm('lp-calc-recalcular'), FB);

  // Sem ticker escolhido (cotações não carregaram), fica o destino estático do HTML.
  const semTicker = { href: recalcTag.href };
  runInContext(jsRecalc, createContext({ URL, adjLink: semTicker, curT: '', fb: null, v: { margem: 5, dy: 6, r: 14, g: 4 } }));
  assert.equal(viajar(p, { ...recalcTag, href: semTicker.href }).email.nome, 'ativo/PETR4/valuation');
});

test('landing: "Ferramentas" (/ferramentas/) na nav e no rodapé', () => {
  // Aceita classe/atributos a mais (o redesenho da landing pode acrescentar), mas exige destino, texto e item visível.
  const link = /<li\b(?![^>]*\bhidden\b)[^>]*>\s*<a\b[^>]*\bhref="\/ferramentas\/"[^>]*>\s*Ferramentas\s*<\/a>\s*<\/li>/;
  assert.match(trecho(LANDING, '<ul class="nav-links"', '</ul>'), link);
  assert.match(trecho(LANDING, '<ul class="footer-links">', '</ul>'), link);
});
