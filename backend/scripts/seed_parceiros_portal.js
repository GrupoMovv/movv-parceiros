// Migra os 9 parceiros hardcoded de frontend/.../Marketplace/parceirosData.js
// pra tabela sindicato_parceiros (Bloco 1 do Portal do Parceiro), e cria um
// usuário de login "dono" placeholder pra cada um.
//
// Upsert idempotente por slug — pode rodar quantas vezes for preciso; não
// sobrescreve senha nem sobrescreve o status de um parceiro que já existe
// (mantém edição manual feita depois da migração).
//
// Execute: node scripts/seed_parceiros_portal.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

// Cópia 1:1 do PARCEIROS_INICIAIS (fonte da verdade até aqui) — ver
// frontend/src/pages/public/Marketplace/parceirosData.js.
const PARCEIROS = [
  { slug: 'nossa-drogaria', nome: 'Nossa Drogaria', categorias: ['Saude', 'Produtos'], icone: '💊', corIcone: '#10B981', descricao: 'Descontos exclusivos em produtos e medicamentos', beneficio: 'Super descontos pra associados SECI', whatsapp: '64992991403', endereco: 'Itumbiara/GO', exclusivo: true, novo: false },
  { slug: 'academia-atletica', nome: 'Academia Atlética', categorias: ['Esportes', 'Servicos'], icone: '🏋️', corIcone: '#F97316', descricao: 'Musculação, funcional e programas personalizados', beneficio: 'Mensalidade especial R$ 30,00', whatsapp: null, endereco: 'Itumbiara/GO', exclusivo: true, novo: false },
  { slug: 'diroma-fiori', nome: 'Diroma Fiori — Caldas Novas', categorias: ['Hotelaria', 'Servicos'], icone: '🏨', corIcone: '#0EA5E9', descricao: 'Pacote de final de semana em Caldas Novas', beneficio: 'R$ 300 sexta a domingo', whatsapp: '64992640899', endereco: 'Caldas Novas/GO', exclusivo: false, novo: false },
  { slug: 'oticas-diniz', nome: 'Óticas Diniz', categorias: ['Beleza', 'Produtos'], icone: '👓', corIcone: '#1E40AF', descricao: 'Armações, lentes e acessórios', beneficio: '20% de desconto', whatsapp: '6434320708', endereco: 'Itumbiara/GO', exclusivo: true, novo: false },
  { slug: 'ezequiel-nutricionista', nome: 'Ezequiel Reis — Nutricionista', categorias: ['Saude', 'Servicos'], icone: '🥗', corIcone: '#84CC16', descricao: 'Consulta com nutricionista e plano alimentar', beneficio: 'Consulta por R$ 70,00', whatsapp: '64993222304', endereco: 'Itumbiara/GO', exclusivo: false, novo: false },
  { slug: 'plenitude-psicologia', nome: 'Plenitude — Psicologia', categorias: ['Saude', 'Bem-estar'], icone: '🧠', corIcone: '#A855F7', descricao: 'Psicoterapia adulto, infantil, ABA e neuropsicologia', beneficio: 'Preço especial pra associados', whatsapp: '64992012585', endereco: 'Itumbiara/GO', exclusivo: false, novo: false },
  { slug: 'nesplora-neuropsicologia', nome: 'Nesplora', categorias: ['Saude', 'Servicos'], icone: '🥽', corIcone: '#3B82F6', descricao: 'Avaliação neuropsicológica com realidade virtual', beneficio: 'R$ 400 com relatório', whatsapp: '64992012585', endereco: 'Itumbiara/GO', exclusivo: false, novo: false },
  { slug: 'laura-clemente-estetica', nome: 'Laura Clemente — Estética', categorias: ['Beleza', 'Servicos'], icone: '💆‍♀️', corIcone: '#EC4899', descricao: 'Estética corporal e facial', beneficio: '10% de desconto em qualquer região', whatsapp: '64992300587', endereco: 'Itumbiara/GO', exclusivo: false, novo: true },
  { slug: 'studio-vip', nome: 'Studio Vip — Beleza', categorias: ['Beleza', 'Servicos'], icone: '💇‍♀️', corIcone: '#EAB308', descricao: 'Beleza e saúde capilar', beneficio: '20% de desconto', whatsapp: null, endereco: 'Itumbiara/GO', exclusivo: false, novo: true },
];

const SENHA_TEMPORARIA = 'IubMais2026!';

async function main() {
  const senhaHash = await bcrypt.hash(SENHA_TEMPORARIA, 10);
  const credenciais = [];

  for (const p of PARCEIROS) {
    const parceiroResult = await db.query(
      `INSERT INTO sindicato_parceiros
         (slug, nome, categorias, icone, cor_icone, descricao, beneficio, whatsapp, endereco, exclusivo, novo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ativo')
       ON CONFLICT (slug) DO UPDATE SET
         nome = EXCLUDED.nome, categorias = EXCLUDED.categorias, icone = EXCLUDED.icone,
         cor_icone = EXCLUDED.cor_icone, descricao = EXCLUDED.descricao, beneficio = EXCLUDED.beneficio,
         whatsapp = EXCLUDED.whatsapp, endereco = EXCLUDED.endereco, exclusivo = EXCLUDED.exclusivo,
         novo = EXCLUDED.novo, updated_at = NOW()
       RETURNING id`,
      [p.slug, p.nome, p.categorias, p.icone, p.corIcone, p.descricao, p.beneficio, p.whatsapp, p.endereco, p.exclusivo, p.novo]
    );
    const parceiroId = parceiroResult.rows[0].id;
    const email = `parceiro-${p.slug}@iubmais.test`;

    const existente = await db.query('SELECT id FROM sindicato_parceiro_usuarios WHERE email = $1', [email]);
    if (!existente.rows[0]) {
      await db.query(
        `INSERT INTO sindicato_parceiro_usuarios (parceiro_id, email, senha_hash, cargo, ativo)
         VALUES ($1, $2, $3, 'dono', true)`,
        [parceiroId, email, senhaHash]
      );
    }
    // Senha nunca é reescrita numa reexecução — se o dono já trocou a senha,
    // rodar o seed de novo não pode derrubar a senha nova dele.

    credenciais.push({ parceiro: p.nome, email });
  }

  console.log(`\n${PARCEIROS.length} parceiros migrados/atualizados em sindicato_parceiros.\n`);
  console.log('Credenciais de teste (senha temporária igual pra todos):');
  console.log(`Senha: ${SENHA_TEMPORARIA}\n`);
  console.table(credenciais);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
