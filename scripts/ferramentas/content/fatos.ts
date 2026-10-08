/**
 * Fatos relevantes (Documentos da CVM) — página com DADO REAL do build (SPEC §3; SPEC-v2 §C Fatos).
 *
 * Dado: /ferramentas/fatos-relevantes/dados.json (data.ts buildFatos; DADOS-API.md §2): só Fato
 * Relevante (FR) e Comunicado ao Mercado (CM) com resumo por IA. Press release não tem resumo e
 * ITR/DFP não têm resumo por decisão do app: nada de "press release" em title, descrição,
 * frase-resposta e FAQ. A data mostrada é a de publicação na CVM; a hora é sempre "entrou no feed
 * às HH:MM" (não é publicação nem entrega de alerta). Sem contagem de documentos ou de empresas.
 *
 * Verdade do produto (honestidade-rotas.md, "Feed de Documentos CVM" e "Alertas CVM"): feed, leitor
 * e aba Documentos exigem login; o resumo aparece em qualquer conta e abrir o documento no app é dos
 * planos pagos; FR, CM e release geram alerta, ITR e DFP não; sem resumo em alguns minutos o alerta
 * sai só com o aviso; FII, ETF e BDR em geral não disparam; push em tempo real no WhatsApp/Telegram
 * só nos planos pagos; na conta grátis, aviso no app e briefing por e-mail reduzido (com carteira
 * salva); proventos, preço-alvo e critérios da tese vão no resumo da manhã, só nos pagos.
 * Sem link externo para a CVM (decisão de 21/set, SPEC-v2 §B5): os itens linkam /airton/T/ (se
 * existir) e /T/ (seção SSR "fatos", sections/fatos.tsx).
 *
 * Normas conferidas no texto consolidado da CVM: Resolução CVM nº 44/2021 (art. 2º definição e
 * exemplos; art. 3º DRI, CVM e B3; art. 5º antes da abertura ou depois do fechamento, suspensão;
 * art. 6º sigilo e divulgação imediata; art. 12 §1º patamares de 5%, 10%, 15%) e Resolução CVM
 * nº 80/2022 (ITR em até 45 dias do fim do trimestre; DFP em até 3 meses do fim do exercício).
 * A CVM abriu em 13/05/2025 a Consulta Pública SDM nº 01/2025, com minuta para substituir a
 * Resolução 44 e separar com mais clareza fato relevante de comunicado ao mercado (notícia da CVM
 * de 13/05/2025; prazo prorrogado até 18/07/2025). Em 15/09/2026 a nova norma ainda não tinha
 * saído e a Resolução 44 seguia em vigor (Capital Aberto, "Quando uma informação vira fato
 * relevante"). Revisar a página quando a nova resolução for editada.
 *
 * ai_summary é texto longo (mediana de ~2.800 a ~3.400 caracteres em 07/10/2026): a página mostra
 * só o começo (até 240 caracteres, data.ts). Nada de "resumo curto".
 *
 * Tokens: {data} = data de publicação do documento mais recente (dd/mm/aaaa).
 */
import { SCREENS } from '../links';
import type { ToolContent } from '../types';

