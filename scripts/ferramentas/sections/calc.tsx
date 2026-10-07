/**
 * Seção SSR da calculadora de preço justo: o exemplo resolvido (memória de cálculo) das três
 * fórmulas para uma empresa FICTÍCIA, a "Ação A", com o selo "Exemplo ilustrativo" (SPEC §1:
 * número sem dado real só com selo e sem ticker real). As contas usam as premissas padrão do
 * site e saem daqui mesmo, no build: nada vem de dado de mercado.
 *
 * Os resultados são calculados sobre os valores exibidos (2 casas), para que quem refaz a conta
 * com o que lê na tela chegue ao mesmo centavo.
 */
import * as React from 'react';
import { brl, num } from '../../ticker/lib/format';
import type { SsrProps } from './index';

/** Ação A: números fictícios, escolhidos para mostrar os métodos discordando (payout de 60%). */
export const ACAO_A = { cotacao: 25, lpa: 2, vpa: 16, proventos: 1.2 } as const;

const r2 = (v: number) => Math.round(v * 100) / 100;

function vsCotacao(v: number): string {
  const d = v / ACAO_A.cotacao - 1;
  return `${num(Math.abs(d) * 100, 1)}% ${d >= 0 ? 'acima' : 'abaixo'} da cotação`;
}

export function exemploLinhas() {
  const { lpa, vpa, proventos } = ACAO_A;
  const graham = r2(Math.sqrt(22.5 * lpa * vpa));
  return [
    { metodo: 'Graham', tipo: 'preço justo', conta: `√(22,5 × ${num(lpa)} × ${num(vpa)})`, valor: graham },
    { metodo: 'Graham com margem de 25%', tipo: 'preço justo', conta: `${num(graham)} × (1 − 0,25)`, valor: r2(graham * 0.75) },
    { metodo: 'Bazin', tipo: 'preço teto', conta: `${num(proventos)} ÷ 6%`, valor: r2(proventos / 0.06) },
    { metodo: 'Gordon', tipo: 'preço justo', conta: `${num(proventos)} × 1,04 ÷ (14% − 4%)`, valor: r2((proventos * 1.04) / (0.14 - 0.04)) },
  ];
}

export function CalcExemplo(_: SsrProps) {
  const { cotacao, lpa, vpa, proventos } = ACAO_A;
  const linhas = exemploLinhas();
  return (
    <figure className="m-0 overflow-hidden rounded-xl border bg-card" data-ssr="calc-exemplo">
      <figcaption className="space-y-2 border-b px-4 py-3 text-sm leading-relaxed">
        <span className="inline-flex rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-strong">Exemplo ilustrativo</span>
        <p className="text-muted-foreground">
          Ação A, com números fictícios: cotação de {brl(cotacao)}, LPA de {brl(lpa)}, VPA de {brl(vpa)} e média anual de proventos de {brl(proventos)} por ação. Premissas padrão do site.
        </p>
      </figcaption>
      <ol className="divide-y">
        {linhas.map((l) => (
          <li key={l.metodo} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6">
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {l.metodo} <span className="font-normal text-muted-foreground">· {l.tipo}</span>
              </div>
              <div className="font-mono text-xs text-muted-foreground tnum">{l.conta}</div>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 sm:flex-col sm:items-end sm:gap-0">
              <span className="font-mono text-base font-bold tnum">{brl(l.valor)}</span>
              <span className="text-xs text-muted-foreground">{vsCotacao(l.valor)}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Os métodos discordam porque olham para coisas diferentes. A Ação A distribui 60% do lucro ({brl(proventos)} de {brl(lpa)} por ação): pelo lucro e pelo patrimônio, o Graham fica acima da cotação; pelos proventos, Bazin e Gordon ficam abaixo. Para ver cada efeito, mude os números no modo Digitar números da calculadora.
      </p>
    </figure>
  );
}
