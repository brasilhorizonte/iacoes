import * as React from 'react';
import { num } from '../ticker/lib/format';
import type { BuffettModel } from './model';
import { monthLabel } from './model';

/**
 * Gráfico mensal desde 2000 em SVG estático (sem JS): o crawler lê <title>/<desc> e o
 * desenho escala por viewBox. Cores pelos tokens do tema (var(--…)).
 */
export function BuffettChart({ m }: { m: BuffettModel }) {
  const pts = m.monthly;
  const W = 960, H = 380, PL = 46, PR = 14, PT = 16, PB = 32;
  const yMax = Math.max(100, Math.ceil(m.stats.max.value / 20) * 20);
  const x = (i: number) => PL + (i * (W - PL - PR)) / Math.max(1, pts.length - 1);
  const y = (v: number) => PT + ((yMax - v) * (H - PT - PB)) / yMax;
  const idx = new Map(pts.map((p, i) => [p.date, i]));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const yTicks = Array.from({ length: yMax / 20 + 1 }, (_, i) => i * 20);
  const years = pts.map((p, i) => ({ p, i })).filter(({ p }, k, arr) => {
    const yr = Number(p.date.slice(0, 4));
    const firstOfYear = k === 0 || arr[k - 1].p.date.slice(0, 4) !== p.date.slice(0, 4);
    return firstOfYear && yr % 2 === 0;
  });
  const maxI = idx.get(m.stats.max.date) ?? 0;
  const minI = idx.get(m.stats.min.date) ?? 0;
  const lastI = pts.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="buffett-chart-t buffett-chart-d" className="h-auto w-full">
      <title id="buffett-chart-t">{`Indicador de Buffett do Brasil, mensal, desde ${m.s.since}`}</title>
      <desc id="buffett-chart-d">
        {`Valor de mercado da B3 dividido pelo PIB de 12 meses. Máxima de ${m.s.max}% em ${m.s.maxMonth}, mínima de ${m.s.min}% em ${m.s.minMonth}, último valor ${m.v}% em ${m.dateBR}.`}
      </desc>
      {m.estimatedRanges.map((r) => {
        const a = idx.get(r.from) ?? 0, b = idx.get(r.to) ?? 0;
        return <rect key={r.from} x={x(a)} y={PT} width={Math.max(2, x(b) - x(a))} height={H - PT - PB} fill="var(--muted)" opacity="0.9" />;
      })}
      <rect x={PL} y={y(m.stats.p75)} width={W - PL - PR} height={y(m.stats.p25) - y(m.stats.p75)} fill="var(--positive)" opacity="0.08" />
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
          <text x={PL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{t}%</text>
        </g>
      ))}
      {years.map(({ p, i }) => (
        <text key={p.date} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">{p.date.slice(0, 4)}</text>
      ))}
      <path d={area} fill="var(--gold)" opacity="0.1" />
      <line x1={PL} x2={W - PR} y1={y(m.stats.mean)} y2={y(m.stats.mean)} stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="6 5" />
      {/* Rótulos à esquerda: à direita disputariam espaço com o rótulo do último valor. */}
      <text x={PL + 6} y={y(m.stats.mean) - 6} fontSize="11" fontWeight="600" fill="var(--gold-strong)">média {m.s.mean}%</text>
      <text x={PL + 6} y={y(m.stats.p75) - 6} fontSize="11" fontWeight="600" fill="var(--positive)">faixa histórica (p25–p75)</text>
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(maxI)} cy={y(m.stats.max.value)} r="4" fill="var(--primary)" />
      <text x={x(maxI) + 8} y={y(m.stats.max.value) + 4} fontSize="11" fontWeight="600" fill="var(--foreground)">máx. {m.s.max}% ({m.s.maxMonth})</text>
      <circle cx={x(minI)} cy={y(m.stats.min.value)} r="4" fill="var(--primary)" />
      <text x={x(minI) + 8} y={y(m.stats.min.value) + 16} fontSize="11" fontWeight="600" fill="var(--foreground)">mín. {m.s.min}% ({m.s.minMonth})</text>
      <circle cx={x(lastI)} cy={y(pts[lastI].value)} r="5.5" fill="var(--gold)" stroke="var(--primary)" strokeWidth="2" />
      <text x={x(lastI) - 8} y={y(pts[lastI].value) - 10} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--foreground)">
        {num(pts[lastI].value, 1)}% ({monthLabel(pts[lastI].date)})
      </text>
    </svg>
  );
}
