/**
 * Seção SSR "markowitz-exemplo" (SPEC-v2 §C Markowitz): exemplo numérico com DUAS AÇÕES FICTÍCIAS,
 * com o selo "Exemplo ilustrativo" (SPEC §1: nenhum número atribuído a ticker real).
 *
 * Nenhum número é digitado à mão: tabela, cartões, gráfico e frases saem das premissas de
 * EXEMPLO pelas fórmulas de Markowitz, no build. Por construção, todos concordam entre si.
 *  - retorno da carteira:  E = w·E_A + (1 − w)·E_B
 *  - variância:            σ² = w²σ_A² + (1 − w)²σ_B² + 2·w·(1 − w)·ρ·σ_A·σ_B
 *  - menor risco:          w* = (σ_B² − ρσ_Aσ_B) ÷ (σ_A² + σ_B² − 2ρσ_Aσ_B)
 *  - maior Sharpe (2 ativos, sem venda a descoberto): fórmula fechada da tangência, limitada a [0, 1]
 *
 * O gráfico é SVG estático (linhas e pontos) com os rótulos em HTML posicionados em %: o texto
 * fica no tamanho da página em qualquer largura (no celular, texto dentro de SVG encolheria).
 */
import * as React from 'react';
import { num, pct } from '../../ticker/lib/format';
import type { SsrProps } from './index';

/** Premissas do exemplo (ilustrativas: não descrevem nenhuma empresa). */
export const EXEMPLO = {
  a: { nome: 'Ação A', e: 0.24, s: 0.35 },
  b: { nome: 'Ação B', e: 0.18, s: 0.22 },
  rho: 0.3,
  rf: 0.14,
} as const;

export interface Carteira {
  /** Peso da Ação A (fração); a Ação B fica com o resto. */
  w: number;
  e: number;
  s: number;
  sharpe: number;
}

type Premissas = { a: { e: number; s: number }; b: { e: number; s: number }; rho: number; rf: number };

