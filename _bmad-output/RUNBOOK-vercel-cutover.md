# RUNBOOK — Cutover do iacoes.com.br: GitHub Pages → Vercel

Escrito pela sessão S4c em 31/ago/2026. **Nenhum passo deste documento foi executado.**
A configuração está pronta no repo; o cutover é ação humana.

Executor: Gabriel. Um passo (DNS) exige o Lucas ou o acesso à conta dele no Registro.br.

---

## 0. Estado atual (medido em 31/ago/2026, não presumido)

| Item | Valor de hoje |
|---|---|
| Servidor de produção | `server: GitHub.com` (GitHub Pages, branch `main`, path `/`) |
| Apex `iacoes.com.br` | 4 registros **A**: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` — TTL **3600** |
| `www.iacoes.com.br` | **CNAME** → `brasilhorizonte.github.io.` — TTL **3600** |
| Nameservers | `d.sec.dns.br.`, `f.sec.dns.br.` (DNS gerenciado no painel do Registro.br) |
| Registrar / titular | Registro.br — **Lucas Teixeira Noronha Mello** |
| TXT no apex | `brevo-code:f065c321947b9af50276070a9f55ec73` — **preservar** |
| CAA | **nenhum** registro CAA (bom: não bloqueia emissão de certificado) |
| `/PETR4` | 301 → `/PETR4/` |
| `/PETR4/` | 200 |
| `/petr4/` | 200 (diretório lowercase próprio, canonical → UPPERCASE) |
| Sitemap | 354 URLs, **100% com barra final** |
| Verificação de busca | `/googlef40b0a5d1cbc2d3e.html` (GSC) e `/0941qt8c38dvdna2jnm6fgek6931de.html` (IndexNow/Bing), ambos 200 |

**Anote estes valores.** São a base do rollback (seção 8).

---

## 1. Pré-requisitos

| # | O quê | Quem | Observação |
|---|---|---|---|
| 1.1 | Conta Vercel com acesso ao repo `brasilhorizonte/iacoes` no GitHub | Gabriel | Plano Hobby serve; se o site for comercial, a Vercel exige **Pro** |
| 1.2 | Acesso ao painel do Registro.br da conta que administra `iacoes.com.br` | **Lucas** (titular) | Único passo que Gabriel pode não conseguir sozinho — alinhar horário com o Lucas ANTES de começar |
| 1.3 | Acesso ao Google Search Console da propriedade `iacoes.com.br` | Gabriel | Para o passo 7.2 |
| 1.4 | Este repo com `vercel.ts`, `middleware.ts` e `.vercelignore` já em `main` | Gabriel | Ver seção 2 |

> **Plano Hobby:** o uso comercial de um domínio próprio em plano Hobby viola os Termos da
> Vercel. Se o iAcoes converte para uma plataforma paga, entre em Pro antes do cutover —
> descobrir isso depois do DNS apontado é a pior hora.

---

## 2. O que já está pronto no repo (não precisa fazer nada além de commitar)

| Arquivo | Estado |
|---|---|
| `vercel.ts` | **novo** — substitui o `vercel.json`, que foi **removido** (só um arquivo de config por projeto é permitido) |
| `middleware.ts` | **novo** — split A/B só na rota `/`, desligado por default |
| `.vercelignore` | **novo** — evita publicar `scripts/`, `_bmad*`, `.github/` e `*.md` no CDN |
| `package.json` | ganhou `@vercel/config` e `@vercel/functions` |
| `CNAME` | mantido (ver 6.3) |
| `.nojekyll` | mantido (ver 6.3) |

Mudanças de comportamento embutidas no `vercel.ts` — leia os comentários do arquivo:

- `trailingSlash: **true**` (o `vercel.json` antigo dizia `false`, o que teria transformado
  as 354 URLs canônicas do sitemap em 308).
- `cleanUrls: **false**` (o antigo dizia `true`, o que teria feito os dois arquivos `.html`
  de verificação de busca na raiz responderem 308 em vez de 200).

---

## 3. Etapa 1 — Subir o projeto na Vercel (sem tocar em DNS)

3.1 Commitar e dar push das mudanças da seção 2 para `main`.

3.2 Na Vercel: **Add New → Project → Import** o repo `brasilhorizonte/iacoes`.

3.3 Configurações do projeto (site estático, **não há build**):

| Campo | Valor |
|---|---|
| Framework Preset | `Other` |
| Build Command | vazio (ou `Override` desligado) |
| Output Directory | `.` (raiz do repo) |
| Install Command | deixar o padrão (`npm install` — precisa instalar `@vercel/functions` para o middleware) |
| Root Directory | `./` |
| Node.js Version | a mais recente LTS oferecida |

3.4 Variáveis de ambiente — **Production**:

| Nome | Valor | Por quê |
|---|---|---|
| `AB_LANDING_TEST` | `off` | Interruptor do split A/B. **Deixe `off` no cutover.** Só vire `on` depois que `/lp-b/index.html` (variante da S4b) estiver publicado — com o flag ligado e o arquivo ausente, `/` dá 404. |

3.5 Deploy. Anote a URL `*.vercel.app` gerada.

---

## 4. Etapa 2 — Validar na URL `*.vercel.app` ANTES de mexer no DNS

Rode tudo contra `https://<projeto>.vercel.app`. **Não avance com nenhum item vermelho.**

