const db = require('../config/database');
const { proximoFechaMes } = require('../config/fechaMes');

async function fechaMesHabilitadoGlobalmente() {
  const r = await db.query(`SELECT valor FROM sindicato_config WHERE chave = 'fecha_mes_habilitado'`);
  return r.rows[0]?.valor !== 'false';
}

async function definirHabilitadoGlobalmente(habilitado) {
  await db.query(
    `INSERT INTO sindicato_config (chave, valor, atualizado_em) VALUES ('fecha_mes_habilitado', $1, NOW())
     ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
    [habilitado ? 'true' : 'false']
  );
}

// Garante que existe uma linha em sindicato_fecha_mes pra essa data — não
// depende de cron nenhum: quem cria a linha é a primeira consulta que
// precisar dela (marketplace público, painel do parceiro ou admin), sempre
// idempotente. Nunca sobrescreve um evento já existente (respeita
// cancelamento/adiamento manual do admin).
async function garantirEvento(dataISO) {
  const existente = await db.query('SELECT * FROM sindicato_fecha_mes WHERE data_evento = $1', [dataISO]);
  if (existente.rows[0]) return existente.rows[0];
  const criado = await db.query(
    `INSERT INTO sindicato_fecha_mes (data_evento) VALUES ($1)
     ON CONFLICT (data_evento) DO NOTHING RETURNING *`,
    [dataISO]
  );
  if (criado.rows[0]) return criado.rows[0];
  // corrida rara (duas requests simultâneas criando a mesma data) — a que
  // perdeu o ON CONFLICT DO NOTHING só relê a que ganhou.
  const relido = await db.query('SELECT * FROM sindicato_fecha_mes WHERE data_evento = $1', [dataISO]);
  return relido.rows[0];
}

async function obterProximoEvento() {
  const dataISO = proximoFechaMes();
  return garantirEvento(dataISO);
}

module.exports = { fechaMesHabilitadoGlobalmente, definirHabilitadoGlobalmente, garantirEvento, obterProximoEvento };
