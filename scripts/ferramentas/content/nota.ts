/**
 * Score Qualitativo (nota qualitativa) — ESQUELETO (status 'rascunho'): o próximo lote escreve
 * o conteúdo. Honestidade: escala de 1 a 4 (1 = pior); 6 categorias reais; 53 perguntas; nota
 * gerada por IA seguindo critérios objetivos, sem revisão humana no código (nunca "auditada por
 * analista"); sem pesos por categoria; lotes manuais (não é diária); não é recomendação.
 * Widget: barras ilustrativas na escala 1–4, com selo.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const nota: ToolContent = {
  id: 'nota',
  slug: 'nota-qualitativa',
  status: 'rascunho',
  name: 'Score Qualitativo',
  keyword: 'como avaliar uma empresa para investir',
  title: 'Como Avaliar uma Empresa para Investir: Nota 1 a 4 | IAções',
  description: 'Como avaliar uma empresa para investir com uma nota qualitativa de 1 a 4 em 6 categorias, de governança a riscos. Veja os critérios do Score Qualitativo.',
  h1: 'Como avaliar se uma empresa é boa para investir: a nota qualitativa de 1 a 4',
  answer: 'A nota qualitativa da IAções avalia a empresa de 1 a 4 (1 é a pior) em 6 categorias: Governança, Management, Indústria, Vantagens Competitivas / Barreiras à Entrada, Poder de Barganha e Riscos e Estrutura. A nota é gerada por IA a partir de 53 perguntas objetivas e não é recomendação.',
  blurb: 'Nota de 1 a 4 em 6 categorias qualitativas, de governança a riscos, gerada por IA com critérios fixos.',
  cta: {
    label: 'Abrir o Score Qualitativo',
    target: SCREENS.score,
    screen: 'Score',
    note: 'Comece com uma conta grátis e [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Veja a nota qualitativa das empresas',
    text: 'Compare as notas por categoria e abra o detalhe de cada empresa.',
    label: 'Abrir o Score Qualitativo',
  },
  widget: {
    id: 'nota',
    illustrative: true,
    label: 'Barras ilustrativas das 6 categorias da nota qualitativa, na escala de 1 a 4',
    caption: 'Exemplo ilustrativo: notas fictícias, sem empresa real.',
    fallback: { kind: 'chips', items: ['Governança', 'Management', 'Indústria', 'Vantagens Competitivas / Barreiras à Entrada', 'Poder de Barganha', 'Riscos e Estrutura'] },
  },
  dataSource: 'evergreen',
  sections: [
    { id: 'o-que-e', title: 'Como avaliar uma empresa para investir', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição com a palavra-chave; o que é análise qualitativa.' }] },
    { id: 'como-funciona', title: 'Como funciona a nota de 1 a 4', blocks: [{ type: 'todo', text: 'TODO: 6 categorias, 53 perguntas, escala 1–4, sem pesos por categoria, IA com critérios fixos.' }] },
    { id: 'na-plataforma', title: 'O Score Qualitativo na plataforma', blocks: [{ type: 'todo', text: 'TODO: aba Score (lista, detalhe, comparação) e onde a nota aparece.' }] },
  ],
  faq: [
    {
      q: 'A nota qualitativa é revisada por um analista?',
      a: 'Não. A nota é gerada por IA seguindo critérios objetivos e fixos. Ela é um ponto de partida para o estudo, não recomendação.',
    },
  ],
  sources: 'TODO: fontes e metodologia do Score Qualitativo.',
  contentRevised: '2026-10-06',
};
