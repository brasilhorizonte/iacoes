# iAcoes — Documentacao do Projeto

## Visao Geral

**iAcoes** e o site de paginas estaticas de SEO da **Brasil Horizonte**, voltado para analise fundamentalista e valuation de acoes da B3 (bolsa brasileira). O objetivo e gerar paginas publicas otimizadas para busca (Google) que mostram o preco justo de cada acao, calculado por 5 metodologias de valuation, atraindo trafego organico e convertendo para a plataforma paga em `app.brasilhorizonte.com.br`.

O diferencial vendido nas paginas publicas e o **AIrton** (assistente de IA da plataforma) e os **alertas de CVM no WhatsApp**. Ver as secoes [AIrton](#airton--assistente-de-ia) e [Alertas e canal](#alertas-e-canal-whatsapp-first).

- **Organizacao GitHub:** `brasilhorizonte`
- **Repositorio:** `brasilhorizonte/iacoes`
- **GitHub Pages:** `https://brasilhorizonte.github.io/iacoes/`
- **Dominio:** `https://iacoes.com.br`
- **Plataforma principal:** `https://app.brasilhorizonte.com.br`

## Arquitetura

O projeto e 100% estatico (HTML puro, sem framework JS). As paginas sao **geradas em build time** por um script TypeScript que:

1. Puxa dados financeiros do **Supabase** (tabelas: `brapi_quotes`, `brapi_income_statements`, `brapi_balance_sheets`, `brapi_cashflows`, `brapi_dividends`) e os documentos da CVM (`cvm_documents`)
2. Calcula valuation por 5 metodologias
3. Renderiza HTML estatico com CSS inline
4. Salva como `/{TICKER}/index.html`
5. Gera as paginas de setor, `sitemap.xml` e `robots.txt`

O deploy e feito via **GitHub Pages** (branch `main`, path `/`).

## Estrutura de Arquivos

```
iacoes/
├── index.html              # Landing page institucional (escrita manualmente)
├── airton/index.html        # Pagina do AIrton (escrita manualmente)
├── airton/PETR4/index.html  # Pagina de alerta por ticker (gerada; so tickers com docs na CVM)
├── PETR4/index.html         # Pagina de ticker (gerada automaticamente)
├── VALE3/index.html         # Pagina de ticker (gerada automaticamente)
├── WEGE3/index.html         # Pagina de ticker (gerada automaticamente)
├── acoes/index.html         # Pagina indice com todos os tickers (gerada automaticamente)
├── acoes/{setor}/index.html # 23 paginas de setor (geradas automaticamente)
├── 404.html                 # Redirect case-insensitive para tickers
├── assets/
│   └── img/
│       ├── dashboard-iacoes.png
│       └── institucional_branco_amarelo_3x.png
├── scripts/                 # Geradores de paginas estaticas (TypeScript)
│   ├── generate-pages.ts        # Orquestrador principal (tickers, indice, setores, sitemap)
│   ├── template.ts              # Indice /acoes/, paginas de setor, sitemap/robots
│   ├── ticker/                  # Paginas de ticker: React + shadcn/ui + Tailwind v4 -> HTML estatico
│   │   ├── render.tsx           #   head/SEO/JSON-LD, CSS inline, injecao do onclick
│   │   ├── model.ts             #   view model (dividendos, demonstracoes, FAQ, pares)
│   │   ├── page.tsx, components/ #   secoes + components/ui (shadcn)
│   │   ├── client.js            #   calculadoras, abas, busca, cotacao ao vivo, scroll
│   │   ├── head-tracking.html   #   GA4 + Pixel + _iaTrack/_iaClick (literal)
│   │   └── preview.ts           #   gera so os tickers pedidos
│   ├── airton-template.ts       # Template de /airton/{TICKER}/ (simulacao do alerta)
│   ├── validate-html.ts         # Validacao pos-geracao (8 regras, roda via postgenerate)
│   ├── valuation.ts         # Calculos de valuation (DCF, Graham, Gordon, EVA, Multiplos)
│   ├── supabase.ts          # Client Supabase + fetch + mappers de dados
│   ├── types.ts             # Interfaces TypeScript (FinancialData, CvmDocument, etc.)
│   └── constants.ts         # Constantes (taxas, pesos, cenarios)
├── _bmad/                   # BMAD framework (agentes, workflows, skills)
├── _bmad-output/            # Outputs de sessoes BMAD (brainstorming, handoffs, runbooks)
├── valuations.json          # Dados de valuation para o widget da landing page (gerado automaticamente)
├── robots.txt               # Gerado automaticamente
├── sitemap.xml              # Gerado automaticamente
├── tickers.json             # Lista de tickers gerada (usado pela busca)
├── CNAME                    # Dominio iacoes.com.br
├── .nojekyll                # Desabilita processamento Jekyll no GitHub Pages
├── .github/
│   └── workflows/
│       └── generate-pages.yml  # Cron diario (seg-sex 20h BRT) para regenerar paginas
├── vercel.json              # Config Vercel — INERTE, ver nota abaixo
├── package.json             # Scripts npm e dependencias
├── .env                     # Credenciais Supabase (NAO commitado)
└── .gitignore
```

**Nota sobre `vercel.json`:** o arquivo existe no repo mas **nunca foi aplicado** — producao
responde `server: GitHub.com`, o site e GitHub Pages puro. Consequencia pratica: os headers de
seguranca declarados nele (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) **nao
estao ativos em lugar nenhum**. Uma migracao para Vercel chegou a ser preparada em ago/2026
(`vercel.ts`, `middleware.ts`) e foi **cancelada**; o passo a passo ficou arquivado em
`_bmad-output/RUNBOOK-vercel-cutover.md` caso seja retomada.

## Comandos

```bash
npm run generate              # Gera paginas para TODOS os tickers ativos no Supabase
npm run generate:test         # Gera apenas VALE3, PETR4, WEGE3
npx tsx scripts/generate-pages.ts ITUB4 BBAS3   # Gera tickers especificos
npm test                      # validate-html.ts (8 regras)
npm run dev                   # Serve localmente com npx serve
```

**Nota:** `npm run generate` executa automaticamente `npm test` via hook `postgenerate`. Se a validacao falhar, o build para (nao commita HTML quebrado no CI). `npm test` roda um script so: `validate-html.ts` (8 regras).

## Fonte de Dados (Supabase)

Todas as tabelas vivem em um projeto Supabase. As credenciais ficam no `.env`:

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

### Tabelas consultadas

| Tabela | Conteudo | Colunas-chave |
|---|---|---|
| `brapi_quotes` | Cotacao atual, indicadores fundamentalistas, setor | `symbol`, `price`, `market_cap`, `pl`, `pvp`, `lpa`, `vpa`, `roe`, `roic`, etc. |
| `brapi_income_statements` | DRE historico (10 anos) | `symbol`, `end_date`, `total_revenue`, `ebit`, `net_income`, `gross_profit` |
| `brapi_balance_sheets` | Balanco patrimonial historico | `symbol`, `end_date`, `total_assets`, `total_liab`, `cash`, `long_term_debt`, `total_stockholder_equity` |
| `brapi_cashflows` | Fluxo de caixa historico | `symbol`, `end_date`, `total_cash_from_operating_activities`, `capital_expenditures`, `depreciation` |
| `brapi_dividends` | Historico de dividendos | `ticker`/`symbol`, `amount`, `ex_date` |

O script tenta consultar tanto por coluna `symbol` quanto `ticker`, e testa variantes do ticker (ex: `VALE3`, `vale3`, `VALE3.SA`).

### Documentos da CVM (`public.cvm_documents`)

| Tabela | Conteudo | Colunas-chave |
|---|---|---|
| `cvm_documents` | Documentos publicados pelas companhias na CVM | `ticker`, `doc_type`, `date`, `summary`, `ai_summary`, `link`, `company_name` |

Lida por `fetchCvmDocuments(ticker, limit = 4)` em `scripts/supabase.ts`, que alimenta o bloco
"O que {TICKER} publicou na CVM" no topo das paginas de ticker.

Regras de leitura implementadas (nao mudar sem entender o porque):

- **Data futura e filtrada.** O feed tem linhas com `date` no futuro (ate 2026-12-31). A query usa
  `.lte('date', hoje)` + `.not('date','is',null)`. Nenhum documento futuro chega ao HTML.
- **Deduplicacao por `link`.** O feed repete o mesmo `link` com titulos diferentes; a funcao puxa
  ~40 linhas e deduplica.
- **Fallback por raiz de 4 letras.** `cvm_documents` guarda **um ticker por emissor** (PETR4, nao
  PETR3; BBDC4, nao BBDC3). Se o ticker exato nao tem linhas, cai para `.like('ticker','PETR%')`.
  Documento da CVM e da companhia, nao da classe de acao — nao e dado inventado. O fallback levou a
  cobertura de ~255 para **297 das 322 paginas geradas**.
- **`doc_type` traduzido** por `CVM_DOC_LABELS`, com os 7 valores que existem de fato na tabela:
  `FR` (Fato Relevante), `CM` (Comunicado ao Mercado), `ITR` (Informacoes Trimestrais),
  `DFP` (Demonstracoes Financeiras Padronizadas), `FRE` (Formulario de Referencia),
  `VLMO` (Negociacao de Valores Mobiliarios), `PR` (Divulgacao de Resultados).
  **Sigla fora do mapa descarta o documento** — sigla crua nunca chega ao HTML.
- **Titulo** extraido de `summary` (formato `"<Tipo> - <titulo> - Date YYYY-MM-DD"`); **resumo** vem
  de `ai_summary` limpo de markdown. Documento sem titulo **e** sem resumo e descartado.
- **Tolerante a falha:** erro de query/rede vira `console.warn` + `[]`, e a pagina e gerada sem o
  bloco (cai no fallback do card de auditoria do AIrton).
- **Plumbing:** `fetchFinancials` busca os documentos em paralelo com as outras tabelas e guarda num
  `Map` de modulo; `template.ts` le via `getCvmDocuments(ticker)`, sincrono. Evita ciclo de import.

### Tabela de analytics

| Tabela | Conteudo | Colunas-chave |
|---|---|---|
| `iacoes_page_views` | Pageviews e cliques de CTA | `session_id`, `page_path`, `event_type` (`pageview` ou `cta_click`), `cta_id`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `device_type`, `screen_width`, `browser`, `os`, `source_hint`, `click_id_source`, `is_bot`, `interacted`, `variant`, `created_at` |

#### Colunas de qualidade de trafego (ago/2026)

| Coluna | Tipo | Semantica |
|---|---|---|
| `is_bot` | `boolean not null default false` | Sinais **duros** de automacao apenas: `navigator.webdriver === true`, UA casando `/bot\|crawl\|spider\|headless\|preview\|lighthouse\|gptbot\|claudebot\|perplexity\|bingpreview/i`, ou `navigator.languages` vazio/ausente. Avaliado uma vez no load. |
| `interacted` | `boolean not null default false` | Houve input humano (`pointerdown`/`keydown`/`touchstart`/`wheel`) **antes** deste evento. O valor gravado e o estado do flag no instante do evento — o `pageview` inicial quase sempre sai `false`; isso e esperado. |
| `variant` | `text default null` | Criada para um teste A/B da landing que foi **cancelado**. **Sem uso hoje** — nada escreve nela. Aditiva e nullable, nao atrapalha. Nao remover sem decisao explicita. |

**Nunca enviar `null`** em `is_bot`/`interacted` — as colunas sao `not null` e o INSERT quebra.
Omitir e seguro (cai no default `false`), mas mata a metrica.

Nao existe heuristica por `screen_width`: 412px e largura legitima de Pixel/Android e flaga-la
mataria usuarios reais. O discriminador e `interacted` — bot dispara `scroll_100` sem nunca gerar input.

#### View `public.iacoes_human_sessions`

View com `security_invoker = true`, **uma linha por `session_id`**. Colunas: `session_id`,
`first_seen`, `last_seen`, `page_path` (primeira pagina vista), `pageviews`, `cta_clicks`,
`is_bot`, `interacted`, `clicked`, `has_referrer`, `is_human`, `variant`.

Definicao de sessao humana:

```
is_human = (not bool_or(is_bot))
           and (bool_or(interacted) or bool_or(event_type = 'cta_click'))
```

**Use esta view para qualquer analise nova.** Existem duas views antigas —
`iacoes_page_views_human` e `iacoes_sessions_enriched` — que calculam `is_bot` com a heuristica
`screen_width = 412 AND device_type='mobile' AND os='Android'`, **considerada incorreta** (falso
positivo em Android legitimo). Foram deixadas intactas por seguranca, mas nao devem alimentar
analise nova; vale depreciar as duas num passo futuro, com decisao explicita.

**Baseline medido em 31/ago/2026** (90 dias, por sessao, `page_path` != `/`, `/ACOES`, `/AIRTON`):
CTR de ticker **com** referrer = 8,02% (135/1.683); **sem** referrer = 0,71% (28/3.961).
Gap de ~11x entre os dois grupos.

- RLS habilitado com policy "Allow anon insert" para o role `anon`
- O tracking usa fetch com `keepalive:true` para sobreviver a navegacao
- Cliques de CTA usam `_iaClick(event)` que faz `preventDefault()` + tracking + redirect com 150ms de delay, garantindo que o fetch e disparado antes da navegacao
- `_iaClick` le o atributo `data-cta` do elemento clicado e grava como `cta_id` no Supabase
- `source_hint` detecta in-app browsers (Facebook, Instagram, WhatsApp, etc.) via User-Agent
- `click_id_source` detecta plataformas de ads (fbclid, gclid, ttclid, etc.) via URL params

## Metodologias de Valuation

As paginas exibem 3 metodologias classicas de valuation com premissas ajustaveis:

### 1. Graham (Value Investing)
- Formula: `sqrt(maxPL * maxPVP * LPA * VPA) * (1 - margemSeguranca)`
- Premissas com slider aberto: margem de seguranca
- Premissas locked (blur + redirect login): P/L maximo, P/VP maximo
- Valor intrinseco baseado em lucro por acao e valor patrimonial

### 2. Bazin (Dividendos)
- Formula: `mediaDiv5anos / dividendYieldMinimo`
- Premissas com slider aberto: DY minimo
- Premissas locked: anos para media
- Usa media de dividendos dos ultimos 5 anos

### 3. Gordon (DDM - Dividend Discount Model)
- Formula: `D1 / (taxaDesconto - crescimento)` onde D1 = DPA * (1 + g)
- Premissas com slider aberto: taxa de desconto, taxa de crescimento
- Premissas locked: anos para media
- Avaliacao por desconto de dividendos futuros

### Premissas padrao do SITE (iguais em ticker, landing, valuations.json e /ferramentas/calculadora-preco-justo/)
- Graham: `sqrt(22.5 * LPA * VPA)`, sem margem de seguranca
- Bazin: media de proventos de 5 anos / 6% (o "preco teto")
- Gordon: D0 = media de proventos de 5 anos, D1 = D0 * 1,04, r = 14%, g = 4% (exige r > g)
- O `valuations.json` traz os precos justos prontos, saidos do mesmo `buildModel` da pagina de ticker (invalido ou negativo = 0). A landing usa os prontos e so recalcula se faltar o campo.
- Os defaults do APP sao outros (margem 25%, DY 16%, r ancorado no beta). Nunca escrever "mesma conta do app".

### Proventos (`scripts/lib/dividends.ts`, out/2026)
Uma regua so para DY 12m, medias, Bazin/Gordon, ranking e o DY do topo da pagina (`dividendYieldTTM`):
ajuste por desdobramento/grupamento/bonificacao (`brapi_stock_splits`), duplicata = mesma natureza e valor
(ate 0,01%) com data-com a ate 3 dias, parcela com pagamentos diferentes fica, dividendo x JCP de mesmo valor
ficam, linha-total ao lado das parcelas sai (ate 0,01%, com a condicao do pagamento), cronograma revisto
(GRND3 dez/2025) conta uma vez; DY e medias so com renda e data-com em (hoje - N anos, hoje]. Testes com dado
real em `scripts/lib/fixtures/`. Residuos conhecidos no topo do arquivo.

### 4. DCF (Locked — apenas visual)
- Card full-width com tabela de sensibilidade WACC x G Perpetuo (gradiente fixo verde/vermelho)
- Premissas listadas mas borradas: beta setorial, WACC, crescimento por fase, margem EBITDA, cenarios
- Requer cadastro na plataforma para acesso

### WACC
- Ke (custo do equity) = Risk-Free Rate + Beta * Equity Risk Premium
- Kd (custo da divida) = implicito (juros/divida) ou default 16%
- WACC = Ke * (E/V) + Kd_liquido * (D/V)

### Premissas Base (cenario BASE)
- Taxa livre de risco: 15% (Selic alta)
- Premio de risco: 5%
- Beta: 1.0 (ou real da acao via brapi)
- Crescimento perpetuo: 5%
- Crescimento de receita projetado: 5%
- Custo da divida: 16%
- IR: 34%

Cada metodo possui sliders/inputs interativos no HTML para que o usuario ajuste as premissas e veja o preco justo recalculado em tempo real (via JavaScript inline).

## Paginas de Ticker (/{TICKER}/index.html)

Estrutura atual (**redesign de out/2026, React + Tailwind v4 + shadcn/ui** — o template antigo
`generateTickerHTML` de `template.ts` foi apagado; nada dele foi reaproveitado):

**Stack.** `scripts/ticker/` tem componentes React no padrao shadcn (`components/ui/*`: Button,
Card, Badge, Table, Tabs, Accordion, Separator, Progress — sem Radix, porque a pagina e renderizada
com `renderToStaticMarkup` no build e nao e hidratada). Tailwind v4 compila `styles.css` (tokens
shadcn com a paleta da landing: `#093848` + dourado `#B8923E`, DM Sans + JetBrains Mono) uma vez por
execucao (`buildTickerCss`) e o CSS sai **inline** em cada pagina. Interatividade em `client.js` (ES5,
inline). Tracking (`head-tracking.html`) e um HTML literal copiado byte a byte: nao passa por
template literal, entao nenhum backslash de regex e engolido. O `onclick="_iaClick(event)"` e
injetado no pos-processamento antes de cada `data-cta` (React nao renderiza onclick em string).
Iterar sem mexer em sitemap/indices: `npx tsx scripts/ticker/preview.ts PETR4 VALE3`.

Ordem da pagina (o DCF e o gancho; multiplos sobem; calculadoras logo abaixo):

1. **Header** escuro sticky — logo BH + IAcoes, busca (`/tickers.json`), "Entrar" (`nav-app`) e
   "Criar conta gratis" (`nav-assinar`).
2. **Hero** — breadcrumb; **logo da empresa** (`brapi_quotes.logo_url`, monograma por baixo se
   falhar); H1 com ticker + "{nome}: preco justo, DCF e indicadores"; cotacao (atualizada ao vivo),
   variacao do dia, desempenho semana/mes/6m/ano/12m (`week_change` etc., em FRACAO), faixa de 52
   semanas e **grade de multiplos** (P/L e DY com mediana do setor). Coluna direita: **card do DCF**
   escuro — valor e upside so como placeholder borrado (o numero real NAO vai para o HTML), mini
   heatmap de sensibilidade com os eixos reais de WACC/g e cores fixas, WACC estimado visivel, CTA
   "Ver o DCF de TICKER gratis" (`hero-dcf`) + "Me avise quando TICKER publicar na CVM" (`alerta-cvm-topo`).
3. **Calculadoras** (`#calculadoras`) — Graham (P/L max., P/VP max., margem), Bazin (DY minimo +
   janela 1/3/5/10 anos), Gordon (r, g, janela). Tudo aberto, recalcula na hora. Abaixo: grafico
   "Preco justo por metodo" (HTML/CSS, atualiza com os sliders, linha da cotacao, barra do DCF
   travada -> `dcf-locked`, media dos metodos abertos) + **matriz de sensibilidade do DCF travada**
   (celulas borradas sem numero, CTA `dcf-locked`). Primeira interacao com slider dispara
   `_iaTrack('calc_interact')`.
4. **Coluna principal** (8/12): Indicadores completos (4 grupos, sem abas), Dividendos (DY 12m,
   media 5a, grafico por ano, ultimos 12 pagamentos — deduplicados por data-com + valor),
   Demonstracoes (abas DRE/Balanco/Fluxo, grafico + tabela de 10 anos, todo painel no DOM), Sobre
   (texto SEO com numeros reais + resumo do negocio — **omitido se a brapi so tiver em ingles** +
   fatos: sede, funcionarios, site), Documentos da CVM (`alerta-cvm`), FAQ (accordion `<details>`).
5. **Coluna lateral** (4/12, sticky em telas >= 820px de altura): AIrton (`airton-audit`, 3
   perguntas + botao + social proof) e "Na plataforma para TICKER" (`dcf-locked`,
   `nota-qualitativa` com score `?,??` borrado, `alerta-cvm`, `asset-page`).
6. **Acoes do setor** — tabela com o proprio ticker destacado + 8 pares (cotacao, P/L, DY, valor de mercado).
7. **Faixa final** (`footer` -> DCF, `asset-page`), acoes populares, footer com metodologia +
   disclaimer (`disclaimer`), **CTA fixo mobile** "Ver DCF de TICKER" (`sticky-mobile`).

**SEO:** title "TICKER Esta Cara ou Barata? Preco Justo e DCF (ANO) | IAcoes"; description com
cotacao, P/L, DY e ROE reais; JSON-LD via `JSON.stringify` (WebPage + Corporation com
`tickerSymbol`/logo, BreadcrumbList apontando para `/acoes/{setor}/`, FAQPage de 8 perguntas com
numeros reais). Scroll depth: `scroll_25` calculadoras, `_50` indicadores, `_75` demonstracoes, `_100` FAQ.

**Atencao (historico):** a matriz do DCF travada ja existiu e saiu em 21/set/2026 (62 cliques, 0
contas em 90 dias). Voltou no redesign porque o DCF e o gancho principal — acompanhar `hero-dcf` e
`dcf-locked` contra criacao de conta.

**Saiu das paginas de ticker em ago/2026:** o **Card Markowitz** e o **Radar de Oportunidades** (do
card de features). Ambos continuam existindo **no produto pago** — sairam so do SEO porque falam de
carteira, e o visitante de ticker chegou do Google com uma acao e uma decisao na cabeca. Medido em
90 dias: `markowitz` 11 cliques e `nota-qualitativa` 7, contra `dcf-locked` 63 e `social-proof` 57.

**Tambem removido:** o lead magnet de CSV das demonstracoes financeiras — ver
[Lead magnet removido](#lead-magnet-de-csv--removido-ago2026).

### Conversao — Mapa de `data-cta`

Cada CTA tem `onclick="_iaClick(event)"` + `data-cta="ID"` para tracking granular.

**Paginas de ticker** (`/{TICKER}/`):

| data-cta | Posicao | Destino (`/authnew?...`) |
|----------|---------|------|
| `nav-app` | Nav: Acessar App | `ref=iacoes` |
| `nav-assinar` | Nav: Assinar Plano | `ref=iacoes` |
| `alerta-cvm-topo` | Link secundario da faixa de veredito + botao do bloco de documentos da CVM (2 links) | `ref=iacoes&ticker=T&intent=alerta` |
| `airton-audit` | Card de auditoria (3 perguntas prontas + botao = 4 links), abaixo da faixa de veredito | `ref=iacoes&ticker=T&intent=auditoria` (+`&prompt=...` nas perguntas) |
| `hero-dcf` | Card de veredito abaixo do hero, botao "Desbloquear DCF e Multiplos" (unico CTA de DCF acima da dobra) | `ref=iacoes&ticker=T&intent=dcf` |
| `dcf-locked` | Linha DCF da faixa de features (1 link; eram 5 ate 21/set/2026 — 3 premissas travadas viraram texto, o card DCF saiu) | `ref=iacoes&ticker=T` |
| `airton-intro` | Linha AIrton da faixa de features | `ref=iacoes&ticker=T&intent=airton` |
| `nota-qualitativa` | Linha da nota qualitativa na faixa de features | `ref=iacoes` |
| `alerta-cvm` | Linha de alertas na faixa de features | `ref=iacoes&ticker=T&intent=alerta` |
| `footer` | CTA final "Auditar TICKER gratis" (set/2026; antes generico, 11 cliques e 0 contas) | `ref=iacoes&ticker=T&intent=auditoria` |
| `disclaimer` | Link inline no disclaimer | `ref=iacoes` |
| `sticky-mobile` | Barra fixa (so mobile) | `ref=iacoes&ticker=T&intent=auditoria` |
| `asset-page` | Hero: "Ver TICKER na plataforma" | `ref=iacoes&ticker=T&next=/ativo/T` (encoded) |

**`next` (15/09/2026):** o unico CTA que leva a uma tela especifica do app. O `Auth.tsx` do app
redireciona para o `next` depois do login/cadastro, e na hora se a pessoa ja esta logada; os demais
parametros (`ref`, `ticker`, `utm_*` injetados pelo `_iaClick`) seguem junto na URL de destino. A
pagina do ativo no app EXIGE login — a versao publica de cada acao e esta pagina do iacoes. Cadastro
por e-mail passa pela confirmacao e pode perder o `next`; pelo Google ele e preservado.

**IMPORTANTE para dashboards:** `airton-audit` e o **sucessor historico de `social-proof`** — o card
foi reescrito e o id renomeado em 31/ago/2026. Quem agrega por `cta_id` precisa unir as duas series,
senao o grafico quebra na data da troca. Os ids **`markowitz`** (ago/2026) e **`features-card`** (set/2026) deixaram de ser emitidos.

**Landing page** (`/`, destino sempre `?ref=iacoes-lp`; redesign de 06/out/2026): `nav-comecar`, `hero`,
`lp-calc-alerta` (`next=/ativo/T&tab=tese`), `lp-calc-recalcular` (`next=/ativo/T&tab=valuation` + premissas),
`metodologias` (`intent=dcf`), `alerta-cvm` (`&intent=alerta`), `preco-iacoes`, `preco-fundamentalista`, `footer`,
`sticky-mobile`. Links internos medidos com `_iaTrack('cta_click', id)` (sem redirect e sem UTM): `lp-buffett`,
`lp-buffett-tape`, `lp-airton`, `lp-tape`. Deixaram de existir: `plataforma-calc`, `comparativo`.

Atencao: `alerta-cvm` e `sticky-mobile` sao usados **tanto** na landing quanto nas paginas de ticker,
entao o dashboard agrega as duas superficies na mesma serie. O `utm_medium` diferencia
(`landing` vs `ticker`); separar por `cta_id` seria decisao nova.

**Paginas `/airton/{TICKER}/`:** ver secao propria abaixo.

**Pagina `/airton/`:** `nav-comecar`, `hero-trial` (hero, "Conectar meu WhatsApp", `intent=airton`),
`airton-prompt` (3 perguntas prontas, `intent=airton&prompt=`), `plano-free`, `plano-ianalista`,
`final-trial`, `footer-link`, `sticky-mobile`. Destino `?ref=iacoes-airton`.

**Paginas de setor** (`/acoes/{setor}/`): nenhum CTA com `data-cta` hoje.

### Deep link para o app (convencao atual, out/2026)

O app so obedece `next`. O `Auth.tsx` cola o resto da query no fim do `next` com outro `?`, entao o `next`
termina SEMPRE com o parametro descartavel `&_=` (ele absorve o que o `_iaClick` acrescenta):

```
https://app.brasilhorizonte.com.br/authnew?ref=iacoes&next=<encodeURIComponent('/?s=<s>&t=<t>[&ticker=T]&_=')>
https://app.brasilhorizonte.com.br/authnew?ref=iacoes&next=<encodeURIComponent('/ativo/T?tab=<aba>&_=')>
```
(na landing `ref=iacoes-lp`). Mapa: Otimizador `s=ialocador&t=optimization` · Carteira/Backtest `s=ialocador&t=portfolio` ·
Radar `t=radar` · Rankings `t=rankings` · Painel Macro `t=macro` (todos `s=ialocador`) · Score `s=ianalista&t=score` ·
Validador `s=ianalista&t=validador` (aceita `&ticker=T&autorun=1`) · Minhas Teses `s=ianalista&t=teses` · Valuation DCF
`s=ianalista&t=valuai` (aceita `&ticker=T`) · AIrton `s=workspace` · Notificacoes `s=home&t=notificacoes` ·
Ativo `/ativo/T?tab=valuation|tese|docs`. Builders: `scripts/ferramentas/links.ts` (`appHref`) e `scripts/ticker/model.ts`;
simulacao ponta a ponta em `scripts/deeplinks.test.ts`. Pelo Google so o `next` sobrevive (ok); cadastro por e-mail com
confirmacao ainda perde o destino (pendencia do app: emailRedirectTo).

### Convencao antiga de `intent` (o app IGNORA; mantida so como rotulo de analytics)

Os CTAs passam um `intent` para a plataforma saber o que abrir depois do cadastro:

| `intent` | Significado |
|---|---|
| `alerta` | Configurar alerta de CVM do ticker |
| `airton` | Abrir conversa com o AIrton sobre o ticker |
| `auditoria` | Auditoria de tese; pode vir com `&prompt=<encodeURIComponent(pergunta)>` |
| `dcf` | Abrir o DCF completo do ticker (faixa de veredito, `hero-dcf`) |

**⚠️ O app ainda NAO le `intent` nem `ticker` (verificado no codigo do app em 06/out/2026):** depois do login
tudo cai na Home. So o `next` leva a uma tela especifica, e ele quebra se ja tiver `?` — o `Auth.tsx` concatena
o resto da query com outro `?`. Para abrir uma aba da pagina do ativo, use `next=/ativo/T&tab=valuation` (ou
`tese`), nunca `next=/ativo/T?tab=...`. Cadastro por e-mail perde o `next` (o link de confirmacao vai para a
Home); pelo Google, o `tab` se perde.

### Social Proof Dinamico

A funcao `socialProofCount(avgVolume, symbol)` gera numeros plausíveis de "investidores que validaram teses":
- Base logaritmica: `log10(volumeMedio)` — alto volume = mais validacoes
- Seed deterministico por ticker (soma de char codes) — consistente entre builds
- Multiplicador temporal: `1 + (diaDoAno/365 + (ano - 2026) * 2) * 0.15` — cresce ~15%/ano
- Range: 30 a 15.000

### SEO & Meta Tags
- `<title>`, `<meta description>`, `<meta keywords>`, `<meta robots>`
- Open Graph completo: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:locale`, `og:site_name`, `article:published_time`, `article:tag`
- Twitter Card: `summary_large_image` com `twitter:image` e `twitter:image:alt`
- Schema.org (JSON-LD): **3 grafos** — `Article` (com `publisher.sameAs` para LinkedIn, Twitter, Instagram, Telegram e `about: FinancialProduct`), `BreadcrumbList` (4 niveis) e `FAQPage`
- **Decidido NAO adicionar Schema.org ao bloco de documentos da CVM.** Racional: (1) o conteudo ja
  esta inteiro no DOM em HTML semantico (`<ol>`, `<time datetime>`, ancoras reais), que e o que
  crawlers e extratores de LLM leem; (2) um `ItemList` de links **externos** nao gera rich result
  no Google; (3) um quarto grafo de baixo valor so aumenta payload e superficie para aviso de
  structured-data mismatch
- `<link rel="canonical">` apontando para `https://iacoes.com.br/{TICKER}/`
- `datePublished`/`dateModified` estavel por dia (ISO com hora fixa)
- Cada pagina e self-contained (CSS inline, sem JS externo exceto GA4 e tracking Supabase)
- Metricas em CSS-only tabs (radio inputs + `:checked` selector) — todo conteudo no DOM, crawlers leem todas as abas

### Validacao Automatica (validate-html.ts)

Script `scripts/validate-html.ts` roda automaticamente apos `npm run generate` e verifica 8 regras:

| Regra | O que detecta |
|-------|--------------|
| regex-escaping | Regexes com `//` onde deveria ter `\\/` (backslash engolido por template literal) |
| cta-links | Links para `app.brasilhorizonte.com.br` sem `/authnew` |
| tracking-functions | `_iaTrack` e `_iaClick` ausentes em ticker/index pages |
| tracking-variables | `_iaD.dt` usado sem `_iaD` IIFE definida |
| onclick-without-href | Links com `_iaClick` mas `href` vazio |
| onclick-without-function | `_iaClick(event)` em paginas sem o script de tracking |
| utm-injection | `_iaClick` que nao injeta `utm_source`/`utm_campaign` (CTA sem atribuicao). Paginas de setor sao isentas |
| js-syntax | Padroes de JS invalido por template literals |
| marca-aposentada | IAnalista / IAlocador / "14 dias" no texto autoral (blocos `data-fonte="cvm"`/`"b3"` com dado externo ficam fora) |
| ferramentas-links | `href`/`src`/`data-src` para `/ferramentas/...` que nao existe no disco (landing e literais do JS inline inclusive) |
| ferramentas-bundle | `/assets/{js,css}/ferramentas*.{js,css}?v=` (inclusive `data-bundle`) apontando para arquivo inexistente |
| widget-em-link | `data-ia-widget` dentro de `<a>` |
| ferramentas | Paginas de /ferramentas/: tipo de JSON-LD, ItemList so com URL interna, termo proibido no texto autoral, link para `/#precos`, `publicadas.json` x disco |
| macro-page (aviso) | Frescor da pagina do Buffett |

`preview/` (gitignored) nao e varrido. A regra ferramentas-links so passa depois que o `npm run generate` cria o hub.

**IMPORTANTE:** Ao editar regexes dentro de template literals em `template.ts`, lembrar que `\\/` no template produz `\\/` no output (correto), mas `\/` produz `/` (backslash engolido). Sempre usar `\\\\` para `\\` no output.

## AIrton — assistente de IA

O **AIrton** e o assistente de IA da plataforma e o principal diferencial vendido nas paginas
publicas. Ele conhece a carteira do usuario, valida teses contra os fundamentos reais e resume os
documentos da CVM — no app e no WhatsApp.

### Onde o AIrton aparece

| Superficie | O que e |
|---|---|
| `/airton/` | Pagina dedicada, escrita manualmente |
| `/` (landing) | Secao `#airton` ("Assistente IA") + card de features "AIrton — Copiloto IA" + FAQ |
| `/{TICKER}/` | **Tres** blocos: apresentacao (`airton-intro`), auditoria de tese (`airton-audit`) e item no card de features |

As tres superficies na pagina de ticker sao deliberadas — e o produto. Antes de ago/2026
`scripts/template.ts` tinha **zero** mencoes ao AIrton, enquanto a landing dedicava duas secoes:
72% do trafego nunca ouvia falar do principal diferencial.

### Copy canonica (usar literalmente)

**Revisada em 07/out/2026 contra o codigo do app** (o que o texto pode prometer):
- O AIrton conversa no app, no WhatsApp e no Telegram (a conta gratis tambem, com limite diario), conhece carteira e teses, resume documentos da CVM e compara empresas DENTRO da conversa. Nao roda DCF, otimizacao nem backtest.
- Modos Discreto / Atento / Copiloto ficam nas Configuracoes; o padrao e **Atento** (o mock da landing abre nele).
- **Validador de Teses** (card de auditoria do ticker): a IA audita a ARGUMENTACAO da tese (fundamentacao, analise de riscos, clareza e logica de valuation) contra Fatos Relevantes e Comunicados da CVM. Nunca dizer que "cruza a tese com os numeros reais" nem que da preco-alvo. Pode errar.
- Perguntas prontas com `&prompt=` foram removidas: o app ignora o parametro.
- Badge da bolha de demonstracao: `Exemplo ilustrativo — nao e recomendacao de investimento`.
- Proibido: "Resume a CVM em segundos", "antes do mercado", "no instante", "valida contra os fundamentos reais".

### Regra dura: nunca inventar numero na bolha de demonstracao

A bolha de conversa do bloco `airton-intro` usa **dados reais do ticker que ja estao no escopo do
template** (preco justo ponderado, upside, valor intrinseco de Graham, ROE). A regra e implementada
em TypeScript, nao em copy: o array `airtonDemoSentences` recebe cada frase **so se o dado existir**
(`wfv > 0 && data.price > 0`, `grahamFV > 0`, `f.roe > 0`). Array vazio cai num
`airtonDemoAnswer` de fallback **sem nenhum numero**. Nunca relaxar isso — a Brasil Horizonte tem
CNPI e a bolha carrega badge de exemplo ilustrativo + `role="img"` com `aria-label`.

### Pagina `/airton/` (redesign de 21/set/2026, publica no go-live)

Escrita manualmente, WhatsApp-first, canonical `https://iacoes.com.br/airton/`. Desde set/2026 usa o
**mesmo design system da landing** (DM Sans + JetBrains Mono, tokens `:root` copiados, nav
`#093848`, fundo `#FAFAF8`); o tema escuro com Fraunces foi aposentado.

Motivo do redesign (90 dias medidos): 593 sessoes, 7,8% de CTR. Trafego de Twitter (45% do total)
convertia 2,5% e 80% saia sem rolar 25%; publico quente (direto/interno) convertia 11-13%. O hero
antigo era texto + "7 dias gratis"; o visitante frio queria ver o AIrton funcionando.

Estrutura: hero (h1 "Pergunte. Ele le a CVM por voce." + mock de conversa real + CTA "Conectar meu
WhatsApp") → `#perguntas` (3 perguntas prontas clicaveis, mesma mecanica do card de auditoria do
ticker) → `#como` (3 passos) → `#recursos` (**3** cards: CVM, dividendos/JCP, tese violada; eram 6)
→ `#planos` → FAQ → CTA final → footer. 1 grafo JSON-LD (FAQPage). GA4, Pixel e o bloco de tracking
identico ao da landing.

Regras:

- **A conversa do hero e baseada em documento real da CVM** (Fato Relevante WEGE3 de 16/09/2026,
  planejamento sucessorio) e **nao tem nenhum numero**. O mock anterior inventava ROE, Div/EBITDA,
  upside e valor de dividendo — proibido (CNPI). Ao trocar o exemplo, usar `cvm_documents` e manter
  o badge "Exemplo ilustrativo — nao e recomendacao de investimento" + `role="img"` com `aria-label`.
- **`data-promo` foi removido** de todos os CTAs. Ele trocava o `utm_campaign` para
  `balancos-1t26`, campanha encerrada em mai/2026 — a pagina estava atribuindo trafego a uma promo
  morta.
- O bloco de tracking desta pagina divergia da landing (`fbq('track','Lead')` em vez de
  `fbq('trackCustom','CTAIAcoes')`). Agora e copia literal; `diff` entre as duas copias deve dar vazio.
- Prova social "Mais de 200 investidores ja conectaram o WhatsApp" vem de
  `usage_events.whatsapp_token_generated` (236 usuarios distintos em 21/set/2026). Atualizar a mao.
- Ids de CTA mantidos para nao quebrar series: `hero-trial` e `final-trial` continuam sendo os ids
  do hero e do CTA final, mesmo que o botao agora diga "Conectar meu WhatsApp" (`intent=airton`).
  Novo: `airton-prompt` (3 links, `intent=airton&prompt=...&ticker=`).

## Paginas `/airton/{TICKER}/` (set/2026) — a porta de entrada por notificacao

Geradas por `scripts/airton-template.ts` (`generateAirtonTickerHTML`) dentro de `generatePage`, **so
para ticker com documento real em `cvm_documents`** (sem documento nao ha pagina — mock vazio seria
pior que nada). Design system da landing (DM Sans + JetBrains Mono). Quem chega veio de um tweet
sobre o ativo ou do Google por "fato relevante {TICKER}" / "{TICKER} comunicado CVM" — um cluster
de busca distinto de "preco justo {TICKER}", por isso **indexaveis e no sitemap** (priority 0.7).

**A pagina e uma simulacao que roda sozinha, sem clique**: carrega → o card "Alerta de {TICKER}
ativo" liga → uma notificacao estilo push desce do topo (`.push`, `position:fixed`) → "digitando" →
o **ultimo documento real** da CVM aparece como card do AIrton (tipo, data, titulo, `ai_summary`).
**O botao do card NAO abre a CVM** (decisao de 21/set/2026: precisamos do lead) — vai para o app
com `intent=airton&prompt=Resume o {tipo} de {T} publicado em {data}` e
`utm_content=doc-{doc_type}-{yyyy-mm-dd}` (`data-cta="doc-open"`), identificando o documento clicado → linha "Imagina receber tudo isso no seu WhatsApp, no instante em que sai na CVM?"
+ chips: "Mostra o anterior" (revela o proximo documento, evento `demo_prev`) e o CTA real
"Quero isso no meu WhatsApp" (`hero-alerta`, `intent=alerta`). Decisao do Gabriel em 21/set/2026:
sem moldura de celular ("old") e sem toggle para o usuario mexer — "extremamente rapido e dinamico".

Regras:
- **Todos os documentos (ate 5) estao no DOM** desde o HTML; o JS so esconde e revela. Sem JS
  (`<noscript>`) a lista inteira aparece. `prefers-reduced-motion` zera os delays.
- **Nenhum numero inventado**: so titulo/`ai_summary` reais. `stripPreamble` corta preambulos de
  persona do `ai_summary` ("Como analista financeiro, apresento..."), que nao sao informacao.
- Contagem "N documentos em 90 dias" vem dos ate 30 documentos deduplicados do cache
  (`CVM_CACHE_LIMIT`); se bater no teto vira "Mais de 30".
- `page_path` grava `/AIRTON/{TICKER}`; `utm_medium` default **`airton-ticker`**; `ref=iacoes-airton`.
  O bloco de tracking e copia literal do de `/airton/` (via `String.raw`), so muda esse default.
- Sem `wa.me`, sem "sem cadastro", `noindex` nunca.
- Link de tweet sugerido: `https://iacoes.com.br/airton/{TICKER}/?utm_source=twitter&utm_medium=social`.

`data-cta` da pagina: `nav-comecar`, `hero-alerta` (chip do feed), `doc-open` (botao de cada
documento; `utm_content` proprio), `airton-prompt` (3 perguntas),
`final-alerta`, `footer-link`, `sticky-mobile`, e `ver-valuation` (link interno para `/{TICKER}/`,
gravado via `_iaTrack('cta_click','ver-valuation')` sem `_iaClick`, porque nao sai do site).
Eventos proprios: `demo_prev`.

**Internal linking:** `/{TICKER}/` linka no rodape do bloco de documentos da CVM; `/acoes/` e as
paginas de setor mostram um sino (`.idx-alert-link`) ao lado do ticker que tem pagina (o
orquestrador passa o `Set` de diretorios `airton/*` existentes no disco para
`generateIndexHTML`/`generateSectorPage`). Schema.org: `BreadcrumbList`, `FAQPage` (4 Q&As) e
`WebPage` com `about: Corporation`.

**Pendente (produto, repo do app):** hoje o alerta real so dispara quando um documento novo sai.
A promessa da pagina fica mais forte se o app enviar o ultimo documento **no ato da ativacao**.

## Alertas e canal (WhatsApp first)

Os alertas sao a **porta de entrada fria** do funil: e a unica coisa do produto que entrega valor
antes de o visitante confiar no nosso valuation. Valuation ele questiona (e o numero dele contra o
nosso); "te aviso quando a {TICKER} publicar Fato Relevante" nao tem o que questionar.

### Tipos de alerta anunciados

1. **Fato Relevante e Comunicado ao Mercado:** em tempo real no WhatsApp/Telegram **so nos planos pagos (e no teste)**; na conta gratis, aviso no sino do app e resumo por e-mail limitado. Sem resumo da IA em alguns minutos, sai so o aviso.
2. **ITR e DFP NAO geram alerta** (decisao de produto). Nunca anunciar.
3. **Proventos, preco-alvo, preco justo de analise ValuAI salva e criterios da tese:** so planos pagos, no **resumo diario da manha** (nao e instantaneo). O preco justo das calculadoras Graham/Bazin/Gordon NAO gera alerta.
4. Criterios de tese monitorados: ROE min., P/L max., DY min., Div.Liq./EBITDA max., Margem EBITDA min., Margem liquida min.

### Canal: WhatsApp primario, Telegram secundario

**WhatsApp e o canal primario em toda copy publica. Telegram e mencionado como alternativa, sempre
em segundo lugar e em texto menor. Nenhuma pagina vende so Telegram.**

### A conexao do WhatsApp acontece DENTRO do app — e isso e intencional

**Nao existe e nao deve existir numero publico, link `wa.me` ou handle nas paginas do iAcoes.**
O usuario cria a conta, e o vinculo e feito por um **codigo unico gerado para a conta dele**, dentro
da plataforma. O mock da secao `#alertas` da landing mostra so `online · WhatsApp`, sem
identificador — **isso esta correto, nao e pendencia**. Registrado aqui exatamente para ninguem
"consertar" depois inventando um numero.

Checagem de QA: `grep -rIn "wa\.me\|whatsapp://\|+55" index.html airton/index.html scripts/template.ts`
tem que voltar **vazio**.

### Copy canonica de alerta

- Titulo (landing): `Fatos relevantes da sua carteira, resumidos no WhatsApp.`
- Sub: `Fatos relevantes e comunicados das suas acoes chegam em tempo real no WhatsApp ou no Telegram, com o resumo da IA. Proventos, preco-alvo e criterios da sua tese vem no resumo da manha.`
- Nota obrigatoria perto do botao: `Alertas no WhatsApp e no Telegram sao dos planos pagos. Na conta gratis, os avisos ficam no app e no e-mail.`
- Ticker: `Nos planos pagos: Fato Relevante e Comunicado em tempo real, proventos no resumo diario.`
- **Nunca** `Gratis, sem cartao` para WhatsApp/alertas: vale so para criar a conta.

**PROIBIDO prometer "sem cadastro" em qualquer copy.** O usuario vai ter que se cadastrar de
qualquer jeito — o degrau e o mesmo do DCF e da auditoria. A promessa honesta e **"gratis, sem
cartao"**, que e verdade. QA: `grep -ci "sem cadastro"` deve dar 0 em todas as paginas.

## Lead magnet de CSV — REMOVIDO (ago/2026)

O lead magnet das demonstracoes financeiras (download do CSV completo com captura de nome/email)
foi **removido das paginas de ticker**. Motivo: capturou **0 leads em ~5 meses** — a tabela
`iacoes_email_leads` estava vazia desde sempre.

O que saiu de `scripts/template.ts`:

- o card `div-lead-card` (formulario + estado de sucesso) e todo o CSS `.div-lead-*`
- a funcao `_iaLeadSubmit` e o evento `lead_financeiras`
- a referencia a `iacoes_email_leads`
- os 4 blobs JSON que so existiam para montar o CSV (`_iaDivData`, `_iaDreData`, `_iaBalData`,
  `_iaCfData`) — isso encolheu cada pagina de ticker de forma relevante

No lugar entrou o **card de alerta de CVM** (`data-cta="alerta-cvm"`), que leva direto ao
`/authnew` com o ticker no contexto. **Sem formulario e sem captura de email nas paginas regeneradas** (excecao: as 6
paginas orfas, abaixo). Ganho
operacional: sumiu a tabela intermediaria e o RLS que ja quebrou uma vez.

**Segunda origem ativa em `iacoes_email_leads`: o CSV do Indicador de Buffett (out/2026, pedido do Gabriel).** Para baixar
a serie completa em `/macro/indicador-de-buffett/` a pessoa deixa o e-mail. Reaproveita `iacoes_email_leads`
(RLS: anon so insere, so admin le; `name` e NOT NULL e vai vazio), com `source = 'buffett-csv'`. O formulario
fica em `scripts/macro/page.tsx` e o JS em `scripts/macro/csv-lead.client.js` (JS puro de proposito: regex
dentro de template literal do TS perde as barras invertidas). Eventos: `lead_buffett_csv` e, se a gravacao
falhar, `lead_buffett_csv_erro` — o arquivo e entregue mesmo assim. Campo invisivel `website` como armadilha
de robo. O CSV continua com URL publica (o JSON-LD `Dataset` aponta para ele, para o Google Dataset Search):
e um gate leve, nao um bloqueio. Testado com insert como `anon` dentro de transacao desfeita.
O aviso do formulario (LGPD) diz para que serve o e-mail, da o canal para sair (contato@brasilhorizonte.com.br)
e linka a Politica de Privacidade (o mesmo `LGPD.pdf` do storage que o app usa no cadastro). Sem JS o botao fica
desabilitado e o campo nao tem `name`, entao o e-mail nunca vai para a URL.

**Atencao — primeira origem, ainda no ar:** as 6 paginas orfas (AZUL4, CPLE5, GUAR3, MERC4, MOAR3, RDNI3), que
nao sao regeneradas, ainda tem o formulario antigo de nome + e-mail (`_iaLeadSubmit`, evento `lead_financeiras`) e
gravam `source = 'financeiras'`, sem aviso de marketing — e ainda recebem leads (ex.: CPLE5).
Para mandar novidades, exportar so `source = 'buffett-csv'`. Os leads aparecem no admin do app
(`AdminEmailsTab.tsx`, aba "Leads IAcoes"); os do Buffett vem com nome vazio.

## Calculadoras (`/calculadoras/`) — TRABALHO EM ANDAMENTO, FORA DO REPO

> **Status: seguradas.** As 5 paginas de calculadora estao **prontas no working tree mas NAO
> commitadas** e **NAO estao em producao**. Decisao do Gabriel em 31/ago/2026 (achou a aba ruim).
> Nada do que esta descrito abaixo existe no repositorio versionado — nem os arquivos, nem os
> scripts npm, nem as URLs no sitemap. Esta secao existe so para nao perder o conhecimento quando
> o feature voltar.

### O que existe (untracked no working tree)

- `calculadoras/` — 5 paginas geradas: `/calculadoras/` (indice), `juros-compostos/`,
  `aposentadoria/`, `quanto-investir-por-mes/`, `reserva-de-emergencia/`
- `scripts/calculators.ts` — definicao das 5 calculadoras (slug, campos, FAQ, copy)
- `scripts/generate-calculators.ts` — orquestrador (`generateCalculatorPages()`)
- `scripts/calculator-template.ts` — template HTML
- `scripts/validate-planning.ts` + `scripts/planning-cases.json` — teste de paridade do motor
- `scripts/inline/` — `planning-core.js` (motor, porte de `src/lib/planning/` do repo
  `dashbrasilhorizonte`), `calculator-app.js` (UI) e `tracking.js` (copia separada do bloco de
  tracking)

### Como reintegrar

1. **Patch salvo:** `_bmad-output/calculadoras-wip.patch`. Cobre `package.json`,
   `package-lock.json` e `scripts/validate-html.ts` (varredura de `calculadoras/` em
   `collectHTMLFiles` + regex tolerante a espacos na regra `tracking-variables`, para aceitar o
   `_iaD = (function () {` formatado do arquivo `.js` alem do minificado das paginas de ticker).
2. **A religacao de `scripts/template.ts` e `scripts/generate-pages.ts` NAO esta no patch e precisa
   ser refeita a mao:**
   - `template.ts`: reintroduzir `import { CALCULATORS } from './calculators'` e as 5 URLs de
     calculadora no gerador de sitemap (`/calculadoras/` com priority 0.9, filhas com 0.85)
   - `generate-pages.ts`: reintroduzir o import de `./generate-calculators` e a chamada
     `generateCalculatorPages()` no fim do build

### Caracteristicas (do estado prontos-mas-segurados)

- **Rodam sem Supabase e sem `.env`.** Nenhuma calculadora depende de dado de mercado — todo insumo
  e digitado pelo usuario.
- **Paridade obrigatoria:** `planning-cases.json` e o **mesmo arquivo nos dois repositorios**, e os
  valores esperados foram gerados por formulas fechadas independentes das duas implementacoes.
  `validate-planning.ts` roda dentro do `npm test`, antes do `validate-html.ts`.
- **Schema.org:** 3 grafos por pagina — `FAQPage`, `WebApplication`
  (`applicationCategory: FinanceApplication`, oferta `price: 0 BRL`) e `BreadcrumbList` de 3 niveis.
- CTAs (`nav-app`, `locked`, `final`, `footer`, `index-final` no indice) usam
  `?ref=iacoes&utm_content={cta}&calc={slug}`, sem `intent`.
- **Nao carregam GA4 nem Pixel do Facebook** — so o tracking Supabase.

### Pendencias conhecidas (resolver antes de publicar)

- **Paginas orfas:** nao estao linkadas de lugar nenhum do site — nem da landing, nem de `/acoes/`,
  nem das paginas de ticker. Publicar assim e um buraco de internal linking.
- `scripts/inline/tracking.js` **nao envia `is_bot` / `interacted`** (as paginas de ticker e a
  landing enviam).
- **Codigo morto de `_iaLeadSubmit` / `iacoes_email_leads`** em `scripts/inline/tracking.js` e nas
  5 paginas geradas — residuo do lead magnet de CSV removido em ago/2026. Nenhum formulario o chama.
  Se for limpar, e no `tracking.js`, e as 5 paginas precisam ser regeneradas.

## Landing `/fundamentalista/` (set/2026) — FORA DO AR desde 22/set/2026

> Subiu no go-live de 22/set e foi retirada no mesmo dia a pedido do Gabriel (`git rm --cached`).
> Os arquivos seguem em `fundamentalista/` no working tree, untracked. Nao estava no sitemap nem
> linkada de lugar nenhum.

Escrita manualmente, vende o **plano Fundamentalista** (R$ 79,90/mes · R$ 790/ano — o anual e 790,
nao 799; o Stripe fatura 790). Mesmo design system da landing (DM Sans + JetBrains Mono, tokens
`:root` copiados). Estrutura: nav → hero (h1 + card "Voce recebe") → `#inclui` (6 cards) →
`#comparar` (tabela IAcoes vs Fundamentalista) → `#como` (3 passos) → `#preco` (mensal/anual) →
`#sobre` (bios CNPI/CGA) → `#faq` (5 Q&As) → `#assinar` (CTA final) → footer com disclaimer.
3 grafos JSON-LD: `Product` (2 ofertas), `FAQPage`, `BreadcrumbList`. GA4 + Pixel + tracking Supabase.

**Regras de copy, verificadas com o runbook do go-live (sessoes dashbrasilhorizonte-5a/5b, 18/set/2026):**
- **NAO prometer "7 dias gratis"** — o trial concede o IAcoes, nao o Fundamentalista (e quem esta em
  trial nao ve carteira). QA: `grep -ci "7 dias" fundamentalista/index.html` deve dar 0.
- **NAO prometer carteiras da casa, nem data.** Decisao do Gabriel em 18/set/2026: o go-live nao lanca
  carteiras (GL-CASA-02/03/04 sairam do caminho critico). Quando entrarem, ha uma decisao de
  empacotamento a tomar antes de anunciar (access_tier = 'fundamentalista' e tier de banco, nao claim).
- **Nao existe deeplink de checkout** — nenhum `plan=` e lido pelo app. CTA:
  `/authnew?ref=iacoes-fundamentalista&next=%2Fplanos`; o usuario escolhe o card em Planos.
- Claim "sem conflito de interesse" **nao esta aprovado** por ninguem verificavel — nao usar aqui.
- Itens do plano = a copy do card de `/planos` do app, literal.

**Tracking:** `data-cta` = `nav-assinar`, `hero`, `comparativo`, `preco-mensal`, `preco-anual`,
`final`, `sticky-mobile`. `utm_medium` default `landing`, `utm_campaign` default
**`fundamentalista-lp`** (5a copia do bloco de tracking; difere das outras so nessa constante — nao
tem o ramo `data-promo`). Scroll depth: `#inclui` / `#como` / `#sobre` / `#assinar`.

**Pendente:** linkar da landing e da `/airton/` (hoje e orfa); adicionar ao sitemap quando publicar.

## Paginas de setor (`/acoes/{setor}/`)

23 paginas geradas por `generateSectorPage(sector, tickers)` em `scripts/template.ts`, uma por setor
da B3, com slug via `sectorSlug()`. Estao no sitemap (priority 0.85, changefreq weekly) e recebem
link do breadcrumb e do bloco de peers de cada pagina de ticker. Nao tem CTA com `data-cta` hoje, e
nao carregam o Pixel do Facebook.

## Paginas macro (/macro/ e /macro/indicador-de-buffett/)

Geradas por `scripts/macro/` (React + mesmos componentes/tokens das paginas de ticker, CSS proprio em
`scripts/macro/styles.css`). Spec e brief de SEO sao internos (fora deste repositorio, que e publico).

- **TRAVA DE PUBLICACAO:** so gera com `MACRO_BUFFETT_ENABLED=true` (env do build). Desligada, nada e
  escrito, nada entra no sitemap e nenhum link interno aponta para la — o site sai identico. Para publicar:
  criar a variavel de repositorio `MACRO_BUFFETT_ENABLED` = `true` no GitHub (Settings > Secrets and
  variables > Actions > Variables); o workflow `generate-pages.yml` ja le `vars.MACRO_BUFFETT_ENABLED`.
- **Dado:** series do Supabase montadas no dashbrasilhorizonte — 99020 (valor de mercado oficial da B3,
  diario), 99021 (mensal), 99010 (Buffett mensal desde 2000), 4382 (PIB 12m). Manchete = ultimo fechamento
  OFICIAL publicado pela B3 (D-1), nunca estimativa.
- **Nunca derruba o build:** dado velho (>7 dias), fora da faixa (10-150%) ou erro de rede vira
  `::warning::` no log e a pagina anterior continua no ar. O `validate-html` so AVISA sobre a pagina macro.
- **Saidas:** `/macro/index.html` (hub), `/macro/indicador-de-buffett/index.html`, o CSV publico
  `indicador-buffett-brasil.csv` (CC BY 4.0, distribution do JSON-LD Dataset) e `/llms.txt`.
- **Comandos:** `npm run preview:macro` (gera em `preview/`, fora do git, ignorando a trava; sirva a raiz
  com `npx serve .` e abra `/preview/macro/indicador-de-buffett/`) e `npm run test:macro` (node:test).

## Ferramentas (`/ferramentas/`, out/2026)

Hub `/ferramentas/` + 10 paginas `/ferramentas/<slug>/`, geradas por `generateFerramentas()` (`scripts/ferramentas/`)
dentro do `npm run generate` (depois dos tickers e do macro):

| id | slug | dado | JSON-LD |
|---|---|---|---|
| markowitz | markowitz | ilustrativo ("Acao A..E") | WebPage + DefinedTermSet |
| backtest | backtest-de-carteira | real: Ibovespa (retorno total) x CDI SGS 4390, `dados.json` | WebPage |
| fatos | fatos-relevantes | real: FR/CM com resumo da CVM, `dados.json` | CollectionPage + ItemList |
| ranking | ranking-de-acoes | real: DY/P-L/P-VP/ROE com cortes, `dados.json` | CollectionPage + ItemList |
| radar | radar-de-oportunidades | ilustrativo | WebPage |
| macro | painel-macro | valores FICTICIOS com aviso (decisao do dono); CTA leva aos reais no Painel Macro | WebPage |
| nota | nota-qualitativa | checklist do proprio usuario | WebPage |
| tese | tese-de-investimento | ilustrativo | WebPage |
| calc | calculadora-preco-justo | real: `valuations.json` | WebPage + WebApplication (unica com `offers`) |
| dcf | fluxo-de-caixa-descontado | ilustrativo ("Empresa A") | WebPage |

- Conteudo em `scripts/ferramentas/content/<id>.ts` (status `rascunho` | `pronto`; so `pronto` vai para a raiz), secoes SSR em `sections/<id>.tsx` (mapa `sections/index.ts`), widgets em `widgets/<id>.js|css` (ES5, sem template literal).
- **Bundle (excecao ao tudo-inline):** `assets/js/ferramentas.js` (runtime + widgets) e `assets/js/ferramentas-calc.js` (so a calculadora), com `?v=<hash>`; o gerador atualiza o `?v=` da landing. Runtime documentado no topo de `widgets/_runtime.js` (laco unico a 30 fps, nada anima fora da tela, `prefers-reduced-motion` = quadro final, `IAFerr.pauseAll()`, botao `data-ia-pause`).
- `/ferramentas/publicadas.json` lista o que esta no ar; quadro com `data-ia-tool` so monta se a ferramenta estiver publicada. Templates de ticker/macro/acoes so linkam pagina que existe (`toolPageExists`).
- Dado ruim nao sobrescreve: `dados.json` anterior fica, pagina anterior fica, `::warning::` no log. Ranking e backtest so gravam o JSON na raiz com a ferramenta `pronto`. Contrato dos JSONs: campos em fracao, datas em BRT, formato so cresce.
- Despublicar (`pronto` -> `rascunho`) exige apagar a pasta da ferramenta.
- Testes: `npm run test:ferramentas`, `npm run test:dados`; previa: `npm run preview:ferramentas -- --id <id>` (escreve em `preview/<id>/`, gitignored, inclui rascunhos com noindex).
- Honestidade: numero so de dado real e com data; sem dado real, selo "Exemplo ilustrativo" e rotulos "Acao A"; sem link para `/#precos` nem limite de plano; ferramenta paga diz "do plano IAcoes"; nada de "melhores", "baratas", "oportunidades" como rotulo de lista.
- data-cta: `tool-<id>`, `tool-<id>-final`, `tool-<id>-sticky`, `tool-nota-ativo`; links internos medidos com `data-track` (`tk-dcf`, `tk-calculadora`, `tk-nota-qualitativa`, `tk-fatos-relevantes`, `buffett-ranking`, `acoes-ranking`).

## Landing: secao "Todas as ferramentas" (`#ferramentas`)

Bento escuro logo depois do manifesto ("Nao vendemos ativos..."), antes da tabela comparativa: Markowitz 2x2,
DCF 2x1, Indicador de Buffett 2x1 (widget buffett, le /macro/indicador-de-buffett/dados.json e linka a pagina macro),
Ranking, Fatos, Nota, Tese, Radar 2x1, Backtest 2x1. Entrada unica em sequencia quando a grade chega na tela
(classe .in via IntersectionObserver; nada amarrado a rolagem). Cada quadro com o widget `data-size="tile"` e o titulo linkando a pagina (`lp-tool-<id>`). O bundle
desce sob demanda (`data-bundle` na secao, IntersectionObserver a 1200 px). Botao "Pausar animacoes"
(`data-ia-pause`, WCAG 2.2.2). Ao tirar uma ferramenta do ar, tirar o quadro da landing (o validate-html reprova
link para pagina inexistente). No hub, o cartao "Indicador de Buffett do Brasil" (pagina macro) e separado da ferramenta Painel Macro. Menu da landing: "Ferramentas" rola ate #ferramentas; o rodape leva ao hub. O mock do WhatsApp (passo 3 da historia) le os 2 documentos mais recentes de
`/ferramentas/fatos-relevantes/dados.json`; o balao do "resumo da manha" segue ilustrativo ("Acao C").

## Landing Page (index.html)

Escrita a mao (nao gerada). **Redesign de 06/out/2026:** menos texto (−41% de palavras fora FAQ e
bios), a calculadora no topo e scroll dinamico. Ordem das secoes:

1. **Hero = calculadora.** H1 "Quanto vale a acao que voce quer comprar?" + a **regua do preco
   justo**: cotacao x Graham, Bazin e Gordon de qualquer ticker do `/valuations.json`, com marcadores
   que andam ate o valor (ticker inicial muda por dia entre liquidos com os 3 metodos validos).
   - Premissas padrao fixas: margem 0, DY 6%, desconto 12%, crescimento 5%. Mexer nas premissas
     **nao recalcula na landing**: aparece "Recalcular na plataforma" (`lp-calc-recalcular`), que abre
     `/ativo/T?tab=valuation` no app e leva as premissas na URL com os nomes e fracoes dos campos do app
     (`marginOfSafety`, `minDividendYield`, `discountRate`, `dividendGrowth`) — o app ainda nao le.
   - "Receber os fatos relevantes desta acao" (`lp-calc-alerta`) abre `/ativo/T?tab=tese` (o preco justo das calculadoras nao gera alerta).
   - `#calculadora` e uma ancora vazia no topo do `<main>`: o hero e sticky e nao pode ser alvo de ancora.
2. **Faixa de cotacoes** — preco x preco justo de ~25 tickers (dados reais do `valuations.json`), com
   botao de pausa.
3. **Plataforma** (`#plataforma`) — 3 passos: DCF ("a IA propoe as premissas, voce decide", mock com selo),
   AIrton (modo Atento por padrao, "Acao A", sem numeros) e alertas no WhatsApp (dos planos pagos; os 2 baloes
   da CVM leem os documentos reais de /ferramentas/fatos-relevantes/dados.json). No desktop a tela fica fixa e o scroll conduz os passos (o AIrton
   digita conforme o scroll); no celular os passos empilham e animam ao aparecer.
4. **Ferramenta de analise, nao corretora** (`#comparativo`) — manifesto que acende palavra por palavra.
5. **Todas as ferramentas** (`#ferramentas`, ver secao propria acima), depois a tabela vs corretoras e casas de
   research. A antiga secao "A bolsa esta cara hoje?" saiu em 07/10/2026: o Indicador de Buffett ficava em
   dois lugares; agora e so o quadro do bento, que leva a /macro/indicador-de-buffett/.
6. **Planos** (`#precos`) — IAcoes (destaque) e Fundamentalista; a tabela completa Free x IAcoes x
   Fundamentalista fica num `<details>`.
7. **Quem somos** (`#sobre`), **FAQ** (`#faq`, `<details>`), **chamada final** (`#acesso`) e **analises
   por acao** (`#acoes`, 21 links + `/acoes/`).

**Scroll dinamico:** so com a classe `.fx` no `<html>` (JS ligado e sem `prefers-reduced-motion`). Sem
`.fx`, nada fica preso e tudo aparece no estado final. O hero fica sticky e a pagina sobe por cima dele
como uma folha (`.sheet`); cenas fixadas (`.scene` + `.scene-stage`) tem progresso 0→1 calculado no
scroll; elementos com `data-rise` sobem com `animation-timeline: view()` (sem suporte:
IntersectionObserver). A historia da plataforma so fixa com largura ≥ 1000px e altura ≥ 600px; Buffett e
manifesto fixam com altura ≥ 600px.

**Copy:** sem eyebrow em caixa alta e sem `→` nos botoes. Numero grande em DM Sans com algarismos
tabulares (a virgula do JetBrains Mono abre espaco demais); mono so em ticker e valor de tabela.

**Schema.org:** 5 blocos JSON-LD — Organization, WebSite (SearchAction), FAQPage (14 Q&As), Product (2
planos, com `image`) e SpeakableSpecification (`.hero h1`, `.hero-sub`, `.porque-lead`). **O texto de
cada `Question` tem que ser identico ao do `<details>` visivel** — mudou um, mude o outro.

### Widget Calculadora (`valuations.json`)

A calculadora do hero carrega `/valuations.json` via fetch. Este arquivo e gerado automaticamente pelo `generate-pages.ts` e contem para cada ticker:
- `name`, `sector`, `price` (cotacao atual)
- `graham`, `bazin`, `gordon` (precos justos pre-calculados)
- `lpa`, `vpa` (lucro e valor patrimonial por acao)
- `divTTM` (dividendos trailing twelve months)
- `avgDiv` (media de dividendos por janela: 1, 3, 5 e 10 anos)
- `_quoteDate` (campo global com data da geracao)

A regua recalcula com as premissas padrao a partir de `lpa`, `vpa`, `divTTM` e `avgDiv['5']`. Tracking
via `_iaTrack('widget_search')` quando a pessoa escolhe um ticker (o inicial, automatico, nao conta).

## Design System

### Landing page (index.html)
- Fontes: DM Sans (display), JetBrains Mono (mono)
- Cores: verde escuro `#093848`, dourado `#B8923E`, fundo `#FAFAF8`
- Nav: fundo `#093848`
- Texto terciario: `#737068` (ajustado para WCAG AA)

### Paginas de ticker
- Fontes: Playfair Display (titulos), Montserrat (corpo), SFMono (numeros)
- Cores: fundo `#f5f3ef`, texto `#0f172a`, nav `#041C24`, dourado `#B68F40`
- Positivo: `#10b981`, Negativo: `#ef4444`, Neutro: `#64748b`

## Dependencias

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  }
}
```

## Fluxo de Geracao

1. `npm run generate` e executado (manualmente ou via cron)
2. Script le `.env` e conecta ao Supabase
3. Busca lista de tickers ativos (market_cap > 0, ordenado por market_cap desc)
4. Processa em batches de 5 com 300ms de delay entre batches
5. Para cada ticker: fetch dados (incluindo `cvm_documents`) → calcula valuation → gera HTML → salva em `/{TICKER}/index.html`
6. Gera `sitemap.xml` (inclui TODAS as paginas de ticker existentes no disco, nao apenas as da execucao atual, mais setores), `robots.txt` e `tickers.json`
7. Gera `valuations.json` (dados de Graham, Bazin, Gordon, LPA, VPA, dividendos para o widget da landing page)
8. Gera `/acoes/index.html` (pagina indice com todos os tickers, inclui Twitter Card, og:image e keywords)
9. Gera as 23 paginas de setor `/acoes/{setor}/index.html`
10. Resultado: arquivos estaticos prontos para commit e push

**Nota sobre falhas:** ~25 tickers falham com "Sem dados" de `brapi_quotes` a cada rodada — problema
pre-existente de cobertura de cotacao, nao do gerador. Alguns diretorios (AZUL4, CPLE5, MERC4,
GUAR3, MOAR3, RDNI3) ficam com HTML antigo por causa disso.

### Cron Automatico (GitHub Actions)

O workflow `.github/workflows/generate-pages.yml` roda automaticamente:
- **Frequencia:** Seg-Sex as 23:00 UTC (20:00 BRT), apos fechamento da B3
- **Trigger manual:** Disponivel via GitHub Actions UI (`workflow_dispatch`)
- **Secrets necessarios:** `SUPABASE_URL` e `SUPABASE_ANON_KEY` (configurados no repositorio)
- **Processo:** Gera todas as paginas, commita e faz push automaticamente
- **Nota:** Redirects case-insensitive sao tratados pelo `404.html` via JavaScript client-side (converte path para uppercase)
- **Sem diretorios lowercase (desde 2026-10-06):** o CI so gera UPPERCASE. As copias minusculas (`petr4/` etc.) foram removidas — ver "Arquitetura de URLs" abaixo. URL minuscula cai no `404.html`, que redireciona para a maiuscula.

## Arquitetura de URLs: UPPERCASE (unica)

### Decisao arquitetural

As URLs de ticker usam **UPPERCASE** (ex: `/PETR4/`, `/VALE3/`), a convencao da B3. Existe **um so diretorio por ticker**.

### Historico: copias lowercase (mar-out/2026, removidas)

Entre 30/03 e 06/10/2026 existiram copias completas em minusculas (`/petr4/`) com canonical para a maiuscula. Foram removidas porque:
- o passo do CI que as gerava saiu do workflow, e elas so mudavam como efeito colateral de commits feitos em macOS (APFS nao diferencia maiusculas: `PETR4/` e `petr4/` sao o mesmo arquivo, e `git add -A` gravava o mesmo conteudo nos dois caminhos) — ficavam semanas desatualizadas;
- no GSC (06/10/2026) tinham 0 cliques, 0 impressoes e 0 URLs indexadas, e nenhum link externo ou interno apontava para elas;
- em clones macOS/Windows as duas entradas por ticker deixavam ~315 arquivos sempre "modificados".

**IMPORTANTE — se um dia voltarem copias lowercase, NAO usar `noindex` nelas.** Isso foi testado e causou problemas na indexacao do Google (possivel propagacao do `noindex` para a canonica UPPERCASE, bug documentado pelo Google/John Mueller); o `noindex` foi removido em fev-abr 2026.

### Redirect via 404.html

O `404.html` redireciona URLs de ticker em qualquer caixa para UPPERCASE:
- Padrao: `/[A-Za-z][A-Za-z0-9]{3}\d{1,2}/` (cobre `/petr4`, `/vale3` e radicais com digito como `/b3sa3`); o mesmo vale para `/airton/{ticker}/`
- Redirect via `window.location.replace()` (client-side; o GitHub Pages nao faz 301)
- Sitemap, canonical, `og:url` e Schema.org usam so UPPERCASE

### Impacto em Analytics

O `page_path` gravado na tabela `iacoes_page_views` e normalizado para UPPERCASE via `.toUpperCase()` na funcao `_iaTrack`. Isso garante que acessos via `/petr4/` e `/PETR4/` sejam consolidados como o mesmo path (`/PETR4`).

**Nota sobre GA4:** O Google Analytics 4 (tag `G-858T7GLTMJ`) registra `page_location` com a URL original (case-sensitive). Para consolidar no GA4, usar filtros ou exploracoes com regex case-insensitive nos relatorios.

## Analytics

Tres camadas, com coberturas diferentes:

| Camada | Onde | Identificador |
|---|---|---|
| **Google Analytics (GA4)** | landing, `/airton/`, ticker, `/acoes/` | tag `G-858T7GLTMJ` |
| **Pixel do Facebook** | landing, `/airton/`, ticker, `/acoes/` | Pixel ID `927250313694701` |
| **Supabase analytics** | **todas** as paginas, incluindo as de setor | POST em `iacoes_page_views` via REST API com anon key |

### Pixel do Facebook

Bloco `fbevents` (`fbq('init', _fbPixelId)` + `fbq('track','PageView')`), com o guard
`_fbPixelId && _fbPixelId.indexOf('_') < 0` — o guard existe para o snippet nao disparar se o ID
ficar como placeholder.

Ate ago/2026 o Pixel vivia **so na landing**. Agora esta tambem nos dois `<head>` gerados por
`scripts/template.ts` (template de ticker e template de `/acoes/`) e em `/airton/`.
`grep -c fbevents scripts/template.ts` deve dar **2**.

Alem do PageView, `_iaClick` dispara um evento custom **`CTAIAcoes`** quando o destino do link e um
host `brasilhorizonte.com`:

```js
if (typeof fbq === 'function' && _lh.indexOf('brasilhorizonte.com') > -1) fbq('trackCustom','CTAIAcoes')
```

Nas paginas de ticker esse trecho e envolvido por um `catch` que loga
`console.warn('[iAcoes] fbq CTA tracking falhou:', ...)` em vez de engolir o erro em silencio.

**Nao carregam Pixel:** as paginas de setor `/acoes/{setor}/`.

### Eventos rastreados
- `pageview` — dispara automaticamente ao carregar qualquer pagina
- `cta_click` — dispara ao clicar em qualquer CTA (com `cta_id` identificando qual botao)
- `widget_search` — dispara quando o usuario seleciona um ticker no widget da calculadora (landing page)
- `scroll_25`, `scroll_50`, `scroll_75`, `scroll_100` — scroll depth via IntersectionObserver
  (nas paginas de ticker e na landing)

O evento `lead_financeiras` **nao existe mais** — ver [Lead magnet removido](#lead-magnet-de-csv--removido-ago2026).

### Implementacao tecnica
- `_iaTrack(eventType, ctaId)` — funcao base que faz POST na tabela com `keepalive:true`. Segundo parametro opcional grava `cta_id`
- `_iaClick(event)` — handler de clique para CTAs: dispara o `fbq` custom, respeita
  meta/ctrl/shift/middle-click (deixa o link abrir em nova aba sem interceptar), faz
  `preventDefault()`, injeta UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content` = o
  proprio `data-cta`), le `data-cta` do elemento, dispara `_iaTrack('cta_click', ctaId)` e
  redireciona apos 150ms
