// Lote de ajuste dos textos da Universidade (scripts/aplicarTextosUniversidade.js)
// num banco em memória com uma amostra do conteúdo (títulos reais do banco).
// Nunca toca produção.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { novoBanco } = require('./helpers/bancoTeste');
const { carregarConteudo, planejar, executar, desfazer, trocar } = require('../scripts/aplicarTextosUniversidade');

let db;
const id = {};

async function modulo(numero, titulo) {
  return (await db.query(`INSERT INTO universidade_modulos (numero, titulo, ordem, publicado) VALUES ($1, $2, $1, true) RETURNING id`, [numero, titulo])).rows[0].id;
}
async function aula(mod, ordem, titulo) {
  return (await db.query(`INSERT INTO universidade_aulas (modulo_id, ordem, titulo) VALUES ($1, $2, $3) RETURNING id`, [mod, ordem, titulo])).rows[0].id;
}
async function topico(aulaId, numero, titulo, texto) {
  return (await db.query(`INSERT INTO universidade_topicos (aula_id, numero, titulo, texto, ordem) VALUES ($1, $2, $3, $4, $2) RETURNING id`,
    [aulaId, numero, titulo, texto])).rows[0].id;
}
const texto = async topicoId => (await db.query('SELECT titulo, texto, editado_manual_em FROM universidade_topicos WHERE id = $1', [topicoId])).rows[0];

before(async () => {
  db = await novoBanco();
  const m0 = await modulo(0, 'Boas-vindas');
  const a01 = await aula(m0, 1, 'Como funciona o vínculo com o Grupo Movv');
  id.t01 = await topico(a01, 1, 'Relação autônoma/PJ (MEI ou equivalente) — o que isso significa na prática.', 'Texto antigo do vínculo.');
  id.t45 = await topico(a01, 2, 'Documentos necessários para o cadastro (CPF/CNPJ, dados bancários, comprovante quando aplicável).', 'Texto antigo dos documentos.');
  id.t02 = await topico(a01, 3, 'Título que mudou no admin.', 'Texto da nota.');
  const a02 = await aula(m0, 2, 'Termo de adesão e código de conduta');
  id.t03 = await topico(a02, 1, 'Regras de uso da marca Grupo Movv.', 'Apresente-se sempre com o crachá e os itens do kit fornecidos pelo Grupo.');
  id.a04 = await aula(m0, 4, 'Tablet, aplicativo e segurança da informação');
  const m4 = await modulo(4, 'Venda consultiva');
  const a44 = await aula(m4, 4, '1 cliente → várias oportunidades');
  id.t15 = await topico(a44, 2, 'Como registrar oportunidades diferentes para o mesmo cliente.', 'Antigo.');
  id.t15b = await topico(a44, 3, 'CRM.', 'Registre tudo no CRM. Depois, revise.');
  const m5 = await modulo(5, 'Produtos');
  id.a52 = await aula(m5, 2, 'MOVV Certificados');
  id.t52a = await topico(id.a52, 1, 'O que é certificado digital.', 'O MOVV Certificados emite certificado digital.');
  id.t18 = await topico(id.a52, 7, 'Comissão e acompanhamento.', 'Antigo com 20%.');
  id.a53 = await aula(m5, 3, 'MOVV Benefícios');
  await topico(id.a53, 1, 'Benefícios empresariais.', 'x');
  await topico(id.a53, 2, 'Telemedicina.', 'y');
  const m6 = await modulo(6, 'Comissionamento');
  const a61 = await aula(m6, 1, 'Como funciona a comissão');
  id.t44 = await topico(a61, 1, 'Comissão por produto.', 'Os valores estão na tabela vigente do portal, sempre.');
  const m7 = await modulo(7, 'CRM');
  const a71 = await aula(m7, 1, 'Usando o CRM');
  id.t7 = await topico(a71, 1, 'Cadastro no CRM.', 'Abra o CRM e cadastre.');
  const m12 = await modulo(12, 'Kit Digital');
  const a121 = await aula(m12, 1, 'Ferramentas');
  id.t12 = await topico(a121, 1, 'Integração com CRM.', 'O CRM integra tudo.');
  const m10 = await modulo(10, 'Níveis');
  const a102 = await aula(m10, 2, 'Nível 2 — MOVV Partner Point');
  id.t391 = await topico(a102, 1, 'Possibilidade de ponto comercial.', 'Ponto comercial.');
  await db.query(`INSERT INTO universidade_quiz_perguntas (modulo_id, numero, enunciado, alternativas, correta, explicacao) VALUES
    ($1, 1, 'Onde registrar o cliente?', '[{"id":"a1","texto":"No CRM"},{"id":"a2","texto":"No MOVV Certificado"}]', 'a1', 'Sempre no CRM.'),
    ($2, 1, 'O CRM integra?', '[{"id":"b1","texto":"Sim"}]', 'b1', null)`, [m0, m12]);
  await db.query(`INSERT INTO universidade_documentos (documento, versao, titulo, texto, publicado)
    VALUES ('termo_adesao', 1, 'Termo', 'O MOVV Certificado e o CRM do termo não mudam.', true)`);
});

