// Universidade MOVV Partner (migration 091, Junior 09/10/2026): regras de
// liberação, aprovação, certificado e trava do portal. Tudo calculado a partir
// das tabelas universidade_*; nada de status de módulo gravado.
//
// - Módulo 0 sempre aberto (se publicado). Os outros abrem quando as aulas do
//   Módulo 0 estão lidas E o termo de adesão publicado (última versão) foi aceito.
// - Módulo aprovado = tentativa aprovada DEPOIS do corte: o corte é o maior entre
//   recertificar_desde do módulo ("mudança relevante") e o vencimento do último
//   certificado vencido (vencido, o Partner refaz só os quizzes; leituras ficam).
// - Certificado sai quando todos os módulos publicados estão aprovados. Válido por
//   validade_meses. Módulo alterado ou publicado depois: o certificado continua
//   válido, o módulo aparece "Atualizar" e há prazo_atualizacao_dias para refazer;
//   passou o prazo, o certificado fica suspenso (conta como sem certificado na trava).
const crypto = require('crypto');
const db = require('../config/database');

const PADRAO = { nota_minima: 0.7, validade_meses: 12, prazo_atualizacao_dias: 30, trava_portal: false };
const DIA = 24 * 60 * 60 * 1000;

async function lerConfig(cx = db) {
  const rows = (await cx.query('SELECT chave, valor FROM universidade_config')).rows;
  const c = { ...PADRAO };
  for (const { chave, valor } of rows) {
    if (chave === 'trava_portal') c.trava_portal = valor === 'true';
    else if (chave in PADRAO) c[chave] = Number(valor);
  }
  return c;
}

async function termoPublicado(cx = db) {
  return (await cx.query(
    `SELECT id, documento, versao, titulo, texto, publicado_em FROM universidade_documentos
      WHERE documento = 'termo_adesao' AND publicado ORDER BY versao DESC LIMIT 1`)).rows[0] || null;
}

const maior = (...datas) => datas.filter(Boolean).map(d => new Date(d)).sort((a, b) => b - a)[0] || null;

// Situação completa de um Partner. `cx` pode ser um client de transação.
async function situacao(userId, cx = db, { config } = {}) {
  const cfg = config || await lerConfig(cx);
  // em sequência: `cx` pode ser o client de uma transação (uma consulta por vez)
  const modulos = await cx.query(
    `SELECT id, numero, titulo, descricao, icone, ordem, publicado, publicado_em, conteudo_pendente,
            versao_conteudo, recertificar_desde
       FROM universidade_modulos ORDER BY ordem, numero`);
  const aulas = await cx.query(`SELECT id, modulo_id, ordem, titulo FROM universidade_aulas WHERE publicado ORDER BY modulo_id, ordem`);
  const lidas = await cx.query(`SELECT aula_id, lida_em FROM universidade_progresso WHERE user_id = $1`, [userId]);
  const tentativas = await cx.query(
    `SELECT modulo_id, nota, aprovado, criado_em FROM universidade_quiz_tentativas WHERE user_id = $1 ORDER BY criado_em`, [userId]);
  const termo = await termoPublicado(cx);
  const certs = await cx.query(
    `SELECT id, codigo, nivel, emitido_em, valido_ate, status FROM universidade_certificacoes
      WHERE user_id = $1 AND status <> 'revogada' ORDER BY emitido_em DESC, id DESC LIMIT 1`, [userId]);
  const agora = new Date();
  const lidaEm = new Map(lidas.rows.map(r => [r.aula_id, r.lida_em]));
  const aceite = termo ? (await cx.query(
    `SELECT aceito_em FROM universidade_aceites WHERE user_id = $1 AND documento = 'termo_adesao' AND versao = $2`,
    [userId, termo.versao])).rows[0] || null : null;

  let cert = certs.rows[0] || null;
  if (cert && cert.status === 'valida' && new Date(cert.valido_ate) <= agora) cert = { ...cert, status: 'vencida' };
  const certValida = cert?.status === 'valida' ? cert : null;
  const corteVencimento = cert?.status === 'vencida' ? cert.valido_ate : null;

  const lista = modulos.rows.map(m => {
    const minhasAulas = aulas.rows.filter(a => a.modulo_id === m.id).map(a => ({ ...a, lida_em: lidaEm.get(a.id) || null }));
    const minhas = tentativas.rows.filter(t => t.modulo_id === m.id);
    const corte = maior(m.recertificar_desde, corteVencimento);
    const valeAprovado = t => t.aprovado && (!corte || new Date(t.criado_em) > corte);
    const aprovadaEm = minhas.filter(valeAprovado).map(t => t.criado_em).pop() || null;
    const ultima = minhas[minhas.length - 1] || null;
    return {
      id: m.id, numero: m.numero, titulo: m.titulo, descricao: m.descricao, icone: m.icone, ordem: m.ordem,
      publicado: m.publicado, publicado_em: m.publicado_em, conteudo_pendente: m.conteudo_pendente,
      versao_conteudo: m.versao_conteudo, recertificar_desde: m.recertificar_desde,
      aulas: minhasAulas,
      aulas_total: minhasAulas.length,
      aulas_lidas: minhasAulas.filter(a => a.lida_em).length,
      aprovado: Boolean(aprovadaEm), aprovado_em: aprovadaEm,
      ja_aprovou_antes: minhas.some(t => t.aprovado) && !aprovadaEm,
      tentativas: minhas.length,
      ultima_nota: ultima ? Number(ultima.nota) : null,
      melhor_nota: minhas.length ? Math.max(...minhas.map(t => Number(t.nota))) : null,
    };
  });

  const m0 = lista.find(m => m.numero === 0);
  const m0Lido = Boolean(m0?.publicado && m0.aulas_lidas === m0.aulas_total);
  const liberado = Boolean(m0Lido && termo && aceite);
  const publicados = lista.filter(m => m.publicado);

  for (const m of lista) {
    m.todas_lidas = m.aulas_lidas === m.aulas_total;
    m.acessivel = m.publicado && (m.numero === 0 || liberado);
    m.quiz_liberado = m.acessivel && m.todas_lidas;
    let prazo = null;
    if (certValida && m.publicado && !m.aprovado) {
      const inicio = maior(m.recertificar_desde, m.publicado_em);
      if (inicio && inicio > new Date(certValida.emitido_em)) prazo = new Date(inicio.getTime() + cfg.prazo_atualizacao_dias * DIA);
    }
    m.prazo_atualizar = prazo;
    m.situacao = !m.publicado ? 'em_breve'
      : !m.acessivel ? 'bloqueado'
        : m.aprovado ? 'concluido'
          : (m.ja_aprovou_antes || prazo) ? 'atualizar'
            : (m.aulas_lidas > 0 || m.tentativas > 0) ? 'em_andamento'
              : 'disponivel';
    // % do módulo: cada aula lida + o quiz aprovado
    m.progresso = Math.round(100 * (m.aulas_lidas + (m.aprovado ? 1 : 0)) / (m.aulas_total + 1));
  }

  const pendentes = publicados.filter(m => !m.aprovado);
  const atrasado = pendentes.some(m => m.prazo_atualizar && m.prazo_atualizar < agora);
  const elegivel = Boolean(liberado && m0?.publicado && publicados.length && !pendentes.length);
  const passos = publicados.reduce((s, m) => s + m.aulas_total + 1, 0);
  const feitos = publicados.reduce((s, m) => s + m.aulas_lidas + (m.aprovado ? 1 : 0), 0);
  const continuar = publicados.find(m => m.acessivel && !m.aprovado && m.situacao !== 'bloqueado') || null;

  return {
    config: cfg,
    modulos: lista,
    liberado,
    modulo0_lido: m0Lido,
    termo: termo ? { versao: termo.versao, titulo: termo.titulo, aceito_em: aceite?.aceito_em || null } : null,
    progresso_geral: passos ? Math.round((100 * feitos) / passos) : 0,
    continuar: continuar ? { numero: continuar.numero, titulo: continuar.titulo,
      aula_id: continuar.aulas.find(a => !a.lida_em)?.id || null } : null,
    elegivel,
    certificado: cert ? { ...cert, suspenso: Boolean(certValida && atrasado) } : null,
    // vale para a trava do portal: válido, no prazo e não suspenso
    certificado_valido: Boolean(certValida && !atrasado),
  };
}

