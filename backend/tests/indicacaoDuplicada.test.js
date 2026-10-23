// Indicação duplicada (migration 103): mesmo CPF/CNPJ + mesmo produto.
// Banco em memória (PGlite) com o app de verdade; nunca toca produção.
// Cada teste usa Partners novos, para o limite de 5 tentativas em 24 h de
// um teste não atrapalhar o outro.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { novoBanco, usarNoApp } = require('./helpers/bancoTeste');

process.env.JWT_SECRET = 'segredo-de-teste';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_teste_sem_envio';

const dup = require('../src/services/indicacaoDuplicada');
const MSG = 'Este cliente já tem uma indicação em andamento para este produto. Fale com a Central Movv.';

// CPF e CNPJ válidos e diferentes a cada chamada (só para teste)
let seq = 100000;
function gerarCpf() {
  const b = String(seq++).padStart(9, '7').split('').map(Number);
  const dv = n => { const s = b.slice(0, n).reduce((a, d, i) => a + d * (n + 1 - i), 0) % 11; return s < 2 ? 0 : 11 - s; };
  b.push(dv(9)); b.push(dv(10));
  return b.join('');
}
function gerarCnpj() {
  const b = (String(seq++).padStart(8, '3') + '0001').split('').map(Number);
  const dv = pesos => { const s = b.reduce((a, d, i) => a + d * pesos[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  b.push(dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  b.push(dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return b.join('');
}

let db;
let servidor;
let base;
const prod = {};
const t = {};
let hash;
let nPartner = 0;

async function chamar(metodo, rota, token, corpo) {
  const r = await fetch(base + rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, body: json };
}

async function novoPartner() {
  nPartner += 1;
  const code = `PARTNER-97${nPartner}`;
  const id = (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner, must_change_password)
     VALUES ($1, $2, $3, $4, 'movv_partner', 'mobile', false) RETURNING id`,
    [code, `Partner Secreto ${nPartner}`, `${code.toLowerCase()}@teste.local`, hash]
  )).rows[0].id;
  return { id, token: jwt.sign({ id, userType: 'partner' }, process.env.JWT_SECRET), nome: `Partner Secreto ${nPartner}`, code };
}

const indicar = (p, produtoId, documento, extra = {}) => chamar('POST', '/api/referrals', p.token, {
  client_name: 'Cliente Teste', client_whatsapp: '64999990000', product_id: produtoId,
  ...(documento !== undefined && { client_documento: documento }), ...extra,
});

before(async () => {
  db = await novoBanco();
  usarNoApp(db);
  const app = require('../src/app');
  servidor = app.listen(0);
  await new Promise(ok => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
  hash = await bcrypt.hash('senha-certa', 4);

  const produto = async (nome, tipo) => (await db.query(
    `INSERT INTO products (name, type, faixa) VALUES ($1, $2, 'alta') RETURNING id`, [nome, tipo])).rows[0].id;
  prod.azul = await produto('Consignado INSS (teste 97)', 'credit');
  prod.azul2 = await produto('Cartão Benefício (teste 97)', 'credit');
  prod.seguro = await produto('Seguro (teste 97)', 'insurance');

  const adminId = (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, is_admin, must_change_password)
     VALUES ('ADMIN-97', 'Admin 97', 'admin97@teste.local', $1, 'accounting', true, false) RETURNING id`, [hash]
  )).rows[0].id;
  t.admin = jwt.sign({ id: adminId, userType: 'partner' }, process.env.JWT_SECRET);
});

after(async () => {
  if (servidor) await new Promise(ok => servidor.close(ok));
  await db.fechar();
});

// ─── Campo único CPF ou CNPJ ────────────────────────────────────────────────

test('documento: aceita CPF (11) ou CNPJ (14) válidos, com ou sem máscara', () => {
  assert.deepEqual(dup.documentoDaIndicacao('529.982.247-25'), { documento: '52998224725' });
  assert.deepEqual(dup.documentoDaIndicacao('11.222.333/0001-81'), { documento: '11222333000181' });
  assert.match(dup.documentoDaIndicacao('111.111.111-11').erro, /inválido/);
  assert.match(dup.documentoDaIndicacao('11.222.333/0001-80').erro, /inválido/);
  assert.match(dup.documentoDaIndicacao('1234567890').erro, /inválido/);
  assert.deepEqual(dup.documentoDaIndicacao(''), { documento: null });
  assert.match(dup.documentoDaIndicacao('', { obrigatorio: true }).erro, /Informe/);
});

test('Partner sem documento ou com documento inválido é recusado; equipe sem documento passa', async () => {
  const a = await novoPartner();
  let r = await indicar(a, prod.azul, undefined);
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Informe o CPF ou CNPJ do cliente.');
  r = await indicar(a, prod.azul, '111.111.111-11');
  assert.equal(r.status, 400);
  r = await indicar(a, prod.seguro, '11.222.333/0001-80');
  assert.equal(r.status, 400);
  // crédito da Azul: só CPF; seguro aceita CNPJ
  r = await indicar(a, prod.azul, gerarCnpj());
  assert.equal(r.status, 400);
  assert.match(r.body.error, /CPF/);
  r = await indicar(a, prod.seguro, gerarCnpj());
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.client_cpf, null, 'CNPJ não vai para client_cpf');
  assert.match(r.body.client_documento, /\*\*\*/, 'o Partner vê mascarado');
  // o nome antigo do campo (client_cpf) continua aceito
  r = await indicar(a, prod.azul, undefined, { client_cpf: gerarCpf() });
  assert.equal(r.status, 201, JSON.stringify(r.body));

  r = await chamar('POST', '/api/referrals', t.admin, { client_name: 'Sem doc', client_whatsapp: '64999990000', product_id: prod.azul, partner_id: a.id });
  assert.equal(r.status, 201, 'equipe registra sem documento');
  assert.equal(r.body.client_documento, null);
});

// ─── A regra ────────────────────────────────────────────────────────────────

test('mesmo documento + mesmo produto em 30 dias é bloqueado, sem revelar quem indicou; produto diferente passa', async () => {
  const [a, b] = [await novoPartner(), await novoPartner()];
  const cpf = gerarCpf();
  let r = await indicar(a, prod.azul, cpf);
  assert.equal(r.status, 201);
  const protocoloA = r.body.protocol;

  r = await indicar(b, prod.azul, cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'));
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: MSG }, 'só a mensagem, sem nenhum outro dado');
  const texto = JSON.stringify(r.body);
  for (const segredo of [a.nome, a.code, protocoloA, String(a.id), cpf]) assert.ok(!texto.includes(segredo), `não revela ${segredo}`);

  // o próprio dono também recebe a MESMA mensagem (não dá para saber de quem é)
  r = await indicar(a, prod.azul, cpf);
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: MSG });

  assert.equal((await indicar(b, prod.azul2, cpf)).status, 201, 'produto diferente passa');
  assert.equal((await indicar(b, prod.azul, gerarCpf())).status, 201, 'outro cliente passa');
});

