const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { gerarTokenPainel } = require('../middleware/painelPublicoAuth');
const { gerarTokenParceiro } = require('../middleware/parceiroAuth');
const { maskCpfParcial } = require('./associadoPublicoView');
const { parceiroPublico, STATUS_PERMITEM_LOGIN } = require('../controllers/parceiroAuthController');

// Login único do IUB MAIS+ (/entrar): um campo "CPF, CNPJ, e-mail ou
// WhatsApp" que serve pra PESSOA (sindicato_associados -> /meu) e pra
// EMPRESA parceira (sindicato_parceiro_usuarios -> /parceiro/painel). As
// sessões continuam separadas (JWT de painel e JWT de parceiro); só a porta
// de entrada é uma. Quando o mesmo identificador acha as duas, a senha decide;
// se a senha bate nas duas, a tela pergunta "pessoa ou empresa".
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;

// WhatsApp antigo às vezes está sem o 9 (10 dígitos) e a pessoa digita com
// o 9 (11), ou o contrário — procura as duas formas.
function variantesWhatsapp(d) {
  const v = new Set([d]);
  if (d.length === 11 && d[2] === '9') v.add(d.slice(0, 2) + d.slice(3));
  if (d.length === 10) v.add(`${d.slice(0, 2)}9${d.slice(2)}`);
  return [...v];
}

// O que a pessoa digitou: e-mail (tem @), CNPJ (14 dígitos válidos) ou
// número de 10/11 dígitos (CPF e/ou WhatsApp — 11 dígitos pode ser os dois).
// WhatsApp colado com o 55 na frente também vale. null = não dá pra usar.
function classificar(entrada) {
  const bruto = String(entrada || '').trim();
  if (bruto.includes('@')) return { email: bruto.toLowerCase() };
  let d = onlyDigits(bruto);
  if (d.length === 14 && isValidCNPJ(d)) return { cnpj: d };
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) return { numero: d, cpf: d.length === 11 && isValidCPF(d) ? d : null };
  return null;
}

async function buscarPessoas(c, soWhatsapp) {
  if (c.cnpj) return [];
  const colunas = 'id, nome_completo, cpf, whatsapp, ativo, senha_hash, senha_tentativas, senha_bloqueada_ate';
  let r;
  if (c.email) {
    if (soWhatsapp) return [];
    r = await db.query(`SELECT ${colunas} FROM sindicato_associados WHERE lower(email) = $1`, [c.email]);
    return r.rows.map(p => ({ ...p, tipo: 'pessoa', via: 'email' }));
  }
  const cpf = soWhatsapp ? null : c.cpf;
  r = await db.query(
    `SELECT ${colunas} FROM sindicato_associados
     WHERE ($1::varchar IS NOT NULL AND cpf = $1) OR whatsapp = ANY($2::varchar[])`,
    [cpf, variantesWhatsapp(c.numero)]
  );
  return r.rows.map(p => ({ ...p, tipo: 'pessoa', via: cpf && p.cpf === cpf ? 'cpf' : 'whatsapp' }));
}

async function buscarEmpresas(c, soWhatsapp) {
  const sel = `SELECT u.id, u.email, u.senha_hash, u.ativo, u.cargo, u.whatsapp_pessoal,
                      u.tentativas_login, u.ultima_tentativa_em, row_to_json(p) AS parceiro
               FROM sindicato_parceiro_usuarios u JOIN sindicato_parceiros p ON p.id = u.parceiro_id`;
  let r;
  if (c.email) {
    if (soWhatsapp) return [];
    r = await db.query(`${sel} WHERE lower(u.email) = $1`, [c.email]);
    return r.rows.map(e => ({ ...e, tipo: 'empresa', via: 'email' }));
  }
  if (c.cnpj) {
    if (soWhatsapp) return [];
    r = await db.query(`${sel} WHERE regexp_replace(COALESCE(p.cnpj, ''), '\\D', '', 'g') = $1`, [c.cnpj]);
    return r.rows.map(e => ({ ...e, tipo: 'empresa', via: 'cnpj' }));
  }
  // WhatsApp pessoal do usuário (não o WhatsApp público da loja): pode estar
  // gravado com ou sem o 55.
  const zaps = variantesWhatsapp(c.numero);
  r = await db.query(
    `${sel} WHERE regexp_replace(COALESCE(u.whatsapp_pessoal, ''), '\\D', '', 'g') = ANY($1::varchar[])`,
    [[...zaps, ...zaps.map(z => `55${z}`)]]
  );
  return r.rows.map(e => ({ ...e, tipo: 'empresa', via: 'whatsapp' }));
}

// null = entrada inválida; [] = não achou ninguém.
async function buscarContasLogin(entrada, { soWhatsapp = false } = {}) {
  const c = classificar(entrada);
  if (!c || (soWhatsapp && !c.numero)) return null;
  const [pessoas, empresas] = await Promise.all([buscarPessoas(c, soWhatsapp), buscarEmpresas(c, soWhatsapp)]);
  return [...pessoas, ...empresas];
}

