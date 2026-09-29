const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');
const {
  SERVICOS_PET, PORTES_PET, LIMITE_PETS_POR_CONTA,
  validarFichaPet, resumoPet, validarDiaPeriodo, hojeSP,
} = require('../config/pet');
const { avisarNovoPedido, avisarClienteMudou, avisarNovaAvaliacao, avisarClienteRegistrou, avisarContestado } = require('../services/petAvisosService');
const { tokenDoPet, registrarAtendimento, descarimbar, progressoDoPet } = require('../services/petFidelidade');
const { anexarFotosEAvaliacoes, atendimentoFeito } = require('../services/petAtendimentos');

const primeiroNome = a => String(a?.nome_completo || '').trim().split(/\s+/)[0] || 'Um cliente';

// Pet parte 3 — lado do CLIENTE (/meu → Meus Pets). A ficha é do dono
// (LGPD): o pet shop só enxerga a ficha completa de quem autorizou, e o
// dono revoga quando quiser. Qualquer conta do /meu (associado SECI ou
// cliente comum) pode ter pets.

const CAMPOS_FICHA = [
  'nome', 'especie', 'raca', 'raca_outra', 'porte', 'sexo', 'nascimento', 'nascimento_aproximado',
  'castrado', 'alergias', 'medicamentos', 'comportamento',
  'vet_nome', 'vet_telefone', 'contato_extra_nome', 'contato_extra_telefone',
];

async function buscarPetDoDono(petId, associadoId, client = db) {
  const r = await client.query('SELECT * FROM pets WHERE id = $1 AND associado_id = $2 AND ativo = true', [petId, associadoId]);
  return r.rows[0] || null;
}

// Pets ativos + vacinas + pet shops autorizados, numa ida só.
async function listarPetsCompletos(associadoId) {
  const pets = (await db.query(
    'SELECT * FROM pets WHERE associado_id = $1 AND ativo = true ORDER BY created_at', [associadoId]
  )).rows;
  if (!pets.length) return [];
  const ids = pets.map(p => p.id);
  const vacinas = (await db.query(
    'SELECT id, pet_id, nome, data, proxima_dose FROM pet_vacinas WHERE pet_id = ANY($1) ORDER BY data NULLS LAST, id', [ids]
  )).rows;
  const autorizacoes = (await db.query(
    `SELECT a.pet_id, a.autorizado_em, p.id AS parceiro_id, p.nome, p.slug
     FROM pet_autorizacoes a JOIN sindicato_parceiros p ON p.id = a.parceiro_id
     WHERE a.pet_id = ANY($1) AND a.revogado_em IS NULL ORDER BY a.autorizado_em`, [ids]
  )).rows;
  // Parte 5: atendimentos registrados nos últimos 30 dias (pra contestar) + cartões
  const atendimentos = (await db.query(
    `SELECT at.id, at.pet_id, at.servico, at.dia, at.origem, at.status, at.created_at, p.nome AS parceiro_nome,
            (at.origem = 'loja_leu' AND at.status = 'confirmado' AND at.created_at > NOW() - INTERVAL '7 days') AS pode_contestar
     FROM pet_atendimentos at JOIN sindicato_parceiros p ON p.id = at.parceiro_id
     WHERE at.pet_id = ANY($1) AND at.created_at > NOW() - INTERVAL '30 days' ORDER BY at.created_at DESC`, [ids]
  )).rows;
  const fidelidades = await Promise.all(pets.map(p => progressoDoPet(p.id)));
  return pets.map((p, i) => ({
    ...p,
    foto_public_id: undefined,
    qr_token: undefined, // o QR sai por GET /:id/qr (cria na 1ª vez)
    vacinas: vacinas.filter(v => v.pet_id === p.id).map(({ pet_id, ...v }) => v),
    autorizados: autorizacoes.filter(a => a.pet_id === p.id).map(({ pet_id, ...a }) => a),
    atendimentos: atendimentos.filter(a => a.pet_id === p.id).map(({ pet_id, ...a }) => a),
    fidelidade: fidelidades[i],
  }));
}

