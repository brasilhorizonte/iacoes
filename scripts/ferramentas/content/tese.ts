/**
 * Tese de investimento — Minhas Teses (CTA principal) e Validador de Teses (CTA secundário).
 * SPEC §3; SPEC-v2 §B9 (CTA e widget de Minhas Teses) e §D (WebPage, sem oferta grátis).
 *
 * Fonte de verdade: honestidade-rotas.md (Validador de Teses e Minhas Teses) e a ficha do app
 * (app-score-teses.json, lida em 06/10/2026). O que esta página NÃO pode dizer:
 *  - que o Validador confere a tese com os números da plataforma, dá preço-alvo ou confiança, ou
 *    "aprova" teses: é uma auditoria por IA da ARGUMENTAÇÃO (Fundamentação, Análise de riscos,
 *    Clareza e Lógica de valuation, em 8 níveis), com documentos da CVM, e pode errar;
 *  - que Minhas Teses usa IA, avisa na hora ou monitora crescimento de receita: preço-alvo,
 *    confiança e critérios são do usuário; 6 critérios (ROE mín., P/L máx., DY mín., Dív. Líq./EBITDA
 *    máx., Margem EBITDA mín., Margem líquida mín.) são conferidos 1 vez por dia; o aviso de critério
 *    e de preço-alvo é só dos planos pagos e chega no resumo da manhã (nunca "instantâneo");
 *  - número atribuído a ticker real: os exemplos usam a "Ação A", empresa fictícia, com o selo
 *    "Exemplo ilustrativo" — página e widget (widgets/tese.js) usam os MESMOS números (cotação R$ 35,
 *    alvo R$ 42, preço justo R$ 40, preço teto R$ 30, confiança 7/10, os 6 limites).
 * Acesso (SPEC-v2 §B2): sem link para /#precos. Minhas Teses abre com qualquer conta (o limite do plano grátis, MAX_FREE_THESES no app,
 * não é citado: a tabela de planos da landing diverge); o Validador entra no limite
 * diário de análises de IA do plano grátis (sem citar número).
 *
 * As seções SSR `tese-modelo` (o modelo em 5 blocos e a versão para copiar) e `tese-ferramentas`
 * (os dois CTAs lado a lado) moram em sections/tese.tsx e leem as constantes abaixo.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

/** Um bloco do modelo de tese (seção SSR tese-modelo). Texto puro, sem marcação. */
export interface TeseBloco {
  titulo: string;
  /** A pergunta que o bloco responde. */
  pergunta: string;
  /** O que escrever no bloco. */
  oQue: string;
  /** Exemplo com a Ação A (empresa fictícia): os mesmos números do widget. */
  exemplo: string;
}

export const TESE_MODELO: readonly TeseBloco[] = [
  {
    titulo: 'Tese em uma frase',
    pergunta: 'Por que esta ação, e por que agora?',
    oQue: 'Diga o que precisa acontecer na empresa e por que o preço de hoje ainda não reflete isso. Se a ideia não cabe numa frase, ela ainda não está clara.',
    exemplo: 'A Ação A vai elevar o lucro por ação de R$ 3,20 para R$ 3,50 em 12 meses com a nova unidade, sem aumentar a dívida, e a cotação de R$ 35 ainda não reflete isso.',
  },
  {
    titulo: 'Critérios mensuráveis',
    pergunta: 'Que números precisam continuar de pé?',
    oQue: 'Escolha de 3 a 6 indicadores ligados à tese, cada um com um mínimo ou um máximo. São eles que mostram, com o tempo, se a tese continua valendo.',
    exemplo: 'ROE de pelo menos 15%, P/L de até 12, dividend yield de pelo menos 5%, dívida líquida de até 3 vezes o EBITDA, margem EBITDA de pelo menos 20% e margem líquida de pelo menos 10%.',
  },
  {
    titulo: 'Preço-alvo ou preço teto',
    pergunta: 'Quanto a ação pode valer, e quanto você aceita pagar?',
    oQue: 'Anote o preço-alvo (aonde a cotação pode chegar no prazo da tese) ou o preço teto (o máximo que você paga), com a conta que levou a ele. Registre também a sua confiança na tese, de 1 a 10.',
    exemplo: 'Preço-alvo de R$ 42 em 12 meses: lucro por ação esperado de R$ 3,50 vezes P/L de 12. Quem investe por dividendos usaria o preço teto: R$ 30 pelo método Bazin (dividendo médio de R$ 1,80 dividido por 6%). Confiança: 7 de 10.',
  },
  {
    titulo: 'Riscos',
    pergunta: 'O que derrubaria a tese?',
    oQue: 'Liste o que pode dar errado na empresa, no setor, na economia e na governança. Risco bem escrito é específico e dá para observar quando acontece.',
    exemplo: 'A obra da nova unidade atrasar; a dívida subir para pagar a obra; a demanda do setor cair; uma mudança de regra reduzir a margem.',
  },
  {
    titulo: 'Gatilhos de saída',
    pergunta: 'Em que situação você revê ou encerra a posição?',
    oQue: 'Combine antes o que faz você rever a tese: um critério que deixa de valer, o preço que chega ao alvo, um risco que acontece. Decidir com calma é mais fácil do que no meio da queda ou da euforia.',
    exemplo: 'Dívida líquida acima de 3 vezes o EBITDA em dois balanços seguidos; margem EBITDA abaixo de 20%; obra adiada por mais de um ano; cotação perto de R$ 42, hora de refazer a conta.',
  },
];

