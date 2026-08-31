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
│   ├── template.ts              # Template HTML de ticker/indice/setor + sitemap/robots
│   ├── validate-html.ts         # Validacao pos-geracao (8 regras, roda via postgenerate)
│   ├── valuation.ts         # Calculos de valuation (DCF, Graham, Gordon, EVA, Multiplos)
│   ├── supabase.ts          # Client Supabase + fetch + mappers de dados
│   ├── qualitative-cache.json  # Cache de notas qualitativas
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

Estrutura atual (redesign de 10/abr/2026, reforma de oferta em ago/2026):

1. **Nav** — Logo BH + iAcoes + busca de ticker + botoes "Acessar App" / "Assinar Plano" (data-cta: nav-app, nav-assinar)
2. **Breadcrumb** — Navegacao hierarquica (Home > Acoes > Setor > TICKER)
3. **Hero** — Ticker, nome, setor, preco atual, variacao dia/12m, nota qualitativa blur ao lado da cotacao, micro-CTA anchor "Fazer meu Valuation" (scroll suave para cards)
4. **Bloco de Documentos da CVM** — "O que TICKER publicou na CVM": lista `<ol>` dos 4 documentos
   reais mais recentes (tipo traduzido, `<time datetime>`, titulo, resumo do AIrton), cada um linkando
   o documento oficial (`target="_blank" rel="noopener nofollow"`, sem `_iaClick` — e link externo,
   nao CTA). CTA primario "Receba os proximos no WhatsApp" (data-cta: alerta-cvm-topo), linha de
   social proof e CTA secundario "Ou peca ao AIrton para auditar sua tese" (data-cta: airton-audit).
   **Fallback:** ticker sem cobertura na CVM nao renderiza este bloco — no lugar volta o **Card de
   Auditoria do AIrton** ("Leu um relatorio sobre TICKER? Pergunte ao AIrton.") com 3 perguntas
   prontas clicaveis e a mesma linha de social proof, todos com data-cta `airton-audit`.
   Hoje: 297 paginas com documentos reais, 25 com o card de auditoria.
