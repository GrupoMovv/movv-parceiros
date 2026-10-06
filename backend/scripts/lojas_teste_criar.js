// Lojas de teste (empresa_teste = true, igual à Adega Teste IUB, parceiro 47).
// Nunca aparecem nas listagens do site (home, busca, categorias, Pet, roleta,
// serviços); sem CNPJ/CPF (o banco proíbe documento em empresa de teste —
// migrations 074 e 076). Criadas como 'pausado', como a Adega.
//
//   node scripts/lojas_teste_criar.js            -> mostra o que vai criar (não grava)
//   node scripts/lojas_teste_criar.js --gravar   -> grava e imprime login e senha
//
// Para apagar tudo depois: node scripts/lojas_teste_limpar.js
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

const WHATSAPP = '64992917383';        // número do Junior (o mesmo da Adega Teste)
const EMAIL_BASE = ['isjjunior', 'hotmail.com'];
const email = sufixo => `${EMAIL_BASE[0]}+${sufixo}@${EMAIL_BASE[1]}`;
const PIX = { chave: '+5564992917383', tipo: 'telefone', nome: 'idevaldo junior' }; // o mesmo da Adega Teste

const dia = (abre, fecha, aberto = true) => ({ abre, fecha, aberto });
const HORARIO = {
  seg: dia('08:00', '22:00'), ter: dia('08:00', '22:00'), qua: dia('08:00', '22:00'), qui: dia('08:00', '22:00'),
  sex: dia('08:00', '22:00'), sab: dia('08:00', '22:00'), dom: dia('08:00', '22:00'),
};

const LOJAS = [
  {
    slug: 'pet-teste-iub', nome: 'Pet Shop Teste IUB', tipo: 'Pet shop (banho e tosa + loja)', emailSufixo: 'pet',
    campos: {
      categorias: ['Pet'], categoria_principal: 'Pet', icone: '🐾', tipo_negocio: 'hibrido',
      descricao_completa: 'Loja de TESTE do IUB MAIS+. Banho e tosa com agenda e produtos pet.',
      pet_servicos: ['banho_tosa', 'loja'], pet_portes: ['mini', 'pequeno', 'medio', 'grande'],
      preco_medio: 'A partir de R$ 40', duracao_media: '1 hora', modalidades: 'Presencial', horario_atendimento: 'Todos os dias, 8h às 22h',
    },
    petPrecos: [['banho_tosa', 'mini', 40], ['banho_tosa', 'pequeno', 50], ['banho_tosa', 'medio', 65], ['banho_tosa', 'grande', 85]],
    produtos: [
      { nome: 'Ração Premium Cães Adultos 3kg (teste)', preco: 89.90, categoria: 'Pet' },
      { nome: 'Petisco Bifinho 65g (teste)', preco: 9.90, categoria: 'Pet' },
    ],
  },
  {
    slug: 'servico-teste-iub', nome: 'Studio Beleza Teste IUB', tipo: 'Só serviço', emailSufixo: 'servico',
    campos: {
      categorias: ['Beleza'], categoria_principal: 'Beleza', icone: '💇', tipo_negocio: 'servico',
      descricao_completa: 'Loja de TESTE do IUB MAIS+. Só serviços, atendimento pelo WhatsApp.',
      preco_medio: 'A partir de R$ 35', duracao_media: '1 hora', modalidades: 'Presencial', horario_atendimento: 'Seg a sáb, 9h às 19h',
    },
    // serviços oferecidos = catálogo da loja (ver getServicoPorSlug)
    produtos: [
      { nome: 'Corte feminino (teste)', preco: 60, categoria: 'Beleza' },
      { nome: 'Escova (teste)', preco: 35, categoria: 'Beleza' },
      { nome: 'Manicure e pedicure (teste)', preco: 45, categoria: 'Beleza' },
    ],
  },
  {
    slug: 'mercado-teste-iub', nome: 'Mercadinho Teste IUB', tipo: 'Só produto (catálogo geral)', emailSufixo: 'produto',
    campos: {
      categorias: ['Casa'], categoria_principal: 'Casa', icone: '🛒', tipo_negocio: 'produto',
      descricao_completa: 'Loja de TESTE do IUB MAIS+. Produtos do catálogo geral com pedido pelo site.',
      pedidos_site_ativo: true, pedidos_confirmado_em: new Date(), pix_chave: PIX.chave, pix_tipo: PIX.tipo, pix_nome_recebedor: PIX.nome,
    },
    produtos: [
      { nome: 'Arroz Tipo 1 5kg (teste)', preco: 27.90, categoria: 'Casa' },
      { nome: 'Feijão Carioca 1kg (teste)', preco: 8.49, categoria: 'Casa', preco_associado: 7.49 }, // preço de associado
      { nome: 'Café Torrado 500g (teste)', preco: 18.90, categoria: 'Casa' },
      { nome: 'Óleo de Soja 900ml (teste)', preco: 7.99, categoria: 'Casa' },
      { nome: 'Detergente 500ml (teste)', preco: 2.79, categoria: 'Casa' },
      { nome: 'Papel Higiênico 12 rolos (teste)', preco: 22.90, categoria: 'Casa', promocao: { preco_por: 17.90 } }, // em promoção
    ],
  },
];

