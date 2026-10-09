// Universidade MOVV Partner — administração (admin completo e comercial_full;
// requireAdminUniversidade). Progresso dos Partners, cadastro e acesso,
// conteúdo (módulos, aulas, tópicos, perguntas), termo e configuração.
// Toda alteração fica em admin_acoes (quem e quando).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const emailService = require('../services/emailService');
const { registrarAcao, registrarLote } = require('../services/registroAdmin');
const { situacao, lerConfig } = require('../services/universidade');

const NIVEIS = ['mobile', 'point', 'hub', 'regional'];
const erro = (res, err) => { console.error('[universidade admin]', err); return res.status(500).json({ error: 'Erro interno do servidor' }); };
const texto = v => (typeof v === 'string' ? v.trim() : '');

function senhaProvisoria() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(10), b => abc[b % abc.length]).join('');
}

// ---------- Progresso ----------

async function progresso(req, res) {
  try {
    const partners = (await db.query(
      `SELECT id, code, name, email, whatsapp, nivel_partner, is_active, must_change_password, created_at
         FROM partners WHERE type = 'movv_partner' ORDER BY name`)).rows;
    const config = await lerConfig();
    const ultima = (await db.query(
      `SELECT user_id, MAX(em) AS em FROM (
         SELECT user_id, lida_em AS em FROM universidade_progresso
         UNION ALL SELECT user_id, criado_em FROM universidade_quiz_tentativas
         UNION ALL SELECT user_id, aceito_em FROM universidade_aceites) x
       GROUP BY user_id`)).rows;
    const ultimaEm = new Map(ultima.map(u => [u.user_id, u.em]));
    const linhas = [];
    for (const p of partners) {
      const s = await situacao(p.id, db, { config });
      const atual = s.modulos.find(m => m.publicado && !m.aprovado) || null;
      linhas.push({
        ...p,
        progresso_geral: s.progresso_geral,
        modulo_atual: atual ? { numero: atual.numero, titulo: atual.titulo, situacao: atual.situacao } : null,
        termo_aceito_em: s.termo?.aceito_em || null,
        ultima_atividade: ultimaEm.get(p.id) || null,
        notas: s.modulos.filter(m => m.tentativas).map(m => ({
          numero: m.numero, melhor: m.melhor_nota, ultima: m.ultima_nota, tentativas: m.tentativas, aprovado: m.aprovado,
        })),
        certificado: s.certificado, certificado_valido: s.certificado_valido,
      });
    }
    return res.json({ config, partners: linhas });
  } catch (err) { return erro(res, err); }
}

