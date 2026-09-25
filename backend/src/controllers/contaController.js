const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { onlyDigits, isValidCPF } = require('../utils/validators');
const { conferirNascimento } = require('../services/segundoFatorNascimento');
const { gerarTokenPainel } = require('../middleware/painelPublicoAuth');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { gerarEditTokenUnico } = require('./publicCadastroController');
const { maskCpfParcial } = require('../services/associadoPublicoView');

const SENHA_MIN = 6;
const MAX_TENTATIVAS_SENHA = 5;
const BLOQUEIO_SENHA_MIN = 15;

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || null;
}

// WhatsApp antigo às vezes está sem o 9 (10 dígitos) e a pessoa digita com
// o 9 (11), ou o contrário — procura as duas formas.
function variantesWhatsapp(d) {
  const v = new Set([d]);
  if (d.length === 11 && d[2] === '9') v.add(d.slice(0, 2) + d.slice(3));
  if (d.length === 10) v.add(`${d.slice(0, 2)}9${d.slice(2)}`);
  return [...v];
}

// "CPF ou WhatsApp" num campo só. 11 dígitos pode ser as duas coisas (CPF ou
// celular com DDD), então procura nos dois campos; 10 dígitos só pode ser
// WhatsApp. Devolve as contas encontradas e por qual campo cada uma bateu.
async function buscarContas(login) {
  const d = onlyDigits(login);
  if (d.length !== 10 && d.length !== 11) return null;
  const cpf = d.length === 11 && isValidCPF(d) ? d : null;
  const zaps = variantesWhatsapp(d);
  const r = await db.query(
    `SELECT id, nome_completo, cpf, whatsapp, ativo, senha_hash, senha_tentativas, senha_bloqueada_ate
     FROM sindicato_associados
     WHERE ($1::varchar IS NOT NULL AND cpf = $1) OR whatsapp = ANY($2::varchar[])`,
    [cpf, zaps]
  );
  return r.rows.map(c => ({ ...c, via: cpf && c.cpf === cpf ? 'cpf' : 'whatsapp' }));
}

function minutosAte(data) {
  return Math.max(1, Math.ceil((new Date(data).getTime() - Date.now()) / 60000));
}

