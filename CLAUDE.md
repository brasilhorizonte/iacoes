# iAcoes — Documentacao do Projeto

## Visao Geral

**iAcoes** e o site de paginas estaticas de SEO da **Brasil Horizonte**, voltado para analise fundamentalista e valuation de acoes da B3 (bolsa brasileira). O objetivo e gerar paginas publicas otimizadas para busca (Google) que mostram o preco justo de cada acao, calculado por 5 metodologias de valuation, atraindo trafego organico e convertendo para a plataforma paga em `app.brasilhorizonte.com.br`.

- **Organizacao GitHub:** `brasilhorizonte`
- **Repositorio:** `brasilhorizonte/iacoes`
- **GitHub Pages:** `https://brasilhorizonte.github.io/iacoes/`
- **Dominio:** `https://iacoes.com.br`
- **Plataforma principal:** `https://app.brasilhorizonte.com.br`

## Arquitetura

O projeto e 100% estatico (HTML puro, sem framework JS). As paginas sao **geradas em build time** por um script TypeScript que:

1. Puxa dados financeiros do **Supabase** (tabelas: `brapi_quotes`, `brapi_income_statements`, `brapi_balance_sheets`, `brapi_cashflows`, `brapi_dividends`)
2. Calcula valuation por 5 metodologias
3. Renderiza HTML estatico com CSS inline
4. Salva como `/{TICKER}/index.html`
5. Gera `sitemap.xml` e `robots.txt`

O deploy e feito via **GitHub Pages** (branch `main`, path `/`).

## Estrutura de Arquivos

```
iacoes/
├── index.html              # Landing page institucional (escrita manualmente)
├── PETR4/index.html         # Pagina de ticker (gerada automaticamente)
├── VALE3/index.html         # Pagina de ticker (gerada automaticamente)
├── WEGE3/index.html         # Pagina de ticker (gerada automaticamente)
├── acoes/index.html         # Pagina indice com todos os tickers (gerada automaticamente)
├── 404.html                 # Redirect case-insensitive para tickers
├── assets/
│   └── img/
│       ├── dashboard-iacoes.png
│       └── institucional_branco_amarelo_3x.png
├── scripts/                 # Gerador de paginas estaticas (TypeScript)
│   ├── generate-pages.ts    # Orquestrador principal
│   ├── template.ts          # Template HTML + geradores de sitemap/robots
│   ├── validate-html.ts     # Validacao pos-geracao (7 regras, roda via postgenerate)
│   ├── valuation.ts         # Calculos de valuation (DCF, Graham, Gordon, EVA, Multiplos)
│   ├── supabase.ts          # Client Supabase + fetch + mappers de dados
│   ├── types.ts             # Interfaces TypeScript (FinancialData, ValuationResult, etc.)
│   └── constants.ts         # Constantes (taxas, pesos, cenarios)
├── _bmad/                   # BMAD framework (agentes, workflows, skills)
├── _bmad-output/            # Outputs de sessoes BMAD (brainstorming, etc.)
├── valuations.json          # Dados de valuation para o widget da landing page (gerado automaticamente)
├── robots.txt               # Gerado automaticamente
├── sitemap.xml              # Gerado automaticamente
├── tickers.json             # Lista de tickers gerada (usado pela busca)
├── CNAME                    # Dominio iacoes.com.br
├── .nojekyll                # Desabilita processamento Jekyll no GitHub Pages
├── .github/
│   └── workflows/
│       └── generate-pages.yml  # Cron diario (seg-sex 20h BRT) para regenerar paginas
├── vercel.json              # Config Vercel (cleanUrls, headers)
├── package.json             # Scripts npm e dependencias
├── .env                     # Credenciais Supabase (NAO commitado)
└── .gitignore
```

## Comandos

