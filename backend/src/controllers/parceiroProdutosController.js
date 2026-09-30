const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');
const { detectarProdutoMais18, MENSAGEM_PRODUTO_MAIS_18, verificarTermos, MENSAGEM_TERMO_PROIBIDO } = require('../config/beer');
const { limiteProdutos, planoEfetivo } = require('../config/planos');
const { limiteProdutosAtivosPf } = require('../config/vendedorPf');

const LIMITE_FOTOS_PRODUTO = 3;
const LIMITE_DESTAQUES = 3;

// Limite de produtos por plano (Master = ilimitado) — config/planos.js é a
// fonte única de verdade; aqui só resolve pro parceiro autenticado.
// Pessoa física não usa esse limite: tem limite de produtos ATIVOS por
// nível (config/vendedorPf.js), conferido em garantirVagaAtiva.
function limiteProdutosDoParceiro(parceiro) {
  if (parceiro?.tipo_pessoa === 'pf') return Infinity;
  return limiteProdutos(planoEfetivo(parceiro));
}

// Pessoa física: Casual 20 / Empreendedor 50 produtos ATIVOS (no ar ou na
// fila). Sem crescer sozinho: passou do limite, ativar um só pausando outro.
// → null (tem vaga) | mensagem de erro
async function semVagaAtiva(parceiro, excetoId = null) {
  const limite = limiteProdutosAtivosPf(parceiro);
  if (limite === null) return null;
  const r = await db.query(
    `SELECT COUNT(*)::int n FROM sindicato_parceiro_produtos
     WHERE parceiro_id = $1 AND ativo = true AND rascunho = false AND moderacao_status IN ('aprovado', 'pendente')
       AND ($2::int IS NULL OR id <> $2)`,
    [parceiro.id, excetoId]
  );
  return r.rows[0].n >= limite
    ? `Seu limite é de ${limite} produtos ativos. Pause um produto para ativar outro, ou salve este como rascunho.`
    : null;
}

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

