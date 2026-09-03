const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');

// "Ativas" pra fim de limite de plano = publicadas, ligadas e ainda não
// encerradas (programadas contam também — já estão "reservando vaga").
const LIMITE_POR_PLANO = { gratis: 3, oficial: 10, premium: 20, master: Infinity };
const LABEL_PLANO = { gratis: 'Grátis', oficial: 'Oficial', premium: 'Premium', master: 'Master' };

const STATUS_SQL = `
  CASE
    WHEN pm.rascunho THEN 'rascunho'
    WHEN NOT pm.ativo THEN 'pausada'
    WHEN pm.data_inicio > NOW() THEN 'programada'
    WHEN pm.data_fim < NOW() THEN 'expirada'
    WHEN pm.limite_usos IS NOT NULL AND pm.usos_atuais >= pm.limite_usos THEN 'esgotada'
    ELSE 'ativa'
  END
`;

const FILTRO_STATUS = {
  ativa:      `pm.rascunho = false AND pm.ativo = true AND pm.data_inicio <= NOW() AND (pm.data_fim IS NULL OR pm.data_fim >= NOW()) AND (pm.limite_usos IS NULL OR pm.usos_atuais < pm.limite_usos)`,
  programada: `pm.rascunho = false AND pm.ativo = true AND pm.data_inicio > NOW()`,
  expirada:   `pm.rascunho = false AND pm.ativo = true AND pm.data_fim < NOW()`,
  pausada:    `pm.rascunho = false AND pm.ativo = false`,
  rascunho:   `pm.rascunho = true`,
};

function sanitizeText(v, maxLen) {
  if (v === undefined || v === null) return null;
  const limpo = String(v).replace(/<[^>]*>/g, '').trim();
  return limpo ? limpo.slice(0, maxLen) : null;
}

function pastaPromocao(parceiroId, promocaoId) {
  return `iubmais/parceiros/${parceiroId}/promocoes/${promocaoId}`;
}

async function contarAtivas(parceiroId, excluirId = null) {
  const params = [parceiroId];
  let sql = `SELECT COUNT(*)::int AS n FROM sindicato_parceiro_promocoes
             WHERE parceiro_id = $1 AND ativo = true AND rascunho = false
               AND (data_fim IS NULL OR data_fim >= NOW())`;
  if (excluirId) {
    params.push(excluirId);
    sql += ` AND id != $${params.length}`;
  }
  const r = await db.query(sql, params);
  return r.rows[0].n;
}

function limiteDoPlano(plano) {
  return LIMITE_POR_PLANO[plano] ?? LIMITE_POR_PLANO.gratis;
}

async function buscarPromocaoDoParceiro(id, parceiroId) {
  const r = await db.query('SELECT * FROM sindicato_parceiro_promocoes WHERE id = $1 AND parceiro_id = $2', [id, parceiroId]);
  return r.rows[0] || null;
}

