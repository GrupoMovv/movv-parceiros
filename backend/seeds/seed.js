require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

async function seed() {
  console.log('Iniciando seed...');

  // Admin
  const adminHash = await bcrypt.hash('admin123', 10);
  await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, is_admin)
    VALUES ('ADMIN-001','Administrador Movv','admin@grupomovv.com.br',$1,'accounting','64999999999','admin@grupomovv.com.br',true)
    ON CONFLICT (email) DO NOTHING
  `, [adminHash]);

  // Contabilidade parceira
  const contHash = await bcrypt.hash('cont123', 10);
  const contResult = await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key)
    VALUES ('CONT-IT-001','Contabilidade Alpha','cont.alpha@email.com',$1,'accounting','64988880001','11.222.333/0001-44')
    ON CONFLICT (email) DO NOTHING RETURNING id
  `, [contHash]);
  const contId = contResult.rows[0]?.id;

  // Parceiro funcionário
  const funcHash = await bcrypt.hash('func123', 10);
  await db.query(`
    INSERT INTO partners (code, name, email, password_hash, type, whatsapp, pix_key, parent_id)
    VALUES ('FUNC-IT-CS-001','Carlos Silva','carlos.silva@email.com',$1,'employee','64977770001','123.456.789-00',$2)
    ON CONFLICT (email) DO NOTHING
  `, [funcHash, contId]);

  // Produtos
  await db.query(`
    INSERT INTO products (name, type, description, commission_rate) VALUES
      ('Crédito Empresarial',    'credit',              'Linhas de crédito para PJ',           0.0100),
      ('BPO Financeiro',         'bpo',                 'Terceirização financeira R$1.399/mês', 0.0100),
      ('Certificado Digital A1', 'digital_certificate', 'Certificado digital A1 PF/PJ',        0.0100),
      ('Certificado Digital A3', 'digital_certificate', 'Certificado digital A3 em token',     0.0100),
      ('Abertura de Conta PJ',   'account',             'Conta corrente pessoa jurídica',       0.0100),
      ('Seguro Empresarial',     'insurance',           'Seguros para empresas',                0.0100)
    ON CONFLICT DO NOTHING
  `);

  console.log('Seed concluído!');
  console.log('');
  console.log('Credenciais de teste:');
  console.log('  Admin:          ADMIN-001  / admin123');
  console.log('  Contabilidade:  CONT-IT-001 / cont123');
  console.log('  Funcionário:    FUNC-IT-CS-001 / func123');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