// Até quando está bloqueada (null = liberada). Pessoa guarda o fim do
// bloqueio; empresa guarda tentativas + hora da última (colunas que já
// existiam em sindicato_parceiro_usuarios).
function bloqueadaAte(c) {
  if (c.tipo === 'pessoa') {
    return c.senha_bloqueada_ate && new Date(c.senha_bloqueada_ate) > new Date() ? new Date(c.senha_bloqueada_ate) : null;
  }
  if (c.tentativas_login >= MAX_TENTATIVAS && c.ultima_tentativa_em) {
    const fim = new Date(new Date(c.ultima_tentativa_em).getTime() + BLOQUEIO_MIN * 60000);
    return fim > new Date() ? fim : null;
  }
  return null;
}

// Senha errada: soma uma tentativa em cada conta conferida. Devolve o maior
// número de tentativas (pra dizer quantas restam / se bloqueou).
async function registrarFalha(contas) {
  let maior = 0;
  const pessoas = contas.filter(c => c.tipo === 'pessoa').map(c => c.id);
  if (pessoas.length) {
    const r = await db.query(
      `UPDATE sindicato_associados
       SET senha_tentativas = senha_tentativas + 1,
           senha_bloqueada_ate = CASE WHEN senha_tentativas + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval ELSE NULL END
       WHERE id = ANY($1::int[]) RETURNING senha_tentativas AS t`,
      [pessoas, MAX_TENTATIVAS, String(BLOQUEIO_MIN)]
    );
    maior = Math.max(maior, ...r.rows.map(x => x.t));
  }
  const empresas = contas.filter(c => c.tipo === 'empresa').map(c => c.id);
  if (empresas.length) {
    // Janela de 15 min: errou de novo depois disso, recomeça a contagem.
    const r = await db.query(
      `UPDATE sindicato_parceiro_usuarios
       SET tentativas_login = CASE WHEN ultima_tentativa_em IS NULL OR ultima_tentativa_em < NOW() - ($2 || ' minutes')::interval
                                   THEN 1 ELSE tentativas_login + 1 END,
           ultima_tentativa_em = NOW()
       WHERE id = ANY($1::int[]) RETURNING tentativas_login AS t`,
      [empresas, String(BLOQUEIO_MIN)]
    );
    maior = Math.max(maior, ...r.rows.map(x => x.t));
  }
  return maior;
}

async function zerarTentativas(c) {
  if (c.tipo === 'pessoa') {
    if (c.senha_tentativas > 0 || c.senha_bloqueada_ate) {
      await db.query('UPDATE sindicato_associados SET senha_tentativas = 0, senha_bloqueada_ate = NULL WHERE id = $1', [c.id]);
    }
  } else {
    await db.query('UPDATE sindicato_parceiro_usuarios SET tentativas_login = 0, ultima_tentativa_em = NULL, ultimo_login = NOW() WHERE id = $1', [c.id]);
  }
}

// Conta com a senha certa mas que não pode entrar. null = pode.
function impedimento(c) {
  if (c.tipo === 'pessoa') {
    return c.ativo ? null : { status: 403, body: { error: 'Seu cadastro está desativado. Fale com o Sindicato pelo WhatsApp.', code: 'INATIVO' } };
  }
  if (!c.ativo) return { status: 403, body: { error: 'Seu acesso de empresa está desativado. Fale com o IUB MAIS+ pelo WhatsApp.', code: 'INATIVO' } };
  if (!STATUS_PERMITEM_LOGIN.includes(c.parceiro?.status)) {
    return { status: 403, body: { error: 'Sua loja está inativa no momento. Fale com o Sindicato pra reativar o acesso.', code: 'LOJA_INATIVA' } };
  }
  return null;
}

// O que o front recebe pra abrir a sessão certa.
function sessao(c) {
  if (c.tipo === 'pessoa') {
    return {
      tipo: 'pessoa',
      token: gerarTokenPainel(c.id),
      nome_curto: String(c.nome_completo || '').trim().split(/\s+/)[0] || null,
      // o front confere que a sessão aberta é mesmo desta conta (entrarNoPainelSeguro)
      cpf_parcial: maskCpfParcial(c.cpf),
    };
  }
  return {
    tipo: 'empresa',
    token: gerarTokenParceiro({ parceiroId: c.parceiro.id, usuarioId: c.id, cargo: c.cargo }),
    parceiro: parceiroPublico(c.parceiro),
    usuario: { id: c.id, email: c.email, cargo: c.cargo },
    nome_curto: c.parceiro.nome,
  };
}

module.exports = {
  MAX_TENTATIVAS, BLOQUEIO_MIN, variantesWhatsapp, classificar, buscarContasLogin,
  bloqueadaAte, registrarFalha, zerarTentativas, impedimento, sessao,
};
