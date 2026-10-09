// Universidade MOVV Partner — rotas do Partner (sempre o usuário do token;
// um Partner nunca vê dados de outro). Regras em services/universidade.js.
const db = require('../config/database');
const { situacao, avaliarCertificacao, termoPublicado, lerConfig, montarQuiz, corrigirQuiz } = require('../services/universidade');

const erro = (res, err) => { console.error('[universidade]', err); return res.status(500).json({ error: 'Erro interno do servidor' }); };

// Módulo pelo número, já com a situação do Partner (null = não existe/despublicado)
async function moduloDoPartner(userId, numero) {
  const s = await situacao(userId);
  const m = s.modulos.find(x => x.numero === Number(numero) && x.publicado);
  return { s, m };
}

async function inicio(req, res) {
  try {
    await db.transacao(cx => avaliarCertificacao(cx, req.user.id));
    const s = await situacao(req.user.id);
    return res.json({
      nome: req.user.name,
      progresso_geral: s.progresso_geral,
      liberado: s.liberado,
      modulo0_lido: s.modulo0_lido,
      termo: s.termo,
      continuar: s.continuar,
      certificado: s.certificado,
      certificado_valido: s.certificado_valido,
      nota_minima: s.config.nota_minima,
      modulos: s.modulos.map(({ aulas, ...m }) => m),
    });
  } catch (err) { return erro(res, err); }
}

async function modulo(req, res) {
  try {
    const { s, m } = await moduloDoPartner(req.user.id, req.params.numero);
    if (!m) return res.status(404).json({ error: 'Módulo não encontrado' });
    if (!m.acessivel) return res.status(403).json({ error: 'Leia o Módulo 0 e aceite o termo de adesão para abrir este módulo.', codigo: 'MODULO_BLOQUEADO' });
    const topicos = (await db.query(
      `SELECT id, aula_id, numero, titulo, texto FROM universidade_topicos WHERE aula_id = ANY($1::int[]) ORDER BY aula_id, ordem, numero`,
      [m.aulas.map(a => a.id)])).rows;
    const videos = (await db.query(`SELECT id, video_url FROM universidade_aulas WHERE id = ANY($1::int[])`, [m.aulas.map(a => a.id)])).rows;
    const video = new Map(videos.map(v => [v.id, v.video_url]));
    const { aulas, ...resto } = m;
    return res.json({
      ...resto,
      nota_minima: s.config.nota_minima,
      termo: m.numero === 0 ? s.termo : undefined,
      aulas: aulas.map(a => ({ ...a, video_url: video.get(a.id) || null, topicos: topicos.filter(t => t.aula_id === a.id) })),
    });
  } catch (err) { return erro(res, err); }
}

async function marcarLida(req, res) {
  try {
    const aula = (await db.query(
      `SELECT a.id, m.numero FROM universidade_aulas a JOIN universidade_modulos m ON m.id = a.modulo_id
        WHERE a.id = $1 AND a.publicado AND m.publicado`, [req.params.id])).rows[0];
    if (!aula) return res.status(404).json({ error: 'Aula não encontrada' });
    const { m } = await moduloDoPartner(req.user.id, aula.numero);
    if (!m?.acessivel) return res.status(403).json({ error: 'Módulo bloqueado', codigo: 'MODULO_BLOQUEADO' });
    await db.query(
      `INSERT INTO universidade_progresso (user_id, aula_id) VALUES ($1, $2) ON CONFLICT (user_id, aula_id) DO NOTHING`,
      [req.user.id, aula.id]);
    const depois = (await moduloDoPartner(req.user.id, aula.numero)).m;
    return res.json({ ok: true, aulas_lidas: depois.aulas_lidas, aulas_total: depois.aulas_total, quiz_liberado: depois.quiz_liberado });
  } catch (err) { return erro(res, err); }
}

async function termo(req, res) {
  try {
    const t = await termoPublicado();
    if (!t) return res.json({ publicado: false });
    const aceite = (await db.query(
      `SELECT aceito_em FROM universidade_aceites WHERE user_id = $1 AND documento = 'termo_adesao' AND versao = $2`,
      [req.user.id, t.versao])).rows[0];
    return res.json({ publicado: true, versao: t.versao, titulo: t.titulo, texto: t.texto, aceito_em: aceite?.aceito_em || null });
  } catch (err) { return erro(res, err); }
}

