// Quiz da Universidade MOVV Partner — complemento do lote textos-2026-10
// (Junior, 15/10/2026). Lido por scripts/aplicarTextosUniversidade.js junto
// com lote-2026-10.js. Sem dado de Partner; sem percentual de comissão.
//
// Tipos:
//   quiz_reescrita  troca enunciado e as 4 opções (ids novos, fixos por item);
//                   localiza pelo MÓDULO + ENUNCIADO ATUAL (se não achar, pula);
//                   a explicação fica vazia, como hoje; o número não muda
//   quiz_opcao      troca só o texto de uma opção (o id dela continua)
// A tela já embaralha perguntas e opções a cada tentativa; mesmo assim a
// opção certa fica gravada numa posição diferente em cada pergunta.

// Põe a opção certa na posição `pos` (1 a 4), mantendo a ordem das outras
function posicionar(opcoes, pos) {
  const certa = opcoes.find(o => o[1]);
  const outras = opcoes.filter(o => !o[1]);
  outras.splice(pos - 1, 0, certa);
  return outras.map(([texto, correta]) => ({ texto, correta: Boolean(correta) }));
}

const q = (id, mod, numero, atual, novo, opcoes, pos) => ({
  id, tipo: 'quiz_reescrita', mod, numero, enunciadoAtual: atual, novoEnunciado: novo, opcoes: posicionar(opcoes, pos),
});
const C = true; // marca a correta

const conclusao = (id, mod, numero, pos) => q(id, mod, numero,
  `Qual é o critério de conclusão do Módulo ${mod}?`,
  `Para concluir o Módulo ${mod}, o que o Partner precisa fazer?`,
  [['Somente abrir o módulo, sem fazer o quiz'],
    ['Enviar um trabalho por e-mail para a Central'],
    ['Estudar as aulas e ser aprovado no quiz do módulo, com a nota mínima definida pela administração', C],
    ['Nada, o módulo é opcional']], pos);

