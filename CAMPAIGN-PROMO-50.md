# Campanha Promo 50% — Temporada de Balanços (Abr/Mai 2026)

## Resumo

Campanha de 50% off em todos os planos lancada em **27/abr/2026** com deadline em **03/mai/2026 23:59:59 BRT** (domingo).

Angulo narrativo: "Temporada de balancos do 1T26" — empresas da B3 divulgando resultados, momento natural para investidor reavaliar teses.

Toda a logica vive em `index.html` (LP). Paginas de ticker (`/{TICKER}/index.html`) **nao** foram afetadas.

## Reversao automatica (NAO precisa fazer nada na segunda-feira)

A pagina **se reverte sozinha** quando `Date.now() > DEADLINE`. JS executa `deactivatePromo()` que:

- Esconde banner topo, hero promo line, pricing-promo-box (`display:none`)
- Restaura precos originais (`.price-original` visivel, `.price-promo` oculto)
- Restaura badges, CTA labels, anual original
- Restaura `data-cta` original via `data-cta-original` (saved at activation time)
- Remove UTM `balancos-1t26` e `promo-balancos` das hrefs via `stripPromoUtm`
- Limpa `nav.style.top` e `hero.style.paddingTop` (offsets do banner)
- Para o `setInterval` do countdown

**Schema.org Product** (linhas ~1781-1816 de `index.html`) **nao** foi alterado para campanha — mantem precos originais (R$ 39,90 / 59,90 / 79,90) com `priceValidUntil: 2026-12-31`. Decisao deliberada: durante 4 dias o Schema mostra preco regular enquanto a UI mostra promo. Tradeoff: pequena inconsistencia momentanea > Schema preso com preco promo apos campanha.

## Como estender o prazo da campanha

Editar `index.html`, linha **~2571**:

```js
var DEADLINE = new Date('2026-05-03T23:59:59-03:00').getTime();
```

Trocar a data ISO. Formato: `YYYY-MM-DDTHH:MM:SS-03:00` (UTC-3 = BRT).

Tambem atualizar copy (3 lugares):
- Banner topo (linha ~1855): `Termina em ...`
- Hero promo line (linha ~1889): `... até domingo, 23:59.`
- Pricing-promo-box (linha ~2168): `Domingo, 23:59 — depois disso o preço volta ao normal`

## Como remover toda a campanha do codigo (hard revert)

A reversao automatica acima **deixa o markup dormente**. Se quiser limpar o HTML completamente:

### 1. CSS — remover bloco em `index.html` linhas ~1382-1565

Apagar tudo entre os comentarios:

```
/* === PROMO BANNER (campanha Temporada de Balanços) === */
...
.hero-promo-line { ... }
```

### 2. HTML — remover 3 blocos

**a)** Banner topo (linha ~1852-1858):
```html
<div id="promo-banner" class="promo-banner" style="display:none">
  ...
</div>
```

**b)** Hero promo line (linha ~1889):
```html
<p id="hero-promo-line" class="hero-promo-line" ...>...</p>
```

**c)** Pricing-promo-box (linha ~2162-2170):
```html
<div id="pricing-promo-box" class="pricing-promo-box" ...>
  ...
</div>
```

### 3. HTML — limpar markup dos 3 cards de pricing

Em cada um dos 3 `.pricing-card`:

- Remover `<div class="pricing-promo-badge promo-only" style="display:none">−50% até domingo</div>`
- Trocar `<div class="pricing-price"><span class="price-original">...</span><span class="price-promo" ...>...</span></div>` por apenas o conteudo do `.price-original`
- Trocar `<p class="pricing-annual"><span class="annual-original">...</span><span class="annual-promo" ...>...</span></p>` por apenas o conteudo do `.annual-original`
- Nos `<a>` dos CTAs: remover `data-promo="1"` e trocar `<span class="cta-label-original">X</span><span class="cta-label-promo" ...>Y</span>` por apenas `X`

### 4. HTML — remover `data-promo="1"` dos CTAs nav e hero

- Nav (linha ~1869): `data-cta="nav-comecar" data-promo="1"` → `data-cta="nav-comecar"`
- Hero (linha ~1886): `data-cta="hero" data-promo="1"` → `data-cta="hero"`

### 5. JS — remover bloco em `index.html` linhas ~2568-2701

Apagar tudo entre:

```html
<!-- Campanha Temporada de Balanços: 50% off até 2026-05-03 23:59 BRT -->
<script>
(function(){
  var DEADLINE = ...;
  ...
})();
</script>
```

### 6. Validar

```bash
npm run dev
# abrir http://localhost:3000 e confirmar nada de campanha aparece
```

## Inventario de mudancas (rastreabilidade)

| Camada | Onde | Marcador |
|---|---|---|
| CSS | `index.html` linhas ~1382-1565 | classes com prefixo `.promo-`, `.pricing-promo-`, `.price-`, `.annual-promo`, `.cta-label-`, `.hero-promo-line`, keyframes `promoPulse` e `promoPulseGlow` |
| HTML banner topo | `index.html` linha ~1852 | `<div id="promo-banner">` |
| HTML hero | `index.html` linha ~1889 | `<p id="hero-promo-line">` |
| HTML pricing box | `index.html` linha ~2162 | `<div id="pricing-promo-box">` |
| HTML pricing cards | `index.html` linhas ~2173-2235 | spans `.price-original/.price-promo`, `.annual-original/.annual-promo`, `.cta-label-original/.cta-label-promo`, badges `.pricing-promo-badge.promo-only` |
| HTML atributos CTA | `index.html` varios | `data-promo="1"` em CTAs marcados (nav, hero, 3 pricing) |
| JS | `index.html` linhas ~2568-2701 | IIFE com `DEADLINE`, `CAMPAIGN_ID`, `activatePromo`, `deactivatePromo`, `tick` |

## Tracking

Durante a campanha:
- CTAs com `data-promo="1"` recebem sufixo `-promo50` no `data-cta` em runtime via JS
- Hrefs ganham `&utm_campaign=balancos-1t26&utm_medium=promo-balancos`
- `cta_id` no Supabase fica granular: `preco-ialocador-promo50`, `hero-promo50`, `nav-comecar-promo50`, `promo-banner-promo50`, etc.

Apos a campanha (auto), o sufixo e os UTMs sao removidos pelo `deactivatePromo`. Atribuicao zumbi prevenida.

## Queries de analise pos-campanha

Cliques totais da campanha:
```sql
SELECT COUNT(*) FROM iacoes_page_views_human
WHERE event_type = 'cta_click' AND cta_id LIKE '%-promo50';
```

Cliques por plano:
```sql
SELECT cta_id, COUNT(*) FROM iacoes_page_views_human
WHERE event_type = 'cta_click' AND cta_id LIKE '%-promo50'
GROUP BY cta_id ORDER BY COUNT(*) DESC;
```

Pageviews durante janela da campanha (sem flag direta — usar data):
```sql
SELECT DATE(created_at), COUNT(*) FROM iacoes_page_views_human
WHERE event_type = 'pageview'
  AND created_at BETWEEN '2026-04-27' AND '2026-05-04'
GROUP BY DATE(created_at);
```

Conversoes finais (via `app.brasilhorizonte.com.br`): cruzar com `utm_campaign = 'balancos-1t26'` no GA4 do app.
