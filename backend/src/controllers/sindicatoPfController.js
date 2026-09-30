const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');
const { sendWhatsAppMessage } = require('../services/zapApiService');
const { NIVEIS_PF } = require('../config/vendedorPf');

// Fila de verificação do Vendedor Pessoa Física (/sindicato/verificacao-pf,
// só admin). Aprovar = parceiro vira 'ativo'; rejeitar = identidade
// 'rejeitada' (continua entrando no painel, que mostra o aviso). Nos dois
// casos as fotos do documento e da selfie são APAGADAS do Cloudinary
// (termos, seção 5) e fica só o registro em pf_verificacao_log.

const STATUS_FILA = ['pendente', 'aprovada', 'rejeitada'];

// mesmo padrão do petAvisosService: espera no máximo 6 s pela Z-API
async function avisarWhatsapp(numero, texto) {
  if (!numero) return false;
  try {
    const r = await Promise.race([
      sendWhatsAppMessage(numero, texto),
      new Promise(resolve => setTimeout(() => resolve({ success: false }), 6000)),
    ]);
    return Boolean(r?.success);
  } catch (err) {
    console.error('[sindicatoPf.whatsapp]', err.message);
    return false;
  }
}

function linkWhatsapp(numero, texto) {
  return `https://api.whatsapp.com/send?phone=55${String(numero || '').replace(/\D/g, '')}&text=${encodeURIComponent(texto)}`;
}

const primeiroNome = nome => String(nome || '').trim().split(/\s+/)[0] || '';

// GET /sindicato-pf/contagem → { pendentes }
async function contagem(req, res) {
  try {
    const r = await db.query(`SELECT COUNT(*)::int n FROM sindicato_parceiros WHERE tipo_pessoa = 'pf' AND identidade_status = 'pendente'`);
    return res.json({ pendentes: r.rows[0].n });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao contar' });
  }
}

// GET /sindicato-pf/verificacao?status=pendente|aprovada|rejeitada
async function listar(req, res) {
  const status = STATUS_FILA.includes(req.query.status) ? req.query.status : 'pendente';
  try {
    const r = await db.query(
      `SELECT p.id, p.nome AS nome_vitrine, p.razao_social AS nome_completo, p.cpf, p.data_nascimento,
              p.whatsapp, p.bairro, p.cidade, p.categoria_principal, p.nivel_vendedor, p.status,
              p.identidade_status, p.identidade_enviada_em, p.identidade_revisada_em, p.identidade_motivo,
              p.identidade_doc_public_id IS NOT NULL AS tem_documento, p.identidade_selfie_public_id IS NOT NULL AS tem_selfie,
              p.created_at, u.email,
              (SELECT json_build_object('acao', l.acao, 'admin_nome', l.admin_nome, 'fotos_apagadas', l.fotos_apagadas, 'em', l.created_at)
                 FROM pf_verificacao_log l WHERE l.parceiro_id = p.id ORDER BY l.created_at DESC LIMIT 1) AS ultima_decisao
       FROM sindicato_parceiros p
       LEFT JOIN LATERAL (SELECT email FROM sindicato_parceiro_usuarios WHERE parceiro_id = p.id ORDER BY id LIMIT 1) u ON true
       WHERE p.tipo_pessoa = 'pf' AND p.identidade_status = $1
       ORDER BY ${status === 'pendente' ? 'p.identidade_enviada_em ASC' : 'p.identidade_revisada_em DESC NULLS LAST'}
       LIMIT 200`,
      [status]
    );
    const itens = r.rows.map(p => ({ ...p, nivel_label: NIVEIS_PF[p.nivel_vendedor]?.label || p.nivel_vendedor }));
    return res.json({ status, itens });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar verificações' });
  }
}

// GET /sindicato-pf/:id/documento/:tipo (documento|selfie) — a imagem PRIVADA
// passa pelo servidor (URL assinada de 60 s que nunca sai daqui). Sem cache.
async function documento(req, res) {
  const coluna = { documento: 'identidade_doc_public_id', selfie: 'identidade_selfie_public_id' }[req.params.tipo];
  if (!coluna) return res.status(404).json({ error: 'Tipo inválido' });
  try {
    const r = await db.query(`SELECT ${coluna} AS public_id FROM sindicato_parceiros WHERE id = $1 AND tipo_pessoa = 'pf'`, [req.params.id]);
    const publicId = r.rows[0]?.public_id;
    if (!publicId) return res.status(404).json({ error: 'Foto não existe mais (já foi apagada depois da verificação)' });
    const { buffer, contentType } = await cloudinaryService.baixarDocumentoPrivado(publicId, 'jpg');
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' });
    return res.send(buffer);
  } catch (err) {
    console.error('[sindicatoPf.documento]', err.message, err.cloudinaryMessage || '');
    return res.status(502).json({ error: 'Não deu para abrir a foto agora' });
  }
}