- `_iaBOT` — IIFE avaliada **uma vez** no load, cacheada; alimenta a coluna `is_bot`
- `_iaINT` — comeca `false` e vira `true` no primeiro `pointerdown`/`keydown`/`touchstart`/`wheel`,
  via listeners `{passive:true, once:true}` em `window`, dentro de `try/catch`; alimenta `interacted`
- Dados coletados: session_id, page_path, cta_id, referrer, UTMs, device_type, screen_width, browser, OS, source_hint, click_id_source, is_bot, interacted

**O bloco de tracking existe em 4 lugares no repo que precisam ficar identicos:** as 2 copias
dentro de `scripts/template.ts` (ticker e `/acoes/`), `index.html` e `airton/index.html`. Ao mexer
nas copias de `template.ts`, lembrar do escaping de template literal (regra `regex-escaping`).
(Uma 5a copia, `scripts/inline/tracking.js`, existe apenas no working tree — ver a secao das
calculadoras.)

Defaults de `utm_medium` por pagina, distintos e intencionais: `ticker` / `acoes-index` /
`landing` (landing e `/airton/`).

### Parametros de referencia nos CTAs
- Landing page: `?ref=iacoes-lp` (todos os CTAs)
- Ticker pages: `?ref=iacoes` (generico) ou `?ref=iacoes&ticker=TICKER` (ticker-specific)
- Dashboard analytics: `supabase-analytics-dashboard` repo com breakdown por `cta_id`