after(async () => { await db.fechar(); });

test('trocas: palavra inteira, maiúscula no início, G1 só nos nomes do produto', () => {
  const r1 = { trocas: [['CRM', 'portal']], palavraInteira: true, maiusculaNoInicio: true };
  assert.equal(trocar('Registre no CRM. CRM ajuda.', r1), 'Registre no portal. Portal ajuda.');
  assert.equal(trocar('CRM.', r1), 'Portal.');
  assert.equal(trocar('CRMs e xCRM ficam', r1), 'CRMs e xCRM ficam');
  const g1 = { trocas: [['MOVV Certificados', 'Movv Certificado'], ['Movv Certificados', 'Movv Certificado'], ['MOVV Certificado', 'Movv Certificado']] };
  assert.equal(trocar('O MOVV Certificados e o Movv Certificados; certificados digitais.', g1), 'O Movv Certificado e o Movv Certificado; certificados digitais.');
});

test('prévia: só planeja (não grava) e diz item a item o que faria', async () => {
  const antes = await carregarConteudo(db);
  const plano = planejar(antes);
  const st = Object.fromEntries(plano.relatorio.map(r => [r.id, r]));
  assert.equal(st.T01.status, 'aplicar');
  assert.equal(st.T45.status, 'adiado');
  assert.equal(st.T02.status, 'pulado');
  assert.match(st.T02.motivo, /título atual não confere/);
  assert.equal(st.T03.status, 'aplicar');
  assert.equal(st.T46.status, 'aplicar');
  assert.equal(st.T15.status, 'aplicar');
  assert.equal(st.T18.status, 'aplicar');
  assert.equal(st.T19.status, 'aplicar');
  assert.match(st.T19.motivo, /novo tópico 3/);
  assert.equal(st.T44.status, 'aplicar');
  assert.equal(st['T39.1'].status, 'aplicar');
  assert.equal(st.T09.status, 'pulado');
  assert.match(st.T09.motivo, /não encontrado/);
  assert.equal(st.T21.status, 'pulado', 'aula 4 do M5 não existe na amostra');
  assert.deepEqual(await carregarConteudo(db), antes, 'nada foi gravado');
});

test('aplicar: grava, guarda o original, marca como editado e registra; respeita M7, M12, termo e versão', async () => {
  const plano = planejar(await carregarConteudo(db));
  const versoes = (await db.query('SELECT numero, versao_conteudo FROM universidade_modulos ORDER BY numero')).rows;
  const r = await db.transacao(cx => executar(cx, plano, { quem: 'teste' }));
  assert.equal(r.criados, 1);

  const t01 = await texto(id.t01);
  assert.match(t01.texto, /^O MOVV Partner atua como profissional autônomo/);
  assert.ok(t01.editado_manual_em, 'marcado para a reimportação não sobrescrever');
  assert.equal((await texto(id.t45)).texto, 'Texto antigo dos documentos.', 'T45 adiado: não aplica');
  assert.equal((await texto(id.t02)).texto, 'Texto da nota.', 'título não conferiu: pulou');
  assert.equal((await texto(id.t03)).texto, 'Apresente-se sempre com o crachá, a camiseta e os demais itens do kit fornecidos pelo Grupo.');
  assert.match((await texto(id.t15)).texto, /oportunidade separada no portal/, 'texto novo do T15 passa pelo R1');
  assert.deepEqual(await texto(id.t15b).then(x => [x.titulo, x.texto]), ['Portal.', 'Registre tudo no portal. Depois, revise.']);
  assert.equal((await texto(id.t52a)).texto, 'O Movv Certificado emite certificado digital.');
  assert.match((await texto(id.t44)).texto, /na sua comissão vigente, no portal/);
  assert.equal((await texto(id.t391)).titulo, 'Nível ainda não disponível.');
  assert.equal((await db.query('SELECT titulo FROM universidade_aulas WHERE id = $1', [id.a04])).rows[0].titulo, 'Tablet, portal e segurança da informação');
  assert.equal((await db.query('SELECT titulo FROM universidade_aulas WHERE id = $1', [id.a52])).rows[0].titulo, 'Movv Certificado');
  const novo = (await db.query('SELECT numero, titulo FROM universidade_topicos WHERE aula_id = $1 ORDER BY numero DESC LIMIT 1', [id.a53])).rows[0];
  assert.deepEqual(novo, { numero: 3, titulo: 'Comissão.' });

  // excluídos do R1 e o termo
  assert.equal((await texto(id.t7)).texto, 'Abra o CRM e cadastre.');
  assert.equal((await texto(id.t12)).texto, 'O CRM integra tudo.');
  const quiz = (await db.query('SELECT enunciado, alternativas, explicacao FROM universidade_quiz_perguntas ORDER BY modulo_id')).rows;
  assert.deepEqual(quiz[0].alternativas.map(a => a.texto), ['No portal', 'No Movv Certificado']);
  assert.equal(quiz[0].explicacao, 'Sempre no portal.');
  assert.equal(quiz.find(q => q.enunciado.startsWith('O CRM')).enunciado, 'O CRM integra?', 'quiz do M12 não muda');
  assert.equal((await db.query(`SELECT texto FROM universidade_documentos`)).rows[0].texto, 'O MOVV Certificado e o CRM do termo não mudam.');
  assert.deepEqual((await db.query('SELECT numero, versao_conteudo FROM universidade_modulos ORDER BY numero')).rows, versoes, 'não é mudança relevante');

  // backup do original (uma vez) e registro
  const b = (await db.query(`SELECT dados FROM universidade_textos_backup WHERE tabela = 'universidade_topicos' AND registro_id = $1`, [id.t01])).rows;
  assert.equal(b.length, 1);
  assert.equal(b[0].dados.texto, 'Texto antigo do vínculo.');
  const n = (await db.query(`SELECT count(*)::int AS n FROM admin_acoes WHERE acao = 'universidade_texto_lote'`)).rows[0].n;
  assert.equal(n, plano.mudancas.length + plano.novos.length);
});

