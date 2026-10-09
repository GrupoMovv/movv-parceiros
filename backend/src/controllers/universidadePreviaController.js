// "Ver como Partner" (Junior, 09/10/2026): admin e comercial_full abrem a
// Universidade com a mesma tela da Partner, inclusive o que ainda não foi
// publicado. Só leitura: nenhuma rota daqui grava progresso, quiz, aceite ou
// certificado. O quiz é corrigido com a mesma regra da Partner, sem salvar.
const db = require('../config/database');
const { lerConfig, montarQuiz, corrigirQuiz } = require('../services/universidade');

const erro = (res, err) => { console.error('[universidade prévia]', err); return res.status(500).json({ error: 'Erro interno do servidor' }); };

// último termo (publicado ou não), com o aviso de publicação
async function ultimoTermo() {
  return (await db.query(
    `SELECT versao, titulo, texto, publicado FROM universidade_documentos
      WHERE documento = 'termo_adesao' ORDER BY publicado DESC, versao DESC LIMIT 1`)).rows[0] || null;
}

async function inicio(req, res) {
  try {
    const [modulos, aulas, cfg, termo] = [
      (await db.query(`SELECT id, numero, titulo, descricao, icone, publicado FROM universidade_modulos ORDER BY ordem, numero`)).rows,
      (await db.query(`SELECT modulo_id, count(*)::int n FROM universidade_aulas GROUP BY modulo_id`)).rows,
      await lerConfig(),
      await ultimoTermo(),
    ];
    const nAulas = new Map(aulas.map(a => [a.modulo_id, a.n]));
    const lista = modulos.map(m => ({
      id: m.id, numero: m.numero, titulo: m.titulo, descricao: m.descricao, icone: m.icone,
      publicado: true, nao_publicado: !m.publicado,
      situacao: 'disponivel', aulas_total: nAulas.get(m.id) || 0, aulas_lidas: 0,
      progresso: 0, aprovado: false, prazo_atualizar: null,
    }));
    const primeiro = lista[0];
    return res.json({
      previa: true,
      nome: req.user.name,
      progresso_geral: 0,
      liberado: true,
      modulo0_lido: true,
      termo: termo ? { versao: termo.versao, titulo: termo.titulo, aceito_em: null, nao_publicado: !termo.publicado } : null,
      continuar: primeiro ? { numero: primeiro.numero, titulo: primeiro.titulo, aula_id: null } : null,
      certificado: null,
      certificado_valido: false,
      nota_minima: cfg.nota_minima,
      publicados: modulos.filter(m => m.publicado).length,
      modulos: lista,
    });
  } catch (err) { return erro(res, err); }
}

async function modulo(req, res) {
  try {
    const m = (await db.query(`SELECT * FROM universidade_modulos WHERE numero = $1`, [Number(req.params.numero)])).rows[0];
    if (!m) return res.status(404).json({ error: 'Módulo não encontrado' });
    const aulas = (await db.query(`SELECT id, ordem, titulo, video_url, publicado FROM universidade_aulas WHERE modulo_id = $1 ORDER BY ordem`, [m.id])).rows;
    const topicos = (await db.query(
      `SELECT id, aula_id, numero, titulo, texto FROM universidade_topicos WHERE aula_id = ANY($1::int[]) ORDER BY aula_id, ordem, numero`,
      [aulas.map(a => a.id)])).rows;
    const cfg = await lerConfig();
    const termo = m.numero === 0 ? await ultimoTermo() : null;
    return res.json({
      previa: true,
      id: m.id, numero: m.numero, titulo: m.titulo, descricao: m.descricao,
      nao_publicado: !m.publicado, conteudo_pendente: m.conteudo_pendente,
      aulas_total: aulas.length, aulas_lidas: 0, todas_lidas: false,
      aprovado: false, quiz_liberado: true, ultima_nota: null, nota_minima: cfg.nota_minima,
      termo: termo ? { versao: termo.versao, titulo: termo.titulo, aceito_em: null } : undefined,
      aulas: aulas.map(a => ({ ...a, nao_publicado: !a.publicado, lida_em: null, topicos: topicos.filter(t => t.aula_id === a.id) })),
    });
  } catch (err) { return erro(res, err); }
}

async function termo(req, res) {
  try {
    const t = await ultimoTermo();
    if (!t) return res.json({ publicado: false, previa: true });
    // na prévia o texto aparece mesmo despublicado, com o aviso
    return res.json({ publicado: true, previa: true, nao_publicado: !t.publicado, versao: t.versao, titulo: t.titulo, texto: t.texto, aceito_em: null });
  } catch (err) { return erro(res, err); }
}

async function perguntasDoModulo(numero) {
  const m = (await db.query(`SELECT id, numero, titulo FROM universidade_modulos WHERE numero = $1`, [Number(numero)])).rows[0];
  if (!m) return { m: null, perguntas: [] };
  const perguntas = (await db.query(
    `SELECT id, enunciado, alternativas, correta, explicacao FROM universidade_quiz_perguntas WHERE modulo_id = $1 AND ativa ORDER BY numero`, [m.id])).rows;
  return { m, perguntas };
}

async function quiz(req, res) {
  try {
    const { m, perguntas } = await perguntasDoModulo(req.params.numero);
    if (!m) return res.status(404).json({ error: 'Módulo não encontrado' });
    const cfg = await lerConfig();
    return res.json({ previa: true, modulo: { numero: m.numero, titulo: m.titulo }, nota_minima: cfg.nota_minima, perguntas: montarQuiz(perguntas) });
  } catch (err) { return erro(res, err); }
}

async function responderQuiz(req, res) {
  try {
    const { m, perguntas } = await perguntasDoModulo(req.params.numero);
    if (!m) return res.status(404).json({ error: 'Módulo não encontrado' });
    const cfg = await lerConfig();
    const r = corrigirQuiz(perguntas, req.body?.respostas, cfg.nota_minima);
    if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
    const { acertos, total, nota, aprovado, correcao } = r;
    return res.json({ previa: true, acertos, total, nota, aprovado, nota_minima: cfg.nota_minima, correcao, certificado: null });
  } catch (err) { return erro(res, err); }
}

module.exports = { inicio, modulo, termo, quiz, responderQuiz };
