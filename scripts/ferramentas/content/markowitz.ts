/**
 * Otimizador de carteira (Markowitz) — ESQUELETO (status 'rascunho'): o próximo lote escreve
 * o conteúdo. Honestidade (honestidade-rotas.md): a conta é matemática exata e a IA só comenta;
 * o sorteio só desenha a nuvem (nunca "testamos 1 milhão para achar a melhor"); retorno esperado
 * é premissa; volatilidade e correlação são do passado (~1 ano); 2 a 20 ativos em R$, sem venda a
 * descoberto; é referência de cálculo, não recomendação. Widget: port do MarkowitzExplainer com
 * rótulos "Ação A…E" (nunca tickers reais em posições inventadas).
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const markowitz: ToolContent = {
  id: 'markowitz',
  slug: 'markowitz',
  status: 'rascunho',
  name: 'Otimizador de carteira (Markowitz)',
  keyword: 'teoria de markowitz',
  title: 'Teoria de Markowitz: Fronteira Eficiente na Prática | IAções',
  description: 'Entenda a teoria de Markowitz e a fronteira eficiente: risco, retorno esperado e correlação. No Otimizador da IAções, a conta é exata e a IA só comenta.',
  h1: 'Teoria de Markowitz na prática: a fronteira eficiente da sua carteira',
  answer: 'A teoria de Markowitz mostra como combinar ativos para ter o maior retorno esperado em cada nível de risco; o conjunto dessas carteiras é a fronteira eficiente. No Otimizador da IAções, a conta é matemática exata, feita com as suas premissas, e a IA só comenta o resultado.',
  blurb: 'Fronteira eficiente e carteira de maior Sharpe com as suas premissas, de 2 a 20 ativos.',
  cta: {
    label: 'Abrir o Otimizador',
    target: SCREENS.otimizador,
    screen: 'Otimizador',
    note: 'Comece com uma conta grátis e [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Teste a teoria de Markowitz na sua carteira',
    text: 'Importe ou digite a carteira, confira as premissas e veja a fronteira eficiente com os seus números.',
    label: 'Abrir o Otimizador',
  },
  widget: {
    id: 'markowitz',
    illustrative: true,
    label: 'Animação ilustrativa da fronteira eficiente com ativos fictícios',
    caption: 'Exemplo ilustrativo com ativos fictícios (Ação A a Ação E).',
    fallback: { kind: 'text', text: 'Nuvem de carteiras, fronteira eficiente e reta da taxa livre de risco (ilustração).' },
  },
  dataSource: 'evergreen',
  sections: [
    { id: 'o-que-e', title: 'O que é a teoria de Markowitz', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição em 2-3 parágrafos com a palavra-chave teoria de markowitz.' }] },
    { id: 'como-funciona', title: 'Como funciona', blocks: [{ type: 'todo', text: 'TODO: risco, retorno esperado (premissa), correlação (passado, ~1 ano), fronteira, Sharpe e tangência.' }] },
    { id: 'na-plataforma', title: 'O Otimizador na plataforma', blocks: [{ type: 'todo', text: 'TODO: passos reais da tela (importação, Premissas da otimização, Relatório da otimização) e limites (2 a 20 ativos em R$).' }] },
  ],
  faq: [
    {
      q: 'Quem faz a conta da otimização?',
      a: 'A própria matemática de Markowitz, com as suas premissas: a solução é exata. A IA da plataforma só comenta o resultado.',
    },
  ],
  sources: 'TODO: fontes e metodologia do Otimizador.',
  contentRevised: '2026-10-06',
};
