const db = require('../config/database');
const {
  limiteProdutosCatalogo, limiteProdutosBonus, limiteProdutosFechaMes, podeParticipar,
  deadlineConfirmacaoISO, passouDaDeadline, prazoEdicaoISO, passouPrazoEdicao,
  terminaEmISO, comecaEmISO, diasAte, ehHojeODiaDoEvento,
} = require('../config/fechaMes');
const { planoEfetivo } = require('../config/planos');
const { fechaMesHabilitadoGlobalmente, obterProximoEvento } = require('../services/fechaMesService');
const cloudinaryService = require('../services/cloudinaryService');

async function getProximo(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    const habilitado = await fechaMesHabilitadoGlobalmente();
    const evento = await obterProximoEvento();

    const confirmadosResult = await db.query(
      `SELECT COUNT(*) FILTER (WHERE e_produto_bonus = false)::int AS catalogo,
              COUNT(*) FILTER (WHERE e_produto_bonus = true)::int  AS bonus
       FROM sindicato_fecha_mes_produtos
       WHERE fecha_mes_id = $1 AND parceiro_id = $2 AND status = 'confirmado'`,
      [evento.id, req.parceiro.id]
    );
    const { catalogo, bonus } = confirmadosResult.rows[0];

    return res.json({
      habilitado_globalmente: habilitado,
      pode_participar: podeParticipar(plano),
      plano,
      limite_produtos: limiteProdutosFechaMes(plano), // total, só exibição
      limite_catalogo: limiteProdutosCatalogo(plano),
      limite_bonus: limiteProdutosBonus(plano),
      data_evento: evento.data_evento,
      dias_restantes: diasAte(evento.data_evento),
      comeca_em: comecaEmISO(evento.data_evento),
      termina_em: terminaEmISO(evento.data_evento),
      deadline_confirmacao: deadlineConfirmacaoISO(evento.data_evento),
      passou_deadline: passouDaDeadline(evento.data_evento),
      prazo_edicao: prazoEdicaoISO(evento.data_evento),
      passou_prazo_edicao: passouPrazoEdicao(evento.data_evento),
      ativo_hoje: habilitado && evento.ativo && ehHojeODiaDoEvento(evento.data_evento),
      produtos_confirmados: catalogo + bonus,
      produtos_confirmados_catalogo: catalogo,
      produtos_confirmados_bonus: bonus,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar próximo Fecha Mês' });
  }
}

async function getMeus(req, res) {
  try {
    const evento = await obterProximoEvento();
    const result = await db.query(
      `SELECT fmp.id, fmp.produto_id, fmp.preco_original, fmp.preco_fecha_mes, fmp.confirmado_em,
              fmp.e_produto_bonus, fmp.estoque_disponivel, fmp.status,
              COALESCE(pr.nome, fmp.bonus_nome) AS nome,
              CASE WHEN fmp.e_produto_bonus THEN fmp.bonus_descricao ELSE NULL END AS descricao,
              CASE WHEN fmp.e_produto_bonus
                THEN jsonb_build_array(jsonb_build_object('url', fmp.bonus_foto_url))
                ELSE pr.fotos END AS fotos
       FROM sindicato_fecha_mes_produtos fmp
       LEFT JOIN sindicato_parceiro_produtos pr ON pr.id = fmp.produto_id
       WHERE fmp.fecha_mes_id = $1 AND fmp.parceiro_id = $2 AND fmp.status = 'confirmado'
       ORDER BY fmp.confirmado_em ASC`,
      [evento.id, req.parceiro.id]
    );
    return res.json({
      data_evento: evento.data_evento,
      pode_editar: !passouPrazoEdicao(evento.data_evento),
      prazo_edicao: prazoEdicaoISO(evento.data_evento),
      produtos: result.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar seus produtos do Fecha Mês' });
  }
}

// Só insere linhas novas de CATÁLOGO — produto bônus tem endpoint próprio
// (criarProdutoBonus, com upload de foto). Permitido até o prazo de edição
// (3 dias antes, Feature 1) — antes disso era só até a véspera.
async function participar(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    if (!podeParticipar(plano)) return res.status(403).json({ error: 'Fecha Mês é exclusivo pra parceiros com plano ativo. Faça upgrade pra participar.' });

    const habilitado = await fechaMesHabilitadoGlobalmente();
    if (!habilitado) return res.status(403).json({ error: 'Fecha Mês está temporariamente desativado.' });

    const evento = await obterProximoEvento();
    if (!evento.ativo) return res.status(403).json({ error: 'A próxima edição do Fecha Mês foi cancelada.' });
    if (passouPrazoEdicao(evento.data_evento)) {
      return res.status(403).json({ error: 'O prazo pra adicionar produtos (3 dias antes do evento) já passou.' });
    }

    const itens = Array.isArray(req.body.produtos) ? req.body.produtos : [];
    if (itens.length === 0) return res.status(400).json({ error: 'Selecione ao menos um produto' });

    const jaConfirmadosResult = await db.query(
      `SELECT produto_id FROM sindicato_fecha_mes_produtos
       WHERE fecha_mes_id = $1 AND parceiro_id = $2 AND e_produto_bonus = false AND status = 'confirmado'`,
      [evento.id, req.parceiro.id]
    );
    const idsJaConfirmados = new Set(jaConfirmadosResult.rows.map(r => r.produto_id));

    const limite = limiteProdutosCatalogo(plano);
    const novos = itens.filter(it => !idsJaConfirmados.has(Number(it.produto_id)));
    if (idsJaConfirmados.size + novos.length > limite) {
      return res.status(400).json({ error: `Seu plano permite até ${limite} produtos do catálogo no Fecha Mês (você já tem ${idsJaConfirmados.size} confirmados).` });
    }

    const confirmados = [];
    const rejeitados = [];

    for (const item of novos) {
      const produtoId = Number(item.produto_id);
      const precoFechaMes = parseFloat(item.preco_fecha_mes);
      const estoque = item.estoque_disponivel !== undefined && item.estoque_disponivel !== '' ? parseInt(item.estoque_disponivel, 10) : null;

      const produtoResult = await db.query(
        'SELECT id, preco FROM sindicato_parceiro_produtos WHERE id = $1 AND parceiro_id = $2 AND ativo = true',
        [produtoId, req.parceiro.id]
      );
      const produto = produtoResult.rows[0];
      if (!produto) { rejeitados.push({ produto_id: produtoId, motivo: 'Produto não encontrado' }); continue; }
      if (!Number.isFinite(precoFechaMes) || precoFechaMes <= 0 || precoFechaMes >= parseFloat(produto.preco)) {
        rejeitados.push({ produto_id: produtoId, motivo: 'Preço especial precisa ser menor que o preço normal' });
        continue;
      }
      if (estoque !== null && (!Number.isFinite(estoque) || estoque <= 0)) {
        rejeitados.push({ produto_id: produtoId, motivo: 'Estoque, se informado, precisa ser maior que zero' });
        continue;
      }

      await db.query(
        `INSERT INTO sindicato_fecha_mes_produtos (fecha_mes_id, produto_id, parceiro_id, preco_original, preco_fecha_mes, estoque_disponivel)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (fecha_mes_id, produto_id) DO NOTHING`,
        [evento.id, produtoId, req.parceiro.id, produto.preco, precoFechaMes, estoque]
      );
      confirmados.push(produtoId);
    }

    return res.json({ ok: true, confirmados, rejeitados, total_confirmados: idsJaConfirmados.size + confirmados.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao confirmar participação no Fecha Mês' });
  }
}

// Cria um produto BÔNUS exclusivo da edição (não entra no catálogo normal
// — não gera linha em sindicato_parceiro_produtos). Multipart (foto
// obrigatória, preset PRODUTO — mesmo tratamento de imagem dos produtos
// normais).
async function criarProdutoBonus(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    if (!podeParticipar(plano)) return res.status(403).json({ error: 'Fecha Mês é exclusivo pra parceiros com plano ativo. Faça upgrade pra participar.' });

    const habilitado = await fechaMesHabilitadoGlobalmente();
    if (!habilitado) return res.status(403).json({ error: 'Fecha Mês está temporariamente desativado.' });

    const evento = await obterProximoEvento();
    if (!evento.ativo) return res.status(403).json({ error: 'A próxima edição do Fecha Mês foi cancelada.' });
    if (passouPrazoEdicao(evento.data_evento)) {
      return res.status(403).json({ error: 'O prazo pra adicionar produtos bônus (3 dias antes do evento) já passou.' });
    }

    const { nome, descricao, preco_original, preco_fecha_mes, estoque_disponivel } = req.body;
    if (!nome?.trim() || nome.trim().length < 3) return res.status(400).json({ error: 'Nome do produto precisa ter ao menos 3 caracteres' });
    const precoOriginal = parseFloat(preco_original);
    const precoFechaMes = parseFloat(preco_fecha_mes);
    if (!Number.isFinite(precoOriginal) || precoOriginal <= 0) return res.status(400).json({ error: 'Preço original é obrigatório' });
    if (!Number.isFinite(precoFechaMes) || precoFechaMes <= 0 || precoFechaMes >= precoOriginal) {
      return res.status(400).json({ error: 'Preço Fecha Mês precisa ser menor que o preço original' });
    }
    const estoque = estoque_disponivel !== undefined && estoque_disponivel !== '' ? parseInt(estoque_disponivel, 10) : null;
    if (estoque !== null && (!Number.isFinite(estoque) || estoque <= 0)) {
      return res.status(400).json({ error: 'Estoque, se informado, precisa ser maior que zero' });
    }
    if (!req.file) return res.status(400).json({ error: 'Foto do produto bônus é obrigatória' });

    const bonusAtuaisResult = await db.query(
      `SELECT COUNT(*)::int AS n FROM sindicato_fecha_mes_produtos
       WHERE fecha_mes_id = $1 AND parceiro_id = $2 AND e_produto_bonus = true AND status = 'confirmado'`,
      [evento.id, req.parceiro.id]
    );
    const limiteBonus = limiteProdutosBonus(plano);
    if (bonusAtuaisResult.rows[0].n >= limiteBonus) {
      return res.status(400).json({ error: `Limite de ${limiteBonus} produtos bônus por edição atingido` });
    }

    const folder = `iubmais/parceiros/${req.parceiro.id}/fecha-mes-bonus`;
    const { url, publicId } = await cloudinaryService.uploadFoto(req.file.buffer, folder, 'PRODUTO');

    const inserted = await db.query(
      `INSERT INTO sindicato_fecha_mes_produtos
         (fecha_mes_id, parceiro_id, e_produto_bonus, bonus_nome, bonus_descricao, bonus_foto_url, bonus_foto_public_id,
          preco_original, preco_fecha_mes, estoque_disponivel)
       VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [evento.id, req.parceiro.id, nome.trim(), descricao?.trim() || null, url, publicId, precoOriginal, precoFechaMes, estoque]
    );
    return res.status(201).json(inserted.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Erro ao cadastrar produto bônus', detalhes: err.cloudinaryMessage });
  }
}

// Edita preço Fecha Mês / estoque de um item já confirmado (catálogo ou
// bônus) — nunca troca o produto/tipo em si. Bloqueado depois do prazo.
async function editarProduto(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query(
      `SELECT fmp.*, fm.data_evento
       FROM sindicato_fecha_mes_produtos fmp
       JOIN sindicato_fecha_mes fm ON fm.id = fmp.fecha_mes_id
       WHERE fmp.id = $1`,
      [id]
    );
    const item = check.rows[0];
    if (!item) return res.status(404).json({ error: 'Produto não encontrado nesta edição' });
    if (item.parceiro_id !== req.parceiro.id) return res.status(403).json({ error: 'Acesso negado' });
    if (item.status !== 'confirmado') return res.status(400).json({ error: 'Este produto já foi removido da edição' });
    if (passouPrazoEdicao(item.data_evento)) {
      return res.status(403).json({ error: 'O prazo pra editar produtos (3 dias antes do evento) já passou.' });
    }

    const precoOriginal = item.e_produto_bonus && req.body.preco_original !== undefined
      ? parseFloat(req.body.preco_original)
      : parseFloat(item.preco_original);
    const precoFechaMes = req.body.preco_fecha_mes !== undefined ? parseFloat(req.body.preco_fecha_mes) : parseFloat(item.preco_fecha_mes);
    if (!Number.isFinite(precoFechaMes) || precoFechaMes <= 0 || precoFechaMes >= precoOriginal) {
      return res.status(400).json({ error: 'Preço Fecha Mês precisa ser menor que o preço original' });
    }
    let estoque = item.estoque_disponivel;
    if (req.body.estoque_disponivel !== undefined) {
      estoque = req.body.estoque_disponivel === '' || req.body.estoque_disponivel === null ? null : parseInt(req.body.estoque_disponivel, 10);
      if (estoque !== null && (!Number.isFinite(estoque) || estoque <= 0)) {
        return res.status(400).json({ error: 'Estoque, se informado, precisa ser maior que zero' });
      }
    }
    const nome = item.e_produto_bonus && req.body.nome !== undefined ? req.body.nome.trim() : item.bonus_nome;
    const descricao = item.e_produto_bonus && req.body.descricao !== undefined ? (req.body.descricao?.trim() || null) : item.bonus_descricao;
    if (item.e_produto_bonus && (!nome || nome.length < 3)) {
      return res.status(400).json({ error: 'Nome do produto precisa ter ao menos 3 caracteres' });
    }

    const result = await db.query(
      `UPDATE sindicato_fecha_mes_produtos SET
         preco_original = $1, preco_fecha_mes = $2, estoque_disponivel = $3,
         bonus_nome = $4, bonus_descricao = $5, atualizado_em = NOW()
       WHERE id = $6 RETURNING *`,
      [precoOriginal, precoFechaMes, estoque, nome, descricao, id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao editar produto' });
  }
}

// Remove (soft delete) um item confirmado — libera a vaga (catálogo ou
// bônus) pra outro produto entrar no lugar, se ainda dentro do prazo.
async function removerProduto(req, res) {
  try {
    const { id } = req.params;
    const check = await db.query(
      `SELECT fmp.*, fm.data_evento
       FROM sindicato_fecha_mes_produtos fmp
       JOIN sindicato_fecha_mes fm ON fm.id = fmp.fecha_mes_id
       WHERE fmp.id = $1`,
      [id]
    );
    const item = check.rows[0];
    if (!item) return res.status(404).json({ error: 'Produto não encontrado nesta edição' });
    if (item.parceiro_id !== req.parceiro.id) return res.status(403).json({ error: 'Acesso negado' });
    if (item.status === 'removido') return res.status(400).json({ error: 'Este produto já foi removido' });
    if (passouPrazoEdicao(item.data_evento)) {
      return res.status(403).json({ error: 'O prazo pra remover produtos (3 dias antes do evento) já passou.' });
    }

    const result = await db.query(
      `UPDATE sindicato_fecha_mes_produtos SET status = 'removido', removido_em = NOW(), atualizado_em = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    // Foto do bônus não serve mais pra nada (produto não pode ser restaurado
    // por essa rota) — apaga do Cloudinary pra não acumular lixo.
    if (item.e_produto_bonus && item.bonus_foto_public_id) {
      cloudinaryService.deletarFoto(item.bonus_foto_public_id).catch(() => {});
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover produto' });
  }
}

// Últimas 6 edições passadas + cliques recebidos naquele dia, comparado com
// a média diária do próprio parceiro nos 7 dias ANTERIORES ao evento
// (janela que não inclui outro Fecha Mês, pra comparação justa).
async function getHistorico(req, res) {
  try {
    const parceiroId = req.parceiro.id;
    const eventosResult = await db.query(
      `SELECT fm.id, fm.data_evento
       FROM sindicato_fecha_mes fm
       WHERE fm.data_evento < CURRENT_DATE
         AND EXISTS (SELECT 1 FROM sindicato_fecha_mes_produtos fmp WHERE fmp.fecha_mes_id = fm.id AND fmp.parceiro_id = $1)
       ORDER BY fm.data_evento DESC LIMIT 6`,
      [parceiroId]
    );

    const historico = [];
    for (const evento of eventosResult.rows) {
      const [produtosResult, cliquesNoDiaResult, cliquesMediaResult] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS n FROM sindicato_fecha_mes_produtos WHERE fecha_mes_id = $1 AND parceiro_id = $2 AND status = 'confirmado'`, [evento.id, parceiroId]),
        db.query(
          `SELECT COUNT(*)::int AS n FROM sindicato_parceiro_cliques
           WHERE parceiro_id = $1 AND tipo = 'clique_whatsapp' AND criado_em::date = $2`,
          [parceiroId, evento.data_evento]
        ),
        db.query(
          `SELECT COUNT(*)::int AS n FROM sindicato_parceiro_cliques
           WHERE parceiro_id = $1 AND tipo = 'clique_whatsapp'
             AND criado_em::date >= $2::date - INTERVAL '7 days' AND criado_em::date < $2::date`,
          [parceiroId, evento.data_evento]
        ),
      ]);
      historico.push({
        data_evento: evento.data_evento,
        produtos_participantes: produtosResult.rows[0].n,
        cliques_no_dia: cliquesNoDiaResult.rows[0].n,
        media_cliques_dia_normal: Math.round((cliquesMediaResult.rows[0].n / 7) * 10) / 10,
      });
    }

    return res.json({ historico });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar histórico do Fecha Mês' });
  }
}

module.exports = { getProximo, getMeus, participar, criarProdutoBonus, editarProduto, removerProduto, getHistorico };
