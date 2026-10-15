// Chave PIX e documento do MOVV Partner (migration 098, Junior 15/10/2026).
// - PIX: o PRÓPRIO Partner preenche em "Meu perfil", confirmando a senha
//   atual; a troca vai para partner_pix_historico com valores mascarados.
// - Documento (CPF/CNPJ), tipo de parceiro e razão social: só a equipe
//   (admin e financeiro). O Fernando não edita.
// - Pagar comissão sem PIX ou sem documento é bloqueado no livro
//   (services/partnerComissoes.js); aprovar só avisa.
// CPF, CNPJ e chave completos nunca vão para log nem para admin_acoes.
const bcrypt = require('bcryptjs');
const { ErroComissao } = require('./partnerComissoes');
const { registrarTrocaPixPartner, JOIN_PIX_RECENTE, COLUNAS_PIX_RECENTE } = require('./historicoPix');
const { onlyDigits, isValidCPF, isValidCNPJ, validarPix, mascararPix, mascararDocumento } = require('../utils/validators');

const TIPOS_PARCEIRO = ['mei', 'pj', 'autonomo'];

// O que falta para poder pagar o Partner
function faltasDoCadastro(p) {
  const faltas = [];
  if (!p.pix_key || !p.pix_key_type) faltas.push('chave PIX');
  if (!p.documento) faltas.push('CPF/CNPJ');
  return faltas;
}

async function carregar(cx, partnerId) {
  const p = (await cx.query(
    `SELECT id, code, name, type, is_active, password_hash, pix_key, pix_key_type, documento, tipo_parceiro, razao_social,
            documento_atualizado_em, documento_atualizado_por
     FROM partners WHERE id = $1`, [partnerId]
  )).rows[0];
  if (!p || p.type !== 'movv_partner') throw new ErroComissao('MOVV Partner não encontrado.', 404);
  return p;
}

// ─── Partner ("Meu perfil") ─────────────────────────────────────────────────

// A própria chave o Partner vê inteira; o documento, mascarado.
async function perfilDoPartner(cx, partnerId) {
  const p = await carregar(cx, partnerId);
  return {
    pix_key_type: p.pix_key_type, pix_key: p.pix_key,
    documento: mascararDocumento(p.documento), tipo_parceiro: p.tipo_parceiro, razao_social: p.razao_social,
    faltas: faltasDoCadastro(p),
  };
}

async function trocarPixDoPartner(cx, user, { pix_key_type: tipo, pix_key: chave, senha_atual: senha } = {}) {
  const p = (await cx.query(
    `SELECT id, type, password_hash, pix_key, pix_key_type FROM partners WHERE id = $1 FOR UPDATE`, [user.id]
  )).rows[0];
  if (!p || p.type !== 'movv_partner') throw new ErroComissao('Área exclusiva do MOVV Partner.', 403);
  if (!senha || !(await bcrypt.compare(String(senha), p.password_hash))) {
    // 400, não 401: no portal, 401 quer dizer "sessão expirada" e desloga
    throw new ErroComissao('Senha atual incorreta.', 400);
  }
  const v = validarPix(tipo, chave);
  if (v.erro) throw new ErroComissao(v.erro);
  await cx.query(`UPDATE partners SET pix_key = $2, pix_key_type = $3 WHERE id = $1`, [p.id, v.chave, tipo]);
  const mudou = await registrarTrocaPixPartner(cx, p.id, { tipo: p.pix_key_type, chave: p.pix_key }, { tipo, chave: v.chave }, user);
  return { pix_key_type: tipo, pix_key: v.chave, mudou };
}

// ─── Equipe (admin e financeiro) ────────────────────────────────────────────