// POST /api/public/conta/login  { login: CPF ou WhatsApp, senha }
async function login(req, res) {
  try {
    const { login: identificador, senha } = req.body || {};
    const contas = await buscarContas(identificador);
    if (!contas) return res.status(400).json({ error: 'Digite seu CPF ou seu WhatsApp com DDD.', campo: 'login' });
    if (!String(senha || '')) return res.status(400).json({ error: 'Digite sua senha.', campo: 'senha' });
    if (contas.length === 0) {
      return res.status(404).json({ error: 'Não encontramos conta com esse CPF ou WhatsApp.', code: 'NAO_ENCONTRADO' });
    }

    const comSenha = contas.filter(c => c.senha_hash);
    // Associado antigo (importado do Higestor / cadastro antigo) ainda sem
    // senha: vai pro primeiro acesso, que confere a data de nascimento.
    if (comSenha.length === 0) {
      return res.status(409).json({
        error: 'Você ainda não criou sua senha. Vamos fazer seu primeiro acesso!',
        code: 'PRIMEIRO_ACESSO',
        via: contas[0].via,
      });
    }

    const liberadas = comSenha.filter(c => !c.senha_bloqueada_ate || new Date(c.senha_bloqueada_ate) <= new Date());
    if (liberadas.length === 0) {
      return res.status(429).json({
        error: `Muitas tentativas com senha errada. Tente de novo em ${minutosAte(comSenha[0].senha_bloqueada_ate)} min ou use "Esqueci minha senha".`,
        bloqueado: true,
      });
    }

    for (const c of liberadas) {
      if (await bcrypt.compare(String(senha), c.senha_hash)) {
        if (!c.ativo) return res.status(403).json({ error: 'Seu cadastro está desativado. Fale com o Sindicato pelo WhatsApp.', code: 'INATIVO' });
        if (c.senha_tentativas > 0 || c.senha_bloqueada_ate) {
          await db.query('UPDATE sindicato_associados SET senha_tentativas = 0, senha_bloqueada_ate = NULL WHERE id = $1', [c.id]);
        }
        // cpf_parcial: o front confere que a sessão aberta é mesmo desta conta (entrarNoPainelSeguro)
        return res.json({ token: gerarTokenPainel(c.id), nome_curto: primeiroNome(c.nome_completo), cpf_parcial: maskCpfParcial(c.cpf) });
      }
    }

    // Errou: conta a tentativa em cada conta conferida; na 5ª, bloqueia 15 min.
    const r = await db.query(
      `UPDATE sindicato_associados
       SET senha_tentativas = senha_tentativas + 1,
           senha_bloqueada_ate = CASE WHEN senha_tentativas + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval ELSE NULL END
       WHERE id = ANY($1::int[])
       RETURNING senha_tentativas`,
      [liberadas.map(c => c.id), MAX_TENTATIVAS_SENHA, String(BLOQUEIO_SENHA_MIN)]
    );
    const tentativas = Math.max(...r.rows.map(x => x.senha_tentativas));
    if (tentativas >= MAX_TENTATIVAS_SENHA) {
      return res.status(429).json({ error: `Muitas tentativas com senha errada. Tente de novo em ${BLOQUEIO_SENHA_MIN} min ou use "Esqueci minha senha".`, bloqueado: true });
    }
    return res.status(401).json({
      error: 'Senha incorreta.',
      campo: 'senha',
      tentativas_restantes: MAX_TENTATIVAS_SENHA - tentativas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos entrar agora. Tente de novo em instantes.' });
  }
}

function dataNascimentoValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

// POST /api/public/conta/primeiro-acesso  { cpf, data_nascimento, whatsapp, senha }
// Associado antigo sem senha: prova quem é pela data de nascimento do
// cadastro do Sindicato (3 erros = 30 min de bloqueio, mesmo do login
// antigo) e cria a senha. Aproveita pra pegar o WhatsApp — 183 dos 394
// antigos não têm, e é por ele que a senha é recuperada. Ganha a carteirinha
// (6 meses) se ainda não tiver.
async function primeiroAcesso(req, res) {
  try {
    const { cpf, data_nascimento, whatsapp, senha } = req.body || {};
    const cpfDigits = onlyDigits(cpf);
    const zap = onlyDigits(whatsapp);
    if (!isValidCPF(cpfDigits)) return res.status(400).json({ error: 'CPF inválido.', campo: 'cpf' });
    if (!dataNascimentoValida(data_nascimento)) return res.status(400).json({ error: 'Data de nascimento inválida.', campo: 'data_nascimento' });
    if (zap.length < 10 || zap.length > 11) return res.status(400).json({ error: 'WhatsApp inválido — use DDD + número.', campo: 'whatsapp' });
    if (String(senha || '').length < SENHA_MIN) return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`, campo: 'senha' });

    const a = (await db.query('SELECT * FROM sindicato_associados WHERE cpf = $1', [cpfDigits])).rows[0];
    if (!a) return res.status(404).json({ error: 'Não encontramos cadastro com esse CPF.', code: 'NAO_ENCONTRADO' });
    if (a.senha_hash) return res.status(409).json({ error: 'Este CPF já tem senha. É só entrar — ou use "Esqueci minha senha".', code: 'JA_TEM_SENHA' });
    if (!a.ativo) return res.status(403).json({ error: 'Seu cadastro está desativado. Fale com o Sindicato pelo WhatsApp.', code: 'INATIVO' });
    if (!a.data_nascimento) {
      return res.status(409).json({ error: 'Seu cadastro no Sindicato está sem data de nascimento. Fale com a gente pelo WhatsApp que a gente libera.', code: 'SEM_NASCIMENTO' });
    }

    const conferencia = await conferirNascimento(a, data_nascimento);
    if (!conferencia.ok) {
      return res.status(conferencia.status).json({
        ...conferencia.body,
        ...(conferencia.status === 401 && { error: 'A data de nascimento não confere com o cadastro do Sindicato.', campo: 'data_nascimento' }),
      });
    }

    const precisaCarteirinha = a.tipo_acesso === 'seci' && !a.carteirinha_hash;
    const hash = precisaCarteirinha ? await gerarHashUnico('sindicato_associados') : a.carteirinha_hash;
    const validaAte = precisaCarteirinha ? calcularValidoAte() : a.carteirinha_valida_ate;
    const editToken = a.edit_token || await gerarEditTokenUnico();

    await db.query(
      `UPDATE sindicato_associados
       SET senha_hash = $1, senha_definida_em = NOW(), senha_tentativas = 0, senha_bloqueada_ate = NULL,
           whatsapp = $2, carteirinha_hash = $3, carteirinha_valida_ate = $4,
           carteirinha_gerada_em = CASE WHEN $5 THEN NOW() ELSE carteirinha_gerada_em END,
           edit_token = $6, updated_at = NOW()
       WHERE id = $7`,
      [await bcrypt.hash(String(senha), 10), zap, hash, validaAte, precisaCarteirinha, editToken, a.id]
    );

    return res.json({ token: gerarTokenPainel(a.id), nome_curto: primeiroNome(a.nome_completo), carteirinha_nova: precisaCarteirinha });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos concluir agora. Tente de novo em instantes.' });
  }
}

module.exports = { login, primeiroAcesso, SENHA_MIN };
