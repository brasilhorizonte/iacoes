# HANDOFF — Reforma de oferta e tracking (ago/2026)

Contrato de execução entre as sessões S1…S6. **Cada sessão lê este arquivo antes de
começar e acrescenta seu bloco em "Registro de handoffs" ao terminar.**

Origem: diagnóstico de conversão de 29/ago/2026 (artifact `0965453c`). Decisões de
oferta fechadas em party mode BMAD (John/PM, Mary/Analyst, Sally/UX, Saga, Winston).

---

## 0. Regra de ouro: dono exclusivo de arquivo

Os Ps do relatório cruzam os mesmos arquivos. A divisão de trabalho é **por arquivo**,
nunca por P. Nenhuma sessão edita arquivo de outra.

| Arquivo | Dono | Ps cobertos |
|---|---|---|
| Supabase (DDL) | S1 | P1 |
| bloco `<script>` de tracking em `scripts/template.ts`, `index.html`, `airton/index.html` | S2 | P1 |
| resto de `scripts/template.ts` | S3 | P2, P3, P4, P7 |
| resto de `index.html` e `airton/index.html` | S4 | P5, P6 |
| `CLAUDE.md` | S6 | P9 |

S2 e S3 tocam o mesmo arquivo em regiões diferentes: **S3 só começa depois de S2 commitar.**

---

## 1. Decisões de oferta (fechadas — não reabrir)

### 1.1 A oferta de ticker tem três temperaturas

O visitante de ticker chegou do Google com **uma ação e uma decisão** na cabeça.
Toda oferta de carteira/portfólio é fora de contexto e deve sair.

| Temp. | Oferta | Onde | `data-cta` |
|---|---|---|---|
| Frio | **Alerta de CVM sobre o ticker** — "Receba tudo que a CVM publicar sobre {TICKER} no WhatsApp" | bloco novo, substitui o lead magnet de CSV | `alerta-cvm` |
| Morno | **Auditoria de tese pelo AIrton** — com perguntas prontas | card social-proof reescrito | `airton-audit` |
| Quente | **DCF completo** | card DCF, mantido como está | `dcf-locked` |

Racional: `dcf-locked` (63 cliques/90d) e `social-proof` (57) são os únicos CTAs de
ticker que convertem, e ambos prometem *auditar uma tese*. `markowitz` (11) e
`nota-qualitativa` (7) falam de carteira e morrem.

### 1.2 O alerta é a nova porta de entrada (P4)

O lead magnet de CSV capturou **0 leads desde sempre** (`iacoes_email_leads` vazia).
Substituição decidida: **não capturar email no iAcoes**. O CTA leva direto ao app
(`/authnew`) já com o ticker no contexto, e a configuração do alerta acontece **dentro
da plataforma**.

**Correção do Gabriel (31/ago), incorporada:** o usuário vai ter que se cadastrar na
plataforma de qualquer jeito. A vantagem do alerta **não é menos fricção** — o degrau de
cadastro é o mesmo do DCF e da auditoria. A vantagem é a **promessa**: alerta é a única
coisa do produto que entrega valor antes de o visitante confiar no nosso valuation.
Valuation ele questiona (é o número dele contra o nosso); "te aviso quando a {TICKER}
publicar Fato Relevante" não tem o que questionar. Ganho operacional real: some a tabela
intermediária e o RLS que já quebrou uma vez.

Consequência para a copy: **não prometer "sem cadastro"** em lugar nenhum. Prometer
"grátis, sem cartão", que é verdade.

Destino canônico:
`https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker={TICKER}&intent=alerta`

### 1.3 Canal: WhatsApp first (P6)

WhatsApp é o canal **primário** em toda copy pública. Telegram é mencionado como
alternativa, sempre em segundo lugar e em texto menor. Nunca uma página vende só
Telegram.

- `index.html`: a seção hoje intitulada "AIrton no Telegram" vira **"AIrton no WhatsApp"**,
  com uma linha "também disponível no Telegram".
- `airton/index.html`: já é WhatsApp-first. Manter, só alinhar a linha do Telegram.
- `scripts/template.ts`: o bloco de alerta cita WhatsApp.

### 1.4 Card de features de ticker (P3)

Fora: **Otimizador Markowitz**, **Radar de Oportunidades** (ofertas de carteira).
Dentro: **AIrton**, **Alertas CVM em tempo real**, **Minhas Teses**.
Mantidos: **DCF Completo**, **Nota Qualitativa**, **Documentos CVM**.

### 1.5 Copy canônica (usar literalmente, com escape HTML onde o arquivo exigir)

- Alerta, título: `Fique sabendo antes do mercado`
- Alerta, sub: `Receba no WhatsApp cada Fato Relevante, ITR, DFP e anúncio de proventos de {TICKER} no instante em que sai na CVM — com o resumo do AIrton pronto.`
- Alerta, botão: `Ativar alertas de {TICKER} →`
- Alerta, rodapé: `Grátis, sem cartão. Também disponível no Telegram.`
- Auditoria, headline: `Leu um relatório sobre {TICKER}? Pergunte ao AIrton.`
- Auditoria, sub: `O AIrton cruza a tese com os números reais de {TICKER} — governança, vantagem competitiva, endividamento e riscos — e diz onde ela não se sustenta.`
- Auditoria, perguntas prontas (3, clicáveis, todas levam ao app com o prompt):
  1. `Minha tese em {TICKER} se sustenta?`
  2. `Resume o último Fato Relevante de {TICKER}`
  3. `Compara {TICKER} com os pares do setor`
- Auditoria, botão: `Auditar {TICKER} grátis →`

**Manter** a linha de social proof existente (`N investidores já validaram teses em {TICKER}`)
— é o único elemento de prova social do site.

### 1.6 Bloco de apresentação do AIrton nas ticker pages (P3 — adicionado 31/ago)

**Decisão do Gabriel:** o AIrton precisa ser *anunciado* nas páginas de ticker, não só
usado como verbo num CTA. Hoje `scripts/template.ts` tem zero menções a ele, enquanto a
landing dedica duas seções inteiras — 72% do tráfego nunca ouve falar do principal
diferencial do produto.

Isso é um bloco **a mais**, distinto do card de auditoria de 1.1/1.5. A auditoria é um
pedido de ação; este é apresentação de produto. Posição: depois do card de valuation e
antes das demonstrações financeiras — o leitor já viu o número e está no ponto de
perguntar "e agora?".

Estrutura (espelhar o padrão visual que a seção AIrton do `index.html` já usa, adaptado
ao contexto de ticker único; reaproveitar tokens de cor do template de ticker, não
importar o design system da landing):

- Eyebrow: `Assistente IA`
- Título: `Conheça o AIrton, seu copiloto para {TICKER}`
- Sub: `Ele conhece sua carteira, valida suas teses contra os fundamentos reais e resume os documentos da CVM — no app e no seu WhatsApp.`
- Demonstração: uma bolha de conversa com pergunta e resposta **usando dados reais do
  ticker que já estão no escopo do template** (preço justo, ROE, margem de segurança).
  Nunca inventar número: se o dado não existir para aquele ticker, omitir a frase que o
  citaria. Marcar visualmente como exemplo.
- Três capacidades, uma linha cada: `Acessa sua carteira` · `Valida suas teses` ·
  `Resume a CVM em segundos`
- Botão: `Conversar com o AIrton sobre {TICKER} →`
- `data-cta`: `airton-intro`
- Destino: `https://app.brasilhorizonte.com.br/authnew?ref=iacoes&ticker={TICKER}&intent=airton`

Isso eleva o AIrton a **três** superfícies na página de ticker: apresentação (1.6),
auditoria (1.1 morno) e card de features (1.4). É deliberado — é o produto.

---

## 2. Schema de eventos (P1)

### 2.1 Colunas novas em `iacoes_page_views` (S1)

| Coluna | Tipo | Semântica |
|---|---|---|
| `is_bot` | `boolean` default `false` | Sinais **duros** de automação apenas. Ver 2.2. |
| `interacted` | `boolean` default `false` | Houve input humano (pointer/teclado/touch/wheel) **antes** deste evento. |

Nada de heurística por `screen.width`: 412px é largura legítima de Pixel/Android e
flagá-la mataria usuários reais. O discriminador é `interacted` — bots disparam
`scroll_100` sem nunca gerar input.

### 2.2 Sinais duros que marcam `is_bot = true`

1. `navigator.webdriver === true`
2. UA casa `/bot|crawl|spider|headless|preview|lighthouse|gptbot|claudebot|perplexity|bingpreview/i`
3. `navigator.languages` vazio ou ausente

### 2.3 Definição de sessão humana (S1 entrega como view)

```
sessão humana = NOT is_bot
                AND (a sessão gerou algum evento com interacted = true
                     OR a sessão gerou um cta_click)
```

Baseline medido antes da mudança, para comparação: CTR de ticker com referrer
= **8,12%**; sem referrer = **0,87%**.

---

## 3. Definition of done por sessão

**S1 — Dados.** Colunas criadas; view de sessões humanas criada; query de baseline
rodada e o resultado registrado abaixo. Não toca em arquivo do repo.

**S2 — Tracking.** `_iaTrack` envia `is_bot` e `interacted` nos **4** locais:
`scripts/template.ts` (2 cópias — ticker ~L1429 e /acoes ~L2222), `index.html`,
`airton/index.html`. Snippets idênticos entre si. Atenção ao escaping: dentro de
template literal em `template.ts`, `\\/` produz `\/`; ver `validate-html.ts` regra
`regex-escaping`. Confirmar com uma linha real gravada em produção.

