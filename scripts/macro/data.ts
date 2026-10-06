/**
 * Indicador de Buffett Brasil — leitura das séries no Supabase e estatísticas da página.
 *
 * Séries (projeto brasilhorizonte, leitura pública via anon key), montadas no
 * dashbrasilhorizonte pelas EFs update-b3-market-value e update-buffett-indicator:
 *   99010 — Buffett B3 mensal (%): 1 ponto por mês desde 2000 (último pregão do mês; no
 *           mês corrente, o último fechamento oficial diário)
 *   99020 — valor de mercado B3 oficial, diário (R$ MM): TOTAL GERAL publicado pela B3
 *   99021 — valor de mercado B3 mensal (R$ MM): oficial desde jul/2026 + backfill
 *   4382  — PIB 12m (R$ MM), BCB SGS, reference_date no dia 01 do mês
 *
 * Manchete (decisão D10 da spec): só o fechamento OFICIAL mais recente publicado pela B3.
 * Nada de estimativa do dia.
 */
import { createClient } from '@supabase/supabase-js';

export interface Point {
  date: string;
  value: number;
}

export interface BuffettData {
  monthly: Point[];
  mcapMonthly: Point[];
  mcapDaily: Point[];
  pib: Point[];
}

const SERIES = { monthly: 99010, mcapDaily: 99020, mcapMonthly: 99021, pib: 4382 } as const;

