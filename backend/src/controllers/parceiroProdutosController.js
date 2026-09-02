const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');

const LIMITE_PRODUTOS = 30;
const LIMITE_FOTOS_PRODUTO = 3;
const LIMITE_DESTAQUES = 3;

function pastaProduto(parceiroId, produtoId) {
  return `iubmais/parceiros/${parceiroId}/produtos/${produtoId}`;
}

function sanitizeText(v, maxLen) {
  if (v === undefined || v === null) return null;
  const limpo = String(v).replace(/<[^>]*>/g, '').trim();
  return limpo ? limpo.slice(0, maxLen) : null;
}

// Fotos antigas (upload local, antes do Cloudinary) não têm publicId — nesse
// caso a limpeza cai pro fs.unlink de sempre.
function removerArquivoLocalSeForCaminho(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fs.unlink(path.join(__dirname, '../..', url), () => {});
}

async function buscarProdutoDoParceiro(id, parceiroId) {
  const r = await db.query('SELECT * FROM sindicato_parceiro_produtos WHERE id = $1 AND parceiro_id = $2', [id, parceiroId]);
  return r.rows[0] || null;
}

async function list(req, res) {
  try {
    const { categoria, status, busca } = req.query;
    const condicoes = ['parceiro_id = $1'];
    const params = [req.parceiro.id];

    if (categoria) { params.push(categoria); condicoes.push(`categoria = $${params.length}`); }
    if (status === 'ativo')   condicoes.push('ativo = true AND rascunho = false');
    if (status === 'pausado') condicoes.push('ativo = false AND rascunho = false');
    if (status === 'rascunho') condicoes.push('rascunho = true');
    if (busca) { params.push(`%${busca}%`); condicoes.push(`nome ILIKE $${params.length}`); }

    const result = await db.query(
      `SELECT * FROM sindicato_parceiro_produtos WHERE ${condicoes.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return res.json({ produtos: result.rows, total: result.rows.length, limite: LIMITE_PRODUTOS });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar produtos' });
  }
}

async function getOne(req, res) {
  try {
    const produto = await buscarProdutoDoParceiro(req.params.id, req.parceiro.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(produto);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produto' });
  }
}

function validarCampos(b) {
  const nome = sanitizeText(b.nome, 100);
  if (!nome || nome.length < 3) return { erro: 'Nome precisa ter pelo menos 3 caracteres' };

  const descricao = sanitizeText(b.descricao, 500);
  if (!descricao || descricao.length < 20) return { erro: 'Descrição precisa ter pelo menos 20 caracteres' };

  const preco = parseFloat(b.preco);
  if (!Number.isFinite(preco) || preco <= 0) return { erro: 'Preço normal é obrigatório e deve ser maior que zero' };

  let precoAssociado = null;
  if (b.preco_associado !== undefined && b.preco_associado !== null && b.preco_associado !== '') {
    precoAssociado = parseFloat(b.preco_associado);
    if (!Number.isFinite(precoAssociado) || precoAssociado <= 0) return { erro: 'Preço associado inválido' };
    if (precoAssociado >= preco) return { erro: 'Preço associado deve ser menor que o preço normal' };
  }

  return {
    valores: {
      nome, descricao, preco, precoAssociado,
      categoria: sanitizeText(b.categoria, 60),
      marca: sanitizeText(b.marca, 120),
      estoqueDisponivel: b.estoque_disponivel !== false,
      destaque: b.destaque === true,
      rascunho: b.rascunho === true,
      ativo: b.rascunho === true ? false : b.ativo !== false,
    },
  };
}

async function create(req, res) {
  try {
    const contagem = await db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1', [req.parceiro.id]);
    if (contagem.rows[0].n >= LIMITE_PRODUTOS) {
      return res.status(400).json({ error: `Limite de ${LIMITE_PRODUTOS} produtos atingido. Pause ou remova um produto pra cadastrar outro.` });
    }

    const { erro, valores } = validarCampos(req.body);
    if (erro) return res.status(400).json({ error: erro });

    if (valores.destaque) {
      const destaques = await db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1 AND destaque = true', [req.parceiro.id]);
      if (destaques.rows[0].n >= LIMITE_DESTAQUES) {
        return res.status(400).json({ error: `Limite de ${LIMITE_DESTAQUES} produtos em destaque atingido` });
      }
    }

    const result = await db.query(
      `INSERT INTO sindicato_parceiro_produtos
         (parceiro_id, nome, descricao, preco, preco_associado, categoria, marca, estoque_disponivel, destaque, ativo, rascunho)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [req.parceiro.id, valores.nome, valores.descricao, valores.preco, valores.precoAssociado, valores.categoria,
        valores.marca, valores.estoqueDisponivel, valores.destaque, valores.ativo, valores.rascunho]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar produto' });
  }
}

async function update(req, res) {
  try {
    const produto = await buscarProdutoDoParceiro(req.params.id, req.parceiro.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const { erro, valores } = validarCampos(req.body);
    if (erro) return res.status(400).json({ error: erro });

    if (valores.destaque && !produto.destaque) {
      const destaques = await db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1 AND destaque = true AND id != $2', [req.parceiro.id, produto.id]);
      if (destaques.rows[0].n >= LIMITE_DESTAQUES) {
        return res.status(400).json({ error: `Limite de ${LIMITE_DESTAQUES} produtos em destaque atingido` });
      }
    }

    const result = await db.query(
      `UPDATE sindicato_parceiro_produtos SET
         nome = $1, descricao = $2, preco = $3, preco_associado = $4, categoria = $5,
         marca = $6, estoque_disponivel = $7, destaque = $8, ativo = $9, rascunho = $10
       WHERE id = $11 RETURNING *`,
      [valores.nome, valores.descricao, valores.preco, valores.precoAssociado, valores.categoria,
        valores.marca, valores.estoqueDisponivel, valores.destaque, valores.ativo, valores.rascunho, produto.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
}

async function remover(req, res) {
  try {
    const produto = await buscarProdutoDoParceiro(req.params.id, req.parceiro.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    await db.query('DELETE FROM sindicato_parceiro_produtos WHERE id = $1', [produto.id]);

    for (const foto of (produto.fotos || [])) {
      if (foto?.publicId) await cloudinaryService.deletarFoto(foto.publicId);
      else removerArquivoLocalSeForCaminho(foto?.url);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover produto' });
  }
}

async function toggleStatus(req, res) {
  try {
    const produto = await buscarProdutoDoParceiro(req.params.id, req.parceiro.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const result = await db.query(
      'UPDATE sindicato_parceiro_produtos SET ativo = $1, rascunho = false WHERE id = $2 RETURNING *',
      [!produto.ativo, produto.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao alterar status' });
  }
}

async function uploadFotos(req, res) {
  try {
    const produto = await buscarProdutoDoParceiro(req.params.id, req.parceiro.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    if (!req.files?.length) return res.status(400).json({ error: 'Envie ao menos uma imagem' });

    const fotos = produto.fotos || [];
    if (fotos.length + req.files.length > LIMITE_FOTOS_PRODUTO) {
      return res.status(400).json({ error: `Máximo de ${LIMITE_FOTOS_PRODUTO} fotos por produto` });
    }

    const folder = pastaProduto(req.parceiro.id, produto.id);
    let ordem = fotos.length ? Math.max(...fotos.map(f => f.ordem)) + 1 : 1;
    for (const file of req.files) {
      const { url, publicId } = await cloudinaryService.uploadFoto(file.buffer, folder, 'PRODUTO');
      fotos.push({ url, publicId, ordem: ordem++ });
    }

    const result = await db.query('UPDATE sindicato_parceiro_produtos SET fotos = $1 WHERE id = $2 RETURNING *', [JSON.stringify(fotos), produto.id]);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Erro ao enviar fotos' });
  }
}

async function deleteFoto(req, res) {
  try {
    const produto = await buscarProdutoDoParceiro(req.params.id, req.parceiro.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const index = parseInt(req.params.index, 10);
    const fotos = produto.fotos || [];
    if (!Number.isInteger(index) || index < 0 || index >= fotos.length) {
      return res.status(404).json({ error: 'Foto não encontrada' });
    }

    const [removida] = fotos.splice(index, 1);
    if (removida?.publicId) await cloudinaryService.deletarFoto(removida.publicId);
    else removerArquivoLocalSeForCaminho(removida?.url);

    const result = await db.query('UPDATE sindicato_parceiro_produtos SET fotos = $1 WHERE id = $2 RETURNING *', [JSON.stringify(fotos), produto.id]);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover foto' });
  }
}

module.exports = { list, getOne, create, update, remover, toggleStatus, uploadFotos, deleteFoto, LIMITE_PRODUTOS };
