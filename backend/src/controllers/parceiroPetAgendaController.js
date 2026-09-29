const db = require('../config/database');
const { validarDiaPeriodo, hojeSP } = require('../config/pet');
const { avisarResposta, avisarFotosProntas } = require('../services/petAvisosService');
const { anexarFotosEAvaliacoes, atendimentoFeito, LIMITE_FOTOS_POR_TIPO } = require('../services/petAtendimentos');
const cloudinaryService = require('../services/cloudinaryService');

// Pet parte 3 — lado do PET SHOP (/parceiro/painel/agendamentos).
// Sempre vê: nome do pet + resumo (espécie/raça/porte/sexo) gravados no
// pedido, o que o cliente escreveu e o contato dele (quem pede horário
// espera ser respondido). Só vê a FICHA (saúde, vacinas, emergência) se o
// dono autorizou este pet shop e não revogou — LGPD.

// Parte 4: "atendidos" = confirmado cujo dia já chegou — é onde o pet shop
// manda as fotos antes/depois e vê/responde a avaliação. Hoje aparece em
// "confirmados" e em "atendidos" (fotografa no próprio dia).
const FILTROS = {
  abertos: "ag.status IN ('pendente', 'proposta')",
  confirmados: "ag.status = 'confirmado' AND ag.data >= $2::date",
  atendidos: "ag.status = 'confirmado' AND ag.data <= $2::date",
  encerrados: "ag.status IN ('recusado', 'cancelado')",
};

async function montarLista(parceiroId, filtro) {
  const where = FILTROS[filtro] || FILTROS.abertos;
  const ordem = ['encerrados', 'atendidos'].includes(filtro) ? 'ag.data DESC, ag.updated_at DESC' : 'ag.data, ag.periodo, ag.created_at';
  const usaHoje = where.includes('$2');
  const ags = (await db.query(
    `SELECT ag.id, ag.pet_id, ag.pet_nome, ag.pet_resumo, ag.servico, ag.porte, ag.data, ag.periodo, ag.observacao,
            ag.preco_estimado, ag.status, ag.proposta_data, ag.proposta_periodo, ag.resposta, ag.respondido_em, ag.created_at,
            ag.fotos_publicas,
            EXISTS (SELECT 1 FROM pet_atendimentos pa WHERE pa.agendamento_id = ag.id AND pa.status = 'confirmado') AS atendimento_registrado,
            a.nome_completo AS cliente_nome, a.whatsapp AS cliente_whatsapp,
            (au.pet_id IS NOT NULL) AS ficha_autorizada
     FROM pet_agendamentos ag
     JOIN sindicato_associados a ON a.id = ag.associado_id
     LEFT JOIN pet_autorizacoes au ON au.pet_id = ag.pet_id AND au.parceiro_id = ag.parceiro_id AND au.revogado_em IS NULL
     WHERE ag.parceiro_id = $1 AND ${where}
     ORDER BY ${ordem} LIMIT 200`,
    usaHoje ? [parceiroId, hojeSP()] : [parceiroId]
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
    agendamentos: (await anexarFotosEAvaliacoes(ags)).map(a => ({
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

// ─── Parte 4: fotos antes/depois e resposta à avaliação ────────────────────

// POST /api/parceiro/pet-agenda/:id/fotos (multipart: fotos[], tipo=antes|depois)
// Só em atendimento feito. Primeira foto do atendimento → WhatsApp pro dono
// ("fotos prontas, veja e avalie").
async function enviarFotos(req, res) {
  try {
    const ag = await pedidoDoParceiro(req.params.id, req.parceiro.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!atendimentoFeito(ag)) return res.status(409).json({ error: 'Fotos só depois do atendimento (horário confirmado e o dia já chegou)' });
    const tipo = req.body?.tipo;
    if (!['antes', 'depois'].includes(tipo)) return res.status(400).json({ error: 'Diga se é foto de antes ou de depois' });
    if (!req.files?.length) return res.status(400).json({ error: 'Envie ao menos uma foto' });

    const atuais = (await db.query('SELECT tipo FROM pet_atendimento_fotos WHERE agendamento_id = $1', [ag.id])).rows;
    if (atuais.filter(f => f.tipo === tipo).length + req.files.length > LIMITE_FOTOS_POR_TIPO) {
      return res.status(400).json({ error: `Máximo de ${LIMITE_FOTOS_POR_TIPO} fotos de ${tipo}` });
    }
    for (const file of req.files) {
      const { url, publicId } = await cloudinaryService.uploadFoto(file.buffer, `iub/pets/atendimentos/${req.parceiro.id}`, 'PRODUTO');
      await db.query('INSERT INTO pet_atendimento_fotos (agendamento_id, tipo, url, public_id) VALUES ($1, $2, $3, $4)', [ag.id, tipo, url, publicId]);
    }

    let whatsappAvisado = null;
    if (atuais.length === 0) {
      const cli = (await db.query('SELECT whatsapp FROM sindicato_associados WHERE id = $1', [ag.associado_id])).rows[0];
      whatsappAvisado = await avisarFotosProntas({ clienteWhatsapp: cli?.whatsapp, ag, parceiroNome: req.parceiro.nome });
    }
    return res.json({ ...(await montarLista(req.parceiro.id, 'atendidos')), whatsapp_avisado: whatsappAvisado });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Erro ao enviar as fotos' });
  }
}

// DELETE /api/parceiro/pet-agenda/:id/fotos/:fotoId
async function removerFoto(req, res) {
  try {
    const ag = await pedidoDoParceiro(req.params.id, req.parceiro.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    const r = await db.query('DELETE FROM pet_atendimento_fotos WHERE id = $1 AND agendamento_id = $2 RETURNING public_id', [req.params.fotoId, ag.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Foto não encontrada' });
    if (r.rows[0].public_id) await cloudinaryService.deletarFoto(r.rows[0].public_id);
    return res.json(await montarLista(req.parceiro.id, 'atendidos'));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover a foto' });
  }
}

// POST /api/parceiro/pet-agenda/:id/avaliacao/resposta { resposta } — pública; "" apaga
async function responderAvaliacao(req, res) {
  try {
    const ag = await pedidoDoParceiro(req.params.id, req.parceiro.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    const texto = recado(req.body?.resposta);
    const r = await db.query(
      // $1 e $2 separados: o mesmo parâmetro como varchar e como teste de NULL dá "inconsistent types"
      'UPDATE pet_avaliacoes SET resposta = $1, respondido_em = CASE WHEN $2 THEN NOW() ELSE NULL END WHERE agendamento_id = $3 RETURNING id',
      [texto, texto !== null, ag.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Esse atendimento ainda não foi avaliado' });
    return res.json(await montarLista(req.parceiro.id, 'atendidos'));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao responder a avaliação' });
  }
}

module.exports = { listar, responder, enviarFotos, removerFoto, responderAvaliacao };
