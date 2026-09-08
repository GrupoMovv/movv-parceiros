const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');
const { PLANOS, planoValido, PIONEIRO_VAGAS_TOTAL } = require('../config/planos');

function quemAlterou(req) {
  return req.user?.email || req.user?.name || 'admin';
}

// --- Parceiros + troca de plano -------------------------------------------

async function listarParceiros(req, res) {
  try {
    const { plano, busca, page = '1', limit = '20' } = req.query;
    const limiteNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const paginaNum = Math.max(1, parseInt(page, 10) || 1);

    const condicoes = [];
    const params = [];
    if (plano) { params.push(plano); condicoes.push(`plano = $${params.length}`); }
    if (busca) { params.push(`%${busca}%`); condicoes.push(`(nome ILIKE $${params.length} OR slug ILIKE $${params.length})`); }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const totalResult = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_parceiros ${where}`, params);

    params.push(limiteNum, (paginaNum - 1) * limiteNum);
    const dataResult = await db.query(
      `SELECT id, slug, nome, plano, plano_ativo_desde, plano_expira_em, plano_status, e_pioneiro,
              banner_personalizado_url, instagram_username, observacoes_plano, status
       FROM sindicato_parceiros ${where}
       ORDER BY nome ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: dataResult.rows, total: totalResult.rows[0].total, page: paginaNum, limit: limiteNum });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar parceiros' });
  }
}

async function alterarPlano(req, res) {
  try {
    const { id } = req.params;
    const { plano_novo, motivo, observacoes, plano_expira_em } = req.body;

    if (!planoValido(plano_novo)) return res.status(400).json({ error: 'Plano inválido' });
    if (!motivo?.trim()) return res.status(400).json({ error: 'Motivo é obrigatório' });
    if (!['upgrade', 'downgrade', 'cancelamento', 'ativacao_seed'].includes(motivo)) {
      return res.status(400).json({ error: 'Motivo inválido' });
    }

    const atual = await db.query('SELECT plano, e_pioneiro FROM sindicato_parceiros WHERE id = $1', [id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const planoAnterior = atual.rows[0].plano;

    // Promoção Pioneiro: primeiro upgrade de Grátis pra plano pago, se ainda
    // sobrar vaga entre os primeiros PIONEIRO_VAGAS_TOTAL — vitalício, então
    // só marca uma vez (nunca desmarca num downgrade/cancelamento depois).
    let virouPioneiro = false;
    if (motivo === 'upgrade' && planoAnterior === 'gratis' && plano_novo !== 'gratis' && !atual.rows[0].e_pioneiro) {
      const contagem = await db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiros WHERE e_pioneiro = true');
      virouPioneiro = contagem.rows[0].n < PIONEIRO_VAGAS_TOTAL;
    }

    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE sindicato_parceiros
         SET plano = $1, plano_ativo_desde = NOW(), plano_expira_em = $2,
             observacoes_plano = COALESCE($3, observacoes_plano),
             e_pioneiro = e_pioneiro OR $4
         WHERE id = $5`,
        [plano_novo, plano_expira_em || null, observacoes?.trim() || null, virouPioneiro, id]
      );
      await db.query(
        `INSERT INTO sindicato_plano_historico (parceiro_id, plano_anterior, plano_novo, motivo, observacoes, alterado_por)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, planoAnterior, plano_novo, motivo, observacoes?.trim() || null, quemAlterou(req)]
      );
      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    // Preparado, não disparado ainda (ver emailService) — troca manual de
    // plano não manda email sozinha até decidirmos ativar de verdade.

    return res.json({ ok: true, plano_anterior: planoAnterior, plano_novo, virou_pioneiro: virouPioneiro });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao alterar plano' });
  }
}