test('rodar de novo não tem efeito', async () => {
  const plano = planejar(await carregarConteudo(db));
  assert.equal(plano.mudancas.length, 0);
  assert.equal(plano.novos.length, 0);
  const st = Object.fromEntries(plano.relatorio.map(r => [r.id, r.status]));
  assert.equal(st.T01, 'ja_aplicado');
  assert.equal(st.T19, 'ja_aplicado');
  assert.equal(st.T46, 'ja_aplicado');
});

test('se o conteúdo mudar entre a leitura e a gravação, nada é gravado', async () => {
  await db.transacao(cx => desfazer(cx, { quem: 'teste' }));
  const plano = planejar(await carregarConteudo(db));
  await db.query(`UPDATE universidade_topicos SET texto = 'mexido no admin' WHERE id = $1`, [id.t03]);
  await assert.rejects(db.transacao(cx => executar(cx, plano, { quem: 'teste' })), /mudou depois da leitura/);
  assert.equal((await texto(id.t01)).texto, 'Texto antigo do vínculo.', 'transação inteira desfeita');
  await db.query(`UPDATE universidade_topicos SET texto = 'Apresente-se sempre com o crachá e os itens do kit fornecidos pelo Grupo.' WHERE id = $1`, [id.t03]);
});

test('desfazer volta exatamente ao original e apaga o tópico criado', async () => {
  const original = await carregarConteudo(db);
  await db.transacao(cx => executar(cx, planejar(original), { quem: 'teste' }));
  const r = await db.transacao(cx => desfazer(cx, { quem: 'teste' }));
  assert.ok(r.restaurados > 0);
  const depois = await carregarConteudo(db);
  const so = l => l.map(t => [t.id, t.titulo, t.texto]);
  assert.deepEqual(so(depois.topicos), so(original.topicos));
  assert.deepEqual(depois.aulas.map(a => [a.id, a.titulo]), original.aulas.map(a => [a.id, a.titulo]));
  assert.deepEqual(depois.perguntas.map(p => [p.id, p.enunciado, p.alternativas, p.explicacao]),
    original.perguntas.map(p => [p.id, p.enunciado, p.alternativas, p.explicacao]));
});

test('--simular: a cópia em memória fica igual ao conteúdo lido e aceita tópico novo', async () => {
  const { copiarParaMemoria } = require('../scripts/aplicarTextosUniversidade');
  const conteudo = await carregarConteudo(db);
  const copia = await copiarParaMemoria(conteudo);
  const lido = await carregarConteudo(copia);
  const chave = l => l.map(x => JSON.stringify([x.id, x.titulo, x.texto ?? null, x.enunciado ?? null, x.alternativas ?? null]));
  for (const k of ['modulos', 'aulas', 'topicos', 'perguntas']) assert.deepEqual(chave(lido[k]), chave(conteudo[k]), k);
  const r = await copia.transacao(cx => executar(cx, planejar(lido), { quem: 'simulação' }));
  assert.equal(r.criados, 1, 'a sequência de ids foi acertada: o tópico novo entra sem colidir');
  await copia.fechar();
});
