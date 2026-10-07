/**
 * Seções SSR específicas por ferramenta — ponto de extensão do page.tsx.
 *
 * Quando o conteúdo de uma ferramenta precisa de algo que os blocos de content/<id>.ts não
 * desenham (uma tabela com dado do build, um exemplo numérico com controles, um modelo de tese),
 * o autor escreve um componente React e o chama do conteúdo:
 *
 *   1. scripts/ferramentas/sections/<id>.tsx exporta um componente do tipo `SsrSection`
 *      (recebe { m, block }: m = modelo da página, com m.env para os dados; block.props = o que
 *      o conteúdo passou). Copie sections/exemplo.tsx.
 *   2. Registre aqui, em SECTIONS: uma linha de import + uma entrada. Chave = `<id da ferramenta>`
 *      ou `<id>-<nome>` (ex.: 'backtest-benchmarks').
 *   3. Em content/<id>.ts, ponha `{ type: 'ssr', id: '<chave>', props: {...} }` na posição
 *      desejada dentro de uma seção (o H2 é da seção; o componente desenha o corpo).
 *
 * Regras: o componente roda no build (renderToStaticMarkup), sem estado nem efeito; texto
 * autoral segue o SPEC §1 (os testes varrem o HTML renderizado); dado externo (texto da CVM, nome
 * de empresa) vai num elemento com data-fonte="cvm" | "b3"; link para o app só com data-cta e
 * href do appHref (links.ts); classes Tailwind valem (styles.css escaneia esta pasta).
 * Chave inexistente quebra a página daquela ferramenta (a anterior continua no ar) e é acusada
 * pelo teste (unknownSections).
 */
import type * as React from 'react';
import type { ToolPageModel } from '../model';
import type { SsrBlock, ToolContent } from '../types';
import { BacktestTabela } from './backtest';
import { CalcExemplo } from './calc';
import { DcfExemplo, DcfSensibilidade, DcfWacc } from './dcf';
import { FatosEmpresas } from './fatos';
import { MarkowitzExemplo } from './markowitz';
import { NotaAtivo } from './nota';
import { RankingSecao } from './ranking';
import { TeseFerramentas, TeseModelo } from './tese';

export interface SsrProps {
  m: ToolPageModel;
  block: SsrBlock;
}

export type SsrSection = (p: SsrProps) => React.ReactElement | null;

/** Mapa chave → componente. Vazio de propósito: cada autor registra a sua seção aqui. */
export const SECTIONS: Record<string, SsrSection> = {
  backtest: BacktestTabela,
  'calc-exemplo': CalcExemplo,
  'dcf-exemplo': DcfExemplo,
  'dcf-wacc': DcfWacc,
  'dcf-sensibilidade': DcfSensibilidade,
  fatos: FatosEmpresas,
  'markowitz-exemplo': MarkowitzExemplo,
  'nota-ativo': NotaAtivo,
  ranking: RankingSecao,
  'tese-modelo': TeseModelo,
  'tese-ferramentas': TeseFerramentas,
};

/** Chaves de seção SSR usadas no conteúdo de uma ferramenta. */
export function ssrIds(t: ToolContent): string[] {
  return t.sections.flatMap((s) => s.blocks.filter((b): b is SsrBlock => b.type === 'ssr').map((b) => b.id));
}

/** Chaves usadas no conteúdo e não registradas em SECTIONS. */
export function unknownSections(t: ToolContent): string[] {
  return ssrIds(t).filter((id) => !Object.prototype.hasOwnProperty.call(SECTIONS, id));
}