export function carteira(w: number, p: Premissas = EXEMPLO): Carteira {
  const e = w * p.a.e + (1 - w) * p.b.e;
  const v = w * w * p.a.s * p.a.s + (1 - w) * (1 - w) * p.b.s * p.b.s + 2 * w * (1 - w) * p.rho * p.a.s * p.b.s;
  const s = Math.sqrt(v);
  return { w, e, s, sharpe: (e - p.rf) / s };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Peso de A na carteira de menor risco (variância mínima). */
export function pesoMenorRisco(p: Premissas = EXEMPLO): number {
  const cov = p.rho * p.a.s * p.b.s;
  return clamp01((p.b.s * p.b.s - cov) / (p.a.s * p.a.s + p.b.s * p.b.s - 2 * cov));
}

/** Peso de A na carteira de maior Sharpe (tangência), com os pesos entre 0% e 100%. */
export function pesoMaiorSharpe(p: Premissas = EXEMPLO): number {
  const cov = p.rho * p.a.s * p.b.s;
  const xa = p.a.e - p.rf;
  const xb = p.b.e - p.rf;
  const den = xa * p.b.s * p.b.s + xb * p.a.s * p.a.s - (xa + xb) * cov;
  return clamp01((xa * p.b.s * p.b.s - xb * cov) / den);
}

const P = (x: number, d = 1) => pct(x, d);
/** Sharpe com 3 casas: no exemplo, 60% e 80% em A dão 0,303 e 0,297 (com 2 casas, ambos "0,30"). */
const R = (x: number) => num(x, 3);

// ─── Gráfico (viewBox 340 × 248; risco 0–45% no eixo x, retorno 12–26% no eixo y) ─────────────
// O eixo de risco vai até 45% para sobrar espaço à direita da Ação A (rótulo dentro do quadro até
// em tela de 320 px).

const VB = { w: 340, h: 248 };
const PLOT = { x0: 40, x1: 326, y0: 204, y1: 20, rMax: 0.45, eMin: 0.12, eMax: 0.26 };
const X = (r: number) => PLOT.x0 + (r / PLOT.rMax) * (PLOT.x1 - PLOT.x0);
const Y = (e: number) => PLOT.y0 - ((e - PLOT.eMin) / (PLOT.eMax - PLOT.eMin)) * (PLOT.y0 - PLOT.y1);
const f1 = (n: number) => n.toFixed(1);

function path(from: number, to: number): string {
  const pts: string[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const c = carteira(from + ((to - from) * i) / steps);
    pts.push(`${i ? 'L' : 'M'}${f1(X(c.s))} ${f1(Y(c.e))}`);
  }
  return pts.join(' ');
}

type Anchor = 'center' | 'left' | 'right';
function Label({ x, y, anchor = 'center', className = '', children }: { x: number; y: number; anchor?: Anchor; className?: string; children: React.ReactNode }) {
  const tx = anchor === 'center' ? '-50%' : anchor === 'right' ? '-100%' : '0';
  return (
    <span
      className={`absolute whitespace-nowrap leading-none [text-shadow:0_0_3px_#fff,0_0_3px_#fff] ${className}`}
      style={{ left: `${((x / VB.w) * 100).toFixed(2)}%`, top: `${((y / VB.h) * 100).toFixed(2)}%`, transform: `translate(${tx}, -50%)` }}
    >
      {children}
    </span>
  );
}

function Grafico() {
  const a = carteira(1);
  const b = carteira(0);
  const mr = carteira(pesoMenorRisco());
  const ms = carteira(pesoMaiorSharpe());
  // Reta da taxa livre: sai de (0, rf) e passa pela tangência, até a borda do gráfico.
  const rEnd = Math.min(PLOT.rMax, (PLOT.eMax - EXEMPLO.rf) / ms.sharpe);
  const ticksX = [0, 0.1, 0.2, 0.3, 0.4];
  const ticksY = [0.12, 0.16, 0.2, 0.24];
  const desc =
    `Gráfico ilustrativo de risco e retorno das carteiras com as ações fictícias A e B. ` +
    `A carteira de menor risco tem ${P(mr.w)} em A, retorno esperado de ${P(mr.e)} e risco de ${P(mr.s)}. ` +
    `A reta que sai da taxa livre de ${P(EXEMPLO.rf, 0)} toca a curva na carteira de maior Sharpe, com ${P(ms.w)} em A, retorno esperado de ${P(ms.e)} e risco de ${P(ms.s)}.`;
  return (
    <figure className="m-0 space-y-3">
      <div role="img" aria-label={desc} className="relative mx-auto aspect-[340/248] w-full max-w-[520px] text-[11px] text-muted-foreground sm:text-xs">
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
          {ticksY.map((e) => <line key={e} x1={PLOT.x0} x2={PLOT.x1} y1={f1(Y(e))} y2={f1(Y(e))} stroke="#E4E1D8" strokeWidth="1" />)}
          {ticksX.slice(1).map((r) => <line key={r} x1={f1(X(r))} x2={f1(X(r))} y1={PLOT.y1} y2={PLOT.y0} stroke="#EFEDE7" strokeWidth="1" />)}
          <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y0} y2={PLOT.y0} stroke="#8E9AA6" strokeWidth="1" />
          <line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y1} y2={PLOT.y0} stroke="#8E9AA6" strokeWidth="1" />
          <line x1={f1(X(0))} y1={f1(Y(EXEMPLO.rf))} x2={f1(X(rEnd))} y2={f1(Y(EXEMPLO.rf + ms.sharpe * rEnd))} stroke="#5F6B70" strokeWidth="1.5" strokeDasharray="5 4" />
          <path d={path(0, mr.w)} fill="none" stroke="#8E9AA6" strokeWidth="2" strokeDasharray="4 3" />
          <path d={path(mr.w, 1)} fill="none" stroke="#B8923E" strokeWidth="3" strokeLinecap="round" />
          <circle cx={f1(X(0))} cy={f1(Y(EXEMPLO.rf))} r="3.5" fill="#5F6B70" />
          <circle cx={f1(X(b.s))} cy={f1(Y(b.e))} r="4.5" fill="#047857" />
          <circle cx={f1(X(a.s))} cy={f1(Y(a.e))} r="4.5" fill="#6D28D9" />
          <circle cx={f1(X(mr.s))} cy={f1(Y(mr.e))} r="5" fill="#fff" stroke="#0B1F26" strokeWidth="1.5" />
          <circle cx={f1(X(ms.s))} cy={f1(Y(ms.e))} r="6" fill="#B8923E" stroke="#fff" strokeWidth="2" />
        </svg>
        {ticksX.map((r) => <Label key={r} x={X(r)} y={216} className="tnum">{P(r, 0)}</Label>)}
        {ticksY.map((e) => <Label key={e} x={PLOT.x0 - 6} y={Y(e)} anchor="right" className="tnum">{P(e, 0)}</Label>)}
        <Label x={PLOT.x0} y={8} anchor="left" className="font-semibold">Retorno esperado</Label>
        <Label x={PLOT.x1} y={236} anchor="right" className="font-semibold">Risco (volatilidade)</Label>
        <Label x={X(a.s) + 7} y={Y(a.e)} anchor="left" className="font-semibold text-foreground">{EXEMPLO.a.nome}</Label>
        <Label x={X(b.s) + 7} y={Y(b.e)} anchor="left" className="font-semibold text-foreground">{EXEMPLO.b.nome}</Label>
        <Label x={X(ms.s) - 7} y={Y(ms.e) - 11} anchor="right" className="font-semibold text-foreground">maior Sharpe</Label>
        <Label x={X(0) + 6} y={Y(EXEMPLO.rf) + 13} anchor="left">taxa livre</Label>
      </div>
      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-[3px] w-5 rounded-full bg-gold" aria-hidden="true" />fronteira eficiente</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-[#8E9AA6]" aria-hidden="true" />trecho ineficiente</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border-[1.5px] border-foreground bg-white" aria-hidden="true" />carteira de menor risco</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-[1.5px] border-dashed border-[#5F6B70]" aria-hidden="true" />reta da taxa livre</span>
      </figcaption>
    </figure>
  );
}

