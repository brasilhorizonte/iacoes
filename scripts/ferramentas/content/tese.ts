/**
 * Validador de Teses e Minhas Teses — ESQUELETO (status 'rascunho'): o próximo lote escreve o
 * conteúdo. Honestidade: o Validador é uma auditoria por IA da ARGUMENTAÇÃO (não compara com
 * números, não dá confiança nem preço-alvo); Minhas Teses guarda preço-alvo, confiança (1–10) e
 * até 7 critérios mín/máx conferidos 1 vez por dia; avisos de critério/preço-alvo só nos planos
 * pagos, no resumo diário; nunca alerta instantâneo nem alerta de crescimento de receita.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const tese: ToolContent = {
  id: 'tese',
  slug: 'tese-de-investimento',
  status: 'rascunho',
  name: 'Validador de Teses e Minhas Teses',
  keyword: 'tese de investimento',
  title: 'Tese de Investimento: Modelo e Validador com IA | IAções',
  description: 'Como montar uma tese de investimento e colocá-la à prova: o Validador audita a argumentação com IA e Minhas Teses guarda preço-alvo e critérios.',
  h1: 'Tese de investimento: monte a sua e coloque à prova',
  answer: 'Uma tese de investimento explica por que você acredita numa empresa e o que precisa acontecer para a ideia dar certo. Na IAções, o Validador de Teses audita a argumentação com IA, e Minhas Teses guarda o preço-alvo, a confiança e até 7 critérios, conferidos uma vez por dia.',
  blurb: 'Validador que audita a argumentação da sua tese com IA e Minhas Teses com preço-alvo e critérios.',
  cta: {
    label: 'Abrir o Validador de Teses',
    target: SCREENS.validador,
    screen: 'Validador',
    note: 'Comece com uma conta grátis e [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Coloque a sua tese à prova',
    text: 'Escreva a tese ou anexe um relatório e veja onde a argumentação se sustenta.',
    label: 'Abrir o Validador',
  },
  widget: {
    id: 'tese',
    illustrative: true,
    label: 'Cartão ilustrativo de tese com critérios mínimos e máximos sendo conferidos',
    caption: 'Exemplo ilustrativo: tese e critérios fictícios, sem empresa real.',
    fallback: { kind: 'text', text: 'Cartão de tese com preço-alvo, confiança e critérios conferidos (ilustração).' },
  },
  dataSource: 'evergreen',
  sections: [
    { id: 'o-que-e', title: 'O que é uma tese de investimento', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição com a palavra-chave tese de investimento e um modelo de estrutura.' }] },
    { id: 'como-funciona', title: 'Como colocar a tese à prova', blocks: [{ type: 'todo', text: 'TODO: Validador (auditoria da argumentação, sem números) e Minhas Teses (critérios diários).' }] },
    { id: 'na-plataforma', title: 'Validador e Minhas Teses na plataforma', blocks: [{ type: 'todo', text: 'TODO: rótulos reais das telas; avisos só nos planos pagos, no resumo diário.' }] },
  ],
  faq: [
    {
      q: 'O Validador compara a tese com os números da empresa?',
      a: 'Não. O Validador é uma auditoria por IA da argumentação: aponta onde a tese se sustenta e onde é frágil. Ele não calcula indicadores nem dá preço-alvo.',
    },
  ],
  sources: 'TODO: fontes e metodologia do Validador e de Minhas Teses.',
  contentRevised: '2026-10-06',
};
