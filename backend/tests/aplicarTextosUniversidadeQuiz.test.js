// Quiz do lote textos-2026-10 (lote-2026-10-quiz.js) num banco em memória,
// com enunciados e opções reais do banco. Nunca toca produção.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { novoBanco } = require('./helpers/bancoTeste');
const { carregarConteudo, planejar, executar, desfazer } = require('../scripts/aplicarTextosUniversidade');
const { ITENS: QUIZ } = require('../scripts/textos-universidade/lote-2026-10-quiz');

let db;
const id = {};
const pergunta = async pid => (await db.query('SELECT numero, enunciado, alternativas, correta, explicacao FROM universidade_quiz_perguntas WHERE id = $1', [pid])).rows[0];
const certa = p => p.alternativas.find(a => a.id === p.correta)?.texto;

async function q(mod, numero, enunciado, alts, correta) {
  return (await db.query(
    `INSERT INTO universidade_quiz_perguntas (modulo_id, numero, enunciado, alternativas, correta) VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
    [mod, numero, enunciado, JSON.stringify(alts.map((t, i) => ({ id: `orig${numero}${i}`, texto: t }))), `orig${numero}${correta}`])).rows[0].id;
}

before(async () => {
  db = await novoBanco();
  const mod = async (n, t) => (await db.query(`INSERT INTO universidade_modulos (numero, titulo, ordem, publicado) VALUES ($1, $2, $1, true) RETURNING id`, [n, t])).rows[0].id;
  const m0 = await mod(0, 'Boas-vindas');
  const m2 = await mod(2, 'Modelo');
  const m11 = await mod(11, 'Certificação');
  id.q01 = await q(m0, 2, 'O que é necessário para liberar o pagamento de uma comissão?',
    ['Somente a venda confirmada', 'Emissão de nota fiscal ou RPA', 'Aprovação verbal do cliente', 'Nada, o pagamento é automático'], 1);
  id.q02 = await q(m0, 4, 'O que o sistema não deve liberar até o Partner concluir o Módulo 0?',
    ['O aplicativo de mensagens pessoal', 'O Módulo 1 e o acesso ao CRM', 'O cadastro bancário', 'Nada — tudo já libera automaticamente'], 1);
  id.q03 = await q(m2, 4, 'O que o Partner deve priorizar segundo o módulo?',
    ['Vendas isoladas, sem pensar em relacionamento', 'Pensar em carteira, não apenas em vendas isoladas',
      'Fechar o maior número de vendas no menor tempo possível', 'Evitar registrar oportunidades no CRM'], 1);
  id.q19 = await q(m11, 4, 'O que compõe a Etapa 2 (Avaliações) da certificação?', ['Prova final', 'Casos práticos', 'Quizzes', 'Nada'], 0);
  // um enunciado que mudou no admin: não pode casar
  id.q05x = await q(m2, 5, 'Enunciado que alguém já mudou no admin', ['a', 'b', 'c', 'd'], 0);
  const a = (await db.query(`INSERT INTO universidade_aulas (modulo_id, ordem, titulo) VALUES ($1, 1, 'Etapa 1 — Conclusão das trilhas') RETURNING id`, [m11])).rows[0].id;
  id.t50 = (await db.query(`INSERT INTO universidade_topicos (aula_id, numero, titulo, texto, ordem) VALUES ($1, 7, 'CRM.', 'Usar o CRM no dia a dia.', 7) RETURNING id`, [a])).rows[0].id;
});

after(async () => { await db.fechar(); });

test('dados do quiz: 4 opções, 1 certa, e a certa não fica sempre na mesma posição', () => {
  const reescritas = QUIZ.filter(i => i.tipo === 'quiz_reescrita');
  assert.equal(reescritas.length, 21, 'Q01, Q02, Q05 a Q17, Q18 (5 módulos) e Q19');
  for (const i of reescritas) {
    assert.equal(i.opcoes.length, 4, i.id);
    assert.equal(i.opcoes.filter(o => o.correta).length, 1, i.id);
  }
  const posicoes = new Set(reescritas.map(i => i.opcoes.findIndex(o => o.correta)));
  assert.equal(posicoes.size, 4, 'a certa aparece nas 4 posições ao longo do lote');
  const conclusao = reescritas.filter(i => i.id.startsWith('Q18'));
  assert.equal(new Set(conclusao.map(i => i.opcoes.findIndex(o => o.correta))).size >= 3, true, 'Q18 varia a posição entre os módulos');
});

test('prévia do quiz: localiza pelo enunciado atual; o que não confere é pulado; T50 segurado', async () => {
  const plano = planejar(await carregarConteudo(db));
  const st = Object.fromEntries(plano.relatorio.map(r => [r.id, r]));
  assert.equal(st.Q01.status, 'aplicar');
  assert.equal(st.Q02.status, 'aplicar');
  assert.equal(st.Q03.status, 'aplicar');
  assert.equal(st.Q19.status, 'aplicar');
  assert.equal(st.Q05.status, 'pulado', 'o enunciado do banco não é o "atual" da tabela');
  assert.equal(st.T50.status, 'adiado');
  assert.ok(!plano.mudancas.some(m => m.tabela === 'universidade_topicos' && m.id === id.t50), 'R1 não mexe no tópico do T50');
});

test('aplicar o quiz: ids novos fixos na reescrita, id mantido na troca de opção, explicação vazia', async () => {
  const plano = planejar(await carregarConteudo(db));
  await db.transacao(cx => executar(cx, plano, { quem: 'teste' }));

  const p1 = await pergunta(id.q01);
  assert.equal(p1.enunciado, 'Em caso de dúvida sobre o documento fiscal para receber a comissão, o que o Partner deve fazer?');
  assert.equal(p1.numero, 2, 'a posição da pergunta não muda');
  assert.equal(p1.alternativas.length, 4);
  assert.equal(new Set(p1.alternativas.map(a => a.id)).size, 4);
  assert.ok(p1.alternativas.every(a => /^[0-9a-z]{6}$/.test(a.id) && !a.id.startsWith('orig')), 'ids novos');
  assert.equal(certa(p1), 'Falar com a Central antes do fechamento do mês');
  assert.equal(p1.alternativas[0].texto, 'Falar com a Central antes do fechamento do mês', 'Q01: certa na 1ª posição');
  assert.equal(p1.explicacao, null);

  const p2 = await pergunta(id.q02);
  assert.equal(certa(p2), 'Ler o conteúdo e aceitar o termo de adesão');
  assert.ok(!JSON.stringify(p2.alternativas).includes('CRM'));

  const p3 = await pergunta(id.q03);
  assert.equal(p3.enunciado, 'O que o Partner deve priorizar segundo o módulo?');
  assert.deepEqual(p3.alternativas.map(a => a.id), ['orig40', 'orig41', 'orig42', 'orig43'], 'ids mantidos');
  assert.equal(p3.alternativas[3].texto, 'Evitar registrar indicações no portal');
  assert.equal(p3.correta, 'orig41', 'a certa continua a mesma');

  const p19 = await pergunta(id.q19);
  assert.equal(certa(p19), 'Os quizzes de cada módulo, com a nota mínima definida pela administração');
  assert.equal((await pergunta(id.q05x)).enunciado, 'Enunciado que alguém já mudou no admin', 'pulado não muda');
  assert.equal((await db.query('SELECT titulo FROM universidade_topicos WHERE id = $1', [id.t50])).rows[0].titulo, 'CRM.');

  const b = (await db.query(`SELECT dados FROM universidade_textos_backup WHERE tabela = 'universidade_quiz_perguntas' AND registro_id = $1`, [id.q01])).rows;
  assert.equal(b.length, 1);
  assert.equal(b[0].dados.correta, 'orig21');
});

test('rodar de novo não muda o quiz (os ids novos são os mesmos)', async () => {
  const antes = await pergunta(id.q01);
  const plano = planejar(await carregarConteudo(db));
  const st = Object.fromEntries(plano.relatorio.map(r => [r.id, r.status]));
  assert.equal(st.Q01, 'ja_aplicado');
  assert.equal(st.Q03, 'ja_aplicado');
  assert.equal(st.Q19, 'ja_aplicado');
  assert.equal(plano.mudancas.filter(m => m.tabela === 'universidade_quiz_perguntas').length, 0);
  assert.deepEqual(await pergunta(id.q01), antes);
});

test('desfazer volta enunciado, opções e a resposta certa originais', async () => {
  await db.transacao(cx => desfazer(cx, { quem: 'teste' }));
  const p1 = await pergunta(id.q01);
  assert.equal(p1.enunciado, 'O que é necessário para liberar o pagamento de uma comissão?');
  assert.equal(p1.correta, 'orig21');
  assert.equal(certa(p1), 'Emissão de nota fiscal ou RPA');
  assert.equal((await pergunta(id.q03)).alternativas[3].texto, 'Evitar registrar oportunidades no CRM');
});
