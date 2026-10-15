// Lote de ajuste dos textos da Universidade MOVV Partner (Junior, 15/10/2026).
// Lido por scripts/aplicarTextosUniversidade.js. Conteúdo da apostila, sem
// dado de Partner. NUNCA escrever percentual de comissão aqui: "X%" é de
// propósito (exemplo ilustrativo).
//
// Tipos de item:
//   topico        troca título e texto (localiza por módulo + aula + tópico e
//                 confere o título atual; se não conferir, pula e lista)
//   topico_trecho troca só um trecho do texto (se o trecho não existir, pula)
//   topico_novo   cria um tópico no fim da aula (uma vez só: se já houver
//                 tópico com o mesmo título na aula, não cria)
//   aula_titulo   troca o título de uma aula
//   adiado        fica registrado, mas NÃO é aplicado até autorização
// As trocas gerais (G1 e R1) rodam depois dos itens, sobre o resultado deles.
// "mantém" o título = o título atual do banco fica como está.

const LOTE = 'textos-2026-10';

// "em breve" dos níveis 2 a 4 do Módulo 10 (T39 a T41)
const emBreve = (nome, titulosAtuais) => [
  { tituloAtual: titulosAtuais[0], novoTitulo: 'Nível ainda não disponível.', novoTexto: `O nível ${nome} está em breve. Ele ainda não está disponível no programa.` },
  { tituloAtual: titulosAtuais[1], novoTitulo: 'Quando estiver disponível.', novoTexto: 'As condições do nível serão divulgadas no portal quando forem definidas.' },
  { tituloAtual: titulosAtuais[2], novoTitulo: 'Enquanto isso.', novoTexto: 'Por enquanto, o único nível ativo é o MOVV Partner Mobile.' },
];

