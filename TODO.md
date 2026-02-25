# TODO — Páginas Estáticas ValuAI para SEO

## Etapa 1: Setup do projeto
- [x] Configurar TypeScript e dependências (tsx, @supabase/supabase-js, dotenv)
- [x] Criar estrutura de pastas scripts/
- [x] Configurar variáveis de ambiente (.env)

## Etapa 2: Lógica de valuation
- [x] Adaptar types.ts do dashbrasilhorizonte
- [x] Adaptar financialService.ts (cálculos DCF, Graham, Bazin, Gordon, EVA)
- [x] Criar supabase client e funções de fetch de dados
- [x] Testar com um ticker (VALE3) — OK!

## Etapa 3: Template HTML
- [x] Criar template base seguindo o design da LP
- [x] Seção: Header empresa (nome, ticker, setor, preço)
- [x] Seção: Métricas fundamentais (P/L, P/VP, ROE, DY, etc.)
- [x] Seção: Valuation 5 métodos com preço justo
- [x] Seção: CTA para cadastro na plataforma
- [x] Meta tags SEO (title, description, OpenGraph, schema.org)

## Etapa 4: Script de geração
- [x] Criar generate-pages.ts (orquestrador)
- [x] Buscar lista de tickers ativos do Supabase
- [x] Loop: fetch dados → calcular → renderizar → salvar HTML
- [x] Gerar sitemap.xml
- [x] Gerar robots.txt

## Etapa 5: Deploy e automação
- [ ] Configurar Vercel rewrites (vercel.json)
- [x] Script npm run generate / npm run generate:test
- [ ] Documentar cron job para regeneração diária

## Comandos
- `npm run generate` — Gera páginas para TODOS os tickers ativos
- `npm run generate:test` — Gera apenas VALE3, PETR4, WEGE3
- `npx tsx scripts/generate-pages.ts ITUB4 BBAS3` — Gera tickers específicos