```bash
V=https://<projeto>.vercel.app

# 4.1 Landing 200
curl -sI $V/ | head -1

# 4.2 Ticker UPPERCASE serve 200 COM barra (é a URL canônica do site)
curl -sI $V/PETR4/ | head -1                      # espera: 200
curl -sI $V/PETR4  | head -3                      # espera: 308 -> /PETR4/

# 4.3 Ticker lowercase continua funcionando e canonicalizando para UPPERCASE
curl -sI $V/petr4/ | head -1                      # espera: 200
curl -s  $V/petr4/ | grep -o 'rel="canonical" href="[^"]*"'
                                                  # espera: https://iacoes.com.br/PETR4/

# 4.4 Arquivos de verificação de busca respondem 200 na URL EXATA (sem redirect)
curl -sI $V/googlef40b0a5d1cbc2d3e.html | head -1            # espera: 200
curl -sI $V/0941qt8c38dvdna2jnm6fgek6931de.html | head -1    # espera: 200

# 4.5 Headers de segurança (hoje NÃO existem em produção — é o ganho do cutover)
curl -sI $V/PETR4/ | grep -iE 'x-frame-options|x-content-type|referrer-policy|x-robots-tag'

# 4.6 Sitemap com Content-Type correto
curl -sI $V/sitemap.xml | grep -i content-type    # espera: application/xml

# 4.7 Cache imutável nos assets
curl -sI $V/assets/img/dashboard-iacoes.png | grep -i cache-control

# 4.8 404 usa a página custom (redirect case-insensitive client-side)
curl -s $V/naoexiste/ | grep -c toUpperCase       # espera: >= 1

# 4.9 Middleware NÃO afeta rota de ticker
curl -sI $V/PETR4/ | grep -ci 'x-ia-variant'      # espera: 0

# 4.10 Middleware na landing: sempre 'a' com o flag off, sem cookie de variante
curl -sI $V/ | grep -i 'x-ia-variant'             # espera: x-ia-variant: a
curl -sI $V/ | grep -ci 'set-cookie: ia_lp_variant'  # espera: 0

# 4.11 Amostra ampla de tickers — nenhum 4xx/5xx
for t in VALE3 ITUB4 BBAS3 WEGE3 ALUP11 BPAC11 CPLE5 AURA33; do
  printf "%s %s\n" "$t" "$(curl -s -o /dev/null -w '%{http_code}' $V/$t/)"
done

# 4.12 Índices e calculadoras
for p in acoes/ acoes/energia/ calculadoras/ calculadoras/juros-compostos/ airton/; do
  printf "%s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' $V/$p)"
done
```

4.13 Abrir a landing e uma página de ticker no navegador. Confirmar no DevTools:
GA4 dispara, o POST para `iacoes_page_views` retorna 201, e o Pixel do Facebook carrega.

---

## 5. Etapa 3 — Adicionar o domínio na Vercel e trocar o DNS

> **Este é o ponto sem volta rápida.** Faça em janela de baixo tráfego (a B3 fecha 18h;
> o cron de regeneração roda 20h BRT seg–sex — evite as 20h). Tenha o Lucas disponível.

### 5.1 Adicionar o domínio no projeto (Vercel)

Vercel → Project → **Settings → Domains → Add Domain**:
1. `iacoes.com.br`
2. `www.iacoes.com.br` (a Vercel oferece configurar como redirect para o apex — aceite)

A Vercel vai exibir um **domain card** com os valores de DNS exatos para **este projeto**.