test('depois de 30 dias sem contrato passa; com contrato, lançamento ou convertida continua protegido', async () => {
  const [a, b] = [await novoPartner(), await novoPartner()];
  const velha = async (doc, extra = '') => {
    const r = await indicar(a, prod.azul, doc);
    assert.equal(r.status, 201);
    await db.query(`UPDATE referrals SET created_at = NOW() - INTERVAL '31 days', expires_at = NOW() - INTERVAL '1 day' ${extra} WHERE id = $1`, [r.body.id]);
    return r.body.id;
  };

  const semNada = gerarCpf();
  await velha(semNada);
  assert.equal((await indicar(b, prod.azul, semNada)).status, 201, 'passou de 30 dias, sem contrato: passa');

  const comContrato = gerarCpf();
  await velha(comContrato, `, numero_contrato = '${String(seq++)}0'`);
  assert.equal((await indicar(b, prod.azul, comContrato)).status, 409, 'com contrato continua protegido');

  const convertida = gerarCpf();
  await velha(convertida, `, status = 'converted'`);
  assert.equal((await indicar(b, prod.azul, convertida)).status, 409, 'convertida continua protegida');

  const pc = require('../src/services/partnerComissoes');
  const comLanc = gerarCpf();
  const idLanc = await velha(comLanc);
  const lanc = (await pc.criarLancamento(db, {
    partner_id: a.id, origem: 'azul', produto: 'Consignado INSS', cliente_nome: 'Cliente Teste', referral_id: idLanc,
    competencia: '2026-09', base_valor: '100.00', percentual: '30', status: 'confirmado', criado_por: 'teste',
  })).lancamento;
  assert.equal((await db.query('SELECT referral_id FROM partner_comissoes WHERE id = $1', [lanc.id])).rows[0].referral_id, idLanc);
  assert.equal((await indicar(b, prod.azul, comLanc)).status, 409, 'com lançamento não estornado continua protegido');
  await db.query(`UPDATE partner_comissoes SET status = 'estornado', estornado_por = 'teste', estornado_em = NOW(), motivo_estorno = 'teste' WHERE id = $1`, [lanc.id]);
  assert.equal((await indicar(b, prod.azul, comLanc)).status, 201, 'lançamento estornado (e sem contrato, 31 dias) não protege');
});

