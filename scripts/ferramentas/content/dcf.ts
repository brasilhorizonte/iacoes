/**
 * Valuation por DCF — ESQUELETO (status 'rascunho'): o próximo lote escreve o conteúdo.
 * Honestidade: a IA PROPÕE premissas ancoradas no histórico e você decide (texto da própria
 * tela); não existe "IA questionando suas premissas"; DCF de 10 anos (5 explícitos + 5 de
 * convergência); WACC decomposto; sensibilidade WACC × g; não prometer PDF, cenários
 * editáveis nem "em segundos"; só ações da B3 (sem BDR/ETF/FII; bancos têm aviso).
 * Widget: tabela de sensibilidade com valores ilustrativos, sem ticker, com selo.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const dcf: ToolContent = {
  id: 'dcf',
  slug: 'fluxo-de-caixa-descontado',
  status: 'rascunho',
  name: 'Valuation por DCF',
  keyword: 'fluxo de caixa descontado',
  title: 'Fluxo de Caixa Descontado (DCF): Valuation de Ações | IAções',
  description: 'Entenda o fluxo de caixa descontado (DCF): projeção de 10 anos, WACC e perpetuidade. No Valuation da IAções, a IA propõe as premissas e você decide.',
  h1: 'Fluxo de caixa descontado (DCF): como chegar ao valor de uma ação',
  answer: 'O fluxo de caixa descontado (DCF) estima o valor de uma empresa somando o caixa que ela deve gerar no futuro, trazido a valor presente pelo custo de capital (WACC). No Valuation da IAções, o DCF tem 10 anos de projeção; a IA propõe premissas ancoradas no histórico e você decide.',
  blurb: 'DCF de 10 anos com WACC decomposto e sensibilidade WACC × g; a IA propõe as premissas e você decide.',
  cta: {
    label: 'Abrir o Valuation',
    target: SCREENS.valuation,
    screen: 'Valuation',
    note: 'Comece com uma conta grátis e [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Monte o seu DCF',
    text: 'Escolha a ação, confira as premissas propostas e ajuste o que quiser.',
    label: 'Abrir o Valuation',
  },
  widget: {
    id: 'dcf',
    illustrative: true,
    label: 'Tabela ilustrativa de sensibilidade do preço justo ao WACC e ao crescimento na perpetuidade',
    caption: 'Exemplo ilustrativo: valores fictícios, sem empresa real.',
    fallback: { kind: 'text', text: 'Tabela de sensibilidade WACC × crescimento na perpetuidade (ilustração).' },
  },
  dataSource: 'evergreen',
  sections: [
    { id: 'o-que-e', title: 'O que é fluxo de caixa descontado', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição com a palavra-chave fluxo de caixa descontado.' }] },
    { id: 'como-funciona', title: 'Como funciona', blocks: [{ type: 'todo', text: 'TODO: FCFF, WACC (Ke e Kd), 5 anos explícitos + 5 de convergência, perpetuidade, sensibilidade.' }] },
    { id: 'na-plataforma', title: 'O Valuation na plataforma', blocks: [{ type: 'todo', text: 'TODO: Premissas refinadas pela IA (a IA propõe, você decide), Modelo DCF Bottom-Up, limites.' }] },
  ],
  faq: [
    {
      q: 'A IA faz o valuation por mim?',
      a: 'Não. A IA propõe premissas ancoradas no histórico da empresa, com justificativa, e você decide quais usar. O modelo é seu.',
    },
  ],
  sources: 'TODO: fontes e metodologia do Valuation (DCF).',
  contentRevised: '2026-10-06',
};
