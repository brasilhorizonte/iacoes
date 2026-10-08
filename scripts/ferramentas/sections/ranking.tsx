/**
 * Seção SSR do ranking de ações (content/ranking.ts): as quatro abas — DY 12m, P/L, P/VP e ROE —
 * com as 20 primeiras de cada indicador, a mediana do setor ao lado de cada ação e, na aba DY, o
 * DY médio de 5 anos. Dado real do build (m.env.ranking = dados.json do dia), com a data.
 *
 * Abas só com CSS (rádio + peer-checked nomeado): os quatro painéis ficam no DOM (buscadores leem
 * todos), funcionam sem JS e com teclado (setas trocam o rádio; o foco aparece no rótulo). Os
 * painéis precisam ser irmãos dos rádios: nada de invólucro em volta deles.
 * Nome de empresa e setor vêm da base de mercado: data-fonte="b3" (fora das checagens de texto
 * autoral). Ticker, rótulos, números e datas são nossos.
 *
 * Honestidade (SPEC §1, SPEC-v2 §C Ranking): ordenação por indicador objetivo, não recomendação;
 * nenhum rótulo de valor nas linhas; provento atípico explicado e listado sem número (o DY de 12
 * meses dele está inflado por definição). Sem a média de 5 anos ou sem a mediana do setor no
 * dados.json (formato antigo), a coluna e o texto que fala dela somem.
 *
 * ItemList (SPEC-v2 §D): vem do model.ts (itemListFor), pelas props do bloco no conteúdo
 * (`itemList` = abas, `itemLimit` = linhas por aba). Esta seção só desenha: sem estado nem efeito.
 */
import * as React from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { brl, mult, num, pct } from '../../ticker/lib/format';
import { rankingRows } from '../model';
import type { RankingDataX, RankingLimits, RankingRowX, SectorMedian } from '../data';
import type { RankingKey } from '../types';
import type { SsrProps } from './index';

/** Cortes que a página explica, se o dados.json vier sem `limits` completos (formato antigo). */
const LIMITS: RankingLimits = {
  dyMax: 0.25, dyVs5yMax: 2, plMin: 0.1, plMax: 100, pvpMin: 0.2, pvpMax: 20, roeMin: -0.5, roeMax: 1, topN: 20, statementMaxAgeDays: 200,
};

interface Tab {
  k: RankingKey;
  label: string;
  title: string;
  head: string;
  /** Classes literais (o Tailwind só gera o que lê no fonte): peer nomeado por aba. */
  input: string;
  tab: string;
  panel: string;
}

const TABS: Tab[] = [
  {
    k: 'dy', label: 'DY 12m', title: 'Maior dividend yield de 12 meses', head: 'DY 12m',
    input: 'peer/dy sr-only',
    tab: 'peer-checked/dy:border-primary peer-checked/dy:bg-primary peer-checked/dy:text-primary-foreground peer-focus-visible/dy:ring-2 peer-focus-visible/dy:ring-ring/40 peer-focus-visible/dy:ring-offset-2',
    panel: 'peer-checked/dy:block',
  },
  {
    k: 'pl', label: 'P/L', title: 'Menor P/L', head: 'P/L',
    input: 'peer/pl sr-only',
    tab: 'peer-checked/pl:border-primary peer-checked/pl:bg-primary peer-checked/pl:text-primary-foreground peer-focus-visible/pl:ring-2 peer-focus-visible/pl:ring-ring/40 peer-focus-visible/pl:ring-offset-2',
    panel: 'peer-checked/pl:block',
  },
  {
    k: 'pvp', label: 'P/VP', title: 'Menor P/VP', head: 'P/VP',
    input: 'peer/pvp sr-only',
    tab: 'peer-checked/pvp:border-primary peer-checked/pvp:bg-primary peer-checked/pvp:text-primary-foreground peer-focus-visible/pvp:ring-2 peer-focus-visible/pvp:ring-ring/40 peer-focus-visible/pvp:ring-offset-2',
    panel: 'peer-checked/pvp:block',
  },
  {
    k: 'roe', label: 'ROE', title: 'Maior ROE', head: 'ROE',
    input: 'peer/roe sr-only',
    tab: 'peer-checked/roe:border-primary peer-checked/roe:bg-primary peer-checked/roe:text-primary-foreground peer-focus-visible/roe:ring-2 peer-focus-visible/roe:ring-ring/40 peer-focus-visible/roe:ring-offset-2',
    panel: 'peer-checked/roe:block',
  },
];

