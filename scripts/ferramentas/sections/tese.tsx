/**
 * Seções SSR da página /ferramentas/tese-de-investimento/ (texto em content/tese.ts):
 *
 *  - `tese-modelo`: o modelo de tese em 5 blocos (o conteúdo principal da página), com o exemplo
 *    ilustrativo da Ação A (empresa fictícia, selo visível) e a versão em texto para copiar. O botão
 *    "Copiar modelo" vem do widget `tese-modelo` (widgets/tese.js), que só melhora o bloco: sem JS,
 *    o texto continua selecionável e a dica diz como copiar.
 *  - `tese-ferramentas`: Minhas Teses (CTA principal, SPEC-v2 §B9) e Validador de Teses (CTA
 *    secundário) lado a lado, cada um com o deep link do SPEC §2 e data-cta `tool-tese-<tela>`.
 *
 * Texto puro, sem links internos: os links ficam nos blocos de content/tese.ts, que não linkam
 * página de ferramenta em rascunho. Nenhum <a> envolve o quadro do widget.
 */
import * as React from 'react';
import { ArrowRight, ClipboardList, ShieldCheck } from 'lucide-react';
import { ButtonLink } from '../../ticker/components/ui/button';
import { appHref, SCREENS } from '../links';
import { TESE_MODELO, TESE_MODELO_TEXTO, TESE_TELAS } from '../content/tese';
import type { SsrProps } from './index';

/** Selo do exemplo (mesmo visual do selo do quadro do widget). */
function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-strong">
      {children}
    </span>
  );
}

export function TeseModelo(_: SsrProps) {
  return (
    <div className="space-y-4" data-ssr="tese-modelo">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Selo>Exemplo ilustrativo</Selo>
        <span>Os exemplos usam a Ação A, uma empresa fictícia. Os números só mostram as contas.</span>
      </p>
      <ol className="space-y-3">
        {TESE_MODELO.map((b, i) => (
          <li key={b.titulo} className="relative rounded-xl border bg-card p-4 pl-14 sm:p-5 sm:pl-16">
            <span aria-hidden="true" className="absolute left-4 top-4 flex size-7 items-center justify-center rounded-full bg-ink font-mono text-sm font-bold text-gold sm:left-5 sm:top-5 sm:size-8">
              {i + 1}
            </span>
            <h3 className="text-base font-semibold leading-snug">
              <span className="sr-only">Bloco {i + 1}: </span>
              {b.titulo}
            </h3>
            <p className="mt-0.5 text-sm font-medium text-gold-strong">{b.pergunta}</p>
            <p className="mt-2 text-sm leading-relaxed">{b.oQue}</p>
            <p className="mt-3 rounded-lg border border-dashed border-gold/40 bg-gold/5 px-3 py-2 text-sm leading-relaxed">
              <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-strong">Exemplo</span>
              {b.exemplo}
            </p>
          </li>
        ))}
      </ol>

      {/* Versão para copiar: o widget `tese-modelo` põe o botão em [data-tese-copy]. */}
      <div className="rounded-xl border bg-muted/40 p-4 sm:p-5" data-ia-widget="tese-modelo" data-size="page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="modelo-para-copiar" className="text-base font-semibold">Versão para copiar</h3>
          <span className="flex flex-wrap items-center gap-3" data-tese-copy="" />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground" data-tese-dica="">
          Selecione o texto e copie para o seu bloco de notas ou planilha. Preencha os espaços e deixe em branco o que não usar.
        </p>
        <pre
          tabIndex={0}
          aria-labelledby="modelo-para-copiar"
          className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-card p-4 font-mono text-[12.5px] leading-relaxed text-foreground"
        >
          {TESE_MODELO_TEXTO}
        </pre>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ButtonLink href={appHref(SCREENS.teses)} cta="tool-tese-modelo" variant="gold" className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-center">
          Registrar a tese em Minhas Teses <ArrowRight />
        </ButtonLink>
        <span className="text-sm text-muted-foreground">Comece com uma conta grátis.</span>
      </div>
    </div>
  );
}

export function TeseFerramentas(_: SsrProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-ssr="tese-ferramentas">
      {TESE_TELAS.map((x) => {
        const primary = x.id === 'teses';
        const Icon = primary ? ClipboardList : ShieldCheck;
        return (
          <article key={x.id} className={`flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5 ${primary ? 'border-gold/60' : ''}`}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon className="size-4 text-gold-strong" aria-hidden="true" />
              {x.rotulo}
            </p>
            <h3 className="text-lg font-bold leading-snug">{x.titulo}</h3>
            <p className="text-sm leading-relaxed">{x.texto}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-gold-strong">
              {x.itens.map((it) => <li key={it}>{it}</li>)}
            </ul>
            <ButtonLink
              href={appHref(SCREENS[x.id])}
              cta={`tool-tese-${x.id}`}
              variant={primary ? 'gold' : 'outline'}
              className="mt-auto h-auto min-h-10 max-w-full self-start whitespace-normal py-2 text-center"
            >
              {x.cta} <ArrowRight />
            </ButtonLink>
          </article>
        );
      })}
    </div>
  );
}
