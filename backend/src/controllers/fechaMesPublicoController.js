const db = require('../config/database');
const { ehHojeODiaDoEvento, comecaEmISO, terminaEmISO, diasAte } = require('../config/fechaMes');
const { fechaMesHabilitadoGlobalmente, obterProximoEvento } = require('../services/fechaMesService');

// Resolve o estado do próximo evento de uma vez (evento + se está no ar
// hoje) — reaproveitado pelos três endpoints públicos abaixo.
async function resolverEstado() {
  const habilitado = await fechaMesHabilitadoGlobalmente();
  const evento = await obterProximoEvento();
  const ativoHoje = habilitado && evento.ativo && ehHojeODiaDoEvento(evento.data_evento);
  return { habilitado, evento, ativoHoje };
}

async function getProximo(req, res) {
  try {
    const { habilitado, evento, ativoHoje } = await resolverEstado();
    return res.json({
      habilitado_globalmente: habilitado,
      data_evento: evento.data_evento,
      dias_restantes: diasAte(evento.data_evento),
      ativo_hoje: ativoHoje,
      comeca_em: comecaEmISO(evento.data_evento),
      termina_em: terminaEmISO(evento.data_evento),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar próximo Fecha Mês' });
  }
}

async function getAtivo(req, res) {
  try {
    const { evento, ativoHoje } = await resolverEstado();
    return res.json({ ativo: ativoHoje, data_evento: evento.data_evento, termina_em: terminaEmISO(evento.data_evento) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao verificar Fecha Mês' });
  }
}

// Vitrine especial do marketplace — só devolve produto se o evento estiver
// ativo HOJE de verdade (nunca serve preço de Fecha Mês fora da janela,
// mesmo que a linha de confirmação continue existindo no banco depois).
async function getProdutos(req, res) {
  try {
    const { evento, ativoHoje } = await resolverEstado();
    if (!ativoHoje) return res.json({ produtos: [], ativo: false });

    const result = await db.query(
      `SELECT fmp.produto_id AS id, fmp.preco_original, fmp.preco_fecha_mes,
              ROUND(((fmp.preco_original - fmp.preco_fecha_mes) / NULLIF(fmp.preco_original, 0)) * 100) AS desconto_pct,
              pr.nome, pr.fotos,
              pa.nome AS parceiro_nome, pa.slug AS parceiro_slug, pa.plano
       FROM sindicato_fecha_mes_produtos fmp
       JOIN sindicato_parceiro_produtos pr ON pr.id = fmp.produto_id
       JOIN sindicato_parceiros pa ON pa.id = fmp.parceiro_id
       WHERE fmp.fecha_mes_id = $1 AND pr.ativo = true AND pa.status = 'ativo'
       ORDER BY pa.plano = 'master' DESC, desconto_pct DESC`,
      [evento.id]
    );
    return res.json({ produtos: result.rows, ativo: true, termina_em: terminaEmISO(evento.data_evento) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar produtos do Fecha Mês' });
  }
}

module.exports = { getProximo, getAtivo, getProdutos };
