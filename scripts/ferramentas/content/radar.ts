/**
 * Radar de oportunidades — página de referência de qualidade do lote (SPEC §3).
 *
 * Fonte de verdade: honestidade-rotas.md (Radar) e a ficha do app (components/Radar.tsx,
 * lidos em 06/10/2026). O que esta página NÃO pode dizer: "anomalias estatísticas", que o
 * Radar cobre o mercado inteiro, "descobrir o que comprar", que é IA, que envia alertas, ou
 * qualquer contagem/lista de tickers (a página é evergreen; o widget é ilustrativo).
 * O "ROIC > 10%" da tela é, na prática, ROA (lucro 12m ÷ ativo total): a página diz ROA.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const RADAR_LISTS = [
  'Oportunidades Claras',
  'Reprecificação (Momentum)',
  'Distorções de Valuation',
  'PEG Ratio (< 1)',
  'Small Caps Ignoradas',
  'Riscos Elevados',
] as const;

export const radar: ToolContent = {
  id: 'radar',
  slug: 'radar-de-oportunidades',
  status: 'pronto',
  name: 'Radar de oportunidades',
  keyword: 'radar de ações',
  title: 'Radar de Ações: Distorções de Valuation e Triagem | IAções',
  description: 'O Radar da IAções aplica 6 regras fixas a indicadores de ações da B3 e separa os papéis em 6 listas, de distorções de valuation a riscos elevados.',
  h1: 'Radar de oportunidades: a triagem automática das ações da B3',
  answer: 'O Radar de oportunidades é a tela de triagem da plataforma IAções: aplica 6 regras fixas de corte a indicadores como P/L, crescimento do lucro, dívida e volume negociado, e separa os papéis em 6 listas. Não usa IA e não é recomendação: aponta por onde começar o estudo.',
  blurb: 'Triagem por 6 regras fixas: distorções de valuation, PEG, reprecificação, small caps ignoradas e riscos elevados.',
  cta: {
    label: 'Abrir o Radar na plataforma',
    target: SCREENS.radar,
    screen: 'Radar',
    note: 'Comece com uma conta grátis. O Radar completo faz parte dos planos pagos: [veja o que cada plano inclui](/#precos).',
  },
  finalCta: {
    title: 'Use o Radar com os dados mais recentes',
    text: 'Na plataforma, as listas são recalculadas toda vez que você abre a tela. Escolha o mercado todo, um porte ou a sua carteira e clique em um papel para abrir a análise completa.',
    label: 'Abrir o Radar',
  },
  widget: {
    id: 'radar',
    illustrative: true,
    label: 'Demonstração ilustrativa do Radar: as seis listas acendem em sequência e mostram a regra de cada uma',
    caption: 'Exemplo ilustrativo: as listas e as regras são as do Radar. Os papéis de cada lista só aparecem na plataforma.',
    fallback: { kind: 'chips', items: [...RADAR_LISTS] },
  },
  dataSource: 'evergreen',
  sections: [
    {
      id: 'o-que-e',
      title: 'O que é o Radar de oportunidades',
      blocks: [
        { type: 'p', text: 'O **Radar de oportunidades** é a tela de triagem da plataforma IAções. Em vez de olhar centenas de papéis um a um, você vê em quais listas cada ação cai quando passa por seis regras fixas: P/L contra a média do setor, crescimento do lucro, rentabilidade, endividamento e volume negociado.' },
        { type: 'p', text: 'É um radar de ações no sentido literal: aponta onde olhar, não o que fazer. Cada lista mostra, ao lado de cada papel, o motivo da entrada (o P/L atual, o PEG, a relação Dívida/EBITDA), e um clique abre a página da ação na plataforma para o estudo continuar.' },
        { type: 'p', text: 'O Radar não usa inteligência artificial nem modelo estatístico. São regras simples, iguais para todos os papéis, calculadas no seu navegador com os dados mais recentes da plataforma. A única peça que vem de outra ferramenta é a Nota Qualitativa, usada na lista Oportunidades Claras e na ordem dos papéis dentro das listas.' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona: as 6 regras do Radar',
      blocks: [
        { type: 'p', text: 'Cada lista é uma regra de corte. O papel entra quando cumpre o critério e sai quando deixa de cumprir. Não existe peso, pontuação ou previsão.' },
        {
          type: 'table',
          caption: 'As seis listas do Radar e o critério de cada uma',
          head: ['Lista', 'Regra', 'Ao lado do papel'],
          rows: [
            ['**Oportunidades Claras**', 'Tem Nota Qualitativa, está em Distorções de Valuation e em pelo menos mais uma lista: Reprecificação, PEG Ratio ou Small Caps Ignoradas', 'Nota Qualitativa'],
            ['**Reprecificação (Momentum)**', 'Crescimento do lucro acima de 10%, ROA acima de 10% e P/L abaixo de 20', 'Crescimento do lucro (%)'],
            ['**Distorções de Valuation**', 'P/L positivo e abaixo de 50% da média de P/L do setor', 'P/L atual'],
            ['**PEG Ratio (< 1)**', 'P/L dividido pelo crescimento do lucro (%), com os dois positivos, abaixo de 1', 'PEG'],
            ['**Small Caps Ignoradas**', 'Porte Small ou Micro (valor de mercado abaixo de R$ 2 bilhões) e crowdedness abaixo de 0,8', 'Crowdedness'],
            ['**Riscos Elevados**', 'Dívida líquida/EBITDA acima de 3,5, ou lucro caindo mais de 10% com Dívida/EBITDA acima de 2', 'Dívida/EBITDA'],
          ],
        },
        { type: 'h3', text: 'As contas por trás das regras' },
        { type: 'formula', text: 'PEG = P/L ÷ crescimento do lucro em 12 meses (%)' },
        { type: 'formula', text: 'Crowdedness = volume do último pregão ÷ média de volume dos 10 últimos pregões' },
        { type: 'formula', text: 'Distorção: P/L do papel < 0,5 × média simples do P/L do setor (só P/L entre 0 e 100)' },
        {
          type: 'list',
          items: [
            '**Crescimento do lucro:** lucro dos últimos 4 trimestres contra os 4 anteriores, na parte dos acionistas controladores.',
            '**ROA:** lucro de 12 meses ÷ ativo total. A tela chama esse critério de ROIC, mas o número usado é o ROA.',
            '**Porte:** Micro abaixo de R$ 1 bilhão de valor de mercado, Small abaixo de R$ 2 bilhões, Mid abaixo de R$ 10 bilhões e Large a partir de R$ 10 bilhões.',
          ],
        },
        { type: 'h3', text: 'Ordem dentro das listas e os rankings Top 20' },
        { type: 'p', text: 'Dentro de cada lista, os papéis aparecem da maior para a menor Nota Qualitativa; quem não tem nota fica no fim. A lista do PEG é a exceção: vai do menor PEG para o maior.' },
        { type: 'p', text: 'Abaixo das seis listas, o Radar mostra quatro rankings Top 20, já sem os papéis de Riscos Elevados: menor P/L (a partir de 0,1), maior ROE, maior dividend yield de 12 meses e maior crowdedness.' },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'O Radar na plataforma',
      blocks: [
        { type: 'p', text: 'Na plataforma, o Radar fica na aba **Radar**. A tela tem três partes, de cima para baixo:' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**Rotação de Carteiras:** uma matriz com o retorno de cada setor, ponderado por valor de mercado, em seis horizontes (1D, 7D, 1M, 6M, 12M e YTD). Entram só papéis com pelo menos R$ 300 milhões de valor de mercado e R$ 1 milhão negociado por dia, sem fundos imobiliários, e a conta usa a variação do preço, sem proventos. Clicar em um setor lista as ações dele e filtra o Radar.',
            '**Radar & Distorções:** os seis cartões das listas, cada um com a contagem, a descrição da regra e os papéis com o motivo da entrada. No topo, você escolhe entre **Mercado** e **Carteira** e o porte: Todas, Large Cap, Mid Cap, Small Cap ou Micro Cap.',
            '**Rankings:** os quatro Top 20 (Top Value, Top Quality, Top Yield e Top Crowded). Não confunda com a aba Rankings da plataforma, que é a tela de filtros por indicador.',
          ],
        },
        { type: 'p', text: 'Clicar em qualquer papel abre a página da ação na plataforma, com preço justo, indicadores, proventos, documentos da CVM e a sua tese.' },
        { type: 'note', tone: 'info', text: 'O Radar não envia alertas nem notificações e não mostra horário de atualização: as listas são recalculadas quando você abre a tela.' },
      ],
    },
    {
      id: 'distorcao-nao-e-barata',
      title: 'Distorção de valuation não é o mesmo que ação barata',
      blocks: [
        { type: 'p', text: 'Muita gente procura por “ações descontadas”. No Radar, distorção quer dizer só que o P/L do papel está abaixo da metade da média do setor. Pode ser um desconto exagerado, mas também pode ser o mercado antecipando um lucro menor, um lucro inflado por um evento que não se repete ou um risco que os números ainda não mostram.' },
        { type: 'p', text: 'Por isso a lista Oportunidades Claras exige que o papel apareça em mais de um sinal ao mesmo tempo, e por isso vale abrir a lista Riscos Elevados antes de tirar conclusões: um papel pode estar nas duas.' },
        { type: 'p', text: 'Para comparar o preço com o valor da empresa, o passo seguinte é o valuation: veja o preço justo por Graham, Bazin e Gordon na [página de cada ação](/acoes/) e, na plataforma, monte o seu [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/).' },
      ],
    },
    {
      id: 'como-usar',
      title: 'Como usar o Radar no seu estudo',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Escolha o recorte: o mercado todo, um porte ou a sua carteira.',
            'Abra a lista que responde à sua pergunta, por exemplo Distorções de Valuation ou PEG Ratio.',
            'Confira o motivo ao lado de cada papel e veja se ele também está em Riscos Elevados.',
            'Abra a página da ação: preço justo, indicadores, proventos e documentos da CVM.',
            'Se a ideia continuar de pé, registre a [tese de investimento](/ferramentas/tese-de-investimento/) em Minhas Teses, com preço-alvo e critérios.',
          ],
        },
      ],
    },
    {
      id: 'limites',
      title: 'Limites e cuidados',
      blocks: [
        {
          type: 'list',
          items: [
            '**Indicador ausente conta como zero.** Uma ação sem P/L pode passar no corte “P/L abaixo de 20”, e um banco, que não tem Dívida/EBITDA, nunca entra em Riscos Elevados por alavancagem.',
            '**Volume de um único dia.** Small Caps Ignoradas e o ranking Top Crowded dependem do volume do último pregão e mudam todo dia.',
            '**Oportunidades Claras depende da Nota Qualitativa** e não tira quem também está em Riscos Elevados. Só os rankings Top 20 excluem esses papéis.',
            '**A média do setor muda com o recorte.** A média de P/L é recalculada sobre o porte, o setor ou a carteira escolhidos. No modo Carteira, o Radar usa a primeira carteira da sua lista e mede a distorção contra os papéis dela.',
            '**Universo:** a base de papéis da plataforma com cotação, sem BDRs e sem uma lista de ETFs. Não é a lista de tudo o que é negociado na B3.',
            '**É triagem, não recomendação.** O Radar não diz o que comprar ou vender.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: 'O que é o Radar de oportunidades?',
      a: 'É a tela de triagem da plataforma IAções. Aplica 6 regras fixas de corte aos indicadores dos papéis e separa o resultado em 6 listas: Oportunidades Claras, Reprecificação (Momentum), Distorções de Valuation, PEG Ratio (< 1), Small Caps Ignoradas e Riscos Elevados.',
    },
    {
      q: 'Quais critérios o Radar usa em cada lista?',
      a: 'Reprecificação: crescimento do lucro acima de 10%, ROA acima de 10% e P/L abaixo de 20. Distorções de Valuation: P/L positivo abaixo de 50% da média do setor. PEG Ratio: P/L dividido pelo crescimento do lucro abaixo de 1. Small Caps Ignoradas: valor de mercado abaixo de R$ 2 bilhões e crowdedness abaixo de 0,8. Riscos Elevados: Dívida líquida/EBITDA acima de 3,5, ou lucro caindo mais de 10% com Dívida/EBITDA acima de 2. Oportunidades Claras: papel com Nota Qualitativa que está em Distorções e em mais uma lista.',
    },
    {
      q: 'O Radar usa inteligência artificial?',
      a: 'Não. As listas saem de regras fixas e ordenações simples, calculadas no seu navegador. A ordem dentro das listas segue a Nota Qualitativa, que é gerada por IA a partir de critérios objetivos em outra ferramenta, o Score Qualitativo.',
    },
    {
      q: 'O que é distorção de valuation?',
      a: 'No Radar, é o papel com P/L positivo abaixo da metade da média de P/L do seu setor. A média é simples, usa só P/L entre 0 e 100 e é recalculada sobre o recorte filtrado. Pode indicar desconto exagerado ou piora dos fundamentos, por isso pede análise caso a caso.',
    },
    {
      q: 'O que é PEG ratio e por que o corte é 1?',
      a: 'PEG é o P/L dividido pelo crescimento do lucro em porcentagem. Abaixo de 1, o P/L é baixo diante do crescimento recente do lucro, medido nos últimos 12 meses contra os 12 anteriores. É um indicador de triagem: crescimento passado não garante crescimento futuro.',
    },
    {
      q: 'Uma ação pode estar em Oportunidades Claras e em Riscos Elevados ao mesmo tempo?',
      a: 'Pode. As listas são independentes, e Oportunidades Claras não exclui quem está em Riscos Elevados. Só os quatro rankings Top 20 tiram esses papéis. Vale conferir as duas listas antes de qualquer conclusão.',
    },
    {
      q: 'O Radar envia alertas?',
      a: 'Não. O Radar não envia alertas nem notificações. Para acompanhar uma ação, registre a tese em Minhas Teses: nos planos pagos, os critérios são conferidos uma vez por dia e o aviso chega no resumo da manhã.',
    },
    {
      q: 'Com que frequência as listas mudam?',
      a: 'As listas são recalculadas toda vez que você abre a tela, com os dados mais recentes da plataforma. Small Caps Ignoradas e o ranking Top Crowded dependem do volume de um único pregão, então mudam todo dia.',
    },
    {
      q: 'O Radar é grátis?',
      a: 'O Radar completo faz parte dos planos pagos da IAções e exige login. Você pode começar com uma conta grátis e ver o que cada plano inclui na página de preços.',
    },
    {
      q: 'O Radar é recomendação de investimento?',
      a: 'Não. É uma triagem por critérios objetivos, um ponto de partida para o estudo. O Radar não diz o que comprar ou vender: a decisão depende da sua análise do preço justo, dos riscos e dos documentos da empresa.',
    },
  ],
  sources: 'Critérios, ordenações e rótulos: tela Radar da plataforma IAções. Indicadores: base de cotações, demonstrações financeiras, proventos e volume negociado da plataforma (dados de mercado via brapi).',
  contentRevised: '2026-10-06',
};
