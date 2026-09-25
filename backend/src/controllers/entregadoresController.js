const db = require('../config/database');
const { ipCliente } = require('../utils/ipCliente');

const STATUS_VALIDOS = ['novo', 'contatado', 'aprovado', 'descartado'];
const MAX_BAIRROS = 30;

function ipDe(req) {
  return ipCliente(req);
}

// Aceita o que a máscara do front manda ("(64) 99999-8888") e também colado
// com +55. Guarda só os dígitos com DDD: 10 (fixo) ou 11 (celular).
function normalizarWhatsapp(valor) {
  let digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  if (digitos.startsWith('0')) return null;
  return digitos;
}

function normalizarBairros(valor) {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set();
  const bairros = [];
  for (const b of valor) {
    const nome = String(b || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const chave = nome.toLowerCase();
    if (!nome || vistos.has(chave)) continue;
    vistos.add(chave);
    bairros.push(nome);
    if (bairros.length >= MAX_BAIRROS) break;
  }
  return bairros;
}

// POST /api/public/entregadores/pre-cadastro — público, com rate limit.
// Mesmo WhatsApp de novo não duplica a linha: atualiza nome/moto/bairros e
// responde sucesso igual (quem reenvia o form só quer garantir que entrou).
async function criarPreCadastro(req, res) {
  const nome = String(req.body.nome || '').trim().replace(/\s+/g, ' ');
  const whatsapp = normalizarWhatsapp(req.body.whatsapp);
  const temMoto = req.body.tem_moto !== false;
  const bairros = normalizarBairros(req.body.bairros);

  if (nome.length < 3 || nome.length > 255 || !nome.includes(' ')) {
    return res.status(400).json({ error: 'Informe seu nome completo' });
  }
  if (!whatsapp) {
    return res.status(400).json({ error: 'WhatsApp inválido. Use DDD + número, ex.: (64) 99999-8888' });
  }
  if (!bairros.length) {
    return res.status(400).json({ error: 'Informe pelo menos um bairro que você atende' });
  }

  try {
    const existente = await db.query(
      'SELECT id FROM pre_cadastro_entregadores WHERE whatsapp = $1 ORDER BY criado_em LIMIT 1',
      [whatsapp]
    );
    if (existente.rows.length) {
      await db.query(
        `UPDATE pre_cadastro_entregadores SET nome = $1, tem_moto = $2, bairros = $3 WHERE id = $4`,
        [nome, temMoto, JSON.stringify(bairros), existente.rows[0].id]
      );
      return res.json({ ok: true, ja_cadastrado: true });
    }

    await db.query(
      `INSERT INTO pre_cadastro_entregadores (nome, whatsapp, tem_moto, bairros, ip_cadastro, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nome, whatsapp, temMoto, JSON.stringify(bairros), ipDe(req), String(req.headers['user-agent'] || '').slice(0, 500) || null]
    );
    return res.status(201).json({ ok: true, ja_cadastrado: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar pré-cadastro. Tente de novo.' });
  }
}

// GET /api/sindicato/entregadores/pre-cadastros — admin.
// Filtros: status, bairro (trecho, sem diferenciar maiúscula), tem_moto
// (true/false). Paginação: pagina (1..), por_pagina (máx. 100).
async function listarPreCadastros(req, res) {
  const { status, bairro, tem_moto } = req.query;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const porPagina = Math.min(100, Math.max(1, parseInt(req.query.por_pagina, 10) || 30));

  const condicoes = [];
  const params = [];
  if (status && STATUS_VALIDOS.includes(status)) {
    params.push(status);
    condicoes.push(`status = $${params.length}`);
  }
  if (tem_moto === 'true' || tem_moto === 'false') {
    params.push(tem_moto === 'true');
    condicoes.push(`tem_moto = $${params.length}`);
  }
  if (bairro && String(bairro).trim()) {
    params.push(`%${String(bairro).trim()}%`);
    condicoes.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(bairros) b WHERE b ILIKE $${params.length})`);
  }
  const whereSql = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  try {
    const total = await db.query(`SELECT COUNT(*)::int AS n FROM pre_cadastro_entregadores ${whereSql}`, params);
    const lista = await db.query(
      `SELECT id, nome, whatsapp, tem_moto, bairros, status, criado_em, contatado_em, observacoes
       FROM pre_cadastro_entregadores
       ${whereSql}
       ORDER BY criado_em DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, porPagina, (pagina - 1) * porPagina]
    );
    const porStatus = await db.query(
      `SELECT status, COUNT(*)::int AS total FROM pre_cadastro_entregadores GROUP BY status`
    );

    return res.json({
      pre_cadastros: lista.rows,
      total: total.rows[0].n,
      pagina,
      por_pagina: porPagina,
      total_paginas: Math.max(1, Math.ceil(total.rows[0].n / porPagina)),
      total_por_status: Object.fromEntries(porStatus.rows.map(r => [r.status, r.total])),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar pré-cadastros' });
  }
}

// PATCH /api/sindicato/entregadores/:id/status — admin. Muda status e/ou
// observações. contatado_em marca o PRIMEIRO contato (não sobrescreve se o
// status voltar pra contatado depois).
async function atualizarStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const temObs = Object.prototype.hasOwnProperty.call(req.body, 'observacoes');

  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'ID inválido' });
  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  if (status === undefined && !temObs) {
    return res.status(400).json({ error: 'Nada pra atualizar' });
  }

  const observacoes = temObs ? (String(req.body.observacoes || '').trim().slice(0, 2000) || null) : null;

  try {
    const result = await db.query(
      `UPDATE pre_cadastro_entregadores SET
         status = COALESCE($2, status),
         observacoes = CASE WHEN $3 THEN $4 ELSE observacoes END,
         contatado_em = CASE WHEN $2 IS NOT NULL AND $2 <> 'novo' THEN COALESCE(contatado_em, NOW()) ELSE contatado_em END
       WHERE id = $1
       RETURNING id, nome, whatsapp, tem_moto, bairros, status, criado_em, contatado_em, observacoes`,
      [id, status ?? null, temObs, observacoes]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Pré-cadastro não encontrado' });
    return res.json({ pre_cadastro: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar pré-cadastro' });
  }
}

module.exports = { criarPreCadastro, listarPreCadastros, atualizarStatus };
