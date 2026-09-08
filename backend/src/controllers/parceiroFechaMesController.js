const db = require('../config/database');
const { limiteProdutosFechaMes, podeParticipar, deadlineConfirmacaoISO, passouDaDeadline, terminaEmISO, comecaEmISO, diasAte, ehHojeODiaDoEvento } = require('../config/fechaMes');
const { planoEfetivo } = require('../config/planos');
const { fechaMesHabilitadoGlobalmente, obterProximoEvento } = require('../services/fechaMesService');

async function getProximo(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    const habilitado = await fechaMesHabilitadoGlobalmente();
    const evento = await obterProximoEvento();

    const confirmadosResult = await db.query(
      `SELECT COUNT(*)::int AS n FROM sindicato_fecha_mes_produtos WHERE fecha_mes_id = $1 AND parceiro_id = $2`,
      [evento.id, req.parceiro.id]
    );

    return res.json({
      habilitado_globalmente: habilitado,
      pode_participar: podeParticipar(plano),
      plano,
      limite_produtos: limiteProdutosFechaMes(plano),
      data_evento: evento.data_evento,
      dias_restantes: diasAte(evento.data_evento),
      comeca_em: comecaEmISO(evento.data_evento),
      termina_em: terminaEmISO(evento.data_evento),
      deadline_confirmacao: deadlineConfirmacaoISO(evento.data_evento),
      passou_deadline: passouDaDeadline(evento.data_evento),
      ativo_hoje: habilitado && evento.ativo && ehHojeODiaDoEvento(evento.data_evento),
      produtos_confirmados: confirmadosResult.rows[0].n,
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
              pr.nome, pr.fotos
       FROM sindicato_fecha_mes_produtos fmp
       JOIN sindicato_parceiro_produtos pr ON pr.id = fmp.produto_id
       WHERE fmp.fecha_mes_id = $1 AND fmp.parceiro_id = $2
       ORDER BY fmp.confirmado_em ASC`,
      [evento.id, req.parceiro.id]
    );
    return res.json({ data_evento: evento.data_evento, produtos: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar seus produtos do Fecha Mês' });
  }
}

// Só insere linhas novas — produto já confirmado antes não pode ser
// alterado/removido por aqui (regra explícita: depois de confirmar, não
// muda mais). Reenviar um produto_id já confirmado simplesmente não faz
// nada com ele (fica de fora de `confirmados`, não é erro).
async function participar(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    if (!podeParticipar(plano)) return res.status(403).json({ error: 'Fecha Mês é exclusivo pra planos pagos. Faça upgrade pra participar.' });

    const habilitado = await fechaMesHabilitadoGlobalmente();
    if (!habilitado) return res.status(403).json({ error: 'Fecha Mês está temporariamente desativado.' });

    const evento = await obterProximoEvento();
    if (!evento.ativo) return res.status(403).json({ error: 'A próxima edição do Fecha Mês foi cancelada.' });
    if (passouDaDeadline(evento.data_evento)) {
      return res.status(403).json({ error: 'O prazo pra confirmar participação (quinta-feira 23:59) já passou.' });
    }

    const itens = Array.isArray(req.body.produtos) ? req.body.produtos : [];
    if (itens.length === 0) return res.status(400).json({ error: 'Selecione ao menos um produto' });

    const jaConfirmadosResult = await db.query(
      `SELECT produto_id FROM sindicato_fecha_mes_produtos WHERE fecha_mes_id = $1 AND parceiro_id = $2`,
      [evento.id, req.parceiro.id]
    );
    const idsJaConfirmados = new Set(jaConfirmadosResult.rows.map(r => r.produto_id));

    const limite = limiteProdutosFechaMes(plano);
    const novos = itens.filter(it => !idsJaConfirmados.has(Number(it.produto_id)));
    if (idsJaConfirmados.size + novos.length > limite) {
      return res.status(400).json({ error: `Seu plano permite até ${limite} produtos no Fecha Mês (você já tem ${idsJaConfirmados.size} confirmados).` });
    }

    const confirmados = [];
    const rejeitados = [];

    for (const item of novos) {
      const produtoId = Number(item.produto_id);
      const precoFechaMes = parseFloat(item.preco_fecha_mes);

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

      await db.query(
        `INSERT INTO sindicato_fecha_mes_produtos (fecha_mes_id, produto_id, parceiro_id, preco_original, preco_fecha_mes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (fecha_mes_id, produto_id) DO NOTHING`,
        [evento.id, produtoId, req.parceiro.id, produto.preco, precoFechaMes]
      );
      confirmados.push(produtoId);
    }

    return res.json({ ok: true, confirmados, rejeitados, total_confirmados: idsJaConfirmados.size + confirmados.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao confirmar participação no Fecha Mês' });
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
        db.query('SELECT COUNT(*)::int AS n FROM sindicato_fecha_mes_produtos WHERE fecha_mes_id = $1 AND parceiro_id = $2', [evento.id, parceiroId]),
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

module.exports = { getProximo, getMeus, participar, getHistorico };