/** Sem transição de cor (SPEC-v2 §E5: só transform e opacity animam). */
const TAB_BASE = 'inline-flex h-9 cursor-pointer select-none items-center rounded-full border bg-card px-4 text-sm font-semibold text-muted-foreground hover:border-primary/50';
const LINK = 'font-mono font-semibold text-foreground hover:text-gold-strong hover:underline';

const fmtValue = (k: RankingKey, v: number | null | undefined): string => (k === 'dy' || k === 'roe' ? pct(v, 1) : mult(v, 2));

/** "25%" / "100%" / "0,1" / "20" — cortes no texto, a partir do próprio dados.json. */
const fmtPct0 = (f: number): string => pct(f, 0);
const fmtNum = (n: number): string => num(n, Number.isInteger(n) ? 0 : 1);

function rule(k: RankingKey, L: RankingLimits, has5y: boolean, hasMedian: boolean): string {
  const days = `com balanço de até ${L.statementMaxAgeDays} dias`;
  const vs = L.dyVs5yMax === 2 ? 'do dobro do DY médio de 5 anos' : `de ${fmtNum(L.dyVs5yMax)} vezes o DY médio de 5 anos`;
  const median = (s: string) => (hasMedian ? ` Mediana do setor: ${s}` : '');
  switch (k) {
    case 'dy':
      return 'Proventos (dividendos e JCP) com data-com nos últimos 12 meses ÷ cotação.'
        + (has5y ? ' A média de 5 anos é a média anual dos proventos dos últimos 5 anos ÷ a cotação de hoje.' : '')
        + ` Fora desta aba: provento atípico (DY de 12 meses acima de ${fmtPct0(L.dyMax)}${has5y ? ` ou ${vs}` : ''})${has5y ? ' e ação sem a média de 5 anos' : ''}.`
        + median('todas as empresas do setor no ranking, inclusive as que não pagaram, sem os proventos atípicos.');
    case 'pl':
      return `Cotação ÷ lucro por ação dos últimos 12 meses. Entram P/L a partir de ${fmtNum(L.plMin)} e abaixo de ${fmtNum(L.plMax)} (empresa com prejuízo fica fora), ${days} e P/L coerente com cotação ÷ LPA.`
        + median('só empresas com P/L dentro dessa faixa.');
    case 'pvp':
      return `Cotação ÷ valor patrimonial por ação. Entram P/VP de ${fmtNum(L.pvpMin)} a ${fmtNum(L.pvpMax)}, ${days} e P/VP coerente com cotação ÷ VPA.`
        + median('só P/VP dentro dessa faixa.');
    case 'roe':
      return `Lucro líquido dos últimos 12 meses ÷ patrimônio líquido. Entram ROE acima de zero e até ${fmtPct0(L.roeMax)}, ${days}.`
        + median(`ROE de ${fmtPct0(L.roeMin).replace('-', '−')} a ${fmtPct0(L.roeMax)}, inclusive empresas com prejuízo.`);
  }
}

/** Ações que estariam entre as primeiras da aba DY e ficaram fora por provento atípico (sem número). */
function atypicalOut(d: RankingDataX, top: RankingRowX[]): RankingRowX[] {
  const floor = top.length ? (top[top.length - 1].dy ?? 0) : 0;
  const rows = (d.rows ?? []) as RankingRowX[];
  return rows
    .filter((r) => r.dyAtypical === true && (r.dy === null || r.dy >= floor))
    .sort((a, b) => (b.dy ?? Infinity) - (a.dy ?? Infinity) || b.mcap - a.mcap)
    .slice(0, 12);
}

