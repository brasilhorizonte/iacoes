/**
 * Seção SSR do backtest (SPEC-v2 §B8 e §C Backtest): a tabela REAL Ibovespa × CDI em 1, 5, 10 e 15
 * anos, com a data dos dados, o resumo de quem rendeu mais em cada janela e quanto R$ 1.000 teriam
 * virado — tudo calculado no build a partir do dados.json do backtest (m.env.extra.backtest).
 *
 * As contas são as mesmas do widget (widgets/backtest.js): retorno do horizonte de N anos =
 * série[último] ÷ série[último − 12N] − 1, sobre a série publicada; o número exibido sai do valor
 * sem arredondar (o `table` do arquivo é a mesma conta com 4 casas). Assim a tabela, o widget e o
 * FAQ mostram o mesmo número.
 *
 * Perto dos números (DADOS-API §3): a nota do Ibovespa vem do próprio arquivo (ibov.note, hoje
 * "índice de retorno total, com proventos reinvestidos"), o CDI é a taxa bruta, os dois sem custos
 * nem impostos, e passado não garante futuro. Sem curva "Sua carteira": só o convite para testar a
 * carteira na plataforma.
 */
import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '../../ticker/components/ui/button';
import { brl, isoToBR, num, pct } from '../../ticker/lib/format';
import { backtestOf } from '../model';
import type { BacktestData } from '../data';
import type { SsrProps } from './index';

/** Cores das séries (as mesmas do widget): contraste ≥ 3:1 no branco e distintas para daltonismo. */
export const BT_COR = { ibov: '#0B6E99', cdi: '#A3802A' } as const;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2016-09" → "set/2016". */
export const mesAno = (ym: string): string => `${MESES[Number(ym.slice(5, 7)) - 1] ?? '?'}/${ym.slice(0, 4)}`;

export const anos = (n: number): string => `${n} ${n === 1 ? 'ano' : 'anos'}`;

/** Fração com sinal, 1 casa ("+219,3%"); zero sem sinal. Mesma regra do widget. */
export function sinal(frac: number): string {
  const r = Math.round(frac * 1000) / 1000;
  if (r === 0) return '0,0%';
  return `${r > 0 ? '+' : ''}${pct(frac, 1)}`;
}

export type Vencedor = 'ibov' | 'cdi' | 'empate';

export interface LinhaBacktest {
  years: number;
  /** Mês de início (fim do mês, base 100) e de fim, "AAAA-MM". */
  from: string;
  to: string;
  /** Retorno acumulado no horizonte (fração). */
  ibov: number;
  cdi: number;
  /** Equivalente ao ano (fração). */
  ibovAA: number;
  cdiAA: number;
  vence: Vencedor;
}

/**
 * Linhas da tabela, na ordem dos horizontes do arquivo (1, 5, 10 e 15 anos), calculadas sobre as
 * séries publicadas. Horizonte sem dado suficiente fica de fora (o produtor já exige 15 anos).
 */
export function linhasBacktest(d: BacktestData): LinhaBacktest[] {
  const ib = d.ibov.series;
  const cd = d.cdi.series;
  const n = ib.length - 1;
  if (n < 12 || cd.length !== ib.length) return [];
  const horizontes = [...new Set((d.table.length ? d.table.map((t) => t.years) : [1, 5, 10, 15]) as number[])].sort((a, b) => a - b);
  const out: LinhaBacktest[] = [];
  for (const years of horizontes) {
    const i = n - 12 * years;
    if (i < 0 || !(ib[i][1] > 0) || !(cd[i][1] > 0) || cd[i][0] !== ib[i][0]) continue;
    const ibov = ib[n][1] / ib[i][1] - 1;
    const cdi = cd[n][1] / cd[i][1] - 1;
    // Empate só quando os dois arredondam para o mesmo número exibido (1 casa).
    const vence: Vencedor = sinal(ibov) === sinal(cdi) ? 'empate' : ibov > cdi ? 'ibov' : 'cdi';
    out.push({
      years,
      from: ib[i][0],
      to: ib[n][0],
      ibov,
      cdi,
      ibovAA: Math.pow(1 + ibov, 1 / years) - 1,
      cdiAA: Math.pow(1 + cdi, 1 / years) - 1,
      vence,
    });
  }
  return out;
}