> ⚠️ **Leia os valores do domain card. Não copie de tutorial nenhum, deste inclusive.**
> A documentação da Vercel é explícita: "the correct value for your project is whatever
> your domain card shows". O IP histórico do apex é `76.76.21.21`, mas projetos novos
> recebem endereços do pool anycast (ex.: `216.198.79.1`), e o alvo de CNAME é único por
> projeto (formato `xxxxxxxxxxxxxxxx.vercel-dns-0NN.com`). Registro errado = domínio fica
> "Invalid Configuration" e o certificado não é emitido.

Se aparecer pedido de **verificação de posse** (TXT `_vercel`), crie o TXT antes de seguir —
significa que o domínio já está em uso em outra conta Vercel.

### 5.2 (Opcional, recomendado) Baixar o TTL 24–48h antes

O TTL atual da zona é **3600s (1h)**. Se o painel do Registro.br permitir editar TTL,
baixe A e CNAME para **300s** e espere ≥1h antes do corte. Isso reduz a janela de rollback
de ~1h para ~5min. Se não permitir, siga com 3600 e assuma a janela maior.

### 5.3 Alterar os registros no Registro.br

Painel: `registro.br` → login do titular → **Painel → iacoes.com.br → DNS → Editar Zona**.

**Antes de editar, exporte/copie a zona inteira.** É o seu backup.

| Ação | Nome | Tipo | Valor |
|---|---|---|---|
| **REMOVER** | `@` (apex) | A | `185.199.108.153` |
| **REMOVER** | `@` (apex) | A | `185.199.109.153` |
| **REMOVER** | `@` (apex) | A | `185.199.110.153` |
| **REMOVER** | `@` (apex) | A | `185.199.111.153` |
| **CRIAR** | `@` (apex) | A | ← **valor do domain card da Vercel** |
| **ALTERAR** | `www` | CNAME | `brasilhorizonte.github.io.` → **alvo do domain card** (`xxxx.vercel-dns-0NN.com.`) |
| **NÃO TOCAR** | `@` | TXT | `brevo-code:f065c321947b9af50276070a9f55ec73` |

Notas do Registro.br:
- O apex **não pode** ser CNAME (RFC). Por isso o apex usa A e só o `www` usa CNAME.
- Não há CAA na zona hoje. **Não crie um** — CAA que não autorize `letsencrypt.org`
  impede a emissão do certificado da Vercel.
- Alternativa (não recomendada aqui): apontar os **nameservers** do domínio para os da
  Vercel. Só faça isso se quiser mover toda a gestão de DNS; se fizer, o TXT do Brevo e
  qualquer MX/SPF/DKIM de e-mail precisam ser **recriados** na Vercel antes da troca, ou
  o e-mail do domínio cai.

### 5.4 Propagação

- TTL 3600 → espere até **1 hora** para a maioria dos resolvers; caudas de resolver
  teimoso podem levar **até 24h**.
- TTL 300 (se você fez 5.2) → **~5 a 15 minutos**.
- A emissão do certificado SSL pela Vercel acontece **automaticamente** depois que o DNS
  resolve, normalmente em minutos. Até lá o domínio pode dar erro de TLS. Isso é esperado.

Acompanhe:
```bash
dig +short iacoes.com.br A
dig +short www.iacoes.com.br
curl -sI https://iacoes.com.br/PETR4/ | grep -iE '^(HTTP|server|x-vercel)'
```
O sinal de que virou: aparece `server: Vercel` (ou headers `x-vercel-*`) e some `GitHub.com`.

---

## 6. Etapa 4 — Depois que a Vercel estiver servindo

### 6.1 Repetir a bateria da seção 4 contra `https://iacoes.com.br`
Todos os itens de 4.1 a 4.12, trocando `$V` pelo domínio real. Mais:

```bash
curl -sI https://www.iacoes.com.br/ | head -3   # espera: redirect para o apex
```

### 6.2 GitHub Pages: **manter ligado por 7 dias, depois desligar**

Não desligue no mesmo dia. Enquanto o DNS propaga, uma parcela do tráfego ainda chega ao
GitHub Pages, e desligar cedo transforma essa parcela em erro.

- **Dias 0–7:** GitHub Pages continua ativo. Ele só é alcançável por quem ainda tem o DNS
  velho em cache ou por `brasilhorizonte.github.io` — não há conflito com a Vercel.
- **Dia 7+ (se tudo estável):** GitHub → repo → Settings → Pages → **Source: None**.

### 6.3 Impacto em `CNAME`, `.nojekyll` e no workflow