**S3 — Ticker.** P2: bloco `fbevents` do `index.html` copiado para os dois `<head>`
de `template.ts`, e o `catch(_le){}` do `_iaClick` vira `console.warn`. P3: cards de
auditoria e features reescritos por 1.4/1.5, **mais o bloco de apresentação do AIrton de
1.6**. P4: lead magnet de CSV e `_iaLeadSubmit`/`lead_financeiras` removidos, bloco de
alerta no lugar. P7: CTA fixo mobile igual ao de `airton/index.html`.

**S4 — Landing.** P6 nas duas páginas. P5: landing reestruturada conforme o Bloco E do
relatório — **atrás de teste, ver risco em 4**.

**S5 — QA.** `npm run generate` verde, `npm test` (7 regras) verde,
`grep -ci "markowitz\|radar de oport" scripts/template.ts` = 0,
`grep -c fbevents scripts/template.ts` = 2, `grep -ci airton scripts/template.ts` > 0,
nenhuma referência a `iacoes_email_leads` sobrando, e nenhuma promessa de "sem cadastro"
em nenhuma página.

**S6 — Docs.** `CLAUDE.md` atualizado: AIrton, alertas, WhatsApp, `/airton/`, Pixel,
novo mapa de `data-cta`, colunas `is_bot`/`interacted`, e remoção do lead magnet de CSV.

---

## 4. Risco declarado

A landing acabou de fazer **40,7%** de CTR em agosto, melhor mês da série. Reescrevê-la
inteira sem medir é apostar contra um número que sobe. **S4 entrega a nova landing atrás
de um teste 50/50 por duas semanas**, não como substituição direta. As demais sessões não
têm esse risco e vão direto para `main`.

---

## 5. Registro de handoffs

> Cada sessão acrescenta aqui: o que mudou, o que a próxima precisa saber, e o que
> ficou de fora. Sem isso a cadeia quebra.