async function aceitar(req, res) {
  try {
    const t = await termoPublicado();
    if (!t) return res.status(409).json({ error: 'O termo de adesão ainda não foi publicado.', codigo: 'TERMO_NAO_PUBLICADO' });
    if (Number(req.body?.versao) !== t.versao) {
      return res.status(409).json({ error: 'O termo foi atualizado. Recarregue a página e leia a versão nova.', codigo: 'TERMO_DESATUALIZADO' });
    }
    if (req.body?.concordo !== true) return res.status(400).json({ error: 'Marque a caixa de confirmação para aceitar o termo.' });
    const s = await situacao(req.user.id);
    if (!s.modulo0_lido) return res.status(409).json({ error: 'Leia todas as aulas do Módulo 0 antes de aceitar o termo.', codigo: 'MODULO0_NAO_LIDO' });
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 64) || null;
    const r = await db.query(
      `INSERT INTO universidade_aceites (user_id, documento, versao, ip, user_agent) VALUES ($1, 'termo_adesao', $2, $3, $4)
       ON CONFLICT (user_id, documento, versao) DO NOTHING RETURNING aceito_em`,
      [req.user.id, t.versao, ip, String(req.headers['user-agent'] || '').slice(0, 500) || null]);
    return res.json({ ok: true, ja_aceito: !r.rows[0], versao: t.versao });
  } catch (err) { return erro(res, err); }
}

async function quiz(req, res) {
  try {
    const { m } = await moduloDoPartner(req.user.id, req.params.numero);
    if (!m) return res.status(404).json({ error: 'Módulo não encontrado' });
    if (!m.quiz_liberado) return res.status(403).json({ error: 'Marque todas as aulas do módulo como lidas para fazer o quiz.', codigo: 'QUIZ_BLOQUEADO' });
    const perguntas = (await db.query(
      `SELECT id, enunciado, alternativas FROM universidade_quiz_perguntas WHERE modulo_id = $1 AND ativa`, [m.id])).rows;
    const cfg = await lerConfig();
    // ordem nova a cada tentativa; vai só id e texto (o gabarito fica no servidor)
    return res.json({
      modulo: { numero: m.numero, titulo: m.titulo },
      nota_minima: cfg.nota_minima,
      perguntas: montarQuiz(perguntas),
    });
  } catch (err) { return erro(res, err); }
}

async function responderQuiz(req, res) {
  try {
    const { m } = await moduloDoPartner(req.user.id, req.params.numero);
    if (!m) return res.status(404).json({ error: 'Módulo não encontrado' });
    if (!m.quiz_liberado) return res.status(403).json({ error: 'Quiz bloqueado', codigo: 'QUIZ_BLOQUEADO' });
    const perguntas = (await db.query(
      `SELECT id, enunciado, alternativas, correta, explicacao FROM universidade_quiz_perguntas WHERE modulo_id = $1 AND ativa ORDER BY numero`, [m.id])).rows;
    const cfg = await lerConfig();
    const r = corrigirQuiz(perguntas, req.body?.respostas, cfg.nota_minima);
    if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
    const { acertos, total, nota, aprovado, correcao } = r;

    const certificado = await db.transacao(async cx => {
      await cx.query(
        `INSERT INTO universidade_quiz_tentativas (user_id, modulo_id, versao_conteudo, acertos, total, nota, aprovado, respostas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [req.user.id, m.id, m.versao_conteudo, acertos, total, nota.toFixed(4), aprovado,
          JSON.stringify(r.respostas)]);
      return aprovado ? avaliarCertificacao(cx, req.user.id) : null;
    });
    return res.json({ acertos, total, nota, aprovado, nota_minima: cfg.nota_minima, correcao, certificado });
  } catch (err) { return erro(res, err); }
}

async function certificado(req, res) {
  try {
    await db.transacao(cx => avaliarCertificacao(cx, req.user.id));
    const s = await situacao(req.user.id);
    if (!s.certificado) return res.status(404).json({ error: 'Você ainda não tem certificado.' });
    const p = (await db.query('SELECT name, code FROM partners WHERE id = $1', [req.user.id])).rows[0];
    return res.json({ ...s.certificado, nome: p.name, partner_code: p.code, valido: s.certificado_valido });
  } catch (err) { return erro(res, err); }
}

module.exports = { inicio, modulo, marcarLida, termo, aceitar, quiz, responderQuiz, certificado };
