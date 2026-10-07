/**
 * Proventos na base acionária de HOJE (desdobramento, grupamento, bonificação).
 *
 * `brapi_dividends.amount` é o valor COMO DECLARADO na época, e a cotação já vem ajustada
 * por desdobramento. Somar os dois crus inflava o DY de quem desdobrou: SBSP3 (bonificações
 * em 12/2025 e 03/2026 + desdobramento 5:1 em 28/04/2026) saía com DY de 10,9% e Bazin de
 * R$ 60,31. Grupamento erra no sentido oposto.
 *
 * Régua — a MESMA do app (`dividendSplitDivisor` em src/lib/cape.ts, aba Dividendos, ValuAI,
 * backtest; e a RPC ensaiada em supabase/pending/dividend_yield_split_adjusted.sql):
 *
 * - O provento é DIVIDIDO pelo produto dos fatores (ações_depois / ações_antes) dos eventos
 *   com data-com NO DIA do provento ou DEPOIS. Desdobramento 5:1 → fator 5 (R$ 1,00 por ação
 *   antiga vira R$ 0,20 por ação de hoje); grupamento 1:10 → fator 0,1 (multiplica por 10).
 * - "No dia" conta: `brapi_dividends.ex_date` e `brapi_stock_splits.ex_date` guardam o mesmo
 *   campo da BRAPI (`lastDatePrior`), a DATA-COM. Quem fecha a data-com recebe sobre as ações
 *   antigas e amanhece com as novas. Prova da fonte: CSAN3 pagou R$ 1,0306 com desdobramento
 *   1:4 na mesma data-com (05/05/2021) e o `adjusted_close` da BRAPI implica 1,0306 ÷ 4.
 * - Só DESDOBRAMENTO, GRUPAMENTO e BONIFICACAO mudam a base. `CIS RED CAP`, `RESG TOTAL RV`,
 *   `INCORPORACAO`, `REST CAP ACOES` também têm `factor`, com outra semântica (às vezes
 *   100 = percentual): deixá-los passar dividiria a série inteira por 100.
 * - Fator inválido (zero, negativo, NaN) é ignorado em vez de zerar o divisor.
 *
 * Duas guardas a mais que o app (o app tem os mesmos buracos):
 * - Evento repetido pela fonte em dias seguidos (mesmo rótulo e fator, até 3 dias) conta uma
 *   vez. A BRAPI gravou MGLU3 em 04 e 05/09/2017 e em 05 e 06/08/2019 (8:1 cada) e ITUB4 três
 *   bonificações em dobro: aplicar as duas linhas dividia os proventos de 2017–2018 da MGLU3
 *   por 8 a mais (no gráfico anual e na média de 10 anos, 8 a 10× menores).
 * - Só entra evento que a cotação já reflete: data-com ANTES de hoje (BRT). Na própria
 *   data-com o pregão ainda é das ações antigas, e evento aprovado com data-com futura
 *   (ESPA3 aprovou em 28/04 o grupamento de 12/06/2026) não mexeu no preço.
 */
import { brtDateISO, isoMinusYears } from './dates';

export const SHARE_BASE_SPLIT_LABELS = ['DESDOBRAMENTO', 'GRUPAMENTO', 'BONIFICACAO'] as const;

/** Linha de `brapi_stock_splits` como vem do Supabase. */
export interface StockSplitRow {
  ticker?: unknown;
  ex_date?: unknown;
  factor?: unknown;
  label?: unknown;
}

export interface StockSplit {
  /** Data-com do evento (yyyy-mm-dd). */
  exDate: string;
  /** ações_depois / ações_antes: desdobramento 5:1 → 5; grupamento 1:10 → 0,1. */
  factor: number;
}

/** Provento que o ajuste sabe tratar (o `RawDividend` do gerador encaixa aqui). */
export interface AdjustableDividend {
  amount: number;
  exDate: string;
  /** Valor como declarado na época; só existe quando o ajuste mudou o valor. */
  amountDeclared?: number;
  /** Produto dos fatores aplicados; só existe quando ≠ 1. */
  splitDivisor?: number;
}