function gerarCodigo(ano) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
  return `MOVV-${Array.from(crypto.randomBytes(6), b => abc[b % abc.length]).join('')}-${ano}`;
}

// Grava "vencida" no banco e emite o certificado quando tudo estiver aprovado.
// Devolve o certificado novo (ou null). Chame dentro de uma transação.
async function avaliarCertificacao(cx, userId) {
  await cx.query(`UPDATE universidade_certificacoes SET status = 'vencida'
                   WHERE user_id = $1 AND status = 'valida' AND valido_ate <= NOW()`, [userId]);
  const s = await situacao(userId, cx);
  if (!s.elegivel || s.certificado?.status === 'valida') return null;
  const nivel = (await cx.query('SELECT nivel_partner FROM partners WHERE id = $1', [userId])).rows[0]?.nivel_partner || null;
  for (let i = 0; i < 5; i++) {
    const codigo = gerarCodigo(new Date().getFullYear());
    const r = await cx.query(
      `INSERT INTO universidade_certificacoes (user_id, codigo, nivel, valido_ate)
       VALUES ($1, $2, $3, NOW() + make_interval(months => $4::int))
       ON CONFLICT (codigo) DO NOTHING RETURNING *`, [userId, codigo, nivel, s.config.validade_meses]);
    if (r.rows[0]) return r.rows[0];
  }
  throw new Error('Não foi possível gerar um código de certificado único');
}

// Trava do portal: Partner sem certificado válido só usa a Universidade e a própria conta.
const ROTAS_LIVRES = ['/api/universidade', '/api/auth'];
async function travaDoPortal(req, res, user) {
  if (user?.type !== 'movv_partner') return false;
  const rota = req.baseUrl + req.path;
  if (ROTAS_LIVRES.some(p => rota === p || rota.startsWith(p + '/'))) return false;
  const cfg = await lerConfig();
  if (!cfg.trava_portal) return false;
  const s = await situacao(user.id, db, { config: cfg });
  if (s.certificado_valido) return false;
  res.status(403).json({ error: 'Conclua a Universidade MOVV Partner para liberar esta área.', codigo: 'CERTIFICACAO_PENDENTE' });
  return true;
}

module.exports = { lerConfig, termoPublicado, situacao, avaliarCertificacao, travaDoPortal, gerarCodigo };
