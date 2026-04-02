# Changelog SEO & CRO — iacoes.com.br

**Data:** 30 de março de 2026
**Sessão:** Fase 1 — Quick Wins de indexação e estrutura

---

## Contexto

Diagnóstico revelou que das 310 ticker pages geradas, apenas 1 (VALE3) estava indexada no Google. CTR dos CTAs era 5.2% com bounce rate de 88.7%. Todo o tráfego (252 pageviews em ~4 semanas) ia para a landing page `/`, sem nenhuma visita orgânica nas ticker pages.

## Mudanças Implementadas

### 1. Scripts de tracking movidos para final do `<head>` (template.ts + index.html)

**Problema:** GA4 e o tracking Supabase (`_iaTrack`) estavam como as primeiras tags dentro do `<head>`, antes de `<title>`, `<meta description>`, `<canonical>` e Schema.org. Isso atrasava o parsing do crawler — o Google lia 30 linhas de JavaScript antes de encontrar qualquer meta tag.

**Solução:** Movidos os scripts para logo antes do `</head>`, após todas as meta tags, Open Graph, Twitter Card, Schema.org e `<style>`.

**Arquivos alterados:**
- `scripts/template.ts` — afeta todas as ticker pages geradas
- `index.html` — landing page

### 2. Seção de análise textual introdutória nas ticker pages (template.ts)

**Problema:** As ticker pages tinham ~10-15% de conteúdo textual (prosa). O resto eram números, tabelas e CSS inline. O Google pode considerar isso "thin content" e optar por não indexar.

**Solução:** Nova `<section class="intro-analysis">` adicionada entre o header da empresa e as métricas. Gera automaticamente 3 parágrafos por ticker com:
- Nome da empresa, tipo (PN/ON), setor, subsetor
- Preço atual e valor de mercado
- Preços justos por Graham, Bazin e Gordon
- Veredicto de upside/downside com badge visual colorido
- Múltiplos (P/L, EV/EBITDA), dividend yield, ROE, margem líquida
- Call-to-action textual para scroll

Adiciona ~150 palavras de prosa indexável por página. CSS incluído (`.intro-analysis`, `.intro-verdict-up/down/neutral`).

**Variáveis TypeScript adicionadas:**
- `introVerdict`, `introVerdictClass`, `introVerdictLabel`
- `dyText`, `roeText`, `marginText`, `plText`, `evEbitdaText`

### 3. Seção "Análises em destaque" na landing page (index.html)

**Problema:** Os links para ticker pages estavam apenas no final da landing page (seção "Ações analisadas" antes do footer). O crawler precisa de muitos scrolls para encontrá-los, e a profundidade de crawl era de 3 cliques (landing → /acoes/ → /TICKER/).

**Solução:** Nova seção `<section class="quick-links">` adicionada logo após a stats-bar, antes da seção de módulos. Contém 15 links diretos para os tickers mais relevantes:
- PETR4, VALE3, ITUB4, BBAS3, WEGE3, B3SA3, ABEV3, BBDC4, RENT3, SUZB3, JBSS3, PRIO3, EGIE3, TAEE11, EQTL3
- Link para `/acoes/` ("Ver todas as 310+ ações analisadas")

Todos os links são HTML puro (sem JavaScript), crawláveis, e reduzem a profundidade de 3 para 1 clique.

CSS incluído (`.quick-links`, `.quick-link`, `.quick-link-name`, `.quick-links-all`).

### 4. Ping automático de sitemap no build (generate-pages.ts)

**Problema:** Após regenerar as páginas, o Google não era notificado. Dependia do crawl natural, que para sites novos pode levar semanas.

**Solução:** Ao final do `main()`, o script agora faz `fetch()` para:
- `https://www.google.com/ping?sitemap=https://iacoes.com.br/sitemap.xml`
- `https://www.bing.com/ping?sitemap=https://iacoes.com.br/sitemap.xml`

Loga o status de cada ping. Não bloqueia em caso de falha.

---

---

**Data:** 30 de março de 2026
**Sessão:** Fase 1 — Quick Wins de CRO e Analytics

---

### 5. Diversificação de copy dos CTAs na landing page (index.html)

