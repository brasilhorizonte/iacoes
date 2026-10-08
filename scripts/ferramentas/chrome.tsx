import * as React from 'react';
import { Container } from '../ticker/components/chrome';
import { ButtonLink } from '../ticker/components/ui/button';
import { ChevronRight, LayoutGrid, Search } from 'lucide-react';

/** Cabeçalho das páginas /ferramentas/: o mesmo visual das páginas de ticker e macro, sem a busca. */
export function ToolsHeader({ app, hubHref }: { app: string; hubHref: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
      <Container className="flex h-16 items-center gap-2 sm:gap-4">
        <a href="/" className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="IAções — página inicial">
          <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" width="82" height="40" className="h-8 w-auto sm:h-10" />
          <span className="h-6 w-px bg-white/20" aria-hidden="true" />
          <span className="font-mono text-lg font-bold tracking-tight"><span className="text-gold">IA</span><span className="text-white">ções</span></span>
        </a>
        {/* No celular só cabem a busca e o CTA (360 px sem rolagem lateral): "Ferramentas" fica no breadcrumb e no rodapé. */}
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Navegação principal">
          <a href={hubHref} className="hidden h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-white/80 hover:bg-white/10 sm:inline-flex">
            <LayoutGrid className="size-4" aria-hidden="true" />
            Ferramentas
          </a>
          <a href="/acoes/" className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-white/80 hover:bg-white/10 max-[359px]:hidden sm:px-3">
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Ações</span>
            <span className="sr-only sm:hidden">Ações</span>
          </a>
          <ButtonLink href={app} cta="nav-app" variant="outline-dark" size="sm" className="hidden md:inline-flex">Entrar</ButtonLink>
          <ButtonLink href={app} cta="nav-assinar" variant="gold" size="sm">Criar conta grátis</ButtonLink>
        </nav>
      </Container>
    </header>
  );
}

export function ToolsBreadcrumb({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="inline-flex items-center gap-1.5">
            {it.href ? <a href={it.href} className="transition-colors hover:text-foreground">{it.label}</a> : <span aria-current="page" className="font-medium text-foreground">{it.label}</span>}
            {i < items.length - 1 && <ChevronRight className="size-3.5" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Autoria (E-E-A-T): quem faz o IAções, com as credenciais públicas da landing (#sobre).
 * `updated` = data do dado (páginas com dado real) ou da última atualização do conteúdo. O rótulo é
 * "Atualizado em" (SPEC-v2 §B6): não alega revisão humana, que o processo não garante.
 */
export function Autoria({ updated }: { updated?: string }) {
  return (
    <section id="autoria" aria-labelledby="autoria-title" className="rounded-xl border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
      <h2 id="autoria-title" className="text-base font-semibold text-foreground">Quem faz o IAções</h2>
      <p className="mt-2">
        Página da <a href="https://brasilhorizonte.com.br" target="_blank" rel="noopener" className="font-medium text-foreground underline-offset-2 hover:underline">Brasil Horizonte</a>. A equipe da plataforma inclui{' '}
        <a href="https://www.linkedin.com/in/gabriel-dantas-a-melo-cnpi-8796b4158/" target="_blank" rel="noopener" className="font-medium text-foreground underline-offset-2 hover:underline">Gabriel Dantas de A. Melo</a> (CNPI, APIMEC) e{' '}
        <a href="https://www.linkedin.com/in/lucastnm/" target="_blank" rel="noopener" className="font-medium text-foreground underline-offset-2 hover:underline">Lucas T. Noronha Mello</a> (CGA, ANBIMA).{' '}
        <a href="/#sobre" className="font-medium text-gold-strong underline-offset-2 hover:underline">Conheça a equipe</a>.
      </p>
      {updated && <p className="mt-1">Atualizado em <time dateTime={updated}>{updated.slice(8, 10)}/{updated.slice(5, 7)}/{updated.slice(0, 4)}</time>.</p>}
    </section>
  );
}

export function ToolsFooter({ app, hubHref, sources, macroPage, padForSticky }: { app: string; hubHref: string; sources: string; macroPage: boolean; padForSticky?: boolean }) {
  return (
    // padForSticky: no celular a barra fixa do CTA cobria a última linha do rodapé (aviso legal/©).
    <footer className={`border-t bg-card${padForSticky ? ' pb-20 lg:pb-0' : ''}`} role="contentinfo">
      <Container className="grid gap-8 py-10 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <a href="/" className="inline-flex items-center gap-3 rounded-lg bg-ink px-3 py-2">
            <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" width="82" height="40" className="h-10 w-auto" loading="lazy" />
            <span className="font-mono text-base font-bold"><span className="text-gold">IA</span><span className="text-white">ções</span></span>
          </a>
          <p className="text-sm text-muted-foreground">Análise fundamentalista e valuation de ações da B3. Não somos corretora e não recebemos para indicar ativos.</p>
          <nav aria-label="Páginas do site" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="text-muted-foreground hover:text-foreground" href={hubHref}>Ferramentas</a>
            <a className="text-muted-foreground hover:text-foreground" href="/acoes/">Ações da B3</a>
            <a className="text-muted-foreground hover:text-foreground" href="/airton/">AIrton</a>
            {macroPage && <a className="text-muted-foreground hover:text-foreground" href="/macro/indicador-de-buffett/">Indicador de Buffett</a>}
            {/* Sem link para /#precos (SPEC-v2 §B2): a tabela de planos diverge do código. */}
          </nav>
          <div className="flex flex-wrap gap-3 text-sm">
            <a className="text-muted-foreground hover:text-foreground" href="https://br.linkedin.com/company/brasil-horizonte" rel="noopener" target="_blank">LinkedIn</a>
            <a className="text-muted-foreground hover:text-foreground" href="https://x.com/brasilhorizont" rel="noopener" target="_blank">X</a>
            <a className="text-muted-foreground hover:text-foreground" href="https://www.instagram.com/brasil.horizonte/" rel="noopener" target="_blank">Instagram</a>
            <a className="text-muted-foreground hover:text-foreground" href="https://t.me/brasilhorizonte" rel="noopener" target="_blank">Telegram</a>
          </div>
        </div>
        <div className="space-y-3 text-xs leading-relaxed text-muted-foreground lg:col-span-7">
          <h2 className="text-sm font-semibold text-foreground">Fontes e aviso legal</h2>
          <p>{sources}</p>
          <p>Conteúdo informativo e educativo. <strong className="text-foreground">Não constitui recomendação de compra, venda ou manutenção de ativos</strong> nem garantia de rentabilidade. A Brasil Horizonte não presta consultoria de investimentos. Investimentos em renda variável envolvem riscos; faça a sua própria análise. Conheça a <a href={app} data-cta="disclaimer" className="font-semibold text-gold-strong underline-offset-2 hover:underline">plataforma IAções</a>.</p>
          <p>© {new Date().getFullYear()} <a href="https://brasilhorizonte.com.br" target="_blank" rel="noopener" className="hover:text-foreground">Brasil Horizonte</a>. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
