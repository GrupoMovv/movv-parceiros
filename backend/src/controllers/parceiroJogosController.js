const db = require('../config/database');
const { planoEfetivo, beneficios, limiteJogos } = require('../config/planos');

const JOGO_TIPO = 'roleta'; // único jogo da Fase 1 — Tigrinho do Bem/Raspadinha entram em fases futuras

async function getConfig(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    const cfg = beneficios(plano);

    const configResult = await db.query(
      'SELECT * FROM sindicato_jogos_parceiros WHERE parceiro_id = $1 AND jogo_tipo = $2',
      [req.parceiro.id, JOGO_TIPO]
    );

    const hojeResult = await db.query(
      `SELECT
         COUNT(*)::int AS distribuidos_hoje,
         COUNT(*) FILTER (WHERE status = 'usado')::int AS usados_hoje
       FROM sindicato_cupons_roleta
       WHERE parceiro_id = $1 AND jogo_tipo = $2 AND jogado_em::date = NOW()::date`,
      [req.parceiro.id, JOGO_TIPO]
    );

    const totalResult = await db.query(
      `SELECT
         COUNT(*)::int AS distribuidos_total,
         COUNT(*) FILTER (WHERE status = 'usado')::int AS usados_total
       FROM sindicato_cupons_roleta
       WHERE parceiro_id = $1 AND jogo_tipo = $2`,
      [req.parceiro.id, JOGO_TIPO]
    );

    const { distribuidos_total, usados_total } = totalResult.rows[0];
    const taxaResgate = distribuidos_total > 0 ? Math.round((usados_total / distribuidos_total) * 1000) / 10 : 0;

    return res.json({
      plano,
      pode_ativar: limiteJogos(plano) > 0,
      max_jogos: limiteJogos(plano) === Infinity ? null : limiteJogos(plano),
      config: configResult.rows[0] || null,
      analytics: {
        cupons_distribuidos_hoje: hojeResult.rows[0].distribuidos_hoje,
        cupons_usados_hoje: hojeResult.rows[0].usados_hoje,
        cupons_distribuidos_total: distribuidos_total,
        cupons_usados_total: usados_total,
        taxa_resgate_percentual: taxaResgate,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar configuração dos jogos' });
  }
}

async function salvarConfig(req, res) {
  try {
    const plano = planoEfetivo(req.parceiro);
    const max = limiteJogos(plano);
    if (max <= 0) {
      return res.status(403).json({ error: 'Seu plano atual não participa dos Joguinhos IUB MAIS+. Fale com o Sindicato pra fazer upgrade.' });
    }

    const { ativo, desconto_percentual, cupons_dia, validade_dias } = req.body;

    const desconto = Number(desconto_percentual);
    const cupons = Number(cupons_dia);
    const validade = Number(validade_dias);
    if (!Number.isInteger(desconto) || desconto < 5 || desconto > 50) {
      return res.status(400).json({ error: 'Desconto deve ser um número inteiro entre 5 e 50' });
    }
    if (!Number.isInteger(cupons) || cupons < 1 || cupons > 20) {
      return res.status(400).json({ error: 'Cupons por dia deve ser um número inteiro entre 1 e 20' });
    }
    if (!Number.isInteger(validade) || validade < 1 || validade > 30) {
      return res.status(400).json({ error: 'Validade deve ser um número inteiro entre 1 e 30 dias' });
    }

    // max_jogos conta jogos DIFERENTES ativos ao mesmo tempo — como só a
    // Roleta existe na Fase 1, isso só bloqueia mesmo o plano Grátis (já
    // barrado acima); fica pronto pra quando Tigrinho/Raspadinha existirem.
    if (ativo) {
      const outrosAtivos = await db.query(
        `SELECT COUNT(*)::int AS total FROM sindicato_jogos_parceiros
         WHERE parceiro_id = $1 AND ativo = true AND jogo_tipo != $2`,
        [req.parceiro.id, JOGO_TIPO]
      );
      if (outrosAtivos.rows[0].total >= max) {
        return res.status(403).json({ error: `Seu plano permite no máximo ${max} jogo(s) ativo(s) ao mesmo tempo.` });
      }
    }

    const pesoSorteio = ativo ? beneficios(plano).peso_roleta : 0;

    const result = await db.query(
      `INSERT INTO sindicato_jogos_parceiros
         (parceiro_id, jogo_tipo, ativo, desconto_percentual, cupons_dia, validade_dias, peso_sorteio, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (parceiro_id, jogo_tipo) DO UPDATE SET
         ativo = EXCLUDED.ativo,
         desconto_percentual = EXCLUDED.desconto_percentual,
         cupons_dia = EXCLUDED.cupons_dia,
         validade_dias = EXCLUDED.validade_dias,
         peso_sorteio = EXCLUDED.peso_sorteio,
         updated_at = NOW()
       RETURNING *`,
      [req.parceiro.id, JOGO_TIPO, Boolean(ativo), desconto, cupons, validade, pesoSorteio]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar configuração dos jogos' });
  }
}

module.exports = { getConfig, salvarConfig };
