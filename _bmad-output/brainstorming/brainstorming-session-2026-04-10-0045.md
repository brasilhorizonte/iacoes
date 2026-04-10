---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'Redesign ticker pages para maximizar conversao sem perder SEO'
session_goals: 'CTAs mais altos, hooks de conversao visiveis cedo, nota qualitativa com destaque, card de features, manter SEO'
selected_approach: 'ai-recommended'
techniques_used: ['Role Playing', 'SCAMPER Method', 'Reverse Brainstorming']
ideas_generated: ['hook-valuation-cedo', 'provocacao-dcf', 'social-proof-validador', 'card-markowitz', 'micro-cta-anchor', 'metricas-tabs', 'card-features', 'teaser-nota-inline', 'sliders-limitados', 'lead-magnet-financeiras', 'disclaimer-pro-footer', 'nova-ordem-secoes', 'diferenciador-explicito', 'timestamp-urgencia']
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Gabriel
**Date:** 2026-04-10

## Session Overview

**Topic:** Redesign das ticker pages do iAcoes para maximizar conversao sem comprometer SEO
**Goals:** CTAs contextuais mais altos na pagina, hooks de valuation/validador de teses, nota qualitativa em destaque, card de features da plataforma, manter 100% do valor SEO

### Session Setup

Gabriel identificou que as ticker pages tem conversao pior que a landing page. O usuario ve dados (metricas, indicadores) e sai satisfeito sem converter. Os CTAs estao muito abaixo, a nota qualitativa (paywall) nao gera FOMO suficiente, e nao ha showcase das funcionalidades da plataforma.

## Technique Selection

**Approach:** AI-Recommended Techniques

- **Role Playing:** Encarnar 3 personas de visitantes para mapear onde cada uma perde interesse
- **SCAMPER Method:** Aplicar 7 lentes criativas em cada secao da pagina atual
- **Reverse Brainstorming:** Perguntar "como garantir que ninguem converta?" para revelar anti-padroes

## Technique Execution Results

### Role Playing — Mapa de Abandono por Persona

| Persona | Busca no Google | Para em | Ve CTAs? | Por que sai |
|---------|----------------|---------|----------|-------------|
| Pesquisador | "PETR4 cara ou barata" | Secao 7 (Rentabilidade) | Nao | Ja teve resposta |
| Validador | "BBDC4 preco justo" | Secao 9 (Cards valuation) | Parcialmente | Validou tese de graca |
| Usuario BH | "VALE3 indicadores" | Varia | Sim | Ja cadastrado, precisa outro gancho |

**Insights-chave:**
- Zero aha moments antes da secao 7 — descida linear de dados sem inflexao emocional
- Os dados sao entregues sem atrito — satisfazem sem converter
- Hook tem que ser "faca voce mesmo" (ownership), nao "nos calculamos"
- DCF eh o upsell natural dos 3 metodos gratuitos
- Para usuario existente, gancho eh portfolio (Markowitz), nao re-login

### SCAMPER Method — Ideias por Lente

**S — Substituir:**
- ~~#5 Veredicto visual no hero~~ (descartada — muito agressivo)
- #7 Metricas em tabs (compactar secoes 5-8 num unico bloco com abas)

**C — Combinar:**
- #8 Valuation + Nota Qualitativa num bloco coeso (descartada em favor de #10 inline)
- #9 Card grande de features: DCF, Nota Qualitativa, Otimizador Markowitz, Radar de Oportunidades (Screening), Feed Documentos CVM

**A — Adaptar:**
- #10 Teaser nota qualitativa inline (padrao freemium SaaS — blur dentro das tabs de metricas)

**M — Modificar:**
- #11 Sliders limitados nos cards gratuitos (premissas base fixas, customizacao na plataforma)

**P — Put to other uses:**
- #12 Demonstracoes financeiras como lead magnet (download planilha com captura email)

**E — Eliminar:**
- #13 Disclaimer sai do meio da pagina, vai pro footer

**R — Reverter/Reorganizar:**
- #14 Nova ordem completa das secoes (ver abaixo)

### Reverse Brainstorming — Anti-padroes Identificados

| Anti-padrao | Status |
|-------------|--------|
| Entregar tudo de graca | Corrigido: #11 sliders limitados |
| CTA onde ninguem chega | Corrigido: #6 micro-CTA hero + #14 nova ordem |
| Nao mostrar o que a plataforma faz | Corrigido: #9 card de features |
| Tratar todo visitante igual | Corrigido: #2 DCF + #3 validador + #4 Markowitz |
| Parecer generico | Corrigido: #16 diferenciador explicito |
| Nenhuma urgencia | Corrigido: #17 timestamp atualizacao |

## Ideias Aprovadas (14 ideias — revisadas pelo time BMAD)

