const db = require('../config/database');
const { ehHojeODiaDoEvento, comecaEmISO, terminaEmISO, diasAte } = require('../config/fechaMes');
const { fechaMesHabilitadoGlobalmente, obterProximoEvento } = require('../services/fechaMesService');
const relogio = require('../config/relogio');
const { lojaVisivel } = require('../utils/lojaVisivel');

// Resolve o estado do próximo evento de uma vez (evento + se está no ar
// hoje) — reaproveitado pelos três endpoints públicos abaixo.
async function resolverEstado() {
  const habilitado = await fechaMesHabilitadoGlobalmente();
  const evento = await obterProximoEvento();
  const ativoHoje = habilitado && evento.ativo && ehHojeODiaDoEvento(evento.data_evento);
  return { habilitado, evento, ativoHoje };
}

// Produtos do evento que o público vê: confirmados, de produto ativo e
// aprovado (ou bônus), de loja visível. A mesma regra serve à vitrine e à
// pergunta "tem produto?" da faixa, para as duas nunca discordarem.
const FROM_VISIVEIS = (modoQa) => `
       FROM sindicato_fecha_mes_produtos fmp
       LEFT JOIN sindicato_parceiro_produtos pr ON pr.id = fmp.produto_id
       JOIN sindicato_parceiros pa ON pa.id = fmp.parceiro_id
       WHERE fmp.fecha_mes_id = $1 AND fmp.status = 'confirmado'
         AND (fmp.e_produto_bonus = true OR (pr.ativo = true AND pr.moderacao_status = 'aprovado')) AND ${lojaVisivel(modoQa)}`;

async function getProximo(req, res) {
  try {
    const { habilitado, evento, ativoHoje } = await resolverEstado();
    // Regra do Junior (30/10/2026): faixa, slide e contagem só aparecem com
    // pelo menos 1 produto no evento (o de 30/10 abriu vazio, com a faixa
    // prometendo descontos).
    const temProdutos = (await db.query(`SELECT EXISTS (SELECT 1 ${FROM_VISIVEIS(req.modoQa)}) AS tem`, [evento.id])).rows[0].tem;
    return res.json({
      habilitado_globalmente: habilitado,
      tem_produtos: temProdutos,
      data_evento: evento.data_evento,
      dias_restantes: diasAte(evento.data_evento),
      ativo_hoje: ativoHoje,
      comeca_em: comecaEmISO(evento.data_evento),
      termina_em: terminaEmISO(evento.data_evento),
      // hora do servidor: o site acerta a contagem e a virada da meia-noite
      // por ela, mesmo com o relógio do celular adiantado ou atrasado
      agora: relogio.agora().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar próximo Fecha Mês' });
  }
}

async function getAtivo(req, res) {
  try {
    const { evento, ativoHoje } = await resolverEstado();
    return res.json({ ativo: ativoHoje, data_evento: evento.data_evento, termina_em: terminaEmISO(evento.data_evento), agora: relogio.agora().toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao verificar Fecha Mês' });
  }
}

// Vitrine especial do marketplace — só devolve produto se o evento estiver
// ativo HOJE de verdade (nunca serve preço de Fecha Mês fora da janela,
// mesmo que a linha de confirmação continue existindo no banco depois).
// Loja de teste só aparece para admin ou testador (modo QA), como no resto
// do site (utils/lojaVisivel.js).
async function getProdutos(req, res) {
  try {
    const { evento, ativoHoje } = await resolverEstado();
    if (!ativoHoje) return res.json({ produtos: [], ativo: false });

    // Bônus (e_produto_bonus) não tem linha em sindicato_parceiro_produtos
    // — usa direto os campos bonus_* da própria confirmação (LEFT JOIN +
    // COALESCE). Item de catálogo continua exigindo pr.ativo = true (se o
    // parceiro desativou o produto depois de confirmar, ele some daqui).
    const result = await db.query(
      `SELECT fmp.id AS fecha_mes_produto_id,
              fmp.produto_id AS id,
              fmp.produto_id, fmp.e_produto_bonus, fmp.estoque_disponivel,
              -- f5: estoque do evento que esgota (migration 105)
              (fmp.estoque_disponivel IS NOT NULL AND fmp.estoque_vendido >= fmp.estoque_disponivel) AS esgotado,
              fmp.preco_original, fmp.preco_fecha_mes,
              ROUND(((fmp.preco_original - fmp.preco_fecha_mes) / NULLIF(fmp.preco_original, 0)) * 100) AS desconto_pct,
              COALESCE(pr.nome, fmp.bonus_nome) AS nome,
              CASE WHEN fmp.e_produto_bonus
                THEN jsonb_build_array(jsonb_build_object('url', fmp.bonus_foto_url))
                ELSE pr.fotos END AS fotos,
              pa.nome AS parceiro_nome, pa.slug AS parceiro_slug, pa.plano${FROM_VISIVEIS(req.modoQa)}
       ORDER BY esgotado, pa.plano = 'master' DESC, desconto_pct DESC`,
      [evento.id]
    );
    return res.json({ produtos: result.rows, ativo: true, termina_em: terminaEmISO(evento.data_evento) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produtos do Fecha Mês' });
  }
}

module.exports = { getProximo, getAtivo, getProdutos };
