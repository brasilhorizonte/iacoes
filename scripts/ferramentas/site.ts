/**
 * Ponte LEVE das ferramentas: só fs/path, sem React, sem Supabase e sem o registro de conteúdo.
 * Importada pelos rodapés das páginas de ticker e macro e pelo validate-html — importar este
 * arquivo nunca pode puxar o módulo de ferramentas inteiro.
 *
 *  - toolsHubExists() / toolPageExists(slug) / readPublished(): o hub e as páginas de ferramenta
 *    estão no disco (lição dos 404 no GSC: nunca linkar página que não existe). Templates de ticker
 *    e macro linkam /ferramentas/<slug>/ SÓ com toolPageExists(slug) — o validate-html reprova
 *    link para página que não existe;
 *  - data-fonte (SPEC-v2 §E1): bloco com DADO EXTERNO (resumo ou título da CVM, nome de empresa,
 *    setor da base de mercado) é marcado no HTML com data-fonte="cvm" | "b3" e fica FORA das
 *    checagens de texto autoral (gate de marca do validate-html e termos proibidos). Um resumo
 *    real que cite a duração do teste antigo ou "potencial" não pode derrubar o build;
 *  - FORBIDDEN / forbiddenHits: termos proibidos no texto autoral (SPEC §1);
 *  - ferramentasRefs / widgetsInsideLinks: regras do validate-html (SPEC-v2 §E2 e §E6), puras
 *    para os testes.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ToolId } from './types';

/** Raiz do site (onde o gerador escreve as páginas). */
export const SITE_ROOT = join(__dirname, '..', '..');

export const TOOLS_HUB_PATH = '/ferramentas/';

/** Ferramentas publicadas (ids prontos + caminhos), escrito pelo gerador a cada build. A landing lê. */
export const PUBLICADAS_PATH = '/ferramentas/publicadas.json';

/** O hub /ferramentas/ está publicado no disco (é gerado no build; na 1ª execução ainda não existe). */
export const toolsHubExists = (root: string = SITE_ROOT): boolean => existsSync(join(root, 'ferramentas', 'index.html'));

/**
 * /ferramentas/<slug>/ está no disco. As páginas de ticker saem ANTES das ferramentas no build:
 * no dia em que uma ferramenta vira `pronto`, o link aparece no build seguinte (nunca aponta 404).
 */
export const toolPageExists = (slug: string, root: string = SITE_ROOT): boolean =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && existsSync(join(root, 'ferramentas', slug, 'index.html'));

/**
 * /ferramentas/publicadas.json — escrito pelo gerador a cada build, DEPOIS das páginas, e sem
 * data (só muda quando o que está no ar muda). É o que a landing lê para ligar um quadro.
 */
export interface PublishedJson {
  v: 1;
  /** Caminho do hub (com o basePath na prévia). */
  hub: string;
  /** Ferramentas `pronto` com página no disco (ordem do hub). */
  ids: ToolId[];
  tools: { id: ToolId; slug: string; path: string; name: string; widget: string; illustrative: boolean }[];
  /** JSONs de dado real presentes no disco (ranking, fatos, backtest). */
  data: Partial<Record<'ranking' | 'fatos' | 'backtest', string>>;
  /** Bundle com ?v=hash (js/css = runtime + widgets leves; groups = widgets pesados, ex.: calc). */
  assets: { js: string; css: string; groups: Record<string, { js: string; css: string | null }> } | null;
}

/** Lê o publicadas.json do disco (null sem arquivo ou com JSON inválido). */
export function readPublished(root: string = SITE_ROOT): PublishedJson | null {
  try {
    const o = JSON.parse(readFileSync(join(root, PUBLICADAS_PATH), 'utf-8')) as PublishedJson;
    return o && Array.isArray(o.ids) && Array.isArray(o.tools) ? o : null;
  } catch {
    return null;
  }
}

// ─── Dado externo (data-fonte) ────────────────────────────────────────────

