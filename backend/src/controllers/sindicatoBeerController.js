const db = require('../config/database');
const emailService = require('../services/emailService');

// Moderação do IUB Disk Bebidas (camada 3) — só admin (/api/sindicato-beer).
// Produto novo/editado entra 'pendente' e só vira público aqui.

const STATUS = ['pendente', 'aprovado', 'rejeitado'];

// GET /produtos?status=pendente — fila de moderação (mais antigo primeiro,
// é quem está esperando há mais tempo), com os termos sinalizados.
async function listarProdutos(req, res) {
  try {
    const status = STATUS.includes(req.query.status) ? req.query.status : 'pendente';
    const r = await db.query(
      `SELECT bp.*, bc.nome_exibicao AS categoria_nome, bc.icone AS categoria_icone, bc.regulamentada,
              pai.nome_exibicao AS grupo_nome,
              pa.nome AS parceiro_nome, pa.slug AS parceiro_slug, be.tipo AS estabelecimento_tipo
       FROM beer_produtos bp
       JOIN beer_categorias bc ON bc.codigo = bp.categoria_codigo
       LEFT JOIN beer_categorias pai ON pai.codigo = bc.categoria_pai
       JOIN beer_estabelecimentos be ON be.id = bp.estabelecimento_id
       JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
       WHERE bp.status = $1
       ORDER BY ${status === 'pendente' ? 'bp.updated_at ASC' : 'COALESCE(bp.aprovado_em, bp.updated_at) DESC'}
       LIMIT 200`,
      [status]
    );
    const contagem = await db.query(`SELECT status, COUNT(*)::int n FROM beer_produtos GROUP BY status`);
    return res.json({ produtos: r.rows, contagem: Object.fromEntries(contagem.rows.map(c => [c.status, c.n])) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar produtos' });
  }
}

// POST /moderar/:produtoId { status: 'aprovado' | 'rejeitado', motivo }
// Motivo obrigatório pra rejeitar (vai no e-mail pro parceiro). E-mail é
// "melhor esforço": falha de envio não desfaz a moderação.
async function moderar(req, res) {
  try {
    const { status } = req.body || {};
    const motivo = String(req.body?.motivo || '').trim() || null;
    if (!['aprovado', 'rejeitado'].includes(status)) return res.status(400).json({ error: 'Status deve ser aprovado ou rejeitado' });
    if (status === 'rejeitado' && !motivo) return res.status(400).json({ error: 'Informe o motivo da rejeição' });

    const r = await db.query(
      `UPDATE beer_produtos SET
         status = $1,
         motivo_rejeicao = CASE WHEN $5 THEN NULL ELSE $2 END,
         aprovado_por = CASE WHEN $5 THEN $3::int ELSE NULL END,
         aprovado_em = CASE WHEN $5 THEN NOW() ELSE NULL END,
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, motivo, req.user.id, req.params.produtoId, status === 'aprovado']
    );
    const produto = r.rows[0];
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    await db.query(
      `INSERT INTO beer_log_moderacao (tipo, estabelecimento_id, produto_id, produto_nome, produto_descricao, admin_id, motivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [status === 'aprovado' ? 'aprovacao' : 'rejeicao', produto.estabelecimento_id, produto.id, produto.nome, produto.descricao, req.user.id, motivo]
    );

    // Avisa o dono (ou o primeiro usuário ativo) da loja.
    let emailEnviado = false;
    try {
      const dono = await db.query(
        `SELECT u.email, pa.nome AS nome_fantasia
         FROM beer_estabelecimentos be
         JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
         JOIN sindicato_parceiro_usuarios u ON u.parceiro_id = pa.id AND u.ativo = true
         WHERE be.id = $1
         ORDER BY (u.cargo = 'dono') DESC, u.id ASC LIMIT 1`,
        [produto.estabelecimento_id]
      );
      if (dono.rows[0]?.email) {
        await emailService.enviarModeracaoBeer({
          email: dono.rows[0].email, nomeFantasia: dono.rows[0].nome_fantasia,
          produtoNome: produto.nome, aprovado: status === 'aprovado', motivo,
        });
        emailEnviado = true;
      }
    } catch (e) {
      console.error('[BEER] Falha ao avisar parceiro da moderação:', e.message);
    }

    return res.json({ produto, email_enviado: emailEnviado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao moderar produto' });
  }
}

// GET /log?tipo=tentativa_cadastro_proibido — trilha de compliance.
async function listarLog(req, res) {
  try {
    const params = [];
    let where = '';
    if (req.query.tipo) { params.push(req.query.tipo); where = 'WHERE l.tipo = $1'; }
    const r = await db.query(
      `SELECT l.*, pa.nome AS parceiro_nome
       FROM beer_log_moderacao l
       LEFT JOIN beer_estabelecimentos be ON be.id = l.estabelecimento_id
       LEFT JOIN sindicato_parceiros pa ON pa.id = be.parceiro_id
       ${where}
       ORDER BY l.created_at DESC LIMIT 200`,
      params
    );
    return res.json({ log: r.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar log' });
  }
}

module.exports = { listarProdutos, moderar, listarLog };
