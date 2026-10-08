/**
 * Seção SSR "nota-ativo" (content/nota.ts, seção "Na plataforma"): o link secundário da página, para
 * a página da ação no app. Lá a nota de cada empresa (nota final, 6 categorias e radar) fica aberta a
 * qualquer conta, inclusive a grátis; a aba Score, destino do CTA principal, é do plano IAções.
 *
 * O app só abre a página da ação com o ticker no caminho (/ativo/{TICKER}), então o link depende do
 * ticker que a pessoa digita: o quadro é o widget `nota` em modo "ativo" (widgets/nota.js monta o campo
 * e o deep link /authnew?ref=iacoes&utm_medium=ferramentas&next=/ativo/T, com data-cta
 * "tool-nota-ativo"). Sem JavaScript fica o caminho pelo site: a página de cada ação, listada em
 * /acoes/, tem o link para a mesma ação na plataforma.
 */
import * as React from 'react';

export function NotaAtivo() {
  return (
    <div id="ver-nota" className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5" data-ssr="nota-ativo">
      <h3 className="text-base font-semibold">Ver a nota de uma empresa na plataforma</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Digite o ticker para abrir a página da ação na plataforma IAções. A página pede login; quando a empresa tem nota, a nota final, as 6 categorias e o radar aparecem até na conta grátis.
      </p>
      <div className="mt-3 min-h-[96px]" data-ia-widget="nota" data-size="page" data-mode="ativo" role="region" aria-label="Abrir a página de uma ação na plataforma">
        <p className="text-sm leading-relaxed">
          Escolha a ação em <a href="/acoes/" className="font-medium text-gold-strong underline-offset-2 hover:underline">Ações da B3</a>: a página de cada uma tem o link para a mesma ação na plataforma.
        </p>
      </div>
    </div>
  );
}