/**
 * Versão em texto do modelo, para copiar e preencher (seção SSR tese-modelo; o botão "Copiar modelo"
 * é do widget `tese-modelo`). Os critérios são os 6 que Minhas Teses confere.
 */
export const TESE_MODELO_TEXTO = [
  'TESE DE INVESTIMENTO',
  'Ação: ________   Data: __/__/____   Revisar em: __/__/____',
  '',
  '1. TESE EM UMA FRASE',
  '[Empresa] vai [o que precisa acontecer] porque [motivo].',
  'O preço de hoje ainda não reflete isso porque [motivo].',
  '',
  '2. CRITÉRIOS MENSURÁVEIS (deixe em branco o que não usar)',
  'ROE mínimo: ____ %',
  'P/L máximo: ____',
  'DY mínimo: ____ %',
  'Dívida líquida/EBITDA máxima: ____',
  'Margem EBITDA mínima: ____ %',
  'Margem líquida mínima: ____ %',
  '',
  '3. PREÇO-ALVO OU PREÇO TETO',
  'Preço-alvo: R$ ____ em ____ meses',
  'Como calculei: ________________',
  'Preço teto (o máximo que pago): R$ ____',
  'Confiança na tese (1 a 10): ____',
  '',
  '4. RISCOS (o que derruba a tese)',
  '- ________________',
  '- ________________',
  '- ________________',
  '',
  '5. GATILHOS DE SAÍDA (o que me faz rever ou encerrar a posição)',
  '- Se o critério ________ sair do limite por ____ balanços: ________',
  '- Se a cotação chegar a R$ ____: refaço a conta e decido entre manter, reduzir ou sair.',
  '- Se o risco ________ acontecer: ________',
].join('\n');

/** As duas telas, lado a lado na seção SSR tese-ferramentas (cada uma com o seu deep link). */
export interface TeseTela {
  id: 'teses' | 'validador';
  rotulo: string;
  titulo: string;
  texto: string;
  itens: string[];
  cta: string;
}

export const TESE_TELAS: readonly TeseTela[] = [
  {
    id: 'teses',
    rotulo: 'O teste dos números',
    titulo: 'Minhas Teses',
    texto: 'Guarda a sua tese com preço-alvo, confiança de 1 a 10 e até 6 critérios, conferidos uma vez por dia contra os indicadores mais recentes.',
    itens: [
      'Preço-alvo com faixa de aviso opcional',
      'ROE, P/L, DY, dívida e margens com mínimo ou máximo',
      'Avisos nos planos pagos: no app e no resumo da manhã',
    ],
    cta: 'Registrar minha tese',
  },
  {
    id: 'validador',
    rotulo: 'O teste da argumentação',
    titulo: 'Validador de Teses',
    texto: 'Audita o texto da tese com IA e aponta onde ela se sustenta e onde é frágil, com fatos relevantes e comunicados entregues à CVM.',
    itens: [
      'Nota geral e 4 notas, numa escala de 8 níveis',
      'Evidências da CVM contra a sua tese',
      'Não confere números nem dá preço-alvo',
    ],
    cta: 'Auditar minha tese',
  },
];