// GET /api/public/meus-pets
async function listar(req, res) {
  try {
    return res.json({ pets: await listarPetsCompletos(req.painelAssociado.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar seus pets' });
  }
}

async function gravarVacinas(client, petId, vacinas) {
  await client.query('DELETE FROM pet_vacinas WHERE pet_id = $1', [petId]);
  if (!vacinas.length) return;
  await client.query(
    `INSERT INTO pet_vacinas (pet_id, nome, data, proxima_dose)
     SELECT $1, n, d, p FROM unnest($2::text[], $3::date[], $4::date[]) AS x(n, d, p)`,
    [petId, vacinas.map(v => v.nome), vacinas.map(v => v.data), vacinas.map(v => v.proxima_dose)]
  );
}

// POST /api/public/meus-pets — ficha inteira (4 seções + vacinas)
async function criar(req, res) {
  try {
    const ficha = validarFichaPet(req.body || {});
    if (ficha.erro) return res.status(400).json({ error: ficha.erro });
    const qtd = (await db.query('SELECT COUNT(*)::int AS n FROM pets WHERE associado_id = $1 AND ativo = true', [req.painelAssociado.id])).rows[0].n;
    if (qtd >= LIMITE_PETS_POR_CONTA) return res.status(400).json({ error: `Limite de ${LIMITE_PETS_POR_CONTA} pets por conta` });

    const id = await db.transacao(async client => {
      const v = ficha.valores;
      const r = await client.query(
        `INSERT INTO pets (associado_id, ${CAMPOS_FICHA.join(', ')})
         VALUES ($1, ${CAMPOS_FICHA.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
        [req.painelAssociado.id, ...CAMPOS_FICHA.map(c => v[c])]
      );
      await gravarVacinas(client, r.rows[0].id, ficha.vacinas);
      return r.rows[0].id;
    });
    const pets = await listarPetsCompletos(req.painelAssociado.id);
    return res.status(201).json({ pet: pets.find(p => p.id === id), pets });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar o pet' });
  }
}

// PUT /api/public/meus-pets/:id
async function atualizar(req, res) {
  try {
    const pet = await buscarPetDoDono(req.params.id, req.painelAssociado.id);
    if (!pet) return res.status(404).json({ error: 'Pet não encontrado' });
    const ficha = validarFichaPet(req.body || {});
    if (ficha.erro) return res.status(400).json({ error: ficha.erro });

    await db.transacao(async client => {
      const v = ficha.valores;
      await client.query(
        `UPDATE pets SET ${CAMPOS_FICHA.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = NOW()
         WHERE id = $${CAMPOS_FICHA.length + 1}`,
        [...CAMPOS_FICHA.map(c => v[c]), pet.id]
      );
      await gravarVacinas(client, pet.id, ficha.vacinas);
    });
    const pets = await listarPetsCompletos(req.painelAssociado.id);
    return res.json({ pet: pets.find(p => p.id === pet.id), pets });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar o pet' });
  }
}

// DELETE /api/public/meus-pets/:id — desativa (pedidos antigos continuam
// com o nome do pet); autorizações caem junto: pet "excluído" não é mais
// visível pra pet shop nenhum.
async function remover(req, res) {
  try {
    const pet = await buscarPetDoDono(req.params.id, req.painelAssociado.id);
    if (!pet) return res.status(404).json({ error: 'Pet não encontrado' });
    await db.transacao(async client => {
      await client.query('UPDATE pets SET ativo = false, updated_at = NOW() WHERE id = $1', [pet.id]);
      await client.query('UPDATE pet_autorizacoes SET revogado_em = NOW() WHERE pet_id = $1 AND revogado_em IS NULL', [pet.id]);
    });
    if (pet.foto_public_id) await cloudinaryService.deletarFoto(pet.foto_public_id);
    return res.json({ pets: await listarPetsCompletos(req.painelAssociado.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover o pet' });
  }
}

// POST /api/public/meus-pets/:id/foto (multipart "foto")
async function enviarFoto(req, res) {
  try {
    const pet = await buscarPetDoDono(req.params.id, req.painelAssociado.id);
    if (!pet) return res.status(404).json({ error: 'Pet não encontrado' });
    if (!req.file) return res.status(400).json({ error: 'Envie uma foto' });
    const { url, publicId } = await cloudinaryService.uploadFoto(req.file.buffer, `iub/pets/${req.painelAssociado.id}`, 'PRODUTO');
    await db.query('UPDATE pets SET foto_url = $1, foto_public_id = $2, updated_at = NOW() WHERE id = $3', [url, publicId, pet.id]);
    if (pet.foto_public_id) await cloudinaryService.deletarFoto(pet.foto_public_id);
    return res.json({ pets: await listarPetsCompletos(req.painelAssociado.id) });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Erro ao enviar a foto' });
  }
}

// DELETE /api/public/meus-pets/:id/autorizacoes/:parceiroId
async function revogar(req, res) {
  try {
    const pet = await buscarPetDoDono(req.params.id, req.painelAssociado.id);
    if (!pet) return res.status(404).json({ error: 'Pet não encontrado' });
    await db.query(
      'UPDATE pet_autorizacoes SET revogado_em = NOW() WHERE pet_id = $1 AND parceiro_id = $2 AND revogado_em IS NULL',
      [pet.id, req.params.parceiroId]
    );
    return res.json({ pets: await listarPetsCompletos(req.painelAssociado.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao revogar' });
  }
}

// ─── Pedidos de horário ─────────────────────────────────────────────────────

const SELECT_PEDIDO_CLIENTE = `
  SELECT ag.id, ag.pet_id, ag.pet_nome, ag.pet_resumo, ag.servico, ag.porte, ag.data, ag.periodo, ag.observacao,
         ag.preco_estimado, ag.status, ag.proposta_data, ag.proposta_periodo, ag.resposta, ag.respondido_em, ag.created_at,
         ag.fotos_publicas,
         p.nome AS parceiro_nome, p.slug AS parceiro_slug, p.whatsapp AS parceiro_whatsapp
  FROM pet_agendamentos ag JOIN sindicato_parceiros p ON p.id = ag.parceiro_id`;

// GET /api/public/meus-pets/agendamentos
async function meusPedidos(req, res) {
  try {
    const r = await db.query(`${SELECT_PEDIDO_CLIENTE} WHERE ag.associado_id = $1 ORDER BY ag.created_at DESC LIMIT 100`, [req.painelAssociado.id]);
    return res.json({ agendamentos: await anexarFotosEAvaliacoes(r.rows) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar seus pedidos' });
  }
}

// POST /api/public/meus-pets/agendamentos
// { pet_id, parceiro_slug, servico, data, periodo, observacao, compartilhar_ficha }
async function pedirHorario(req, res) {
  try {
    const b = req.body || {};
    const associadoId = req.painelAssociado.id;
    const pet = await buscarPetDoDono(b.pet_id, associadoId);
    if (!pet) return res.status(400).json({ error: 'Escolha um dos seus pets' });

    const parceiro = (await db.query(
      "SELECT id, nome, pet_servicos, pet_portes FROM sindicato_parceiros WHERE slug = $1 AND status = 'ativo'", [String(b.parceiro_slug || '')]
    )).rows[0];
    if (!parceiro) return res.status(404).json({ error: 'Pet shop não encontrado' });

    const def = SERVICOS_PET.find(s => s.codigo === b.servico);
    if (!def || def.natureza !== 'servico' || !(parceiro.pet_servicos || []).includes(def.codigo)) {
      return res.status(400).json({ error: 'Escolha um serviço que esse pet shop oferece' });
    }
    if (pet.porte && (parceiro.pet_portes || []).length && !parceiro.pet_portes.includes(pet.porte)) {
      const nomePorte = PORTES_PET.find(p => p.codigo === pet.porte)?.nome.toLowerCase();
      return res.status(400).json({ error: `Esse pet shop não atende pets de porte ${nomePorte}` });
    }
    const quando = validarDiaPeriodo(b.data, b.periodo);
    if (quando.erro) return res.status(400).json({ error: quando.erro });

    // Anti-spam: um pedido em aberto por pet + pet shop
    const aberto = (await db.query(
      "SELECT id FROM pet_agendamentos WHERE pet_id = $1 AND parceiro_id = $2 AND status IN ('pendente', 'proposta')", [pet.id, parceiro.id]
    )).rows[0];
    if (aberto) return res.status(409).json({ error: `Já tem um pedido em aberto pro ${pet.nome} nesse pet shop — espere a resposta ou cancele em Meus Pets` });

    const preco = pet.porte ? (await db.query(
      'SELECT preco FROM pet_precos WHERE parceiro_id = $1 AND servico = $2 AND porte = $3', [parceiro.id, def.codigo, pet.porte]
    )).rows[0]?.preco ?? null : null;

    const id = await db.transacao(async client => {
      const r = await client.query(
        `INSERT INTO pet_agendamentos (pet_id, associado_id, parceiro_id, servico, porte, pet_nome, pet_resumo, data, periodo, observacao, preco_estimado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [pet.id, associadoId, parceiro.id, def.codigo, pet.porte, pet.nome, resumoPet(pet), quando.data, quando.periodo,
          b.observacao ? String(b.observacao).replace(/<[^>]*>/g, '').trim().slice(0, 500) || null : null, preco]
      );
      // Consentimento LGPD: só com o "sim" explícito do dono neste pedido
      if (b.compartilhar_ficha === true) {
        await client.query(
          `INSERT INTO pet_autorizacoes (pet_id, parceiro_id) VALUES ($1, $2)
           ON CONFLICT (pet_id, parceiro_id) DO UPDATE SET autorizado_em = NOW(), revogado_em = NULL`,
          [pet.id, parceiro.id]
        );
      }
      return r.rows[0].id;
    });
    const ag = (await db.query(`${SELECT_PEDIDO_CLIENTE} WHERE ag.id = $1`, [id])).rows[0];
    const whatsappAvisado = await avisarNovoPedido({ parceiroWhatsapp: ag.parceiro_whatsapp, ag, clienteNome: primeiroNome(req.painelAssociado) });
    return res.status(201).json({ agendamento: ag, whatsapp_avisado: whatsappAvisado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar o pedido' });
  }
}

async function pedidoDoCliente(id, associadoId) {
  return (await db.query('SELECT * FROM pet_agendamentos WHERE id = $1 AND associado_id = $2', [id, associadoId])).rows[0] || null;
}

// POST /api/public/meus-pets/agendamentos/:id/aceitar — aceita a proposta do pet shop
async function aceitarProposta(req, res) {
  try {
    const ag = await pedidoDoCliente(req.params.id, req.painelAssociado.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (ag.status !== 'proposta') return res.status(409).json({ error: 'Esse pedido não tem proposta pra aceitar' });
    if (String(ag.proposta_data) < hojeSP()) return res.status(409).json({ error: 'O dia proposto já passou — faça um novo pedido' });
    await db.query(
      `UPDATE pet_agendamentos SET status = 'confirmado', data = proposta_data, periodo = proposta_periodo, updated_at = NOW() WHERE id = $1`, [ag.id]
    );
    const novo = (await db.query(`${SELECT_PEDIDO_CLIENTE} WHERE ag.id = $1`, [ag.id])).rows[0];
    const whatsappAvisado = await avisarClienteMudou({ parceiroWhatsapp: novo.parceiro_whatsapp, ag: novo, clienteNome: primeiroNome(req.painelAssociado) });
    return res.json({ agendamento: novo, whatsapp_avisado: whatsappAvisado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao aceitar a proposta' });
  }
}

// POST /api/public/meus-pets/agendamentos/:id/cancelar
async function cancelarPedido(req, res) {
  try {
    const ag = await pedidoDoCliente(req.params.id, req.painelAssociado.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!['pendente', 'proposta', 'confirmado'].includes(ag.status)) return res.status(409).json({ error: 'Esse pedido já foi encerrado' });
    await db.query("UPDATE pet_agendamentos SET status = 'cancelado', updated_at = NOW() WHERE id = $1", [ag.id]);
    const novo = (await db.query(`${SELECT_PEDIDO_CLIENTE} WHERE ag.id = $1`, [ag.id])).rows[0];
    const whatsappAvisado = await avisarClienteMudou({ parceiroWhatsapp: novo.parceiro_whatsapp, ag: novo, clienteNome: primeiroNome(req.painelAssociado) });
    return res.json({ agendamento: novo, whatsapp_avisado: whatsappAvisado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cancelar' });
  }
}

// ─── Parte 4: avaliação e fotos públicas ───────────────────────────────────

async function pedidoCompleto(id) {
  const r = await db.query(`${SELECT_PEDIDO_CLIENTE} WHERE ag.id = $1`, [id]);
  return (await anexarFotosEAvaliacoes(r.rows))[0];
}

// POST /api/public/meus-pets/agendamentos/:id/avaliar { nota 1-5, comentario }
// Só quem foi atendido: confirmado + o dia já chegou. Uma por atendimento.
async function avaliar(req, res) {
  try {
    const ag = await pedidoDoCliente(req.params.id, req.painelAssociado.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!atendimentoFeito(ag)) return res.status(409).json({ error: 'Você avalia depois do atendimento' });
    const nota = Number(req.body?.nota);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) return res.status(400).json({ error: 'Escolha de 1 a 5 estrelas' });
    const comentario = req.body?.comentario ? String(req.body.comentario).replace(/<[^>]*>/g, '').trim().slice(0, 600) || null : null;
    try {
      await db.query(
        'INSERT INTO pet_avaliacoes (agendamento_id, parceiro_id, associado_id, nota, comentario) VALUES ($1, $2, $3, $4, $5)',
        [ag.id, ag.parceiro_id, ag.associado_id, nota, comentario]
      );
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Você já avaliou esse atendimento' });
      throw e;
    }
    const novo = await pedidoCompleto(ag.id);
    const whatsappAvisado = await avisarNovaAvaliacao({ parceiroWhatsapp: novo.parceiro_whatsapp, ag: novo, nota, comentario });
    return res.status(201).json({ agendamento: novo, whatsapp_avisado: whatsappAvisado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar a avaliação' });
  }
}

// POST /api/public/meus-pets/agendamentos/:id/fotos-publicas { publicar: bool }
// Consentimento do dono pra galeria pública do pet shop.
async function definirFotosPublicas(req, res) {
  try {
    const ag = await pedidoDoCliente(req.params.id, req.painelAssociado.id);
    if (!ag) return res.status(404).json({ error: 'Pedido não encontrado' });
    await db.query('UPDATE pet_agendamentos SET fotos_publicas = $1, updated_at = NOW() WHERE id = $2', [req.body?.publicar === true, ag.id]);
    return res.json({ agendamento: await pedidoCompleto(ag.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar' });
  }
}

// ─── Parte 5: QR e atendimento realizado ───────────────────────────────────

// GET /api/public/meus-pets/:id/qr — token do QR do pet (cria na 1ª vez)
async function qrDoPet(req, res) {
  try {
    const pet = await buscarPetDoDono(req.params.id, req.painelAssociado.id);
    if (!pet) return res.status(404).json({ error: 'Pet não encontrado' });
    return res.json({ token: await tokenDoPet(pet.id), nome: pet.nome });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar o QR' });
  }
}

async function lojaPeloToken(token) {
  return (await db.query(
    "SELECT id, nome, slug, whatsapp, pet_servicos FROM sindicato_parceiros WHERE pet_qr_token = $1 AND status = 'ativo'", [String(token || '')]
  )).rows[0] || null;
}

// GET /api/public/meus-pets/loja/:token — cliente leu o QR do balcão
async function verLoja(req, res) {
  try {
    const loja = await lojaPeloToken(req.params.token);
    if (!loja) return res.status(404).json({ error: 'QR de pet shop não encontrado' });
    return res.json({
      loja: { nome: loja.nome, slug: loja.slug },
      servicos: SERVICOS_PET.filter(s => s.natureza === 'servico' && (loja.pet_servicos || []).includes(s.codigo)).map(s => ({ codigo: s.codigo, nome: s.nome, emoji: s.emoji })),
      pets: (await db.query('SELECT id, nome, especie, foto_url FROM pets WHERE associado_id = $1 AND ativo = true ORDER BY created_at', [req.painelAssociado.id])).rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao ler o QR' });
  }
}

// POST /api/public/meus-pets/atendimentos { loja_token, pet_id, servico }
// Fica aguardando a loja confirmar (só aí carimba).
async function registrarPeloQrDaLoja(req, res) {
  try {
    const b = req.body || {};
    const loja = await lojaPeloToken(b.loja_token);
    if (!loja) return res.status(404).json({ error: 'QR de pet shop não encontrado' });
    const pet = await buscarPetDoDono(b.pet_id, req.painelAssociado.id);
    if (!pet) return res.status(400).json({ error: 'Escolha um dos seus pets' });
    const def = SERVICOS_PET.find(s => s.codigo === b.servico);
    if (!def || def.natureza !== 'servico' || !(loja.pet_servicos || []).includes(def.codigo)) return res.status(400).json({ error: 'Escolha o serviço feito' });
    const r = await registrarAtendimento({ pet, parceiroId: loja.id, servico: def.codigo, origem: 'cliente_leu' });
    if (r.erro) return res.status(r.status).json({ error: r.erro });
    const whatsappAvisado = await avisarClienteRegistrou({ parceiroWhatsapp: loja.whatsapp, clienteNome: primeiroNome(req.painelAssociado), petNome: pet.nome, servico: def.codigo });
    return res.status(201).json({ atendimento: r.atendimento, loja: { nome: loja.nome }, whatsapp_avisado: whatsappAvisado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar' });
  }
}

// POST /api/public/meus-pets/atendimentos/:id/contestar — "não fui eu" (até 7 dias)
async function contestar(req, res) {
  try {
    const at = (await db.query(
      `SELECT at.*, p.whatsapp AS loja_whatsapp, pe.nome AS pet_nome FROM pet_atendimentos at
       JOIN sindicato_parceiros p ON p.id = at.parceiro_id JOIN pets pe ON pe.id = at.pet_id
       WHERE at.id = $1 AND at.associado_id = $2`, [req.params.id, req.painelAssociado.id]
    )).rows[0];
    if (!at) return res.status(404).json({ error: 'Atendimento não encontrado' });
    if (at.origem !== 'loja_leu' || at.status !== 'confirmado' || Date.now() - new Date(at.created_at).getTime() > 7 * 864e5) {
      return res.status(409).json({ error: 'Esse atendimento não pode mais ser contestado' });
    }
    const ok = await db.transacao(async client => {
      const tirou = await descarimbar(client, at.id);
      if (!tirou) return false;
      await client.query("UPDATE pet_atendimentos SET status = 'contestado' WHERE id = $1", [at.id]);
      return true;
    });
    if (!ok) return res.status(409).json({ error: 'Esse atendimento já fechou um cartão — fale com o pet shop' });
    await avisarContestado({ parceiroWhatsapp: at.loja_whatsapp, clienteNome: primeiroNome(req.painelAssociado), petNome: at.pet_nome, dia: at.dia });
    return res.json({ pets: await listarPetsCompletos(req.painelAssociado.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao contestar' });
  }
}

module.exports = {
  listar, criar, atualizar, remover, enviarFoto, revogar,
  meusPedidos, pedirHorario, aceitarProposta, cancelarPedido,
  avaliar, definirFotosPublicas,
  qrDoPet, verLoja, registrarPeloQrDaLoja, contestar,
};