/** Atributo que marca bloco com dado externo. Valores em uso: cvm (documentos), b3 (nomes, setores). */
export const FONTE_ATTR = 'data-fonte';
export const FONTES = ['cvm', 'b3'] as const;
export type Fonte = (typeof FONTES)[number];

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** Trechos [início, fim) de <script> e <style> (o que está dentro deles não é marcação). */
function rawRanges(html: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push([m.index, m.index + m[0].length]);
  return out;
}
const inRanges = (i: number, r: [number, number][]) => r.some(([a, b]) => i >= a && i < b);

/**
 * Tira do HTML todo elemento marcado com data-fonte (a tag de abertura, o conteúdo e a tag de
 * fechamento), contando o aninhamento de tags de mesmo nome. Marcação dentro de <script>/<style>
 * é ignorada; elemento sem fechamento perde só a tag de abertura (nunca esconde o resto da página
 * das checagens).
 */
export function stripExternal(html: string): string {
  if (!html.includes(`${FONTE_ATTR}=`)) return html;
  const raw = rawRanges(html);
  const start = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\s${FONTE_ATTR}="[^"]*"[^>]*>`, 'g');
  let out = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = start.exec(html))) {
    if (m.index < pos || inRanges(m.index, raw)) continue;
    const tag = m[1].toLowerCase();
    let end = m.index + m[0].length;
    if (!VOID_TAGS.has(tag) && !m[0].endsWith('/>')) {
      const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
      re.lastIndex = end;
      let depth = 1;
      let t: RegExpExecArray | null;
      let close = -1;
      while ((t = re.exec(html))) {
        if (inRanges(t.index, raw)) continue;
        if (t[1]) depth -= 1;
        else if (!t[0].endsWith('/>')) depth += 1;
        if (depth === 0) { close = re.lastIndex; break; }
      }
      if (close > 0) end = close;
    }
    out += `${html.slice(pos, m.index)} `;
    pos = end;
    start.lastIndex = end;
  }
  return out + html.slice(pos);
}

const ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ' };
export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });

function jsonStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => jsonStrings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== '@context') jsonStrings(x, out);
  return out;
}

/**
 * Texto AUTORAL de uma página: o visível (sem <style>, sem <script> e sem os blocos data-fonte)
 * + os textos do JSON-LD (que só leva texto autoral: o ItemList usa ticker e rótulo, nunca o
 * título da CVM). É o que as checagens de termo proibido e de marca leem.
 */
export function htmlAuthorText(html: string): string {
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return jsonStrings(JSON.parse(m[1])).join(' '); } catch { return m[1]; } })
    .join(' ');
  const body = stripExternal(html)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return `${decodeEntities(body).replace(/\s+/g, ' ').trim()} ${ld}`.trim();
}

// ─── Termos proibidos (SPEC §1 e honestidade-rotas.md) ────────────────────

/**
 * Valem para o texto autoral de toda página (texto e JSON-LD); `only` restringe ao texto
 * autoral daquela ferramenta. A marca aposentada é montada em pedaços: o literal seria acusado
 * pelo gate do validate-html, que também varre estes fontes.
 */
