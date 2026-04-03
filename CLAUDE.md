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
│   ├── valuation.ts         # Calculos de valuation (DCF, Graham, Gordon, EVA, Multiplos)
│   ├── supabase.ts          # Client Supabase + fetch + mappers de dados
│   ├── types.ts             # Interfaces TypeScript (FinancialData, ValuationResult, etc.)
│   └── constants.ts         # Constantes (taxas, pesos, cenarios)
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
npm run dev                   # Serve localmente com npx serve
```

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

| Tabela | Conteudo | Colunas-chave |
|---|---|---|
| `iacoes_page_views` | Pageviews e cliques de CTA | `session_id`, `page_path`, `event_type` (`pageview` ou `cta_click`), `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `device_type`, `screen_width`, `browser`, `os`, `created_at` |

- RLS habilitado com policy "Allow anon insert" para o role `anon`
- O tracking usa fetch com `keepalive:true` para sobreviver a navegacao
- Cliques de CTA usam `_iaClick(event)` que faz `preventDefault()` + tracking + redirect com 150ms de delay, garantindo que o fetch e disparado antes da navegacao

## Metodologias de Valuation

As paginas exibem 3 metodologias classicas de valuation com premissas ajustaveis:

### 1. Graham (Value Investing)
- Formula: `sqrt(maxPL * maxPVP * LPA * VPA) * (1 - margemSeguranca)`
- Premissas ajustaveis: P/L maximo, P/VP maximo, margem de seguranca
- Valor intrinseco baseado em lucro por acao e valor patrimonial

### 2. Bazin (Dividendos)
- Formula: `mediaDiv5anos / dividendYieldMinimo`
- Premissas ajustaveis: DY minimo
- Usa media de dividendos dos ultimos 5 anos

### 3. Gordon (DDM - Dividend Discount Model)
- Formula: `D1 / (taxaDesconto - crescimento)` onde D1 = DPA * (1 + g)
- Premissas ajustaveis: taxa de desconto, taxa de crescimento
- Avaliacao por desconto de dividendos futuros

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

Cada pagina gerada contem:

1. **Nav** — Logo Brasil Horizonte (imagem) + divisor + iAcoes estilizado
2. **Breadcrumb** — Navegacao hierarquica (Home > Acoes > TICKER)
3. **Header da empresa** — Ticker, nome, setor, preco atual, variacao dia/12m
4. **Metricas de Mercado** — Market Cap, EV, acoes, volume, min/max 52 semanas
5. **Metricas de Valuation** — P/L, P/VP, P/EBIT, PSR, EV/EBITDA, Div Yield, LPA, VPA
6. **Rentabilidade & Margens** — ROE, ROIC, margem bruta/EBIT/EBITDA/liquida
7. **Endividamento & Liquidez** — Div.Liq/EBITDA, Div.Bruta/PL, Liquidez Corrente
8. **Cards de Metodo** — Graham, Bazin, Gordon com premissas ajustaveis e preco justo
9. **Resumo de Negocio** — Descricao longa da empresa (longBusinessSummary)
10. **Nota Qualitativa** — Secao com paywall (conteudo blur + barras de progresso por categoria + CTA)
11. **Demonstracoes Financeiras** — DRE, Balanco, Fluxo de Caixa, Dividendos (tabelas com 10 anos)
12. **FAQ** — 8 perguntas frequentes dinamicas por ticker (Schema.org FAQPage)
13. **CTA** — Link para a plataforma paga
14. **Footer** — Logos BH + iAcoes, disclaimer legal

### SEO & Meta Tags
- `<title>`, `<meta description>`, `<meta keywords>`, `<meta robots>`
- Open Graph completo: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:locale`, `og:site_name`, `article:published_time`, `article:tag`
- Twitter Card: `summary_large_image` com `twitter:image` e `twitter:image:alt`
- Schema.org (JSON-LD): `Article` com `publisher.sameAs` (LinkedIn, Twitter, Instagram, Telegram), `BreadcrumbList` (4 niveis), `FAQPage` (8 Q&As), `FinancialProduct`
- `<link rel="canonical">` apontando para `https://iacoes.com.br/{TICKER}/`
- `datePublished`/`dateModified` estavel por dia (ISO com hora fixa)
- Cada pagina e self-contained (CSS inline, sem JS externo exceto GA4 e tracking Supabase)

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
- **Processo:** Gera todas as paginas, cria redirects lowercase (SEO), commita e faz push automaticamente
- **Nota macOS:** Os redirects lowercase (`aalr3/index.html`) causam conflito no filesystem case-insensitive do macOS. Usar clone temporario em `/tmp` para push quando necessario

## Analytics

Todas as paginas (landing, ticker, indice) incluem:

1. **Google Analytics (GA4)** — tag `G-858T7GLTMJ`
2. **Supabase self-hosted analytics** — insere na tabela `iacoes_page_views` via REST API com anon key

### Eventos rastreados
- `pageview` — dispara automaticamente ao carregar qualquer pagina
- `cta_click` — dispara ao clicar em qualquer CTA que aponta para `app.brasilhorizonte.com.br`
- `widget_search` — dispara quando o usuario seleciona um ticker no widget da calculadora (landing page)

### Implementacao tecnica
- `_iaTrack(eventType)` — funcao base que faz POST na tabela com `keepalive:true`
- `_iaClick(event)` — handler de clique para CTAs: faz `preventDefault()`, dispara `_iaTrack('cta_click')`, e redireciona apos 150ms. Isso garante que o fetch e iniciado antes da navegacao para o dominio externo.
- Dados coletados: session_id, page_path, referrer, UTMs, device_type, screen_width, browser, OS

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
- [ ] Unificar design system entre landing page e paginas de ticker
- [ ] Criar imagem OG 1200x628 (atual e 300x300)
- [ ] Adicionar informacoes de contato visiveis (email/telefone)
- [ ] Social proof na landing page (depoimentos, numero de usuarios)
- [ ] Lead magnet / captura de email (newsletter, analise semanal gratis)
