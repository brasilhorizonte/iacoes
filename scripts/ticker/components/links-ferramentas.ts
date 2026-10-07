/**
 * Links internos das páginas que recebem o tráfego novo (ticker, /acoes/, setores e a seção
 * "E as ações que você acompanha?" do Buffett) para as páginas /ferramentas/<slug>/.
 *
 * Só linka página PUBLICADA: o mesmo critério do hub em scripts/ferramentas/site.ts
 * (`toolsHubExists`): o index.html existe no disco. Lição dos 404 no GSC: nunca linkar página
 * que não existe. No build diário as páginas de ticker saem ANTES das ferramentas, então uma
 * ferramenta publicada pela primeira vez aparece nos links das páginas de ticker no build
 * seguinte (/acoes/ e setores saem depois e já a enxergam no mesmo build).
 *
 * Sem dependências pesadas (só fs/path e a ponte leve de site.ts): importar daqui não puxa o
 * módulo de ferramentas inteiro. Os slugs repetem os do registro (scripts/ferramentas/registry.ts);
 * o teste scripts/paginas-existentes.test.ts confere que batem.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { SITE_ROOT } from '../../ferramentas/site';

export const FERRAMENTAS_LINKADAS = {
  dcf: 'fluxo-de-caixa-descontado',
  calc: 'calculadora-preco-justo',
  nota: 'nota-qualitativa',
  fatos: 'fatos-relevantes',
  ranking: 'ranking-de-acoes',
} as const;

export type FerramentaLinkada = keyof typeof FERRAMENTAS_LINKADAS;

let raizOverride: string | null = null;

/** Prévia e testes: confere a existência em outra raiz (`null` volta para a raiz do site). */
export function usarRaizDasFerramentas(raiz: string | null): void {
  raizOverride = raiz;
}

/** `/ferramentas/<slug>/` quando a página está publicada no disco; senão `null` (não linka). */
export function linkFerramenta(id: FerramentaLinkada): string | null {
  const slug = FERRAMENTAS_LINKADAS[id];
  return existsSync(join(raizOverride ?? SITE_ROOT, 'ferramentas', slug, 'index.html')) ? `/ferramentas/${slug}/` : null;
}