export const fatos: ToolContent = {
  id: 'fatos',
  slug: 'fatos-relevantes',
  status: 'pronto',
  name: 'Documentos da CVM',
  keyword: 'fatos relevantes',
  title: 'Fatos Relevantes da B3 e CVM com Resumo por IA | IAções',
  description: 'Fatos relevantes e comunicados ao mercado das empresas da B3 publicados na CVM, com resumo gerado por IA. Documento mais recente: {data}.',
  h1: 'Fatos relevantes e comunicados das empresas da B3, resumidos por IA',
  answer: 'Esta página reúne fatos relevantes e comunicados ao mercado publicados na CVM pelas empresas da B3, cada um com um resumo gerado por IA. Entram os mais recentes que já têm resumo; o mais novo é de {data}. O resumo pode conter erros e não substitui o documento oficial.',
  blurb: 'Fatos relevantes e comunicados ao mercado recentes das empresas da B3, cada um com um resumo gerado por IA.',
  cta: {
    label: 'Receber alertas na plataforma',
    target: SCREENS.notificacoes,
    screen: 'Central de Notificações',
    note: 'A Central de Notificações é aberta a qualquer conta. Na conta grátis, o aviso aparece no app, e quem tem carteira salva recebe um resumo por e-mail limitado. O alerta em tempo real no WhatsApp e no Telegram é dos planos pagos.',
  },
  finalCta: {
    title: 'Receba os próximos fatos relevantes das suas ações',
    text: 'Na Central de Notificações, escolha as empresas que quer acompanhar e por onde quer ser avisado. O aviso no app vale para qualquer conta; o alerta em tempo real no WhatsApp e no Telegram é dos planos pagos.',
    label: 'Abrir a Central de Notificações',
  },
  widget: {
    id: 'fatos',
    illustrative: false,
    label: 'Feed com os documentos mais recentes da CVM, um a um, com o resumo gerado por IA de cada um',
    caption: 'Documentos reais, mostrados um a um na ordem em que entraram no feed; a lista é atualizada uma vez por dia útil. Resumos gerados por IA: podem conter erros e não substituem o documento oficial. Documento mais recente: {data}.',
  },
  dataSource: 'fatos',
  sections: [
    {
      id: 'ultimos',
      title: 'Últimos fatos relevantes e comunicados',
      blocks: [
        { type: 'p', text: 'Os documentos mais recentes que já têm resumo, do mais novo para o mais antigo. A data é a da publicação na CVM. A hora mostra quando o documento entrou no feed da plataforma, e não quando foi publicado.' },
        { type: 'fatos-list', limit: 12 },
        { type: 'ssr', id: 'fatos' },
      ],
    },
    {
      id: 'o-que-e',
      title: 'O que são fatos relevantes',
      blocks: [
        { type: 'p', text: '**Fatos relevantes** são os avisos que uma companhia aberta é obrigada a publicar quando acontece algo capaz de mexer com a cotação das suas ações ou com a decisão de quem investe nelas. A definição está no art. 2º da Resolução CVM nº 44, de 2021: é relevante qualquer decisão do acionista controlador, da assembleia ou da administração, ou qualquer outro fato ligado aos negócios da empresa, que possa influir de modo ponderável na cotação, na decisão de comprar, vender ou manter a ação, ou no exercício dos direitos de quem a tem.' },
        { type: 'p', text: 'Quem responde pela divulgação é o diretor de relações com investidores (DRI). Ele envia o documento à CVM e à B3 e cuida para que a informação chegue a todos ao mesmo tempo. A norma pede que a divulgação aconteça, sempre que possível, antes da abertura ou depois do fechamento do pregão. Se for preciso divulgar com o pregão aberto, o DRI pode pedir a suspensão da negociação até a informação se espalhar.' },
        { type: 'p', text: 'A própria resolução dá exemplos: mudança de controle, fusão, incorporação ou cisão, recompra de ações, desdobramento ou grupamento, lucro ou prejuízo e distribuição de proventos, mudança de projeções, contratos e projetos importantes e pedido de recuperação judicial ou extrajudicial. Em casos excepcionais, a empresa pode adiar a divulgação para proteger um interesse legítimo, mas tem de publicar na hora se a informação vazar ou se a ação oscilar de forma atípica.' },
        { type: 'h3', text: 'Fato relevante ou comunicado ao mercado?' },
        { type: 'p', text: 'O comunicado ao mercado serve para informações de interesse dos investidores que não chegam a ser fato relevante: esclarecimentos sobre notícias, respostas a ofícios da CVM ou da B3, avisos de que um acionista passou a ter ou deixou de ter uma participação relevante, datas de eventos. A fronteira nem sempre é nítida, e cada empresa escolhe o formato: há quem publique a agenda de resultados como fato relevante e quem use comunicado.' },
        {
          type: 'cards',
          items: [
            { title: 'Fato relevante', tone: 'red', text: 'Exigido pela Resolução CVM nº 44 quando um ato ou fato pode influir de modo ponderável na cotação ou na decisão de investir. Exemplos: aquisição, recompra de ações, troca de controle, recuperação judicial.' },
            { title: 'Comunicado ao mercado', tone: 'blue', text: 'Informação de interesse do mercado sem o peso de um fato relevante. Exemplos: esclarecimento de notícia, resposta a ofício, participação acionária relevante, agenda de eventos.' },
          ],
        },
        { type: 'p', text: 'Em maio de 2025, a CVM abriu uma consulta pública para substituir a Resolução CVM nº 44, com critérios mais claros para separar o que é fato relevante do que é comunicado ao mercado. Até a nova norma sair, vale a Resolução CVM nº 44.' },
      ],
    },
    {
      id: 'como-funciona',
      title: 'Como funciona esta lista',
      blocks: [
        { type: 'p', text: 'A plataforma IAções recebe os documentos que as companhias abertas publicam na CVM. Um modelo de inteligência artificial resume os fatos relevantes e os comunicados ao mercado em português. Nem todo documento ganha resumo, e só os que têm entram aqui.' },
        {
          type: 'list',
          items: [
            '**Fonte:** os fatos relevantes e os comunicados ao mercado das companhias abertas, com o título que a própria empresa deu ao documento.',
            '**Resumo:** gerado por IA e cortado em poucas linhas nesta página. Pode conter erros e não substitui o documento oficial, que fica no site da CVM e na área de relações com investidores da empresa.',
            '**Datas:** a data é a da publicação na CVM. A hora mostra quando o documento entrou no feed da plataforma.',
            '**Atualização:** a lista é gerada uma vez por dia útil, à noite, depois do fechamento do pregão. Ao longo do dia, os documentos novos chegam ao feed e aos alertas da plataforma.',
            '**Links:** cada documento leva à página da empresa no [AIrton](/airton/), com os documentos recentes dela, ou à página da ação, com preço justo, indicadores e proventos.',
            '**O que fica de fora:** documentos sem resumo, releases de resultados, ITR e DFP, e empresas sem página no site.',
          ],
        },
        { type: 'h3', text: 'A ordem dos documentos' },
        { type: 'p', text: 'Os mais recentes vêm primeiro. No mesmo dia, vale a hora de entrada no feed. Um documento publicado à noite pode entrar no feed só na manhã seguinte: nesse caso, a hora aparece junto com o dia em que ele entrou.' },
      ],
    },
    {
      id: 'itr-dfp',
      title: 'ITR e DFP: os resultados trimestrais e anuais',
      blocks: [
        { type: 'p', text: 'Os resultados chegam à CVM em dois formulários previstos na Resolução CVM nº 80, de 2022. O **ITR** (Informações Trimestrais) traz as demonstrações financeiras de cada um dos três primeiros trimestres do ano, revisadas pelo auditor independente, e deve ser entregue em até 45 dias depois do fim do trimestre. A **DFP** (Demonstrações Financeiras Padronizadas) traz as demonstrações do ano inteiro, auditadas, em até três meses depois do fim do exercício social.' },
        { type: 'p', text: 'Na plataforma, ITR e DFP aparecem no feed e na aba Documentos de cada ação, mas sem resumo por IA e sem alerta. É uma decisão de produto, e por isso eles não entram nesta lista. Muitas empresas avisam a data de divulgação dos resultados por fato relevante ou comunicado, e esses avisos aparecem aqui.' },
        { type: 'p', text: 'Para ver os números, a [página de cada ação](/acoes/) mostra até 10 anos de DRE, balanço, fluxo de caixa e proventos, com o preço justo por Graham, Bazin e Gordon.' },
      ],
    },
    {
      id: 'como-ler',
      title: 'Como ler um fato relevante',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            '**Comece pelo título e pela data.** O título diz o assunto. A data mostra há quanto tempo a informação é pública.',
            '**Procure os números.** Valor da operação, prazos, quantidade de ações e as aprovações que ainda faltam.',
            '**Separe decisão de intenção.** Memorando de entendimentos, proposta e negociação em andamento não são negócio fechado.',
            '**Compare com o tamanho da empresa.** O mesmo valor pesa muito mais numa empresa pequena: compare com o valor de mercado, com o caixa e com a dívida.',
            '**Veja o que muda para o acionista.** Proventos, diluição, dívida, controle e governança.',
            '**Leia o documento oficial.** O resumo por IA ajuda na triagem, mas pode errar.',
          ],
        },
        { type: 'h3', text: 'Temas que aparecem com frequência' },
        {
          type: 'list',
          items: [
            '**Recompra de ações:** a empresa anuncia que pode comprar as próprias ações na bolsa, até uma quantidade e um prazo definidos. Anunciar não obriga a recomprar tudo, e o efeito depende do que for executado e de as ações serem canceladas ou não.',
            '**Proventos:** quando a empresa anuncia dividendos ou juros sobre capital próprio por fato relevante ou comunicado, o documento traz o valor por ação, a data-com e a data de pagamento.',
            '**Participação acionária relevante:** um investidor cruzou, para cima ou para baixo, um patamar de 5%, 10%, 15% (e assim por diante) de uma espécie ou classe de ações. A Resolução CVM nº 44 exige o aviso, que costuma sair como comunicado ao mercado.',
            '**Recuperação judicial ou extrajudicial:** sinal de dificuldade financeira séria. Leia as condições do plano e o que acontece com a dívida e com os acionistas.',
            '**Agenda de resultados:** muitas empresas avisam com antecedência a data em que vão divulgar o ITR ou a DFP.',
          ],
        },
      ],
    },
    {
      id: 'na-plataforma',
      title: 'Documentos da CVM na plataforma',
      blocks: [
        { type: 'p', text: 'Na plataforma IAções, os documentos aparecem principalmente em três lugares. Todos exigem login.' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**Feed da CVM, no Dashboard:** fatos relevantes, comunicados, releases de resultados, ITR e DFP em ordem cronológica, com filtro por tipo, busca por ticker ou empresa e filtro pela sua carteira. O resumo aparece em qualquer conta; abrir o documento dentro da plataforma é dos planos pagos.',
            '**Aba Documentos de cada ação:** o arquivo da empresa organizado por tipo e por ano, com busca no assunto.',
            '**Central de Notificações:** onde você escolhe as empresas que quer acompanhar e por onde quer ser avisado.',
          ],
        },
        { type: 'p', text: 'No feed, dá para mandar um documento para o [AIrton](/airton/), o assistente de IA da plataforma, e perguntar o que mudou para a empresa.' },
        { type: 'h3', text: 'Alertas: o que vem na conta grátis e o que é pago' },
        {
          type: 'list',
          items: [
            '**Conta grátis:** aviso no app quando sai um fato relevante ou comunicado de uma empresa que você acompanha (na carteira, numa tese ou na Central), e resumo por e-mail limitado para quem tem carteira salva.',
            '**Planos pagos:** o mesmo alerta chega também em tempo real no WhatsApp e no Telegram, com o resumo por IA. No WhatsApp, você pode perguntar ao AIrton o que muda para você.',
            '**Sem resumo pronto:** se o resumo não sair em alguns minutos, o alerta vai só com o aviso de que o documento foi publicado.',
            '**Sem alerta:** ITR e DFP. Fundos imobiliários, ETFs e BDRs em geral também não disparam alertas de documentos.',
          ],
        },
        { type: 'note', tone: 'info', text: 'Proventos, preço-alvo e critérios da sua tese não chegam na hora: são conferidos uma vez por dia e vão no resumo da manhã, só nos planos pagos. Para registrar os critérios, veja como montar a sua [tese de investimento](/ferramentas/tese-de-investimento/).' },
      ],
    },
  ],
  faq: [
    {
      q: 'O que é fato relevante?',
      a: 'É o aviso que uma companhia aberta é obrigada a publicar quando acontece algo que pode influir de modo ponderável na cotação das ações ou na decisão de investir nelas, como uma aquisição, uma recompra de ações ou um pedido de recuperação judicial. A definição está na Resolução CVM nº 44, de 2021, e a divulgação cabe ao diretor de relações com investidores.',
    },
    {
      q: 'Qual a diferença entre fato relevante e comunicado ao mercado?',
      a: 'O fato relevante é exigido pela Resolução CVM nº 44 quando um ato ou fato pode influir de modo ponderável na cotação ou na decisão do investidor. O comunicado ao mercado serve para informações que não chegam a esse nível, como esclarecimentos sobre notícias, respostas a ofícios da CVM ou da B3 e avisos de participação acionária relevante. Cada empresa escolhe o formato, e a fronteira nem sempre é nítida.',
    },
    {
      q: 'O que são ITR e DFP?',
      a: 'São os formulários com os resultados das companhias abertas, previstos na Resolução CVM nº 80, de 2022. O ITR traz as demonstrações de cada um dos três primeiros trimestres, revisadas pelo auditor, em até 45 dias depois do fim do trimestre. A DFP traz as demonstrações anuais auditadas, em até três meses depois do fim do exercício. Na plataforma, ITR e DFP aparecem sem resumo por IA e não geram alerta.',
    },
    {
      q: 'Como funciona o resumo por IA?',
      a: 'Um modelo de inteligência artificial lê o fato relevante ou o comunicado ao mercado e escreve um resumo em português; nesta lista aparece só o começo dele. Nem todo documento ganha resumo, e só os que têm entram nesta lista. O resumo serve para a triagem: pode conter erros e não substitui o documento oficial, que fica no site da CVM e na área de relações com investidores da empresa.',
    },
    {
      q: 'Como receber alertas de fatos relevantes?',
      a: 'Crie uma conta na plataforma IAções e escolha, na Central de Notificações, as empresas que quer acompanhar. Na conta grátis, o aviso aparece no app, e quem tem carteira salva recebe um resumo por e-mail limitado. O alerta em tempo real no WhatsApp e no Telegram é dos planos pagos. ITR e DFP não geram alerta, e fundos imobiliários, ETFs e BDRs em geral também não.',
    },
    {
      q: 'De quanto em quanto tempo esta lista é atualizada?',
      a: 'Uma vez por dia útil, à noite, depois do fechamento do pregão, com os documentos que já têm resumo naquele momento. A data de cada item é a da publicação na CVM, e a hora mostra quando o documento entrou no feed da plataforma. Para acompanhar ao longo do dia, use o feed e os alertas da plataforma.',
    },
    {
      q: 'Por que alguns documentos não aparecem nesta lista?',
      a: 'A página mostra só os fatos relevantes e comunicados ao mercado mais recentes que já têm resumo por IA, de empresas com página no site. Ficam de fora os documentos sem resumo, os resultados trimestrais e anuais (ITR e DFP) e formulários como atas de assembleia e o formulário de referência.',
    },
    {
      q: 'Esta lista é recomendação de investimento?',
      a: 'Não. A página resume documentos públicos para ajudar você a acompanhar as empresas. Ela não diz o que fazer com nenhuma ação: a decisão depende da sua análise do preço, dos riscos e do documento completo.',
    },
  ],
  definedTerms: [
    { name: 'Fato relevante', description: 'Ato ou fato que pode influir de modo ponderável na cotação das ações de uma companhia aberta ou na decisão de investir nelas. A divulgação é obrigatória pela Resolução CVM nº 44.' },
    { name: 'Comunicado ao mercado', description: 'Documento que a companhia aberta usa para informações de interesse dos investidores que não chegam a ser fato relevante, como esclarecimentos e respostas a ofícios.' },
    { name: 'Diretor de relações com investidores (DRI)', description: 'Diretor da companhia aberta responsável por enviar os fatos relevantes à CVM e à B3 e por cuidar da divulgação das informações ao mercado.' },
    { name: 'ITR (Informações Trimestrais)', description: 'Formulário com as demonstrações financeiras de cada um dos três primeiros trimestres do ano, revisadas pelo auditor e entregues à CVM em até 45 dias.' },
    { name: 'DFP (Demonstrações Financeiras Padronizadas)', description: 'Formulário com as demonstrações financeiras anuais auditadas, entregue à CVM em até três meses depois do fim do exercício social.' },
  ],
  sources: 'Documentos: fatos relevantes e comunicados ao mercado enviados pelas companhias abertas à CVM, com o título original. Resumos gerados por IA. Normas: Resolução CVM nº 44/2021 (fato relevante) e Resolução CVM nº 80/2022 (ITR e DFP).',
  contentRevised: '2026-10-07',
};
