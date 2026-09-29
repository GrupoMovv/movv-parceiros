const db = require('../config/database');
const { SERVICOS_PET, resumoPet, hojeSP } = require('../config/pet');
const fid = require('../services/petFidelidade');
const { atendimentoFeito } = require('../services/petAtendimentos');
const avisos = require('../services/petAvisosService');

// Pet parte 5 — lado do PET SHOP: cartões fidelidade, QR do balcão,
// registrar atendimento (lendo o QR do pet ou "Marcar como realizado"),
// confirmar o que o cliente registrou e resgatar prêmios.

const servicosDeAtendimento = parceiro => SERVICOS_PET.filter(s => s.natureza === 'servico' && (parceiro.pet_servicos || []).includes(s.codigo));
const primeiroNome = n => String(n || '').trim().split(/\s+/)[0] || 'Cliente';

// GET /api/parceiro/pet-fidelidade
async function painel(req, res) {
  try {
    const pid = req.parceiro.id;
    const cartoes = (await db.query('SELECT id, servico, meta, premio, ativo FROM pet_fidelidade_cartoes WHERE parceiro_id = $1 ORDER BY servico NULLS LAST', [pid])).rows;
    const aguardando = (await db.query(
      `SELECT at.id, at.servico, at.dia, at.created_at, pe.nome AS pet_nome, pe.especie, pe.raca, pe.raca_outra, pe.porte, pe.sexo, a.nome_completo
       FROM pet_atendimentos at JOIN pets pe ON pe.id = at.pet_id JOIN sindicato_associados a ON a.id = at.associado_id
       WHERE at.parceiro_id = $1 AND at.status = 'aguardando_loja' ORDER BY at.created_at DESC`, [pid]
    )).rows.map(({ nome_completo, especie, raca, raca_outra, porte, sexo, ...r }) => ({ ...r, cliente: primeiroNome(nome_completo), pet_resumo: resumoPet({ especie, raca, raca_outra, porte, sexo }) }));
    const premios = (await db.query(
      `SELECT pr.id, pr.premio_texto, pr.disponivel_em, pr.expira_em, pe.nome AS pet_nome, a.nome_completo
       FROM pet_fidelidade_premios pr JOIN pet_fidelidade_cartoes c ON c.id = pr.cartao_id
       JOIN pets pe ON pe.id = pr.pet_id JOIN sindicato_associados a ON a.id = pe.associado_id
       WHERE c.parceiro_id = $1 AND pr.resgatado_em IS NULL AND pr.expira_em > NOW() ORDER BY pr.disponivel_em`, [pid]
    )).rows.map(({ nome_completo, ...r }) => ({ ...r, cliente: primeiroNome(nome_completo) }));
    const recentes = (await db.query(
      `SELECT at.id, at.servico, at.dia, at.origem, at.status, pe.nome AS pet_nome, a.nome_completo
       FROM pet_atendimentos at JOIN pets pe ON pe.id = at.pet_id JOIN sindicato_associados a ON a.id = at.associado_id
       WHERE at.parceiro_id = $1 AND at.status <> 'aguardando_loja' ORDER BY at.created_at DESC LIMIT 30`, [pid]
    )).rows.map(({ nome_completo, ...r }) => ({ ...r, cliente: primeiroNome(nome_completo) }));
    return res.json({
      qr_token: await fid.tokenDaLoja(pid),
      servicos: servicosDeAtendimento(req.parceiro).map(s => ({ codigo: s.codigo, nome: s.nome, emoji: s.emoji })),
      cartoes, aguardando, premios, recentes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar a fidelidade' });
  }
}

// PUT /api/parceiro/pet-fidelidade/cartoes { cartoes: [{ servico|null, meta, premio, ativo }] }
// O que não vier na lista fica desligado (não apaga: tem carimbo pendurado).
async function salvarCartoes(req, res) {
  try {
    const lista = Array.isArray(req.body?.cartoes) ? req.body.cartoes : null;
    if (!lista) return res.status(400).json({ error: 'Lista de cartões inválida' });
    const validos = new Set(servicosDeAtendimento(req.parceiro).map(s => s.codigo));
    const vistos = new Set();
    const limpos = [];
    for (const c of lista) {
      const servico = c.servico || null;
      if (servico && !validos.has(servico)) return res.status(400).json({ error: 'Cartão pra um serviço que você não oferece' });
      const chave = servico || '*';
      if (vistos.has(chave)) return res.status(400).json({ error: 'Só um cartão por serviço' });
      vistos.add(chave);
      const meta = Number(c.meta);
      if (!Number.isInteger(meta) || meta < 2 || meta > 30) return res.status(400).json({ error: 'O cartão precisa de 2 a 30 atendimentos' });
      const premio = String(c.premio || '').replace(/<[^>]*>/g, '').trim().slice(0, 120);
      if (premio.length < 3) return res.status(400).json({ error: 'Escreva o prêmio (ex.: "Banho grátis")' });
      limpos.push({ servico, meta, premio, ativo: c.ativo !== false });
    }
    await db.transacao(async client => {
      await client.query('UPDATE pet_fidelidade_cartoes SET ativo = false, updated_at = NOW() WHERE parceiro_id = $1', [req.parceiro.id]);
      for (const c of limpos) {
        await client.query(
          `INSERT INTO pet_fidelidade_cartoes (parceiro_id, servico, meta, premio, ativo) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (parceiro_id, (COALESCE(servico, '*'))) DO UPDATE SET meta = $3, premio = $4, ativo = $5, updated_at = NOW()`,
          [req.parceiro.id, c.servico, c.meta, c.premio, c.ativo]
        );
      }
    });
    return painel(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar os cartões' });
  }
}

// GET /api/parceiro/pet-fidelidade/qr/:token — pet shop leu o QR do pet
async function lerQrPet(req, res) {
  try {
    const pet = (await db.query(
      `SELECT pe.*, a.nome_completo FROM pets pe JOIN sindicato_associados a ON a.id = pe.associado_id
       WHERE pe.qr_token = $1 AND pe.ativo = true`, [req.params.token]
    )).rows[0];
    if (!pet) return res.status(404).json({ error: 'QR de pet não encontrado (o pet pode ter sido removido)' });
    const hoje = (await db.query(
      "SELECT id, status, servico FROM pet_atendimentos WHERE pet_id = $1 AND parceiro_id = $2 AND dia = $3 AND status IN ('confirmado', 'aguardando_loja')",
      [pet.id, req.parceiro.id, hojeSP()]
    )).rows[0] || null;
    return res.json({
      pet: { nome: pet.nome, especie: pet.especie, foto_url: pet.foto_url, resumo: resumoPet(pet), dono: primeiroNome(pet.nome_completo) },
      servicos: servicosDeAtendimento(req.parceiro).map(s => ({ codigo: s.codigo, nome: s.nome, emoji: s.emoji })),
      atendimento_hoje: hoje,
      fidelidade: await fid.progressoDoPet(pet.id, req.parceiro.id),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao ler o QR' });
  }
}

async function avisarDono(pet, parceiro, res) {
  const dono = (await db.query('SELECT whatsapp FROM sindicato_associados WHERE id = $1', [pet.associado_id])).rows[0];
  return avisos.avisarAtendimentoRegistrado({ clienteWhatsapp: dono?.whatsapp, petNome: pet.nome, parceiroNome: parceiro.nome, fidelidade: res.fidelidade });
}

// POST /api/parceiro/pet-fidelidade/atendimentos
//   { pet_token, servico }         → leu o QR do pet no balcão
//   { agendamento_id }             → "Marcar como realizado" de um pedido (aba Atendidos)
async function registrar(req, res) {
  try {
    const b = req.body || {};
    let pet; let servico = b.servico; let dia; let agendamentoId = null;
    if (b.agendamento_id) {
      const ag = (await db.query('SELECT * FROM pet_agendamentos WHERE id = $1 AND parceiro_id = $2', [b.agendamento_id, req.parceiro.id])).rows[0];
      if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
      if (!atendimentoFeito(ag)) return res.status(409).json({ error: 'Só dá pra marcar como realizado no dia do atendimento ou depois' });
      if (!ag.pet_id) return res.status(409).json({ error: 'O dono removeu esse pet' });
      pet = (await db.query('SELECT * FROM pets WHERE id = $1', [ag.pet_id])).rows[0];
      servico = ag.servico; dia = String(ag.data).slice(0, 10); agendamentoId = ag.id;
    } else {
      pet = (await db.query('SELECT * FROM pets WHERE qr_token = $1 AND ativo = true', [String(b.pet_token || '')])).rows[0];
      if (!pet) return res.status(404).json({ error: 'QR de pet não encontrado' });
      if (!servicosDeAtendimento(req.parceiro).some(s => s.codigo === servico)) return res.status(400).json({ error: 'Escolha o serviço feito' });
    }
    const r = await fid.registrarAtendimento({ pet, parceiroId: req.parceiro.id, servico, origem: 'loja_leu', agendamentoId, dia });
    if (r.erro) return res.status(r.status).json({ error: r.erro });
    const whatsappAvisado = await avisarDono(pet, req.parceiro, r);
    return res.status(201).json({ atendimento: r.atendimento, fidelidade: r.fidelidade, whatsapp_avisado: whatsappAvisado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar o atendimento' });
  }
}

// POST /api/parceiro/pet-fidelidade/atendimentos/:id/(confirmar|recusar) — o que o cliente registrou
async function decidir(req, res) {
  try {
    const at = (await db.query("SELECT * FROM pet_atendimentos WHERE id = $1 AND parceiro_id = $2 AND status = 'aguardando_loja'", [req.params.id, req.parceiro.id])).rows[0];
    if (!at) return res.status(404).json({ error: 'Registro não encontrado ou já decidido' });
    const pet = (await db.query('SELECT * FROM pets WHERE id = $1', [at.pet_id])).rows[0];
    if (req.params.acao === 'confirmar') {
      const r = await fid.confirmarAtendimento(at);
      if (r && pet) await avisarDono(pet, req.parceiro, r);
    } else {
      await db.query("UPDATE pet_atendimentos SET status = 'recusado' WHERE id = $1", [at.id]);
    }
    return painel(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao decidir' });
  }
}

// POST /api/parceiro/pet-fidelidade/premios/:id/resgatar
async function resgatar(req, res) {
  try {
    const r = await db.query(
      `UPDATE pet_fidelidade_premios pr SET resgatado_em = NOW()
       FROM pet_fidelidade_cartoes c
       WHERE pr.id = $1 AND c.id = pr.cartao_id AND c.parceiro_id = $2 AND pr.resgatado_em IS NULL AND pr.expira_em > NOW()
       RETURNING pr.id`, [req.params.id, req.parceiro.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Prêmio não encontrado, já resgatado ou vencido' });
    return painel(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao resgatar' });
  }
}

module.exports = { painel, salvarCartoes, lerQrPet, registrar, decidir, resgatar };