test('indicação cancelada ou expirada não protege, mesmo dentro de 30 dias', async () => {
  const [a, b] = [await novoPartner(), await novoPartner()];
  for (const status of ['cancelled', 'expired']) {
    const cpf = gerarCpf();
    const r = await indicar(a, prod.azul, cpf);
    await db.query(`UPDATE referrals SET status = $2, numero_contrato = $3 WHERE id = $1`, [r.body.id, status, `${seq++}1`]);
    assert.equal((await indicar(b, prod.azul, cpf)).status, 201, `${status} não protege`);
  }
});

// ─── Registro das tentativas e segurança ────────────────────────────────────

test('tentativa fica registrada com documento mascarado e hash; nada do documento em log', async () => {
  const [a, b] = [await novoPartner(), await novoPartner()];
  const cnpj = gerarCnpj();
  const r1 = await indicar(a, prod.seguro, cnpj);
  assert.equal(r1.status, 201);

  const logs = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  for (const k of Object.keys(orig)) console[k] = (...x) => { logs.push(x.join(' ')); };
  let r;
  try { r = await indicar(b, prod.seguro, cnpj); } finally { Object.assign(console, orig); }
  assert.equal(r.status, 409);
  assert.ok(!logs.join('\n').includes(cnpj), 'documento não aparece no log');

  const tent = (await db.query('SELECT * FROM referral_tentativas_bloqueadas WHERE partner_id = $1', [b.id])).rows;
  assert.equal(tent.length, 1);
  assert.equal(tent[0].motivo, 'duplicidade');
  assert.equal(tent[0].referral_bloqueadora_id, r1.body.id);
  assert.equal(tent[0].product_id, prod.seguro);
  assert.match(tent[0].documento_mascarado, /^\d{2}\.\*\*\*/);
  assert.match(tent[0].documento_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(tent).includes(cnpj), 'documento inteiro não fica na tabela');

  // a equipe vê a lista (com quem tem o cliente); o Partner, não
  assert.equal((await chamar('GET', '/api/referrals/tentativas', b.token)).status, 403);
  const lista = await chamar('GET', '/api/referrals/tentativas', t.admin);
  assert.equal(lista.status, 200);
  const linha = lista.body.find(x => x.id === tent[0].id);
  assert.equal(linha.bloqueadora_protocolo, r1.body.protocol);
  assert.equal(linha.partner_id, b.id);
  assert.ok(!JSON.stringify(lista.body).includes(cnpj));
});

test('limite: depois de 5 tentativas barradas em 24 h, a 6ª continua barrada com a mesma mensagem', async () => {
  const [a, b] = [await novoPartner(), await novoPartner()];
  for (let i = 0; i < 5; i++) {
    const cpf = gerarCpf();
    assert.equal((await indicar(a, prod.azul, cpf)).status, 201);
    const r = await indicar(b, prod.azul, cpf);
    assert.equal(r.status, 409);
  }
  // cliente livre: sem o limite, passaria
  const livre = gerarCpf();
  const r = await indicar(b, prod.azul, livre);
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: MSG }, 'mesma mensagem, sem dizer que é limite');
  const ult = (await db.query(`SELECT motivo FROM referral_tentativas_bloqueadas WHERE partner_id = $1 ORDER BY id DESC LIMIT 1`, [b.id])).rows[0];
  assert.equal(ult.motivo, 'limite');
  assert.equal(Number((await db.query('SELECT COUNT(*) n FROM referrals WHERE client_documento = $1', [livre])).rows[0].n), 0);
  // outro Partner não é afetado
  assert.equal((await indicar(a, prod.azul, livre)).status, 201);
});

