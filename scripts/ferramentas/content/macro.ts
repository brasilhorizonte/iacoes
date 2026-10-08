/**
 * Painel macro — /ferramentas/painel-macro/ (pedido do dono em 07/10/2026: página própria,
 * separada do Indicador de Buffett).
 *
 * Fonte de verdade: honestidade-rotas.md (Painel Macro), lido no código do app em 06/10/2026.
 * O que esta página NÃO pode dizer: que a curva de juros é "em tempo real" (é diária), que o
 * calendário é ao vivo (é uma lista com datas estimadas), que o semáforo é um modelo (são limites
 * fixos de leitura), "qualquer das 27 séries" ou "normalização automática". Os valores do widget
 * são FICTÍCIOS por decisão do dono: a página avisa isso e leva aos valores reais na plataforma.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const macro: ToolContent = {
  id: 'macro',
  slug: 'painel-macro',
  status: 'pronto',
  name: 'Painel macro',
  keyword: 'painel macroeconômico',
  title: 'Painel Macro: Selic, IPCA, Dólar e Focus num Lugar | IAções',
  description: 'Painel macroeconômico do Brasil: Selic, IPCA, IGP-M, dólar, desemprego e dívida/PIB, com as expectativas do Boletim Focus e as curvas de juros.',
  h1: 'Painel macro: os indicadores da economia brasileira em um lugar',
  answer: 'O Painel Macro é o painel macroeconômico da plataforma IAções: reúne inflação, juros, câmbio, atividade, emprego e contas públicas com as expectativas do Boletim Focus, as curvas de juros e o histórico das séries do Banco Central. Os valores do exemplo abaixo são fictícios; os reais, com a data de cada dado, ficam na plataforma.',
  blurb: 'Selic, IPCA, IGP-M, dólar, desemprego e dívida/PIB num termômetro, com o Boletim Focus, as curvas de juros e o histórico do Banco Central.',
  cta: {
    label: 'Ver os valores reais no Painel Macro',
    target: SCREENS.macro,
    screen: 'Painel Macro',
    note: 'O Painel Macro exige login. Comece com uma conta grátis; o painel completo, com as curvas de juros, a comparação de séries e todo o histórico, faz parte do plano IAções.',
  },
  finalCta: {
    title: 'Veja os indicadores de hoje no Painel Macro',
    text: 'Na plataforma, cada card mostra o valor mais recente com a data do dado e abre o histórico. As expectativas do Focus ficam ao lado de cada indicador.',
    label: 'Abrir o Painel Macro',
  },
  widget: {
    id: 'macro',
    illustrative: true,
    label: 'Exemplo ilustrativo do termômetro do Painel Macro, com valores fictícios: Selic, IPCA e IGP-M em 12 meses, dólar, desemprego e dívida bruta sobre o PIB',
    caption: 'Valores fictícios, só para mostrar como o painel funciona. Os valores reais, com a data de cada dado, estão no Painel Macro da plataforma.',
    fallback: { kind: 'chips', items: ['IPCA 12 meses', 'IGP-M 12 meses', 'Selic', 'Dólar', 'IBC-Br', 'Desemprego', 'Dívida/PIB', 'Petróleo Brent', 'VIX', 'Indicador de Buffett'] },
  },
  dataSource: 'evergreen',
  sections: [
    {
      id: 'o-que-e',
      title: 'O que é o Painel Macro',
      blocks: [
        { type: 'p', text: 'O **Painel Macro** é o painel macroeconômico da plataforma IAções. Em vez de abrir o site do Banco Central, o do IBGE e o relatório Focus separadamente, você vê os principais indicadores da economia brasileira na mesma tela, cada um com o valor mais recente, a data do dado e o histórico.' },
        { type: 'p', text: 'Ele serve para situar a análise de ações no cenário: juros altos encarecem o capital e pesam no valuation, inflação mexe com margens e reajustes, câmbio afeta exportadoras e quem tem dívida em dólar. O painel não diz o que comprar; mostra o pano de fundo para você ler o resto da análise.' },
        { type: 'note', tone: 'info', text: 'Os números do exemplo nesta página são **fictícios**. Os valores reais, atualizados com a data de cada série, ficam no Painel Macro da plataforma.' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona: o termômetro e os indicadores',
      blocks: [
        { type: 'p', text: 'O topo do painel é um termômetro de cards. Cada card traz o último valor e, ao clicar, abre a evolução histórica da série.' },
        {
          type: 'table',
          caption: 'Cards do termômetro do Painel Macro',
          head: ['Card', 'O que mede'],
          rows: [
            ['**IPCA 12M**', 'Inflação oficial acumulada em 12 meses (IBGE).'],
            ['**IGP-M 12M**', 'Índice Geral de Preços do Mercado acumulado em 12 meses (FGV), usado em reajuste de aluguel e de contratos.'],
            ['**Selic**', 'Taxa básica de juros da economia.'],
            ['**USD/BRL**', 'Cotação do dólar em reais.'],
            ['**IBC-Br 12M**', 'Índice de atividade do Banco Central, uma prévia do PIB.'],
            ['**Desemprego**', 'Taxa de desocupação da PNAD Contínua (IBGE).'],
            ['**Dívida/PIB**', 'Dívida bruta do governo geral em proporção do PIB.'],
            ['**Petróleo Brent** e **VIX**', 'Preço do petróleo de referência e o índice de volatilidade da bolsa americana.'],
            ['**Buffett B3**', 'Valor de mercado das empresas da B3 dividido pelo PIB, o [Indicador de Buffett do Brasil](/macro/indicador-de-buffett/).'],
          ],
        },
        { type: 'p', text: 'Nos indicadores que têm projeção no Boletim Focus, o card ganha uma etiqueta de leitura: Favorável, Neutro ou Atenção. É um semáforo com limites fixos, pensado para a pessoa física se situar rápido. Não é um modelo econômico nem uma recomendação.' },
      ],
    },
    {
      id: 'focus-e-juros',
      title: 'Boletim Focus, curvas de juros e histórico',
      blocks: [
        { type: 'p', text: 'Abaixo do termômetro ficam as **expectativas do Boletim Focus**, a pesquisa semanal do Banco Central com as projeções do mercado para inflação, Selic, câmbio e PIB de cada ano. O painel mostra a data da coleta e permite ver como as projeções mudaram ao longo do tempo.' },
        { type: 'p', text: 'As **curvas de juros** mostram as taxas para cada prazo: a brasileira, com base na ANBIMA e no Tesouro, atualizada a cada dia, e a dos Estados Unidos, com histórico desde 1990. Uma curva inclinada para cima indica que o mercado cobra mais para emprestar por mais tempo; uma curva invertida costuma aparecer quando se espera queda de juros à frente.' },
        { type: 'p', text: 'As **séries históricas** reúnem dados do Banco Central por categoria (inflação, juros, câmbio, atividade e outras), com períodos de 1 ano até décadas. Dá para comparar duas séries no mesmo gráfico, cada uma no seu eixo. Há ainda um calendário das próximas divulgações, com datas estimadas.' },
      ],
    },
    {
      id: 'como-usar',
      title: 'Como usar o painel na análise de ações',
      blocks: [
        {
          type: 'list',
          items: [
            '**Juros e valuation:** a Selic e a curva de juros entram no custo de capital. Quando os juros longos sobem, o valor presente dos lucros futuros cai, e o preço justo por fluxo de caixa descontado também. Veja como isso funciona na página de [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/).',
            '**Inflação e margens:** IPCA e IGP-M ajudam a entender reajustes de preço, de contratos e de aluguéis. Empresas com contratos indexados (energia, saneamento, shoppings) reagem de forma diferente das que dependem de consumo.',
            '**Câmbio:** dólar mais alto ajuda exportadoras e pesa em quem tem dívida ou custo em moeda estrangeira.',
            '**Bolsa contra a economia:** o [Indicador de Buffett do Brasil](/macro/indicador-de-buffett/) compara o valor de mercado das empresas listadas com o PIB, para situar o nível da bolsa no histórico.',
          ],
        },
        { type: 'p', text: 'O painel é contexto, não sinal. Use-o junto com a análise de cada empresa: o [ranking de ações](/ferramentas/ranking-de-acoes/), a [calculadora de preço justo](/ferramentas/calculadora-preco-justo/) e a página de cada ação.' },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'Na plataforma: quem acessa o quê',
      blocks: [
        { type: 'p', text: 'O Painel Macro fica dentro da plataforma e exige login. Com uma conta grátis você já vê parte do painel. As curvas de juros animadas, a comparação de séries, as demais categorias do histórico e as projeções do Focus sem limite fazem parte do plano IAções.' },
      ],
    },
  ],
  faq: [
    {
      q: 'O que é o Painel Macro?',
      a: 'É o painel macroeconômico da plataforma IAções. Reúne na mesma tela inflação, juros, câmbio, atividade, emprego e contas públicas, com as expectativas do Boletim Focus, as curvas de juros e o histórico das séries do Banco Central.',
    },
    {
      q: 'Quais indicadores aparecem no painel?',
      a: 'O termômetro traz IPCA e IGP-M em 12 meses, Selic, dólar, IBC-Br em 12 meses, desemprego, dívida bruta sobre o PIB, petróleo Brent, VIX e o Indicador de Buffett da B3. Cada card mostra o último valor, a data do dado e abre o histórico da série.',
    },
    {
      q: 'Os valores mostrados nesta página são reais?',
      a: 'Não. Os números do exemplo nesta página são fictícios e servem só para mostrar como o painel funciona. Os valores reais, com a data de cada dado, ficam no Painel Macro da plataforma.',
    },
    {
      q: 'O que é o Boletim Focus?',
      a: 'É a pesquisa semanal do Banco Central com as projeções de instituições do mercado para inflação, Selic, câmbio e PIB. No Painel Macro, as projeções aparecem por ano, com a data da coleta, ao lado dos indicadores.',
    },
    {
      q: 'O que querem dizer Favorável, Neutro e Atenção?',
      a: 'É um semáforo de leitura nos indicadores que têm projeção no Focus, com limites fixos, pensado para a pessoa física se situar rápido. Não é um modelo econômico nem uma recomendação de investimento.',
    },
    {
      q: 'De onde vêm os dados do painel?',
      a: 'Das séries temporais do Banco Central (que incluem dados do IBGE e da FGV), do Boletim Focus, da ANBIMA e do Tesouro para a curva de juros brasileira, e de fontes de mercado para os juros americanos. O Indicador de Buffett é calculado pela IAções com dados da B3 e do PIB.',
    },
    {
      q: 'Preciso pagar para usar o Painel Macro?',
      a: 'O painel exige login, e uma conta grátis já mostra parte dele. As curvas de juros animadas, a comparação de séries, as demais categorias do histórico e as projeções do Focus sem limite fazem parte do plano IAções.',
    },
    {
      q: 'Qual a diferença entre o Painel Macro e o Indicador de Buffett?',
      a: 'O Painel Macro reúne vários indicadores da economia. O Indicador de Buffett do Brasil é um deles, com página própria e aberta no site: o valor de mercado das empresas da B3 dividido pelo PIB, com a série desde 2000.',
    },
  ],
  sources: 'Telas e rótulos: Painel Macro da plataforma IAções. Indicadores: séries temporais do Banco Central (SGS), IBGE, FGV, Boletim Focus (BCB), ANBIMA e Tesouro Nacional. Valores do exemplo: fictícios.',
  contentRevised: '2026-10-07',
};