export const tese: ToolContent = {
  id: 'tese',
  slug: 'tese-de-investimento',
  status: 'pronto',
  name: 'Minhas Teses e Validador de Teses',
  keyword: 'tese de investimento',
  title: 'Tese de Investimento: Modelo e Validador com IA | IAções',
  description: 'Modelo de tese de investimento em 5 blocos para copiar e preencher. Veja como Minhas Teses confere seus critérios e o Validador audita a argumentação.',
  h1: 'Tese de investimento: monte a sua e coloque à prova',
  answer: 'Uma tese de investimento é a explicação, por escrito, de por que uma ação merece o seu dinheiro: o que a empresa precisa entregar, quanto vale pagar, os riscos e quando sair. Na IAções, Minhas Teses guarda o preço-alvo, a confiança e até 6 critérios conferidos uma vez por dia, e o Validador de Teses audita a argumentação com IA.',
  blurb: 'Modelo de tese em 5 blocos, Minhas Teses com preço-alvo e critérios conferidos uma vez por dia e o Validador, que audita a argumentação com IA.',
  cta: {
    label: 'Abrir Minhas Teses',
    target: SCREENS.teses,
    screen: 'Minhas Teses',
    note: 'Comece com uma conta grátis. Os avisos de critério e de preço-alvo são dos planos pagos e chegam uma vez por dia, no resumo da manhã.',
  },
  finalCta: {
    title: 'Registre a sua tese e acompanhe os critérios',
    text: 'Em Minhas Teses, você anota a tese, o preço-alvo, a confiança e os critérios, e a plataforma confere os números uma vez por dia. Quando quiser testar a argumentação, leve o texto ao Validador de Teses.',
    label: 'Abrir Minhas Teses',
  },
  widget: {
    id: 'tese',
    illustrative: true,
    label: 'Exemplo ilustrativo de Minhas Teses: a tese da Ação A, empresa fictícia, com preço-alvo, confiança e seis critérios conferidos uma vez por dia',
    caption: 'Exemplo ilustrativo: a Ação A e os números são fictícios. Na plataforma, os critérios são conferidos uma vez por dia contra os indicadores mais recentes, sem IA.',
    fallback: { kind: 'text', text: 'Cartão de Minhas Teses com preço-alvo, confiança de 1 a 10 e seis critérios conferidos com ✓ ou ✗ (ilustração com a Ação A, empresa fictícia).' },
  },
  dataSource: 'evergreen',
  sections: [
    {
      id: 'o-que-e',
      title: 'O que é uma tese de investimento',
      blocks: [
        { type: 'p', text: 'Uma **tese de investimento** é o raciocínio que justifica ter uma ação: por que a empresa deve entregar o que você espera, quanto vale pagar por ela, o que pode dar errado e em que situação você sai. É o oposto de investir por palpite: a decisão fica registrada, por escrito, com motivos que dá para conferir depois.' },
        { type: 'p', text: 'Uma boa tese é curta e mensurável. “A empresa vai crescer” não é tese. “O lucro por ação vai crescer perto de 10% em 12 meses, sem aumentar a dívida” é, porque o tempo mostra se aconteceu. Por isso a tese vem com critérios, como ROE, margens, endividamento e dividendos, cada um com um limite.' },
        { type: 'p', text: 'Escrever a tese também ajuda contra o viés de confirmação, a tendência de procurar só o que confirma o que já pensamos. Com critérios e gatilhos combinados antes, fica mais fácil reconhecer quando a ideia deixou de valer, em vez de procurar uma desculpa para ela.' },
        { type: 'p', text: 'Antes da tese vem a escolha do que estudar: o [Radar de oportunidades](/ferramentas/radar-de-oportunidades/) e o [ranking de ações](/ferramentas/ranking-de-acoes/) fazem essa triagem por indicadores. Depois, o valuation estima o preço justo, e a tese junta tudo num plano que você consegue acompanhar.' },
      ],
    },
    {
      id: 'modelo',
      title: 'Modelo de tese de investimento em 5 blocos',
      blocks: [
        { type: 'p', text: 'O modelo abaixo organiza a tese no que importa para decidir e para acompanhar. Cada bloco responde uma pergunta. Os exemplos usam a Ação A, uma empresa fictícia; no fim, há uma versão em texto para copiar e preencher.' },
        { type: 'ssr', id: 'tese-modelo' },
        { type: 'p', text: 'Preenchido, o modelo vira a sua tese em **Minhas Teses**: a frase e os riscos vão para as notas, os limites do bloco 2 viram os critérios conferidos todo dia, e o bloco 3 vira o preço-alvo e a confiança.' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como colocar a tese à prova',
      blocks: [
        { type: 'p', text: 'Depois de escrita, a tese passa por dois testes diferentes. O primeiro é o dos números: os critérios que você definiu continuam de pé? O segundo é o da argumentação: o raciocínio resiste a quem procura os pontos fracos? Na IAções, cada teste tem a sua ferramenta.' },
        { type: 'ssr', id: 'tese-ferramentas' },
        {
          type: 'table',
          caption: 'Minhas Teses e Validador de Teses lado a lado',
          head: ['Ferramenta', 'O que confere', 'Como', 'Quando', 'Avisos'],
          rows: [
            ['**Minhas Teses**', 'Os números: o preço-alvo e até 6 critérios, cada um com mínimo ou máximo', 'Regra de mínimo e máximo contra os indicadores mais recentes da base da plataforma, sem IA', 'Uma vez por dia', 'Nos planos pagos, no app e no resumo da manhã'],
            ['**Validador de Teses**', 'A argumentação: fundamentação, riscos, clareza e lógica de valuation', 'Auditoria por IA com documentos entregues à CVM, o conhecimento do modelo e buscas na web; pode errar', 'Quando você pede', 'Sem conferência diária; o resultado pode ser salvo junto da tese'],
          ],
        },
        { type: 'p', text: 'Os dois se completam: o Validador ajuda a escrever uma tese mais sólida, e Minhas Teses mostra quando os números que a sustentam mudam. Nenhum dos dois diz se a ação vai subir. O preço-alvo e a confiança são sempre seus: o Validador não dá nenhum dos dois.' },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'Minhas Teses e o Validador na plataforma',
      blocks: [
        { type: 'p', text: 'As duas ferramentas ficam na plataforma IAções e pedem login. Minhas Teses fica na aba **Teses**; o Validador de Teses, na aba **Validador**.' },
        { type: 'h3', text: 'Minhas Teses, passo a passo' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Em **Nova tese**, escolha a ação que você quer acompanhar.',
            'Em **Notas da Tese**, escreva a tese em uma frase e os riscos.',
            'Em **Preço Alvo (R$)**, informe o alvo. Se quiser, defina uma faixa em porcentagem para o aviso; sem faixa, o aviso vale quando a cotação atinge ou supera o alvo.',
            'Em **Confiança na Tese**, marque de 1 (baixa) a 10 (alta).',
            'Em **Critérios para Alertas**, preencha os limites da sua tese: ROE mínimo, P/L máximo, DY mínimo, Dív. Líq./EBITDA máximo, Margem EBITDA mínima e Margem Líquida mínima. Deixe em branco o que não quiser monitorar.',
          ],
        },
        { type: 'p', text: 'Ao lado de cada critério, a tela mostra o valor atual e marca em vermelho o que saiu do limite. O cartão da tese resume o alvo e a distância até ele, quantos critérios você definiu e a nota da última validação. Na aba **Carteira**, o painel “A tese se sustenta?” mostra cada critério com ✓ ou ✗.' },
        { type: 'h3', text: 'Validador de Teses, passo a passo' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Na aba **Validador**, informe a ação e confirme a empresa.',
            'Escreva a tese em **Tese em texto** e/ou anexe até 2 arquivos em PDF ou TXT em **Relatório ou material de apoio**.',
            'Clique em **Auditar tese** e aguarde a auditoria.',
            'Leia o resultado: a **Nota geral**, as notas de Fundamentação, Análise de riscos, Clareza e Lógica de valuation, os alertas, as **Evidências CVM contra sua tese**, os **Riscos e vulnerabilidades** e o **Veredito do Portfolio Manager**.',
            'Use **Salvar na Minha Tese** para guardar o resultado junto da tese, em Minhas Teses.',
          ],
        },
        { type: 'note', tone: 'info', text: 'Minhas Teses abre com uma conta grátis. Os avisos de critério e de preço-alvo são dos planos pagos. O Validador também funciona com a conta grátis, dentro do limite diário de análises de IA da plataforma.' },
      ],
    },
    {
      id: 'preco-justo-alvo-teto',
      title: 'Preço justo, preço-alvo e preço teto: a diferença com um exemplo',
      blocks: [
        { type: 'p', text: 'Os três aparecem em relatórios e conversas como se fossem a mesma coisa, mas respondem perguntas diferentes. A tese precisa dizer qual deles guia a sua decisão.' },
        {
          type: 'table',
          caption: 'Preço justo, preço-alvo e preço teto, com o exemplo ilustrativo da Ação A',
          head: ['Conceito', 'Pergunta que responde', 'Como se calcula', 'Exemplo (Ação A)'],
          rows: [
            ['**Preço justo**', 'Quanto a empresa vale hoje?', 'Um modelo de valuation: Graham, Bazin, Gordon ou fluxo de caixa descontado', 'R$ 40,00 pelo fluxo de caixa descontado'],
            ['**Preço-alvo**', 'Aonde a cotação pode chegar no prazo da tese?', 'Lucro por ação esperado × P/L justo, ou o preço justo projetado para o fim do prazo', 'R$ 42,00 em 12 meses (R$ 3,50 × 12)'],
            ['**Preço teto**', 'Qual o máximo que aceito pagar hoje?', 'Método Bazin: dividendo médio ÷ dividend yield mínimo; ou o preço justo menos a margem de segurança', 'R$ 30,00 (R$ 1,80 ÷ 6%)'],
          ],
        },
        { type: 'note', tone: 'info', text: 'Exemplo ilustrativo: a Ação A é uma empresa fictícia, cotada a R$ 35,00. Os números só mostram as contas; não descrevem nenhuma empresa real e não são recomendação.' },
        { type: 'p', text: 'Na Ação A, a cotação de R$ 35 está acima do preço teto de quem investe por dividendos, abaixo do preço justo estimado e a 20% do preço-alvo. Nada disso é contraditório: são três réguas diferentes, e cada estratégia usa a sua.' },
        { type: 'h3', text: 'Como calcular o preço-alvo' },
        { type: 'formula', text: 'Preço-alvo = lucro por ação esperado em 12 meses × P/L que você considera justo' },
        { type: 'formula', text: 'Distância até o alvo = (preço-alvo − cotação) ÷ cotação' },
        { type: 'p', text: 'Na Ação A: R$ 3,50 × 12 = R$ 42,00, e (R$ 42 − R$ 35) ÷ R$ 35 = 20%. O P/L justo pode vir da média histórica da empresa ou dos pares do setor. Outro caminho é projetar para o fim do prazo o preço justo de um [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/). Seja qual for o método, anote a conta na tese: um preço-alvo sem conta por trás não ajuda a decidir.' },
        { type: 'p', text: 'Para o preço justo e o preço teto, a [calculadora de preço justo e preço teto](/ferramentas/calculadora-preco-justo/) faz as contas de Graham, Bazin e Gordon, e a [página de cada ação](/acoes/) mostra os três com as premissas padrão do site.' },
      ],
    },
    {
      id: 'quando-vender',
      title: 'Quando vender uma ação: os gatilhos de saída',
      blocks: [
        { type: 'p', text: 'Decidir a saída no calor da queda, ou da euforia, é difícil. Por isso o último bloco da tese define antes o que faz você rever a posição. Gatilho de saída não é ordem automática: é o momento, combinado com você mesmo, de refazer a conta.' },
        {
          type: 'list',
          items: [
            '**A tese quebrou.** Um critério que sustentava a ideia deixou de valer e não parece passageiro: a dívida passou do limite em mais de um balanço, a margem mudou de patamar, o que a tese esperava não aconteceu no prazo.',
            '**O preço chegou ao alvo.** O espaço até o alvo acabou. Refaça a conta com os números novos: se o valor estimado subiu, a tese pode ganhar um alvo novo; se não, a posição perdeu o motivo.',
            '**Um risco da lista aconteceu.** Um fato relevante, uma mudança de regra ou de gestão que você mesmo apontou como risco. Os [fatos relevantes](/ferramentas/fatos-relevantes/) das empresas ajudam a acompanhar esse bloco.',
            '**A posição ficou grande demais.** Depois de uma alta forte, a ação pode pesar mais do que você quer na carteira. Reduzir, nesse caso, é rebalancear, não mudar de tese. O [Otimizador de carteira (Markowitz)](/ferramentas/markowitz/) mostra os pesos da sua carteira ao lado de uma referência calculada com as suas premissas.',
            '**Outra tese ficou mais forte.** Uma alternativa de qualidade parecida, com mais retorno esperado para o mesmo risco, também é motivo para rever a posição.',
          ],
        },
        { type: 'p', text: 'Queda de preço sozinha não é gatilho. Se os critérios seguem de pé e a tese não mudou, uma cotação menor só aumenta a distância até o alvo. O contrário também vale: a alta não confirma a tese.' },
        { type: 'note', tone: 'info', text: 'Em Minhas Teses, os critérios mostram quando um gatilho numérico disparou. A decisão continua sua: a IAções não recomenda compra nem venda de ativos.' },
      ],
    },
    {
      id: 'limites',
      title: 'Limites e cuidados',
      blocks: [
        {
          type: 'list',
          items: [
            '**A IA do Validador pode errar.** Ela escreve a crítica com o próprio conhecimento, buscas na web e documentos entregues à CVM. Confira os números e as fontes que ela citar.',
            '**O Validador não confere números.** Ele não compara a tese com os indicadores da plataforma e não dá preço-alvo nem nota de confiança.',
            '**Minhas Teses não usa IA.** Preço-alvo, confiança e critérios são seus; a conferência é uma regra simples de mínimo e máximo.',
            '**Uma vez por dia, não na hora.** Os critérios e o preço-alvo são conferidos uma vez por dia, e o aviso chega no resumo da manhã. No plano gratuito, os critérios ficam salvos, mas não geram aviso.',
            '**Seis critérios conferidos.** O campo de crescimento da receita aparece na tela, mas fica fora da conferência diária e dos avisos.',
            '**Depende da base de dados.** Ação fora da base de cotações fica sem conferência, e atraso ou falha da fonte afeta o valor atual. Confira o número na tela antes de decidir.',
            '**Não é recomendação.** As ferramentas organizam e testam a sua tese; a decisão de investir é sua.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: 'O que é uma tese de investimento?',
      a: 'É a explicação, por escrito, de por que uma ação merece o seu dinheiro: o que a empresa precisa entregar, quanto você aceita pagar, o que pode dar errado e em que situação você sai. Uma boa tese cabe numa frase e vem com critérios que dá para medir, como ROE, margens e dívida.',
    },
    {
      q: 'Como montar uma tese de investimento em 5 passos?',
      a: '1) Escreva a tese em uma frase: o que precisa acontecer e por que o preço de hoje não reflete isso. 2) Defina critérios mensuráveis, cada um com mínimo ou máximo, como ROE mínimo e dívida líquida/EBITDA máxima. 3) Calcule o preço-alvo ou o preço teto e anote a conta. 4) Liste os riscos que derrubariam a tese. 5) Combine os gatilhos de saída: o que faz você rever ou encerrar a posição. Depois, registre a tese em Minhas Teses e leve a argumentação ao Validador de Teses.',
    },
    {
      q: 'Qual a diferença entre preço justo, preço-alvo e preço teto?',
      a: 'Preço justo é quanto a empresa vale hoje por um modelo de valuation. Preço-alvo é aonde a cotação pode chegar num prazo, em geral 12 meses, se a tese der certo. Preço teto é o máximo que você aceita pagar. Exemplo ilustrativo, com uma empresa fictícia cotada a R$ 35: preço justo de R$ 40 pelo fluxo de caixa descontado, preço-alvo de R$ 42 (lucro por ação esperado de R$ 3,50 vezes P/L de 12) e preço teto de R$ 30 pelo método Bazin (dividendo médio de R$ 1,80 dividido por 6%).',
    },
    {
      q: 'Como calcular o preço-alvo de uma ação?',
      a: 'O jeito mais direto é multiplicar o lucro por ação esperado para daqui a 12 meses pelo P/L que você considera justo para a empresa, por exemplo a média histórica dela ou dos pares do setor. Outro caminho é projetar o preço justo de um fluxo de caixa descontado até o fim do prazo. A distância até o alvo é (preço-alvo − cotação) ÷ cotação. Anote na tese de onde veio cada número.',
    },
    {
      q: 'Como a IA do Validador avalia a minha tese?',
      a: 'O Validador de Teses faz uma auditoria por IA da argumentação. Você escreve a tese ou anexa um relatório, e a IA, no papel de um gestor de portfólio experiente, aponta onde o texto se sustenta e onde é frágil. Ela usa fatos relevantes, comunicados e outros documentos entregues à CVM nos últimos 18 meses, além do próprio conhecimento e de buscas na web, e dá uma nota geral e notas para Fundamentação, Análise de riscos, Clareza e Lógica de valuation, numa escala de 8 níveis, de Muito Ruim a Excelente. O Validador não compara a tese com os números da plataforma, não dá preço-alvo nem confiança e pode errar.',
    },
    {
      q: 'O que acontece quando um critério da tese deixa de valer?',
      a: 'Em Minhas Teses, cada critério é conferido uma vez por dia contra os indicadores mais recentes da base da plataforma. Quando um valor sai do limite, o critério aparece em vermelho na tela. Nos planos pagos, o aviso “Critério da tese violado” chega no app e no resumo da manhã, pelo Telegram ou WhatsApp que você conectar. No plano gratuito, os critérios ficam salvos, mas não geram aviso. O aviso não é instantâneo nem é ordem de venda: é o sinal para reler a tese.',
    },
    {
      q: 'Quando vender uma ação?',
      a: 'Quando um gatilho de saída combinado na tese disparar, e não só porque a cotação caiu. Os gatilhos mais comuns são: a tese quebrou, porque um critério que a sustentava deixou de valer de forma duradoura; o preço chegou ao alvo e a conta refeita não mostra mais espaço; um risco da lista aconteceu; ou a posição ficou grande demais na carteira. A decisão é sua: este conteúdo é educativo e não é recomendação.',
    },
    {
      q: 'Minhas Teses e o Validador são gratuitos?',
      a: 'As duas telas abrem com uma conta grátis. No plano gratuito, o Validador entra no limite diário de análises de IA da plataforma. Os avisos de critério e de preço-alvo são só dos planos pagos.',
    },
    {
      q: 'A IA recomenda comprar ou vender ações?',
      a: 'Não. O Validador critica a argumentação e nunca recomenda compra, venda ou manutenção de ativos. Minhas Teses só confere os números que você definiu. A decisão de investir é sua, e o conteúdo da IAções é informativo e educativo.',
    },
  ],
  definedTerms: [
    { name: 'Tese de investimento', description: 'Explicação escrita de por que uma ação merece o seu dinheiro, com critérios mensuráveis, preço-alvo ou preço teto, riscos e gatilhos de saída.' },
    { name: 'Preço justo', description: 'Estimativa de quanto uma ação vale hoje, calculada por um modelo de valuation, como Graham, Bazin, Gordon ou fluxo de caixa descontado.' },
    { name: 'Preço-alvo', description: 'Preço que a ação pode atingir num prazo definido, em geral 12 meses, se a tese se confirmar. Costuma sair do lucro esperado vezes um múltiplo justo.' },
    { name: 'Preço teto', description: 'Maior preço que o investidor aceita pagar por uma ação. No método Bazin, é o dividendo médio dividido pelo dividend yield mínimo desejado.' },
    { name: 'Gatilho de saída', description: 'Condição combinada na própria tese que leva a rever ou encerrar a posição, como um critério que deixa de valer ou o preço que chega ao alvo.' },
  ],
  sources: 'Campos, rótulos e regras: telas Minhas Teses e Validador de Teses da plataforma IAções. Conferência dos critérios: regra de mínimo e máximo contra os indicadores da base de cotações e demonstrações financeiras da plataforma (dados de mercado via brapi). Validador: auditoria gerada por IA com documentos entregues à CVM; pode conter erros. Exemplos com a Ação A: ilustrativos, de uma empresa fictícia.',
  contentRevised: '2026-10-07',
};
