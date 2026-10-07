/**
 * Seções SSR da página de fluxo de caixa descontado (content/dcf.ts):
 *
 *  - dcf-exemplo: premissas, DRE projetada de 10 anos (5 explícitos + 5 de convergência) até o FCFF
 *    e o valor presente, e a ponte EV → equity → preço justo por ação da Empresa A;
 *  - dcf-wacc: o WACC da Empresa A decomposto (Ke, Kd bruto e líquido, pesos);
 *  - dcf-sensibilidade: o que acontece com o preço justo quando WACC e g mudam.
 *
 * A Empresa A é FICTÍCIA (SPEC §1): todo bloco leva o selo "Exemplo ilustrativo". Os números saem
 * das funções de content/dcf.ts, as mesmas contas da tabela de sensibilidade do widget
 * (widgets/dcf.js), então o texto, as tabelas e o widget batem entre si.
 */
import * as React from 'react';
import { brl, num, pct } from '../../ticker/lib/format';
import { EXEMPLO, SENS_BASE, SENS_G, SENS_WACC, WACC_PARTES, exemploDcf, mi, mi0, variacao } from '../content/dcf';
import type { SsrProps } from './index';

const p0 = (x: number): string => pct(x, 0);
const p1 = (x: number): string => pct(x, 1);
/** "10%, 9%, 8%, 7% e 6%" */
const lista = (xs: readonly string[]): string => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs.join(''));

function Selo({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-strong">Exemplo ilustrativo</span>
      {children}
    </p>
  );
}

// ─── Exemplo numérico: premissas, projeção e ponte ────────────────────────