function Panel({ d, tab, L, has5y, medians }: { d: RankingDataX; tab: Tab; L: RankingLimits; has5y: boolean; medians: Record<string, SectorMedian> | null }) {
  const k = tab.k;
  const rows = rankingRows(d, k) as RankingRowX[];
  const five = k === 'dy' && has5y;
  const medianOf = (r: RankingRowX): number | null => {
    const sm = medians?.[r.sector];
    return sm ? sm[k] : null;
  };
  const out = k === 'dy' ? atypicalOut(d, rows) : [];
  const extras = [five ? 'o DY médio de 5 anos' : '', medians ? 'a mediana do setor' : ''].filter(Boolean).join(' e ');
  return (
    <div id={`ranking-painel-${k}`} className={`hidden w-full pt-2 ${tab.panel}`}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
          <h3 className="text-base font-semibold">{tab.title}</h3>
          <span className="text-xs text-muted-foreground">Dados de <time dateTime={d.date}>{d.dateBR}</time></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {tab.title}: as {rows.length} primeiras empresas{extras ? `, com ${extras}` : ''}. Dados de {d.dateBR}.
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-2 py-2 font-semibold sm:px-4">#</th>
                <th scope="col" className="px-1.5 py-2 font-semibold sm:px-2">Ação</th>
                <th scope="col" className="hidden px-2 py-2 font-semibold md:table-cell">Setor</th>
                <th scope="col" className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Cotação</th>
                <th scope="col" className="px-1.5 py-2 text-right font-semibold sm:px-2">{tab.head}</th>
                {five && <th scope="col" className="px-1.5 py-2 text-right font-semibold sm:px-2">Média de 5 anos</th>}
                {medians && <th scope="col" className="px-2 py-2 text-right font-semibold sm:px-4">Mediana do setor</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.t} className="border-t">
                  <td className="px-2 py-2 font-mono text-muted-foreground tnum sm:px-4">{i + 1}</td>
                  <th scope="row" className="px-1.5 py-2 text-left font-normal sm:px-2">
                    <a href={`/${r.t}/`} data-track={`tool-ranking-${k}`} className={LINK}>{r.t}</a>
                    <span className="hidden max-w-[16rem] truncate text-xs text-muted-foreground sm:block" data-fonte="b3">{r.name}</span>
                  </th>
                  <td className="hidden px-2 py-2 text-xs text-muted-foreground md:table-cell" data-fonte="b3">{r.sector}</td>
                  <td className="hidden px-2 py-2 text-right font-mono tnum sm:table-cell">{brl(r.price)}</td>
                  <td className="px-1.5 py-2 text-right font-mono font-semibold tnum sm:px-2">{fmtValue(k, r[k])}</td>
                  {five && <td className="px-1.5 py-2 text-right font-mono tnum sm:px-2">{pct(r.dy5y, 1)}</td>}
                  {medians && <td className="px-2 py-2 text-right font-mono text-muted-foreground tnum sm:px-4">{fmtValue(k, medianOf(r))}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <p>{rule(k, L, has5y, !!medians)}</p>
          {out.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">Fora desta aba por provento atípico</span> (estariam entre as {rows.length} primeiras):{' '}
              {out.map((r, i) => (
                <React.Fragment key={r.t}>
                  {i > 0 && ', '}
                  <a href={`/${r.t}/`} data-track="tool-ranking-atipico" className={LINK}>{r.t}</a>
                </React.Fragment>
              ))}
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RankingSecao({ m }: SsrProps) {
  const d = m.env.ranking as RankingDataX | null;
  if (!d || !d.rows.length) return null;
  const L: RankingLimits = { ...LIMITS, ...(d.limits ?? {}) };
  const has5y = d.rows.some((r) => typeof (r as RankingRowX).dy5y === 'number');
  const medians = d.sectorMedian && Object.keys(d.sectorMedian).length ? d.sectorMedian : null;
  const minBi = d.minMarketCap / 1e9;
  return (
    <div className="space-y-4" data-ssr="ranking">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {d.count} empresas no universo, com valor de mercado a partir de {brl(minBi, Number.isInteger(minBi) ? 0 : 1)} {minBi < 2 ? 'bilhão' : 'bilhões'} e uma ação por empresa (a mais negociada). Dados do pregão de <time dateTime={d.date}>{d.dateBR}</time>.
      </p>
      <p className="flex gap-3 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed">
        <Info className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Ordenação por indicador objetivo, não é recomendação de investimento.</strong>{' '}
          Um indicador sozinho não diz se o preço está justo: abra a página da ação para ver o preço justo por Graham, Bazin e Gordon, os proventos ano a ano e as demonstrações financeiras.
        </span>
      </p>
      <div className="relative flex flex-wrap items-center gap-2">
        {TABS.map((t, i) => (
          <input key={t.k} type="radio" name="ranking-aba" id={`ranking-aba-${t.k}`} className={t.input} defaultChecked={i === 0} aria-controls={`ranking-painel-${t.k}`} />
        ))}
        {TABS.map((t) => (
          <label key={t.k} htmlFor={`ranking-aba-${t.k}`} className={`${TAB_BASE} ${t.tab}`}>
            <span className="sr-only">Ranking por </span>{t.label}
          </label>
        ))}
        {TABS.map((t) => <Panel key={t.k} d={d} tab={t} L={L} has5y={has5y} medians={medians} />)}
      </div>
      <p>
        <a href={m.href} data-cta="tool-ranking-tabela" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-strong underline-offset-2 hover:underline">
          Combinar critérios na tela Rankings da plataforma <ArrowRight className="size-4" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