const ITENS = [
  // ── Módulo 0 ──────────────────────────────────────────────────────────────
  { id: 'T01', tipo: 'topico', mod: 0, aula: 1, top: 1,
    tituloAtual: 'Relação autônoma/PJ (MEI ou equivalente) — o que isso significa na prática.',
    novoTexto: 'O MOVV Partner atua como profissional autônomo ou pessoa jurídica (PJ), geralmente enquadrado como MEI ou categoria equivalente. Isso significa que não existe vínculo empregatício (CLT) com o Grupo Movv — não há carteira assinada, jornada fixa ou subordinação hierárquica no sentido trabalhista. O Partner atua onde quiser, quando quiser e quanto quiser, e pode encerrar a parceria a qualquer momento, respeitando as regras de conduta do programa. Essa liberdade vem acompanhada de responsabilidade: é o próprio Partner quem cuida da sua regularização fiscal, conforme a orientação da Central no cadastro.' },
  { id: 'T45', tipo: 'adiado', mod: 0, aula: 1, top: 2,
    tituloAtual: 'Documentos necessários para o cadastro (CPF/CNPJ, dados bancários, comprovante quando aplicável).',
    novoTitulo: 'Documentos e dados para o cadastro.',
    novoTexto: 'Para concluir o cadastro, a Central solicita seus documentos (CPF ou CNPJ, quando tiver MEI ou PJ aberto), a chave PIX para recebimento e, quando necessário, um comprovante de endereço. Cadastro incompleto ou com dados divergentes pode atrasar o pagamento.',
    motivo: 'PROVISÓRIO: aguarda autorização do Junior.' },
  { id: 'T02', tipo: 'topico', mod: 0, aula: 1, top: 3,
    tituloAtual: 'Como e quando emitir nota/RPA para liberar o pagamento de comissão.',
    novoTitulo: 'Documento fiscal para receber a comissão.',
    novoTexto: 'A forma de recebimento e o documento fiscal, quando aplicável (nota fiscal de serviço, no caso de MEI ou PJ, ou RPA, no caso de autônomo), são orientados pela Central no cadastro do Partner. Em caso de dúvida, fale com a Central antes do fechamento do mês.' },
  { id: 'T03', tipo: 'topico_trecho', mod: 0, aula: 2, top: 1,
    tituloAtual: 'Regras de uso da marca Grupo Movv.',
    trocas: [['com o crachá e os itens do kit fornecidos', 'com o crachá, a camiseta e os demais itens do kit fornecidos']] },
  { id: 'T04', tipo: 'topico_trecho', mod: 0, aula: 2, top: 3,
    tituloAtual: 'Regras de exclusividade de canal e de não concorrência entre Partners no mesmo cliente.',
    trocas: [['CRM', 'portal']] },
  { id: 'T05', tipo: 'topico', mod: 0, aula: 2, top: 4,
    tituloAtual: 'Motivos de desligamento e o que acontece com a carteira construída.',
    novoTitulo: 'Encerramento da parceria e o que acontece com a carteira construída.',
    novoTexto: 'O Partner pode encerrar a parceria a qualquer momento, por solicitação própria. O Grupo Movv também pode encerrá-la em caso de descumprimento do código de conduta ou de outras causas previstas no termo de adesão. Em qualquer caso, a carteira de clientes ativos e as comissões já geradas seguem as regras específicas definidas no termo — recomenda-se que o Partner leia esse trecho com atenção no momento da assinatura.' },
  { id: 'T06', tipo: 'topico', mod: 0, aula: 3, top: 3,
    tituloAtual: 'Regra de devolução em caso de desligamento.',
    novoTexto: 'Ao se desligar do programa, o Partner deve devolver o tablet e o crachá, em condições normais de uso, seguindo o prazo e o procedimento definidos pela Central. A camiseta fica com o Partner, que não deve usá-la para se apresentar como representante do Grupo Movv após o desligamento.' },
  { id: 'T46', tipo: 'aula_titulo', mod: 0, aula: 4,
    tituloAtual: 'Tablet, aplicativo e segurança da informação',
    novoTitulo: 'Tablet, portal e segurança da informação' },
  { id: 'T43', tipo: 'topico', mod: 0, aula: 4, top: 1,
    tituloAtual: 'Login e primeiro acesso ao aplicativo.',
    novoTitulo: 'Login e primeiro acesso ao portal.',
    novoTexto: 'Você entra no portal com o seu código de Partner, e-mail ou WhatsApp cadastrado e uma senha pessoal. O acesso é individual e intransferível. No primeiro acesso, defina uma senha própria e confira se os dados do seu perfil (nome, e-mail, WhatsApp) estão corretos antes de iniciar a trilha de onboarding.' },
  { id: 'T07', tipo: 'topico', mod: 0, aula: 4, top: 2,
    tituloAtual: 'Notificações do aplicativo.',
    novoTitulo: 'Acompanhamento e avisos.',
    novoTexto: 'O portal mostra o andamento das suas indicações e das suas comissões nas telas Início e Minhas vendas. Avisos por WhatsApp e notificações no celular serão ativados em breve.' },
  { id: 'T08', tipo: 'topico', mod: 0, aula: 4, top: 3,
    tituloAtual: 'Uso offline em campo e sincronização.',
    novoTitulo: 'Uso em campo.',
    novoTexto: 'O portal funciona no navegador do tablet ou do celular e precisa de internet para registrar uma indicação. Em locais com sinal fraco, registre a indicação assim que a conexão voltar e confira, ao final do dia, se todas foram registradas.' },

  // ── Módulo 1 ──────────────────────────────────────────────────────────────
  { id: 'T09', tipo: 'topico', mod: 1, aula: 5, top: 3,
    tituloAtual: 'LGPD e tratamento responsável de dados.',
    novoTexto: 'O Partner lida com dados pessoais sensíveis (CPF, CNPJ, dados financeiros) desde o primeiro contato com o cliente, e deve seguir os princípios da LGPD: coletar apenas o necessário, informar a finalidade do uso, armazenar com segurança no portal oficial e nunca guardar dados sensíveis de clientes (CPF, CNPJ, dados financeiros) em planilhas pessoais, anotações soltas ou aplicativos não autorizados.' },
  { id: 'T10', tipo: 'topico', mod: 1, aula: 6, top: 1,
    tituloAtual: 'Conceito de comissão.',
    novoTexto: 'A comissão é a forma de remuneração do Partner, calculada com base nas regras específicas de cada produto e paga depois que o Grupo Movv recebe o valor correspondente, conforme o fechamento mensal. O documento fiscal, quando aplicável, segue a orientação da Central.' },
  { id: 'T11', tipo: 'topico', mod: 1, aula: 6, top: 2,
    tituloAtual: 'Comissões únicas e recorrentes quando aplicáveis.',
    novoTitulo: 'Como cada produto gera comissão.',
    novoTexto: 'Cada produto tem a sua própria regra de comissão. A comissão é gerada quando o produto cumpre a regra definida (a venda ou contratação confirmada) e o que vale para cada produto está sempre na sua comissão vigente, no portal.' },
  { id: 'T12', tipo: 'topico', mod: 1, aula: 6, top: 3,
    tituloAtual: 'Critérios, prazos e regras específicas de cada produto.',
    novoTitulo: 'Critérios e prazos.',
    novoTexto: 'Os critérios de cada produto estão sempre na sua comissão vigente, no portal — nunca fixados em vídeo, justamente porque essas regras podem mudar. O prazo é o mesmo para todos: o mês fecha do dia 1 ao último dia, e o pagamento acontece até o 5º dia útil do mês seguinte.' },

  // ── Módulos 3 e 4 ─────────────────────────────────────────────────────────
  { id: 'T13', tipo: 'topico', mod: 3, aula: 1, top: 3,
    tituloAtual: 'Criação de lista de empresas e contatos.',
    novoTexto: 'Construir uma lista organizada de empresas e contatos, com nome, segmento, telefone e status de contato (sem CPF, CNPJ ou dados financeiros), é a base que transforma a prospecção de uma atividade aleatória em um processo administrável e mensurável.' },
  { id: 'T14', tipo: 'topico', mod: 3, aula: 6, top: 1,
    tituloAtual: 'Metas diárias e semanais.',
    novoTitulo: 'Metas pessoais.',
    novoTexto: 'Se quiser, defina metas pessoais de prospecção — número de contatos, visitas e cadastros — para manter a constância, que é o principal fator de sucesso em atividades comerciais de longo prazo. As metas são suas: o ritmo e a quantidade de trabalho você escolhe.' },
  { id: 'T15', tipo: 'topico', mod: 4, aula: 4, top: 2,
    tituloAtual: 'Como registrar oportunidades diferentes para o mesmo cliente.',
    novoTexto: 'Cada necessidade identificada deve ser cadastrada como uma oportunidade separada no CRM, vinculada ao mesmo cliente, permitindo que cada produto seja acompanhado de forma independente e, quando houver comissão habilitada para o produto, comissionado também de forma independente.' },

  // ── Módulo 5 (aulas: 1 Azul, 2 Certificado, 3 Benefícios, 4 Seguros,
  //    5 Federal Invest, 6 Open Gestão — localiza pela ordem da aula) ──────
  { id: 'T16', tipo: 'topico', mod: 5, aula: 1, top: 8,
    tituloAtual: 'Comissionamento.',
    novoTexto: 'A sua comissão em crédito é uma fatia da comissão que o Grupo Movv efetivamente recebe da Azul Empréstimo na operação. O percentual vigente está no portal e o pagamento segue o fechamento mensal.' },
  { id: 'T17', tipo: 'topico', mod: 5, aula: 2, top: 3,
    tituloAtual: 'Validade e renovação.',
    novoTexto: 'O certificado digital tem prazo de validade determinado (geralmente 1 ou 3 anos, conforme o tipo) e precisa ser renovado periodicamente, o que gera uma nova oportunidade a cada renovação, que o Partner pode acompanhar.' },
  { id: 'T18', tipo: 'topico', mod: 5, aula: 2, top: 7,
    tituloAtual: 'Comissão e acompanhamento.',
    novoTexto: 'A comissão do Movv Certificado é uma fatia do lucro da venda, conforme a sua comissão vigente no portal. Ela é gerada quando a venda é registrada com você como Partner responsável. Acompanhe os vencimentos dos seus clientes para indicar a renovação no momento certo.' },
  { id: 'T19', tipo: 'topico_novo', mod: 5, aula: 3,
    novoTitulo: 'Comissão.',
    novoTexto: 'Neste momento, MOVV Benefícios ainda não tem comissão habilitada para o Partner. A indicação é feita junto à Central, e a regra de comissão será divulgada no portal quando estiver disponível.' },
  { id: 'T20', tipo: 'topico_trecho', mod: 5, aula: 4, top: 7,
    tituloAtual: 'O que deve ser tratado pelo especialista.',
    trocas: [['valores de prêmio e franquia', 'valores de prêmio, franquia do seguro e condições']] },
  { id: 'T21', tipo: 'topico_novo', mod: 5, aula: 4,
    novoTitulo: 'Comissão.',
    novoTexto: 'A comissão de Seguros é uma fatia da comissão que o Grupo Movv efetivamente recebe pelo seguro, conforme a sua comissão vigente no portal. A equipe registra o valor no portal depois que o Grupo recebe, e ele aparece em Minhas vendas.' },
  { id: 'T22', tipo: 'topico_novo', mod: 5, aula: 5,
    novoTitulo: 'Comissão.',
    novoTexto: 'Neste momento, Federal Invest ainda não tem comissão habilitada para o Partner. A indicação é feita junto à Central, e a regra de comissão será divulgada no portal quando estiver disponível.' },
  { id: 'T23', tipo: 'topico_novo', mod: 5, aula: 6,
    novoTitulo: 'Comissão.',
    novoTexto: 'Neste momento, Open Gestão Empresarial ainda não tem comissão habilitada para o Partner. A indicação é feita junto à Central, e a regra de comissão será divulgada no portal quando estiver disponível.' },

  // ── Módulo 6 ──────────────────────────────────────────────────────────────
  { id: 'T44', tipo: 'topico_trecho', mod: 6, aula: 1, top: 1,
    tituloAtual: 'Comissão por produto.',
    trocas: [['na tabela vigente do portal', 'na sua comissão vigente, no portal']] },
  { id: 'T24', tipo: 'topico', mod: 6, aula: 1, top: 2,
    tituloAtual: 'Como o valor da sua comissão é calculado.',
    novoTexto: 'A comissão do Partner é sempre uma fatia do que o Grupo Movv efetivamente recebe, nunca uma porcentagem sobre o valor que o cliente contratou. Na Azul Empréstimo e em Seguros, a base é a comissão que o Grupo Movv recebe da operação. No Movv Certificado, a base é o lucro da venda (preço menos os custos). O percentual de cada produto está na sua comissão vigente, no portal, e o percentual aplicado fica registrado em cada lançamento.' },
  { id: 'T25', tipo: 'topico', mod: 6, aula: 1, top: 3,
    tituloAtual: 'Critérios para gerar comissão.',
    novoTexto: 'A comissão só é gerada quando os critérios definidos por cada produto são cumpridos — a venda ou contratação confirmada — e não apenas pelo encaminhamento da oportunidade. O pagamento acontece depois que o Grupo Movv recebe a comissão correspondente.' },
  { id: 'T26', tipo: 'topico', mod: 6, aula: 1, top: 4,
    tituloAtual: 'Momento de reconhecimento da comissão.',
    novoTitulo: 'Como acompanhar a comissão.',
    novoTexto: 'Assim que a comissão é gerada, ela aparece em Minhas vendas e segue as etapas: Comissão prevista, Comissão confirmada, Aprovada (a pagar) e Paga.' },
  { id: 'T27', tipo: 'topico', mod: 6, aula: 1, top: 5,
    tituloAtual: 'Prazo e regras de pagamento.',
    novoTexto: 'O mês fecha do dia 1 ao último dia, e o pagamento acontece até o 5º dia útil do mês seguinte (segunda a sexta, sem feriados nacionais). O portal mostra a data prevista na tela Início. O documento fiscal, quando aplicável, segue a orientação da Central.' },
  { id: 'T28', tipo: 'topico', mod: 6, aula: 2, top: 2,
    tituloAtual: 'Conceito de recorrência quando previsto.',
    novoTitulo: 'Recorrência.',
    novoTexto: 'Se o Grupo Movv receber mais de um pagamento de comissão pela mesma operação, você recebe a sua fatia sobre cada valor efetivamente recebido. Se algum produto passar a ter comissão recorrente, isso será descrito na sua comissão vigente, no portal.' },
  { id: 'T29', tipo: 'topico', mod: 6, aula: 2, top: 3,
    tituloAtual: 'Importância da permanência do cliente.',
    novoTitulo: 'Importância do relacionamento.',
    novoTexto: 'Mesmo sem comissão recorrente, o relacionamento pós-venda é o que gera novas indicações e renovações — por isso ele é tão importante quanto a venda em si.' },
  { id: 'T30', tipo: 'topico', mod: 6, aula: 4, top: 5,
    tituloAtual: 'Comissão.',
    novoTexto: 'Acompanhar a comissão prevista e a já paga permite ao Partner projetar sua renda e identificar rapidamente qualquer pendência.' },
  { id: 'T31', tipo: 'topico', mod: 6, aula: 5, top: 1,
    tituloAtual: 'Exemplo com certificados.',
    novoTitulo: 'Exemplo com Movv Certificado.',
    novoTexto: 'Uma simulação com Movv Certificado considera o volume de clientes com certificado vencendo em um período e a comissão correspondente por venda, calculada sobre o lucro, sempre conforme a sua comissão vigente no portal.' },
  { id: 'T32', tipo: 'topico', mod: 6, aula: 5, top: 3,
    tituloAtual: 'Exemplo com crédito.',
    novoTexto: 'Uma simulação com crédito considera o volume de oportunidades encaminhadas para a Azul Empréstimo e a taxa de aprovação típica, sempre reforçando que a aprovação depende exclusivamente da análise técnica. Lembrando a lógica da Aula 1: sua comissão é uma fatia da comissão que o Grupo recebeu naquela venda, nunca uma porcentagem direta sobre o valor emprestado ao cliente. Por exemplo (números ilustrativos): se o Grupo recebeu R$ 1.000 de comissão e a sua fatia vigente é X%, você recebe X% de R$ 1.000. Consulte sempre a sua comissão vigente no portal para os valores reais.' },
  { id: 'T33', tipo: 'topico', mod: 6, aula: 5, top: 4,
    tituloAtual: 'Exemplo com benefícios.',
    novoTexto: 'Neste momento, MOVV Benefícios ainda não tem comissão habilitada para o Partner, por isso não há simulação. Quando a regra for divulgada no portal, este exemplo será incluído.' },
  { id: 'T34', tipo: 'topico', mod: 6, aula: 5, top: 5,
    tituloAtual: 'Exemplo de carteira diversificada.',
    novoTexto: 'Uma carteira diversificada combina indicações em produtos diferentes, ampliando as chances de oportunidades ao longo do tempo — a estratégia mais recomendada para o Partner de médio e longo prazo.' },
  { id: 'T35', tipo: 'topico', mod: 6, aula: 6, top: 2,
    tituloAtual: 'Ranking.',
    novoTexto: 'Quando houver ranking de desempenho, ele compara a produção dos Partners de forma transparente, servindo como ferramenta de motivação e reconhecimento dentro da rede.' },

  // ── Módulo 8 ──────────────────────────────────────────────────────────────
  { id: 'T36', tipo: 'topico', mod: 8, aula: 4, top: 2,
    tituloAtual: 'Como agradecer.',
    novoTexto: 'Agradecer de forma genuína fortalece o relacionamento com quem indicou e incentiva novas indicações futuras. Não prometa prioridade, condição especial ou qualquer vantagem em nome do Grupo Movv.' },

  // ── Módulo 10 (níveis) ────────────────────────────────────────────────────
  { id: 'T37', tipo: 'topico', mod: 10, aula: 1, top: 1,
    tituloAtual: 'Trabalha sozinho.',
    novoTexto: 'No nível Mobile, o Partner atua individualmente, sem equipe ou estrutura fixa. Por enquanto, este é o único nível ativo do programa e o formato ideal para quem está construindo sua base de clientes e testando o modelo.' },
  { id: 'T38', tipo: 'topico', mod: 10, aula: 1, top: 3,
    tituloAtual: 'Foco em relacionamento e prospecção.',
    novoTexto: 'O foco principal do Partner Mobile é desenvolver habilidade de relacionamento e prospecção, construindo a base para os próximos níveis, quando forem divulgados no portal.' },
  ...emBreve('MOVV Partner Point', ['Possibilidade de ponto comercial.', 'Atendimento local.', 'Fortalecimento da marca na região.'])
    .map((x, i) => ({ id: `T39.${i + 1}`, tipo: 'topico', mod: 10, aula: 2, top: i + 1, ...x })),
  ...emBreve('MOVV Partner Hub', ['Possibilidade de ampliar equipe própria, contratada por conta e risco do Partner (sem comissão em cascata', 'Mais capacidade comercial.', 'Desenvolvimento regional.'])
    .map((x, i) => ({ id: `T40.${i + 1}`, tipo: 'topico', mod: 10, aula: 3, top: i + 1, ...x })),
  ...emBreve('Partner Regional', ['Construção de carteira regional.', 'Parcerias estratégicas.', 'Possibilidades conforme regras do programa.'])
    .map((x, i) => ({ id: `T41.${i + 1}`, tipo: 'topico', mod: 10, aula: 4, top: i + 1, ...x })),

  // ── Módulo 11 ─────────────────────────────────────────────────────────────
  { id: 'T42', tipo: 'topico', mod: 11, aula: 1, top: 10,
    tituloAtual: 'Crescimento.',
    novoTexto: 'A conclusão do Módulo 10 confirma que o Partner compreende como funcionam os níveis do programa e que, por enquanto, o nível ativo é o Mobile.' },
];

// Trocas gerais, aplicadas DEPOIS dos itens (inclusive sobre os textos novos)
const TROCAS_GERAIS = [
  // G1 (D1): tópicos, aulas, módulos e quiz; o termo de adesão NÃO
  { id: 'G1', tabelas: ['topicos', 'aulas', 'modulos', 'quiz'], excetoModulos: [],
    trocas: [['MOVV Certificados', 'Movv Certificado'], ['Movv Certificados', 'Movv Certificado'], ['MOVV Certificado', 'Movv Certificado']] },
  // R1: "CRM" vira "portal" em tópicos, aulas e quiz, menos nos módulos 7, 12 e 14
  { id: 'R1', tabelas: ['topicos', 'aulas', 'quiz'], excetoModulos: [7, 12, 14],
    trocas: [['CRM', 'portal']], palavraInteira: true, maiusculaNoInicio: true },
];

module.exports = { LOTE, ITENS, TROCAS_GERAIS };