**Problema:** 5 dos 7 CTAs na landing page usavam o mesmo texto "Testar grátis". Sem variação de copy, o visitante via o mesmo botão repetido sem motivação nova — diminuindo CTR progressivamente na página.

**Solução:** Cada CTA agora tem copy orientado a benefício, adequado ao contexto da seção:

| Posição | Antes | Depois |
|---------|-------|--------|
| Nav (topo) | Testar grátis | Começar grátis |
| Hero | Testar grátis → | Descobrir ações baratas → |
| Metodologia | Montar meu Valuation → | (mantido — já diferenciado) |
| Preço IAnalista | Testar grátis | Começar com IAnalista |
| Preço IAlocador | Testar grátis | Começar com IAlocador |
| Preço Fundamentalista | Testar grátis → | Acesso completo → |
| CTA Final | Testar grátis → | Criar conta grátis em 30s → |

**Arquivo alterado:** `index.html`

### 6. Scroll depth tracking com Intersection Observer

**Problema:** Sem dados de scroll, não sabíamos onde os visitantes abandonavam a página. Impossível otimizar layout ou posicionamento de CTAs.

**Solução:** Script de Intersection Observer adicionado antes do `</body>` em 3 tipos de página. Dispara eventos `scroll_25`, `scroll_50`, `scroll_75`, `scroll_100` para `_iaTrack()` (Supabase) uma única vez por sessão. Fallback silencioso em browsers sem suporte a IntersectionObserver.

**Landing page (`index.html`):**
- scroll_25 → `#modulos`
- scroll_50 → `#metodologia`
- scroll_75 → `#precos`
- scroll_100 → `#sobre`

**Ticker pages (`template.ts`):**
- scroll_25 → `.methods-section` (métodos de valuation)
- scroll_50 → `.nota-section` (nota qualitativa / paywall)
- scroll_75 → `[aria-label="Demonstrações Financeiras"]`
- scroll_100 → `.faq-section`

**Página /acoes/ (`template.ts`):**
- scroll_50 → `.idx-card` (tabela de ações)
- scroll_100 → `.footer-disc` (footer)

**Arquivos alterados:** `index.html`, `scripts/template.ts`

### 7. Redução da hero + stats bar na primeira dobra (index.html)

**Problema:** A hero ocupava 100vh (tela inteira). O visitante precisava scrollar para ver qualquer dado real. A stats bar (300+, 3, 24/7, 0) ficava abaixo da dobra.

**Solução:** Hero reduzida (removido `min-height: 100vh`), stats bar movida para dentro da seção hero com `border-top` como separador visual. Agora o visitante vê os números de impacto (300+ ações, 3 metodologias, 24/7, 0 conflitos) sem precisar scrollar.

**Arquivo alterado:** `index.html`

### 8. GitHub Actions para regeneração diária (generate-pages.yml)

**Problema:** As páginas de ticker ficavam desatualizadas — dependiam de execução manual.