const COMUM = {
  empresa_teste: true, status: 'pausado', plano: 'gratis', plano_status: 'ativo', tipo_pessoa: 'pj',
  cidade: 'Itumbiara', estado: 'GO', bairro: 'Centro', endereco: 'Rua de Teste, 100',
  whatsapp: WHATSAPP, horario_funcionamento: HORARIO,
  delivery_disponivel: true, retirada_disponivel: true, taxa_entrega: 5, raio_entrega_km: 5,
};

function senhaAleatoria() {
  // 10 caracteres sem os que confundem (0/O, 1/l/I)
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(10), b => alfabeto[b % alfabeto.length]).join('');
}

async function main() {
  const gravar = process.argv.includes('--gravar');
  const slugs = LOJAS.map(l => l.slug);
  const emails = LOJAS.map(l => email(l.emailSufixo));
  const existe = (await db.query('SELECT slug FROM sindicato_parceiros WHERE slug = ANY($1)', [slugs])).rows;
  const emailUsado = (await db.query('SELECT email FROM sindicato_parceiro_usuarios WHERE email = ANY($1)', [emails])).rows;
  if (existe.length || emailUsado.length) {
    console.log('Já existe:', [...existe.map(r => r.slug), ...emailUsado.map(r => r.email)].join(', '), '— nada foi feito. Rode o lojas_teste_limpar.js antes.');
    return;
  }

  console.log(gravar ? 'GRAVANDO\n' : 'SÓ MOSTRANDO (use --gravar para criar)\n');
  for (const l of LOJAS) {
    console.log(`• ${l.nome} [${l.slug}] — ${l.tipo}`);
    console.log(`  login ${email(l.emailSufixo)} · WhatsApp ${WHATSAPP} · entrega (R$ 5) e retirada · 8h às 22h todos os dias`);
    if (l.petPrecos) console.log(`  banho e tosa: ${l.petPrecos.map(([, p, v]) => `${p} R$ ${v}`).join(', ')} (aba Agendamentos ligada)`);
    for (const p of l.produtos) {
      console.log(`  - ${p.nome}: R$ ${p.preco}${p.preco_associado ? ` (associado R$ ${p.preco_associado})` : ''}${p.promocao ? ` (promoção: R$ ${p.promocao.preco_por})` : ''}`);
    }
    if (l.campos.pedidos_site_ativo) console.log('  pedido pelo site ligado (Pix do Junior, igual à Adega)');
  }
  if (!gravar) return;

  const saida = [];
  await db.transacao(async (c) => {
    for (const l of LOJAS) {
      const campos = { ...COMUM, ...l.campos, slug: l.slug, nome: l.nome, razao_social: `${l.nome} (conta de teste)` };
      const cols = Object.keys(campos);
      const vals = cols.map(k => (k === 'horario_funcionamento' ? JSON.stringify(campos[k]) : campos[k]));
      const id = (await c.query(
        `INSERT INTO sindicato_parceiros (${cols.join(', ')}, plano_ativo_desde, plano_iniciado_em)
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW()) RETURNING id`, vals
      )).rows[0].id;
      const senha = senhaAleatoria();
      await c.query(
        `INSERT INTO sindicato_parceiro_usuarios (parceiro_id, email, senha_hash, cargo, nome) VALUES ($1, $2, $3, 'dono', 'Junior (teste)')`,
        [id, email(l.emailSufixo), await bcrypt.hash(senha, 10)]
      );
      for (const [servico, porte, preco] of l.petPrecos || []) {
        await c.query('INSERT INTO pet_precos (parceiro_id, servico, porte, preco) VALUES ($1, $2, $3, $4)', [id, servico, porte, preco]);
      }
      for (const p of l.produtos) {
        const pid = (await c.query(
          `INSERT INTO sindicato_parceiro_produtos (parceiro_id, nome, descricao, preco, preco_associado, categoria, estoque_disponivel, moderacao_status)
           VALUES ($1, $2, 'Produto de teste do IUB MAIS+.', $3, $4, $5, true, 'aprovado') RETURNING id`,
          [id, p.nome, p.preco, p.preco_associado || null, p.categoria]
        )).rows[0].id;
        if (p.promocao) {
          await c.query(
            `INSERT INTO sindicato_parceiro_promocoes (parceiro_id, produto_id, titulo, preco_de, preco_por, categoria, data_inicio, data_fim)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + interval '90 days')`,
            [id, pid, p.nome.replace(' (teste)', ' em promoção (teste)'), p.preco, p.promocao.preco_por, p.categoria]
          );
        }
      }
      saida.push({ loja: l.nome, id, tipo: l.tipo, login: email(l.emailSufixo), senha });
    }
  });
  console.log('\nCriadas. Guarde as senhas (não ficam salvas em lugar nenhum):');
  console.table(saida);
}

main().then(() => db.pool.end()).catch(e => { console.error('FALHOU, nada foi gravado:', e.message); db.pool.end(); process.exit(1); });
