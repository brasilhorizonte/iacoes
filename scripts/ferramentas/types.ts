/**
 * Tipos das páginas /ferramentas/ (SPEC §3): conteúdo por ferramenta, dados reais do build
 * (ranking e fatos relevantes) e o contrato com o gerador.
 *
 * Regra de ouro (SPEC §1): número só com dado real do build e com a data; exemplo sem dado
 * real leva o selo "Exemplo ilustrativo" e nenhum número atribuído a ticker real.
 */
import type { AppTarget } from './links';

export type ToolId = 'markowitz' | 'backtest' | 'fatos' | 'ranking' | 'radar' | 'nota' | 'tese' | 'calc' | 'dcf';

/**
 * `pronto` vai para o ar (página, hub, sitemap, llms.txt). `rascunho` só existe na prévia
 * (com noindex e faixa de aviso): o cron faz `git add -A`, então conteúdo marcado TODO nunca
 * pode ser escrito na raiz do site.
 */
export type ToolStatus = 'pronto' | 'rascunho';

/**
 * Texto corrido com marcação mínima: `**negrito**` e `[rótulo](/caminho/)`. Link só interno
 * (começa com `/` ou `#`); link para página de ferramenta em rascunho vira texto simples.
 * Respostas do FAQ NÃO usam marcação: o texto visível é o mesmo do JSON-LD.
 */
export type RichText = string;

export type Tone = 'gold' | 'emerald' | 'blue' | 'teal' | 'purple' | 'red' | 'neutral';

export type Block =
  | { type: 'p'; text: RichText }
  | { type: 'h3'; text: string }
  | { type: 'list'; items: RichText[]; ordered?: boolean }
  | { type: 'table'; caption?: string; head: string[]; rows: RichText[][] }
  | { type: 'cards'; items: { title: string; text: RichText; tone?: Tone }[] }
  | { type: 'formula'; text: string }
  | { type: 'note'; text: RichText; tone?: 'info' | 'warn' }
  /** Tabela com dado real do ranking (dados.json do build), com links para /TICKER/. */
  | { type: 'ranking-table'; indicator: RankingKey; limit?: number }
  /** Lista dos documentos mais recentes da CVM (dados.json do build). */
  | { type: 'fatos-list'; limit?: number }
  /** Marcador de conteúdo a escrever. Só pode existir em ferramenta `rascunho` (teste garante). */
  | { type: 'todo'; text: string };

export interface ToolSection {
  /** id estável do H2 (âncora). */
  id: string;
  title: string;
  blocks: Block[];
}

export interface Faq {
  q: string;
  /** Texto puro (sem marcação): é idêntico no <details> e no FAQPage. */
  a: string;
}

export interface WidgetSpec {
  /** scripts/ferramentas/widgets/<id>.js (registrado com IAFerr.register(id, ...)). */
  id: string;
  /** true = sem dado real: selo "Exemplo ilustrativo" visível. */
  illustrative: boolean;
  /** Rótulo acessível do contêiner do widget. */
  label: string;
  /** Legenda abaixo do widget (aceita os tokens de dado, ex.: {data}). */
  caption?: string;
  /** O que aparece sem JavaScript (e antes de o bundle carregar). */
  fallback?: { kind: 'chips'; items: string[] } | { kind: 'text'; text: string };
}

/** De onde vem o dado da página. Evergreen = conteúdo sem dado do dia. */
export type DataKind = 'evergreen' | 'ranking' | 'fatos' | 'valuations';

export interface ToolContent {
  id: ToolId;
  slug: string;
  status: ToolStatus;
  /** Nome público (cards, breadcrumb, JSON-LD). */
  name: string;
  /** Palavra-chave principal: tem de aparecer no texto da seção "O que é". */
  keyword: string;
  /** ≤ 60 caracteres, termina em " | IAções" (tokens já expandidos). */
  title: string;
  /** ≤ 155 caracteres (tokens já expandidos). */
  description: string;
  h1: string;
  /** Frase-resposta direta (AEO), logo abaixo do H1; vai no speakable. */
  answer: string;
  /** Uma linha: cards do hub, "Outras ferramentas" e llms.txt. */
  blurb: string;
  cta: {
    label: string;
    /** Tela do app (deep link do SPEC §2). */
    target: AppTarget;
    /** Nome da tela no app, como aparece para o usuário. */
    screen: string;
    /** Nota curta e honesta de acesso, sem números de limite de plano (RichText). */
    note: RichText;
  };
  finalCta: { title: string; text: string; label: string };
  widget: WidgetSpec;
  dataSource: DataKind;
  sections: ToolSection[];
  faq: Faq[];
  /** Fontes e metodologia (rodapé). */
  sources: string;
  /** Data da última revisão do conteúdo (AAAA-MM-DD): lastmod e dateModified das evergreen. */
  contentRevised: string;
}