**Solução:** Workflow `.github/workflows/generate-pages.yml` criado:
- Cron diário às 23:00 UTC (20:00 BRT, após fechamento da B3)
- Executa apenas dias úteis (seg-sex)
- Usa secrets `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- Commit automático se houver mudanças
- Permite execução manual via `workflow_dispatch`

**Arquivo criado:** `.github/workflows/generate-pages.yml`

### 9. Preço em tempo real nas ticker pages (template.ts)

**Problema:** O preço exibido era estático (do momento do build). Durante o pregão, ficava desatualizado.

**Solução:** Script adicionado antes do `</body>` que faz `fetch` na tabela `brapi_quotes` do Supabase ao carregar a página, usando a mesma anon key já embarcada para tracking. Atualiza dinamicamente: preço atual, variação do dia (com cor), e timestamp ("Atualizado em DD/MM/AAAA HH:MM"). Os dados de valuation (preço justo, métricas históricas) permanecem estáticos.

**Arquivo alterado:** `scripts/template.ts`

### 10. Nota qualitativa com barras reais + números ocultos (template.ts + supabase.ts + types.ts)

**Problema:** A nota qualitativa mostrava placeholders estáticos ("?.??") com barras de largura fixa. Não gerava FOMO porque o blur cobria "nada".

**Solução:** Os dados reais são buscados da tabela `Qualitativo` no Supabase em build time. As barras de progresso usam larguras reais (`score / 4 * 100%`) com cores semânticas (verde ≥3, dourado ≥2, vermelho <2). Os números exatos permanecem ocultos ("?.?") para não entregar o dado sem conversão. O overlay convida a desbloquear.

Também criada RLS policy `allow_anon_read_system_scores` na tabela `Qualitativo` para permitir leitura anon de scores do sistema (`user_id IS NULL`).

**Arquivos alterados:** `scripts/template.ts`, `scripts/supabase.ts`, `scripts/types.ts`

### 11. Remoção de preços justos explícitos no texto introdutório (template.ts)

**Problema:** O parágrafo de intro analysis revelava os preços justos exatos por Graham, Bazin e Gordon, eliminando o incentivo de conversão.

**Solução:** Parágrafo substituído por texto que menciona os 3 métodos sem revelar valores, convidando o visitante a conferir os resultados abaixo com premissas ajustáveis.

**Arquivo alterado:** `scripts/template.ts`

### 12. CTA de valuation atualizado (template.ts)

**Problema:** CTA "Calcular preço justo de PETR4 →" muito descritivo.

**Solução:** Trocado para "Fazer Seu Valuation Completo →".

**Arquivo alterado:** `scripts/template.ts`

---

---

**Data:** 30 de março de 2026
**Sessão:** SEO — Redirect case-insensitive (lowercase → uppercase)

---

### 13. Redirect case-insensitive para URLs de ticker (template.ts + generate-pages.ts)

**Problema:** O Google não reconhecia URLs minúsculas (ex: `/petr4/`). O `404.html` usava JavaScript para redirecionar, mas o Googlebot vê isso como HTTP 404 (não executa JS do meta refresh do 404.html). Resultado: qualquer link externo apontando para `/petr4/` gerava erro de crawl no Google Search Console.

**Solução:** Nova função `generateLowercaseRedirect(ticker)` em `template.ts` gera uma página HTML mínima em cada path lowercase:
- `<link rel="canonical">` apontando para a versão uppercase
- `<meta http-equiv="refresh" content="0; url=...">` para redirect instantâneo sem JS
- `<meta name="robots" content="noindex, follow">` para não indexar a versão lowercase
- Link `<a>` como fallback para crawlers/screen readers

Em `generate-pages.ts`:
- Cada ticker gera também `/{ticker_lowercase}/index.html` com o redirect
- Filtro no sitemap exclui diretórios lowercase (`d !== d.toUpperCase()`)

**Arquivos alterados:** `scripts/template.ts`, `scripts/generate-pages.ts`

---

## Próximos Passos

Documentados em `pipeline-seo-cro-iacoes.md` (pasta Marketing BH):

**Concluídos em 30/03/2026:**
- [x] Diversificar copy dos CTAs (7 variações contextuais)
- [x] Scroll depth tracking (Intersection Observer, 3 tipos de página)
- [x] Nota Qualitativa com barras reais do Supabase
- [x] GitHub Actions para regeneração diária
- [x] Preço em tempo real nas ticker pages
- [x] Reduzir hero, mostrar valor imediato
- [x] Submissão do sitemap no GSC + indexação manual top 10
- [x] 20 páginas por setor geradas
- [x] Lead collector "Histórico de Dividendos" (captura nome + email)
- [x] Tabelas financeiras transpostas
- [x] SEO de dividendos (title, keywords, FAQ com dados reais)
- [x] FAQ expandida com Schema.org FAQPage por setor
- [x] Fotos dos sócios + Spotify podcast
- [x] Cache qualitativo local

**Pendentes:**
- [ ] Criar imagem OG 1200×630 (atual é 300×300)
- [ ] 10 artigos cornerstone (`/aprenda/` ou `/guias/`)
- [ ] Páginas de comparação (`/PETR4-vs-VALE3/`, top 50 pares)
- [ ] Email nurturing sequence (5 emails via Brevo)
- [ ] lastmod dinâmico no sitemap
- [ ] Social proof quantitativo na landing
- [ ] Tracking de interação com sliders
- [ ] UTM tracking padronizado nos CTAs sociais
