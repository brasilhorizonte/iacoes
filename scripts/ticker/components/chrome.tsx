import * as React from 'react';
import type { TickerModel } from '../model';
import { ButtonLink } from './ui/button';
import { Search, ChevronRight, ArrowRight } from './icons';

export function Container({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function SiteHeader({ m }: { m: TickerModel }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/95 backdrop-blur supports-[backdrop-filter]:bg-ink/85">
      <Container className="flex h-16 items-center gap-4">
        <a href="/" className="flex shrink-0 items-center gap-3" aria-label="IAções — página inicial">
          <img src="/assets/img/institucional_branco_amarelo_3x.png" alt="Brasil Horizonte" width="82" height="40" className="h-10 w-auto" />
          <span className="h-6 w-px bg-white/20" aria-hidden="true" />
          <span className="font-mono text-lg font-bold tracking-tight"><span className="text-gold">IA</span><span className="text-white">ções</span></span>
        </a>

        <div className="relative ml-2 hidden max-w-md flex-1 md:block" data-search>
          <label htmlFor="ticker-search" className="sr-only">Buscar ação</label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
          <input
            id="ticker-search"
            type="search"
            placeholder="Buscar ação — ex.: PETR4, Itaú, WEG"
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full rounded-md border border-white/15 bg-white/5 pr-3 pl-9 text-sm text-white placeholder:text-white/45 outline-none focus:border-gold/60 focus:ring-[3px] focus:ring-gold/20"
          />
          <div id="ticker-search-results" role="listbox" className="absolute top-11 right-0 left-0 hidden overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg" />
        </div>

        <nav className="ml-auto flex items-center gap-2" aria-label="Plataforma">
          <a href="/acoes/" className="inline-flex size-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 md:hidden" aria-label="Buscar ação">
            <Search className="size-4" />
          </a>
          <ButtonLink href={m.links.generic} cta="nav-app" variant="outline-dark" size="sm" className="hidden sm:inline-flex">Entrar</ButtonLink>
          <ButtonLink href={m.links.generic} cta="nav-assinar" variant="gold" size="sm">Criar conta grátis</ButtonLink>
        </nav>
      </Container>
    </header>
  );
}

export function Breadcrumb({ m }: { m: TickerModel }) {
  const items: { href?: string; label: string }[] = [
    { href: '/', label: 'IAções' },
    { href: '/acoes/', label: 'Ações' },
    ...(m.sector && m.sectorSlug ? [{ href: `/acoes/${m.sectorSlug}/`, label: m.sector }] : []),
    { label: m.symbol },
  ];
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

export function SiteFooter({ m }: { m: TickerModel }) {
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
        </div>
        <div className="space-y-3 text-xs leading-relaxed text-muted-foreground lg:col-span-7">
          <h2 className="text-sm font-semibold text-foreground">Metodologia e aviso legal</h2>
          <p><strong className="text-foreground">Graham</strong>: √(P/L máx. × P/VP máx. × LPA × VPA), com margem de segurança opcional. <strong className="text-foreground">Bazin</strong>: dividendo médio anual ÷ dividend yield mínimo. <strong className="text-foreground">Gordon</strong>: D₀ × (1 + g) ÷ (r − g). <strong className="text-foreground">DCF</strong>: fluxo de caixa livre projetado e descontado pelo WACC (Ke = Rf + β × prêmio de risco). Dados de cotação, demonstrações e proventos da B3/CVM via brapi, atualizados em {m.todayBR}; último balanço anual: {m.lastBalance}.</p>
          <p>As estimativas desta página são geradas por modelos matemáticos e têm caráter educativo. <strong className="text-foreground">Não constituem recomendação de compra, venda ou manutenção de ativos</strong> nem garantia de rentabilidade. Investimentos em renda variável envolvem riscos; faça sua própria análise ou consulte um profissional certificado. Conheça a <a href={m.links.generic} data-cta="disclaimer" className="font-semibold text-gold-strong underline-offset-2 hover:underline">plataforma IAções</a>.</p>
          <p>© {new Date().getFullYear()} <a href="https://brasilhorizonte.com.br" target="_blank" rel="noopener" className="hover:text-foreground">Brasil Horizonte</a>. Todos os direitos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}

export function MobileCta({ m }: { m: TickerModel }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur lg:hidden" role="complementary" aria-label={`Valuation completo de ${m.symbol}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 leading-tight">
          <div className="font-mono text-sm font-bold">{m.symbol}</div>
          <div className="text-xs text-muted-foreground">DCF completo, grátis</div>
        </div>
        <ButtonLink href={m.links.dcf} cta="sticky-mobile" variant="gold" className="ml-auto">Ver DCF de {m.symbol} <ArrowRight /></ButtonLink>
      </div>
    </div>
  );
}
