const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// /api/admin/testadores — acesso de testador (migration 086). Só admin.
// A marca vale 30 dias e desliga sozinha (testador_ate); cada ação fica em
// testador_registros com o admin que fez.
const DIAS = 30;
router.use(authenticate, requireAdmin);

const COLS = `a.id, a.nome_completo, a.cpf, a.whatsapp, a.email, a.tipo_acesso, a.testador_ate,
  (a.testador_ate > NOW()) AS testador_ativo,
  (SELECT json_build_object('acao', r.acao, 'em', r.em, 'por', p.name)
     FROM testador_registros r LEFT JOIN partners p ON p.id = r.por_partner_id
    WHERE r.associado_id = a.id ORDER BY r.em DESC LIMIT 1) AS ultimo_registro`;

// GET /?q=nome|cpf|whatsapp — testadores ativos + resultado da busca
router.get('/', async (req, res) => {
  try {
    const ativos = (await db.query(`SELECT ${COLS} FROM sindicato_associados a WHERE a.testador_ate > NOW() ORDER BY a.testador_ate`)).rows;
    const q = String(req.query.q || '').trim().slice(0, 80);
    let busca = [];
    if (q.length >= 3) {
      const digitos = q.replace(/\D/g, '');
      busca = (await db.query(
        `SELECT ${COLS} FROM sindicato_associados a
         WHERE a.nome_completo ILIKE $1 OR ($2 <> '' AND (a.cpf = $2 OR a.whatsapp LIKE '%' || $2))
         ORDER BY a.nome_completo LIMIT 20`,
        [`%${q}%`, digitos.length >= 8 ? digitos : '']
      )).rows;
    }
    return res.json({ ativos, busca, dias: DIAS });
  } catch (err) {
    console.error('[testadores]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar testadores' });
  }
});

async function mudar(req, res, ligar) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Conta inválida' });
  try {
    const r = await db.transacao(async c => {
      const u = await c.query(
        `UPDATE sindicato_associados SET testador_ate = ${ligar ? `NOW() + make_interval(days => ${DIAS})` : 'NULL'}
         WHERE id = $1 RETURNING id, testador_ate`, [id]);
      if (!u.rows[0]) return null;
      await c.query('INSERT INTO testador_registros (associado_id, acao, ate, por_partner_id) VALUES ($1, $2, $3, $4)',
        [id, ligar ? 'ligou' : 'desligou', u.rows[0].testador_ate, req.user?.id || null]);
      return u.rows[0];
    });
    if (!r) return res.status(404).json({ error: 'Conta não encontrada' });
    return res.json({ ok: true, testador_ate: r.testador_ate });
  } catch (err) {
    console.error('[testadores]', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar' });
  }
}
router.post('/:id/ligar', (req, res) => mudar(req, res, true));
router.post('/:id/desligar', (req, res) => mudar(req, res, false));

module.exports = router;
