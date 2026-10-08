import type { FinancialData, ComprehensiveValuation, TickerIndexEntry, CvmDocument, RawIncomeStatement, RawBalanceSheet, RawCashFlow } from '../types';
import { ok, num, brl, pct, mult, big, MONTHS } from './lib/format';
import { dedupeDividends, incomeWindows, isPastIncome } from '../lib/dividends';
import { brtDateISO } from '../lib/dates';
import { companyName } from '../lib/company-name';

export const APP = 'https://app.brasilhorizonte.com.br/authnew';
export const SITE = 'https://iacoes.com.br';

export const sectorSlug = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Tickers com página garantida e tráfego — usados no linking interno do rodapé.
const POPULAR = ['PETR4', 'VALE3', 'ITUB4', 'BBAS3', 'WEGE3', 'BBDC4', 'ABEV3', 'B3SA3', 'SUZB3', 'GGBR4', 'TAEE11', 'BPAC11', 'ITSA4', 'VIVT3', 'PRIO3', 'RENT3', 'EGIE3', 'CMIG4', 'SBSP3', 'RADL3'];

export interface Peer { ticker: string; name: string; price: number; pl: number; dy: number; marketCap: number }
export interface StatementTable { years: string[]; rows: { label: string; values: number[]; kind?: 'money' | 'pct'; strong?: boolean }[] }
export interface Faq { q: string; a: string }

export interface TickerModel {
  symbol: string; name: string; shortName: string; type: string; typeLabel: string;
  sector: string; subSector: string; sectorSlug: string;
  logoUrl: string | null; website: string | null; employees: number | null; hq: string | null;
  price: number; changeDay: number; perf: { label: string; value: number | null }[];
  min52: number; max52: number;
  todayBR: string; todayISO: string; monthYear: string; lastBalance: string;
  summary: string | null;
  m: FinancialData['fundamentals'];
  sectorMedian: { pl: number | null; dy: number | null; count: number };
  div: {
    ttm: number; dyTTM: number; avg: Record<'1' | '3' | '5' | '10', number>;
    byYear: { year: number; total: number; count: number; partial: boolean }[];
    recent: { ex: string; pay: string; amount: number; type: string }[];
    totalPayments: number; firstYear: number | null; lastYearTotal: { year: number; total: number; count: number } | null;
    /** Algum provento veio trazido para a base acionária de hoje (desdobramento, grupamento, bonificação)? */
    adjusted?: boolean;
  };
  calc: {
    graham: { lpa: number; vpa: number; fv: number };
    bazin: { fv: number };
    gordon: { fv: number };
  };
  dcf: { available: boolean; wacc: number; waccAxis: number[]; gAxis: number[] };
  dre: StatementTable; bal: StatementTable; cf: StatementTable;
  cvmDocs: CvmDocument[];
  peers: Peer[]; popular: string[];
  faq: Faq[];
  seo: { title: string; description: string; h1Sub: string; intro: string[] };
  links: Record<'dcf' | 'airton' | 'airtonIntro' | 'alerta' | 'asset' | 'generic' | 'ticker', string>;
  socialProof: number;
}

// --- Dividendos -------------------------------------------------------------

/**
 * Proventos da página (e do valuations.json, da calculadora e do ranking, que leem daqui).
 *
 * Sem as duplicatas da fonte, pela régua do app (scripts/lib/dividends.ts): mesma natureza e
 * valor com data-com a até 3 dias é a mesma linha; parcela (mesma data-com, pagamentos reais
 * diferentes) e dividendo × JCP de mesmo valor continuam separados. DY de 12 meses, médias,
 * gráfico por ano e contagem de pagamentos só com RENDA já ocorrida (data-com ≤ hoje em BRT;
 * restituição de capital e amortização ficam fora). A tabela "Últimos pagamentos" mostra
 * todos os eventos, inclusive o anunciado com data-com futura e a restituição de capital
 * (o tipo aparece na linha). `now` só existe para os testes fixarem o relógio.
 */