const ITENS = [
  q('Q01', 0, 2, 'O que é necessário para liberar o pagamento de uma comissão?',
    'Em caso de dúvida sobre o documento fiscal para receber a comissão, o que o Partner deve fazer?',
    [['Emitir qualquer documento por conta própria, sem avisar ninguém'], ['Falar com a Central antes do fechamento do mês', C],
      ['Esperar o cliente final informar o que fazer'], ['Não precisa se preocupar, o portal resolve tudo sozinho']], 1),
  q('Q02', 0, 4, 'O que o sistema não deve liberar até o Partner concluir o Módulo 0?',
    'O que o Partner precisa fazer no Módulo 0?',
    [['Cadastrar a própria carteira de clientes'], ['Fazer uma prova presencial'],
      ['Ler o conteúdo e aceitar o termo de adesão', C], ['Nada, o módulo é opcional']], 4),
  { id: 'Q03', tipo: 'quiz_opcao', mod: 2, numero: 4, enunciadoAtual: 'O que o Partner deve priorizar segundo o módulo?',
    trocas: [['Evitar registrar oportunidades no CRM', 'Evitar registrar indicações no portal']] },
  { id: 'Q04', tipo: 'quiz_opcao', mod: 3, numero: 1, enunciadoAtual: 'O que compõe o "território comercial" do Partner?',
    trocas: [['Somente o CRM', 'Somente o portal']] },
  q('Q05', 3, 5, 'Por que o Módulo 3 deve ter forte componente de vídeo e simulações, segundo a diretriz ao Jesley?',
    'Por que o Módulo 3 combina conteúdo teórico com exemplos e simulações?',
    [['Por exigência legal'], ['Porque o Partner precisa ver exemplos reais de abordagem, não só teoria', C],
      ['Porque não existe conteúdo escrito disponível'], ['Não há motivo específico para isso']], 3),
  q('Q06', 5, 4, 'Qual é a forma de certificação de conhecimento comercial do portfólio?',
    'Como o Partner demonstra que conhece o portfólio?',
    [['Com uma entrevista presencial'], ['Aprovando operações de crédito dos clientes'],
      ['Sendo aprovado no quiz do Módulo 5, com a nota mínima definida pela administração', C], ['Não é necessário demonstrar']], 2),
  q('Q07', 5, 5, 'Segundo a diretriz ao Jesley, quem deve manter o conteúdo técnico de cada produto atualizado?',
    'Quem mantém o conteúdo técnico de cada produto atualizado no portal?',
    [['O próprio Partner'], ['Ninguém, o conteúdo é fixo'],
      ['Os responsáveis de cada empresa, mantendo o portal sempre na versão vigente', C], ['Somente um colaborador específico']], 4),
  q('Q08', 6, 1, 'O que NUNCA deve ser fixado em vídeo, segundo a diretriz ao Jesley?',
    'Onde o Partner consulta o percentual de comissão de cada produto?',
    [['Em um vídeo gravado da Universidade'], ['Em mensagens antigas de WhatsApp'],
      ['Na sua comissão vigente, no portal', C], ['Com o próprio cliente']], 1),
  q('Q09', 6, 2, 'O que caracteriza a comissão recorrente?',
    'Quando uma comissão é gerada?',
    [['Assim que o Partner encaminha a oportunidade'], ['Antes de a venda acontecer'],
      ['Quando a venda ou contratação é confirmada, e não apenas ao encaminhar a oportunidade', C], ['Somente quando o cliente pede']], 3),
  q('Q10', 6, 3, 'Quais indicadores compõem as metas do Partner?',
    'Qual indicador mostra a proporção entre indicações e vendas confirmadas?',
    [['Número de visitas'], ['Taxa de conversão', C], ['Comissão já paga'], ['Tempo de uso do portal']], 4),
  q('Q11', 6, 4, 'O que sustenta, tecnicamente, a regra de "nunca fixar percentual no vídeo"?',
    'Por que o percentual de cada produto não deve ser tratado como fixo?',
    [['Porque nunca muda'], ['Porque pode mudar, e o portal guarda a comissão vigente e o percentual aplicado em cada lançamento', C],
      ['Porque o Partner escolhe o próprio percentual'], ['Porque só a Central conhece o percentual']], 1),
  q('Q12', 6, 5, 'O que deve acontecer quando a tabela de comissões é alterada?',
    'Quando acontece o pagamento da comissão?',
    [['No mesmo dia da venda'], ['Até o 5º dia útil do mês seguinte ao fechamento (que vai do dia 1 ao último dia do mês)', C],
      ['Somente quando o Partner pede'], ['Até o dia 20 do mês seguinte']], 3),
  q('Q13', 10, 2, 'O Partner Hub pode ampliar equipe própria. O que isso implica em termos de comissão, segundo o Módulo 0?',
    'Qual é o único nível do programa ativo neste momento?',
    [['MOVV Partner Point'], ['MOVV Partner Hub'], ['MOVV Partner Mobile', C], ['Partner Regional']], 2),
  q('Q14', 10, 4, 'Qual é a aplicação prática sugerida no módulo?',
    'O que acontece com os níveis Point, Hub e Regional?',
    [['Já estão disponíveis para qualquer Partner'], ['Foram cancelados definitivamente'],
      ['Estão em breve e as condições serão divulgadas no portal', C], ['Só estão disponíveis para quem tem equipe']], 4),
  q('Q15', 10, 5, 'Ponto físico e equipe são, segundo o módulo:',
    'Para começar no programa, o Partner precisa ter ponto físico ou equipe?',
    [['Sim, ponto físico e equipe são obrigatórios'], ['Sim, mas só equipe'],
      ['Não — no nível Mobile o Partner atua individualmente, na rua e em canais digitais', C], ['Sim, mas só ponto físico']], 1),
  q('Q16', 11, 3, 'O que o portal deve mostrar em relação à certificação, segundo a diretriz ao Jesley?',
    'O que o portal mostra em relação à certificação?',
    [['Nada, isso fica só registrado no papel'], ['O status de certificação, permitindo atualização/recertificação quando necessário', C],
      ['Apenas a data de cadastro do Partner'], ['Somente o nome do Partner']], 3),
  q('Q17', 16, 3, 'Quais ferramentas fazem parte do "MOVV Partner" na arquitetura do ecossistema?',
    'Quais telas o Partner usa no portal no dia a dia?',
    [['Somente a tela de login'], ['Início, Indicar cliente, Minhas vendas, Universidade e Meu perfil', C],
      ['Apenas a Universidade'], ['Apenas o perfil']], 2),

  // A1 confirmou "estudar + quiz aprovado" (services/universidade.js): aplicar
  conclusao('Q18.M1', 1, 5, 2),
  conclusao('Q18.M2', 2, 5, 4),
  conclusao('Q18.M4', 4, 5, 1),
  conclusao('Q18.M8', 8, 4, 3),
  conclusao('Q18.M9', 9, 5, 2),
  // A2 confirmou que não existem prova final nem casos práticos: aplicar
  q('Q19', 11, 4, 'O que compõe a Etapa 2 (Avaliações) da certificação?',
    'O que compõe a Etapa 2 (Avaliações) da certificação?',
    [['Apenas uma redação'], ['Somente entrevista presencial'],
      ['Os quizzes de cada módulo, com a nota mínima definida pela administração', C], ['Não há avaliação formal nesta etapa']], 4),
];

module.exports = { ITENS };
