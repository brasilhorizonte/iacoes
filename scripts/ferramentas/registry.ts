/**
 * Registro das ferramentas (SPEC §3): ordem dos cards, caminhos, ids de tracking e o hub.
 * Conteúdo de cada ferramenta em scripts/ferramentas/content/<id>.ts.
 */
import { SITE } from '../ticker/model';
import type { HubContent, ToolContent, ToolId } from './types';
import { markowitz } from './content/markowitz';
import { backtest } from './content/backtest';
import { fatos } from './content/fatos';
import { ranking } from './content/ranking';
import { radar } from './content/radar';
import { nota } from './content/nota';
import { tese } from './content/tese';
import { calc } from './content/calc';
import { dcf } from './content/dcf';

/** As 9 ferramentas, na ordem da tabela do SPEC §3 (é a ordem do hub). */
export const TOOLS: readonly ToolContent[] = [markowitz, backtest, fatos, ranking, radar, nota, tese, calc, dcf];

export const HUB_PATH = '/ferramentas/';
export const HUB_URL = `${SITE}${HUB_PATH}`;

export const toolPath = (t: Pick<ToolContent, 'slug'>): string => `${HUB_PATH}${t.slug}/`;
export const toolUrl = (t: Pick<ToolContent, 'slug'>): string => `${SITE}${toolPath(t)}`;

export const toolById = (id: ToolId): ToolContent => {
  const t = TOOLS.find((x) => x.id === id);
  if (!t) throw new Error(`ferramenta desconhecida: ${id}`);
  return t;
};

export const toolByPath = (path: string): ToolContent | undefined => TOOLS.find((t) => toolPath(t) === path);

/** data-cta das páginas de ferramenta: `tool-<id>` (hero) e variações por posição. */
export const ctaId = (t: Pick<ToolContent, 'id'>, pos?: 'final' | 'sticky'): string => `tool-${t.id}${pos ? `-${pos}` : ''}`;

/** JSONs públicos com dado real (landing e widgets leem daqui; formato em DADOS-API / data.ts). */
export const DATA_JSON = {
  ranking: `${HUB_PATH}ranking-de-acoes/dados.json`,
  fatos: `${HUB_PATH}fatos-relevantes/dados.json`,
  /** Ibovespa × CDI reais (SPEC-v2 §B8), produzido por data.ts produceBacktest. */
  backtest: `${HUB_PATH}backtest-de-carteira/dados.json`,
} as const;

/** Páginas do site (fora de /ferramentas/) que o hub e "Outras ferramentas" linkam. */
export const SITE_CARDS = [
  {
    id: 'macro',
    href: '/macro/indicador-de-buffett/',
    title: 'Painel macro',
    text: 'Indicador de Buffett do Brasil, atualizado todo dia útil. Na plataforma, o Painel Macro reúne juros, inflação, câmbio e as expectativas do Focus.',
    /** Só existe com a página macro publicada (trava MACRO_BUFFETT_ENABLED). */
    needsMacro: true,
  },
  {
    id: 'airton',
    href: '/airton/',
    title: 'AIrton',
    text: 'O assistente de IA da plataforma, no app e no WhatsApp: conversa sobre a sua carteira e resume os documentos da CVM.',
    needsMacro: false,
  },
  {
    id: 'acoes',
    href: '/acoes/',
    title: 'Ações da B3',
    text: 'Página de cada ação com preço justo por Graham, Bazin e Gordon, indicadores e proventos, atualizada todo dia útil.',
    needsMacro: false,
  },
] as const;

export const HUB: HubContent = {
  title: 'Ferramentas para Investir em Ações da B3 | IAções',
  description: 'Conheça as ferramentas da IAções para estudar ações da B3: o que cada uma faz, como funciona e onde usar na plataforma.',
  h1: 'Ferramentas para analisar ações da B3',
  intro: [
    'Cada ferramenta tem uma página que explica o método em linguagem simples, mostra um exemplo e leva à tela correspondente na plataforma IAções.',
    'Exemplos marcados como ilustrativos não usam dado de nenhuma empresa. Quando uma página mostra dado real, a data do dado aparece junto.',
  ],
  contentRevised: '2026-10-06',
};