async function alterarStatusPlano(req, res) {
  try {
    const { id } = req.params;
    const { status, motivo } = req.body;
    if (!['ativo', 'cancelado', 'suspenso'].includes(status)) return res.status(400).json({ error: 'Status inválido' });

    const atual = await db.query('SELECT plano, plano_status FROM sindicato_parceiros WHERE id = $1', [id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Parceiro não encontrado' });

    await db.query('BEGIN');
    try {
      await db.query('UPDATE sindicato_parceiros SET plano_status = $1 WHERE id = $2', [status, id]);
      await db.query(
        `INSERT INTO sindicato_plano_historico (parceiro_id, plano_anterior, plano_novo, motivo, observacoes, alterado_por)
         VALUES ($1, $2, $2, $3, $4, $5)`,
        [id, atual.rows[0].plano, status === 'suspenso' ? 'suspensao' : 'reativacao', motivo?.trim() || null, quemAlterou(req)]
      );
      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    return res.json({ ok: true, plano_status: status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao alterar status do plano' });
  }
}

// Instagram/observações — ajuste rápido sem passar pelo fluxo de troca de
// plano (não gera linha de histórico, não é troca de plano).
async function atualizarPerfilPlano(req, res) {
  try {
    const { id } = req.params;
    const { instagram_username, observacoes_plano } = req.body;
    const result = await db.query(
      `UPDATE sindicato_parceiros
       SET instagram_username = $1, observacoes_plano = $2
       WHERE id = $3 RETURNING id, instagram_username, observacoes_plano`,
      [instagram_username?.trim().replace(/^@/, '') || null, observacoes_plano?.trim() || null, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Parceiro não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil do plano' });
  }
}

async function uploadBanner(req, res) {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem' });

    const atual = await db.query('SELECT banner_personalizado_public_id FROM sindicato_parceiros WHERE id = $1', [id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Parceiro não encontrado' });

    const { url, publicId } = await cloudinaryService.uploadFoto(req.file.buffer, `iubmais/parceiros/${id}/banner`, 'BANNER_PARCEIRO');
    if (atual.rows[0].banner_personalizado_public_id) await cloudinaryService.deletarFoto(atual.rows[0].banner_personalizado_public_id);

    const result = await db.query(
      `UPDATE sindicato_parceiros SET banner_personalizado_url = $1, banner_personalizado_public_id = $2
       WHERE id = $3 RETURNING id, banner_personalizado_url`,
      [url, publicId, id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Erro ao enviar banner', detalhes: err.cloudinaryMessage });
  }
}

async function removerBanner(req, res) {
  try {
    const { id } = req.params;
    const atual = await db.query('SELECT banner_personalizado_public_id FROM sindicato_parceiros WHERE id = $1', [id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Parceiro não encontrado' });
    if (atual.rows[0].banner_personalizado_public_id) await cloudinaryService.deletarFoto(atual.rows[0].banner_personalizado_public_id);
    await db.query('UPDATE sindicato_parceiros SET banner_personalizado_url = NULL, banner_personalizado_public_id = NULL WHERE id = $1', [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover banner' });
  }
}

async function historico(req, res) {
  try {
    const { parceiro_id, page = '1', limit = '30' } = req.query;
    const limiteNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const paginaNum = Math.max(1, parseInt(page, 10) || 1);

    const params = [];
    let where = '';
    if (parceiro_id) { params.push(parceiro_id); where = `WHERE h.parceiro_id = $${params.length}`; }

    const totalResult = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_plano_historico h ${where}`, params);
    params.push(limiteNum, (paginaNum - 1) * limiteNum);
    const dataResult = await db.query(
      `SELECT h.*, p.nome AS parceiro_nome, p.slug AS parceiro_slug
       FROM sindicato_plano_historico h
       JOIN sindicato_parceiros p ON p.id = h.parceiro_id
       ${where}
       ORDER BY h.alterado_em DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json({ data: dataResult.rows, total: totalResult.rows[0].total, page: paginaNum, limit: limiteNum });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
}

// Config é só leitura — os limites/preços de verdade moram em código
// (config/planos.js) de propósito, pra nunca divergir do que os endpoints
// realmente enforçam. Editar isso é editar o arquivo, não uma tela.
async function config(req, res) {
  return res.json({ planos: PLANOS });
}

// --- Biblioteca Master: Lives -----------------------------------------

async function listarLivesAdmin(req, res) {
  try {
    const result = await db.query('SELECT * FROM sindicato_lives_master ORDER BY data_gravacao DESC NULLS LAST, created_at DESC');
    return res.json({ lives: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar lives' });
  }
}

function validarLive(b) {
  if (!b.titulo?.trim()) return { erro: 'Título é obrigatório' };
  if (!b.video_url?.trim()) return { erro: 'Link do vídeo é obrigatório' };
  return {
    valores: {
      titulo: b.titulo.trim().slice(0, 200),
      descricao: b.descricao?.trim() || null,
      video_url: b.video_url.trim().slice(0, 500),
      data_gravacao: b.data_gravacao || null,
      duracao_minutos: b.duracao_minutos ? parseInt(b.duracao_minutos, 10) : null,
      ativo: b.ativo !== false,
    },
  };
}

async function criarLive(req, res) {
  const { erro, valores } = validarLive(req.body);
  if (erro) return res.status(400).json({ error: erro });
  try {
    const result = await db.query(
      `INSERT INTO sindicato_lives_master (titulo, descricao, video_url, data_gravacao, duracao_minutos, ativo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [valores.titulo, valores.descricao, valores.video_url, valores.data_gravacao, valores.duracao_minutos, valores.ativo]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar live' });
  }
}

async function atualizarLive(req, res) {
  const { erro, valores } = validarLive(req.body);
  if (erro) return res.status(400).json({ error: erro });
  try {
    const result = await db.query(
      `UPDATE sindicato_lives_master SET titulo=$1, descricao=$2, video_url=$3, data_gravacao=$4, duracao_minutos=$5, ativo=$6
       WHERE id = $7 RETURNING *`,
      [valores.titulo, valores.descricao, valores.video_url, valores.data_gravacao, valores.duracao_minutos, valores.ativo, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Live não encontrada' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar live' });
  }
}

async function removerLive(req, res) {
  try {
    await db.query('DELETE FROM sindicato_lives_master WHERE id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover live' });
  }
}

// --- Biblioteca Master: Materiais ---------------------------------------
// url_conteudo é um link (Cloudinary já hospedado, Youtube, Drive etc.) —
// não existe upload de arquivo aqui de propósito: o tipo de arquivo varia
// demais (PDF, vídeo, planilha) pra um único preset de upload valer a
// pena; quem cadastra cola o link já pronto.

async function listarMateriaisAdmin(req, res) {
  try {
    const result = await db.query('SELECT * FROM sindicato_materiais_master ORDER BY created_at DESC');
    return res.json({ materiais: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar materiais' });
  }
}

function validarMaterial(b) {
  if (!b.titulo?.trim()) return { erro: 'Título é obrigatório' };
  if (!['video', 'pdf', 'template', 'ebook'].includes(b.tipo)) return { erro: 'Tipo inválido' };
  if (!['marketing', 'fotografia', 'gestao', 'precos'].includes(b.categoria)) return { erro: 'Categoria inválida' };
  if (!b.url_conteudo?.trim()) return { erro: 'Link do conteúdo é obrigatório' };
  return {
    valores: {
      titulo: b.titulo.trim().slice(0, 200),
      descricao: b.descricao?.trim() || null,
      tipo: b.tipo,
      categoria: b.categoria,
      url_conteudo: b.url_conteudo.trim().slice(0, 500),
      ativo: b.ativo !== false,
    },
  };
}

async function criarMaterial(req, res) {
  const { erro, valores } = validarMaterial(req.body);
  if (erro) return res.status(400).json({ error: erro });
  try {
    const result = await db.query(
      `INSERT INTO sindicato_materiais_master (titulo, descricao, tipo, categoria, url_conteudo, ativo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [valores.titulo, valores.descricao, valores.tipo, valores.categoria, valores.url_conteudo, valores.ativo]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar material' });
  }
}

async function atualizarMaterial(req, res) {
  const { erro, valores } = validarMaterial(req.body);
  if (erro) return res.status(400).json({ error: erro });
  try {
    const result = await db.query(
      `UPDATE sindicato_materiais_master SET titulo=$1, descricao=$2, tipo=$3, categoria=$4, url_conteudo=$5, ativo=$6
       WHERE id = $7 RETURNING *`,
      [valores.titulo, valores.descricao, valores.tipo, valores.categoria, valores.url_conteudo, valores.ativo, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Material não encontrado' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar material' });
  }
}

async function removerMaterial(req, res) {
  try {
    await db.query('DELETE FROM sindicato_materiais_master WHERE id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover material' });
  }
}

module.exports = {
  listarParceiros,
  alterarPlano,
  alterarStatusPlano,
  atualizarPerfilPlano,
  uploadBanner,
  removerBanner,
  historico,
  config,
  listarLivesAdmin,
  criarLive,
  atualizarLive,
  removerLive,
  listarMateriaisAdmin,
  criarMaterial,
  atualizarMaterial,
  removerMaterial,
};
