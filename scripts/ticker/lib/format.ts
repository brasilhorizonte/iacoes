// Formatação pt-BR. Toda função devolve '—' para número ausente/infinito:
// melhor um traço do que "NaN%" ou "R$ 0,00" inventado.

export const DASH = '—';

export const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

export const num = (n: number | null | undefined, dec = 2): string =>
  ok(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : DASH;

export const brl = (n: number | null | undefined, dec = 2): string => (ok(n) ? `R$ ${num(n, dec)}` : DASH);

/** Fração → porcentagem (0.123 → "12,3%"). */
export const pct = (n: number | null | undefined, dec = 1): string => (ok(n) ? `${num(n * 100, dec)}%` : DASH);

/** Fração → porcentagem com sinal (+12,3%). */
export const signedPct = (n: number | null | undefined, dec = 1): string =>
  ok(n) ? `${n > 0 ? '+' : ''}${num(n * 100, dec)}%` : DASH;

export const mult = (n: number | null | undefined, dec = 2): string => (ok(n) && n !== 0 ? `${num(n, dec)}x` : DASH);

const scale = (n: number): [number, string] => {
  const a = Math.abs(n);
  if (a >= 1e12) return [n / 1e12, 'tri'];
  if (a >= 1e9) return [n / 1e9, 'bi'];
  if (a >= 1e6) return [n / 1e6, 'mi'];
  if (a >= 1e3) return [n / 1e3, 'mil'];
  return [n, ''];
};

/** Valores grandes: "R$ 648,5 bi". */
export const big = (n: number | null | undefined): string => {
  if (!ok(n) || n === 0) return DASH;
  const [v, s] = scale(n);
  return `R$ ${num(v, Math.abs(v) >= 100 ? 0 : 1)}${s ? ' ' + s : ''}`;
};

/** Quantidades sem moeda: "13,5 bi". */
export const qty = (n: number | null | undefined): string => {
  if (!ok(n) || n === 0) return DASH;
  const [v, s] = scale(n);
  return `${num(v, s ? 1 : 0)}${s ? ' ' + s : ''}`;
};

/** "2026-08-27" → "27/08/2026" sem passar por Date (evita deslocamento de fuso). */
export const isoToBR = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export const tone = (n: number | null | undefined): 'positive' | 'negative' | 'neutral' =>
  !ok(n) || Math.abs(n) < 1e-9 ? 'neutral' : n > 0 ? 'positive' : 'negative';

export const truncate = (raw: string, max: number): string => {
  const t = (raw || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:-]+$/, '') + '…';
};

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
