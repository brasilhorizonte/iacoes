/**
 * Ranking de ações — ESQUELETO (status 'rascunho') com DADO REAL: tabelas e dados.json já saem
 * do build (scripts/ferramentas/data.ts: valor de mercado ≥ R$ 1 bi, uma classe por empresa, DY
 * de 12 meses com os proventos do gerador). O próximo lote escreve o texto. Honestidade:
 * ordenação por indicador objetivo, não recomendação; sem filtro de liquidez/margem no app (não
 * prometer); o free no app é parcial; mostrar a data do dado; nunca rotular "baratas" nem
 * "oportunidades". Tokens: {data} = data da cotação (dd/mm/aaaa), {n} = ações no ranking.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const ranking: ToolContent = {
  id: 'ranking',
  slug: 'ranking-de-acoes',
  status: 'rascunho',
  name: 'Rankings de ações',
  keyword: 'ranking de ações',
  title: 'Ranking de Ações B3: Dividendos, P/L, P/VP e ROE | IAções',
  description: 'Ranking de ações da B3 por dividend yield de 12 meses, P/L, P/VP e ROE, com dados de {data}. Ordenação por indicador, para estudo, não recomendação.',
  h1: 'Ranking de ações da B3 por dividendos, P/L, P/VP e ROE',
  answer: 'Ranking de {n} ações da B3 com valor de mercado acima de R$ 1 bilhão, ordenadas por dividend yield de 12 meses, P/L, P/VP e ROE, com dados de {data}. É uma ordenação por indicador, não recomendação.',
  blurb: 'Ações da B3 ordenadas por dividend yield, P/L, P/VP e ROE, com os dados do último pregão.',
  cta: {
    label: 'Abrir os Rankings',
    target: SCREENS.rankings,
    screen: 'Rankings',
    note: 'Comece com uma conta grátis e [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Filtre e ordene na plataforma',
    text: 'Na aba Rankings você combina filtros, ordena pelas colunas e compara ações lado a lado.',
    label: 'Abrir os Rankings',
  },
  widget: {
    id: 'ranking',
    illustrative: false,
    label: 'Ranking de ações por dividend yield, P/L, P/VP e ROE com dados reais',
    caption: 'Dados de {data}. Ordenação por indicador; não é recomendação.',
  },
  dataSource: 'ranking',
  sections: [
    {
      id: 'ranking',
      title: 'Ranking de hoje',
      blocks: [
        { type: 'ranking-table', indicator: 'dy', limit: 10 },
        { type: 'ranking-table', indicator: 'pl', limit: 10 },
        { type: 'ranking-table', indicator: 'pvp', limit: 10 },
        { type: 'ranking-table', indicator: 'roe', limit: 10 },
      ],
    },
    { id: 'o-que-e', title: 'O que é um ranking de ações', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição com a palavra-chave ranking de ações; o que cada indicador mede e seus limites.' }] },
    { id: 'na-plataforma', title: 'Os Rankings na plataforma', blocks: [{ type: 'todo', text: 'TODO: aba Rankings (colunas, filtros, screeners By Gestor), sem prometer filtro de liquidez.' }] },
  ],
  faq: [
    {
      q: 'O ranking é recomendação de investimento?',
      a: 'Não. É uma ordenação por indicador objetivo, para estudo. Um indicador isolado não diz se o preço está justo.',
    },
  ],
  sources: 'Cotações e indicadores: base da plataforma (dados de mercado via brapi). Dividend yield: proventos com data-com nos últimos 12 meses, ajustados por desdobramento, ÷ cotação.',
  contentRevised: '2026-10-06',
};
