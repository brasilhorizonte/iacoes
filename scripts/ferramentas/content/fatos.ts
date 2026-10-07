/**
 * Fatos relevantes (Documentos da CVM) — ESQUELETO (status 'rascunho') com DADO REAL: a lista
 * de documentos e o dados.json já saem do build (scripts/ferramentas/data.ts). O próximo lote
 * escreve o texto. Honestidade: tipos reais Fato Relevante, Comunicado ao Mercado, Press Release
 * (e ITR/DFP sem resumo; não existe "Aviso aos Acionistas"); o resumo é gerado por IA, pode errar
 * e não substitui o documento; alertas em tempo real só nos planos pagos; FII/ETF/BDR não
 * disparam alerta; não citar contagens de documentos ou de empresas.
 * Tokens: {data} = data do documento mais recente (dd/mm/aaaa), {n} = itens na lista.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const fatos: ToolContent = {
  id: 'fatos',
  slug: 'fatos-relevantes',
  status: 'rascunho',
  name: 'Documentos da CVM',
  keyword: 'fatos relevantes',
  title: 'Fatos Relevantes da B3 e CVM com Resumo por IA | IAções',
  description: 'Os fatos relevantes, comunicados ao mercado e press releases mais recentes das empresas da B3, com resumo gerado por IA. Atualizado em {data}.',
  h1: 'Fatos relevantes e comunicados das empresas da B3, resumidos por IA',
  answer: 'Estes são os fatos relevantes, comunicados ao mercado e press releases mais recentes das empresas da B3 publicados na CVM, com um resumo gerado por IA; o documento mais recente é de {data}. O resumo pode errar e não substitui o documento oficial.',
  blurb: 'Últimos fatos relevantes, comunicados e press releases das empresas da B3, com resumo por IA.',
  cta: {
    label: 'Receber alertas na plataforma',
    target: SCREENS.notificacoes,
    screen: 'Central de Notificações',
    note: 'Comece com uma conta grátis. Alertas em tempo real no WhatsApp e no Telegram são dos planos pagos: [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Acompanhe os documentos das suas ações',
    text: 'Escolha os ativos e os canais na Central de Notificações da plataforma.',
    label: 'Abrir a Central de Notificações',
  },
  widget: {
    id: 'fatos',
    illustrative: false,
    label: 'Feed dos documentos mais recentes publicados na CVM, com resumo por IA',
    caption: 'Documentos reais publicados na CVM; resumos gerados por IA (podem conter erros). Atualizado em {data}.',
  },
  dataSource: 'fatos',
  sections: [
    { id: 'ultimos', title: 'Últimos documentos publicados', blocks: [{ type: 'fatos-list', limit: 12 }] },
    { id: 'o-que-e', title: 'O que é um fato relevante', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição com a palavra-chave fatos relevantes; diferença entre FR, CM e PR.' }] },
    { id: 'na-plataforma', title: 'Documentos da CVM na plataforma', blocks: [{ type: 'todo', text: 'TODO: feed, leitor, aba Documentos do ativo e alertas (tempo real só nos planos pagos).' }] },
  ],
  faq: [
    {
      q: 'O resumo por IA substitui o documento?',
      a: 'Não. O resumo é gerado por IA, pode conter erros e serve para triagem. Leia sempre o documento oficial na CVM antes de decidir.',
    },
  ],
  sources: 'Documentos: CVM (fatos relevantes, comunicados ao mercado e press releases). Resumos gerados por IA.',
  contentRevised: '2026-10-06',
};
