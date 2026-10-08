/**
 * Exemplo de seção SSR (ponto de partida para os autores). NÃO está registrado em SECTIONS: o
 * teste registra, renderiza e remove. Recebe o modelo da página (m: título, ferramenta, m.env com
 * os dados do build) e o bloco do conteúdo (block.props).
 */
import * as React from 'react';
import type { SsrProps } from './index';

export function ExemploSecao({ m, block }: SsrProps) {
  const itens = Array.isArray(block.props?.itens) ? (block.props.itens as unknown[]).map(String) : [];
  return (
    <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed" data-ssr="exemplo">
      <p className="text-muted-foreground">Seção SSR de exemplo da página {m.tool.name}.</p>
      {itens.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {itens.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
    </div>
  );
}