export function DcfExemplo(_: SsrProps) {
  const e = EXEMPLO;
  const ex = exemploDcf();
  const b = ex.base;
  const f10 = ex.fcff[ex.fcff.length - 1];
  const margem = 1 - e.cpv - e.sga;

  const premissas: [string, string][] = [
    ['Receita do último ano (ano 0)', mi0(e.receita0)],
    ['Crescimento da receita', `${lista(e.crescimento.map(p0))} nos anos 1 a 5; ${p0(e.convergencia)} ao ano nos anos 6 a 10`],
    ['CPV / Receita', p0(e.cpv)],
    ['SG&A / Receita', p0(e.sga)],
    ['Margem EBITDA', `${p0(margem)}: resultado (100% − ${p0(e.cpv)} − ${p0(e.sga)}), não premissa`],
    ['D&A / Receita', p0(e.da)],
    ['Alíquota de IR/CSLL', p0(e.ir)],
    ['Capex / Receita', p0(e.capex)],
    ['Capital de giro', `${p0(e.giro)} da receita (o investimento do ano é ${p0(e.giro)} do aumento da receita)`],
    ['WACC e g perpétuo', `${p0(e.wacc)} e ${p0(e.g)}`],
    ['Dívida bruta e caixa', `${mi0(e.dividaBruta)} e ${mi0(e.caixa)}`],
    ['Número de ações', `${num(e.acoes, 0)} milhões`],
  ];

  type Linha = { label: string; valores: string[]; forte?: boolean; mudo?: boolean };
  const v1 = (xs: number[]) => xs.map((x) => num(x, 1));
  const linhas: Linha[] = [
    { label: 'Crescimento da receita', valores: ex.anos.map((a) => p0(a.crescimento)), mudo: true },
    { label: 'Receita', valores: v1(ex.anos.map((a) => a.receita)), forte: true },
    { label: `EBITDA (${p0(margem)} da receita)`, valores: v1(ex.anos.map((a) => a.ebitda)) },
    { label: `(−) D&A (${p0(e.da)})`, valores: v1(ex.anos.map((a) => a.da)) },
    { label: '= EBIT', valores: v1(ex.anos.map((a) => a.ebit)) },
    { label: `(−) IR/CSLL sobre o EBIT (${p0(e.ir)})`, valores: v1(ex.anos.map((a) => a.imposto)) },
    { label: '= NOPAT', valores: v1(ex.anos.map((a) => a.nopat)) },
    { label: '(+) D&A', valores: v1(ex.anos.map((a) => a.da)) },
    { label: `(−) Capex (${p0(e.capex)})`, valores: v1(ex.anos.map((a) => a.capex)) },
    { label: '(−) Δ capital de giro', valores: v1(ex.anos.map((a) => a.giro)) },
    { label: '= FCFF', valores: v1(ex.fcff), forte: true },
    { label: `Fator de desconto (WACC ${p0(e.wacc)})`, valores: ex.anos.map((a) => num(1 / Math.pow(1 + e.wacc, a.ano), 4)), mudo: true },
    { label: '= Valor presente do FCFF', valores: v1(ex.anos.map((a, i) => ex.fcff[i] / Math.pow(1 + e.wacc, a.ano))), forte: true },
  ];

  const ponte: { label: string; valor: string; total?: boolean }[] = [
    { label: 'Soma dos valores presentes dos FCFF (anos 1 a 10)', valor: mi(b.somaVp) },
    { label: `Valor terminal no ano 10: ${num(f10, 2)} × ${num(1 + e.g, 2)} ÷ ${num(e.wacc - e.g, 2)}`, valor: mi(b.vt) },
    { label: `(+) Valor presente do valor terminal: ${num(b.vt, 1)} ÷ ${num(1 + e.wacc, 2)}^10`, valor: mi(b.vpVt) },
    { label: '(=) Enterprise value (EV)', valor: mi(b.ev), total: true },
    { label: `(−) Dívida líquida: ${mi0(e.dividaBruta)} de dívida bruta − ${mi0(e.caixa)} de caixa`, valor: mi(b.dividaLiquida) },
    { label: '(=) Valor do capital próprio (equity)', valor: mi(b.equity), total: true },
    { label: '(÷) Número de ações', valor: `${num(e.acoes, 0)} milhões` },
  ];

  return (
    <div className="space-y-4" data-ssr="dcf-exemplo">
      <Selo>Empresa A: empresa fictícia, números escolhidos para o exemplo.</Selo>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="text-sm font-semibold">Premissas da Empresa A</h4>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {premissas.map(([k, v]) => (
            <div key={k} className="flex flex-col border-b border-dashed pb-2 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <figure className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto" role="region" aria-label="Projeção da Empresa A, anos 1 a 10 (role para os lados no celular)" tabIndex={0}>
          <table className="w-full min-w-[760px] text-right text-sm tnum">
            <caption className="sr-only">DRE projetada e fluxo de caixa livre para a firma da Empresa A, fictícia, em R$ milhões, anos 1 a 10</caption>
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 bg-card px-3 pt-3 text-left font-semibold">R$ milhões</th>
                <th scope="colgroup" colSpan={5} className="border-l px-2 pt-3 text-center font-semibold text-foreground">Anos explícitos</th>
                <th scope="colgroup" colSpan={5} className="border-l bg-muted/40 px-2 pt-3 text-center font-semibold text-foreground">Convergência</th>
              </tr>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 bg-card px-3 pb-2 text-left font-medium"><span className="sr-only">Linha</span></th>
                {ex.anos.map((a) => (
                  <th key={a.ano} scope="col" className={`px-2 pb-2 font-medium ${a.ano === 1 || a.ano === 6 ? 'border-l' : ''} ${a.ano > 5 ? 'bg-muted/40' : ''}`}>Ano {a.ano}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {linhas.map((l) => (
                <tr key={l.label} className={`border-b last:border-b-0 ${l.forte ? 'font-semibold text-foreground' : l.mudo ? 'text-muted-foreground' : ''}`}>
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-1.5 text-left font-sans text-[13px] font-medium">{l.label}</th>
                  {l.valores.map((v, i) => (
                    <td key={i} className={`px-2 py-1.5 ${i === 0 || i === 5 ? 'border-l' : ''} ${i > 4 ? 'bg-muted/40' : ''}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figcaption className="border-t px-4 py-2 text-xs leading-relaxed text-muted-foreground">
          Valores em R$ milhões, arredondados; as contas usam os números sem arredondamento. Nos anos de convergência, a receita cresce {p0(e.convergencia)} ao ano e as margens ficam iguais às do ano 5.
        </figcaption>
      </figure>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="text-sm font-semibold">Do valor da empresa ao preço justo por ação</h4>
        <dl className="mt-3 space-y-0 text-sm">
          {ponte.map((r) => (
            <div key={r.label} className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b py-2 ${r.total ? 'font-semibold' : ''}`}>
              <dt className="min-w-0">{r.label}</dt>
              <dd className="font-mono tnum">{r.valor}</dd>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 pt-3">
            <dt className="font-semibold">(=) Preço justo por ação</dt>
            <dd className="font-mono text-xl font-bold text-gold-strong tnum">{brl(b.preco)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          A perpetuidade responde por {p0(b.pesoPerpetuidade)} do enterprise value. Na plataforma, a ponte também traz o caixa e a dívida bruta da empresa, e os dois podem ser editados.
        </p>
      </div>
    </div>
  );
}

// ─── WACC decomposto ──────────────────────────────────────────────────────

export function DcfWacc(_: SsrProps) {
  const w = WACC_PARTES;
  const ex = exemploDcf();
  const linhas: { k: string; v: string; conta: string; total?: boolean }[] = [
    { k: 'Taxa livre de risco', v: p1(w.rf), conta: 'Ponto de partida do Ke' },
    { k: 'Beta (β)', v: num(w.beta, 1), conta: 'Multiplica o prêmio de risco de mercado' },
    { k: 'Prêmio de risco de mercado (ERP)', v: p1(w.erp), conta: `β × ERP = ${p1(w.beta * w.erp)}` },
    { k: 'Prêmio qualitativo', v: p1(w.premio), conta: 'No exemplo, Nota Qualitativa de 3,0 a menos de 3,5' },
    { k: '= Ke (custo do capital próprio)', v: p1(ex.ke), conta: `${p1(w.rf)} + ${num(w.beta, 1)} × ${p1(w.erp)} + ${p1(w.premio)}`, total: true },
    { k: 'Selic', v: p1(w.selic), conta: 'Base do custo da dívida' },
    { k: 'Spread de crédito', v: p1(w.spread), conta: 'O que a empresa paga acima da Selic' },
    { k: '= Kd bruto', v: p1(ex.kdBruto), conta: `${p1(w.selic)} + ${p1(w.spread)}`, total: true },
    { k: '= Kd líquido', v: p1(ex.kdLiquido), conta: `${p1(ex.kdBruto)} × (1 − ${p0(EXEMPLO.ir)} de IR)`, total: true },
    { k: 'E/V e D/V', v: `${p0(w.e)} e ${p0(w.d)}`, conta: 'Pesos do capital próprio e da dívida' },
  ];
  return (
    <div className="space-y-3" data-ssr="dcf-wacc">
      <Selo>Premissas da Empresa A, fictícia: não são dados de mercado.</Selo>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">WACC da Empresa A decomposto em Ke, Kd e pesos</caption>
          <thead className="hidden sm:table-header-group">
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-semibold">Componente</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Empresa A</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Conta</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.k} className={`border-b ${l.total ? 'bg-muted/40 font-semibold' : ''}`}>
                <th scope="row" className="px-4 py-2 font-medium">{l.k}</th>
                <td className="px-4 py-2 text-right font-mono tnum">{l.v}</td>
                <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">{l.conta}</td>
              </tr>
            ))}
            <tr className="bg-gold/10">
              <th scope="row" className="px-4 py-2.5 font-semibold">= WACC</th>
              <td className="px-4 py-2.5 text-right font-mono font-bold text-gold-strong tnum">{p0(EXEMPLO.wacc)}</td>
              <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                {p0(w.e)} × {p1(ex.ke)} + {p0(w.d)} × {p1(ex.kdLiquido)} = {pct(ex.waccCalculado, 3)}, arredondado para {p0(EXEMPLO.wacc)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sensibilidade: o preço justo quando WACC e g mudam ───────────────────

export function DcfSensibilidade(_: SsrProps) {
  const ex = exemploDcf();
  const c = SENS_BASE;
  const base = ex.grade[c][c];
  const casos: { k: string; v: number; base?: boolean }[] = [
    { k: `Caso base: WACC ${p0(SENS_WACC[c])} e g ${p1(SENS_G[c])}`, v: base, base: true },
    { k: `WACC ${p0(SENS_WACC[c + 1])} (+1 p.p.)`, v: ex.grade[c + 1][c] },
    { k: `WACC ${p0(SENS_WACC[c - 1])} (−1 p.p.)`, v: ex.grade[c - 1][c] },
    { k: `g ${p1(SENS_G[c + 1])} (+0,5 p.p.)`, v: ex.grade[c][c + 1] },
    { k: `g ${p1(SENS_G[c - 1])} (−0,5 p.p.)`, v: ex.grade[c][c - 1] },
    { k: `WACC ${p0(SENS_WACC[c - 1])} e g ${p1(SENS_G[c + 1])}`, v: ex.grade[c - 1][c + 1] },
    { k: `WACC ${p0(SENS_WACC[c + 1])} e g ${p1(SENS_G[c - 1])}`, v: ex.grade[c + 1][c - 1] },
  ];
  const todos = ex.grade.flat();
  return (
    <div className="space-y-3" data-ssr="dcf-sensibilidade">
      <Selo>Empresa A, fictícia: a mesma conta da tabela do topo da página.</Selo>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Preço justo por ação da Empresa A para mudanças no WACC e no crescimento na perpetuidade</caption>
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-semibold">Premissas</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Preço justo</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Diferença<span className="hidden sm:inline"> para o caso base</span></th>
            </tr>
          </thead>
          <tbody>
            {casos.map((x) => {
              const d = x.v / base - 1;
              return (
                <tr key={x.k} className={`border-b last:border-b-0 ${x.base ? 'bg-muted/40 font-semibold' : ''}`}>
                  <th scope="row" className="px-4 py-2 font-medium">{x.k}</th>
                  <td className="px-4 py-2 text-right font-mono tnum">{brl(x.v)}</td>
                  {/* Verde e vermelho escuros (alta/baixa do bundle): contraste ≥ 4,5:1 sobre o branco. */}
                  <td className={`px-4 py-2 text-right font-mono tnum ${x.base ? 'text-muted-foreground' : d > 0 ? 'text-[#17794F]' : 'text-[#B93838]'}`}>{x.base ? '—' : variacao(d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t px-4 py-2 text-xs leading-relaxed text-muted-foreground">
          Na tabela completa, com WACC de {p0(SENS_WACC[0])} a {p0(SENS_WACC[SENS_WACC.length - 1])} e g de {p1(SENS_G[0])} a {p1(SENS_G[SENS_G.length - 1])}, o preço justo vai de {brl(Math.min(...todos))} a {brl(Math.max(...todos))} por ação.
        </p>
      </div>
    </div>
  );
}