export function dividends(data: Pick<FinancialData, '_rawDividends' | 'price'>, now: Date = new Date()): TickerModel['div'] {
  const today = brtDateISO(now);
  const events = dedupeDividends(data._rawDividends);          // crescente por data-com
  const income = events.filter(d => isPastIncome(d, today));    // renda já ocorrida
  // Média anual por janela móvel (últimos N×12 meses ÷ N). Janela sem pagamento = 0, não inventa.
  const { ttm, avg } = incomeWindows(events, today);

  const curYear = Number(today.slice(0, 4));
  const byYearMap = new Map<number, { total: number; count: number }>();
  for (const d of income) {
    const y = Number(d.exDate.slice(0, 4));
    const e = byYearMap.get(y) || { total: 0, count: 0 };
    e.total += d.amount; e.count++;
    byYearMap.set(y, e);
  }
  const byYear = [...byYearMap.entries()]
    .filter(([y]) => y > curYear - 10)
    .sort((a, b) => a[0] - b[0])
    .map(([year, e]) => ({ year, ...e, partial: year === curYear }));
  const ly = byYearMap.get(curYear - 1);

  return {
    ttm, dyTTM: data.price > 0 ? ttm / data.price : 0, avg,
    byYear,
    recent: events.slice().reverse().slice(0, 12).map(d => ({ ex: d.exDate.slice(0, 10), pay: (d.paymentDate || '').slice(0, 10), amount: d.amount, type: d.dividendType || '' })),
    totalPayments: income.length,
    firstYear: income.length ? Number(income[0].exDate.slice(0, 4)) : null,
    lastYearTotal: ly ? { year: curYear - 1, ...ly } : null,
    // A seção de dividendos avisa quando algum valor foi ajustado (scripts/lib/splits.ts marca a
    // linha com splitDivisor ≠ 1); sem isto o aviso de proventosAjustados() nunca aparecia.
    adjusted: events.some(d => typeof d.splitDivisor === 'number' && d.splitDivisor !== 1),
  };
}

// --- Demonstrações ------------------------------------------------------------

function yearly<T extends { type?: string; period: string; end_date: string }>(rows: T[]): T[] {
  const y = rows.filter(d => {
    const t = (d.type ?? '').toLowerCase(); const p = (d.period ?? '').toUpperCase();
    return t === 'yearly' || t === 'annual' || p.startsWith('FY') || /^\d{4}$/.test(p);
  });
  const seen = new Set<number>();
  return (y.length ? y : rows)
    .slice()
    .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
    .filter(d => { const yr = new Date(d.end_date).getUTCFullYear(); if (seen.has(yr)) return false; seen.add(yr); return true; })
    .slice(0, 10)
    .reverse();
}

const yr = (d: { end_date: string }) => String(new Date(d.end_date).getUTCFullYear());

function statements(data: FinancialData) {
  const inc = yearly<RawIncomeStatement>(data._rawIncome);
  const bal = yearly<RawBalanceSheet>(data._rawBalance);
  const cf = yearly<RawCashFlow>(data._rawCashFlow);
  const dre: StatementTable = {
    years: inc.map(yr),
    rows: [
      { label: 'Receita líquida', values: inc.map(d => d.total_revenue), strong: true },
      { label: 'Lucro bruto', values: inc.map(d => d.gross_profit || 0) },
      { label: 'EBIT', values: inc.map(d => d.ebit) },
      { label: 'Lucro antes do IR', values: inc.map(d => d.income_before_tax) },
      { label: 'Lucro líquido', values: inc.map(d => d.net_income), strong: true },
      { label: 'Margem líquida', values: inc.map(d => (d.total_revenue ? d.net_income / d.total_revenue : NaN)), kind: 'pct' },
    ],
  };
  const balT: StatementTable = {
    years: bal.map(yr),
    rows: [
      { label: 'Ativo total', values: bal.map(d => d.total_assets), strong: true },
      { label: 'Caixa e aplicações', values: bal.map(d => d.cash + (d.short_term_investments || 0)) },
      { label: 'Dívida bruta', values: bal.map(d => (d.long_term_debt || 0) + (d.short_long_term_debt || 0)) },
      { label: 'Dívida líquida', values: bal.map(d => (d.long_term_debt || 0) + (d.short_long_term_debt || 0) - d.cash - (d.short_term_investments || 0)) },
      { label: 'Passivo total', values: bal.map(d => d.total_liab) },
      { label: 'Patrimônio líquido', values: bal.map(d => d.total_stockholder_equity), strong: true },
    ],
  };
  const cfT: StatementTable = {
    years: cf.map(yr),
    rows: [
      { label: 'Caixa operacional (FCO)', values: cf.map(d => d.total_cash_from_operating_activities), strong: true },
      { label: 'Capex', values: cf.map(d => d.capital_expenditures) },
      { label: 'Fluxo de caixa livre', values: cf.map(d => d.total_cash_from_operating_activities + d.capital_expenditures), strong: true },
      { label: 'Caixa de investimento', values: cf.map(d => d.total_cashflows_from_investing_activities) },
      { label: 'Caixa de financiamento', values: cf.map(d => d.total_cash_from_financing_activities) },
      { label: 'Dividendos pagos', values: cf.map(d => d.dividends_paid) },
    ],
  };
  return { dre, bal: balT, cf: cfT };
}