/** Entrada do sitemap (mesmo contrato do `extra` de generateSitemap em scripts/template.ts). */
export interface SitemapEntry {
  /** URL absoluta com barra final. */
  loc: string;
  /** AAAA-MM-DD real: data do dado ou da revisão do conteúdo (nunca "hoje" por padrão). */
  lastmod: string;
  changefreq: string;
  priority: string;
}

export interface HubContent {
  title: string;
  description: string;
  h1: string;
  intro: string[];
  contentRevised: string;
}

// ─── Dados reais: ranking ─────────────────────────────────────────────────

export type RankingKey = 'dy' | 'pl' | 'pvp' | 'roe';

/** Linha de brapi_quotes já normalizada (leitura anon, só as colunas usadas). */
export interface QuoteRow {
  symbol: string;
  price: number | null;
  marketCap: number | null;
  pl: number | null;
  pvp: number | null;
  /** Como está no banco: em porcentagem (27,73 = 27,73%). */
  roePct: number | null;
  sector: string;
  /** regular_market_time (timestamptz em texto). */
  time: string | null;
  /** Quantidade negociada (não é R$): só para escolher a classe mais negociada. */
  volume: number | null;
  shortName: string;
  longName: string;
  archived: boolean;
}

/** Proventos de 12 meses por ação, como o gerador calcula (ajustados por desdobramento). */
export type DividendsByTicker = Record<string, { divTTM: number }>;

export interface RankingRow {
  /** Ticker (a página é /{t}/). */
  t: string;
  name: string;
  sector: string;
  price: number;
  /** Dividend yield de 12 meses em fração (0,0677 = 6,77%); null sem proventos calculados. */
  dy: number | null;
  pl: number | null;
  pvp: number | null;
  /** ROE em fração (0,2773 = 27,73%). */
  roe: number | null;
  /** Valor de mercado em R$. */
  mcap: number;
}

export interface RankingData {
  /** Data da cotação (maior regular_market_time, em BRT). */
  date: string;
  dateBR: string;
  /** Corte de valor de mercado (R$) para tirar micro caps. */
  minMarketCap: number;
  count: number;
  rows: RankingRow[];
  /** Ordem de cada aba (tickers), já com os cortes de sanidade aplicados. */
  top: Record<RankingKey, string[]>;
  /** Cortes usados (a página explica). */
  limits: { dyMax: number; roeMax: number; plMin: number; topN: number };
}

// ─── Dados reais: fatos relevantes ────────────────────────────────────────

export type FatoType = 'FR' | 'CM' | 'PR';

/** Linha de cvm_documents (leitura anon). */
export interface CvmRow {
  ticker: string | null;
  doc_type: string | null;
  date: string | null;
  published_date: string | null;
  summary: string | null;
  ai_summary: string | null;
  link: string | null;
  source_created_at: string | null;
  company_name: string | null;
}

export interface FatoItem {
  t: string;
  name: string;
  type: FatoType;
  typeLabel: string;
  title: string;
  /** Data de publicação (AAAA-MM-DD). */
  date: string;
  /** Hora (BRT) em que o documento entrou no feed — pode ser posterior à publicação na CVM. */
  time: string | null;
  /** Resumo curto (gerado por IA; pode errar). */
  summary: string;
  /** Link interno: /airton/{T}/ quando existe, senão /{T}/. */
  url: string;
}

export interface FatosData {
  /** Data do documento mais recente. */
  updated: string;
  updatedBR: string;
  count: number;
  items: FatoItem[];
}