/** "nos períodos de 1 e 10 anos" / "no período de 5 anos". */
function periodos(ys: number[]): string {
  if (ys.length === 1) return `no período de ${anos(ys[0])}`;
  const nums = ys.map(String);
  return `nos períodos de ${nums.slice(0, -1).join(', ')} e ${nums[nums.length - 1]} anos`;
}

/** Resumo de quem rendeu mais, gerado do dado (nunca contradiz a tabela). */
export function resumoBacktest(linhas: LinhaBacktest[], dateBR: string): string {
  const por = (v: Vencedor) => linhas.filter((l) => l.vence === v).map((l) => l.years);
  const ib = por('ibov');
  const cd = por('cdi');
  const emp = por('empate');
  const base = `Com dados até ${dateBR}, `;
  const total = linhas.length;
  if (ib.length === total) return `${base}o Ibovespa rendeu mais que o CDI em todos os períodos da tabela. Ainda assim, o resultado depende da janela escolhida.`;
  if (cd.length === total) return `${base}o CDI rendeu mais que o Ibovespa em todos os períodos da tabela. Ainda assim, o resultado depende da janela escolhida.`;
  if (emp.length === total) return `${base}o Ibovespa e o CDI ficaram praticamente empatados em todos os períodos da tabela.`;
  const partes: string[] = [];
  if (ib.length) partes.push(`o Ibovespa rendeu mais ${periodos(ib)}`);
  if (cd.length) partes.push(ib.length ? `o CDI, ${periodos(cd)}` : `o CDI rendeu mais ${periodos(cd)}`);
  if (emp.length) partes.push(`os dois empataram ${periodos(emp)}`);
  const frase = `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
  const fecho = ib.length && cd.length ? ' Quem ganha depende da janela: por isso vale olhar mais de um período antes de tirar conclusões.' : '';
  return `${base}${frase}.${fecho}`;
}

/** Quanto R$ 1.000 teriam virado nos dois horizontes mais longos (busca "quanto teria rendido"). */
export function emReaisBacktest(linhas: LinhaBacktest[]): string | null {
  const longos = linhas.slice(-2);
  if (!longos.length) return null;
  const real = (frac: number) => brl(1000 * (1 + frac), 0);
  const [a, b] = longos;
  const primeiro = `R$ 1.000 que acompanhassem o Ibovespa do fim de ${mesAno(a.from)} ao fim de ${mesAno(a.to)} virariam ${real(a.ibov)}; no CDI, ${real(a.cdi)}.`;
  const depois = b ? ` Em ${anos(b.years)}, desde o fim de ${mesAno(b.from)}: ${real(b.ibov)} no Ibovespa e ${real(b.cdi)} no CDI.` : '';
  return `Em reais: ${primeiro}${depois} Valores brutos, antes de custos e impostos.`;
}

/** Traço com a cor da série (identidade do gráfico); no celular estreito some para o cabeçalho não quebrar. */
const Chave = ({ cor }: { cor: string }) => (
  <span aria-hidden="true" className="mr-1.5 hidden h-0.5 w-3.5 rounded-full align-middle min-[400px]:inline-block" style={{ backgroundColor: cor }} />
);

function Valor({ frac, aa, vence }: { frac: number; aa: number; vence: boolean }) {
  return (
    <>
      <span className={`font-mono tnum ${vence ? 'font-bold text-foreground' : 'text-foreground/80'}`}>{sinal(frac)}</span>
      <span className="block text-xs text-muted-foreground tnum">{num(aa * 100, 1)}% a.a.</span>
      {vence && <span className="mt-1 inline-block whitespace-nowrap rounded bg-muted px-1 py-0.5 text-[10.5px] font-semibold text-foreground sm:hidden">rendeu mais</span>}
    </>
  );
}

/** Tabela Ibovespa × CDI (dado real do build), resumo, nota de método e convite para a plataforma. */
export function BacktestTabela({ m }: SsrProps) {
  const d = backtestOf(m.env);
  if (!d) return null;
  const linhas = linhasBacktest(d);
  if (!linhas.length) return null;
  const dateBR = isoToBR(d.updated);
  const emReais = emReaisBacktest(linhas);
  const horizontes = linhas.map((l) => l.years);
  const listaHorizontes = `${horizontes.slice(0, -1).join(', ')} e ${horizontes[horizontes.length - 1]} anos`;
  return (
    <div className="space-y-4" data-ssr="backtest">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-base font-semibold">Retorno acumulado: Ibovespa × CDI</h3>
          <span className="text-xs text-muted-foreground">Dados até <time dateTime={d.updated}>{dateBR}</time></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Retorno acumulado do Ibovespa e do CDI em {listaHorizontes}, com dados até {dateBR}</caption>
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 text-left font-semibold sm:px-4">Período</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold"><Chave cor={BT_COR.ibov} />Ibovespa</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold sm:px-2"><Chave cor={BT_COR.cdi} />CDI</th>
                <th scope="col" className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Rendeu mais</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.years} className="border-t align-top">
                  <th scope="row" className="px-3 py-3 text-left font-semibold sm:px-4">
                    {anos(l.years)}
                    <span className="block text-xs font-normal text-muted-foreground">{mesAno(l.from)} a {mesAno(l.to)}</span>
                  </th>
                  <td className="px-2 py-3 text-right"><Valor frac={l.ibov} aa={l.ibovAA} vence={l.vence === 'ibov'} /></td>
                  <td className="px-3 py-3 text-right sm:px-2"><Valor frac={l.cdi} aa={l.cdiAA} vence={l.vence === 'cdi'} /></td>
                  <td className="hidden px-4 py-3 text-right font-semibold sm:table-cell">{l.vence === 'ibov' ? 'Ibovespa' : l.vence === 'cdi' ? 'CDI' : 'Empate'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t px-4 py-2 text-xs leading-relaxed text-muted-foreground">
          Cada período vai do fim do mês de início ao fim de {mesAno(linhas[0].to)}; a.a. = equivalente ao ano. Ibovespa: {d.ibov.note}. CDI: taxa bruta, acumulada mês a mês. Os dois sem custos nem impostos.
        </p>
      </div>
      <p className="leading-relaxed">{resumoBacktest(linhas, dateBR)}</p>
      {emReais && <p className="leading-relaxed">{emReais}</p>}
      <p className="text-sm leading-relaxed text-muted-foreground">
        Fontes: pontos de fechamento do Ibovespa no último pregão de cada mês (B3) e a taxa mensal do CDI do Banco Central (série 4390 do SGS). Os dados vão até {dateBR}, o último pregão do último mês fechado, e a tabela é refeita a cada mês. Rentabilidade passada não garante resultado futuro.
      </p>
      <div className="flex flex-col gap-3 rounded-xl border border-gold/30 bg-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed">
          <strong className="font-semibold text-foreground">E a sua carteira?</strong> Na plataforma, o Backtest da aba Carteira põe a sua carteira neste mesmo gráfico, com S&amp;P 500 e dólar também, com e sem dividendos.
        </p>
        <ButtonLink href={m.href} cta="tool-backtest-tabela" variant="gold" size="sm" className="h-auto min-h-9 shrink-0 whitespace-normal py-2 text-center">
          Testar a minha carteira <ArrowRight />
        </ButtonLink>
      </div>
    </div>
  );
}