export async function fetchBuffettData(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY): Promise<BuffettData> {
  if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_ANON_KEY ausentes');
  const sb = createClient(url, key);
  const load = async (seriesId: number): Promise<Point[]> => {
    const out: Point[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('sgs_series_data')
        .select('reference_date, value')
        .eq('series_id', seriesId)
        .order('reference_date', { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(`sgs_series_data ${seriesId}: ${error.message}`);
      for (const r of data ?? []) out.push({ date: String(r.reference_date), value: Number(r.value) });
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  const [monthly, mcapMonthly, mcapDaily, pib] = await Promise.all([
    load(SERIES.monthly),
    load(SERIES.mcapMonthly),
    load(SERIES.mcapDaily),
    load(SERIES.pib),
  ]);
  return { monthly, mcapMonthly, mcapDaily, pib };
}

// ─── Funções puras ────────────────────────────────────────────────────────

export const monthOf = (iso: string): string => iso.slice(0, 7);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** PIB 12m de uma data: o do mesmo mês ou, se ainda não saiu, o último anterior. */
export function pibFor(pib: Point[], iso: string): Point | null {
  const month = monthOf(iso);
  let best: Point | null = null;
  for (const p of pib) if (monthOf(p.date) <= month && (!best || p.date > best.date)) best = p;
  return best;
}

/** Quantil por interpolação linear (mesmo método do protótipo da série corrigida). */
export function quantile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export interface Stats {
  n: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  min: Point;
  max: Point;
  first: string;
}

export function seriesStats(monthly: Point[]): Stats {
  if (!monthly.length) throw new Error('série mensal vazia');
  const sorted = monthly.map((p) => p.value).sort((a, b) => a - b);
  return {
    n: monthly.length,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    min: monthly.reduce((a, b) => (b.value < a.value ? b : a)),
    max: monthly.reduce((a, b) => (b.value > a.value ? b : a)),
    first: monthly[0].date,
  };
}

/** % dos meses da série com valor menor ou igual a `v`, arredondado. */
export const percentileOf = (v: number, monthly: Point[]): number =>
  Math.round((100 * monthly.filter((p) => p.value <= v).length) / monthly.length);

export type Faixa = 'historicamente barata' | 'dentro da faixa histórica' | 'historicamente cara';
export const faixaOf = (v: number, s: Stats): Faixa =>
  v < s.p25 ? 'historicamente barata' : v > s.p75 ? 'historicamente cara' : 'dentro da faixa histórica';

export interface Headline {
  /** Pregão de referência do último fechamento oficial publicado pela B3. */
  date: string;
  value: number;
  mcapMM: number;
  pibMM: number;
  /** Mês do PIB 12m usado ("aaaa-mm"). */
  pibMonth: string;
}

/** Manchete: último diário oficial (99020) ÷ PIB 12m aplicável. */
export function headline(d: BuffettData): Headline {
  const last = d.mcapDaily[d.mcapDaily.length - 1];
  if (!last) throw new Error('sem valor de mercado oficial diário (99020)');
  const p = pibFor(d.pib, last.date);
  if (!p) throw new Error(`sem PIB 12m para ${last.date}`);
  return { date: last.date, value: round2((100 * last.value) / p.value), mcapMM: last.value, pibMM: p.value, pibMonth: monthOf(p.date) };
}

/** Ponto da 99010 no fim do mês anterior ao da data e no mesmo mês um ano antes. */
export function comparisons(monthly: Point[], iso: string): { prevMonth: Point | null; yearAgo: Point | null } {
  const month = monthOf(iso);
  const [y, m] = month.split('-').map(Number);
  const yearAgoMonth = `${y - 1}-${String(m).padStart(2, '0')}`;
  let prevMonth: Point | null = null;
  for (const p of monthly) if (monthOf(p.date) < month) prevMonth = p;
  const yearAgo = monthly.find((p) => monthOf(p.date) === yearAgoMonth) ?? null;
  return { prevMonth, yearAgo };
}

export interface Source {
  kind: 'oficial' | 'estimado';
  label: string;
}

/**
 * Procedência de cada mês da série (ver o cabeçalho do backfill no dashbrasilhorizonte:
 * scripts/backfill_buffett_b3_oficial.mjs). O mês corrente vem do diário oficial.
 */
export function sourceOf(iso: string): Source {
  const m = monthOf(iso);
  if (m >= '2026-07') return { kind: 'oficial', label: 'B3 (TOTAL GERAL)' };
  if (m >= '2019-09') {
    return m.endsWith('-12') && m <= '2025-12'
      ? { kind: 'oficial', label: 'Banco Mundial/WFE × PTAX de 31/dez' }
      : { kind: 'estimado', label: 'Interpolado pelo Ibovespa entre âncoras anuais' };
  }
  if (m >= '2018-11' && m <= '2019-01') return { kind: 'estimado', label: 'Interpolado pelo Ibovespa (anomalia na fonte)' };
  return { kind: 'oficial', label: 'BCB SGS 7849' };
}

export interface CsvRow {
  date: string;
  buffett: number;
  mcapMM: number | null;
  pibMM: number | null;
  source: Source;
}

/** Linhas do CSV público: 1 por mês da 99010, com valor de mercado e PIB usados. */
export function csvRows(d: BuffettData): CsvRow[] {
  const mcapByMonth = new Map(d.mcapMonthly.map((p) => [monthOf(p.date), p.value]));
  const lastDaily = d.mcapDaily[d.mcapDaily.length - 1];
  return d.monthly.map((p) => {
    const mcap = mcapByMonth.get(monthOf(p.date)) ?? (lastDaily && lastDaily.date === p.date ? lastDaily.value : null);
    return { date: p.date, buffett: p.value, mcapMM: mcap, pibMM: pibFor(d.pib, p.date)?.value ?? null, source: sourceOf(p.date) };
  });
}

export function toCsv(rows: CsvRow[]): string {
  const head = 'data,indicador_buffett_pct,valor_mercado_b3_rs_milhoes,pib_12m_rs_milhoes,procedencia,fonte';
  const cell = (s: string) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [
    head,
    ...rows.map((r) =>
      [r.date, r.buffett.toFixed(2), r.mcapMM?.toFixed(2) ?? '', r.pibMM?.toFixed(1) ?? '', r.source.kind, cell(r.source.label)].join(','),
    ),
  ].join('\n') + '\n';
}

/**
 * Checagens antes de publicar. `problems` bloqueia a geração (a página anterior fica no ar);
 * `warnings` só aparece no log do CI.
 */
export function validate(d: BuffettData, h: Headline | null, today = new Date()): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (d.monthly.length < 300) problems.push(`série mensal com ${d.monthly.length} pontos (< 300): backfill ausente?`);
  if (!h) return { problems: [...problems, 'sem manchete (99020 vazia)'], warnings };
  if (!(h.value >= 10 && h.value <= 150)) problems.push(`valor fora da faixa plausível: ${h.value}%`);
  const age = (today.getTime() - Date.parse(`${h.date}T00:00:00Z`)) / 86400000;
  if (age > 7) problems.push(`último fechamento oficial é de ${h.date} (${Math.floor(age)} dias): arquivo da B3 parado?`);
  const last = d.monthly[d.monthly.length - 1];
  if (last && monthOf(last.date) === monthOf(h.date) && Math.abs(last.value - h.value) > 0.05) {
    warnings.push(`99010 do mês (${last.value}% em ${last.date}) difere da manchete (${h.value}% em ${h.date}): update-buffett-indicator atrasada`);
  }
  return { problems, warnings };
}