// Lista para pagamento: tudo mascarado; quanto há a receber; troca recente de PIX
async function listarCadastros(cx, { soIncompletos = false } = {}) {
  const r = await cx.query(
    `SELECT p.id, p.code, p.name, p.is_active, p.nivel_partner, p.pix_key, p.pix_key_type, p.documento, p.tipo_parceiro, p.razao_social,
            COALESCE((SELECT SUM(pc.valor_partner) FROM partner_comissoes pc
                      WHERE pc.partner_id = p.id AND pc.status IN ('previsto', 'confirmado', 'aprovado')), 0) AS a_receber,
            COALESCE((SELECT SUM(pc.valor_partner) FROM partner_comissoes pc
                      WHERE pc.partner_id = p.id AND pc.status = 'aprovado'), 0) AS aprovado_a_pagar,
            ${COLUNAS_PIX_RECENTE}
     FROM partners p
     ${JOIN_PIX_RECENTE('p')}
     WHERE p.type = 'movv_partner'
     ORDER BY p.is_active DESC, p.name`
  );
  const lista = r.rows.map(p => ({
    id: p.id, code: p.code, name: p.name, is_active: p.is_active, nivel_partner: p.nivel_partner,
    pix_key_type: p.pix_key_type, pix: mascararPix(p.pix_key_type, p.pix_key),
    documento: mascararDocumento(p.documento), tipo_parceiro: p.tipo_parceiro, razao_social: p.razao_social,
    a_receber: p.a_receber, aprovado_a_pagar: p.aprovado_a_pagar,
    pix_alterada_em: p.pix_alterada_em, pix_alterada_por: p.pix_alterada_por,
    faltas: faltasDoCadastro(p),
  }));
  return soIncompletos ? lista.filter(p => p.is_active && p.faltas.length) : lista;
}

// Completo (para pagar e para editar): só a equipe chega aqui
async function cadastroCompleto(cx, partnerId) {
  const p = (await cx.query(
    `SELECT p.id, p.code, p.name, p.type, p.pix_key, p.pix_key_type, p.documento, p.tipo_parceiro, p.razao_social,
            p.documento_atualizado_em, p.documento_atualizado_por, ${COLUNAS_PIX_RECENTE}
     FROM partners p ${JOIN_PIX_RECENTE('p')} WHERE p.id = $1`, [partnerId]
  )).rows[0];
  if (!p || p.type !== 'movv_partner') throw new ErroComissao('MOVV Partner não encontrado.', 404);
  const { type, ...resto } = p;
  return { ...resto, faltas: faltasDoCadastro(p) };
}

// Documento, tipo e razão social. Autônomo usa CPF; MEI e PJ usam CNPJ.
// Devolve antes/depois MASCARADOS para o registro em admin_acoes.
async function salvarDocumento(cx, partnerId, { documento, tipo_parceiro: tipo, razao_social: razao } = {}, quem) {
  const p = await carregar(cx, partnerId);
  if (!TIPOS_PARCEIRO.includes(tipo)) throw new ErroComissao('Escolha o tipo: MEI, PJ ou autônomo.');
  const d = onlyDigits(documento);
  if (tipo === 'autonomo' && !isValidCPF(d)) throw new ErroComissao('Autônomo: informe um CPF válido.');
  if (tipo !== 'autonomo' && !isValidCNPJ(d)) throw new ErroComissao(`${tipo === 'mei' ? 'MEI' : 'PJ'}: informe um CNPJ válido.`);
  const rs = String(razao ?? '').trim() || null;
  const dono = (await cx.query(
    `SELECT id FROM partners WHERE documento = $1 AND type = 'movv_partner' AND id <> $2`, [d, p.id]
  )).rows[0];
  if (dono) throw new ErroComissao('Este CPF/CNPJ já está no cadastro de outro Partner.', 409);
  await cx.query(
    `UPDATE partners SET documento = $2, tipo_parceiro = $3, razao_social = $4, documento_atualizado_em = NOW(), documento_atualizado_por = $5
     WHERE id = $1`, [p.id, d, tipo, rs, quem]
  );
  return {
    antes: { documento: mascararDocumento(p.documento), tipo_parceiro: p.tipo_parceiro, razao_social: p.razao_social },
    depois: { documento: mascararDocumento(d), tipo_parceiro: tipo, razao_social: rs },
  };
}

module.exports = {
  TIPOS_PARCEIRO, faltasDoCadastro, perfilDoPartner, trocarPixDoPartner, listarCadastros, cadastroCompleto, salvarDocumento,
};
