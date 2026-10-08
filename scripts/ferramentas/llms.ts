/**
 * /llms.txt com DONO ÚNICO (SPEC §7): o generate-pages.ts compõe o arquivo uma vez, no fim do
 * build, com as seções de cada módulo — nenhum gerador sobrescreve o outro.
 *
 *   # IAções + resumo
 *   ## Ferramentas        ← hub e páginas publicadas nesta execução (entradas do sitemap)
 *   ## Indicadores macro  ← scripts/macro/index.ts (só com a trava do macro ligada)
 *   ## Ações              ← links gerais do site
 */
import { SITE } from '../ticker/model';
import { HUB, HUB_URL, TOOLS, toolUrl } from './registry';
import type { SitemapEntry } from './types';

export const LLMS_HEADER = `# IAções
> Análise fundamentalista e valuation de ações da B3, da Brasil Horizonte: preço justo por Graham, Bazin, Gordon e DCF, sem conflito de interesse.`;

export const LLMS_ACOES = `## Ações
- [Ações da B3](${SITE}/acoes/): preço justo por Graham, Bazin e Gordon e indicadores fundamentalistas de cada ação, atualizados todo dia útil.
- [AIrton](${SITE}/airton/): alertas de documentos da CVM com resumo por inteligência artificial.`;

/** Seção das ferramentas a partir das entradas que o generateFerramentas devolveu (só o que está no ar). */
export function ferramentasLlmsSection(entries: SitemapEntry[]): string {
  const locs = new Set(entries.map((e) => e.loc));
  const tools = TOOLS.filter((t) => locs.has(toolUrl(t)));
  if (!locs.has(HUB_URL) && !tools.length) return '';
  return [
    '## Ferramentas',
    `- [${HUB.h1}](${HUB_URL}): o que cada ferramenta faz, como funciona e onde usar na plataforma.`,
    ...tools.map((t) => `- [${t.name}](${toolUrl(t)}): ${t.blurb}`),
  ].join('\n');
}

export function composeLlmsTxt(p: { toolEntries: SitemapEntry[]; macroSection?: string }): string {
  return [LLMS_HEADER, ferramentasLlmsSection(p.toolEntries), (p.macroSection ?? '').trim(), LLMS_ACOES].filter(Boolean).join('\n\n') + '\n';
}
