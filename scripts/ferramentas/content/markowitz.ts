/**
 * Otimizador de carteira (Markowitz) — /ferramentas/markowitz/ (SPEC §3; SPEC-v2 §B7, §C, §D).
 *
 * Fonte de verdade: honestidade-rotas.md (Otimizador) e a ficha do app (app-markowitz.json:
 * otimizador/App.tsx, services/mathService.ts, services/meanVariance.ts, lidos em 06/10/2026).
 * O que esta página NÃO pode dizer: que a IA otimiza ou escolhe os pesos (a conta é matemática
 * exata; a IA só comenta), que o sorteio de carteiras acha a melhor (ele só desenha a nuvem), que o
 * retorno esperado é previsão (é premissa: preço-alvo do usuário ou média dos modelos), que a
 * carteira de maior Sharpe é recomendação, rótulos de perfil, ou limites de plano (a página de
 * planos e o código divergem: a nota de acesso diz só "use com uma conta grátis", sem números).
 * Fatos do app usados aqui: 2 a 20 ativos em R$, sem venda a descoberto; volatilidade e correlação
 * de cerca de 1 ano de preços; taxa livre começa na prefixada de 1 ano e é editável; sem tangência
 * (nada supera a taxa livre), a referência vira a carteira de menor risco; backtest, β macro,
 * leitura completa do AIrton, exportar e salvar são dos planos pagos.
 * Página evergreen: widget ilustrativo (port do MarkowitzExplainer, ações "Ação A…E") e exemplo
 * numérico com 2 ações fictícias calculado no build (sections/markowitz.tsx), ambos com selo.
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const markowitz: ToolContent = {
  id: 'markowitz',
  slug: 'markowitz',
  status: 'pronto',
  name: 'Otimizador de carteira (Markowitz)',
  keyword: 'teoria de markowitz',
  title: 'Teoria de Markowitz: Fronteira Eficiente na Prática | IAções',
  description: 'Entenda a teoria de Markowitz, a fronteira eficiente e o índice de Sharpe, com um exemplo de duas ações. No Otimizador da IAções, a conta é exata.',
  h1: 'Teoria de Markowitz na prática: a fronteira eficiente da sua carteira',
  answer: 'A teoria de Markowitz mostra como combinar ações para ter o maior retorno esperado em cada nível de risco: o conjunto dessas carteiras é a fronteira eficiente. No Otimizador da IAções, o cálculo é exato e parte das suas premissas de retorno; a IA só comenta o resultado.',
  blurb: 'Fronteira eficiente e carteira de maior índice de Sharpe com as suas premissas de retorno, de 2 a 20 ações.',
  cta: {
    label: 'Abrir o Otimizador',
    target: SCREENS.otimizador,
    screen: 'Otimizador',
    note: 'Use o Otimizador com uma conta grátis: entre ou crie a sua para ver a fronteira eficiente da sua carteira.',
  },
  finalCta: {
    title: 'Veja a fronteira eficiente da sua carteira',
    text: 'Importe ou digite a carteira, confira os preços-alvo e veja onde ela está em relação à fronteira e à carteira de maior Sharpe. Use o Otimizador com uma conta grátis.',
    label: 'Abrir o Otimizador',
  },
  widget: {
    id: 'markowitz',
    illustrative: true,
    label: 'Animação ilustrativa da teoria de Markowitz com cinco ações fictícias',
    caption: 'Exemplo ilustrativo com ações fictícias (Ação A a Ação E), sem dado de mercado. Na plataforma, o gráfico usa a sua carteira e as suas premissas.',
    fallback: {
      kind: 'text',
      text: 'Animação ilustrativa: cinco ações fictícias, a nuvem de carteiras sorteadas, a fronteira eficiente e a reta da taxa livre tocando a carteira de maior índice de Sharpe.',
    },
  },
  dataSource: 'evergreen',
  sections: [
    {
      id: 'o-que-e',
      title: 'O que é a teoria de Markowitz',
      blocks: [
        { type: 'p', text: 'A **teoria de Markowitz** é o método para montar carteiras que o economista Harry Markowitz publicou em 1952 e que deu origem à teoria moderna de portfólios. Ela rendeu a ele o Nobel de Economia de 1990. A ideia central é simples: o risco de uma carteira não é a média do risco das ações que ela tem. Ele depende de como essas ações oscilam juntas.' },
        { type: 'p', text: 'Quando duas ações não sobem e caem ao mesmo tempo, as quedas de uma são compensadas, em parte, pelas altas da outra. Por isso, uma carteira bem combinada pode ter risco menor que o da ação menos arriscada dela. Para a teoria de Markowitz, diversificar é escolher os pesos olhando a correlação entre os ativos, e não só a quantidade de ativos.' },
        { type: 'p', text: 'Com o retorno esperado, a volatilidade e a correlação de cada ação, a conta encontra a **fronteira eficiente**: as carteiras com o maior retorno esperado para cada nível de risco. Uma delas tem o maior índice de Sharpe, o melhor retorno acima da taxa livre por unidade de risco. É essa carteira que o [Otimizador](#na-plataforma) da IAções usa como referência para comparar com a sua.' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona a otimização de carteira',
      blocks: [
        { type: 'p', text: 'A conta de Markowitz usa três informações de cada ação e uma regra para os pesos:' },
        {
          type: 'list',
          items: [
            '**Retorno esperado:** quanto você espera que a ação renda em 12 meses. É uma premissa, não um dado. No Otimizador, ele sai do seu preço-alvo.',
            '**Volatilidade:** o desvio-padrão dos retornos, em base anual. Mede quanto a ação oscila e vem do histórico de preços.',
            '**Correlação:** quanto duas ações oscilam juntas, de −1 (sempre em sentidos opostos) a 1 (sempre juntas). Também vem do histórico.',
            '**Pesos:** a fração do dinheiro em cada ação. Somam 100% e, sem venda a descoberto, nenhum peso é negativo.',
          ],
        },
        { type: 'h3', text: 'As fórmulas' },
        { type: 'formula', text: 'Retorno esperado da carteira: E = w₁·E₁ + w₂·E₂ + … + wₙ·Eₙ' },
        { type: 'formula', text: 'Variância de uma carteira com duas ações: σ² = w₁²·σ₁² + w₂²·σ₂² + 2·w₁·w₂·ρ·σ₁·σ₂' },
        { type: 'p', text: 'O retorno da carteira é a média ponderada dos retornos. O risco não é: o último termo da variância depende da correlação ρ. Com ρ menor que 1, a volatilidade da carteira fica abaixo da média ponderada das volatilidades. Com mais ações, a mesma conta usa a matriz de covariância, que reúne a volatilidade de cada ação e a correlação de cada par.' },
        { type: 'h3', text: 'Fronteira eficiente, índice de Sharpe e tangência' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**Carteira de menor risco:** a combinação de menor volatilidade possível com aquelas ações.',
            '**Fronteira eficiente:** dali para cima, a carteira de maior retorno esperado para cada nível de risco. Uma carteira abaixo da fronteira é ineficiente: existe outra que, pelas mesmas premissas, rende mais com o mesmo risco.',
            '**Índice de Sharpe:** o retorno esperado acima da taxa livre de risco, dividido pela volatilidade.',
            '**Carteira de tangência:** o ponto em que a reta que sai da taxa livre encosta na fronteira. É a carteira de maior índice de Sharpe, que muitos livros chamam de carteira ótima de Markowitz.',
          ],
        },
        { type: 'formula', text: 'Índice de Sharpe = (E − taxa livre) ÷ σ' },
        { type: 'p', text: 'A reta que sai da taxa livre e passa pela tangência é a linha de alocação de capital. Os pontos dela misturam a carteira de tangência com uma aplicação de baixo risco: com uma parte em CDI, a carteira oscila menos e o retorno acima da taxa livre cai na mesma proporção, sem mudar o índice de Sharpe. A animação no topo da página mostra esses conceitos passo a passo, com ações fictícias.' },
      ],
    },
    {
      id: 'exemplo',
      title: 'Exemplo com duas ações fictícias',
      blocks: [
        { type: 'p', text: 'Para ver a conta funcionando, considere duas ações fictícias, a Ação A e a Ação B, com as premissas abaixo. A Ação A promete mais retorno e oscila mais; a Ação B oscila menos. Os números são ilustrativos e não descrevem nenhuma empresa.' },
        { type: 'ssr', id: 'markowitz-exemplo' },
      ],
    },
    {
      id: 'retorno-esperado',
      title: 'O retorno esperado é premissa sua',
      blocks: [
        { type: 'p', text: 'A conta de Markowitz é exata, mas só é tão boa quanto as premissas. A mais sensível é o retorno esperado: uma diferença pequena no retorno de uma ação muda bastante o peso dela na carteira de maior Sharpe, como mostra o exemplo acima.' },
        { type: 'p', text: 'É comum usar a média histórica dos retornos como retorno esperado, e é aí que o modelo costuma falhar: o desempenho recente de uma ação diz pouco sobre os próximos 12 meses. O Otimizador da IAções segue outro caminho e trata o retorno esperado como premissa sua, ancorada em valuation. Para cada ação, ele usa, nesta ordem:' },
        {
          type: 'list',
          ordered: true,
          items: [
            'o **preço-alvo** que você digita ou traz no arquivo da carteira;',
            'o preço-alvo da sua tese ou do seu valuation (DCF) salvos na plataforma;',
            'sem nenhum dos dois, a média dos modelos de preço justo de Graham, Bazin e Gordon que se aplicam à ação.',
          ],
        },
        { type: 'p', text: 'O retorno esperado em 12 meses é a alta (ou a queda) da cotação até o preço-alvo, em porcentagem, somada aos proventos esperados no período. Antes da conta, a tela **Premissas da otimização** mostra cada número e deixa você trocar. Para chegar a um preço-alvo com método, use a [calculadora de preço justo](/ferramentas/calculadora-preco-justo/), a [página de cada ação](/acoes/) ou um [fluxo de caixa descontado](/ferramentas/fluxo-de-caixa-descontado/), e registre o alvo na sua [tese de investimento](/ferramentas/tese-de-investimento/).' },
        { type: 'note', tone: 'info', text: 'Volatilidade e correlação descrevem o passado: o Otimizador usa cerca de 1 ano de preços diários. O retorno esperado olha para a frente e depende só das suas premissas. Nenhum dos três é previsão.' },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'O Otimizador na plataforma',
      blocks: [
        { type: 'p', text: 'Na plataforma, a ferramenta fica na aba **Otimizador** e funciona em três passos:' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**Trazer a carteira:** por foto da corretora (a IA lê os ativos da imagem), por arquivo JSON, CSV ou XLS, digitando ou a partir de uma carteira salva na aba Carteira. Entram de 2 a 20 ativos negociados em reais.',
            '**Premissas da otimização:** confira, para cada ação, a cotação, o preço-alvo, o retorno esperado e a volatilidade, e ajuste a taxa livre e os limites mínimo e máximo de peso por ativo. Como diz a própria tela: “A conta de Markowitz sai deles; a IA só comenta o resultado.”',
            '**Relatório da otimização:** o resumo da carteira atual contra a escolhida (retorno esperado, risco, índice de Sharpe, número efetivo de ativos e giro), o gráfico da fronteira eficiente com a reta da taxa livre, a tabela de pesos atual × escolhida, o perfil por setor e tamanho, os múltiplos e a leitura do AIrton.',
          ],
        },
        { type: 'p', text: 'No gráfico do relatório, a carteira escolhida começa na tangência. Clique em qualquer ponto da fronteira para ver os pesos dele, ou use o controle **Parte em ações × CDI** para colocar parte do dinheiro na taxa livre e andar sobre a reta. A fronteira e a tangência saem de uma conta exata. O Otimizador também sorteia 1 milhão de carteiras, mas só para desenhar a nuvem do gráfico.' },
        { type: 'p', text: 'O [AIrton](/airton/), a IA da plataforma, lê o resultado, aponta os preços-alvo que mais pesam nele e comenta os pontos fortes e de atenção. Ele não escolhe os pesos e pode errar. A plataforma não executa ordens: o relatório é uma referência de cálculo, não recomendação.' },
        { type: 'note', tone: 'info', text: 'Use o Otimizador com uma conta grátis: o cálculo de Markowitz, a fronteira, a carteira de maior Sharpe e a tabela de pesos ficam abertos. O backtest da carteira, a exposição macro, a leitura completa do AIrton e as opções de exportar e salvar fazem parte dos planos pagos.' },
      ],
    },
    {
      id: 'diversificacao',
      title: 'Quantas ações ter e o que diversifica de verdade',
      blocks: [
        { type: 'p', text: 'A dúvida mais comum sobre diversificação é quantas ações ter na carteira. A teoria de Markowitz responde com outra pergunta: quanto essas ações oscilam juntas?' },
        {
          type: 'list',
          items: [
            '**Correlação alta, pouca diversificação.** Empresas do mesmo setor reagem aos mesmos fatores, como juros, preço de commodities ou regulação, e tendem a oscilar juntas. Somar mais uma ação parecida reduz pouco o risco.',
            '**Correlação baixa, mais diversificação.** Negócios que dependem de fatores diferentes, como câmbio, consumo interno ou exportação, compensam melhor as oscilações uns dos outros.',
            '**O ganho diminui a cada ação nova.** As primeiras ações de setores diferentes reduzem bastante o risco; depois, cada ação a mais tira menos risco, e o risco do mercado como um todo não desaparece.',
            '**O peso importa tanto quanto a contagem.** Uma carteira com 10 ações e metade do dinheiro em uma delas se comporta como uma carteira bem menor.',
          ],
        },
        { type: 'formula', text: 'Número efetivo de ativos = 1 ÷ (w₁² + w₂² + … + wₙ²)' },
        { type: 'p', text: 'Com 10 ações de peso igual, o número efetivo é 10. Com metade do dinheiro em uma ação e o resto dividido entre as outras 9, ele cai para 3,6. O relatório do Otimizador mostra o número efetivo de ativos da carteira atual e da escolhida, lado a lado.' },
      ],
    },
    {
      id: 'limites',
      title: 'Limites e cuidados',
      blocks: [
        {
          type: 'list',
          items: [
            '**Sensível às premissas.** Pequenas mudanças no retorno esperado mudam muito os pesos, e a carteira de maior Sharpe tende a se concentrar em poucas ações. Os limites mínimo e máximo por ativo existem para conter isso.',
            '**Risco medido no passado.** Volatilidade e correlação vêm de cerca de 1 ano de preços. Em crises, as correlações costumam subir e a diversificação diminui justamente quando mais faz falta.',
            '**Volatilidade não é todo o risco.** Ela trata alta e queda do mesmo jeito e não captura eventos raros, como uma recuperação judicial.',
            '**Taxa livre alta.** Se nenhuma combinação supera a taxa livre pelas suas premissas, não existe carteira de tangência, e o Otimizador mostra a carteira de menor risco como referência.',
            '**Sem custos nem impostos.** A conta não considera corretagem, impostos nem o custo de mudar a carteira. O relatório mostra o giro necessário para chegar à carteira escolhida.',
            '**Backtest é ilustração.** Nos planos pagos, o relatório aplica os pesos de hoje aos preços passados, inclusive ao período usado para medir o risco. Isso ilustra o comportamento da carteira, mas não prova desempenho. Veja também o [backtest de carteira](/ferramentas/backtest-de-carteira/).',
            '**Referência, não recomendação.** O resultado é uma conta com as suas premissas e não diz o que comprar ou vender.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: 'O que é a teoria de Markowitz?',
      a: 'É a teoria de carteiras publicada por Harry Markowitz em 1952, base da teoria moderna de portfólios. Ela mostra que o risco de uma carteira depende de como os ativos oscilam juntos, e não só do risco de cada um. Por isso, combinar ativos pouco correlacionados pode reduzir o risco sem reduzir o retorno esperado na mesma proporção.',
    },
    {
      q: 'O que é a fronteira eficiente?',
      a: 'É o conjunto das carteiras com o maior retorno esperado para cada nível de risco ou, olhando ao contrário, com o menor risco para cada retorno. Uma carteira abaixo da fronteira é ineficiente: existe outra, com os mesmos ativos, que pelas mesmas premissas rende mais com o mesmo risco. A fronteira muda quando mudam as premissas de retorno, volatilidade e correlação.',
    },
    {
      q: 'Quantas ações ter na carteira para diversificar?',
      a: 'Não existe número certo. O que reduz o risco é a correlação entre as ações, não a contagem: dez ações do mesmo setor oscilam juntas e diversificam pouco. O ganho também diminui a cada ação nova. E o peso conta: uma carteira com 10 ações e metade do dinheiro em uma delas tem número efetivo de ativos de 3,6, como se fossem menos de 4 ações de peso igual.',
    },
    {
      q: 'Ações do mesmo setor diversificam a carteira?',
      a: 'Pouco. Empresas do mesmo setor respondem aos mesmos fatores, como juros, preço de commodities ou regulação, e por isso costumam ter correlação alta. Na conta de Markowitz, quanto maior a correlação, menor a queda de risco ao combinar as ações. Com correlação igual a 1 não há queda nenhuma: o risco da carteira é só a média ponderada do risco das ações.',
    },
    {
      q: 'O que é o índice de Sharpe e qual valor é bom?',
      a: 'O índice de Sharpe mede quanto retorno acima da taxa livre de risco uma carteira entrega por unidade de risco: (retorno esperado menos taxa livre) dividido pela volatilidade. Quanto maior, melhor, desde que a comparação seja entre carteiras com as mesmas premissas, o mesmo período e a mesma taxa livre. Uma regra de bolso comum chama de bom um Sharpe acima de 1, mas ela não vale para todo mercado e período: com a taxa livre alta do Brasil, valores menores são comuns. Sharpe negativo quer dizer retorno esperado abaixo da taxa livre.',
    },
    {
      q: 'Que taxa livre de risco usar no Brasil: Selic, CDI ou Tesouro?',
      a: 'Use a taxa de uma aplicação de baixo risco no mesmo horizonte da análise. Para 12 meses, as escolhas mais comuns são o CDI, a Selic ou a taxa de um título prefixado do Tesouro com vencimento perto de 1 ano. No Otimizador, a taxa livre começa na taxa prefixada de 1 ano e pode ser alterada. Com juros altos, ela pesa muito: se nenhuma combinação de ações supera a taxa livre pelas suas premissas, não existe carteira de tangência, e a referência passa a ser a carteira de menor risco.',
    },
    {
      q: 'Dá para fazer a fronteira eficiente no Excel?',
      a: 'Dá. Monte uma coluna de pesos que some 100%, calcule o retorno esperado da carteira com SOMARPRODUTO dos pesos pelos retornos e a variância com a matriz de covariância (COVARIAÇÃO.S para cada par e MATRIZ.MULT para multiplicar pesos, matriz e pesos). Com o Solver, minimize a variância para cada retorno-alvo, com pesos entre 0% e 100%: cada solução é um ponto da fronteira. Para a carteira de maior Sharpe, maximize o retorno acima da taxa livre dividido pela volatilidade. O trabalho cresce rápido com o número de ações, e o resultado continua dependendo das premissas.',
    },
    {
      q: 'De onde vem o retorno esperado no Otimizador?',
      a: 'De você. Para cada ação, o retorno esperado em 12 meses sai do preço-alvo: o que você digita, o da sua tese ou do seu valuation salvos na plataforma ou, sem nenhum deles, a média dos modelos de preço justo de Graham, Bazin e Gordon que se aplicam à ação. O retorno é a alta (ou a queda) da cotação até esse alvo, somada aos proventos esperados. Não é previsão: é a premissa que entra na conta. A volatilidade e a correlação vêm de cerca de 1 ano de preços.',
    },
    {
      q: 'A IA escolhe os pesos da carteira?',
      a: 'Não. Os pesos saem da conta de Markowitz, resolvida de forma exata com as premissas da tela: a fronteira eficiente, a carteira de menor risco e a de maior índice de Sharpe. O sorteio de carteiras só desenha a nuvem do gráfico. O AIrton, a IA da plataforma, comenta o resultado e aponta as premissas que mais pesam nele, e pode errar.',
    },
    {
      q: 'A carteira de maior Sharpe é uma recomendação de investimento?',
      a: 'Não. É uma referência de cálculo com as premissas que você escolheu: se um preço-alvo mudar, os pesos mudam. A ferramenta não diz o que comprar ou vender, e a decisão depende da sua análise, do seu objetivo e do seu prazo.',
    },
  ],
  definedTerms: [
    {
      name: 'Fronteira eficiente',
      description: 'Conjunto das carteiras com o maior retorno esperado para cada nível de risco, dadas as premissas de retorno, volatilidade e correlação dos ativos. Carteiras abaixo dela são ineficientes.',
    },
    {
      name: 'Índice de Sharpe',
      description: 'Retorno esperado acima da taxa livre de risco dividido pela volatilidade. Mede o retorno extra por unidade de risco; só compara carteiras com as mesmas premissas e a mesma taxa livre.',
    },
    {
      name: 'Carteira de tangência',
      description: 'Ponto da fronteira eficiente tocado pela reta que sai da taxa livre de risco. É a carteira de maior índice de Sharpe com aqueles ativos e aquelas premissas.',
    },
    {
      name: 'Carteira de menor risco',
      description: 'Combinação dos ativos com a menor volatilidade possível, também chamada de carteira de variância mínima. É o ponto de partida da fronteira eficiente.',
    },
  ],
  sources: 'Teoria: H. Markowitz, “Portfolio Selection”, The Journal of Finance (1952); índice de Sharpe: W. F. Sharpe, “Mutual Fund Performance”, The Journal of Business (1966). Ferramenta: tela Otimizador da plataforma IAções (premissas, fronteira, tangência e relatório). A animação e o exemplo com duas ações são ilustrativos e não usam dado de mercado.',
  contentRevised: '2026-10-07',
};