### S0 — Contrato · concluída · 31/ago/2026
Decisões de 1.1 a 1.5 fechadas em party mode. Schema de 2.1/2.2 definido com sinais
duros + `interacted`, descartando a heurística por `screen.width` do relatório original
por risco de falso positivo em Android. Destino de alerta aponta para o app, sem captura
de email intermediária (decisão do Gabriel: "levar o cara para receber as notificações do
ativo dele dentro da plataforma"). Canal: WhatsApp first.
**Para S1:** criar as colunas e a view; não mexer em repo.

### S1 — Dados · concluída · 31/ago/2026

**DDL aplicado** (projeto Supabase `dawvgbopyemcayavcatd`, duas migrations puramente aditivas):

1. `iacoes_page_views_add_is_bot_interacted`
   ```sql
   alter table public.iacoes_page_views
     add column if not exists is_bot boolean not null default false,
     add column if not exists interacted boolean not null default false;
   ```
   Nomes exatos das colunas: **`is_bot`**, **`interacted`**. Ambas `boolean not null default false`.
   Nenhum DROP, nenhuma coluna existente alterada, nenhum dado apagado.

2. `iacoes_human_sessions_view` — cria a view **`public.iacoes_human_sessions`**
   com `security_invoker = true` (mesmo padrão de `iacoes_page_views_human`,
   `iacoes_sessions_enriched`, `v_brapi_dashboard`). Uma linha por `session_id`.
   Colunas: `session_id`, `first_seen`, `last_seen`, `page_path` (primeira página vista,
   por `created_at, id`), `pageviews`, `cta_clicks`, `is_bot`, `interacted`, `clicked`,
   `has_referrer`, `is_human`.
   Regra de 2.3 materializada como:
   `is_human = (not bool_or(is_bot)) and (bool_or(interacted) or bool_or(event_type='cta_click'))`.

**Checagem de RLS / grants**
- Policy de INSERT `Allow anon insert` (cmd `a`, role `anon`) tem `WITH CHECK true` e
  **nenhuma lista de colunas restritiva** — aceita as colunas novas sem alteração.
- Os GRANTs de `iacoes_page_views` são **table-level** (`INSERT/SELECT/UPDATE/...` para
  `anon`, `authenticated`, `service_role`), então `is_bot` e `interacted` herdaram
  automaticamente. Verificado em `information_schema.column_privileges`: `anon` tem
  INSERT e SELECT nas duas colunas novas. **Nenhum GRANT precisou ser ajustado.**
- Leitura da view: `security_invoker = true`, portanto vale a policy de SELECT já
  existente (`Admins can read iacoes_page_views` → `is_admin(auth.uid())` para
  `authenticated`), que é como o dashboard já lê a tabela. `grant select` explícito
  dado a `authenticated` e `service_role`.

**Baseline (rodado em 31/ago/2026, janela de 90 dias, por sessão, `page_path` ≠ `/`, `/ACOES`, `/AIRTON`)**

| Grupo | Sessões | Sessões com `cta_click` | CTR |
|---|---|---|---|
| com referrer | 1.683 | 135 | **8,02%** |
| sem referrer | 3.961 | 28 | **0,71%** |

Confere com os números de referência do contrato (8,12% / 0,87%). A pequena diferença é
esperada: a janela de 90d deslizou 2 dias desde o diagnóstico de 29/ago. Ordem de grandeza
e o gap ~11x entre os dois grupos estão confirmados.

**Estado atual da view:** em 90d há 8.024 sessões, 645 `is_human`, 0 `is_bot`. Hoje
`is_human` é idêntico a `clicked` porque `interacted` é `false` em 100% das linhas
históricas — a coluna só passa a discriminar quando S2 começar a enviá-la. Isso é o
comportamento esperado, não um bug da view.

**Observação (fora do escopo, não alterada):** as views pré-existentes
`iacoes_page_views_human` e `iacoes_sessions_enriched` calculam `is_bot` com exatamente a
heurística `screen_width = 412 AND device_type='mobile' AND os='Android'` que a seção 2.1
descartou por falso positivo em Android. Foram **deixadas intactas** (migration aditiva).
Quem for consumir dados novos deve usar `iacoes_human_sessions`; vale considerar depreciar
as duas antigas num passo futuro, com decisão explícita.

**Para S2:** o POST em `iacoes_page_views` deve incluir exatamente estes dois campos, em
snake_case, como boolean JSON (`true`/`false`, nunca string, nunca `0`/`1`):
- **`is_bot`** — `true` só com sinal duro da seção 2.2 (`navigator.webdriver === true`, UA
  casando `/bot|crawl|spider|headless|preview|lighthouse|gptbot|claudebot|perplexity|bingpreview/i`,
  ou `navigator.languages` vazio/ausente).
- **`interacted`** — `true` se houve `pointerdown`/`keydown`/`touchstart`/`wheel` **antes**
  do evento sendo enviado.

Omitir qualquer um dos dois não quebra o INSERT (default `false`), mas mata a métrica.
Enviar `null` **quebra** o INSERT (`not null`). Nada mais precisa mudar no schema.

### S0 — Adendo · 31/ago/2026 (correção do Gabriel, mid-flight)
Duas mudanças no contrato, feitas **antes** de S3 começar:
1. **1.2 reescrita.** A justificativa "menos fricção" estava errada — o cadastro é
   exigido de qualquer forma. A vantagem do alerta é a promessa, não o degrau. Proibido
   prometer "sem cadastro" em qualquer copy.
2. **1.6 nova.** Bloco dedicado de apresentação do AIrton nas ticker pages, além do card
   de auditoria. O AIrton passa a ter três superfícies na página de ticker.
S2 não é afetada (escopo dela é só o bloco de tracking). **Para S3:** ler 1.2 e 1.6
atualizadas antes de escrever qualquer copy.

### S2 — Tracking · concluída · 31/ago/2026

**O que mudou — 4 locais, alteração idêntica (1 linha por local):**

1. `scripts/template.ts` L1429 — bloco `<script>` de tracking do template de **ticker**
2. `scripts/template.ts` L2222 — bloco `<script>` de tracking do template de **/acoes**
3. `index.html` L2081 — landing
4. `airton/index.html` L279 — página do AIrton

Em cada um: (a) snippet novo inserido entre o fim do IIFE de `_iaCID` e o `function _iaTrack`;
(b) o objeto `d` de `_iaTrack` ganhou `,is_bot:_iaBOT,interacted:_iaINT` logo após
`click_id_source:_iaCID`. Nada mais foi tocado — `git diff --numstat` mostra `1 1` para
`index.html` e `airton/index.html`; em `template.ts` só as duas linhas dos blocos de script
(o restante do diff do arquivo é o trabalho de calculadoras que já estava no working tree
antes de S2 começar).

**Snippet exato inserido** (idêntico nos 4 locais; não contém `\` nem `${`, então não sofre
escaping de template literal — o regex de bot não tem barra interna, logo nada de `\\/`):

```js
var _iaBOT=(function(){try{if(navigator.webdriver===true)return true;if(/bot|crawl|spider|headless|preview|lighthouse|gptbot|claudebot|perplexity|bingpreview/i.test(navigator.userAgent||''))return true;var l=navigator.languages;if(!l||!l.length)return true;return false}catch(_be){return false}})(),_iaINT=false;(function(){try{var _if=function(){_iaINT=true};['pointerdown','keydown','touchstart','wheel'].forEach(function(t){window.addEventListener(t,_if,{passive:true,once:true})})}catch(_ie){}})();
```

E dentro de `_iaTrack`:

```js
...,source_hint:_iaSH,click_id_source:_iaCID,is_bot:_iaBOT,interacted:_iaINT};
```

Notas de implementação:
- `_iaBOT` é avaliado **uma vez** no load e cacheado numa `var` — três sinais duros da
  seção 2.2, com `try/catch` devolvendo `false` no erro. Sem heurística de `screen.width`.
- `_iaINT` começa `false` e vira `true` no primeiro `pointerdown`/`keydown`/`touchstart`/
  `wheel`, via listeners `{passive:true,once:true}` em `window`, dentro de `try/catch`
  (navegador antigo que não aceita options-object degrada para não-interativo, nunca quebra).
- O valor enviado é o estado do flag **no instante do evento**: o `pageview` inicial sai
  quase sempre com `interacted:false` — esperado. `scroll_100` e `cta_click` de humano saem
  com `true`; bot sai com `false`.
- `keepalive:true` e o `.catch(function(){})` silencioso do fetch **preservados**.
- Os defaults de `utm_medium` por página continuam distintos e intencionais:
  `ticker` / `acoes-index` / `landing` (landing e airton) — não unificados.

**Verificação**
- `npx tsx scripts/generate-pages.ts VALE3` — 1 gerada, 0 falhas.
  (Repo estava sem `node_modules` e sem `.env`; rodei `npm install` e passei
  `SUPABASE_URL`/`SUPABASE_ANON_KEY` inline pelo ambiente. **Nenhum `.env` foi criado.**)
- `npm test` — **verde**: paridade de calculadoras 20/20 + `validate-html.ts`
  353 arquivos, zero problemas (as 7 regras, incluindo `regex-escaping`).
- `node --check` no bloco `<script>` extraído de `VALE3/index.html`, `acoes/index.html`,
  `index.html` e `airton/index.html`: **os 4 compilam**, e nos 4 o payload contém
  `is_bot:_iaBOT,interacted:_iaINT`.
- Regexes preexistentes intactas na saída: `replace(/\/index\.html$/,'')` e `/Edg\//i`
  continuam com as barras invertidas corretas em `VALE3/index.html`.

**Ainda não feito:** confirmar uma linha real gravada em produção (exige deploy). Fica para
S5/QA depois do push — a query é
`select is_bot, interacted, count(*) from iacoes_page_views where created_at > now() - interval '1 day' group by 1,2;`

**Para S3:** `scripts/template.ts` está **liberado**. Estado: o bloco `<script>` de tracking
das duas cópias (L1429 e ~L2222) é território de S2 e está finalizado — **não reescrever**;
se precisar mexer em `_iaClick` (P2: `catch(_le){}` → `console.warn`), edite apenas esse
`catch`, preservando `_iaBOT`/`_iaINT` e os dois campos no payload. Todo o resto do arquivo
está sem alterações de S2. Atenção: o working tree já traz mudanças **não commitadas de
terceiros** (calculadoras: `scripts/calculators.ts`, `calculator-template.ts`,
`validate-planning.ts`, `package.json`, `/calculadoras/`) — não desfazer. `_iaLeadSubmit`
(L1434) segue intacto, é S3 quem remove.

### S3 — Oferta Ticker · concluída · 31/ago/2026

Arquivo tocado: **apenas `scripts/template.ts`**. O bloco `<script>` de tracking da S2 foi
preservado — a única alteração dentro dele foi o `catch(_le){}` do `_iaClick` (P2, item 2).

**P2 — Pixel do Facebook**
- Bloco `fbevents` do `index.html` (Pixel ID `927250313694701`, com o guard `_fbPixelId.indexOf('_')<0`)
  copiado **literalmente** para os dois `<head>`: template de ticker e template de `/acoes`.
  O comentário "Pixel fica só na landing, não nas páginas de ticker" virou o mesmo comentário
  da landing, porque deixou de ser verdade.
- `catch(_le){}` → `catch(_le){try{console.warn('[iAcoes] fbq CTA tracking falhou:',_le)}catch(_we){}}`
  nas duas cópias. O `try` externo protege navegador sem `console`.

**P3 — Oferta reescrita**
- **Card de auditoria** (`social-proof-card`): headline/sub/botão trocados pela copy de 1.5.
  Adicionada `<ul class="airton-q-list">` com as **3 perguntas prontas clicáveis**; cada link vai para
  `.../authnew?ref=iacoes&ticker={TICKER}&intent=auditoria&prompt=<encodeURIComponent(pergunta)>`.
  `data-cta` de `social-proof` → **`airton-audit`** (nos 3 links de pergunta e no botão).
  **Linha de social proof mantida** (`socialProofCount(...) investidores já validaram teses em {TICKER}`).
- **Bloco novo de apresentação do AIrton** (1.6): `<section class="airton-intro">`, inserido
  **depois do `</section>` do card de valuation/DCF e antes do features showcase** — portanto antes
  das demonstrações financeiras. Eyebrow / título / sub / bolha de demonstração / 3 capacidades /
  botão, exatamente como 1.6. `data-cta="airton-intro"`, destino `...&intent=airton`.
  - **Regra "nunca inventar número" implementada em TS**, não em copy: o array
    `airtonDemoSentences` recebe cada frase **só se o dado existir** —
    `wfv > 0 && data.price > 0` (preço justo ponderado + upside), `grahamFV > 0`
    (valor intrínseco de Graham com 25% de margem de segurança), `f.roe > 0` (ROE).
    Se o array ficar vazio, entra um `airtonDemoAnswer` de fallback **sem nenhum número**.
    Verificado: `AZEV4` (sem dados) cai no fallback; `VALE3`/`PETR4`/`BBSE3`/`CTKA4` citam
    exatamente os mesmos valores que a própria página renderiza (conferidos contra
    `id="graham-fv"`, o preço ponderado e o ROE da aba Rentabilidade).
  - Marcação de exemplo (CNPI): badge dourado `Exemplo ilustrativo — não é recomendação de
    investimento` dentro da bolha, `role="img"` + `aria-label="Exemplo ilustrativo de conversa
    com o AIrton sobre {TICKER}"` no container.
- **Card de features** (1.4): fora `Otimizador Markowitz` e `Radar de Oportunidades`; dentro
  `AIrton`, `Alertas CVM em tempo real`, `Minhas Teses`; mantidos `DCF Completo`,
  `Nota Qualitativa`, `Documentos CVM`. Ficaram 6 itens. `data-cta="features-card"` inalterado.
- **Card Markowitz removido** por inteiro: `<section class="markowitz-card">` + os 6 seletores
  CSS `.markowitz-*` + a linha de refinamento `.markowitz-card { border-radius }`.
  A menção residual "otimizador Markowitz" no CTA final virou "alertas da CVM e o AIrton".

**P4 — Alerta no lugar do lead magnet**
- Removidos: `div-lead-card` (form + success), a função `_iaLeadSubmit`, o evento
  `lead_financeiras`, a referência a `iacoes_email_leads`, todo o CSS `.div-lead-*`, e também os
  4 blobs JSON que só existiam para montar o CSV (`_iaDivData`, `_iaDreData`, `_iaBalData`,
  `_iaCfData`) — isso encolhe cada página de ticker de forma relevante.
- No lugar: `<div class="alerta-cvm-card">` com a copy literal de 1.5 (título, sub, botão,
  rodapé), ícone de sino, `data-cta="alerta-cvm"`, destino
  `.../authnew?ref=iacoes&ticker={TICKER}&intent=alerta`. **Link direto, sem formulário e sem
  captura de email.** Rodapé diz "Grátis, sem cartão. Também disponível no Telegram." — nenhuma
  promessa de "sem cadastro" em lugar nenhum.

**P7 — CTA fixo mobile**
- `<div class="sticky-m">` antes de `</body>`, com `<a class="sticky-m-btn" data-cta="sticky-mobile">
  Auditar {TICKER} grátis →` apontando para o mesmo destino da auditoria.
- CSS: `display:none` por padrão; em `@media (max-width:768px)` vira `position:fixed` na base com
  `backdrop-filter`, `env(safe-area-inset-bottom)` e **`body { padding-bottom: calc(76px +
  env(safe-area-inset-bottom)) }`** — a barra não cobre conteúdo. Como é `position:fixed` fora do
  fluxo, não interfere no `overflow-x` das tabelas.

**Mapa novo de `data-cta` das páginas de ticker (para S6 documentar)**

| `data-cta` | Posição | Destino |
|---|---|---|
| `nav-app` | Nav: Acessar App | `?ref=iacoes` |
| `nav-assinar` | Nav: Assinar Plano | `?ref=iacoes` |
| **`airton-audit`** | Card de auditoria: 3 perguntas prontas + botão (4 links) | `?ref=iacoes&ticker=T&intent=auditoria[&prompt=…]` |
| `dcf-locked` | Premissas locked (3x) + card DCF | `?ref=iacoes&ticker=T` |
| **`airton-intro`** | Bloco de apresentação do AIrton | `?ref=iacoes&ticker=T&intent=airton` |
| `features-card` | Card de features | `?ref=iacoes` |
| `nota-qualitativa` | Paywall da nota qualitativa | `?ref=iacoes` |
| **`alerta-cvm`** | Bloco de alerta (fim das demonstrações) | `?ref=iacoes&ticker=T&intent=alerta` |
| `footer` | CTA final | `?ref=iacoes&ticker=T` |
| `disclaimer` | Link inline no disclaimer | `?ref=iacoes` |
| **`sticky-mobile`** | Barra fixa (só mobile) | `?ref=iacoes&ticker=T&intent=auditoria` |

Saíram do mapa: **`social-proof`** (renomeado para `airton-audit`) e **`markowitz`** (card removido).
Dashboards que agregam por `cta_id` precisam tratar a série histórica de `social-proof` como
antecessora de `airton-audit`.

**Verificações (as 9 exigidas)**

1. `npx tsx scripts/generate-pages.ts VALE3 PETR4 BBSE3` → **3 geradas, 0 falhas**.
   (Sem `.env` no repo, como a S2 registrou; usei o mesmo contorno — `SUPABASE_URL` e
   `SUPABASE_ANON_KEY` inline no ambiente. **Nenhum `.env` criado.**)
2. `npm test` → **verde**: paridade de calculadoras 20/20 + `validate-html.ts` com
   **353 arquivos, zero problemas** (as 7 regras, `regex-escaping` incluída).
3. `grep -ci "markowitz\|radar de oport" scripts/template.ts` → **0**
4. `grep -c fbevents scripts/template.ts` → **2**
5. `grep -ci airton scripts/template.ts` → **65**
6. `grep -ci "iacoes_email_leads\|lead_financeiras\|_iaLeadSubmit" scripts/template.ts` → **0**
7. `grep -ci "sem cadastro" scripts/template.ts` → **0** (e 0 nos HTMLs gerados)
8. `_iaBOT` e `_iaINT` presentes nas **2** cópias do bloco de tracking, e o payload gerado em
   `VALE3/index.html` e `acoes/index.html` continua com `is_bot:_iaBOT,interacted:_iaINT`.
   **Trabalho da S2 intacto.**
9. `VALE3/index.html` inspecionado. Ordem: Nav → Breadcrumb → Hero → **Auditoria (AIrton)** →
   Sobre a empresa → Indicadores → Preço Justo + DCF → **Apresentação do AIrton** → Features →
   Nota Qualitativa → Demonstrações Financeiras → **Alerta CVM** → Peers → FAQ → CTA →
   Ações Populares → Notas → Disclaimer → **CTA fixo mobile**. Nenhum número inventado na bolha.

**Fora de escopo, não tocado:** o card `nota-qualitativa` (7 cliques/90d) continua na página —
1.1 só mandou remover a oferta de carteira. Se for para cortar, é decisão nova.

**Para S4 — copy exata usada nas ticker pages, para a landing ficar consistente:**

- AIrton, eyebrow: `Assistente IA`
- AIrton, título: `Conheça o AIrton, seu copiloto para {TICKER}`
- AIrton, sub: `Ele conhece sua carteira, valida suas teses contra os fundamentos reais e resume os documentos da CVM — no app e no seu WhatsApp.`
- AIrton, capacidades: `Acessa sua carteira` · `Valida suas teses` · `Resume a CVM em segundos`
- AIrton, badge da demonstração: `Exemplo ilustrativo — não é recomendação de investimento`
- AIrton, botão: `Conversar com o AIrton sobre {TICKER} →`
- Auditoria, headline: `Leu um relatório sobre {TICKER}? Pergunte ao AIrton.`
- Auditoria, sub: `O AIrton cruza a tese com os números reais de {TICKER} — governança, vantagem competitiva, endividamento e riscos — e diz onde ela não se sustenta.`
- Auditoria, perguntas: `Minha tese em {TICKER} se sustenta?` · `Resume o último Fato Relevante de {TICKER}` · `Compara {TICKER} com os pares do setor`
- Auditoria, botão: `Auditar {TICKER} grátis →`
- Alerta, título: `Fique sabendo antes do mercado`
- Alerta, sub: `Receba no WhatsApp cada Fato Relevante, ITR, DFP e anúncio de proventos de {TICKER} no instante em que sai na CVM — com o resumo do AIrton pronto.`
- Alerta, botão: `Ativar alertas de {TICKER} →`
- Alerta, rodapé: `Grátis, sem cartão. Também disponível no Telegram.`
- Feature de alerta (card de features): `Alertas CVM em tempo real` / `Fato Relevante, ITR, DFP e proventos no instante da publicação`
- CTA fixo mobile: `Auditar {TICKER} grátis →`

Convenção de `intent` no `/authnew` (S4 deve reusar): `auditoria`, `airton`, `alerta`.
O prompt das perguntas prontas vai em `&prompt=` com `encodeURIComponent`.

**Não commitado** — working tree entregue para a próxima sessão. As mudanças de terceiros
(calculadoras) continuam intocadas.

### S0 — Adendo 2 · 31/ago/2026 · decisão de infra para o teste da landing

**Descoberta que muda o plano.** `vercel.json` existe no repo mas nunca foi aplicado:
produção responde `server: GitHub.com`. O site é GitHub Pages puro. Consequências:
1. Não existe split server-side possível na infra atual.
2. Os headers de segurança declarados no `vercel.json` (`X-Frame-Options`,
   `X-Content-Type-Options`, `Referrer-Policy`) **não estão ativos em lugar nenhum**.

**Dimensionamento do teste (honesto).** A landing fez 528 sessões em agosto. Split 50/50
= ~264 por braço/mês. Com base de 40,7% de CTR, detectar +10pp exige ~387 sessões por
braço (α=0,05, poder 80%) → **~6 semanas**. Detectar +5pp exigiria ~6 meses. O "teste de
2 semanas" da seção 4 estava subdimensionado e fica **corrigido para 6 semanas mínimo**.
O teste só consegue responder sobre efeito grande; efeito sutil é indetectável com esse
volume. Aceito conscientemente.

**Decisão do Gabriel:** migrar para Vercel e fazer o split server-side com Routing
Middleware. Sem flash de redirect, sem risco de SEO no caminho do tráfego do Google
(que converte a 18,47%), e ativa os headers que hoje são letra morta.

**Sessões novas / revisadas:**

| Sessão | Escopo | Arquivos (dono exclusivo) | Depende de |
|---|---|---|---|
| S4a | P6 canal WhatsApp-first | `index.html`, `airton/index.html` | S3 |
| S4c | Infra Vercel + middleware de split + coluna `variant` | `vercel.ts`/`vercel.json`, middleware, Supabase DDL | — (paralelo a S4a) |
| S4b | Variante da landing (P5, Bloco E do relatório) + tracking de variante | novo arquivo de variante | S4a, S4c |

**Limite duro para S4c:** preparar toda a configuração, mas **NÃO executar o cutover de
DNS**. Apontar o domínio é ação externa e irreversível a curto prazo — fica para o
Gabriel executar, com o passo a passo documentado.

**Tracking de variante:** o teste precisa de uma coluna `variant text` em
`iacoes_page_views` (default `null`, `'a'`/`'b'` quando o middleware atribuir) e do campo
correspondente no payload de `_iaTrack`. Sem isso o teste não tem como ser lido.

### S4a — Canal WhatsApp-first · concluída · 31/ago/2026

Escopo executado: **somente 1.3 (P6)**. A reestruturação da landing (P5 / Bloco E) **não foi
feita** — segue suspensa aguardando decisão do Gabriel. Nenhuma seção foi removida,
reordenada ou re-layoutada; só copy, um CTA novo e duas regras de CSS.

**`index.html`**

1. Seção `#alertas` (a antiga "AIrton no Telegram") virou **WhatsApp-first**:
   - `section-label`: `AIrton no Telegram` → **`AIrton no WhatsApp`**
   - `h2`: `E ele não vive só no app` → **`Fique sabendo antes do mercado`** (título canônico de 1.5)
   - `section-desc` reescrita na linha da copy de alerta de 1.5, adaptada de `{TICKER}` para
     "suas ações": *"Receba no WhatsApp cada Fato Relevante, ITR, DFP e anúncio de proventos das
     suas ações no instante em que sai na CVM — com o resumo do AIrton pronto. E um aviso na hora
     em que um critério da sua tese é violado."*
   - **CTA novo** (a seção não tinha nenhum): `Ativar alertas no WhatsApp →`,
     `class="btn-cta alerts-cta"`, `data-cta="alerta-cvm"`, `onclick="_iaClick(event)"`,
     href `https://app.brasilhorizonte.com.br/authnew?ref=iacoes-lp&amp;intent=alerta`
     (reusa a convenção de `intent` da S3), com `aria-label`.
   - **Telegram em segundo lugar e em peso menor**: linha `.alerts-note` logo abaixo do CTA com
     a copy canônica **`Grátis, sem cartão. Também disponível no Telegram.`**
     (0.82rem, `--text-tertiary`). O Telegram **não** foi eliminado de lugar nenhum.
   - Lista de benefícios alinhada à copy da S3: o primeiro item virou *"Alertas CVM em tempo
     real — Fato Relevante e comunicados no instante da publicação"* e o de resultados ganhou
     *"com o resumo do AIrton pronto"*. Dividendos/JCP e critério de tese violado mantidos.
2. **Mock de conversa desmarcado do Telegram, sem inventar identificador**: no `.tg-header`,
   `bot · @IAnalistaBH_bot` → **`online · WhatsApp`**, e `AIrton · IAções` → `AIrton · iAções`.
   Nenhum número de telefone, `wa.me`, handle ou link de contato foi criado.
   As classes CSS `.tg-*` foram **mantidas** (renomeá-las mexeria em layout, fora do escopo);
   só o conteúdo textual mudou. Bolhas do mock inalteradas.
3. CSS: comentário `Bloco de Alertas via Telegram` → `Bloco de Alertas via WhatsApp (Telegram
   como alternativa)`, e duas regras novas (`.alerts-cta`, `.alerts-note`). Nada mais no CSS.
4. Consistência de canal no resto da página (copy apenas):
   - Seção AIrton (`#airton`): `section-desc` trocada pela sub canônica da S3 —
     *"Ele conhece sua carteira, valida suas teses contra os fundamentos reais e resume os
     documentos da CVM — no app e no seu WhatsApp."*
   - Card de features `AIrton — Copiloto IA`: "no app e no Telegram" → "no app e no seu WhatsApp".
   - Card de features `Alertas + Telegram` → **`Alertas no WhatsApp`**, texto alinhado à copy de
     feature da S3 (`Fato Relevante, ITR, DFP e proventos no instante da publicação`) + "Também
     disponível no Telegram"; tag `VIA TELEGRAM` → `VIA WHATSAPP`.
   - Módulo IAnalista: "Alertas proativos **via Telegram**" → "**no WhatsApp**".
   - Plano IAnalista: "Notificações via Telegram em tempo real" → "Notificações no WhatsApp em
     tempo real (também no Telegram)".
   - Tabela comparativa: "Notificações via Telegram" → "Notificações no WhatsApp (e Telegram)".
   - FAQ "Quem é o AIrton?": resposta ganhou "— no app e no seu WhatsApp, e também no Telegram".
   - **JSON-LD atualizado junto**, onde a copy citada mudou: a `Question`
     "Quem é o AIrton?" (texto idêntico ao visível), a `Question` de diferença entre planos e a
     `description` do `Product` Fundamentalista — as três agora dizem "notificações no WhatsApp
     e no Telegram". Os 5 blocos `ld+json` continuam parseando.

**`airton/index.html`** (já era WhatsApp-first — só alinhamento)

- Tag do passo 3: `Mesma IA da web e do Telegram` → **`Mesma IA da web — também disponível no
  Telegram`**, mesmo padrão de 1.3.
- Card de recursos `Fatos Relevantes da CVM` → **`Alertas CVM em tempo real`**, com o texto
  alinhado à copy da S3: *"Fato Relevante, ITR e DFP resumidos pelo AIrton no instante da
  publicação, com botões para abrir o documento ou pedir mais detalhe."*
- Nada mais: hero, planos, FAQ e disclaimer intocados. A FAQ "Funciona no Telegram também?"
  fica como está — é o Telegram em segundo lugar, que é o padrão pedido.

**Pendente de preenchimento pelo Gabriel (bloqueador de honestidade, não de build)**

- **Identificador oficial do WhatsApp** — número e/ou link `wa.me` do AIrton. Não existe em
  lugar nenhum do repo, então **não foi inventado**. Hoje o mock da landing mostra só
  `online · WhatsApp` e o fluxo de vínculo é descrito como "código único gerado para a sua
  conta" (`airton/index.html`), o que é verdadeiro e não depende do número. Quando o número
  oficial existir: colocar no `.tg-status` da landing e, se fizer sentido, um link `wa.me`
  no CTA de `/airton/`. **Não publicar número antes de confirmar com o Gabriel.**

**Verificações (as 5 exigidas)**

1. `npm test` → **verde**: paridade de calculadoras 20/20 + `validate-html.ts` com
   **353 arquivos, zero problemas** (as 7 regras).
2. `grep -ci "sem cadastro" index.html airton/index.html` → **0 e 0**. Nenhuma das duas páginas
   prometia isso antes, e nada foi introduzido. A promessa usada é "Grátis, sem cartão".
3. `_iaBOT` e `_iaINT` **presentes nos dois arquivos** (1 ocorrência de cada em cada, dentro do
   bloco de tracking da S2). O bloco `<script>` **não foi tocado** — trabalho da S2 intacto.
4. Nenhum identificador de contato inventado: `grep` por `wa.me`, `+55` e `IAnalistaBH_bot`
   → **0 nos dois arquivos**. Os `t.me/brasilhorizonte` que aparecem são os links sociais do
   rodapé/JSON-LD, **pré-existentes e reais**, não tocados.
5. HTML bem formado: parser de balanceamento de tags rodado nos dois arquivos →
   **zero tags não fechadas, zero mismatches**. Os 5 JSON-LD de `index.html` e o 1 de
   `airton/index.html` parseiam como JSON válido.

**Para S5:** reverificar no QA final —
(a) `grep -ci "sem cadastro"` em `index.html`, `airton/index.html` **e** nos HTMLs de ticker
regenerados, esperando 0 em todos;
(b) o novo `data-cta="alerta-cvm"` da landing aponta para `/authnew` com `intent=alerta` — o
mesmo `cta_id` que a S3 usa nas ticker pages, então o dashboard vai agregar landing + ticker na
mesma série; se quiser separar, é decisão nova (o `utm_medium` já diferencia: `landing` vs
`ticker`);
(c) confirmar que nenhuma página vende só Telegram — a checagem rápida é
`grep -c "Telegram" index.html airton/index.html` e conferir que toda menção está acompanhada
de WhatsApp ou é link social de rodapé;
(d) o número oficial do WhatsApp continua **ausente** de propósito — se aparecer algum em QA,
é regressão;
(e) P5 (reestruturação da landing) **não foi executado** — a landing de 40,7% de CTR segue
estruturalmente intacta, como o item 4 (risco declarado) exige.

**Não commitado** — working tree entregue para a próxima sessão.

### S0 — Adendo 3 · 31/ago/2026 · conexão do WhatsApp

**Confirmado pelo Gabriel:** a conexão do WhatsApp acontece **dentro do app**, depois do
cadastro. Não existe e não deve existir número público, `wa.me` ou handle nas páginas do
iAcoes.

Consequências, para que nenhuma sessão reabra isso:
- O mock da seção `#alertas` da landing (`online · WhatsApp`, sem identificador) está
  **correto como está**. Não é pendência.
- A pendência registrada por S4a ("identificador oficial do WhatsApp") fica **encerrada
  como não-aplicável**.
- Copy de alerta em qualquer superfície aponta para `/authnew?...&intent=alerta` e para
  a conexão dentro da plataforma. Nunca para um número.
- S5 deve verificar no QA que **nenhum** identificador de contato apareceu no repo:
  `grep -rIn "wa\.me\|whatsapp://\|+55" index.html airton/index.html scripts/template.ts`
  tem que voltar vazio.

### S4c — Infra Vercel · concluída · 31/ago/2026

Arquivos meus, todos **novos** (nada de outra sessão foi tocado):
`vercel.ts`, `middleware.ts`, `.vercelignore`, `_bmad-output/RUNBOOK-vercel-cutover.md`.
Removido: `vercel.json` (a Vercel aceita **um** arquivo de config por projeto).
`package.json` ganhou duas dependências: `@vercel/config` e `@vercel/functions`.
**Nada commitado, nada deployado, DNS intocado.**

#### 1. `vercel.ts` — e as duas flags que teriam quebrado o site

O `vercel.json` antigo (que **nunca chegou a rodar** — produção é GitHub Pages) declarava
dois valores que, aplicados de verdade, causariam estrago. Ambos foram invertidos, com o
racional escrito dentro do próprio arquivo:

| Flag | `vercel.json` antigo | `vercel.ts` novo | Por quê |
|---|---|---|---|
| `trailingSlash` | `false` | **`true`** | Medido: as **354** URLs do `sitemap.xml` têm barra final, e 100% dos `canonical`/`og:url`/Schema.org também. Produção hoje faz 301 `/PETR4` → `/PETR4/`. Com `false`, **toda URL canônica do site** viraria 308 e cada `canonical` apontaria para uma URL que redireciona. `true` reproduz o comportamento atual byte a byte. `undefined` foi descartado: serviria as duas formas com 200 = conteúdo duplicado. |
| `cleanUrls` | `true` | **`false`** | `cleanUrls: true` faz *qualquer* `.html` responder 308. Na raiz existem **dois arquivos de verificação de busca** que precisam de 200 na URL exata: `googlef40b0a5d1cbc2d3e.html` (Google Search Console) e `0941qt8c38dvdna2jnm6fgek6931de.html` (chave IndexNow/Bing). E o site não ganha nada com `cleanUrls`: nenhuma página depende de stripping de `.html` — todas são `dir/index.html`, que a Vercel serve nativamente no caminho do diretório. |

O único benefício real perdido com `cleanUrls: false` (deduplicar `/X/index.html`) foi
recuperado por um redirect explícito `/(.*)/index.html` → `/$1/` (308 permanente), que
**não** toca nos `.html` da raiz.

Preservado do `vercel.json`: `Content-Type: application/xml` no sitemap, os 4 headers de
segurança em `/(.*)` (`X-Robots-Tag`, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`) e o `Cache-Control: immutable` de `/assets/(.*)`. Acrescentado:
`Cache-Control: private, no-cache` + `Vary: Cookie` em `/` e `/lp-b/`, porque a landing
passa a variar por cookie.

**Arquitetura dual UPPERCASE/lowercase — verificado, não quebra.** Os dois diretórios são
arquivos distintos no repo (o lowercase é gerado no CI Ubuntu) e resolvem direto pelo
filesystem; a Vercel é case-sensitive, igual ao runner. `trailingSlash: true` trata os dois
do mesmo jeito e o `canonical` do lowercase continua apontando para o UPPERCASE. O
`404.html` segue como fallback client-side. O runbook tem os `curl` que provam isso na URL
`*.vercel.app` **antes** do DNS (itens 4.2 e 4.3) — é passo bloqueante.

Validação: `npx @vercel/config validate` → `✓ Config is valid`; `npx @vercel/config compile`
emite o JSON esperado; `tsc --noEmit` limpo em `vercel.ts` e `middleware.ts`; `npm test`
verde (paridade 20/20 + `validate-html.ts` 353 arquivos, zero problemas).
**Não foi feito `vercel build` nem deploy** — o projeto ainda não existe na Vercel e o
limite duro proíbe deployar.

#### 2. `middleware.ts` — split 50/50

- **Escopo cirúrgico:** `export const config = { matcher: '/', runtime: 'edge' }`. As 300+
  páginas de ticker (72% do tráfego), `/acoes/`, `/calculadoras/`, `/airton/` e os assets
  **nem invocam** o middleware.
- **Atribuição fixa:** cookie `ia_lp_variant` (`a`|`b`), `Path=/`, `Max-Age=90 dias`,
  `SameSite=Lax`, `Secure`, **sem `HttpOnly`** — é assim que o JS lê a variante.
- **Bots sempre `a`, nunca sorteados, nunca recebem cookie.** Regex de UA que inclui a
  lista dura da seção 2.2 (a mesma de `_iaTrack`) mais crawlers/unfurlers/ferramentas.
  UA vazio também conta como bot. Sem cloaking: o Googlebot vê exatamente a landing atual.
- **Variante `b` servida por rewrite**, não redirect: a URL continua `https://iacoes.com.br/`,
  sem flash e sem novo endereço para o Google indexar.
- **Interruptor: variável de ambiente `AB_LANDING_TEST`.** Ausente ou `≠ 'on'` ⇒ teste
  desligado, 100% variante `a`, e o cookie residual é **expirado** (para o analytics nunca
  reportar `b` numa sessão que viu `a`). É o default — enquanto a S4b não publicar nada,
  o middleware é inerte. Escolhi env var em vez de constante no arquivo justamente para a
  S4b **não precisar editar arquivo meu**: quem liga é o Gabriel, no dashboard.
- **Degradação segura:** com o flag `off` nunca há rewrite, logo nunca 404. Com o flag `on`
  e o arquivo ausente, aí sim daria 404 — por isso o runbook diz, em vermelho, para só
  ligar depois de `/lp-b/` responder 200.

#### 3. Caminho escolhido para a variante `b`

**`/lp-b/index.html`** (servida internamente em `/lp-b/`, exibida ao visitante em `/`).

Escolhido por ser um diretório comum: funciona igual na Vercel e no GitHub Pages (útil
durante a janela de propagação), sem underscore nem caractere especial.

**Requisitos que a S4b tem que cumprir nesse arquivo:**
1. `<link rel="canonical" href="https://iacoes.com.br/">` — orientação oficial do Google
   para teste A/B.
2. **NÃO** colocar `noindex`. O Google desaconselha em variantes de teste, e o `CLAUDE.md`
   registra que `noindex` já causou problema de indexação neste site (fev–abr/2026).
3. **Não** entrar no `sitemap.xml` e não receber link de entrada de nenhuma página.

#### 4. Coluna `variant` no Supabase — ESPECIFICAÇÃO PARA S4b

Migration aplicada no projeto `dawvgbopyemcayavcatd`, nome `iacoes_page_views_add_variant`,
puramente aditiva (nenhum DROP, nenhuma coluna alterada, nenhum dado apagado):

```sql
alter table public.iacoes_page_views
  add column if not exists variant text default null;
```

- **Sem CHECK constraint, de propósito.** Um valor inesperado deve sujar o dado, nunca
  derrubar o INSERT do pageview. Mesma filosofia da S1 (`omitir não quebra`).
- **Grants:** confirmado em `information_schema.column_privileges` que `anon` já tem
  `INSERT` e `SELECT` em `variant` — os GRANTs de `iacoes_page_views` são table-level,
  como a S1 registrou, e a coluna herdou. **Nenhum GRANT precisou ser criado.**
- **RLS:** a policy `Allow anon insert` (cmd `a`, role `anon`) tem `WITH CHECK true` e
  nenhuma lista de colunas. Aceita a coluna nova sem alteração. Verificado em `pg_policy`.
- **View `public.iacoes_human_sessions` atualizada** (mesma migration, `security_invoker = true`
  preservado): ganhou a coluna **`variant`** — a primeira variante não-nula da sessão,
  `(array_agg(variant ORDER BY created_at, id) FILTER (WHERE variant IS NOT NULL))[1]`.
  Adicionada **no fim** da lista de colunas, então quem consome por nome ou por posição
  continua funcionando. Smoke test: 13.175 sessões, 0 com variante (esperado — ninguém
  envia ainda).

**O que a S4b tem que fazer no JS (não toquei em `_iaTrack`, é território da S2/S4b):**

| Item | Valor exato |
|---|---|
| Nome do campo no payload | **`variant`** (snake_case, igual à coluna) |
| Tipo | `string` ou `null` |
| Valores aceitos | `'a'`, `'b'`, ou `null` |
| Como ler | do cookie **`ia_lp_variant`** — legível por `document.cookie` (o middleware não usa `HttpOnly`) |
| Quando enviar | **só nas páginas que participam do teste** (`/`). Em ticker, `/acoes`, `/calculadoras`, `/airton` mandar `null` ou omitir o campo |
| Se o cookie não existir | enviar `null` (ou omitir) — **nunca** `''`, nunca `'A'`/`'B'` maiúsculo, nunca `undefined` serializado |

Snippet de leitura sugerido (defensivo, no mesmo estilo do bloco da S2):

```js
var _iaVAR=(function(){try{var m=/(?:^|;\s*)ia_lp_variant=(a|b)(?:\s*;|\s*$)/.exec(document.cookie||'');return m?m[1]:null}catch(_ve){return null}})();
```

e dentro do objeto `d` de `_iaTrack`, logo depois de `interacted:_iaINT`:

```js
...,is_bot:_iaBOT,interacted:_iaINT,variant:_iaVAR};
```

**Atenção ao escaping:** esse snippet contém `\s`. Nos arquivos `index.html` /
`airton/index.html` (HTML puro) vai literal. **Se algum dia for parar dentro de template
literal em `scripts/template.ts`, precisa virar `\\s`** — é exatamente a armadilha da regra
`regex-escaping` do `validate-html.ts`. Na prática não deveria: o teste é só da landing.

O cookie é escrito pelo middleware **na resposta do documento**, então já está disponível
em `document.cookie` no primeiro carregamento — inclusive na primeira visita. Não precisa
esperar segundo pageview.

#### 5. Pendente de ação humana (limite duro respeitado)

Nada disto foi feito, e nenhuma parte pode ser feita por sessão de IA:

1. **Commit e push** dos 4 arquivos novos + remoção do `vercel.json` + `package.json`.
2. **Criar o projeto na Vercel** e importar o repo (Framework `Other`, sem build command,
   output `.`), com `AB_LANDING_TEST=off`.
3. **Rodar a bateria de validação** contra a URL `*.vercel.app` — passo **bloqueante**,
   antes de qualquer DNS.
4. **Adicionar o domínio na Vercel** e ler os valores exatos do *domain card*.
5. **Alterar o DNS no Registro.br** — exige o **Lucas** (titular) ou acesso à conta dele.
6. **Desligar o GitHub Pages** só após 7 dias estáveis.
7. **Ligar o teste** (`AB_LANDING_TEST=on` + redeploy) só depois que a S4b publicar `/lp-b/`.

Passo a passo executável, com valores de DNS, TTL, janela de propagação, rollback e
checklist: **`_bmad-output/RUNBOOK-vercel-cutover.md`**.

#### 6. Riscos identificados

1. **O valor do registro A é por projeto.** A documentação da Vercel é explícita: use o que
   o *domain card* mostrar. `76.76.21.21` é o histórico, projetos novos recebem anycast
   (ex.: `216.198.79.1`). Copiar de tutorial = domínio em "Invalid Configuration".
2. **TTL de 3600s na zona.** Medido. A janela de rollback é de até 1h (caudas até 24h) se o
   TTL não for baixado antes. Mitigação no runbook (item 5.2).
3. **O titular do domínio é outra pessoa.** O passo irreversível depende da agenda do Lucas.
   Se ele não estiver disponível para o rollback, a janela de erro se estende. Alinhar
   horário **antes** de começar.
4. **Plano Hobby + uso comercial viola os Termos da Vercel.** O iAcoes converte para uma
   plataforma paga. Decidir Pro **antes** do cutover.
5. **O cron passa a disparar deploy de produção 5×/semana.** Comportamento desejado, mas
   conta contra o limite de deployments do plano.
6. **Poder estatístico continua o gargalo, não a infra.** ~264 sessões por braço/mês; 6
   semanas detectam +10pp, não menos. A infra removeu o risco de flash/SEO, não o de
   amostra pequena. Ler o resultado com essa régua.
7. **`Vary: Cookie` em `/` reduz o cache da landing.** Custo desprezível (528 sessões/mês),
   mas é uma troca consciente por corretude do split.
8. **Existe uma janela em que o site roda em dois hosts.** Durante a propagação, parte do
   tráfego vai para o GitHub Pages e parte para a Vercel. Os dois servem o mesmo commit, e
   os headers de segurança só existem no lado Vercel — não é divergência de conteúdo.
9. **`.vercelignore` novo.** Passa a excluir `scripts/`, `_bmad*`, `.github/`, `.claude/` e
   `*.md` do que é publicado. Se alguma dessas coisas estava sendo servida de propósito hoje
   (não achei nenhuma), vai sumir. `CLAUDE.md` e `CAMPAIGN-PROMO-50.md` hoje são públicos no
   GitHub Pages; passam a não ser.

**Para S4b:** ler as seções 3 e 4 acima antes de escrever uma linha. O arquivo é
`/lp-b/index.html`, o campo é `variant`, a fonte é o cookie `ia_lp_variant`.
**Não editar `vercel.ts` nem `middleware.ts`** — para ligar o teste basta a variável de
ambiente, e ela é responsabilidade do Gabriel.

**Não commitado** — working tree entregue para a próxima sessão.

### S0 — Adendo 4 · 31/ago/2026 · Vercel cancelada, bloco de documentos da CVM

**Decisão do Gabriel, três partes:**

1. **Vercel e teste A/B cancelados.** "Joga pra live sem nada de Vercel." Revertido:
   `middleware.ts`, `vercel.ts` e `.vercelignore` apagados, `vercel.json` restaurado,
   deps `@vercel/config`/`@vercel/functions` removidas do `package.json`. Domínio removido
   do projeto Vercel; sobrou um projeto `iacoes` vazio, sem deployment, inofensivo.
   O `RUNBOOK-vercel-cutover.md` fica arquivado para o caso de retomarem.
   **S4b está cancelada** — não haverá variante `b` nem split. A landing da S4a vai
   direto para produção.
   A coluna `variant` criada pela S4c em `iacoes_page_views` fica de pé, sem uso
   (aditiva, nullable, não atrapalha).

2. **Deploy total.** As 300+ páginas de ticker e a landing vão para produção nesta rodada.

3. **Bloco novo: últimos documentos da CVM (substitui o card de auditoria no topo).**
   O card "Leu um relatório sobre {TICKER}?" sai; no lugar entra a lista real dos últimos
   documentos da empresa na CVM.

   **Racional do Gabriel:** "se a pessoa tem o ticker, vai querer receber notificações."
   O visitante da página de VALE3 provavelmente é acionista de VALE3. Mostrar os
   documentos reais e recentes prova o valor do alerta antes de pedir qualquer coisa —
   é a demonstração da promessa, não a promessa.

   Fonte de dados confirmada: `public.cvm_documents` — 23.412 linhas, 361 tickers,
   17.183 com `ai_summary`, `link` presente em quase tudo. Colunas relevantes:
   `ticker`, `doc_type`, `date`, `summary`, `ai_summary`, `link`, `company_name`.
   **Atenção:** existem linhas com `date` no futuro (máx. 2026-12-31) — filtrar.

### S3b — Bloco de documentos da CVM · concluída · 31/ago/2026

Implementa o item 3 do Adendo 4. Arquivos tocados: **`scripts/supabase.ts`,
`scripts/types.ts`, `scripts/template.ts`** — nenhum outro. `_iaBOT`/`_iaINT` (S2),
`fbevents`, `airton-intro`, card de features e bloco `alerta-cvm` (S3) intactos.

**Fonte de dados — `scripts/supabase.ts`**
- `fetchCvmDocuments(ticker, limit = 4)`: lê `public.cvm_documents`
  (`ticker, doc_type, date, summary, ai_summary, link`), com `.lte('date', hoje)` e
  `.not('date','is',null)` — **nenhum documento com data futura entra** (o feed tem
  linhas até 2026-12-31). Ordena por `date` desc, puxa 40 linhas e deduplica por `link`
  (o feed repete o mesmo `link` com títulos diferentes; VALE3 tinha 3 linhas iguais em
  06/08). Toda a função é tolerante a falha: erro de query/rede vira `console.warn` +
  `[]`, e a página é gerada sem o bloco.
- **Fallback por raiz de 4 letras.** `cvm_documents` guarda um ticker por *emissor*
  (PETR4, não PETR3; BBDC4, não BBDC3). Se o ticker exato não tem linhas, cai para
  `.like('ticker','PETR%')`. Documento da CVM é da companhia, não da classe de ação —
  não é dado inventado. Isso levou a cobertura de 361 tickers no banco para **297 das
  322 páginas geradas**. Sem o fallback seriam ~255.
- **`doc_type` traduzido** por `CVM_DOC_LABELS`: `FR`→Fato Relevante, `CM`→Comunicado ao
  Mercado, `ITR`→Informações Trimestrais, `DFP`→Demonstrações Financeiras Padronizadas,
  `FRE`→Formulário de Referência, `VLMO`→Negociação de Valores Mobiliários,
  `PR`→Divulgação de Resultados. Esses são **os 7 valores que existem de fato** na
  tabela (conferido por `group by doc_type`). Sigla fora do mapa → documento descartado,
  para garantir que sigla crua nunca chegue ao HTML.
- **Título** extraído de `summary`, que vem no formato
  `"<Tipo> - <título> - Date YYYY-MM-DD"` (às vezes `Data`); título vazio (`"- - -"`) ou
  igual à própria sigla/rótulo (`"ITR - ITR - ..."`) é descartado. **Resumo** = `ai_summary`
  limpo de markdown (`**`, `##`, crases, quebras de linha colapsadas). Documento sem
  título **e** sem resumo é descartado.
- **Plumbing sem tocar em arquivo de terceiros:** `FinancialData` é montado em
  `valuation.ts` e o template é chamado de `generate-pages.ts` — nenhum dos dois é meu.
  Solução: `fetchFinancials` (que já roda uma vez por ticker) busca os documentos em
  paralelo com as outras 4 tabelas e grava num `Map` de módulo; `template.ts` lê via
  `getCvmDocuments(ticker)`, síncrono. Sem ciclo de import (`supabase.ts` não importa
  `template.ts`). `SupabaseFinancials` ganhou `cvmDocs`; tipo novo `CvmDocument` em
  `types.ts`.

**O bloco — `scripts/template.ts`**
- Posição: logo abaixo do `</header>` do hero, exatamente onde estava o card
  `social-proof-card` (`airton-audit`), que **saiu** dessa posição.
- Título `O que {TICKER} publicou na CVM`, eyebrow `Direto da CVM`, sub que amarra a
  demonstração à oferta: *"É exatamente isto que o alerta entrega no seu WhatsApp — com
  o resumo do AIrton pronto — no instante em que sai."*
- Lista `<ol>` com 4 itens: rótulo traduzido, `<time datetime="ISO">` com data em
  `dd/mm/aaaa`, título (≤120 chars) e resumo (≤240 chars, corte em limite de palavra).
  Cada item é um `<a>` para o documento oficial com `target="_blank" rel="noopener nofollow"`
  e **sem** `_iaClick` (é link externo, não CTA).
- **CTA primário:** `Receba os próximos no WhatsApp →`, `data-cta="alerta-cvm-topo"`,
  destino `.../authnew?ref=iacoes&ticker={T}&intent=alerta`. Rodapé `Grátis, sem cartão.`
- **Linha de prova social mantida** no bloco (`N investidores já validaram teses em {T}`),
  reusando `.social-proof-count`. Não foi movida para `airton-intro`.
- **CTA secundário, menor:** link sublinhado `Ou peça ao AIrton para auditar sua tese em
  {T} →`, `data-cta="airton-audit"` (id preservado — sucessor de `social-proof` no
  histórico do dashboard), destino `...&intent=airton`, conforme pedido explícito.

**Escape.** `escHtml()` novo em `template.ts` aplicado a **todo** texto vindo do banco
(título, resumo, link, data): `& < > " '`. Conferido no HTML gerado — links saem com
`&amp;`, aspas do resumo da VALE3 saem como `&quot;`. Os 96 registros com `<` na tabela
são sinais de "menor que", não tags, e ficam escapados de qualquer forma.

**Sem oferta duplicada.** Os dois blocos de alerta são deliberadamente diferentes:
o de topo é **demonstração** — card claro (`#fff`, borda-esquerda dourada), lista
alinhada à esquerda, botão navy, copy "receba os próximos"; o `alerta-cvm` do fim da
página segue **chamada direta** — card escuro centrado, ícone de sino, título "Fique
sabendo antes do mercado", botão dourado "Ativar alertas de {T} →". Nenhuma frase
repetida palavra por palavra (o rodapé do topo é só `Grátis, sem cartão.`, sem a linha
do Telegram).

**Fallback (decisão que vale registrar).** Ticker sem documentos → o bloco da CVM não é
renderizado e **o card de auditoria do AIrton volta à posição**, com headline, perguntas
prontas e a linha de prova social. Não é "buraco preenchido com placeholder": é o card
que já existia, com dados que já existiam. Foi preferido a simplesmente omitir a seção
porque, sem ele, esses 25 tickers perderiam o único CTA acima da dobra **e** o único
elemento de prova social do site. Nada é inventado em nenhum dos dois caminhos.

**Schema.org: decidido NÃO adicionar.** Justificativa: (1) o conteúdo já está inteiro no
DOM em HTML semântico — `<ol>`, `<time datetime>`, âncoras reais — que é o que crawlers
e extratores de LLM leem; (2) um `ItemList` de links *externos* não gera rich result
nenhum no Google; (3) a página já carrega 4 grafos JSON-LD (Article, BreadcrumbList,
FAQPage, FinancialProduct) e um quinto de baixo valor só aumenta payload e superfície
para aviso de structured-data mismatch. O ganho de GEO vem do texto fresco e único por
página, que está lá.

**Verificações**

1. `npx tsx scripts/generate-pages.ts VALE3 PETR4 BBSE3 AUAU3 CTKA4` → 5 geradas, 0 falhas.
   Depois, **`npm run generate` completo**: 322 geradas, 25 falhas (todas "Sem dados"
   de `brapi_quotes`, pré-existentes, sem relação com este trabalho).
   Ticker sem cobertura testado de verdade: **AUAU3** (nem exato nem por raiz) → fallback.
2. `npm test` → paridade 20/20 + **357 arquivos, zero problemas** (as 7 regras).
3. `grep -c '_iaBOT' scripts/template.ts` → **2** (e `_iaINT` → 2). S2 intacta.
4. `grep -c fbevents scripts/template.ts` → **2**. S3 intacta.
5. HTML inspecionado (VALE3, PETR4, BBSE3, CTKA4, AUAU3): datas em `dd/mm/aaaa`, tipos
   traduzidos, um link da CVM conferido com `curl` → **200**, texto do banco escapado,
   fallback limpo em AUAU3. CTKA4 exercita o caso "item só com título, sem resumo".
6. Nenhuma data futura: maior `datetime` em todas as páginas é `2026-08-31` (hoje).
7. `grep -o 'cvm-doc-type">(FR|CM|ITR|DFP|PR|VLMO|FRE)<'` em todas as páginas → **0**
   ocorrências. Nenhuma sigla crua renderizada.

**Distribuição final:** 297 páginas com documentos reais da CVM, 25 com o card de
auditoria como fallback, 6 diretórios com HTML antigo porque a geração do ticker falhou
por falta de dados de cotação (AZUL4, CPLE5, MERC4, GUAR3, MOAR3, RDNI3) — problema
anterior a esta sessão.

**Novo `data-cta` para S6 documentar:** `alerta-cvm-topo` (bloco de documentos da CVM,
topo da página, `intent=alerta`). O `airton-audit` continua existindo, agora como link
secundário do mesmo bloco (`intent=airton`) e, nos tickers sem cobertura, no card de
auditoria com as 3 perguntas prontas (`intent=auditoria&prompt=…`).

**Não commitado** — working tree entregue. As 300+ páginas foram regeneradas nesta
sessão, então o repo está consistente para o "deploy total" do Adendo 4.

### S6 — Documentação · concluída · 31/ago/2026

Arquivo tocado: **apenas `CLAUDE.md`**. Nada commitado. Cada item foi verificado contra o
código real (`scripts/template.ts`, `scripts/supabase.ts`, `index.html`, `airton/index.html`,
`scripts/calculators.ts`, `scripts/calculator-template.ts`, `scripts/validate-html.ts`,
`package.json`, `sitemap.xml` e HTML gerado de VALE3/AUAU3/acoes/calculadoras) — não só
contra este handoff.

**Seções novas**

- **AIrton — assistente de IA**: as 3 superfícies na ticker page + landing + `/airton/`,
  copy canônica, e a regra "nunca inventar número" na bolha (implementada em TS via
  `airtonDemoSentences`, com fallback sem número).
- **Alertas e canal (WhatsApp first)**: 4 tipos de alerta, WhatsApp primário / Telegram
  secundário, e o registro explícito de que **a conexão acontece dentro do app e não existe
  número público** — com o `grep` de QA para ninguém "consertar" isso depois. Também a
  proibição de prometer "sem cadastro".
- **Lead magnet de CSV — REMOVIDO**: o que saiu, e o porquê (0 leads em ~5 meses).
- **Calculadoras (`/calculadoras/`)**: 5 páginas, geradores, motor `planning-core.js`,
  teste de paridade, Schema.org (FAQPage + WebApplication + BreadcrumbList), sitemap.
- **Páginas de setor (`/acoes/{setor}/`)**: 23 páginas, também não documentadas antes.
- **Documentos da CVM (`public.cvm_documents`)** na seção de fontes de dados: colunas,
  filtro de data futura, dedup por `link`, fallback por raiz de 4 letras, `CVM_DOC_LABELS`,
  tolerância a falha e o plumbing via `Map` de módulo.
- **Convenção de `intent`** (`alerta` / `airton` / `auditoria`).
- **Paridade das calculadoras (validate-planning.ts)**.
- **Descartado** no roadmap (Vercel + teste A/B; lead magnet).

**Seções reescritas**

- Estrutura de arquivos, comandos (`generate:calculadoras`, `npm test` = 2 scripts).
- Estrutura da página de ticker: 19 blocos na ordem real, com o bloco da CVM no topo e o
  fallback para o card de auditoria; Markowitz e Radar registrados como **removidos das
  páginas de ticker, não do produto**.
- **Mapa de `data-cta` refeito e conferido por grep**, com 4 tabelas (ticker, landing,
  `/airton/`, calculadoras) e o aviso de que **`airton-audit` é o sucessor histórico de
  `social-proof`** e `markowitz` deixou de ser emitido.
- Analytics: 3 camadas com coberturas diferentes, **Pixel `927250313694701`** (agora em
  ticker/`acoes`/landing/`airton`, com o evento custom `CTAIAcoes`), colunas
  `is_bot`/`interacted`/`variant` com semântica, view `iacoes_human_sessions`, baseline de
  CTR, e o aviso sobre as duas views antigas com a heurística `screen_width = 412`
  **considerada incorreta**.
- Campanhas: promo 50% marcada como **encerrada**, com o inventário dos resíduos inertes.
- Roadmap: 8 itens marcados como feitos, 6 pendências novas e reais.
- Nota sobre `vercel.json` ser **inerte** (produção é GitHub Pages; headers de segurança
  não estão ativos).

**Correções de fato que o handoff não previa**

1. `validate-html.ts` tem **8 regras**, não 7 — existe `utm-injection` (isenta páginas de
   setor). O `CLAUDE.md` dizia 7.
2. `npm test` roda **dois** scripts: `validate-planning.ts` e `validate-html.ts`.
3. **`/calculadoras/` NÃO está linkada na landing** — `grep -c calculadoras index.html` = 0,
   e nenhuma página de ticker ou `/acoes/` linka também. As 5 páginas só entram por sitemap
   e busca orgânica. Documentei como buraco de internal linking, com item no roadmap.
4. `_iaLeadSubmit` e `iacoes_email_leads` **ainda existem** em
   `scripts/inline/tracking.js` e nas 5 páginas de `/calculadoras/`, mas são **código morto**
   (`grep -c onsubmit calculadoras/*/index.html` = 0). Registrado como resíduo, não como
   feature.
5. `tracking.js` das calculadoras **não envia** `is_bot`/`interacted` — o bloco de tracking
   existe em **5** cópias, não 4. Virou item de roadmap.
6. `/calculadoras/` e `/acoes/{setor}/` **não carregam GA4 nem Pixel**.
7. A promo 50% já teve o markup e o JS removidos do `index.html`; sobrou só CSS órfão, o
   ramo `data-promo` do `_iaClick` (nunca dispara) e um comentário do Clarity com TODO
   vencido.
8. Ticker page tem **3** grafos JSON-LD (Article com `about: FinancialProduct`,
   BreadcrumbList, FAQPage), não 4 blocos separados. FAQ tem 11 Q&As, não 12 — troquei por
   "perguntas frequentes dinâmicas" em vez de fixar um número que envelhece.
9. As classes CSS da seção `#alertas` da landing ainda se chamam `.tg-*` (herança do
   Telegram) — documentado como nota de manutenção para ninguém achar que é bug.

**Não confirmado / fora do meu alcance**

- **Estado real do Supabase.** Documentei `is_bot`, `interacted`, `variant`,
  `iacoes_human_sessions` e as duas views antigas a partir dos blocos S1/S4c deste handoff
  e do payload do JS. Não abri o banco para verificar DDL, grants ou a definição das views.
- **Baseline de CTR (8,02% / 0,71%)** e **"0 leads em ~5 meses"**: copiados do handoff, não
  re-medidos.
- **Cobertura de 297/322 páginas da CVM**: número do bloco S3b. Confirmei o mecanismo
  (fallback por raiz, filtro de data futura) e o comportamento em VALE3 e AUAU3, não a
  contagem.
- **A promo 50% pode ter resíduo em outros arquivos** além do `index.html` — só varri esse.

**Estilo:** mantido o padrão sem acentuação do arquivo. Diff é aditivo/substitutivo por
seção; nenhuma reescrita cosmética em massa.

### S6b — Correção pós-reversão · concluída · 31/ago/2026

O `CLAUDE.md` documentava `/calculadoras/` como parte do repo. Depois disso o Gabriel
segurou o feature (achou a aba ruim) e a coordenadora reverteu a integração. Corrigido:

- Árvore de arquivos: removidos `calculadoras/`, `scripts/calculators.ts`,
  `generate-calculators.ts`, `calculator-template.ts`, `validate-planning.ts`,
  `planning-cases.json` e `scripts/inline/` — nenhum está no repo.
- Comandos: `npm run generate:calculadoras` removido; `npm test` volta a ser **um** script
  (`validate-html.ts`).
- Fluxo de geração, sitemap e analytics: sem menção a calculadoras.
- Bloco de tracking: **4** cópias no repo (2 em `template.ts`, `index.html`,
  `airton/index.html`); a 5ª (`scripts/inline/tracking.js`) só existe no working tree.
- Seção "Calculadoras — TRABALHO EM ANDAMENTO, FORA DO REPO" criada, com o caminho do
  patch (`_bmad-output/calculadoras-wip.patch`), o que precisa ser refeito à mão em
  `template.ts`/`generate-pages.ts`, e as pendências (páginas órfãs, `is_bot`/`interacted`
  ausentes no `tracking.js`, código morto de `_iaLeadSubmit`/`iacoes_email_leads`).

**Correção da premissa da tarefa:** o `validate-html.ts` do HEAD tem **8 regras**, não 7 —
a `utm-injection` já estava no HEAD e não veio das calculadoras. O patch das calculadoras
só alterou `collectHTMLFiles` e a regex de `tracking-variables`, sem adicionar regra. As
"8 regras" no `CLAUDE.md` foram **mantidas** por estarem corretas.

`npm test`: 352 arquivos validados, zero problemas.