const isoDay = (v: unknown): string | null => {
  const s = String(v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const plain = (v: unknown): string =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/** "sbsp3.sa" → "SBSP3": a chave por ticker das duas tabelas. */
export const baseTicker = (v: unknown): string => plain(v).replace(/\.SA$/, '');

/** Linhas do mesmo evento repetidas pela fonte: mesmo rótulo e fator (±1%) a até 3 dias. */
const SAME_EVENT_MAX_DAYS = 3;
const DAY_MS = 86_400_000;

/**
 * Só os eventos que mudam a base acionária, com data e fator válidos, em ordem de data e
 * sem as repetições da fonte (fica a linha mais antiga). Linhas de UM papel.
 */
export function toShareBaseSplits(rows: readonly StockSplitRow[] | null | undefined): StockSplit[] {
  const valid: (StockSplit & { label: string })[] = [];
  for (const r of rows ?? []) {
    const label = plain(r?.label);
    if (!r || !(SHARE_BASE_SPLIT_LABELS as readonly string[]).includes(label)) continue;
    const exDate = isoDay(r.ex_date);
    const factor = r.factor == null || r.factor === '' ? NaN : Number(r.factor);
    if (!exDate || !Number.isFinite(factor) || factor <= 0) continue;
    valid.push({ exDate, factor, label });
  }
  valid.sort((a, b) => a.exDate.localeCompare(b.exDate));
  const kept: (StockSplit & { label: string })[] = [];
  for (const s of valid) {
    const repeated = kept.some(k =>
      k.label === s.label &&
      Math.abs(k.factor - s.factor) <= 0.01 * k.factor &&
      (Date.parse(s.exDate) - Date.parse(k.exDate)) / DAY_MS <= SAME_EVENT_MAX_DAYS);
    if (!repeated) kept.push(s);
  }
  return kept.map(({ exDate, factor }) => ({ exDate, factor }));
}

/**
 * Eventos que a cotação de `asOf` (data em BRT, yyyy-mm-dd) já reflete: data-com antes dela.
 * Na data-com o fechamento ainda é das ações antigas; data-com futura ainda não aconteceu.
 */
export function splitsInPrice(splits: readonly StockSplit[], asOf: string): StockSplit[] {
  return splits.filter(s => s.exDate < asOf);
}

/** Divisor de um provento: produto dos fatores com data-com ≥ a data-com do provento. */
export function splitDivisor(splits: readonly StockSplit[], exDate: string): number {
  const day = isoDay(exDate);
  if (!day) return 1;
  let divisor = 1;
  for (const s of splits) {
    if (s.exDate >= day && Number.isFinite(s.factor) && s.factor > 0) divisor *= s.factor;
  }
  return divisor;
}

/**
 * Traz cada provento para a base de hoje. Idempotente: parte sempre do valor declarado
 * (`amountDeclared`), então reaplicar não divide duas vezes.
 */
export function adjustDividendsForSplits<T extends AdjustableDividend>(dividends: readonly T[], splits: readonly StockSplit[]): T[] {
  return dividends.map(d => {
    const declared = d.amountDeclared ?? d.amount;
    const divisor = splitDivisor(splits, d.exDate);
    if (divisor === 1) {
      return d.amountDeclared === undefined ? d : { ...d, amount: declared, amountDeclared: undefined, splitDivisor: undefined };
    }
    return { ...d, amount: declared / divisor, amountDeclared: declared, splitDivisor: divisor };
  });
}

/**
 * Ajuste por ticker: cada provento usa os eventos do próprio papel (TAEE11, TAEE3 e TAEE4
 * têm linhas separadas). Provento sem ticker usa `fallbackTicker` (o papel consultado).
 * `asOf` = data da cotação (BRT); por padrão, hoje (o build das 20h usa a cotação do dia).
 */
export function adjustDividendsByTicker<T extends AdjustableDividend & { symbol?: string }>(
  dividends: readonly T[],
  splitRows: readonly StockSplitRow[] | null | undefined,
  fallbackTicker: string,
  asOf: string = brtDateISO(new Date()),
): T[] {
  const rowsByTicker = new Map<string, StockSplitRow[]>();
  for (const r of splitRows ?? []) {
    const t = baseTicker(r.ticker);
    if (!t) continue;
    const list = rowsByTicker.get(t);
    if (list) list.push(r); else rowsByTicker.set(t, [r]);
  }
  const splitsByTicker = new Map<string, StockSplit[]>();
  for (const [t, rows] of rowsByTicker) splitsByTicker.set(t, splitsInPrice(toShareBaseSplits(rows), asOf));
  const fallback = baseTicker(fallbackTicker);
  return dividends.map(d => adjustDividendsForSplits([d], splitsByTicker.get(baseTicker(d.symbol) || fallback) ?? [])[0]);
}

/** Naturezas que são renda (restituição de capital e amortização ficam fora do DY). */
export const INCOME_DIVIDEND_TYPES = ['DIVIDENDO', 'JCP', 'RENDIMENTO'] as const;

export const isIncomeDividend = (type: unknown): boolean =>
  (INCOME_DIVIDEND_TYPES as readonly string[]).includes(plain(type));

/**
 * DY de 12 meses na base de hoje, com a régua do `compute_dividend_yield()` do banco (o
 * `dividend_yield` de `brapi_quotes`): proventos de RENDA com data-com em (hoje − 12 meses,
 * hoje], somados sem deduplicar, ÷ cotação. A única diferença é o divisor de split — é o
 * conserto ensaiado (e ainda não aplicado) no app.
 *
 * Só troca o DY publicado (`reported`) quando algum provento da janela foi ajustado: sem
 * evento na janela, o número do banco já está certo e fica intacto (nenhuma página muda à toa).
 *
 * As páginas NÃO usam mais esta função: o DY da página inteira e da lista é o
 * `dividendYieldTTM` de `./dividends` (a mesma régua, sem as duplicatas da fonte). A janela
 * daqui segue a de lá — (hoje − 12 meses, hoje], o limite de baixo fica de fora — para as duas
 * contas nunca divergirem por um provento com data-com exatamente em hoje − 12 meses.
 */
export function splitAdjustedDividendYield(
  dividends: readonly (AdjustableDividend & { dividendType?: string })[],
  price: number,
  reported: number,
  now: Date = new Date(),
): number {
  const today = brtDateISO(now);
  const from = isoMinusYears(today, 1);
  let ttm = 0;
  let adjusted = false;
  for (const d of dividends) {
    const ex = isoDay(d.exDate);
    if (!ex || ex <= from || ex > today) continue;
    if (!isIncomeDividend(d.dividendType) || !Number.isFinite(d.amount) || d.amount <= 0) continue;
    ttm += d.amount;
    if (d.splitDivisor !== undefined && d.splitDivisor !== 1) adjusted = true;
  }
  const fallback = Number.isFinite(reported) && reported > 0 ? reported : 0;
  if (!adjusted) return fallback;
  return Number.isFinite(price) && price > 0 ? ttm / price : 0;
}
