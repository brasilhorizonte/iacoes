/**
 * Modelo da página /macro/indicador-de-buffett/: números já formatados, textos, FAQ e SEO.
 * Os textos seguem o brief de SEO (interno): número e data na primeira frase, régua
 * brasileira (percentis), nunca verbo de compra/venda e nenhuma lista de ações.
 */
import { APP, SITE } from '../ticker/model';
import { MONTHS, isoToBR, num } from '../ticker/lib/format';
import {
  type BuffettData, type Faixa, type Headline, type Point, type Source, type Stats,
  comparisons, csvRows, faixaOf, headline, monthOf, percentileOf, seriesStats, sourceOf, toCsv,
} from './data';

export const HUB_PATH = '/macro/';
export const PAGE_PATH = '/macro/indicador-de-buffett/';
export const CSV_NAME = 'indicador-buffett-brasil.csv';

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const monthLabel = (isoOrMonth: string): string => `${MES_CURTO[Number(isoOrMonth.slice(5, 7)) - 1]}/${isoOrMonth.slice(0, 4)}`;
const longDate = (iso: string): string => `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
const tri = (mm: number): string => num(mm / 1e6, 2);
const pp = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), 1)} p.p.`;

export interface BuffettModel {
  url: string;
  hubUrl: string;
  csvUrl: string;
  todayISO: string;
  h: Headline;
  v: string;
  vShort: string;
  dateBR: string;
  dateLong: string;
  pibMonth: string;
  mcapTri: string;
  pibTri: string;
  stats: Stats;
  s: { mean: string; median: string; p25: string; p75: string; min: string; max: string; minMonth: string; maxMonth: string; since: string };
  percentile: number;
  faixa: Faixa;
  rel: string;
  prevMonth: { label: string; delta: string; tone: 'up' | 'down' | 'flat' } | null;
  yearAgo: { label: string; delta: string; tone: 'up' | 'down' | 'flat' } | null;
  prevMcap: { label: string; tri: string } | null;
  monthly: Point[];
  decembers: { year: string; value: string; mcap: string; source: Source }[];
  estimatedRanges: { from: string; to: string }[];
  faq: { q: string; a: string }[];
  seo: { title: string; description: string };
  links: { app: string };
  csv: string;
}

