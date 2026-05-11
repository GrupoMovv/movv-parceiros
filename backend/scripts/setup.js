/**
 * setup.js — Executa migration + seed em sequência.
 *
 * USO NO RENDER (comando temporário de inicialização):
 *   node scripts/setup.js && node src/server.js
 *
 * Após rodar uma vez, volte o comando para:
 *   node src/server.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db   = require('../src/config/database');

async function migrate() {
  console.log('[1/2] Executando migration...');
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_initial.sql'), 'utf8');
  await db.query(sql);
  console.log('      Migration OK.');
}

async function seed() {
  console.log('[2/2] Executando seed...');

  await db.query('DELETE FROM commissions');
  await db.query('DELETE FROM referrals');
  await db.query('DELETE FROM products');

  const adminHash = await bcrypt.hash('admin123', 10);
  await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, is_admin)
    VALUES ('ADMIN-001','Administrador Movv','admin@grupomovv.com.br',$1,'accounting','64999999999','admin@grupomovv.com.br',true)
    ON CONFLICT (email) DO NOTHING
  `, [adminHash]);

  const contHash = await bcrypt.hash('cont123', 10);
  const contResult = await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key)
    VALUES ('CONT-IT-001','Contabilidade Alpha','cont.alpha@email.com',$1,'accounting','64988880001','11.222.333/0001-44')
    ON CONFLICT (email) DO NOTHING RETURNING id
  `, [contHash]);
  const contId = contResult.rows[0]?.id;

  const funcHash = await bcrypt.hash('func123', 10);
  await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, parent_id)
    VALUES ('FUNC-IT-CS-001','Carlos Silva','carlos.silva@email.com',$1,'employee','64977770001','123.456.789-00',$2)
    ON CONFLICT (email) DO NOTHING
  `, [funcHash, contId]);

  await db.query(`
    INSERT INTO products (name, type, description, commission_rate, faixa, percentual_repasse) VALUES
      ('Consignado INSS - Novo',           'credit',    'Empréstimo consignado para aposentados e pensionistas INSS',        0.0150, 'alta',     0.0150),
      ('Cartão Benefício/Consignado INSS', 'credit',    'Cartão com desconto automático no benefício INSS',                  0.0150, 'alta',     0.0150),
      ('FGTS Saque Aniversário',           'credit',    'Antecipação do saque aniversário do FGTS',                          0.0150, 'alta',     0.0150),
      ('Seguros',                          'insurance', 'Seguros Auto, Vida, Residencial e Empresarial',                     0.0150, 'alta',     0.0150),
      ('Crédito Pessoal',                  'credit',    'Crédito pessoal sem consignação',                                   0.0150, 'alta',     0.0150),
      ('Empréstimo via Cartão de Crédito', 'credit',    'Crédito utilizando limite do cartão de crédito',                    0.0150, 'alta',     0.0150),
      ('Consignado Servidor Público',      'credit',    'Crédito consignado para servidores públicos',                       0.0100, 'media',    0.0100),
      ('Consignado CLT',                   'credit',    'Crédito consignado para trabalhadores CLT',                         0.0100, 'media',    0.0100),
      ('Consignado Empresas Privadas',     'credit',    'Consignado para colaboradores de empresas privadas',                 0.0100, 'media',    0.0100),
      ('Empréstimo na Conta de Energia',   'credit',    'Crédito com desconto automático na fatura de energia',              0.0100, 'media',    0.0100),
      ('Energia Solar',                    'other',     'Financiamento e instalação de energia solar fotovoltaica',           0.0100, 'media',    0.0100),
      ('Crédito Salário Banco do Brasil',  'credit',    'Crédito com desconto em folha via Banco do Brasil',                 0.0100, 'media',    0.0100),
      ('Portabilidade INSS',               'credit',    'Portabilidade de consignado INSS para melhores condições',          0.0030, 'baixa',    0.0030),
      ('Refinanciamento INSS',             'credit',    'Refinanciamento de contratos consignados INSS',                     0.0030, 'baixa',    0.0030),
      ('Consignado Forças Armadas',        'credit',    'Crédito consignado para militares e forças armadas',                0.0030, 'baixa',    0.0030),
      ('Consórcio',                        'other',     'Consórcio de imóveis, veículos e serviços',                         0.0030, 'baixa',    0.0030),
      ('Financiamento de Veículo',         'credit',    'Financiamento de automóveis novos e usados',                        0.0030, 'baixa',    0.0030),
      ('Financiamento Imobiliário',        'credit',    'Financiamento de imóveis residenciais e comerciais',                0.0030, 'baixa',    0.0030),
      ('Refinanciamento Imóvel/Veículo',   'credit',    'Refinanciamento de imóvel ou veículo próprio (home/auto equity)',   0.0030, 'baixa',    0.0030),
      ('Crédito PJ',                       'credit',    'Linhas de crédito para pessoa jurídica',                            0.0030, 'baixa',    0.0030),
      ('BPO Financeiro - Open Gestão Empresarial', 'bpo', 'Terceirização financeira completa — Mensalidade R$1.399', 0.0000, 'especial', 0.0000)
  `);

  console.log('      Seed OK — 21 produtos inseridos.');
}

async function main() {
  try {
    await migrate();
    await seed();
    console.log('\nSetup concluído com sucesso!');
    console.log('Credenciais: admin@grupomovv.com.br / admin123');
    process.exit(0);
  } catch (err) {
    console.error('Erro no setup:', err.message);
    process.exit(1);
  }
}

main();