```bash
npm run generate              # Gera paginas para TODOS os tickers ativos no Supabase
npm run generate:test         # Gera apenas VALE3, PETR4, WEGE3
npx tsx scripts/generate-pages.ts ITUB4 BBAS3   # Gera tickers especificos
npm test                      # Roda validacao pos-geracao (7 regras)
npm run dev                   # Serve localmente com npx serve
```

**Nota:** `npm run generate` executa automaticamente `npm test` via hook `postgenerate`. Se a validacao falhar, o build para (nao commita HTML quebrado no CI).

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

### Tabela de analytics

| Tabela / View | Conteudo | Colunas-chave |
|---|---|---|
| `iacoes_page_views` (tabela) | Pageviews e cliques de CTA (bruto, incluindo bots) | `session_id`, `page_path`, `event_type` (`pageview` ou `cta_click`), `cta_id`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `device_type`, `screen_width`, `browser`, `os`, `source_hint`, `click_id_source`, `created_at` |
| `iacoes_page_views_human` (view) | Mesmas colunas, exclui sessoes flaggeadas como bot | Consumida pelo dashboard via RPC `get_analytics_data()` |
| `iacoes_sessions_enriched` (view) | 1 linha por session com flag `is_bot` e metricas agregadas | Usada para debug/auditoria do filtro |

- RLS habilitado com policy "Allow anon insert" para o role `anon`
- O tracking usa fetch com `keepalive:true` para sobreviver a navegacao
- Cliques de CTA usam `_iaClick(event)` que faz `preventDefault()` + tracking + redirect com 150ms de delay, garantindo que o fetch e disparado antes da navegacao
- `_iaClick` le o atributo `data-cta` do elemento clicado e grava como `cta_id` no Supabase
- `source_hint` detecta in-app browsers (Facebook, Instagram, WhatsApp, etc.) via User-Agent
- `click_id_source` detecta plataformas de ads (fbclid, gclid, ttclid, etc.) via URL params

### Filtro de crawlers (views `iacoes_page_views_human` e `iacoes_sessions_enriched`)

Desde 2026-04-22 o dashboard consome a view `iacoes_page_views_human` ao inves da tabela bruta. A view exclui sessoes flaggeadas como bot pela regra: 1 pageview + 0 cta_clicks + sem referrer/utm_source/click_id_source/source_hint + `screen_width = 412` + `device_type = 'mobile'` + `os = 'Android'` (9 sinais simultaneos por `session_id`).

Historicamente, ~33% das sessoes eram bots (crawler disfarcado de Chrome Android mobile). Spike de 2026-04-21 (412 pageviews vs baseline ~50) tinha 80% de origem crawler. Filtro foi validado contra dados de 10 dias (dias normais filtram 8-20%, dias com crawler ativo filtram 40-80%).

Migracoes relacionadas no repo `supabase-analytics-dashboard`:
- `supabase/migrations/20260422_filter_iacoes_bots.sql` (cria views + versao atualizada da RPC `get_analytics_data()`)

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

Cada pagina gerada contem (redesign de 10/abr/2026):

