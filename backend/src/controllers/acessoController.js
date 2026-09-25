const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { consultarDocumento } = require('../services/baseSeciService');
const { conferirNascimento } = require('../services/segundoFatorNascimento');
const { gerarTokenPainel } = require('../middleware/painelPublicoAuth');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { gerarEditTokenUnico } = require('./publicCadastroController');

const SENHA_MIN = 6;

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || null;
}

function ipDe(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;
}

function dataNascimentoValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return false;
  const idade = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return idade >= 14 && idade <= 110;
}

// Fluxo 1 do /acesso: associado SECI. O documento (CNPJ da empresa ou CPF do
// filiado pessoa física) é conferido de novo aqui — nunca confia no "em dia"
// que o front viu na tela 1.
//
// CPF que já existe em sindicato_associados:
//   - já tem senha  -> 409 JA_TEM_CONTA (vai pro login)
//   - sem senha     -> é associado antigo (Higestor, /cadastrar, lista
//     aprovada): só cria a senha se a data de nascimento bater com a do
//     cadastro — com o mesmo bloqueio de tentativas do login antigo. Sem
//     isso, CNPJ público + CPF de alguém bastariam pra tomar a conta.
async function cadastroSeci(req, res) {
  try {
    const { documento, cpf, nome_completo, data_nascimento, whatsapp, senha, aceite_comunicacao } = req.body || {};

    const doc = onlyDigits(documento);
    const docValido = (doc.length === 14 && isValidCNPJ(doc)) || (doc.length === 11 && isValidCPF(doc));
    if (!docValido) return res.status(400).json({ error: 'CPF ou CNPJ da empresa inválido.' });

    const empresa = await consultarDocumento(doc);
    if (!empresa) return res.status(404).json({ error: 'Não encontramos este documento na base do SECI.', code: 'NAO_ENCONTRADO' });
    if (!empresa.em_dia) return res.status(403).json({ error: 'Há uma pendência com o Sindicato. Fale com a gente pelo WhatsApp.', code: 'PENDENTE' });

    const cpfDigits = empresa.tipo_documento === 'cpf' ? doc : onlyDigits(cpf);
    const nome = String(nome_completo || '').trim().replace(/\s+/g, ' ');
    const zap = onlyDigits(whatsapp);

    if (!isValidCPF(cpfDigits)) return res.status(400).json({ error: 'CPF inválido.', campo: 'cpf' });
    if (nome.length < 3 || !nome.includes(' ')) return res.status(400).json({ error: 'Digite seu nome completo (nome e sobrenome).', campo: 'nome_completo' });
    if (!dataNascimentoValida(data_nascimento)) return res.status(400).json({ error: 'Data de nascimento inválida.', campo: 'data_nascimento' });
    if (zap.length < 10 || zap.length > 11) return res.status(400).json({ error: 'WhatsApp inválido — use DDD + número.', campo: 'whatsapp' });
    if (String(senha || '').length < SENHA_MIN) return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`, campo: 'senha' });
    if (aceite_comunicacao !== true) return res.status(400).json({ error: 'É preciso aceitar receber comunicados pelo WhatsApp.', campo: 'aceite_comunicacao' });

    const senhaHash = await bcrypt.hash(String(senha), 10);
    const existente = (await db.query('SELECT * FROM sindicato_associados WHERE cpf = $1', [cpfDigits])).rows[0];

    if (existente) {
      if (existente.senha_hash) {
        return res.status(409).json({ error: 'Este CPF já tem conta no IUB MAIS+. É só fazer login.', code: 'JA_TEM_CONTA' });
      }
      if (!existente.ativo) {
        return res.status(403).json({ error: 'Seu cadastro está desativado. Fale com o Sindicato pelo WhatsApp.', code: 'INATIVO' });
      }
      if (!existente.data_nascimento) {
        return res.status(409).json({ error: 'Seu cadastro no Sindicato está sem data de nascimento. Fale com a gente pelo WhatsApp que a gente libera.', code: 'SEM_NASCIMENTO' });
      }
      const conferencia = await conferirNascimento(existente, data_nascimento);
      if (!conferencia.ok) {
        return res.status(conferencia.status).json({
          ...conferencia.body,
          ...(conferencia.status === 401 && { error: 'A data de nascimento não confere com o cadastro que o Sindicato tem deste CPF.', campo: 'data_nascimento' }),
        });
      }

      // Associado antigo: mantém nome/cadastro do Sindicato, só ganha senha
      // (e o WhatsApp novo, já que provou ser ele).
      let hash = existente.carteirinha_hash;
      let validaAte = existente.carteirinha_valida_ate;
      if (!hash) {
        hash = await gerarHashUnico('sindicato_associados');
        validaAte = calcularValidoAte();
      }
      const editToken = existente.edit_token || await gerarEditTokenUnico();
      const upd = await db.query(
        `UPDATE sindicato_associados
         SET senha_hash = $1, senha_definida_em = NOW(), whatsapp = $2,
             empresa_seci_id = COALESCE(empresa_seci_id, $3),
             carteirinha_hash = $4, carteirinha_valida_ate = $5,
             carteirinha_gerada_em = COALESCE(carteirinha_gerada_em, NOW()),
             edit_token = $6,
             consent_at = COALESCE(consent_at, NOW()), consent_ip = COALESCE(consent_ip, $7),
             updated_at = NOW()
         WHERE id = $8
         RETURNING id, nome_completo`,
        [senhaHash, zap, empresa.id, hash, validaAte, editToken, ipDe(req), existente.id]
      );
      const a = upd.rows[0];
      return res.json({ token: gerarTokenPainel(a.id), nome_curto: primeiroNome(a.nome_completo), ja_era_associado: true });
    }

    const hash = await gerarHashUnico('sindicato_associados');
    const editToken = await gerarEditTokenUnico();
    const ins = await db.query(
      `INSERT INTO sindicato_associados
         (external_id, nome_completo, cpf, data_nascimento, whatsapp, empresa_nome_livre, empresa_seci_id,
          tipo_acesso, senha_hash, senha_definida_em, edit_token, consent_at, consent_ip,
          carteirinha_hash, carteirinha_gerada_em, carteirinha_valida_ate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'seci', $8, NOW(), $9, NOW(), $10, $11, NOW(), $12)
       RETURNING id, nome_completo`,
      [
        `ACESSO-${Date.now()}-${cpfDigits.slice(-4)}`, nome, cpfDigits, data_nascimento, zap,
        empresa.nome_fantasia || empresa.razao_social, empresa.id,
        senhaHash, editToken, ipDe(req), hash, calcularValidoAte(),
      ]
    );
    const a = ins.rows[0];
    return res.status(201).json({ token: gerarTokenPainel(a.id), nome_curto: primeiroNome(a.nome_completo), ja_era_associado: false });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este CPF já tem conta no IUB MAIS+. É só fazer login.', code: 'JA_TEM_CONTA' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos concluir agora. Tente de novo em instantes.' });
  }
}

module.exports = { cadastroSeci, SENHA_MIN };