| Arquivo | O que fazer |
|---|---|
| `CNAME` | **Manter enquanto o GitHub Pages estiver ligado** (é ele que ensina o Pages a aceitar `iacoes.com.br`). Apagá-lo antes derruba o fallback. Depois de desligar o Pages (6.2) o arquivo vira inerte — a Vercel ignora. Pode remover no mesmo commit em que desliga o Pages, ou deixar. |
| `.nojekyll` | Só faz sentido para o GitHub Pages. Inerte na Vercel. **Deixar** — remover não ganha nada e quebraria o fallback. |
| `.github/workflows/generate-pages.yml` | **Continua igual e continua sendo o motor do site.** Ele regenera as páginas e commita em `main`; a Vercel passa a fazer deploy automático a cada push nesse branch. Nenhuma mudança necessária. |
| Geração lowercase no CI | **Continua obrigatória.** A Vercel é case-sensitive no static, exatamente como o Ubuntu do runner. Sem os diretórios lowercase, `/petr4/` vira 404. |

> ⚠️ Consequência nova: **cada push do cron vira um deploy de produção na Vercel**
> (5×/semana). É o comportamento desejado, mas confira o limite de deployments do plano.

### 6.4 Ligar o teste A/B (só depois que a S4b publicar a variante)

1. Confirme que `https://iacoes.com.br/lp-b/` responde 200 e que o arquivo tem
   `<link rel="canonical" href="https://iacoes.com.br/">`.
2. Vercel → Settings → Environment Variables → `AB_LANDING_TEST` = `on` (Production).
3. **Redeploy** (variável de ambiente só entra em vigor em novo deploy).
4. Verifique:
```bash
# humano sem cookie: recebe cookie e uma das duas variantes
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sI -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36' \
    https://iacoes.com.br/ | grep -i '^x-ia-variant'
done
# bot: SEMPRE 'a', sem cookie
curl -sI -A 'Googlebot/2.1 (+http://www.google.com/bot.html)' https://iacoes.com.br/ | grep -iE 'x-ia-variant|set-cookie'
# stickiness: com cookie b, sempre b
curl -sI -H 'Cookie: ia_lp_variant=b' https://iacoes.com.br/ | grep -i '^x-ia-variant'
# ticker intocado
curl -sI https://iacoes.com.br/PETR4/ | grep -ci 'x-ia-variant'   # espera: 0
```
5. Duração mínima do teste: **6 semanas** (dimensionamento da seção "S0 — Adendo 2" do handoff).

---

## 7. Riscos de SEO no cutover e mitigação

| Risco | Por que acontece | Mitigação |
|---|---|---|
| **Inversão de trailing slash** — as 354 URLs do sitemap virariam 308 | `vercel.json` declarava `trailingSlash: false`, mas o site inteiro é canônico COM barra | Já corrigido: `vercel.ts` usa `trailingSlash: true`. **Verificar em 4.2 antes do DNS.** |
| **Perda da verificação de propriedade** (GSC e Bing/IndexNow) | `cleanUrls: true` faria os dois `.html` da raiz responderem 308 | Já corrigido: `cleanUrls: false`. **Verificar em 4.4 antes do DNS.** Depois do cutover, revalidar em 7.2 |
| **Páginas lowercase virarem 404** | Vercel é case-sensitive; os diretórios lowercase só existem porque o CI Ubuntu os gera | Verificar 4.3 e 6.1. Nunca gerar só localmente (macOS é case-insensitive) |
| **Janela de indisponibilidade / erro de TLS durante a propagação** | Certificado só é emitido depois do DNS resolver | Baixar TTL antes (5.2); fazer fora do horário de pico; manter GitHub Pages ligado (6.2) |
| **Queda de Core Web Vitals mascarada de queda de ranking** | Infra nova, cache diferente | Rodar PageSpeed antes e depois; comparar TTFB no GSC (relatório de Estatísticas de rastreamento) |
| **Cloaking no teste A/B** | Servir conteúdo diferente para o Googlebot é penalizável | O middleware **sempre** serve `a` para bot, e a variante `b` é rewrite (URL não muda) com canonical para `/`. **Não usar `noindex` na variante** — ver CLAUDE.md, o `noindex` já causou problema de indexação neste site |
| **Descoberta acidental de `/lp-b/`** | URL existe e é rastreável | Fora do sitemap, sem link de entrada, e com `canonical` para `/`. É a orientação oficial do Google para testes A/B |
| **Cache do CDN servindo variante errada** | `/` passa a variar por cookie | `vercel.ts` marca `/` e `/lp-b/` com `Cache-Control: private, no-cache` + `Vary: Cookie` |

