require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

async function seed() {
  console.log('Iniciando seed...');

  // Limpar dados dependentes antes de recriar
  await db.query('DELETE FROM commissions');
  await db.query('DELETE FROM referrals');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM internal_commissions');
  await db.query('DELETE FROM internal_collaborators');

  // ── Admin ──────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, is_admin)
    VALUES ('ADMIN-001','Administrador Movv','admin@grupomovv.com.br',$1,'accounting','64999999999','admin@grupomovv.com.br',true)
    ON CONFLICT (email) DO NOTHING
  `, [adminHash]);

  // ── Contabilidade parceira de teste ───────────────────────────────────────
  const contHash = await bcrypt.hash('cont123', 10);
  const contResult = await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key)
    VALUES ('CONT-IT-001','Contabilidade Alpha','cont.alpha@email.com',$1,'accounting','64988880001','11.222.333/0001-44')
    ON CONFLICT (email) DO NOTHING RETURNING id
  `, [contHash]);
  const contId = contResult.rows[0]?.id;

  // ── Parceiro funcionário de teste ─────────────────────────────────────────
  const funcHash = await bcrypt.hash('func123', 10);
  await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, parent_id)
    VALUES ('FUNC-IT-CS-001','Carlos Silva','carlos.silva@email.com',$1,'employee','64977770001','123.456.789-00',$2)
    ON CONFLICT (email) DO NOTHING
  `, [funcHash, contId]);

  // ── Produtos Azul Empréstimo ───────────────────────────────────────────────
  await db.query(`
    INSERT INTO products (name, type, description, commission_rate, faixa, percentual_repasse) VALUES
      -- FAIXA ALTA — 1,5%
      ('Consignado INSS - Novo',           'credit',    'Empréstimo consignado para aposentados e pensionistas INSS',        0.0150, 'alta',  0.0150),
      ('Cartão Benefício/Consignado INSS', 'credit',    'Cartão com desconto automático no benefício INSS',                  0.0150, 'alta',  0.0150),
      ('FGTS Saque Aniversário',           'credit',    'Antecipação do saque aniversário do FGTS',                          0.0150, 'alta',  0.0150),
      ('Seguros',                          'insurance', 'Seguros Auto, Vida, Residencial e Empresarial',                     0.0150, 'alta',  0.0150),
      ('Crédito Pessoal',                  'credit',    'Crédito pessoal sem consignação',                                   0.0150, 'alta',  0.0150),
      ('Empréstimo via Cartão de Crédito', 'credit',    'Crédito utilizando limite do cartão de crédito',                    0.0150, 'alta',  0.0150),
      -- FAIXA MÉDIA — 1,0%
      ('Consignado Servidor Público',      'credit',    'Crédito consignado para servidores públicos',                       0.0100, 'media', 0.0100),
      ('Consignado CLT',                   'credit',    'Crédito consignado para trabalhadores CLT',                         0.0100, 'media', 0.0100),
      ('Consignado Empresas Privadas',     'credit',    'Consignado para colaboradores de empresas privadas',                 0.0100, 'media', 0.0100),
      ('Empréstimo na Conta de Energia',   'credit',    'Crédito com desconto automático na fatura de energia',              0.0100, 'media', 0.0100),
      ('Energia Solar',                    'other',     'Financiamento e instalação de energia solar fotovoltaica',           0.0100, 'media', 0.0100),
      ('Crédito Salário Banco do Brasil',  'credit',    'Crédito com desconto em folha via Banco do Brasil',                 0.0100, 'media', 0.0100),
      -- FAIXA BAIXA — 0,3%
      ('Portabilidade INSS',               'credit',    'Portabilidade de consignado INSS para melhores condições',          0.0030, 'baixa', 0.0030),
      ('Refinanciamento INSS',             'credit',    'Refinanciamento de contratos consignados INSS',                     0.0030, 'baixa', 0.0030),
      ('Consignado Forças Armadas',        'credit',    'Crédito consignado para militares e forças armadas',                0.0030, 'baixa', 0.0030),
      ('Consórcio',                        'other',     'Consórcio de imóveis, veículos e serviços',                         0.0030, 'baixa', 0.0030),
      ('Financiamento de Veículo',         'credit',    'Financiamento de automóveis novos e usados',                        0.0030, 'baixa', 0.0030),
      ('Financiamento Imobiliário',        'credit',    'Financiamento de imóveis residenciais e comerciais',                0.0030, 'baixa', 0.0030),
      ('Refinanciamento Imóvel/Veículo',   'credit',    'Refinanciamento de imóvel ou veículo próprio (home/auto equity)',   0.0030, 'baixa', 0.0030),
      ('Crédito PJ',                       'credit',    'Linhas de crédito para pessoa jurídica',                            0.0030, 'baixa', 0.0030),
      -- ESPECIAL — BPO
      ('BPO Financeiro - Open Gestão Empresarial', 'bpo', 'Terceirização financeira completa — Mensalidade R$1.399', 0.0000, 'especial', 0.0000)
  `);

  // ── Colaboradores internos ─────────────────────────────────────────────────
  const pablinePass  = 'movv@pabline2025';
  const fernandoPass = 'movv@fernando2025';
  const pablineHash  = await bcrypt.hash(pablinePass, 10);
  const fernandoHash = await bcrypt.hash(fernandoPass, 10);

  await db.query(`
    INSERT INTO internal_collaborators (name, email, password_hash, role, whatsapp, pix_key, base_salary)
    VALUES
      ('Pabline', 'pabline@grupomovv.com.br',  $1, 'manager_azul',    '64999990001', 'pabline@grupomovv.com.br',  1621.00),
      ('Fernando','fernando@grupomovv.com.br', $2, 'comercial_full', '64999990002', 'fernando@grupomovv.com.br', 1621.00)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role          = EXCLUDED.role
  `, [pablineHash, fernandoHash]);

  console.log('\nSeed concluído!');
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  CREDENCIAIS — PARCEIROS');
  console.log('═══════════════════════════════════════════');
  console.log('  Admin:          ADMIN-001      / admin123');
  console.log('  Contabilidade:  CONT-IT-001    / cont123');
  console.log('  Funcionário:    FUNC-IT-CS-001 / func123');
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  CREDENCIAIS — COLABORADORES INTERNOS');
  console.log('═══════════════════════════════════════════');
  console.log(`  Pabline:   pabline@grupomovv.com.br  / ${pablinePass}`);
  console.log(`  Fernando:  fernando@grupomovv.com.br / ${fernandoPass}`);
  console.log('═══════════════════════════════════════════');

  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
