/**
 * Backtest de carteira — ESQUELETO (status 'rascunho'): o próximo lote escreve o conteúdo.
 * Honestidade: testa CARTEIRAS com os pesos de hoje aplicados ao passado (viés), até 15 anos,
 * buy & hold ou rebalanceamento, com ou sem dividendos; benchmarks Ibovespa, S&P 500, Dólar e
 * CDI; não testa Graham/Bazin/teses; não modela custos nem impostos; drawdown e Sharpe só no
 * Otimizador. Widget: curvas ilustrativas sem números, com selo.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const backtest: ToolContent = {
  id: 'backtest',
  slug: 'backtest-de-carteira',
  status: 'rascunho',
  name: 'Backtest de carteira',
  keyword: 'backtest de carteira de ações',
  title: 'Backtest de Carteira: Compare com Ibovespa e CDI | IAções',
  description: 'Veja como uma carteira teria se saído contra Ibovespa e CDI, com os pesos de hoje aplicados a até 15 anos de preços. Entenda o método e os limites.',
  h1: 'Backtest de carteira: como a sua carteira teria se saído contra Ibovespa e CDI',
  answer: 'O backtest de carteira aplica os pesos de hoje aos preços do passado e compara o retorno acumulado com Ibovespa, CDI, S&P 500 e dólar, em até 15 anos. É uma ilustração do passado, não previsão, e não considera custos nem impostos.',
  blurb: 'Retorno acumulado da carteira contra Ibovespa, CDI, S&P 500 e dólar, em até 15 anos.',
  cta: {
    label: 'Abrir a Carteira',
    target: SCREENS.carteira,
    screen: 'Carteira',
    note: 'Comece com uma conta grátis e [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Rode o backtest da sua carteira',
    text: 'Cadastre a carteira, escolha o período e os benchmarks e veja o retorno acumulado.',
    label: 'Abrir a Carteira',
  },
  widget: {
    id: 'backtest',
    illustrative: true,
    label: 'Curvas ilustrativas de retorno acumulado: sua carteira, Ibovespa e CDI',
    caption: 'Exemplo ilustrativo, sem números: curvas fictícias de “Sua carteira”, “Ibovespa” e “CDI”.',
    fallback: { kind: 'text', text: 'Curvas de retorno acumulado da carteira e dos benchmarks (ilustração).' },
  },
  dataSource: 'evergreen',
  sections: [
    { id: 'o-que-e', title: 'O que é backtest de carteira', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição com a palavra-chave backtest de carteira de ações.' }] },
    { id: 'como-funciona', title: 'Como funciona', blocks: [{ type: 'todo', text: 'TODO: pesos de hoje no passado, buy & hold x rebalanceamento, dividendos, benchmarks, vieses.' }] },
    { id: 'na-plataforma', title: 'O backtest na plataforma', blocks: [{ type: 'todo', text: 'TODO: card Backtest da aba Carteira (períodos, rebalanceamento, benchmarks) e a seção do Otimizador.' }] },
  ],
  faq: [
    {
      q: 'O backtest testa estratégias como Graham ou Bazin?',
      a: 'Não. O backtest da plataforma testa carteiras: aplica os pesos de hoje aos preços do passado. Ele não testa preços justos, teses nem filtros.',
    },
  ],
  sources: 'TODO: fontes e metodologia do backtest.',
  contentRevised: '2026-10-06',
};
