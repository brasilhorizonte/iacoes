/**
 * Calculadora de preço justo — ESQUELETO (status 'rascunho'): o próximo lote escreve o conteúdo
 * e o widget `calc` (busca no valuations.json, Graham/Bazin/Gordon ao vivo, preço teto Bazin com
 * janela 1/3/5/10 anos e modo manual). Honestidade: premissas DO SITE (Graham 22,5 sem margem;
 * Bazin DY 6% sobre a média de 5 anos; Gordon r 14% e g 4%), rotuladas "premissas padrão do
 * site" — o app usa outros padrões; sem IA; cálculo no navegador; Gordon exige r > g.
 * TODO: o CTA aponta para a aba Preço justo do ativo; o widget troca o ticker do href conforme a
 * busca (o href do servidor nunca pode ficar vazio).
 */
import type { ToolContent } from '../types';

export const calc: ToolContent = {
  id: 'calc',
  slug: 'calculadora-preco-justo',
  status: 'rascunho',
  name: 'Calculadora de preço justo',
  keyword: 'calculadora de preço justo',
  title: 'Calculadora de Preço Justo e Preço Teto de Ações | IAções',
  description: 'Calcule o preço justo de ações da B3 por Graham e Gordon e o preço teto por Bazin, com as premissas padrão do site ou as suas. Cálculo no seu navegador.',
  h1: 'Calculadora de preço justo e preço teto: Graham, Bazin e Gordon',
  answer: 'A calculadora estima o preço justo por Graham e Gordon e o preço teto por Bazin com as premissas padrão do site: Graham com fator 22,5 sem margem, Bazin com dividend yield de 6% sobre a média de 5 anos e Gordon com taxa de 14% e crescimento de 4%. A conta roda no seu navegador, sem IA.',
  blurb: 'Preço justo por Graham e Gordon e preço teto por Bazin, com premissas ajustáveis.',
  cta: {
    label: 'Ver o preço justo na plataforma',
    target: { kind: 'asset', ticker: 'PETR4', tab: 'valuation' },
    screen: 'Preço justo',
    note: 'Comece com uma conta grátis e [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Ajuste as premissas na plataforma',
    text: 'Na página do ativo, a aba Preço justo mostra Graham, Bazin e Gordon com a memória de cálculo.',
    label: 'Ver o preço justo',
  },
  widget: {
    id: 'calc',
    illustrative: false,
    label: 'Calculadora de preço justo por Graham, Bazin e Gordon com dados reais',
    caption: 'Cotação e indicadores do último pregão. Premissas padrão do site; ajuste à vontade.',
    fallback: { kind: 'text', text: 'Ative o JavaScript para usar a calculadora.' },
  },
  dataSource: 'valuations',
  sections: [
    { id: 'o-que-e', title: 'O que é preço justo e preço teto', blocks: [{ type: 'todo', text: 'TODO (próximo lote): definição com a palavra-chave calculadora de preço justo.' }] },
    { id: 'como-funciona', title: 'Como funciona', blocks: [{ type: 'todo', text: 'TODO: fórmulas de Graham, Bazin e Gordon com as premissas padrão do site; r > g no Gordon.' }] },
    { id: 'na-plataforma', title: 'Preço justo na plataforma', blocks: [{ type: 'todo', text: 'TODO: aba Preço justo do ativo; o app usa outras premissas padrão.' }] },
  ],
  faq: [
    {
      q: 'A calculadora usa inteligência artificial?',
      a: 'Não. As fórmulas de Graham, Bazin e Gordon são calculadas no seu navegador, com as premissas que você escolher.',
    },
  ],
  sources: 'TODO: fontes e metodologia da calculadora (valuations.json do build).',
  contentRevised: '2026-10-06',
};