const tone = (d: number): 'up' | 'down' | 'flat' => (d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat');

export function buildBuffettModel(d: BuffettData, opts: { today?: Date } = {}): BuffettModel {
  const h = headline(d);
  const stats = seriesStats(d.monthly);
  const percentile = percentileOf(h.value, d.monthly);
  const faixa = faixaOf(h.value, stats);
  const diffMean = h.value - stats.mean;
  const rel = Math.abs(diffMean) < 1 ? 'em linha com a' : diffMean < 0 ? 'abaixo da' : 'acima da';
  const { prevMonth, yearAgo } = comparisons(d.monthly, h.date);
  const prevMcapPoint = [...d.mcapMonthly].reverse().find((p) => monthOf(p.date) < monthOf(h.date)) ?? null;

  const v = num(h.value, 2);
  const vShort = num(h.value, 1);
  const dateBR = isoToBR(h.date);
  const mcapTri = tri(h.mcapMM);
  const pibTri = tri(h.pibMM);
  const s = {
    mean: num(stats.mean, 1),
    median: num(stats.median, 1),
    p25: num(stats.p25, 1),
    p75: num(stats.p75, 1),
    min: num(stats.min.value, 1),
    max: num(stats.max.value, 1),
    minMonth: monthLabel(stats.min.date),
    maxMonth: monthLabel(stats.max.date),
    since: stats.first.slice(0, 4),
  };

  // Faixas cinzas do gráfico: períodos com interpolação. Os dezembros do Banco Mundial
  // (oficiais) ficam DENTRO do período de 2019-2026 — sombrear mês a mês viraria listras.
  const inEstimatedPeriod = (iso: string) => !['BCB SGS 7849', 'B3 (TOTAL GERAL)'].includes(sourceOf(iso).label);
  const estimatedRanges: { from: string; to: string }[] = [];
  d.monthly.forEach((p, i) => {
    if (!inEstimatedPeriod(p.date)) return;
    const last = estimatedRanges[estimatedRanges.length - 1];
    if (last && i > 0 && d.monthly[i - 1].date === last.to) last.to = p.date;
    else estimatedRanges.push({ from: p.date, to: p.date });
  });

  const mcapByMonth = new Map(d.mcapMonthly.map((p) => [monthOf(p.date), p.value]));
  const decembers = d.monthly
    .filter((p) => p.date.slice(5, 7) === '12')
    .map((p) => {
      const mcap = mcapByMonth.get(monthOf(p.date));
      return { year: p.date.slice(0, 4), value: num(p.value, 1), mcap: mcap ? tri(mcap) : '—', source: sourceOf(p.date) };
    });

  const app = `${APP}?ref=iacoes&page=buffett&utm_medium=macro`;
  const faq = [
    {
      q: 'O que é o Indicador de Buffett?',
      a: 'É a razão entre o valor de mercado de todas as empresas listadas na bolsa de um país e o seu PIB. Mede se o mercado como um todo está caro ou barato diante do tamanho da economia.',
    },
    {
      q: 'Qual é o Indicador de Buffett do Brasil hoje?',
      a: `${v}% no fechamento oficial de ${dateBR}: o valor de mercado das empresas listadas na B3 (R$ ${mcapTri} trilhões) sobre o PIB dos últimos 12 meses (R$ ${pibTri} trilhões, até ${monthLabel(h.pibMonth)}).`,
    },
    {
      q: 'A bolsa brasileira está cara?',
      a: `Pelo Indicador de Buffett, a leitura está "${faixa}": ${percentile}% dos meses desde ${s.since} tiveram valor igual ou menor. O indicador olha o mercado inteiro e não é recomendação de investimento.`,
    },
    {
      q: 'Como calcular o Indicador de Buffett?',
      a: 'Valor de mercado de todas as empresas listadas ÷ PIB acumulado em 12 meses × 100. Usamos o valor de mercado total publicado pela B3 e o PIB de 12 meses do Banco Central (SGS 4382).',
    },
    {
      q: 'Qual a média histórica do indicador no Brasil?',
      a: `${s.mean}% desde ${s.since} (mediana de ${s.median}%). A máxima foi ${s.max}% em ${s.maxMonth} e a mínima, ${s.min}% em ${s.minMonth}.`,
    },
    {
      q: 'Por que o Indicador de Buffett do Brasil é tão menor que o dos EUA?',
      a: 'A bolsa brasileira é pequena diante da economia: há poucas empresas listadas, muitas estatais e companhias familiares ficam fora da bolsa e o juro alto pesa no preço das ações. A régua americana (100% ou mais) não vale aqui; por isso comparamos o Brasil com a própria história.',
    },
    {
      q: 'Indicador de Buffett acima de 100% significa bolha?',
      a: `Essa é a régua clássica dos EUA. No Brasil, o recorde da série desde ${s.since} foi ${s.max}% (${s.maxMonth}). O que importa é a posição do indicador frente ao próprio histórico.`,
    },
    {
      q: 'Quanto vale a B3 hoje?',
      a: `As empresas listadas na B3 valiam R$ ${mcapTri} trilhões no fechamento de ${dateBR}, pelo total publicado pela própria bolsa. Não confundir com o valor de mercado da empresa B3 (B3SA3).`,
    },
    {
      q: 'Qual a diferença entre Indicador de Buffett, P/L do Ibovespa e CAPE?',
      a: 'O Indicador de Buffett compara o valor da bolsa com o PIB; o P/L compara o preço com o lucro dos últimos 12 meses; o CAPE usa o lucro médio real de 10 anos. Medem coisas diferentes e se complementam.',
    },
    {
      q: 'Com que frequência o indicador é atualizado?',
      a: 'Todo dia útil, com o último fechamento oficial publicado pela B3 (em geral o pregão anterior). O PIB de 12 meses muda a cada divulgação do Banco Central, e o histórico é mensal.',
    },
    {
      q: 'O Indicador de Buffett serve para escolher ações?',
      a: 'Não. É um termômetro do mercado como um todo. Para ações individuais, veja o preço justo por Graham, Bazin e Gordon na página de cada ação.',
    },
    {
      q: 'De onde vêm os dados?',
      a: 'Valor de mercado: B3 (desde jul/2026), Banco Central SGS 7849 (2000 a 2019) e Banco Mundial/WFE convertido pela PTAX de fim de ano (dezembros de 2019 a 2025). PIB: Banco Central SGS 4382. Os meses estimados entre âncoras anuais estão marcados no CSV.',
    },
  ];

  return {
    url: `${SITE}${PAGE_PATH}`,
    hubUrl: `${SITE}${HUB_PATH}`,
    csvUrl: `${SITE}${PAGE_PATH}${CSV_NAME}`,
    todayISO: (opts.today ?? new Date()).toISOString().slice(0, 10),
    h,
    v,
    vShort,
    dateBR,
    dateLong: longDate(h.date),
    pibMonth: monthLabel(h.pibMonth),
    mcapTri,
    pibTri,
    stats,
    s,
    percentile,
    faixa,
    rel,
    prevMonth: prevMonth ? { label: monthLabel(prevMonth.date), delta: pp(h.value - prevMonth.value), tone: tone(h.value - prevMonth.value) } : null,
    yearAgo: yearAgo ? { label: monthLabel(yearAgo.date), delta: pp(h.value - yearAgo.value), tone: tone(h.value - yearAgo.value) } : null,
    prevMcap: prevMcapPoint ? { label: monthLabel(prevMcapPoint.date), tri: tri(prevMcapPoint.value) } : null,
    monthly: d.monthly,
    decembers,
    estimatedRanges,
    faq,
    seo: {
      title: `Indicador de Buffett Brasil Hoje: ${vShort}% do PIB | IAções`,
      description: `Indicador de Buffett do Brasil hoje: ${vShort}% (valor de mercado da B3 ÷ PIB) em ${dateBR}. Gráfico desde ${s.since}, média histórica e se a bolsa está cara.`,
    },
    links: { app },
    csv: toCsv(csvRows(d)),
  };
}