## Redes Sociais

- **LinkedIn (empresa):** https://br.linkedin.com/company/brasil-horizonte
- **Twitter/X:** https://x.com/brasilhorizont
- **Instagram:** https://www.instagram.com/brasil.horizonte/
- **Telegram:** https://t.me/brasilhorizonte
- **LinkedIn (Gabriel, CNPI):** https://www.linkedin.com/in/gabriel-dantas-a-melo-cnpi-8796b4158/
- **LinkedIn (Lucas, CGA):** https://www.linkedin.com/in/lucastnm/

## Campanhas

**Nenhuma campanha ativa hoje.**

- **Promo 50% (Temporada de Balancos)** — **ENCERRADA** em 2026-05-03. O banner, a contagem
  regressiva e os boxes de preco promocionais **ja foram removidos do `index.html`**: nao ha nenhum
  elemento com `data-promo="1"` nem markup `.promo-banner` / `.pricing-promo-box` no body.
  `CAMPAIGN-PROMO-50.md` fica arquivado como referencia (inventario de mudancas, queries de analise)
  caso a promo seja repetida.
- **Residuos conhecidos no `index.html`** (inertes, seguros de limpar):
  - CSS orfao das classes `.promo-banner*`, `.pricing-promo*`, `.annual-promo`, `.hero-promo-line`
    e o keyframe `promoPulseGlow`
  - o ramo `data-promo` dentro de `_iaClick`, que trocaria o `utm_campaign` default de
    `seo-organico` para `balancos-1t26` — nunca dispara, porque nenhum elemento tem o atributo
  - um comentario de snippet do Microsoft Clarity, desabilitado, com TODO vencido em 2026-05-03

