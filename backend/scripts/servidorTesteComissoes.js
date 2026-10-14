// Servidor LOCAL de teste do livro de comissões do Partner (migration 093).
// Sobe a API na porta 3001 com um Postgres em memória (PGlite) já com todas
// as migrations e dados de exemplo. NÃO lê o DATABASE_URL e NÃO fala com
// produção; ao parar (Ctrl+C) tudo some.
//
//   cd backend && npm run teste:comissoes      (API em http://localhost:3001)
//   cd frontend && npm run dev                 (portal em http://localhost:5173)
//
// Logins (senha de todos: teste123):
//   ADMIN-T01           admin (Comissões do Partner no menu Admin)
//   PARTNER-T01         MOVV Partner nível Mobile, com lançamentos
//   PARTNER-T02         MOVV Partner nível Hub, com lançamentos
//   fernando@teste.local  vendedor do Movv Certificado (Nova Venda com Partner)
//
// Importação da Azul: suba tests/fixtures/azul/exemplo_comissoes_pagas_domus_ficticio.csv
// em Admin > Comissões do Partner > Importação Azul (1 casada, 1 sugestão, 1 ambígua).
process.env.JWT_SECRET = process.env.JWT_SECRET_TESTE || 'segredo-local-de-teste';
process.env.RESEND_API_KEY = 're_teste_sem_envio';
process.env.PEDIDOS_PRAZOS_TIMER = 'false';
delete process.env.DATABASE_URL;

const bcrypt = require('bcryptjs');
const { novoBanco, usarNoApp } = require('../tests/helpers/bancoTeste');

async function semear(db) {
  const hash = await bcrypt.hash('teste123', 10);
  const partner = async (code, name, type, extra = {}) => (await db.query(
    `INSERT INTO partners (code, name, email, password_hash, type, nivel_partner, is_admin, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id`,
    [code, name, `${code.toLowerCase()}@teste.local`, hash, type, extra.nivel || null, Boolean(extra.admin)]
  )).rows[0].id;

  await partner('ADMIN-T01', 'Admin de Teste', 'accounting', { admin: true });
  const a = await partner('PARTNER-T01', 'Ana Partner (teste)', 'movv_partner', { nivel: 'mobile' });
  const b = await partner('PARTNER-T02', 'Bruno Partner (teste)', 'movv_partner', { nivel: 'hub' });
  await db.query(
    `INSERT INTO internal_collaborators (name, email, password_hash, role, must_change_password)
     VALUES ('Fernando (teste)', 'fernando@teste.local', $1, 'comercial_full', false)`, [hash]
  );

  const pc = require('../src/services/partnerComissoes');
  const lanc = (partnerId, produto, cliente, competencia, base, status) => pc.criarLancamento(db, {
    partner_id: partnerId, origem: 'azul', produto, cliente_nome: cliente, numero_contrato: `00${Math.floor(Math.random() * 1e8)}`,
    competencia, base_valor: base, percentual: '30', status, criado_por: 'semente de teste',
  }).then(r => r.lancamento.id);

  const l1 = await lanc(a, 'Consignado INSS', 'Maria Teste', '2026-09', '133.44', 'confirmado');
  const l2 = await lanc(a, 'Cartão Benefício', 'João Teste', '2026-09', '210.00', 'confirmado');
  await lanc(a, 'Antecipação FGTS', 'Carla Teste', '2026-10', '87.35', 'confirmado');
  await lanc(a, 'Consignado CLT', 'Pedro Teste', '2026-10', '55.10', 'previsto');
  await lanc(b, 'Consignado INSS', 'Lucas Teste', '2026-10', '500.00', 'confirmado');
  await pc.mudarStatus(db, [l1, l2], 'aprovar', 'semente de teste');
  await pc.mudarStatus(db, [l1], 'pagar', 'semente de teste', { data_pagamento: '2026-10-10', observacao: 'PIX' });

  // Indicações que casam com o CSV fictício de tests/fixtures/azul:
  //   cliente 01: contrato 118159083 já na indicação  -> casada por contrato
  //   cliente 02: só o CPF                            -> sugestão por CPF
  //   cliente 05: o mesmo CPF em duas indicações      -> CPF ambíguo
  const produto = (await db.query(
    `INSERT INTO products (name, type, faixa) VALUES ('Consignado INSS', 'credit', 'alta') RETURNING id`
  )).rows[0].id;
  // Partner também indica Movv Certificado (14/10/2026)
  await db.query(`INSERT INTO products (name, type, faixa) VALUES ('Movv Certificado', 'digital_certificate', 'media')`);
  const indicacao = (partnerId, nome, cpf, contrato) => db.query(
    `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, product_id, expires_at, client_cpf, numero_contrato)
     VALUES ($1, $2, $3, '64999990000', $4, NOW() + INTERVAL '30 days', $5, $6)`,
    [`TESTE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, partnerId, nome, produto, cpf, contrato]
  );
  await indicacao(a, 'Cliente Fictício 01', null, '118159083');
  await indicacao(a, 'Cliente Fictício 02', '13818854463', null);
  await indicacao(a, 'Cliente Fictício 05 (Ana)', '72317422075', null);
  await indicacao(b, 'Cliente Fictício 05 (Bruno)', '72317422075', null);
}

(async () => {
  const db = await novoBanco();
  await semear(db);
  usarNoApp(db);
  const app = require('../src/app');
  const porta = Number(process.env.PORT) || 3001;
  app.listen(porta, () => {
    console.log(`Servidor de TESTE (banco em memória, sem produção) em http://localhost:${porta}`);
    console.log('Logins (senha teste123): ADMIN-T01, PARTNER-T01, PARTNER-T02, fernando@teste.local');
  });
})().catch(err => { console.error(err); process.exit(1); });