async function detalhePartner(req, res) {
  try {
    const p = (await db.query(
      `SELECT id, code, name, email, whatsapp, nivel_partner, is_active, must_change_password, created_at
         FROM partners WHERE id = $1 AND type = 'movv_partner'`, [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Partner não encontrado' });
    const s = await situacao(p.id);
    const [tentativas, aceites, certificados] = await Promise.all([
      db.query(`SELECT t.id, m.numero, t.acertos, t.total, t.nota, t.aprovado, t.versao_conteudo, t.criado_em
                  FROM universidade_quiz_tentativas t JOIN universidade_modulos m ON m.id = t.modulo_id
                 WHERE t.user_id = $1 ORDER BY t.criado_em DESC`, [p.id]),
      db.query(`SELECT documento, versao, aceito_em, ip, user_agent FROM universidade_aceites WHERE user_id = $1 ORDER BY aceito_em DESC`, [p.id]),
      db.query(`SELECT codigo, nivel, emitido_em, valido_ate, status FROM universidade_certificacoes WHERE user_id = $1 ORDER BY emitido_em DESC`, [p.id]),
    ]);
    return res.json({
      partner: p, progresso_geral: s.progresso_geral, liberado: s.liberado, certificado_valido: s.certificado_valido,
      modulos: s.modulos.map(({ aulas, ...m }) => m),
      tentativas: tentativas.rows, aceites: aceites.rows, certificados: certificados.rows,
    });
  } catch (err) { return erro(res, err); }
}

// ---------- Cadastro e acesso ----------

// E-mail ou WhatsApp já usado em qualquer conta do portal deixaria o login ambíguo.
async function contatoEmUso(email, whatsapp, ignorarPartnerId = null) {
  const r = await db.query(
    `SELECT 'colaborador interno' AS onde FROM internal_collaborators WHERE email = $1 OR ($2 <> '' AND whatsapp = $2)
     UNION ALL SELECT 'parceiro ' || code FROM partners WHERE (email = $1 OR ($2 <> '' AND whatsapp = $2)) AND id IS DISTINCT FROM $3
     UNION ALL SELECT 'indicador' FROM indicators WHERE email = $1 OR ($2 <> '' AND whatsapp = $2)
     LIMIT 1`, [email, whatsapp, ignorarPartnerId]);
  return r.rows[0]?.onde || null;
}

function lerCadastro(body) {
  const name = texto(body?.name);
  const email = texto(body?.email).toLowerCase();
  const whatsapp = texto(body?.whatsapp).replace(/\D/g, '');
  const nivel = body?.nivel_partner ? texto(body.nivel_partner).toLowerCase() : null;
  if (!name || !email) return { erro: 'Nome e e-mail são obrigatórios.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'E-mail inválido.' };
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) return { erro: 'WhatsApp inválido (DDD + número).' };
  if (nivel && !NIVEIS.includes(nivel)) return { erro: 'Nível inválido (Mobile, Point, Hub ou Regional).' };
  return { name, email, whatsapp, nivel };
}

async function criarPartner(req, res) {
  const c = lerCadastro(req.body);
  if (c.erro) return res.status(400).json({ error: c.erro });
  try {
    const emUso = await contatoEmUso(c.email, c.whatsapp);
    if (emUso) return res.status(409).json({ error: `E-mail ou WhatsApp já usado por ${emUso}.` });
    const senha = senhaProvisoria();
    const hash = await bcrypt.hash(senha, 10);
    const partner = await db.transacao(async cx => {
      await cx.query(`SELECT pg_advisory_xact_lock(hashtext('universidade_codigo_partner'))`);
      const n = (await cx.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS n
           FROM partners WHERE code LIKE 'PARTNER-%'`)).rows[0].n;
      const code = `PARTNER-${String(n).padStart(3, '0')}`;
      const p = (await cx.query(
        `INSERT INTO partners (code, name, email, password_hash, type, whatsapp, nivel_partner, is_admin, must_change_password)
         VALUES ($1, $2, $3, $4, 'movv_partner', $5, $6, false, true)
         RETURNING id, code, name, email, whatsapp, nivel_partner, is_active, created_at`,
        [code, c.name, c.email, hash, c.whatsapp || null, c.nivel])).rows[0];
      await registrarAcao(cx, req, 'universidade_partner_criado', 'partners', p.id, { code, nivel: c.nivel });
      return p;
    });
    const email = await emailService.enviarAcessoUniversidade({ nome: partner.name, email: partner.email, codigo: partner.code, senha })
      .then(() => 'enviado').catch(err => { console.error('[EMAIL]', err.message); return 'falhou'; });
    // a senha provisória volta uma única vez, para o admin repassar se o e-mail não chegar
    return res.status(201).json({ partner, senha_provisoria: senha, email });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
    return erro(res, err);
  }
}

async function editarPartner(req, res) {
  const c = lerCadastro(req.body);
  if (c.erro) return res.status(400).json({ error: c.erro });
  try {
    const existe = (await db.query(`SELECT id FROM partners WHERE id = $1 AND type = 'movv_partner'`, [req.params.id])).rows[0];
    if (!existe) return res.status(404).json({ error: 'Partner não encontrado' });
    const emUso = await contatoEmUso(c.email, c.whatsapp, existe.id);
    if (emUso) return res.status(409).json({ error: `E-mail ou WhatsApp já usado por ${emUso}.` });
    const p = await db.transacao(async cx => {
      const r = (await cx.query(
        `UPDATE partners SET name = $2, email = $3, whatsapp = $4, nivel_partner = $5, is_active = $6
          WHERE id = $1 RETURNING id, code, name, email, whatsapp, nivel_partner, is_active`,
        [existe.id, c.name, c.email, c.whatsapp || null, c.nivel, req.body?.is_active !== false])).rows[0];
      await registrarAcao(cx, req, 'universidade_partner_editado', 'partners', existe.id,
        { nivel: c.nivel, ativo: r.is_active });
      return r;
    });
    return res.json(p);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
    return erro(res, err);
  }
}

async function redefinirAcesso(req, res) {
  try {
    const p = (await db.query(`SELECT id, code, name, email FROM partners WHERE id = $1 AND type = 'movv_partner'`, [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Partner não encontrado' });
    const senha = senhaProvisoria();
    const hash = await bcrypt.hash(senha, 10);
    await db.transacao(async cx => {
      await cx.query(`UPDATE partners SET password_hash = $2, must_change_password = true WHERE id = $1`, [p.id, hash]);
      await registrarAcao(cx, req, 'universidade_acesso_redefinido', 'partners', p.id);
    });
    const email = await emailService.enviarAcessoUniversidade({ nome: p.name, email: p.email, codigo: p.code, senha, redefinido: true })
      .then(() => 'enviado').catch(err => { console.error('[EMAIL]', err.message); return 'falhou'; });
    return res.json({ ok: true, senha_provisoria: senha, email });
  } catch (err) { return erro(res, err); }
}

// ---------- Conteúdo ----------

async function conteudo(req, res) {
  try {
    const [modulos, aulas, topicos, perguntas, documentos, config] = await Promise.all([
      db.query(`SELECT * FROM universidade_modulos ORDER BY ordem, numero`),
      db.query(`SELECT * FROM universidade_aulas ORDER BY modulo_id, ordem`),
      db.query(`SELECT * FROM universidade_topicos ORDER BY aula_id, ordem, numero`),
      db.query(`SELECT * FROM universidade_quiz_perguntas ORDER BY modulo_id, numero`),
      db.query(`SELECT * FROM universidade_documentos ORDER BY documento, versao DESC`),
      lerConfig(),
    ]);
    return res.json({
      config,
      documentos: documentos.rows,
      modulos: modulos.rows.map(m => ({
        ...m,
        aulas: aulas.rows.filter(a => a.modulo_id === m.id).map(a => ({ ...a, topicos: topicos.rows.filter(t => t.aula_id === a.id) })),
        perguntas: perguntas.rows.filter(p => p.modulo_id === m.id),
      })),
    });
  } catch (err) { return erro(res, err); }
}

async function editarModulo(req, res) {
  try {
    const m = (await db.query(`SELECT * FROM universidade_modulos WHERE id = $1`, [req.params.id])).rows[0];
    if (!m) return res.status(404).json({ error: 'Módulo não encontrado' });
    const b = req.body || {};
    const publicado = b.publicado === undefined ? m.publicado : Boolean(b.publicado);
    if (publicado && !m.publicado && m.conteudo_pendente) {
      return res.status(409).json({ error: `O Módulo ${m.numero} ainda não tem conteúdo e fica despublicado.` });
    }
    if (publicado && !m.publicado) {
      const n = (await db.query(`SELECT count(*)::int n FROM universidade_quiz_perguntas WHERE modulo_id = $1 AND ativa`, [m.id])).rows[0].n;
      if (!n) return res.status(409).json({ error: 'O módulo precisa de perguntas ativas no quiz antes de ser publicado.' });
    }
    const r = await db.transacao(async cx => {
      const linha = (await cx.query(
        `UPDATE universidade_modulos SET titulo = $2, descricao = $3, icone = $4, publicado = $5,
                publicado_em = CASE WHEN $5 AND publicado_em IS NULL THEN NOW() ELSE publicado_em END, atualizado_em = NOW()
          WHERE id = $1 RETURNING *`,
        [m.id, texto(b.titulo) || m.titulo, b.descricao === undefined ? m.descricao : (texto(b.descricao) || null),
          b.icone === undefined ? m.icone : (texto(b.icone) || null), publicado])).rows[0];
      if (publicado !== m.publicado) {
        await registrarAcao(cx, req, publicado ? 'universidade_modulo_publicado' : 'universidade_modulo_despublicado', 'universidade_modulos', m.id, { numero: m.numero });
      } else {
        await registrarAcao(cx, req, 'universidade_modulo_editado', 'universidade_modulos', m.id, { numero: m.numero });
      }
      return linha;
    });
    return res.json(r);
  } catch (err) { return erro(res, err); }
}

// "Mudança relevante": só este módulo volta a pendente (refazer o quiz), com o
// prazo de atualização para quem já é certificado.
async function mudancaRelevante(req, res) {
  try {
    const r = await db.transacao(async cx => {
      const m = (await cx.query(
        `UPDATE universidade_modulos SET exige_recertificacao = true, versao_conteudo = versao_conteudo + 1,
                recertificar_desde = NOW(), atualizado_em = NOW()
          WHERE id = $1 RETURNING *`, [req.params.id])).rows[0];
      if (!m) return null;
      await registrarAcao(cx, req, 'universidade_mudanca_relevante', 'universidade_modulos', m.id,
        { numero: m.numero, versao: m.versao_conteudo, motivo: texto(req.body?.motivo) || null });
      return m;
    });
    if (!r) return res.status(404).json({ error: 'Módulo não encontrado' });
    return res.json(r);
  } catch (err) { return erro(res, err); }
}

async function criarAula(req, res) {
  try {
    const titulo = texto(req.body?.titulo);
    if (!titulo) return res.status(400).json({ error: 'Título da aula é obrigatório.' });
    const r = await db.transacao(async cx => {
      const m = (await cx.query(`SELECT id, numero FROM universidade_modulos WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
      if (!m) return null;
      const ordem = (await cx.query(`SELECT COALESCE(MAX(ordem), 0) + 1 AS o FROM universidade_aulas WHERE modulo_id = $1`, [m.id])).rows[0].o;
      const a = (await cx.query(
        `INSERT INTO universidade_aulas (modulo_id, ordem, titulo, video_url) VALUES ($1, $2, $3, $4) RETURNING *`,
        [m.id, ordem, titulo, texto(req.body?.video_url) || null])).rows[0];
      await registrarAcao(cx, req, 'universidade_aula_criada', 'universidade_aulas', a.id, { modulo: m.numero, titulo });
      return a;
    });
    if (!r) return res.status(404).json({ error: 'Módulo não encontrado' });
    return res.status(201).json({ ...r, topicos: [] });
  } catch (err) { return erro(res, err); }
}

async function editarAula(req, res) {
  try {
    const b = req.body || {};
    const r = await db.transacao(async cx => {
      const a = (await cx.query(`SELECT * FROM universidade_aulas WHERE id = $1`, [req.params.id])).rows[0];
      if (!a) return null;
      const linha = (await cx.query(
        `UPDATE universidade_aulas SET titulo = $2, video_url = $3, publicado = $4, atualizado_em = NOW() WHERE id = $1 RETURNING *`,
        [a.id, texto(b.titulo) || a.titulo, b.video_url === undefined ? a.video_url : (texto(b.video_url) || null),
          b.publicado === undefined ? a.publicado : Boolean(b.publicado)])).rows[0];
      await registrarAcao(cx, req, 'universidade_aula_editada', 'universidade_aulas', a.id);
      return linha;
    });
    if (!r) return res.status(404).json({ error: 'Aula não encontrada' });
    return res.json(r);
  } catch (err) { return erro(res, err); }
}

async function excluirAula(req, res) {
  try {
    const r = await db.transacao(async cx => {
      const a = (await cx.query(`DELETE FROM universidade_aulas WHERE id = $1 RETURNING id, titulo, modulo_id`, [req.params.id])).rows[0];
      if (a) await registrarAcao(cx, req, 'universidade_aula_excluida', 'universidade_aulas', a.id, { titulo: a.titulo, modulo_id: a.modulo_id });
      return a;
    });
    if (!r) return res.status(404).json({ error: 'Aula não encontrada' });
    return res.json({ ok: true });
  } catch (err) { return erro(res, err); }
}

async function criarTopico(req, res) {
  try {
    const titulo = texto(req.body?.titulo);
    const corpo = texto(req.body?.texto);
    if (!titulo || !corpo) return res.status(400).json({ error: 'Título e texto do tópico são obrigatórios.' });
    const r = await db.transacao(async cx => {
      const a = (await cx.query(`SELECT id FROM universidade_aulas WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
      if (!a) return null;
      const n = (await cx.query(`SELECT COALESCE(MAX(numero), 0) + 1 AS n, COALESCE(MAX(ordem), 0) + 1 AS o FROM universidade_topicos WHERE aula_id = $1`, [a.id])).rows[0];
      const t = (await cx.query(
        `INSERT INTO universidade_topicos (aula_id, numero, titulo, texto, ordem) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [a.id, n.n, titulo, corpo, n.o])).rows[0];
      await registrarAcao(cx, req, 'universidade_topico_criado', 'universidade_topicos', t.id);
      return t;
    });
    if (!r) return res.status(404).json({ error: 'Aula não encontrada' });
    return res.status(201).json(r);
  } catch (err) { return erro(res, err); }
}

async function editarTopico(req, res) {
  try {
    const b = req.body || {};
    const r = await db.transacao(async cx => {
      const t = (await cx.query(`SELECT * FROM universidade_topicos WHERE id = $1`, [req.params.id])).rows[0];
      if (!t) return null;
      const titulo = texto(b.titulo) || t.titulo;
      const corpo = b.texto === undefined ? t.texto : texto(b.texto);
      if (!corpo) throw Object.assign(new Error('vazio'), { status: 400 });
      const linha = (await cx.query(
        `UPDATE universidade_topicos SET titulo = $2, texto = $3, atualizado_em = NOW() WHERE id = $1 RETURNING *`,
        [t.id, titulo, corpo])).rows[0];
      await registrarAcao(cx, req, 'universidade_topico_editado', 'universidade_topicos', t.id);
      return linha;
    });
    if (!r) return res.status(404).json({ error: 'Tópico não encontrado' });
    return res.json(r);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: 'O texto do tópico não pode ficar vazio.' });
    return erro(res, err);
  }
}

async function excluirTopico(req, res) {
  try {
    const r = await db.transacao(async cx => {
      const t = (await cx.query(`DELETE FROM universidade_topicos WHERE id = $1 RETURNING id, titulo`, [req.params.id])).rows[0];
      if (t) await registrarAcao(cx, req, 'universidade_topico_excluido', 'universidade_topicos', t.id, { titulo: t.titulo });
      return t;
    });
    if (!r) return res.status(404).json({ error: 'Tópico não encontrado' });
    return res.json({ ok: true });
  } catch (err) { return erro(res, err); }
}

// Pergunta: enunciado, textos das alternativas (por id), qual é a certa (id),
// explicação e ativa. Os ids das alternativas não mudam.
async function editarPergunta(req, res) {
  try {
    const b = req.body || {};
    const p = (await db.query(`SELECT * FROM universidade_quiz_perguntas WHERE id = $1`, [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Pergunta não encontrada' });
    const textos = new Map((Array.isArray(b.alternativas) ? b.alternativas : []).map(a => [a.id, texto(a.texto)]));
    const alternativas = p.alternativas.map(a => ({ id: a.id, texto: textos.get(a.id) || a.texto }));
    const correta = b.correta === undefined ? p.correta : String(b.correta);
    if (!alternativas.some(a => a.id === correta)) return res.status(400).json({ error: 'A alternativa certa precisa ser uma das alternativas.' });
    if (new Set(alternativas.map(a => a.texto)).size !== alternativas.length) return res.status(400).json({ error: 'Há alternativas com o mesmo texto.' });
    const r = await db.transacao(async cx => {
      const linha = (await cx.query(
        `UPDATE universidade_quiz_perguntas SET enunciado = $2, alternativas = $3, correta = $4, explicacao = $5, ativa = $6
          WHERE id = $1 RETURNING *`,
        [p.id, texto(b.enunciado) || p.enunciado, JSON.stringify(alternativas), correta,
          b.explicacao === undefined ? p.explicacao : (texto(b.explicacao) || null), b.ativa === undefined ? p.ativa : Boolean(b.ativa)])).rows[0];
      await registrarAcao(cx, req, 'universidade_pergunta_editada', 'universidade_quiz_perguntas', p.id,
        p.correta !== correta ? { correta_trocada: true } : null);
      return linha;
    });
    return res.json(r);
  } catch (err) { return erro(res, err); }
}

// ---------- Termo de adesão ----------

// Salva o texto: se a última versão ainda não foi publicada, atualiza ela;
// se já foi, cria a versão seguinte (despublicada). Aceites ficam por versão.
async function salvarTermo(req, res) {
  const titulo = texto(req.body?.titulo);
  const corpo = texto(req.body?.texto);
  if (!titulo || !corpo) return res.status(400).json({ error: 'Título e texto do termo são obrigatórios.' });
  try {
    const r = await db.transacao(async cx => {
      const ult = (await cx.query(
        `SELECT * FROM universidade_documentos WHERE documento = 'termo_adesao' ORDER BY versao DESC LIMIT 1 FOR UPDATE`)).rows[0];
      let linha;
      if (ult && !ult.publicado) {
        linha = (await cx.query(`UPDATE universidade_documentos SET titulo = $2, texto = $3 WHERE id = $1 RETURNING *`, [ult.id, titulo, corpo])).rows[0];
      } else {
        linha = (await cx.query(
          `INSERT INTO universidade_documentos (documento, versao, titulo, texto) VALUES ('termo_adesao', $1, $2, $3) RETURNING *`,
          [(ult?.versao || 0) + 1, titulo, corpo])).rows[0];
      }
      await registrarAcao(cx, req, 'universidade_termo_salvo', 'universidade_documentos', linha.id, { versao: linha.versao });
      return linha;
    });
    return res.json(r);
  } catch (err) { return erro(res, err); }
}

async function publicarTermo(req, res) {
  const publicar = req.body?.publicado !== false;
  try {
    const r = await db.transacao(async cx => {
      const d = (await cx.query(
        `UPDATE universidade_documentos SET publicado = $2, publicado_em = CASE WHEN $2 THEN NOW() ELSE publicado_em END
          WHERE id = $1 AND documento = 'termo_adesao' RETURNING *`, [req.params.id, publicar])).rows[0];
      if (d) await registrarAcao(cx, req, publicar ? 'universidade_termo_publicado' : 'universidade_termo_despublicado', 'universidade_documentos', d.id, { versao: d.versao });
      return d;
    });
    if (!r) return res.status(404).json({ error: 'Termo não encontrado' });
    return res.json(r);
  } catch (err) { return erro(res, err); }
}

// ---------- Configuração ----------

async function salvarConfig(req, res) {
  const b = req.body || {};
  const novos = {};
  if (b.nota_minima !== undefined) {
    const v = Number(b.nota_minima);
    if (!(v > 0 && v <= 1)) return res.status(400).json({ error: 'Nota mínima entre 0,01 e 1 (ex.: 0,70 = 70%).' });
    novos.nota_minima = String(v);
  }
  for (const k of ['validade_meses', 'prazo_atualizacao_dias']) {
    if (b[k] !== undefined) {
      const v = Number(b[k]);
      if (!Number.isInteger(v) || v < 1 || v > 120 * (k === 'prazo_atualizacao_dias' ? 3 : 1)) return res.status(400).json({ error: `Valor inválido para ${k}.` });
      novos[k] = String(v);
    }
  }
  if (b.trava_portal !== undefined) novos.trava_portal = b.trava_portal === true ? 'true' : 'false';
  if (!Object.keys(novos).length) return res.status(400).json({ error: 'Nada para salvar.' });
  try {
    await db.transacao(async cx => {
      for (const [chave, valor] of Object.entries(novos)) {
        await cx.query(
          `INSERT INTO universidade_config (chave, valor) VALUES ($1, $2)
           ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = NOW()`, [chave, valor]);
      }
      await registrarLote(cx, req, 'universidade_config', 'universidade_config', novos);
    });
    return res.json(await lerConfig());
  } catch (err) { return erro(res, err); }
}

module.exports = {
  progresso, detalhePartner, criarPartner, editarPartner, redefinirAcesso,
  conteudo, editarModulo, mudancaRelevante, criarAula, editarAula, excluirAula,
  criarTopico, editarTopico, excluirTopico, editarPergunta,
  salvarTermo, publicarTermo, salvarConfig,
};