| # | Ideia | Descricao | Ajuste Party Mode |
|---|-------|-----------|-------------------|
| 1 | Hook de valuation cedo | Apos metricas: "Calcule o preco justo com suas premissas" | Fundido com #7 — hook vira heading dos cards |
| 2 | Provocacao "E o DCF?" | Apos cards gratuitos, posiciona DCF como proximo nivel | Card DCF trancado (4o card) com premissas avancadas listadas (beta, custo capital, crescimento por fase) |
| 3 | Social proof + Validador | "Valide sua tese — compare com outros investidores na plataforma" | Sobe para logo apos os cards de valuation |
| 4 | Card Markowitz | "Tem esse ativo na carteira? Confira se esta balanceada" | Mantido |
| 6 | Micro-CTA anchor hero | Botao no hero que faz scroll suave ate valuation | Mantido |
| 7 | Metricas em tabs | Compacta 4 secoes de metricas em tabs, default Valuation | CSS-only (radio inputs) para preservar SEO |
| 9 | Card de features | DCF, Nota, Markowitz, Screening, CVM — com CTA | Visual distinto: fundo escuro, full-width, icones |
| 10 | Teaser nota inline | Nota qualitativa borrada dentro das tabs de metricas | Fundo premium (dourado 10% opacity), icone cadeado, microcopy |
| 11 | Sliders abertos + DCF trancado | 3 metodos com sliders funcionais + 4o card DCF com premissas avancadas borradas | Ajustado: nao limitar sliders, upsell via card DCF |
| 12 | Lead magnet financeiras | Download planilha com captura de email | Prioridade alta (power users) |
| 13 | Disclaimer pro footer | Remove atrito entre valuation e nota qualitativa | Mantido |
| 14 | Nova ordem das secoes | Reorganizacao completa baseada no mapa de abandono | Atualizada com ajustes do party mode |
| 16 | Diferenciador explicito | Frase de posicionamento vs agregadores de dados | Mantido |
| 17 | Timestamp urgencia | "Atualizado em DD/MMM 20h. Proxima: hoje 20h" | Mantido |

**Descartadas:** #5 (veredicto visual hero), #8 (combinar valuation+nota — substituida por #10), #15 (screenshot plataforma)

## Nova Estrutura Proposta (pos-revisao Party Mode)

```
1.  Nav
2.  Hero (preco + variacao + micro-CTA "Fazer meu Valuation ↓")
3.  Intro SEO (texto — mantem para metricas de SEO)
4.  Diferenciador explicito (1 frase de posicionamento)
5.  Metricas em tabs CSS-only (Mercado | Valuation | Rentabilidade | Endividamento)
    └─ Inline: teaser nota qualitativa borrada (fundo premium, cadeado) + timestamp
6.  Cards valuation: heading persuasivo + Graham, Bazin, Gordon (sliders abertos)
    + 4o card DCF trancado (blur + premissas avancadas listadas: beta, custo capital, crescimento por fase)
7.  Social proof + Validador de teses
8.  Card de features (fundo escuro, full-width, icones): DCF, Nota, Markowitz, Screening, CVM
9.  Nota qualitativa (blur + barras + CTA desbloquear)
10. Card "Esse ativo na sua carteira" (Markowitz)
11. Demonstracoes financeiras (com lead magnet download planilha)
12. FAQ (Schema.org — mantem)
13. CTA final
14. Disclaimer + Footer
```

### Mudancas vs Estrutura Atual

| Atual | Nova | Mudanca |
|-------|------|---------|
| Hero neutro (so preco) | Hero com micro-CTA anchor | +engagement |
| 4 secoes de metricas separadas | 1 bloco com tabs CSS-only | -scroll, +densidade, SEO preservado |
| Nota qualitativa na secao 11 | Teaser inline premium + secao dedicada na 9 | +visibilidade |
| Disclaimer entre valuation e nota | Disclaimer no footer | -atrito |
| CTA unico no final | 7+ touchpoints de conversao | +conversao |
| Nenhuma feature showcase | Card full-width fundo escuro | +clareza de valor |
| 3 cards valuation abertos | 3 abertos + 4o DCF trancado com premissas avancadas | +razao pra converter, mantem engajamento |
| Sem diferenciador | Frase de posicionamento | +unicidade |
| Sem urgencia | Timestamp atualizacao | +urgencia sutil |
| Social proof no fundo | Social proof logo apos valuation | +visibilidade |
| Sem lead magnet | Download planilha financeiras | +captura email |

### Notas de Implementacao (Party Mode)

**SEO:**
- Tabs CSS-only com radio inputs — HTML completo no DOM, SEO preservado
- Schema.org FAQPage mantem (JSON-LD no head, independe de posicao)
- Considerar adicionar SoftwareApplication schema para card de features
- Sitemap dateModified atualiza automaticamente — sinaliza recrawl
- Monitorar GSC nas 2 semanas pos-deploy (impressoes, cliques, posicao, CWV)

**Tracking:**
- Atualizar Intersection Observers (scroll depth) para novas posicoes de secao
- Usar cta_id existente como baseline de comparacao pre/pos redesign
- Novos cta_ids: dcf-locked, social-proof, markowitz, lead-magnet, features-card

**Risco mitigado:**
- Sliders nao foram limitados (mantem engajamento e tempo na pagina)
- Conteudo SEO intacto (intro, FAQ, financeiras, Schema.org)
- Card de features visualmente distinto para nao competir com cards de valuation