export const FORBIDDEN: { re: RegExp; why: string; only?: ToolId[] }[] = [
  { re: /\bcompr(e|em)\b/i, why: 'verbo de compra no imperativo (recomendação)' },
  { re: /\bvend(a|am) (já|agora|suas?|seus?)\b/i, why: 'verbo de venda no imperativo (recomendação)' },
  { re: /carteira ideal/i, why: '"carteira ideal" é recomendação' },
  { re: /melhores ações/i, why: '"melhores ações" é recomendação' },
  { re: /descobrir o que comprar/i, why: 'compliance: não repetir "descobrir o que comprar"' },
  { re: /\bpotencial\b/i, why: '"potencial" sugere promessa de ganho' },
  { re: /anomalias? estat[ií]sticas?/i, why: 'o Radar não é estatística (6 regras fixas)' },
  { re: /todas as a[çc][õo]es da B3/i, why: 'nenhuma ferramenta cobre todas as ações da B3' },
  { re: /\ba IA otimiza\b/i, why: 'a conta de Markowitz é exata; a IA só comenta' },
  { re: /testamos 1(\.000\.000| milh[ãa]o)/i, why: 'o sorteio só desenha a nuvem; o ótimo é exato' },
  { re: /alertas? (grát(is|uitos?)|gratuitos?) no WhatsApp/i, why: 'alerta em tempo real no WhatsApp é dos planos pagos' },
  { re: /sem cadastro/i, why: 'proibido prometer "sem cadastro" (CLAUDE.md)' },
  { re: /auditad[ao] por (um )?analista/i, why: 'a nota é gerada por IA, sem revisão humana no código' },
  { re: /pre[çc]o justo por IA/i, why: 'as calculadoras não usam IA' },
  { re: /em segundos/i, why: 'não prometer velocidade ("em segundos")' },
  { re: /recomendamos/i, why: 'recomendação' },
  { re: /ValuAI/, why: 'chamar a ferramenta pelo nome da tela (Valuation)' },
  { re: new RegExp(['IAn' + 'alista', 'IAl' + 'ocador', '14 ' + 'dias'].join('|')), why: 'marca aposentada / duração do teste (gate marca-aposentada)' },
  { re: /\bbaratas?\b/i, why: 'o ranking nunca rotula ações como "baratas"', only: ['ranking'] },
  { re: /oportunidades?/i, why: 'o ranking nunca rotula ações como "oportunidades"', only: ['ranking'] },
];

export function forbiddenHits(text: string, scope: ToolId | 'page'): string[] {
  const hits: string[] = [];
  for (const f of FORBIDDEN) {
    if (f.only && (scope === 'page' || !f.only.includes(scope))) continue;
    const m = f.re.exec(text);
    if (m) hits.push(`"${m[0]}" — ${f.why}`);
  }
  return hits;
}

// ─── Regras do validate-html (puras) ──────────────────────────────────────

export interface ToolRef {
  /** href | src | data-src */
  attr: string;
  /** Valor como está no HTML (com ?query/#âncora). */
  url: string;
  /** Caminho sem ?query/#âncora, começando em /ferramentas/. */
  path: string;
}

/**
 * Todas as referências estáticas a /ferramentas/... (href, src, data-src) — também as escritas
 * em strings do JS inline da landing. Concatenação dinâmica ('/ferramentas/' + slug) não casa:
 * link condicional sai do publicadas.json (campo `path`), nunca de literal.
 */
export function ferramentasRefs(html: string): ToolRef[] {
  const out: ToolRef[] = [];
  // Aspas duplas ou simples (href='/ferramentas/x/' também é link); a mesma aspa abre e fecha.
  const re = /\b(href|src|data-src)=(["'])(\/ferramentas\/[^"'#?\s<>]*)([?#][^"'\s<>]*)?\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ attr: m[1], url: m[3] + (m[4] ?? ''), path: m[3] });
  return out;
}

/** Arquivos que satisfazem um caminho: /x/ → x/index.html; /x/a.json → x/a.json; /x → x ou x/index.html. */
export function refCandidates(path: string): string[] {
  const rel = path.replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) return [`${rel}index.html`];
  return [rel, `${rel}/index.html`];
}

/**
 * Widgets (data-ia-widget) que estão dentro de um <a> (SPEC-v2 §E6: um link não pode envolver um
 * quadro com botões e abas). Ignora o que está em <script>, <style> e comentários.
 */
export function widgetsInsideLinks(html: string): string[] {
  const clean = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const out: string[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const tag = m[2].toLowerCase();
    const w = /\sdata-ia-widget="([^"]*)"/.exec(m[3] ?? '');
    if (!m[1] && w && (depth > 0 || tag === 'a')) out.push(w[1]);
    if (tag !== 'a') continue;
    if (m[1]) depth = Math.max(0, depth - 1);
    else if (!/\/\s*$/.test(m[3] ?? '')) depth += 1;
  }
  return out;
}
