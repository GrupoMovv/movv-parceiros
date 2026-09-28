const db = require('../config/database');
const { validarDiaPeriodo } = require('../config/pet');
const { avisarResposta } = require('../services/petAvisosService');

// Pet parte 3 — lado do PET SHOP (/parceiro/painel/agendamentos).
// Sempre vê: nome do pet + resumo (espécie/raça/porte/sexo) gravados no
// pedido, o que o cliente escreveu e o contato dele (quem pede horário
// espera ser respondido). Só vê a FICHA (saúde, vacinas, emergência) se o
// dono autorizou este pet shop e não revogou — LGPD.

const FILTROS = {
  abertos: "ag.status IN ('pendente', 'proposta')",
  confirmados: "ag.status = 'confirmado'",
  encerrados: "ag.status IN ('recusado', 'cancelado')",
};

async function montarLista(parceiroId, filtro) {
  const where = FILTROS[filtro] || FILTROS.abertos;
  const ordem = filtro === 'encerrados' ? 'ag.updated_at DESC' : 'ag.data, ag.periodo, ag.created_at';
  const ags = (await db.query(
    `SELECT ag.id, ag.pet_id, ag.pet_nome, ag.pet_resumo, ag.servico, ag.porte, ag.data, ag.periodo, ag.observacao,
            ag.preco_estimado, ag.status, ag.proposta_data, ag.proposta_periodo, ag.resposta, ag.respondido_em, ag.created_at,
            a.nome_completo AS cliente_nome, a.whatsapp AS cliente_whatsapp,
            (au.pet_id IS NOT NULL) AS ficha_autorizada
     FROM pet_agendamentos ag
     JOIN sindicato_associados a ON a.id = ag.associado_id
     LEFT JOIN pet_autorizacoes au ON au.pet_id = ag.pet_id AND au.parceiro_id = ag.parceiro_id AND au.revogado_em IS NULL
     WHERE ag.parceiro_id = $1 AND ${where}
     ORDER BY ${ordem} LIMIT 200`,
    [parceiroId]
  )).rows;

  // Ficha completa só dos pets autorizados (e ainda ativos)
  const petIds = [...new Set(ags.filter(a => a.ficha_autorizada && a.pet_id).map(a => a.pet_id))];
  let fichas = new Map();
  if (petIds.length) {
    const pets = (await db.query(
      `SELECT id, foto_url, nascimento, nascimento_aproximado, castrado, alergias, medicamentos, comportamento,
              vet_nome, vet_telefone, contato_extra_nome, contato_extra_telefone
       FROM pets WHERE id = ANY($1) AND ativo = true`, [petIds]
    )).rows;
    const vacinas = (await db.query(
      'SELECT pet_id, nome, data, proxima_dose FROM pet_vacinas WHERE pet_id = ANY($1) ORDER BY data NULLS LAST, id', [petIds]
    )).rows;
    fichas = new Map(pets.map(p => [p.id, { ...p, vacinas: vacinas.filter(v => v.pet_id === p.id).map(({ pet_id, ...v }) => v) }]));
  }

  const contagem = (await db.query(
    "SELECT COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes FROM pet_agendamentos WHERE parceiro_id = $1", [parceiroId]
  )).rows[0];

  return {
    pendentes: contagem.pendentes,
    agendamentos: ags.map(a => ({
      ...a,
      // só o primeiro nome do cliente na lista; o WhatsApp é pra responder
      cliente_nome: String(a.cliente_nome || '').trim().split(/\s+/)[0] || 'Cliente',
      ficha: a.ficha_autorizada ? fichas.get(a.pet_id) || null : null,
    })),
  };
}

// GET /api/parceiro/pet-agenda?filtro=abertos|confirmados|encerrados
async function listar(req, res) {
  try {
    return res.json(await montarLista(req.parceiro.id, req.query.filtro));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar os pedidos' });
  }
}

async function pedidoDoParceiro(id, parceiroId) {
  return (await db.query('SELECT * FROM pet_agendamentos WHERE id = $1 AND parceiro_id = $2', [id, parceiroId])).rows[0] || null;
}

function recado(v) {
  const t = String(v || '').replace(/<[^>]*>/g, '').trim();
  return t ? t.slice(0, 500) : null;
}

// POST /api/parceiro/pet-agenda/:id/responder
// { acao: 'confirmar' | 'propor' | 'recusar', data?, periodo?, resposta? }
async function responder(req, res) {
  try {
    const ag = await pedidoDoParceiro(req.params.id, req.parceiro.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    const b = req.body || {};
    // proposta em aberto: o pet shop ainda pode confirmar o dia original,
    // mudar a proposta ou recusar; confirmado só dá pra recusar (desmarcar)
    const permitido = {
      confirmar: ['pendente', 'proposta'],
      propor: ['pendente', 'proposta', 'confirmado'],
      recusar: ['pendente', 'proposta', 'confirmado'],
    }[b.acao];
    if (!permitido) return res.status(400).json({ error: 'Ação inválida' });
    if (!permitido.includes(ag.status)) return res.status(409).json({ error: 'Esse pedido já foi encerrado' });

    if (b.acao === 'confirmar') {
      await db.query(
        `UPDATE pet_agendamentos SET status = 'confirmado', proposta_data = NULL, proposta_periodo = NULL,
                resposta = $1, respondido_em = NOW(), updated_at = NOW() WHERE id = $2`,
        [recado(b.resposta), ag.id]
      );
    } else if (b.acao === 'propor') {
      const quando = validarDiaPeriodo(b.data, b.periodo);
      if (quando.erro) return res.status(400).json({ error: quando.erro });
      await db.query(
        `UPDATE pet_agendamentos SET status = 'proposta', proposta_data = $1, proposta_periodo = $2,
                resposta = $3, respondido_em = NOW(), updated_at = NOW() WHERE id = $4`,
        [quando.data, quando.periodo, recado(b.resposta), ag.id]
      );
    } else {
      await db.query(
        `UPDATE pet_agendamentos SET status = 'recusado', resposta = $1, respondido_em = NOW(), updated_at = NOW() WHERE id = $2`,
        [recado(b.resposta), ag.id]
      );
    }
    const novo = (await db.query(
      `SELECT ag.*, a.whatsapp AS cliente_whatsapp FROM pet_agendamentos ag
       JOIN sindicato_associados a ON a.id = ag.associado_id WHERE ag.id = $1`, [ag.id]
    )).rows[0];
    const whatsappAvisado = await avisarResposta({ clienteWhatsapp: novo.cliente_whatsapp, ag: novo, parceiroNome: req.parceiro.nome });
    return res.json({ ...(await montarLista(req.parceiro.id, req.query.filtro)), whatsapp_avisado: whatsappAvisado, respondido_id: ag.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao responder o pedido' });
  }
}

module.exports = { listar, responder };
