require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

const COLLABORATORS = [
  {
    name:        'Pabline',
    email:       'pabline@grupomovv.com.br',
    role:        'manager_azul',
    whatsapp:    null,
    base_salary: 1621.00,
  },
  {
    name:        'Fernando',
    email:       'fernando@grupomovv.com.br',
    role:        'comercial_full',
    whatsapp:    null,
    base_salary: 1621.00,
  },
];

async function run() {
  console.log('\nVerificando colaboradores internos...\n');

  const results = [];

  for (const collab of COLLABORATORS) {
    const existing = await db.query(
      'SELECT id, name, email FROM internal_collaborators WHERE email = $1',
      [collab.email]
    );

    if (existing.rows[0]) {
      console.log(`  ⚠  ${collab.name} (${collab.email}) já existe — ignorado.`);
      results.push({ ...collab, skipped: true, password: null });
      continue;
    }

    const password = generatePassword();
    const hash     = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO internal_collaborators
         (name, email, password_hash, role, whatsapp, base_salary, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [collab.name, collab.email, hash, collab.role, collab.whatsapp, collab.base_salary]
    );

    console.log(`  ✓  ${collab.name} inserido com sucesso.`);
    results.push({ ...collab, skipped: false, password });
  }

  const inserted = results.filter(r => !r.skipped);

  if (inserted.length === 0) {
    console.log('\nNenhum colaborador novo inserido (todos já existiam).');
    console.log('Para redefinir senhas use o script seed_reset_passwords.js\n');
    process.exit(0);
  }

  console.log('\n');
  console.log('===========================');
  console.log('  CREDENCIAIS GERADAS');
  console.log('===========================');
  for (const r of inserted) {
    console.log(`  ${r.name}:`);
    console.log(`    Email: ${r.email}`);
    console.log(`    Senha: ${r.password}`);
    console.log('');
  }
  console.log('===========================');
  console.log('  IMPORTANTE: Anote essas senhas agora.');
  console.log('  Elas nao podem ser recuperadas depois.');
  console.log('===========================\n');

  process.exit(0);
}

run().catch(err => {
  console.error('\nErro ao executar seed:', err.message);
  process.exit(1);
});
