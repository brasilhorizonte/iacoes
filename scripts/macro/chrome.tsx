import * as React from 'react';
import { Container } from '../ticker/components/chrome';
import { ButtonLink } from '../ticker/components/ui/button';
import { ChevronRight, Search } from '../ticker/components/icons';
import { TOOLS_HUB_PATH, toolsHubExists } from '../ferramentas/site';

/** Cabeçalho das páginas macro: mesmo visual das páginas de ticker, sem a busca (não há client.js aqui). */
export function MacroHeader({ app }: { app: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
      <Container className="flex h-16 items-center gap-4">
        <a href="/" className="flex shrink-0 items-center gap-3" aria-label="IAções — página inicial">
          <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" width="82" height="40" className="h-10 w-auto" />
          <span className="h-6 w-px bg-white/20" aria-hidden="true" />
          <span className="font-mono text-lg font-bold tracking-tight"><span className="text-gold">IA</span><span className="text-white">ções</span></span>
        </a>
        <nav className="ml-auto flex items-center gap-2" aria-label="Plataforma">
          <a href="/acoes/" className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-white/80 hover:bg-white/10">
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Ações</span>
          </a>
          <ButtonLink href={app} cta="nav-app" variant="outline-dark" size="sm" className="hidden sm:inline-flex">Entrar</ButtonLink>
          <ButtonLink href={app} cta="nav-assinar" variant="gold" size="sm">Criar conta grátis</ButtonLink>
        </nav>
      </Container>
    </header>
  );
}

export function MacroBreadcrumb({ items }: { items: { href?: string; label: string }[] }) {
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

export function MacroFooter({ app, sources }: { app: string; sources: string }) {
  return (
    <footer className="border-t bg-card" role="contentinfo">
      <Container className="grid gap-8 py-10 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <a href="/" className="inline-flex items-center gap-3 rounded-lg bg-ink px-3 py-2">
            <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" width="82" height="40" className="h-10 w-auto" loading="lazy" />
            <span className="font-mono text-base font-bold"><span className="text-gold">IA</span><span className="text-white">ções</span></span>
          </a>
          <p className="text-sm text-muted-foreground">Análise fundamentalista e valuation de ações da B3 com inteligência artificial. Sem conflito de interesse: não somos corretora e não recebemos para indicar ativos.</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a className="text-muted-foreground hover:text-foreground" href="https://br.linkedin.com/company/brasil-horizonte" rel="noopener" target="_blank">LinkedIn</a>
            <a className="text-muted-foreground hover:text-foreground" href="https://x.com/brasilhorizont" rel="noopener" target="_blank">X</a>
            <a className="text-muted-foreground hover:text-foreground" href="https://www.instagram.com/brasil.horizonte/" rel="noopener" target="_blank">Instagram</a>
            <a className="text-muted-foreground hover:text-foreground" href="https://t.me/brasilhorizonte" rel="noopener" target="_blank">Telegram</a>
          </div>
          {/* Só com o hub publicado (gerado no build por scripts/ferramentas). */}
          {toolsHubExists() && (
            <a href={TOOLS_HUB_PATH} className="inline-flex text-sm font-semibold text-gold-strong hover:underline">Ferramentas para analisar ações →</a>
          )}
        </div>
        <div className="space-y-3 text-xs leading-relaxed text-muted-foreground lg:col-span-7">
          <h2 className="text-sm font-semibold text-foreground">Fontes e aviso legal</h2>
          <p>{sources}</p>
          <p>Conteúdo informativo e educativo. <strong className="text-foreground">Não constitui recomendação de compra, venda ou manutenção de ativos</strong> nem garantia de rentabilidade. Investimentos em renda variável envolvem riscos. Conheça a <a href={app} data-cta="disclaimer" className="font-semibold text-gold-strong underline-offset-2 hover:underline">plataforma IAções</a>.</p>
          <p>© {new Date().getFullYear()} <a href="https://brasilhorizonte.com.br" target="_blank" rel="noopener" className="hover:text-foreground">Brasil Horizonte</a>. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