// Apaga as duas fotos e devolve se deu certo — o id só é limpo no banco se
// o Cloudinary confirmou (senão fica guardado pra tentar de novo).
async function apagarFotos(p) {
  const okDoc = await cloudinaryService.deletarDocumentoPrivado(p.identidade_doc_public_id);
  const okSelfie = await cloudinaryService.deletarDocumentoPrivado(p.identidade_selfie_public_id);
  return { okDoc, okSelfie, todas: okDoc && okSelfie };
}

async function decidir(req, res, acao) {
  const motivo = String(req.body?.motivo || '').trim().slice(0, 500);
  if (acao === 'rejeitada' && motivo.length < 5) return res.status(400).json({ error: 'Escreva o motivo da rejeição (ele vai no WhatsApp da pessoa)' });
  try {
    const p = (await db.query(`SELECT * FROM sindicato_parceiros WHERE id = $1 AND tipo_pessoa = 'pf'`, [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'Cadastro não encontrado' });
    if (p.identidade_status !== 'pendente') return res.status(409).json({ error: `Este cadastro já foi ${p.identidade_status}` });

    const fotos = await apagarFotos(p);
    const adminNome = req.user?.name || req.user?.email || 'admin';
    await db.transacao(async client => {
      await client.query(
        `UPDATE sindicato_parceiros SET
           identidade_status = $1, identidade_motivo = $2,
           identidade_revisada_em = NOW(), identidade_revisada_por = $3,
           status = CASE WHEN $7 THEN 'ativo' ELSE status END,
           identidade_doc_public_id = CASE WHEN $4 THEN NULL ELSE identidade_doc_public_id END,
           identidade_selfie_public_id = CASE WHEN $5 THEN NULL ELSE identidade_selfie_public_id END,
           updated_at = NOW()
         WHERE id = $6`,
        // $7 separado: usar $1 como valor E numa comparação dá "inconsistent types deduced for parameter"
        [acao, acao === 'rejeitada' ? motivo : null, req.user?.id || null, fotos.okDoc, fotos.okSelfie, p.id, acao === 'aprovada']
      );
      await client.query(
        `INSERT INTO pf_verificacao_log (parceiro_id, acao, motivo, admin_id, admin_nome, fotos_apagadas)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [p.id, acao, acao === 'rejeitada' ? motivo : null, req.user?.id || null, adminNome, fotos.todas]
      );
    });

    const nome = primeiroNome(p.razao_social || p.nome);
    const texto = acao === 'aprovada'
      ? `🎉 Olá ${nome}! Seu cadastro de vendedor no IUB Mais+ foi APROVADO.\n\nJá pode publicar seus produtos no painel — cada anúncio passa por uma conferência rápida antes de aparecer no site.\n\nIUB Mais+`
      : `Olá ${nome}, sobre seu cadastro de vendedor no IUB Mais+: por enquanto não conseguimos aprovar.\n\nMotivo: ${motivo}\n\nSe quiser enviar os documentos de novo, é só responder aqui.\n\nIUB Mais+`;
    const enviado = await avisarWhatsapp(p.whatsapp, texto);
    if (enviado) await db.query(`UPDATE pf_verificacao_log SET whatsapp_enviado = true WHERE id = (SELECT MAX(id) FROM pf_verificacao_log WHERE parceiro_id = $1)`, [p.id]);

    return res.json({
      ok: true, acao, fotos_apagadas: fotos.todas, whatsapp_enviado: enviado,
      // não deu pelo Z-API: o admin manda na mão
      whatsapp_link: enviado ? null : linkWhatsapp(p.whatsapp, texto),
    });
  } catch (err) {
    console.error('[sindicatoPf.decidir]', err);
    return res.status(500).json({ error: 'Erro ao registrar a decisão' });
  }
}

const aprovar = (req, res) => decidir(req, res, 'aprovada');
const rejeitar = (req, res) => decidir(req, res, 'rejeitada');

module.exports = { contagem, listar, documento, aprovar, rejeitar };