5. **Card Combinado SEO** — Intro analise (3 paragrafos SEO) + Visao de Negocio (longBusinessSummary) unificados num card com divisor
6. **Metricas em Tabs CSS-only** — 4 abas (Mercado, Valuation, Rentabilidade, Endividamento) com radio inputs, todo conteudo no DOM para SEO. Tab Valuation aberta por default. Timestamp de atualizacao
7. **Cards de Valuation** — Graham, Bazin, Gordon com sliders funcionais (pulse animation via IntersectionObserver). Premissas sem slider (P/L Maximo, P/VP Maximo, Anos para Media) sao locked com blur e redirecionam para login (data-cta: dcf-locked)
8. **Card DCF Full-width** — Tabela de sensibilidade WACC x G Perpetuo com gradiente verde/vermelho (visual fixo), badge PRO, frase diferenciadora, CTA "Fazer Valuation DCF" (data-cta: dcf-locked)
9. **Apresentacao do AIrton** — Eyebrow "Assistente IA", titulo "Conheca o AIrton, seu copiloto para
   TICKER", bolha de conversa de demonstracao com dados **reais** do ticker, 3 capacidades
   (Acessa sua carteira / Valida suas teses / Resume a CVM em segundos), CTA
   "Conversar com o AIrton sobre TICKER" (data-cta: airton-intro). Ver [AIrton](#airton--assistente-de-ia)
10. **Card Features** — Fundo escuro (#041C24), full-width, 6 features com icones: DCF Completo,
    Nota Qualitativa, AIrton, Alertas CVM em tempo real, Minhas Teses, Documentos CVM (data-cta: features-card)
11. **Nota Qualitativa** — Paywall com blur, barras de progresso por categoria com scores reais, CTA "Desbloquear Analise" (data-cta: nota-qualitativa)
12. **Demonstracoes Financeiras** — DRE, Balanco, Fluxo de Caixa, Dividendos (tabelas com 10 anos)
13. **Card de Alerta CVM** — Card escuro centrado com icone de sino, "Fique sabendo antes do mercado",
    CTA "Ativar alertas de TICKER" (data-cta: alerta-cvm), rodape "Gratis, sem cartao. Tambem
    disponivel no Telegram."
14. **Peers** — Acoes do mesmo setor com links internos + link para `/acoes/{setor}/`
15. **FAQ** — perguntas frequentes dinamicas por ticker (Schema.org FAQPage)
16. **CTA Final** — Link para a plataforma paga (data-cta: footer)
17. **Acoes Populares** — Links cross-sector para internal linking
18. **Disclaimer + Footer** — Notas metodologicas (Graham, Bazin, Gordon) + disclaimer legal + logos
19. **CTA fixo mobile** — Barra `position:fixed` na base, so em `@media (max-width:768px)`,
    "Auditar TICKER gratis" (data-cta: sticky-mobile). `body` ganha `padding-bottom` para a barra
    nao cobrir conteudo.

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
| `alerta-cvm-topo` | Bloco de documentos da CVM (topo) | `ref=iacoes&ticker=T&intent=alerta` |
| `airton-audit` | Link secundario do bloco da CVM; nos tickers sem cobertura, as 3 perguntas prontas + botao do card de auditoria (4 links) | `ref=iacoes&ticker=T&intent=airton` (secundario) / `intent=auditoria&prompt=...` (card) |
| `dcf-locked` | Premissas locked (3x) + card DCF | `ref=iacoes&ticker=T` |
| `airton-intro` | Bloco de apresentacao do AIrton | `ref=iacoes&ticker=T&intent=airton` |
| `features-card` | Card de features | `ref=iacoes` |
| `nota-qualitativa` | Paywall da nota qualitativa | `ref=iacoes` |
| `alerta-cvm` | Card de alerta (fim das demonstracoes) | `ref=iacoes&ticker=T&intent=alerta` |
| `footer` | CTA final | `ref=iacoes&ticker=T` |
| `disclaimer` | Link inline no disclaimer | `ref=iacoes` |
| `sticky-mobile` | Barra fixa (so mobile) | `ref=iacoes&ticker=T&intent=auditoria` |

**IMPORTANTE para dashboards:** `airton-audit` e o **sucessor historico de `social-proof`** — o card
foi reescrito e o id renomeado em 31/ago/2026. Quem agrega por `cta_id` precisa unir as duas series,
senao o grafico quebra na data da troca. O id **`markowitz`** deixou de ser emitido (card removido).

**Landing page** (`/`, destino sempre `?ref=iacoes-lp`): `nav-comecar`, `hero`, `plataforma-calc`,
`metodologias`, `comparativo`, `alerta-cvm` (`&intent=alerta`), `preco-ianalista`, `preco-ialocador`,
`preco-fundamentalista`, `footer`, `sticky-mobile`.

Atencao: `alerta-cvm` e `sticky-mobile` sao usados **tanto** na landing quanto nas paginas de ticker,
entao o dashboard agrega as duas superficies na mesma serie. O `utm_medium` diferencia
(`landing` vs `ticker`); separar por `cta_id` seria decisao nova.

**Pagina `/airton/`:** `nav-comecar`, `hero-trial`, `plano-free`, `plano-ianalista`, `final-trial`,
`footer-link`, `sticky-mobile`.

**Paginas de setor** (`/acoes/{setor}/`): nenhum CTA com `data-cta` hoje.

### Convencao de `intent` no `/authnew`

Os CTAs passam um `intent` para a plataforma saber o que abrir depois do cadastro:

| `intent` | Significado |
|---|---|
| `alerta` | Configurar alerta de CVM do ticker |
| `airton` | Abrir conversa com o AIrton sobre o ticker |
| `auditoria` | Auditoria de tese; pode vir com `&prompt=<encodeURIComponent(pergunta)>` |

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

- Eyebrow: `Assistente IA`
- Titulo (ticker): `Conheca o AIrton, seu copiloto para {TICKER}`
- Sub: `Ele conhece sua carteira, valida suas teses contra os fundamentos reais e resume os documentos da CVM — no app e no seu WhatsApp.`
- Capacidades: `Acessa sua carteira` · `Valida suas teses` · `Resume a CVM em segundos`
- Botao: `Conversar com o AIrton sobre {TICKER} →`
- Auditoria, headline: `Leu um relatorio sobre {TICKER}? Pergunte ao AIrton.`
- Auditoria, sub: `O AIrton cruza a tese com os numeros reais de {TICKER} — governanca, vantagem competitiva, endividamento e riscos — e diz onde ela nao se sustenta.`
- Auditoria, perguntas prontas (3, clicaveis, cada uma leva ao app com o prompt em `&prompt=`):
  `Minha tese em {TICKER} se sustenta?` · `Resume o ultimo Fato Relevante de {TICKER}` ·
  `Compara {TICKER} com os pares do setor`
- Auditoria, botao: `Auditar {TICKER} gratis →`
- Badge da bolha de demonstracao: `Exemplo ilustrativo — nao e recomendacao de investimento`

### Regra dura: nunca inventar numero na bolha de demonstracao

A bolha de conversa do bloco `airton-intro` usa **dados reais do ticker que ja estao no escopo do
template** (preco justo ponderado, upside, valor intrinseco de Graham, ROE). A regra e implementada
em TypeScript, nao em copy: o array `airtonDemoSentences` recebe cada frase **so se o dado existir**
(`wfv > 0 && data.price > 0`, `grahamFV > 0`, `f.roe > 0`). Array vazio cai num
`airtonDemoAnswer` de fallback **sem nenhum numero**. Nunca relaxar isso — a Brasil Horizonte tem
CNPI e a bolha carrega badge de exemplo ilustrativo + `role="img"` com `aria-label`.

### Pagina `/airton/`

Escrita manualmente, WhatsApp-first, canonical `https://iacoes.com.br/airton/`.
Fontes proprias (Fraunces + DM Sans + JetBrains Mono) — nao usa nem o design system da landing nem o
das paginas de ticker. Estrutura: hero → `#como` (3 passos: criar conta gratis → vincular WhatsApp
com codigo unico → falar com o AIrton) → `#recursos` (conversa de verdade, alertas CVM em tempo
real, etc.) → `#planos` → FAQ → disclaimer. 1 grafo JSON-LD. Tem GA4, Pixel do Facebook e o mesmo
bloco de tracking Supabase das demais paginas.

## Alertas e canal (WhatsApp first)

Os alertas sao a **porta de entrada fria** do funil: e a unica coisa do produto que entrega valor
antes de o visitante confiar no nosso valuation. Valuation ele questiona (e o numero dele contra o
nosso); "te aviso quando a {TICKER} publicar Fato Relevante" nao tem o que questionar.

### Tipos de alerta anunciados

1. **Documentos da CVM** — Fato Relevante, ITR, DFP, Comunicado ao Mercado, no instante da publicacao
2. **Dividendos / JCP** — anuncios de proventos
3. **Resultados** — com o resumo do AIrton pronto
4. **Violacao de criterio de tese** — aviso na hora em que um criterio da tese do usuario e violado

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

- Titulo: `Fique sabendo antes do mercado`
- Sub (ticker): `Receba no WhatsApp cada Fato Relevante, ITR, DFP e anuncio de proventos de {TICKER} no instante em que sai na CVM — com o resumo do AIrton pronto.`
- Botao: `Ativar alertas de {TICKER} →`
- Rodape: `Gratis, sem cartao. Tambem disponivel no Telegram.`
- Bloco de topo (documentos da CVM), botao: `Receba os proximos no WhatsApp →`, rodape `Gratis, sem cartao.`

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
`/authnew` com o ticker no contexto. **Sem formulario e sem captura de email no iAcoes.** Ganho
operacional: sumiu a tabela intermediaria e o RLS que ja quebrou uma vez.

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

## Paginas de setor (`/acoes/{setor}/`)

23 paginas geradas por `generateSectorPage(sector, tickers)` em `scripts/template.ts`, uma por setor
da B3, com slug via `sectorSlug()`. Estao no sitemap (priority 0.85, changefreq weekly) e recebem
link do breadcrumb e do bloco de peers de cada pagina de ticker. Nao tem CTA com `data-cta` hoje, e
nao carregam o Pixel do Facebook.

## Landing Page (index.html)

A landing page institucional e escrita manualmente (nao gerada). Contem:
- Hero section com proposta de valor (CTA primario dourado)
- Ticker strip animada (dados estaticos, scroll infinito)
- Secao de modulos (iAnalista, iAlocador)
- **Secao `#airton` ("Assistente IA")** — apresentacao do AIrton, com a sub canonica
  ("...no app e no seu WhatsApp")
- **Secao `#alertas` ("AIrton no WhatsApp")** — titulo `Fique sabendo antes do mercado`, mock de
  conversa (`online · WhatsApp`, sem identificador), CTA `Ativar alertas no WhatsApp →`
  (data-cta: `alerta-cvm`, `intent=alerta`) e a linha `.alerts-note`
  "Gratis, sem cartao. Tambem disponivel no Telegram." Lista de beneficios: alertas CVM em tempo
  real, resultados com resumo do AIrton, dividendos/JCP e criterio de tese violado.
  **Nota de manutencao:** as classes CSS dessa secao ainda se chamam `.tg-*` (heranca de quando era
  "AIrton no Telegram"). So o conteudo textual mudou; renomear as classes mexeria em layout
- Secao de features (9 cards com emojis + aria-label), incluindo "AIrton — Copiloto IA" e
  "Alertas no WhatsApp" (tag `VIA WHATSAPP`)
- Secao de metodologias (Graham, Bazin, Gordon, DCF com layout 2 colunas)
- **Widget Calculadora de Preco Justo** — calculadora interativa com autocomplete de tickers, sliders para premissas (margem de seguranca Graham, DY minimo Bazin, taxa de desconto/crescimento Gordon), recalculo em tempo real. Dados carregados de `/valuations.json` (gerado no build). Exibe data da cotacao. Tease para DCF na plataforma paga.
- Secao de diferenciais (sem conflito de interesse, IA, etc.)
- Secao comparativa vs mercado (Corretoras vs Casas de Research vs iAcoes)
- Secao de precos (3 planos: IAnalista, IAlocador, Fundamentalista) — badge "MAIS POPULAR" no IAlocador
- Secao comparativa de recursos (tabela Free vs IAnalista vs IAlocador vs Fundamentalista) — Free com limitacoes (1/dia), inclui Painel Macro no IAlocador
- Secao "Sobre Nos" (#sobre) — bios dos fundadores com credenciais CNPI (APIMEC) e CGA (ANBIMA), links sociais (LinkedIn, Twitter/X, Instagram, Telegram)
- FAQ expandido (14 perguntas com Schema.org FAQPage, aria-expanded)
- Secao de acoes populares (21 tickers + link para /acoes/)
- Footer com links sociais (LinkedIn, Twitter/X, Instagram, Telegram)
- Multiplos CTAs com tracking (`_iaClick`) apontando para `/authnew`
- Design system: DM Sans + JetBrains Mono, paleta verde escuro (#093848) + dourado (#B8923E)
- Schema.org: 5 grafos JSON-LD — Organization, WebSite (com SearchAction), FAQPage (14 Q&As), Product (3 planos com precos), SpeakableSpecification (AEO). **Quando a copy visivel citada num grafo mudar, atualizar o JSON-LD junto** (ex: as `Question` sobre o AIrton e sobre planos citam "notificacoes no WhatsApp e no Telegram")

### Widget Calculadora (`valuations.json`)

O widget da landing page carrega `/valuations.json` via fetch. Este arquivo e gerado automaticamente pelo `generate-pages.ts` e contem para cada ticker:
- `name`, `sector`, `price` (cotacao atual)
- `graham`, `bazin`, `gordon` (precos justos pre-calculados)
- `lpa`, `vpa` (lucro e valor patrimonial por acao)
- `divTTM` (dividendos trailing twelve months)
- `avgDiv` (media de dividendos por janela: 1, 3, 5 e 10 anos)
- `_quoteDate` (campo global com data da geracao)

O JavaScript inline na landing recalcula os precos justos em tempo real quando o usuario ajusta os sliders. Tracking via `_iaTrack('widget_search')`.

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
- **Geracao lowercase (CI):** O workflow tambem gera diretorios lowercase (`petr4/`, `vale3/`, etc.) com conteudo completo e `<link rel="canonical">` apontando para a versao UPPERCASE. Isso e feito no CI (Ubuntu, case-sensitive) porque macOS e case-insensitive e nao permite criar ambos os diretorios localmente.

## Arquitetura de URLs: UPPERCASE vs lowercase

### Decisao arquitetural

As URLs primarias do iAcoes usam **UPPERCASE** para os tickers (ex: `/PETR4/`, `/VALE3/`). Isso reflete a convencao da B3, onde tickers sao sempre em maiusculas.

### Estrutura dual (UPPERCASE + lowercase)

Para cada ticker, existem **dois diretorios** no repositorio:

| Diretorio | Conteudo | Gerado por | Exemplo |
|-----------|----------|-----------|---------|
| `/{TICKER}/` (UPPERCASE) | Pagina completa de analise | `generate-pages.ts` (local ou CI) | `/PETR4/index.html` |
| `/{ticker}/` (lowercase) | Pagina completa com canonical para UPPERCASE | GitHub Actions (Ubuntu) | `/petr4/index.html` |

**Por que dois diretorios?**
- Usuarios podem digitar URLs em lowercase no navegador
- Buscas no Google podem retornar variantes de case
- O lowercase serve como ponto de entrada alternativo, consolidando autoridade via canonical

**Por que gerar lowercase no CI e nao localmente?**
- macOS tem filesystem case-insensitive: `/PETR4/` e `/petr4/` sao o mesmo diretorio
- Ubuntu (GitHub Actions) tem filesystem case-sensitive: permite criar ambos
- O script `generate-pages.ts` sempre gera UPPERCASE; o workflow do CI gera os lowercase

### Configuracao SEO das paginas lowercase

- `<link rel="canonical" href="https://iacoes.com.br/{TICKER}/">` — aponta para UPPERCASE
- `<meta name="robots" content="index, follow">` — permite indexacao
- `og:url` aponta para UPPERCASE
- Sitemap (`sitemap.xml`) contem **somente URLs UPPERCASE**
- Schema.org usa URLs UPPERCASE

**IMPORTANTE — NAO usar `noindex` nas paginas lowercase.** Isso foi testado anteriormente e causou problemas na indexacao do Google (possivelmente propagacao do `noindex` para a URL canonica UPPERCASE, bug documentado pelo Google/John Mueller). O `noindex` foi removido em fev-abr 2026. Nao reintroduzir sem investigacao aprofundada.

### Redirect via 404.html

O `404.html` contem JavaScript que redireciona URLs de ticker para UPPERCASE:
- Padrao detectado: `/[A-Za-z]{4}\d{1,2}/` (ex: `/petr4`, `/vale3`)
- Redirect via `window.location.replace()` (client-side, nao 301 HTTP)
- Funciona como fallback para tickers que nao tem diretorio lowercase

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
- [ ] Limpar o CSS orfao da promo 50% em `index.html`
- [ ] Depreciar as views `iacoes_page_views_human` e `iacoes_sessions_enriched` (heuristica de bot
      incorreta) — decisao explicita necessaria
- [ ] Decidir o destino da coluna `variant` (criada, sem uso, teste A/B cancelado)
- [ ] Unificar design system entre landing page, `/airton/` e paginas de ticker
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
