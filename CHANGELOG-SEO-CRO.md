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

## Próximos Passos (Fase 2+)

Documentados em `pipeline-seo-cro-iacoes.md` (pasta Marketing BH):

- [ ] Solicitar indexação manual das top 10 páginas no Google Search Console
- [ ] Criar imagem OG 1200×630 (atual é 300×300)
- [ ] Diversificar copy dos CTAs (5 dos 7 dizem "Testar grátis")
- [ ] Adicionar scroll depth tracking (Intersection Observer)
- [ ] Criar páginas por setor (`/acoes/energia/`, `/acoes/bancos/`)
- [ ] Escrever 10 artigos cornerstone (`/aprenda/` ou `/guias/`)
- [ ] Implementar lead magnet "Alerta de Preço Justo" por email
- [ ] Mostrar dados reais na Nota Qualitativa (trocar "?.??")
- [ ] GitHub Actions para regeneração diária
- [ ] Implementar lastmod dinâmico no sitemap