test('admin libera (motivo obrigatório): a próxima indicação do mesmo Partner passa, uma vez só', async () => {
  const [a, b, c] = [await novoPartner(), await novoPartner(), await novoPartner()];
  const cpf = gerarCpf();
  assert.equal((await indicar(a, prod.azul, cpf)).status, 201);
  assert.equal((await indicar(b, prod.azul, cpf)).status, 409);
  const tid = (await db.query('SELECT id FROM referral_tentativas_bloqueadas WHERE partner_id = $1', [b.id])).rows[0].id;

  assert.equal((await chamar('POST', `/api/referrals/tentativas/${tid}/liberar`, b.token, { motivo: 'quero' })).status, 403, 'Partner não libera');
  let r = await chamar('POST', `/api/referrals/tentativas/${tid}/liberar`, t.admin, { motivo: ' ' });
  assert.equal(r.status, 400);
  r = await chamar('POST', `/api/referrals/tentativas/${tid}/liberar`, t.admin, { motivo: 'Segundo contrato legítimo na Azul' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await chamar('POST', `/api/referrals/tentativas/${tid}/liberar`, t.admin, { motivo: 'de novo' })).status, 404, 'já liberada');

  const acao = (await db.query(`SELECT detalhes FROM admin_acoes WHERE acao = 'indicacao_tentativa_liberada' ORDER BY id DESC LIMIT 1`)).rows[0];
  assert.ok(acao);
  assert.ok(!JSON.stringify(acao.detalhes).includes(cpf), 'admin_acoes só com o documento mascarado');

  assert.equal((await indicar(c, prod.azul, cpf)).status, 409, 'liberação é só do Partner liberado');
  r = await indicar(b, prod.azul, cpf);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const usada = (await db.query('SELECT usada_em, referral_liberada_id FROM referral_tentativas_bloqueadas WHERE id = $1', [tid])).rows[0];
  assert.ok(usada.usada_em);
  assert.equal(usada.referral_liberada_id, r.body.id);
  assert.equal((await indicar(b, prod.azul, cpf)).status, 409, 'a liberação vale uma vez');
});

// ─── Corrida ────────────────────────────────────────────────────────────────

test('duas indicações simultâneas do mesmo cliente e produto: só uma entra, a outra recebe a mensagem', async () => {
  const [a, b] = [await novoPartner(), await novoPartner()];
  const cpf = gerarCpf();
  const rs = await Promise.all([indicar(a, prod.azul, cpf), indicar(b, prod.azul, cpf)]);
  assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
  assert.deepEqual(rs.find(r => r.status === 409).body, { error: MSG });
  assert.equal(Number((await db.query('SELECT COUNT(*) n FROM referrals WHERE client_documento = $1 AND product_id = $2', [cpf, prod.azul])).rows[0].n), 1);
});

test('protocolo não repete em corrida e segue o maior número do ano', async () => {
  const ano = new Date().getFullYear();
  const a = await novoPartner();
  await db.query(
    `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, product_id, expires_at)
     VALUES ($1, $2, 'Antiga', '64999990000', $3, NOW())`, [`MOV-${ano}-000500`, a.id, prod.seguro]);
  const ps = await Promise.all(Array.from({ length: 8 }, () => indicar(a, prod.seguro, gerarCpf())));
  assert.deepEqual(ps.map(p => p.status), Array(8).fill(201), JSON.stringify(ps.map(p => p.body)));
  const protocolos = ps.map(p => p.body.protocol);
  assert.equal(new Set(protocolos).size, 8, 'nenhum protocolo repetido');
  const nums = protocolos.map(p => Number(p.split('-')[2])).sort((x, y) => x - y);
  assert.ok(nums[0] > 500, `continua depois do maior (${nums[0]})`);
});

// ─── Expirar pendentes ──────────────────────────────────────────────────────

test('"Expirar pendentes" não expira indicação com contrato ou com lançamento', async () => {
  const a = await novoPartner();
  const criar = async () => (await indicar(a, prod.azul, gerarCpf())).body.id;
  const [semNada, comContrato, comLanc] = [await criar(), await criar(), await criar()];
  await db.query(`UPDATE referrals SET expires_at = NOW() - INTERVAL '1 day' WHERE id = ANY($1::int[])`, [[semNada, comContrato, comLanc]]);
  await db.query(`UPDATE referrals SET numero_contrato = $2 WHERE id = $1`, [comContrato, `${seq++}2`]);
  await require('../src/services/partnerComissoes').criarLancamento(db, {
    partner_id: a.id, origem: 'azul', produto: 'Consignado INSS', cliente_nome: 'Cliente Teste', referral_id: comLanc,
    competencia: '2026-09', base_valor: '50.00', percentual: '30', status: 'previsto', criado_por: 'teste',
  });
  const r = await chamar('POST', '/api/referrals/expire', t.admin);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const st = async id => (await db.query('SELECT status FROM referrals WHERE id = $1', [id])).rows[0].status;
  assert.equal(await st(semNada), 'expired');
  assert.equal(await st(comContrato), 'pending');
  assert.equal(await st(comLanc), 'pending');
});
