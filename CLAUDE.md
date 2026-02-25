# iAcoes — Documentacao do Projeto

## Visao Geral

**iAcoes** e o site de paginas estaticas de SEO da **Brasil Horizonte**, voltado para analise fundamentalista e valuation de acoes da B3 (bolsa brasileira). O objetivo e gerar paginas publicas otimizadas para busca (Google) que mostram o preco justo de cada acao, calculado por 5 metodologias de valuation, atraindo trafego organico e convertendo para a plataforma paga em `app.brasilhorizonte.com.br`.

- **Organizacao GitHub:** `brasilhorizonte`
- **Repositorio:** `brasilhorizonte/iacoes`
- **GitHub Pages:** `https://brasilhorizonte.github.io/iacoes/`
- **Dominio futuro:** `https://iacoes.com.br`
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
├── robots.txt               # Gerado automaticamente
├── sitemap.xml              # Gerado automaticamente
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

## Metodologias de Valuation

O modulo `scripts/valuation.ts` calcula o preco justo por 5 metodos e faz uma media ponderada:

### 1. Fluxo de Caixa Descontado (DCF) — Peso padrao: 40%
- Projeta FCF por 5 anos com crescimento de receita
- Calcula valor terminal com crescimento perpetuo (Gordon)
- Desconta a valor presente pelo WACC
- Fair Value = (PV dos fluxos + PV do terminal + caixa - divida) / acoes

### 2. Graham — Peso padrao: 20%
- Formula: `sqrt(22.5 * LPA * VPA)`
- Valor intrinseco baseado em lucro por acao e valor patrimonial

### 3. EVA/MVA (Economic Value Added) — Peso padrao: 15%
- NOPAT = EBIT projetado * (1 - IR)
- EVA = NOPAT - (Capital Investido * WACC)
- MVA = EVA / WACC
- Fair Value = (Capital Investido + MVA - divida + caixa) / acoes

### 4. Multiplos (P/L e EV/EBITDA setoriais) — Peso padrao: 15%
- Calcula preco justo por P/L setorial e EV/EBITDA setorial
- Media dos dois

### 5. Gordon (DDM - Dividend Discount Model) — Peso padrao: 10%
- D1 = EPS * (1 + g)
- Fair Value = D1 / (Ke - g)

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

### Perfis de peso
- **GROWTH:** DCF 50%, EVA 20%, Multiplos 20%, Graham 10%, Gordon 0%
- **MATURE (padrao):** DCF 40%, Graham 20%, EVA 15%, Multiplos 15%, Gordon 10%
- **DISTRESS:** DCF 40%, Multiplos 25%, Graham 20%, EVA 15%, Gordon 0%

## Paginas de Ticker (/{TICKER}/index.html)

Cada pagina gerada contem:

1. **Header da empresa** — Ticker, nome, setor, preco atual, variacao dia/12m
2. **Metricas de Mercado** — Market Cap, EV, acoes, volume, min/max 52 semanas
3. **Metricas de Valuation** — P/L, P/VP, P/EBIT, PSR, EV/EBITDA, Div Yield, LPA, VPA
4. **Rentabilidade & Margens** — ROE, ROIC, margem bruta/EBIT/EBITDA/liquida
5. **Endividamento & Liquidez** — Div.Liq/EBITDA, Div.Bruta/PL, Liquidez Corrente
6. **Card de Consenso** — Preco justo ponderado, upside, range min/max, WACC
7. **Cards de Metodo** — Um card por metodologia com preco justo e upside
8. **Resumo de Negocio** — Descricao longa da empresa (longBusinessSummary)
9. **Demonstracoes Financeiras** — DRE, Balanco, Fluxo de Caixa, Dividendos (tabelas com 10 anos)
10. **Matriz de Sensibilidade** — WACC vs crescimento perpetuo (5x5)
11. **CTA** — Link para a plataforma paga
12. **Disclaimer** — Aviso legal sobre IA e riscos

### SEO
- `<title>`, `<meta description>`, `<meta keywords>`, OpenGraph tags
- Schema.org (JSON-LD) com tipo `Article`
- `<link rel="canonical">` apontando para `https://iacoes.com.br/{TICKER}`
- Cada pagina e self-contained (CSS inline, sem JS externo)

## Landing Page (index.html)

A landing page institucional e escrita manualmente (nao gerada). Contem:
- Hero section com proposta de valor
- Secao de metodologias (Graham, Bazin, Gordon, DCF)
- Secao de diferenciais (sem conflito de interesse, IA, etc.)
- Screenshot do dashboard
- CTA para cadastro
- Design system: DM Sans + JetBrains Mono, paleta verde escuro (#2B3A2B) + dourado (#B8923E)

## Design System

### Landing page (index.html)
- Fontes: DM Sans (display), JetBrains Mono (mono)
- Cores: verde escuro `#2B3A2B`, dourado `#B8923E`, fundo `#FAFAF8`
- Nav: fundo `#2B3A2B`

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
6. Gera `sitemap.xml` e `robots.txt`
7. Resultado: arquivos estaticos prontos para commit e push

## TODO / Roadmap

- [ ] Configurar GitHub Actions para regeneracao automatica (cron diario)
- [ ] Migrar dominio `iacoes.com.br` para GitHub Pages (ou Vercel)
- [ ] Gerar paginas para todos os ~400 tickers ativos
- [ ] Unificar design system entre landing page e paginas de ticker
- [ ] Adicionar link de volta para landing page nas paginas de ticker