## TODO / Roadmap

- [x] Configurar GitHub Actions para regeneracao automatica (cron diario) — seg-sex 20h BRT
- [x] Adicionar SpeakableSpecification para AEO
- [x] Widget calculadora de preco justo na landing page
- [x] Schema.org Product para os planos
- [x] Redesign completo das ticker pages (brainstorming BMAD, 14 ideias, 10/abr/2026)
- [x] Tracking por CTA com `data-cta` e `cta_id` no Supabase
- [x] Validacao automatica pos-geracao (`validate-html.ts`)
- [x] Social proof dinamico nas ticker pages (baseado em volume medio)
- [x] Card de features da plataforma
- [x] Paginas de setor `/acoes/{setor}/` (23 setores)
- [x] Reforma de oferta das ticker pages (ago/2026): bloco de documentos da CVM, apresentacao do
      AIrton, card de auditoria reescrito, alerta de CVM no lugar do lead magnet, CTA fixo mobile
- [x] Canal WhatsApp-first em toda copy publica (Telegram como alternativa)
- [x] Pixel do Facebook nas paginas de ticker e `/acoes/`
- [x] Colunas `is_bot` / `interacted` em `iacoes_page_views` + view `iacoes_human_sessions`
- [ ] **Decidir o destino das calculadoras** (5 paginas prontas, seguradas fora do repo em
      31/ago/2026) — ver a secao Calculadoras. Se forem publicadas: linkar da landing e/ou das
      paginas de ticker, enviar `is_bot`/`interacted` no `tracking.js` e limpar o codigo morto de
      `_iaLeadSubmit` / `iacoes_email_leads`