// ─── Seção ────────────────────────────────────────────────────────────────

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const TD = 'px-3 py-2 font-mono tnum';

function Selo() {
  return <span className="inline-flex rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-strong">Exemplo ilustrativo</span>;
}

export function MarkowitzExemplo(_: SsrProps) {
  const ex = EXEMPLO;
  const wMr = pesoMenorRisco();
  const wMs = pesoMaiorSharpe();
  const mr = carteira(wMr);
  const ms = carteira(wMs);
  const so = { a: carteira(1), b: carteira(0) };
  const vinte = carteira(0.2);
  const grade = [0, 0.2, 0.4, 0.6, 0.8, 1].map((w) => carteira(w));
  const perto = (w: number) => (Math.abs(w - wMr) < 0.05 ? 'perto do menor risco' : Math.abs(w - wMs) < 0.05 ? 'perto do maior Sharpe' : null);
  const correlacoes = [1, 0.5, ex.rho, 0, -0.5].map((rho) => ({ rho, c: carteira(0.5, { ...ex, rho }) }));
  // Sensibilidade: o mesmo exemplo com 2 pontos a menos no retorno esperado de A.
  const aMenor = { ...ex, a: { ...ex.a, e: ex.a.e - 0.02 } };
  const wMsMenor = pesoMaiorSharpe(aMenor);

  return (
    <div className="space-y-5" data-ssr="markowitz-exemplo">
      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Premissas do exemplo</h3>
          <Selo />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Premissas das ações fictícias A e B</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className={TH}>Ação</th>
                <th scope="col" className={`${TH} text-right`}>Retorno esperado (12 meses)</th>
                <th scope="col" className={`${TH} text-right`}>Volatilidade (ano)</th>
              </tr>
            </thead>
            <tbody>
              {[ex.a, ex.b].map((x) => (
                <tr key={x.nome} className="border-b last:border-b-0">
                  <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-semibold">{x.nome}</th>
                  <td className={`${TD} text-right`}>{P(x.e)}</td>
                  <td className={`${TD} text-right`}>{P(x.s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Correlação entre A e B: <strong className="font-mono font-semibold text-foreground tnum">{num(ex.rho, 1)}</strong>. Taxa livre de risco: <strong className="font-mono font-semibold text-foreground tnum">{P(ex.rf, 0)}</strong> ao ano. O retorno esperado é premissa: no Otimizador, ele sai do preço-alvo de cada ação.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <Grafico />
        </div>
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Carteiras com pesos diferentes</h3>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Retorno esperado, risco e índice de Sharpe de carteiras com as ações A e B</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className={TH}>Em A</th>
                  <th scope="col" className={TH}>Em B</th>
                  <th scope="col" className={`${TH} text-right`}>Retorno</th>
                  <th scope="col" className={`${TH} text-right`}>Risco</th>
                  <th scope="col" className={`${TH} text-right`}>Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {grade.map((c) => {
                  const nota = perto(c.w);
                  return (
                    <tr key={c.w} className={`border-b last:border-b-0 ${nota ? 'bg-gold/10' : ''}`}>
                      <td className={TD}>
                        {P(c.w, 0)}
                        {nota && <span className="sr-only"> ({nota})</span>}
                      </td>
                      <td className={TD}>{P(1 - c.w, 0)}</td>
                      <td className={`${TD} text-right`}>{P(c.e)}</td>
                      <td className={`${TD} text-right`}>{P(c.s)}</td>
                      <td className={`${TD} text-right`}>{R(c.sharpe)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Em destaque, as linhas mais perto da carteira de menor risco e da de maior Sharpe (os pesos exatos estão nos cartões abaixo). Sharpe = (retorno esperado − {P(ex.rf, 0)}) ÷ risco. Retorno e risco ao ano.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 pl-5">
          <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Carteira de menor risco</h3>
          <p className="mt-1 font-mono text-lg font-semibold tnum">{P(wMr)} em A · {P(1 - wMr)} em B</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Retorno esperado de {P(mr.e)} e risco de {P(mr.s)}: menos que o risco da {ex.b.nome} sozinha ({P(so.b.s)}), a menos arriscada das duas. A {ex.a.nome} oscila mais, mas a correlação baixa faz as oscilações se compensarem em parte.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 pl-5">
          <span className="absolute inset-y-0 left-0 w-1 bg-gold" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Carteira de maior Sharpe (tangência)</h3>
          <p className="mt-1 font-mono text-lg font-semibold tnum">{P(wMs)} em A · {P(1 - wMs)} em B</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Retorno esperado de {P(ms.e)}, risco de {P(ms.s)} e Sharpe de {R(ms.sharpe)}, acima do Sharpe da {ex.a.nome} ({R(so.a.sharpe)}) e da {ex.b.nome} ({R(so.b.sharpe)}) sozinhas.
          </p>
        </div>
      </div>

      <ul className="list-disc space-y-2 pl-5 leading-relaxed marker:text-gold-strong">
        <li>
          Sair de 100% em B para 20% em A sobe o retorno esperado (de {P(so.b.e)} para {P(vinte.e)}) e baixa o risco (de {P(so.b.s)} para {P(vinte.s)}). A carteira só com B fica abaixo da fronteira: é <strong className="font-semibold text-foreground">ineficiente</strong>.
        </li>
        <li>
          Da carteira de menor risco em diante, mais A traz mais retorno esperado e mais risco. Esse trecho da curva é a <strong className="font-semibold text-foreground">fronteira eficiente</strong>: nenhuma outra combinação dá mais retorno com o mesmo risco.
        </li>
        <li>
          O resultado é sensível à premissa. Se o retorno esperado da {ex.a.nome} cair de {P(ex.a.e, 0)} para {P(aMenor.a.e, 0)}, o peso dela na carteira de maior Sharpe cai de {P(wMs, 0)} para {P(wMsMenor, 0)}.
        </li>
      </ul>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">O efeito da correlação</h3>
        <p className="leading-relaxed">
          Mesma carteira (50% em cada ação), mesmo retorno esperado ({P(carteira(0.5).e)}), correlações diferentes. Só o risco muda:
        </p>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Risco da carteira com 50% em A e 50% em B para correlações diferentes</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className={TH}>Correlação entre A e B</th>
                <th scope="col" className={`${TH} text-right`}>Risco da carteira 50/50</th>
              </tr>
            </thead>
            <tbody>
              {correlacoes.map(({ rho, c }) => (
                <tr key={rho} className={`border-b last:border-b-0 ${rho === ex.rho ? 'bg-gold/10' : ''}`}>
                  <td className={TD}>
                    {num(rho, 1).replace('-', '−')}
                    {rho === 1 && <span className="ml-2 font-sans text-xs text-muted-foreground">oscilam sempre juntas</span>}
                    {rho === ex.rho && <span className="ml-2 font-sans text-xs font-semibold text-gold-strong">premissa do exemplo</span>}
                  </td>
                  <td className={`${TD} text-right`}>{P(c.s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Com correlação 1, o risco da carteira é só a média do risco das duas ({P(correlacoes[0].c.s)}) e não há ganho de diversificação. Quanto menor a correlação, mais as oscilações de uma ação compensam as da outra.
        </p>
      </div>
    </div>
  );
}
