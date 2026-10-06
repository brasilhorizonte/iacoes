import * as React from 'react';
import type { TickerModel } from './model';
import { SiteHeader, SiteFooter, MobileCta, Container } from './components/chrome';
import { Hero } from './components/hero';
import { Calculators } from './components/calculators';
import { Indicators, About, Dividends, Statements, CvmDocs, Faq, Aside, Peers, FinalCta } from './components/content';

/**
 * Ordem (out/2026): DCF é o gancho e mora no hero, ao lado da cotação; os múltiplos
 * sobem para a faixa logo abaixo do preço; as calculadoras vêm em seguida, antes de
 * qualquer texto. O resto (indicadores completos, dividendos, demonstrações, FAQ) fica
 * numa coluna principal com a coluna lateral de conversão (AIrton + plataforma).
 */
export function TickerPage({ m }: { m: TickerModel }) {
  return (
    <>
      <a href="#calculadoras" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2">Ir para as calculadoras</a>
      <SiteHeader m={m} />
      <main className="pb-24 lg:pb-0">
        <Hero m={m} />
        <Calculators m={m} />
        <Container className="grid gap-6 pb-4 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <Indicators m={m} />
            <Dividends m={m} />
            <Statements m={m} />
            <About m={m} />
            <CvmDocs m={m} />
            <Faq m={m} />
          </div>
          <aside className="lg:col-span-4" aria-label={`Ferramentas para ${m.symbol}`}>
            <Aside m={m} />
          </aside>
          <div className="min-w-0 space-y-6 lg:col-span-12">
            <Peers m={m} />
          </div>
        </Container>
        <FinalCta m={m} />
      </main>
      <SiteFooter m={m} />
      <MobileCta m={m} />
    </>
  );
}