1. **Nav** — Logo BH + iAcoes + busca de ticker + botoes "Acessar App" / "Assinar Plano" (data-cta: nav-app, nav-assinar)
2. **Breadcrumb** — Navegacao hierarquica (Home > Acoes > Setor > TICKER)
3. **Hero** — Ticker, nome, setor, preco atual, variacao dia/12m, nota qualitativa blur ao lado da cotacao, micro-CTA anchor "Fazer meu Valuation" (scroll suave para cards)
4. **Card Auditoria IA** — Headline emocional ("Leu um relatorio sobre TICKER?"), social proof dinamico baseado em volume medio + crescimento temporal, gradiente dourado, CTA "Auditar com IA" (data-cta: social-proof)
5. **Card Combinado SEO** — Intro analise (3 paragrafos SEO) + Visao de Negocio (longBusinessSummary) unificados num card com divisor
6. **Metricas em Tabs CSS-only** — 4 abas (Mercado, Valuation, Rentabilidade, Endividamento) com radio inputs, todo conteudo no DOM para SEO. Tab Valuation aberta por default. Timestamp de atualizacao
7. **Cards de Valuation** — Graham, Bazin, Gordon com sliders funcionais (pulse animation via IntersectionObserver). Premissas sem slider (P/L Maximo, P/VP Maximo, Anos para Media) sao locked com blur e redirecionam para login (data-cta: dcf-locked)
8. **Card DCF Full-width** — Tabela de sensibilidade WACC x G Perpetuo com gradiente verde/vermelho (visual fixo), badge PRO, frase diferenciadora, CTA "Fazer Valuation DCF" (data-cta: dcf-locked)
9. **Card Features** — Fundo escuro (#041C24), full-width, 5 features com icones: DCF Completo, Nota Qualitativa, Otimizador Markowitz, Radar de Oportunidades, Documentos CVM (data-cta: features-card)
10. **Nota Qualitativa** — Paywall com blur, barras de progresso por categoria com scores reais, CTA "Desbloquear Analise" (data-cta: nota-qualitativa)
11. **Card Markowitz** — "Tem TICKER na carteira? Descubra se esta otimizada segundo Markowitz" (data-cta: markowitz)
12. **Demonstracoes Financeiras** — DRE, Balanco, Fluxo de Caixa, Dividendos (tabelas com 10 anos) + Lead Magnet: download CSV completo com captura de nome/email (event: lead_financeiras)
13. **Peers** — Acoes do mesmo setor com links internos
14. **FAQ** — 12 perguntas frequentes dinamicas por ticker (Schema.org FAQPage)
15. **CTA Final** — Link para a plataforma paga (data-cta: footer)
16. **Acoes Populares** — Links cross-sector para internal linking
17. **Disclaimer + Footer** — Notas metodologicas (Graham, Bazin, Gordon) + disclaimer legal + logos

### Conversao — 12 Touchpoints com Tracking

Cada CTA tem `onclick="_iaClick(event)"` + `data-cta="ID"` para tracking granular:

| data-cta | Posicao | Link |
|----------|---------|------|
| nav-app | Nav: Acessar App | ?ref=iacoes |
| nav-assinar | Nav: Assinar Plano | ?ref=iacoes |
| social-proof | Card auditoria IA | ?ref=iacoes&ticker=TICKER |
| dcf-locked | Premissas locked (3x) + DCF card | ?ref=iacoes&ticker=TICKER |
| features-card | Card features | ?ref=iacoes |
| nota-qualitativa | Nota qualitativa paywall | ?ref=iacoes |
| markowitz | Card Markowitz | ?ref=iacoes |
| footer | CTA final | ?ref=iacoes&ticker=TICKER |
| disclaimer | Link inline disclaimer | ?ref=iacoes |

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
- Schema.org (JSON-LD): `Article` com `publisher.sameAs` (LinkedIn, Twitter, Instagram, Telegram), `BreadcrumbList` (4 niveis), `FAQPage` (12 Q&As), `FinancialProduct`
- `<link rel="canonical">` apontando para `https://iacoes.com.br/{TICKER}/`
- `datePublished`/`dateModified` estavel por dia (ISO com hora fixa)
- Cada pagina e self-contained (CSS inline, sem JS externo exceto GA4 e tracking Supabase)
- Metricas em CSS-only tabs (radio inputs + `:checked` selector) — todo conteudo no DOM, crawlers leem todas as abas

### Validacao Automatica (validate-html.ts)

Script `scripts/validate-html.ts` roda automaticamente apos `npm run generate` e verifica 7 regras:

| Regra | O que detecta |
|-------|--------------|
| regex-escaping | Regexes com `//` onde deveria ter `\\/` (backslash engolido por template literal) |
| cta-links | Links para `app.brasilhorizonte.com.br` sem `/authnew` |
| tracking-functions | `_iaTrack` e `_iaClick` ausentes em ticker/index pages |
| tracking-variables | `_iaD.dt` usado sem `_iaD` IIFE definida |
| onclick-without-href | Links com `_iaClick` mas `href` vazio |
| onclick-without-function | `_iaClick(event)` em paginas sem o script de tracking |
| js-syntax | Padroes de JS invalido por template literals |

**IMPORTANTE:** Ao editar regexes dentro de template literals em `template.ts`, lembrar que `\\/` no template produz `\\/` no output (correto), mas `\/` produz `/` (backslash engolido). Sempre usar `\\\\` para `\\` no output.

## Landing Page (index.html)

A landing page institucional e escrita manualmente (nao gerada). Contem:
- Hero section com proposta de valor (CTA primario dourado)
- Ticker strip animada (dados estaticos, scroll infinito)
- Secao de modulos (iAnalista, iAlocador)
- Secao de features (9 cards com emojis + aria-label)
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
- Schema.org: Organization, WebSite (com SearchAction), FAQPage (14 Q&As), Product (3 planos com precos), SpeakableSpecification (AEO)

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
5. Para cada ticker: fetch dados → calcula valuation → gera HTML → salva em `/{TICKER}/index.html`
6. Gera `sitemap.xml` (inclui TODAS as paginas de ticker existentes no disco, nao apenas as da execucao atual), `robots.txt` e `tickers.json`
7. Gera `valuations.json` (dados de Graham, Bazin, Gordon, LPA, VPA, dividendos para o widget da landing page)
8. Gera `/acoes/index.html` (pagina indice com todos os tickers, inclui Twitter Card, og:image e keywords)
9. Resultado: arquivos estaticos prontos para commit e push

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

Todas as paginas (landing, ticker, indice) incluem:

1. **Google Analytics (GA4)** — tag `G-858T7GLTMJ`
2. **Supabase self-hosted analytics** — insere na tabela `iacoes_page_views` via REST API com anon key

### Eventos rastreados
- `pageview` — dispara automaticamente ao carregar qualquer pagina
- `cta_click` — dispara ao clicar em qualquer CTA (com `cta_id` identificando qual botao)
- `widget_search` — dispara quando o usuario seleciona um ticker no widget da calculadora (landing page)
- `lead_financeiras` — dispara quando usuario baixa dados financeiros completos (DRE, Balanco, FC, Dividendos)
- `scroll_25`, `scroll_50`, `scroll_75`, `scroll_100` — scroll depth via IntersectionObserver

### Implementacao tecnica
- `_iaTrack(eventType, ctaId)` — funcao base que faz POST na tabela com `keepalive:true`. Segundo parametro opcional grava `cta_id`
- `_iaClick(event)` — handler de clique para CTAs: faz `preventDefault()`, le `data-cta` do elemento, dispara `_iaTrack('cta_click', ctaId)`, e redireciona apos 150ms
- Dados coletados: session_id, page_path, cta_id, referrer, UTMs, device_type, screen_width, browser, OS, source_hint, click_id_source

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

## TODO / Roadmap

- [x] Configurar GitHub Actions para regeneracao automatica (cron diario) — seg-sex 20h BRT
- [x] Adicionar SpeakableSpecification para AEO
- [x] Widget calculadora de preco justo na landing page
- [x] Schema.org Product para os planos
- [x] Redesign completo das ticker pages (brainstorming BMAD, 14 ideias, 10/abr/2026)
- [x] Tracking por CTA com `data-cta` e `cta_id` no Supabase
- [x] Validacao automatica pos-geracao (`validate-html.ts`)
- [x] Lead magnet expandido (dados financeiros completos em CSV)
- [x] Social proof dinamico nas ticker pages (baseado em volume medio)
- [x] Card de features da plataforma (DCF, Nota, Markowitz, Screening, CVM)
- [ ] Unificar design system entre landing page e paginas de ticker
- [ ] Criar imagem OG 1200x628 (atual e 300x300)
- [ ] Adicionar informacoes de contato visiveis (email/telefone)
- [ ] Social proof na landing page (depoimentos, numero de usuarios)