// Vendedor pessoa física (migration 076): todo produto passa pela fila do
// admin antes de aparecer; mexer no conteúdo (texto, categoria, foto nova)
// manda de volta pra fila. CNPJ publica direto, como sempre.
const vendeComCpf = parceiro => parceiro?.tipo_pessoa === 'pf';

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
    // pessoa física: o limite que vale é o de produtos ATIVOS do nível
    const limite = limiteProdutosAtivosPf(req.parceiro) ?? limiteProdutosDoParceiro(req.parceiro);
    return res.json({ produtos: result.rows, total: result.rows.length, limite: Number.isFinite(limite) ? limite : null });
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

  // +18 (bebida alcoólica/cigarro) só pelo Disk Bebidas; droga/vape em lugar nenhum
  if (detectarProdutoMais18(nome, descricao, b.categoria, b.marca)) return { erro: MENSAGEM_PRODUTO_MAIS_18, codigo: 'PRODUTO_MAIS_18' };
  if (verificarTermos(nome, descricao, b.marca).bloqueado) return { erro: MENSAGEM_TERMO_PROIBIDO };

  const preco = parseFloat(b.preco);
  if (!Number.isFinite(preco) || preco <= 0) return { erro: 'Preço normal é obrigatório e deve ser maior que zero' };

  // Opcional. Vazio ou IGUAL ao normal = sem desconto de associado, guardado
  // como NULL: o site inteiro lê "preco_associado IS NOT NULL" como "tem
  // desconto" (selo 💎, filtro de desconto, vitrine de ofertas) e o
  // carrinho já cobra o preço normal quando é NULL — associado e cliente
  // comum pagam o mesmo. Maior que o normal nunca.
  let precoAssociado = null;
  if (b.preco_associado !== undefined && b.preco_associado !== null && b.preco_associado !== '') {
    const pa = parseFloat(b.preco_associado);
    if (!Number.isFinite(pa) || pa < 0) return { erro: 'Preço associado inválido' };
    if (pa > preco) return { erro: 'Preço associado não pode ser maior que o normal' };
    if (pa > 0 && pa < preco) precoAssociado = pa;
  }

  // Opcional (IUB Food): vazio/ausente = usa o tempo_preparo_min do restaurante.
  let tempoPreparoMin = null;
  if (b.tempo_preparo_min !== undefined && b.tempo_preparo_min !== null && b.tempo_preparo_min !== '') {
    tempoPreparoMin = parseInt(b.tempo_preparo_min, 10);
    if (!Number.isInteger(tempoPreparoMin) || tempoPreparoMin < 1 || tempoPreparoMin > 300) {
      return { erro: 'Tempo de preparo deve ser entre 1 e 300 minutos' };
    }
  }

  return {
    valores: {
      nome, descricao, preco, precoAssociado, tempoPreparoMin,
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
    const limite = limiteProdutosDoParceiro(req.parceiro);
    if (Number.isFinite(limite)) {
      const contagem = await db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1', [req.parceiro.id]);
      if (contagem.rows[0].n >= limite) {
        return res.status(400).json({ error: `Limite de ${limite} produtos atingido. Faça upgrade pra plano Master pra produtos ilimitados, ou pause/remova um produto pra cadastrar outro.` });
      }
    }

    const { erro, codigo, valores } = validarCampos(req.body);
    if (erro) return res.status(400).json({ error: erro, codigo });

    if (valores.ativo && !valores.rascunho) {
      const semVaga = await semVagaAtiva(req.parceiro);
      if (semVaga) return res.status(400).json({ error: semVaga, codigo: 'LIMITE_ATIVOS_PF' });
    }

    if (valores.destaque) {
      const destaques = await db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1 AND destaque = true', [req.parceiro.id]);
      if (destaques.rows[0].n >= LIMITE_DESTAQUES) {
        return res.status(400).json({ error: `Limite de ${LIMITE_DESTAQUES} produtos em destaque atingido` });
      }
    }

    const result = await db.query(
      `INSERT INTO sindicato_parceiro_produtos
         (parceiro_id, nome, descricao, preco, preco_associado, categoria, marca, estoque_disponivel, destaque, ativo, rascunho, tempo_preparo_min, moderacao_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.parceiro.id, valores.nome, valores.descricao, valores.preco, valores.precoAssociado, valores.categoria,
        valores.marca, valores.estoqueDisponivel, valores.destaque, valores.ativo, valores.rascunho, valores.tempoPreparoMin,
        vendeComCpf(req.parceiro) ? 'pendente' : 'aprovado']
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

    const { erro, codigo, valores } = validarCampos(req.body);
    if (erro) return res.status(400).json({ error: erro, codigo });

    const estavaAtivo = produto.ativo && !produto.rascunho;
    if (valores.ativo && !valores.rascunho && !estavaAtivo) {
      const semVaga = await semVagaAtiva(req.parceiro, produto.id);
      if (semVaga) return res.status(400).json({ error: semVaga, codigo: 'LIMITE_ATIVOS_PF' });
    }

    if (valores.destaque && !produto.destaque) {
      const destaques = await db.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiro_produtos WHERE parceiro_id = $1 AND destaque = true AND id != $2', [req.parceiro.id, produto.id]);
      if (destaques.rows[0].n >= LIMITE_DESTAQUES) {
        return res.status(400).json({ error: `Limite de ${LIMITE_DESTAQUES} produtos em destaque atingido` });
      }
    }

    // CPF: mudou o que o moderador aprovou (ou estava rejeitado) = volta pra fila.
    // Preço, estoque e pausar/ativar não reabrem (dia a dia do vendedor).
    const mudouConteudo = valores.nome !== produto.nome || valores.descricao !== produto.descricao
      || (valores.categoria || null) !== (produto.categoria || null) || (valores.marca || null) !== (produto.marca || null);
    const voltaPraFila = vendeComCpf(req.parceiro) && (mudouConteudo || produto.moderacao_status === 'rejeitado');

    const result = await db.query(
      `UPDATE sindicato_parceiro_produtos SET
         nome = $1, descricao = $2, preco = $3, preco_associado = $4, categoria = $5,
         marca = $6, estoque_disponivel = $7, destaque = $8, ativo = $9, rascunho = $10,
         tempo_preparo_min = $11,
         moderacao_status = CASE WHEN $13 THEN 'pendente' ELSE moderacao_status END,
         moderacao_motivo = CASE WHEN $13 THEN NULL ELSE moderacao_motivo END
       WHERE id = $12 RETURNING *`,
      [valores.nome, valores.descricao, valores.preco, valores.precoAssociado, valores.categoria,
        valores.marca, valores.estoqueDisponivel, valores.destaque, valores.ativo, valores.rascunho,
        // Chave ausente no body (cliente antigo/cache do PWA) mantém o valor
        // atual em vez de apagar — só um "" explícito limpa o override.
        req.body.tempo_preparo_min === undefined ? produto.tempo_preparo_min : valores.tempoPreparoMin, produto.id,
        voltaPraFila]
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

    // vai ficar ativo (estava pausado ou era rascunho): pessoa física precisa de vaga
    if (!produto.ativo || produto.rascunho) {
      const semVaga = await semVagaAtiva(req.parceiro, produto.id);
      if (semVaga) return res.status(400).json({ error: semVaga, codigo: 'LIMITE_ATIVOS_PF' });
    }

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

    // CPF: foto nova volta pra fila (reordenar/excluir não)
    const result = await db.query(
      `UPDATE sindicato_parceiro_produtos SET fotos = $1,
         moderacao_status = CASE WHEN $3 THEN 'pendente' ELSE moderacao_status END
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(fotos), produto.id, vendeComCpf(req.parceiro)]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    // detalhes/codigo vêm do cloudinaryService (ver montarErroUpload) — só
    // existem quando o erro veio de lá; ficam de bônus na resposta pra
    // debug sem precisar abrir o log do servidor toda vez.
    return res.status(502).json({
      error: err.message || 'Erro ao enviar fotos',
      detalhes: err.cloudinaryMessage,
      codigo: err.cloudinaryCode,
    });
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

// Mesmo contrato do reordenarFotos do perfil: urls na nova ordem, a
// primeira vira a principal (vitrines leem fotos[0]).
async function reordenarFotos(req, res) {
  try {
    const produto = await buscarProdutoDoParceiro(req.params.id, req.parceiro.id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const { urls } = req.body;
    if (!Array.isArray(urls)) return res.status(400).json({ error: 'urls (array) é obrigatório' });

    const fotos = produto.fotos || [];
    const porUrl = new Map(fotos.map(f => [f.url, f]));
    if (urls.length !== fotos.length || new Set(urls).size !== urls.length || !urls.every(u => porUrl.has(u))) {
      return res.status(400).json({ error: 'Lista de fotos não confere — recarregue a página' });
    }

    const reordenadas = urls.map((u, i) => ({ ...porUrl.get(u), ordem: i + 1 }));
    const result = await db.query('UPDATE sindicato_parceiro_produtos SET fotos = $1 WHERE id = $2 RETURNING *', [JSON.stringify(reordenadas), produto.id]);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reordenar fotos' });
  }
}

module.exports = { list, getOne, create, update, remover, toggleStatus, uploadFotos, deleteFoto, reordenarFotos };