### 7.1 No dia seguinte
- GSC → **Inspeção de URL** em 3 URLs (`/`, `/PETR4/`, `/petr4/`): confirmar "URL está no
  Google" e que a URL canônica escolhida pelo Google não mudou.
- GSC → **Cobertura**: nenhum pico novo de "Página com redirecionamento" ou "Não encontrada (404)".

### 7.2 Na primeira semana
- Reenviar `sitemap.xml` no GSC.
- Confirmar que a propriedade continua verificada (o arquivo HTML de verificação segue 200).
- Comparar cliques/impressões vs. a semana anterior. Uma oscilação de ±10% é ruído;
  queda sustentada >25% é sinal de investigar.

---

## 8. Rollback

**Gatilho:** qualquer um destes, a qualquer momento —
site fora do ar >15 min, erro de TLS persistente >30 min, taxa de 404 acima do normal,
páginas lowercase quebradas, ou queda abrupta de tráfego orgânico.

### 8.1 Rollback rápido (não exige o Lucas, se você tiver o painel aberto)

O rollback **é o próprio DNS de volta**. O GitHub Pages continua ligado (6.2), então basta
restaurar a zona:

No Registro.br → DNS → Editar Zona:

| Ação | Nome | Tipo | Valor |
|---|---|---|---|
| **REMOVER** | `@` | A | (o IP da Vercel) |
| **CRIAR** | `@` | A | `185.199.108.153` |
| **CRIAR** | `@` | A | `185.199.109.153` |
| **CRIAR** | `@` | A | `185.199.110.153` |
| **CRIAR** | `@` | A | `185.199.111.153` |
| **ALTERAR** | `www` | CNAME | de volta para `brasilhorizonte.github.io.` |
| **NÃO TOCAR** | `@` | TXT | `brevo-code:f065c321947b9af50276070a9f55ec73` |

Tempo de volta: igual ao TTL vigente (5 min se você baixou; até 1h se não).

Confirmação:
```bash
dig +short iacoes.com.br A          # espera os quatro 185.199.*
curl -sI https://iacoes.com.br/PETR4/ | grep -i '^server'   # espera: GitHub.com
```

Pré-condições do rollback rápido, que precisam continuar verdadeiras:
- GitHub Pages **ativo** (Settings → Pages → Source: `main` / `/`).
- Arquivo `CNAME` presente no repo com `iacoes.com.br`.
- `.nojekyll` presente.

### 8.2 Rollback parcial: só desligar o teste A/B

Se o problema for a variante, e não a infra: `AB_LANDING_TEST` = `off` + redeploy.
O middleware volta a servir 100% variante `a` e **expira o cookie** dos visitantes que
tinham `b`. Não mexe em DNS.

### 8.3 Rollback do deploy, não do DNS

Se o problema for uma regressão de conteúdo já na Vercel:
Vercel → Deployments → escolher o deployment anterior bom → **Promote to Production**
(ou `vercel rollback`). Instantâneo, sem DNS.

### 8.4 Se o GitHub Pages já tiver sido desligado (após 6.2)

O rollback deixa de ser rápido: é preciso reativar Pages (Settings → Pages → Source:
`main` / `/`), esperar o build do Pages, e só então trocar o DNS. Conte **30–60 min a mais**.
Por isso a espera de 7 dias antes de desligar não é formalidade.

---

## 9. Checklist de execução (imprimir e marcar)

- [ ] 1.1–1.4 pré-requisitos confirmados; Lucas avisado do horário
- [ ] 2 — `vercel.ts`, `middleware.ts`, `.vercelignore`, `package.json` commitados em `main`
- [ ] 3 — projeto criado na Vercel, `AB_LANDING_TEST=off`, deploy verde
- [ ] 4 — bateria inteira verde na URL `*.vercel.app` (**bloqueante**)
- [ ] 5.1 — domínio adicionado na Vercel; **valores do domain card anotados**
- [ ] 5.2 — TTL baixado para 300 (opcional) e ≥1h decorrida
- [ ] 5.3 — zona do Registro.br **exportada** e alterada; TXT do Brevo preservado
- [ ] 5.4 — DNS propagado, `server: Vercel`, TLS válido
- [ ] 6.1 — bateria inteira verde em `https://iacoes.com.br`
- [ ] 7.1 — GSC inspecionado no dia seguinte
- [ ] 6.2 — 7 dias estáveis → GitHub Pages desligado
- [ ] 6.4 — (depois da S4b) `AB_LANDING_TEST=on` + redeploy + verificação do split