async function list(req, res) {
  try {
    const { status } = req.query;
    const condicoes = ['pm.parceiro_id = $1'];
    const params = [req.parceiro.id];

    if (status && FILTRO_STATUS[status]) condicoes.push(FILTRO_STATUS[status]);

    const result = await db.query(
      `SELECT pm.*, ${STATUS_SQL} AS status_calculado,
              pr.nome AS produto_nome, pr.fotos AS produto_fotos,
              COALESCE(pm.foto_url, pr.fotos->0->>'url') AS foto_resolvida,
              COALESCE(st.visualizacoes, 0)::int AS visualizacoes,
              COALESCE(st.cliques, 0)::int AS cliques_whatsapp
       FROM sindicato_parceiro_promocoes pm
       LEFT JOIN sindicato_parceiro_produtos pr ON pr.id = pm.produto_id
       LEFT JOIN (
         SELECT promocao_id,
                COUNT(*) FILTER (WHERE tipo = 'ver_promocao') AS visualizacoes,
                COUNT(*) FILTER (WHERE tipo = 'clique_whatsapp') AS cliques
         FROM sindicato_parceiro_cliques WHERE promocao_id IS NOT NULL GROUP BY promocao_id
       ) st ON st.promocao_id = pm.id
       WHERE ${condicoes.join(' AND ')}
       ORDER BY pm.created_at DESC`,
      params
    );

    const atuais = await contarAtivas(req.parceiro.id);
    const limite = limiteDoPlano(req.parceiro.plano);

    return res.json({
      promocoes: result.rows,
      ativas: atuais,
      limite: limite === Infinity ? null : limite,
      plano: req.parceiro.plano,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar promoções' });
  }
}

async function getOne(req, res) {
  try {
    const promocao = await buscarPromocaoDoParceiro(req.params.id, req.parceiro.id);
    if (!promocao) return res.status(404).json({ error: 'Promoção não encontrada' });
    return res.json(promocao);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar promoção' });
  }
}

async function validarCampos(b, parceiroId) {
  const titulo = sanitizeText(b.titulo, 200);
  if (!titulo || titulo.length < 3) return { erro: 'Título precisa ter pelo menos 3 caracteres' };

  const precoDe = parseFloat(b.preco_de);
  if (!Number.isFinite(precoDe) || precoDe <= 0) return { erro: 'Preço "De" é obrigatório e deve ser maior que zero' };

  const precoPor = parseFloat(b.preco_por);
  if (!Number.isFinite(precoPor) || precoPor <= 0) return { erro: 'Preço "Por" é obrigatório e deve ser maior que zero' };
  if (precoPor >= precoDe) return { erro: 'Preço "Por" precisa ser menor que o preço "De"' };

  let precoAssociado = null;
  if (b.preco_associado !== undefined && b.preco_associado !== null && b.preco_associado !== '') {
    precoAssociado = parseFloat(b.preco_associado);
    if (!Number.isFinite(precoAssociado) || precoAssociado <= 0) return { erro: 'Preço associado inválido' };
    if (precoAssociado >= precoPor) return { erro: 'Preço associado precisa ser menor que o preço promocional' };
  }

  const dataInicio = b.data_inicio ? new Date(b.data_inicio) : null;
  const dataFim = b.data_fim ? new Date(b.data_fim) : null;
  if (!dataInicio || Number.isNaN(dataInicio.getTime())) return { erro: 'Data de início inválida' };
  if (!dataFim || Number.isNaN(dataFim.getTime())) return { erro: 'Data de término inválida' };
  if (dataFim <= dataInicio) return { erro: 'Data de término precisa ser depois da data de início' };

  let limiteUsos = null;
  if (b.limite_usos !== undefined && b.limite_usos !== null && b.limite_usos !== '') {
    limiteUsos = parseInt(b.limite_usos, 10);
    if (!Number.isInteger(limiteUsos) || limiteUsos <= 0) return { erro: 'Limite de usos inválido' };
  }

  let produtoId = null;
  if (b.produto_id !== undefined && b.produto_id !== null && b.produto_id !== '') {
    produtoId = parseInt(b.produto_id, 10);
    const produto = await db.query('SELECT id FROM sindicato_parceiro_produtos WHERE id = $1 AND parceiro_id = $2', [produtoId, parceiroId]);
    if (!produto.rows[0]) return { erro: 'Produto vinculado não encontrado' };
  }

  return {
    valores: {
      titulo,
      descricao: sanitizeText(b.descricao, 500),
      categoria: sanitizeText(b.categoria, 60),
      produtoId,
      precoDe, precoPor, precoAssociado,
      dataInicio, dataFim, limiteUsos,
      destaque: b.destaque === true,
      exclusivoAssociado: b.exclusivo_associado === true,
      rascunho: b.rascunho === true,
      ativo: b.rascunho === true ? false : b.ativo !== false,
    },
  };
}

async function create(req, res) {
  try {
    const { erro, valores } = await validarCampos(req.body, req.parceiro.id);
    if (erro) return res.status(400).json({ error: erro });

    if (valores.ativo && !valores.rascunho) {
      const limite = limiteDoPlano(req.parceiro.plano);
      const atuais = await contarAtivas(req.parceiro.id);
      if (atuais >= limite) {
        return res.status(400).json({
          error: `Você atingiu o limite de ${limite} promoções ativas do plano ${LABEL_PLANO[req.parceiro.plano] || 'Grátis'}. Pause uma promoção ou faça upgrade de plano.`,
          limite_atingido: true,
        });
      }
    }

    const result = await db.query(
      `INSERT INTO sindicato_parceiro_promocoes
        (parceiro_id, produto_id, titulo, descricao, categoria, preco_de, preco_por, preco_associado,
         data_inicio, data_fim, limite_usos, destaque, exclusivo_associado, ativo, rascunho)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        req.parceiro.id, valores.produtoId, valores.titulo, valores.descricao, valores.categoria,
        valores.precoDe, valores.precoPor, valores.precoAssociado,
        valores.dataInicio, valores.dataFim, valores.limiteUsos,
        valores.destaque, valores.exclusivoAssociado, valores.ativo, valores.rascunho,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar promoção' });
  }
}

async function update(req, res) {
  try {
    const promocao = await buscarPromocaoDoParceiro(req.params.id, req.parceiro.id);
    if (!promocao) return res.status(404).json({ error: 'Promoção não encontrada' });

    const { erro, valores } = await validarCampos(req.body, req.parceiro.id);
    if (erro) return res.status(400).json({ error: erro });

    const estavaAtivaPublicada = promocao.ativo && !promocao.rascunho;
    const vaiFicarAtivaPublicada = valores.ativo && !valores.rascunho;
    if (vaiFicarAtivaPublicada && !estavaAtivaPublicada) {
      const limite = limiteDoPlano(req.parceiro.plano);
      const atuais = await contarAtivas(req.parceiro.id, promocao.id);
      if (atuais >= limite) {
        return res.status(400).json({
          error: `Você atingiu o limite de ${limite} promoções ativas do plano ${LABEL_PLANO[req.parceiro.plano] || 'Grátis'}. Pause uma promoção ou faça upgrade de plano.`,
          limite_atingido: true,
        });
      }
    }

    const result = await db.query(
      `UPDATE sindicato_parceiro_promocoes SET
         produto_id = $1, titulo = $2, descricao = $3, categoria = $4,
         preco_de = $5, preco_por = $6, preco_associado = $7,
         data_inicio = $8, data_fim = $9, limite_usos = $10,
         destaque = $11, exclusivo_associado = $12, ativo = $13, rascunho = $14, updated_at = NOW()
       WHERE id = $15 RETURNING *`,
      [
        valores.produtoId, valores.titulo, valores.descricao, valores.categoria,
        valores.precoDe, valores.precoPor, valores.precoAssociado,
        valores.dataInicio, valores.dataFim, valores.limiteUsos,
        valores.destaque, valores.exclusivoAssociado, valores.ativo, valores.rascunho, promocao.id,
      ]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar promoção' });
  }
}

async function remover(req, res) {
  try {
    const promocao = await buscarPromocaoDoParceiro(req.params.id, req.parceiro.id);
    if (!promocao) return res.status(404).json({ error: 'Promoção não encontrada' });

    await db.query('DELETE FROM sindicato_parceiro_promocoes WHERE id = $1', [promocao.id]);
    if (promocao.foto_public_id) await cloudinaryService.deletarFoto(promocao.foto_public_id);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover promoção' });
  }
}

// Pausar/ativar — igual ao toggle de produto, ligar sempre "publica" (tira
// do rascunho). Ativar entra na conta do limite do plano.
async function toggleStatus(req, res) {
  try {
    const promocao = await buscarPromocaoDoParceiro(req.params.id, req.parceiro.id);
    if (!promocao) return res.status(404).json({ error: 'Promoção não encontrada' });

    const vaiAtivar = !promocao.ativo;
    if (vaiAtivar) {
      const limite = limiteDoPlano(req.parceiro.plano);
      const atuais = await contarAtivas(req.parceiro.id, promocao.id);
      if (atuais >= limite) {
        return res.status(400).json({
          error: `Você atingiu o limite de ${limite} promoções ativas do plano ${LABEL_PLANO[req.parceiro.plano] || 'Grátis'}. Pause uma promoção ou faça upgrade de plano.`,
          limite_atingido: true,
        });
      }
    }

    const result = await db.query(
      'UPDATE sindicato_parceiro_promocoes SET ativo = $1, rascunho = false, updated_at = NOW() WHERE id = $2 RETURNING *',
      [vaiAtivar, promocao.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao alterar status' });
  }
}

// Duplica sempre como rascunho, sem foto_public_id (a foto de origem
// continua pertencendo só à promoção original — se ela for excluída, a
// imagem no Cloudinary some, mas a duplicata mantém a URL antiga
// funcionando até o parceiro trocar/reenviar a foto).
async function duplicar(req, res) {
  try {
    const promocao = await buscarPromocaoDoParceiro(req.params.id, req.parceiro.id);
    if (!promocao) return res.status(404).json({ error: 'Promoção não encontrada' });

    const result = await db.query(
      `INSERT INTO sindicato_parceiro_promocoes
        (parceiro_id, produto_id, titulo, descricao, foto_url, categoria, preco_de, preco_por, preco_associado,
         data_inicio, data_fim, limite_usos, destaque, exclusivo_associado, ativo, rascunho)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,true)
       RETURNING *`,
      [
        promocao.parceiro_id, promocao.produto_id, `${promocao.titulo} (cópia)`, promocao.descricao,
        promocao.foto_url, promocao.categoria, promocao.preco_de, promocao.preco_por, promocao.preco_associado,
        promocao.data_inicio, promocao.data_fim, promocao.limite_usos, promocao.destaque, promocao.exclusivo_associado,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao duplicar promoção' });
  }
}

async function uploadFoto(req, res) {
  try {
    const promocao = await buscarPromocaoDoParceiro(req.params.id, req.parceiro.id);
    if (!promocao) return res.status(404).json({ error: 'Promoção não encontrada' });
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem' });

    const folder = pastaPromocao(req.parceiro.id, promocao.id);
    const { url, publicId } = await cloudinaryService.uploadFoto(req.file.buffer, folder, 'PRODUTO');

    if (promocao.foto_public_id) await cloudinaryService.deletarFoto(promocao.foto_public_id);

    const result = await db.query(
      'UPDATE sindicato_parceiro_promocoes SET foto_url = $1, foto_public_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [url, publicId, promocao.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(502).json({
      error: err.message || 'Erro ao enviar foto',
      detalhes: err.cloudinaryMessage,
      codigo: err.cloudinaryCode,
    });
  }
}

module.exports = { list, getOne, create, update, remover, toggleStatus, duplicar, uploadFoto, LIMITE_POR_PLANO, LABEL_PLANO };