// --- Social proof (mesma fórmula determinística de antes: cresce ~15%/ano) -----

function socialProof(avgVolume: number, symbol: string): number {
  if (!avgVolume || avgVolume <= 0) return 47;
  const seed = symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const count = Math.log10(avgVolume) * 70 + (seed % 80);
  const now = new Date();
  const doy = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const mult = 1 + (doy / 365 + (now.getFullYear() - 2026) * 2) * 0.15;
  return Math.max(30, Math.min(Math.round(count * mult), 15000));
}

const median = (xs: number[]): number | null => {
  const s = xs.filter(x => ok(x)).sort((a, b) => a - b);
  if (s.length < 3) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// --- Modelo --------------------------------------------------------------------

export function buildModel(data: FinancialData, val: ComprehensiveValuation, all: TickerIndexEntry[], cvmDocs: CvmDocument[]): TickerModel {
  const f = data.fundamentals;
  const p = data.profile;
  const now = new Date();
  const symbol = f.symbol;
  const type = f.type;
  const typeLabel = type === 'PN' ? 'preferencial' : type === 'UNT' ? 'unit' : 'ordinária';
  // Nome curto para títulos, pela limpeza única do site (scripts/lib/company-name.ts): o nome
  // longo da brapi sem a classe em inglês e sem o sufixo societário ("Itausa", não "Itausa SA
  // Non-Cum Perp Pfd Registered Shs"); a abreviação da B3 ("KARSTEN     ON") só sem o longo.
  const rawShort = all.find(t => t.ticker === symbol)?.name || '';
  const shortName = companyName(rawShort, f.name, symbol);

  const div = dividends(data);
  const st = statements(data);

  // Calculadoras — valores iniciais (o JS cliente recalcula com as mesmas fórmulas).
  const lpa = f.lpa, vpa = f.vpa;
  const grahamFV = lpa > 0 && vpa > 0 ? Math.sqrt(22.5 * lpa * vpa) : 0;
  const bazinFV = div.avg['5'] > 0 ? div.avg['5'] / 0.06 : 0;
  const gR = 0.14, gG = 0.04;
  const gordonFV = div.avg['5'] > 0 ? (div.avg['5'] * (1 + gG)) / (gR - gG) : 0;

  const dcfFV = val.results.find(r => r.method === 'FDC')?.fairValue || 0;
  const mx = val.sensitivityMatrix || [];

  const sectorRows = all.filter(t => t.sector && t.sector === f.sector && t.price > 0);
  const sectorMedian = {
    pl: median(sectorRows.map(t => t.pl).filter(v => v > 0 && v < 200)),
    dy: median(sectorRows.map(t => t.divYield).filter(v => v >= 0 && v < 1)),
    count: sectorRows.length,
  };
  // Só pares com página: AXIA6 e CTAX3 têm cotação mas a página nunca é gerada, e viravam
  // link 404 em dezenas de páginas (GSC, out/2026).
  const peers: Peer[] = sectorRows
    .filter(t => t.ticker !== symbol && t.hasPage !== false)
    .slice(0, 8)
    .map(t => ({ ticker: t.ticker, name: t.name, price: t.price, pl: t.pl, dy: t.divYield, marketCap: t.marketCap }));

  const hq = p?.city ? `${titleCase(p.city)}${p.state ? ' – ' + p.state : ''}` : null;
  const monthYear = `${MONTHS[now.getMonth()]} de ${now.getFullYear()}`;

  const q = encodeURIComponent;
  // Deep link (SPEC §2): o app só obedece `next`. O Auth.tsx cola o resto da query no fim do
  // `next` com outro `?`, então todo `next` com query termina em `&_=`: o descartável engole o
  // primeiro parâmetro repassado e `s`/`t`/`tab` chegam intactos (com utm_* e fbclid do _iaClick).
  // `ref`, `ticker` e `intent` no topo não mudam a tela (o Auth.tsx só segue o `next`). O `ref` vale
  // para a atribuição first-touch do app (`bh_utm`, gravada no cadastro por e-mail, ainda no /authnew);
  // no destino ele é justamente o parâmetro que o descartável engole.
  // Quem acrescenta parâmetros (`&metodo=` nas calculadoras, `&prompt=` no AIrton) acrescenta no
  // topo, depois do `next`: vão junto no repasse e não mexem no destino.
  const toApp = (intent: string, next: string) => `${APP}?ref=iacoes&ticker=${symbol}&intent=${intent}&next=${q(next)}`;
  const links = {
    dcf: toApp('dcf', `/?s=ianalista&t=valuai&ticker=${symbol}&_=`),                  // Valuation (DCF) com o ticker
    airton: toApp('auditoria', `/?s=ianalista&t=validador&ticker=${symbol}&autorun=1&_=`), // Validador: preenche o ticker e foca a tese
    airtonIntro: toApp('airton', '/?s=workspace&_='),                                   // AIrton
    alerta: toApp('alerta', `/ativo/${symbol}?tab=tese&_=`),                            // aba Tese do ativo (alertas por ativo)
    // Visão geral do ativo: sem `?` no `next`, dispensa o `&_=`.
    asset: `${APP}?ref=iacoes&ticker=${symbol}&next=${q(`/ativo/${symbol}`)}`,
    generic: `${APP}?ref=iacoes`,
    ticker: `${APP}?ref=iacoes&ticker=${symbol}`,
  };

  // --- SEO: texto com os números reais (o que a busca e a IA citam) ---
  const facts: string[] = [];
  if (f.pl > 0) facts.push(`P/L de ${num(f.pl, 1)}`);
  if (f.pvp > 0) facts.push(`P/VP de ${num(f.pvp, 2)}`);
  if (f.evEbitda > 0) facts.push(`EV/EBITDA de ${num(f.evEbitda, 1)}`);
  if (f.divYield > 0) facts.push(`dividend yield de ${pct(f.divYield)}`);
  const factsTxt = facts.length > 1 ? facts.slice(0, -1).join(', ') + ' e ' + facts[facts.length - 1] : facts.join('');

  const intro = [
    `${symbol} é a ação ${typeLabel} de ${shortName}, listada na B3 no setor de ${f.sector}${f.subSector && f.subSector !== '-' ? ` (${f.subSector})` : ''}. Cotada a ${brl(f.price)}, a companhia vale ${big(f.marketCap)} em bolsa${factsTxt ? ` e negocia a ${factsTxt}` : ''}.`,
    `${f.roe ? `O ROE é de ${pct(f.roe)}` : 'A rentabilidade'}${f.netMargin ? `, a margem líquida de ${pct(f.netMargin)}` : ''}${ok(f.debtEbitda) && f.debtEbitda !== 0 ? ` e a dívida líquida equivale a ${num(f.debtEbitda, 2)}x o EBITDA` : ''}. Nesta página você calcula o preço justo de ${symbol} por Graham, Bazin e Gordon com as suas premissas e vê ${div.totalPayments ? `o histórico de ${div.totalPayments} proventos, ` : ''}10 anos de demonstrações financeiras e a comparação com o setor.`,
  ];

  const descParts = [`${symbol} a ${brl(f.price)}`];
  if (f.pl > 0) descParts.push(`P/L ${num(f.pl, 1)}`);
  if (f.divYield > 0) descParts.push(`DY ${pct(f.divYield)}`);
  if (f.roe) descParts.push(`ROE ${pct(f.roe)}`);
  // O DCF fica travado na página (é da plataforma): "faça … na plataforma", não "veja".
  const description = `${descParts.join(', ')}. Calcule o preço justo de ${shortName} por Graham, Bazin e Gordon e faça o DCF completo na plataforma. Indicadores, dividendos e balanço atualizados.`;

  const faq: Faq[] = [
    {
      q: `${symbol} está cara ou barata?`,
      a: `Depende do método e das premissas. Pela fórmula de Graham (√22,5 × LPA × VPA), o preço justo de ${symbol} é ${grahamFV > 0 ? brl(grahamFV) : 'indefinido, porque LPA ou VPA está negativo'}${bazinFV > 0 ? `; por Bazin, com dividend yield mínimo de 6%, é ${brl(bazinFV)}` : ''}, contra a cotação de ${brl(f.price)}. Ajuste as premissas nas calculadoras desta página para chegar ao seu número. Para uma visão que considera a operação inteira da empresa, o DCF (fluxo de caixa descontado) está disponível na plataforma.`,
    },
    {
      q: `Qual o preço justo de ${symbol} pelo DCF?`,
      // Sem "cenários": os botões bear/base/bull do Valuation não existem no modelo editável
      // (honestidade-rotas.md, ValuAI item 3). A IA propõe as premissas; o WACC é calculado.
      a: `O DCF projeta o fluxo de caixa livre de ${shortName} e o traz a valor presente pelo WACC${val.calculatedWacc > 0 ? `, que estimamos em ${pct(val.calculatedWacc)} com as premissas padrão do site` : ''}. Na plataforma IAções, a IA propõe as premissas a partir do histórico da empresa (crescimento da receita, custos, capex e crescimento perpétuo) e você decide; o WACC vem decomposto e o resultado sai com a matriz de sensibilidade WACC × crescimento perpétuo. O cadastro é gratuito.`,
    },
    {
      q: `Quais os principais indicadores de ${symbol}?`,
      a: `${symbol} tem P/L de ${mult(f.pl)}, P/VP de ${mult(f.pvp)}, EV/EBITDA de ${mult(f.evEbitda)}, dividend yield de ${pct(f.divYield)}, ROE de ${pct(f.roe)}, ROIC de ${pct(f.roic)}, margem líquida de ${pct(f.netMargin)} e dívida líquida/EBITDA de ${mult(f.debtEbitda)}.${sectorMedian.pl ? ` A mediana de P/L do setor de ${f.sector} é ${mult(sectorMedian.pl, 1)}.` : ''}`,
    },
    {
      q: `Quanto ${symbol} paga de dividendos?`,
      a: div.ttm > 0
        ? `Nos últimos 12 meses ${symbol} distribuiu ${brl(div.ttm)} por ação, um dividend yield de ${pct(div.dyTTM)} sobre a cotação atual. A média anual dos últimos 5 anos é de ${brl(div.avg['5'])} por ação.${div.lastYearTotal ? ` Em ${div.lastYearTotal.year}, foram ${brl(div.lastYearTotal.total)} em ${div.lastYearTotal.count} pagamentos.` : ''}`
        : `${symbol} não registrou pagamento de dividendos ou JCP nos últimos 12 meses.${div.totalPayments ? ` O histórico tem ${div.totalPayments} pagamentos desde ${div.firstYear}.` : ''}`,
    },
    {
      q: `Qual o preço teto de ${symbol} pelo método Bazin?`,
      a: div.avg['5'] > 0
        ? `Com a média de ${brl(div.avg['5'])} por ação em dividendos nos últimos 5 anos e um yield mínimo de 6%, o preço teto de ${symbol} por Bazin é ${brl(bazinFV)}. Com 8% de yield mínimo, cai para ${brl(div.avg['5'] / 0.08)}.`
        : `Sem dividendos nos últimos 5 anos, o método Bazin não se aplica a ${symbol}. Graham e o DCF são alternativas melhores para esse caso.`,
    },
    {
      q: `Como é calculado o preço justo de Graham para ${symbol}?`,
      a: `A fórmula de Benjamin Graham é √(22,5 × LPA × VPA), em que 22,5 vem de um P/L máximo de 15 vezes um P/VP máximo de 1,5. Para ${symbol}, LPA = ${brl(lpa)} e VPA = ${brl(vpa)}${grahamFV > 0 ? `, o que resulta em ${brl(grahamFV)}` : ''}. Na calculadora você muda os múltiplos máximos e aplica uma margem de segurança.`,
    },
    {
      q: `O que faz a ${shortName}?`,
      a: data.businessSummary && !looksEnglish(data.businessSummary) ? truncateSentence(data.businessSummary, 420) : `${shortName} é uma companhia aberta listada na B3 no setor de ${f.sector}.`,
    },
    {
      q: `${symbol} está endividada?`,
      a: `A dívida líquida de ${symbol} equivale a ${mult(f.debtEbitda)} o EBITDA, a dívida bruta a ${mult(f.debtEquity)} o patrimônio líquido e a liquidez corrente é de ${mult(f.currentLiquidity)}. Abaixo de 2x dívida líquida/EBITDA costuma ser considerado confortável para empresas não financeiras.`,
    },
  ];

  return {
    symbol, name: f.name, shortName, type, typeLabel,
    sector: f.sector && f.sector !== '-' ? f.sector : '', subSector: f.subSector && f.subSector !== '-' ? f.subSector : '',
    sectorSlug: f.sector && f.sector !== '-' ? sectorSlug(f.sector) : '',
    logoUrl: p?.logoUrl || null, website: p?.website || null, employees: p?.employees || null, hq,
    price: f.price, changeDay: f.changeDay,
    perf: [
      { label: 'Semana', value: p?.weekChange ?? null },
      { label: 'Mês', value: p?.monthChange ?? null },
      { label: '6 meses', value: p?.sixMonthChange ?? null },
      { label: 'No ano', value: p?.ytdReturn ?? null },
      { label: '12 meses', value: p?.yearChange ?? null },
    ],
    min52: f.min52Week, max52: f.max52Week,
    todayBR: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    todayISO: now.toISOString().split('T')[0] + 'T03:00:00.000Z',
    monthYear, lastBalance: f.lastBalanceDate,
    // Sem tradução pt-BR a brapi devolve o resumo em inglês: fora da página (texto em
    // outro idioma numa página pt-BR atrapalha mais do que ajuda no SEO).
    summary: data.businessSummary && !looksEnglish(data.businessSummary) ? data.businessSummary : null,
    m: f,
    sectorMedian,
    div,
    calc: { graham: { lpa, vpa, fv: grahamFV }, bazin: { fv: bazinFV }, gordon: { fv: gordonFV } },
    dcf: {
      available: dcfFV > 0,
      wacc: val.calculatedWacc,
      waccAxis: mx.map(r => r[0]?.wacc ?? 0),
      gAxis: mx[0]?.map(c => c.growth) ?? [],
    },
    ...st,
    cvmDocs,
    peers, popular: POPULAR.filter(t => t !== symbol).slice(0, 16),
    faq,
    seo: {
      title: `${symbol} Está Cara ou Barata? Preço Justo e DCF (${now.getFullYear()}) | IAções`,
      description,
      h1Sub: `${shortName}: preço justo, DCF e indicadores`,
      intro,
    },
    links,
    socialProof: socialProof(f.volMed2m, symbol),
  };
}

function looksEnglish(s: string) {
  const c = (re: RegExp) => (s.match(re) || []).length;
  return c(/(the|and|company|its|through|provides)/gi) > c(/(de|da|do|e|com|para|empresa)/gi);
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}

function truncateSentence(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return dot > max * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…';
}