- [~] **Twitter → pagina do ativo, nao para `/airton/`** (decisao de 21/set/2026). **Parcialmente
      resolvido no mesmo dia** pelas paginas `/airton/{TICKER}/` (ver secao propria): o link de tweet
      passa a ser `/airton/{TICKER}/?utm_source=twitter&utm_medium=social`. Falta so medir depois
      do go-live. Contexto original: Medido em 90 dias: `/airton/` converte 2,5% no trafego de Twitter (242 sessoes, 6
      cliques, 80% saem sem rolar 25%) contra 11-13% no publico quente. A ideia: os posts sobre
      um ticker linkam direto para `/{TICKER}/` (auditoria do AIrton + veredito acima da dobra),
      com `utm_source=twitter` para separar a serie. Exige: (1) decidir o formato do link nos
      posts, (2) garantir que o card de auditoria fica na primeira tela no mobile, (3) dashboard
      separando `utm_source`. Redesign da `/airton/` (hero = conversa real, CTA "Conectar meu
      WhatsApp", design system da landing) fica como frente separada
- [ ] Limpar o CSS orfao da promo 50% em `index.html`
- [ ] Depreciar as views `iacoes_page_views_human` e `iacoes_sessions_enriched` (heuristica de bot
      incorreta) — decisao explicita necessaria
- [ ] Decidir o destino da coluna `variant` (criada, sem uso, teste A/B cancelado)
- [ ] Unificar design system entre landing page e paginas de ticker (`/airton/` ja usa o da landing desde set/2026)
- [ ] Criar imagem OG 1200x628 (atual e 300x300)
- [ ] Adicionar informacoes de contato visiveis (email/telefone)
- [ ] Social proof na landing page (depoimentos, numero de usuarios)

### Descartado

- **Migracao para Vercel + teste A/B 50/50 da landing** (planejado e cancelado em ago/2026). A
  landing fez 40,7% de CTR em agosto, melhor mes da serie, e o volume (~528 sessoes/mes) exigiria
  ~6 semanas para detectar +10pp — efeito sutil seria indetectavel. Decisao: nao reescrever a
  landing sem medir, e nao medir com esse volume. Runbook arquivado em
  `_bmad-output/RUNBOOK-vercel-cutover.md`.
- **Lead magnet de CSV** — 0 leads em ~5 meses. Ver secao propria.
