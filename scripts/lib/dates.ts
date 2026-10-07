/**
 * Datas no calendário da B3 (fuso de São Paulo) e a data da cotação do `valuations.json`.
 *
 * Funções puras (o "agora" entra por parâmetro): os testes fixam o relógio.
 */

const TZ = 'America/Sao_Paulo';
const DAY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Data civil (yyyy-mm-dd) de um instante em BRT. 2026-10-07T02:30Z → "2026-10-06". */
export function brtDateISO(d: Date): string {
  const p: Record<string, string> = {};
  for (const part of DAY_FMT.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Mesma data N anos antes, como o `CURRENT_DATE - INTERVAL 'N years'` do Postgres:
 * 29/02 cai em 28/02 quando o ano de destino não é bissexto.
 */
export function isoMinusYears(iso: string, years: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const ty = y - years;
  const last = new Date(Date.UTC(ty, m, 0)).getUTCDate();
  return `${ty}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Dia útil (seg–sex) anterior à data de `now` em BRT. Não conhece feriados. */
export function previousBusinessDayBRT(now: Date): string {
  const [y, m, d] = brtDateISO(now).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  do {
    dt.setUTCDate(dt.getUTCDate() - 1);
  } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
  return dt.toISOString().slice(0, 10);
}

/**
 * Instante (ms) de um `regular_market_time`. A coluna é timestamptz e chega com fuso
 * ("2026-10-06T19:45:00+00:00"); texto sem fuso é lido como UTC (não como o fuso da
 * máquina que roda o build) e data pura vale meio-dia em BRT, para não trocar de dia.
 */
export function parseMarketTime(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  let iso = s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = `${s}T15:00:00Z`;
  else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) iso = `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Horário mais de 1 h à frente do relógio do build é lixo da fonte, não cotação. */
const MAX_FUTURE_MS = 60 * 60 * 1000;

/**
 * `_quoteDate` do `valuations.json`: a data (BRT) do `regular_market_time` mais recente
 * entre os tickers publicados no arquivo.
 *
 * O cron roda às 20h BRT, depois do pregão, com a cotação do próprio dia. A regra antiga
 * ("dia útil anterior ao build") datava a cotação de 06/10 como 05/10 — a landing escrevia
 * "Fechamento de 05/10" ao lado do preço de 06/10.
 *
 * - Quem chama passa só `regular_market_time`. O `updated_at` da linha muda em fim de
 *   semana e feriado (o update-quotes roda sem pregão) e dataria a cotação num sábado.
 * - Horário levemente à frente do relógio (fonte adiantada) é limitado a agora; mais de
 *   1 h à frente fica de fora.
 * - Sem nenhum horário válido, volta a regra antiga: dia útil anterior ao build.
 */
export function quoteDateFromTimes(times: Iterable<unknown>, now: Date = new Date()): string {
  const nowMs = now.getTime();
  let latest = -Infinity;
  for (const t of times) {
    const ms = parseMarketTime(t);
    if (ms === null || ms > nowMs + MAX_FUTURE_MS) continue;
    if (ms > latest) latest = ms;
  }
  if (!Number.isFinite(latest)) return previousBusinessDayBRT(now);
  return brtDateISO(new Date(Math.min(latest, nowMs)));
}
