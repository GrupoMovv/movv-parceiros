const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { consultarDocumento } = require('../services/baseSeciService');
const { situacaoDoAssociado } = require('../services/beneficioAssociado');
const { avisarRenovacao } = require('../services/carteirinhaAvisosService');
const { sendWhatsAppMessage } = require('../services/zapApiService');
const { conferirNascimento } = require('../services/segundoFatorNascimento');
const { gerarTokenPainel } = require('../middleware/painelPublicoAuth');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { gerarEditTokenUnico } = require('./publicCadastroController');
const { maskCpfParcial } = require('../services/associadoPublicoView');
const { ipCliente } = require('../utils/ipCliente');

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpar(v, max) {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  return s ? s.slice(0, max) : '';
}

function idadeValida(iso) {
  if (!dataNascimentoValida(iso)) return false;
  const anos = (Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / (365.25 * 24 * 3600 * 1000);
  return anos >= 14 && anos <= 110;
}

// Os 4 cenários do cadastro (e do bloco "empresa" do /meu), decididos
// sozinhos pela Base SECI — a pessoa nunca escolhe "sou associado":
//   associado       CNPJ informado em dia, ou o próprio CPF é filiado em dia
//   pendencia       CNPJ (ou o CPF filiado) está na base, mas devendo
//   nao_encontrada  CNPJ informado não está na base
//   cliente         não informou CNPJ e o CPF não é filiado
async function classificarVinculo({ cpfDigits, cnpjDigits }) {
  const empresa = cnpjDigits ? await consultarDocumento(cnpjDigits) : null;
  if (empresa?.em_dia) return { cenario: 'associado', vinculo: empresa };
  const filiado = await consultarDocumento(cpfDigits);
  if (filiado?.em_dia) return { cenario: 'associado', vinculo: filiado };
  if (cnpjDigits) {
    return empresa
      ? { cenario: 'pendencia', sinalizar: { doc: cnpjDigits, nomeEmpresa: empresa.nome_fantasia || empresa.razao_social } }
      : { cenario: 'nao_encontrada', sinalizar: { doc: cnpjDigits, nomeEmpresa: null } };
  }
  if (filiado) return { cenario: 'pendencia', sinalizar: { doc: cpfDigits, nomeEmpresa: null } };
  return { cenario: 'cliente' };
}

const MENSAGEM_SINALIZACAO = {
  pendencia: 'Cadastro no IUB MAIS+ — empresa/filiado com PENDÊNCIA na Base SECI. Entrar em contato pra regularizar.',
  nao_encontrada: 'Cadastro no IUB MAIS+ — CNPJ NÃO ENCONTRADO na Base SECI. Entrar em contato pra verificar a associação.',
};

// Avisa o Sindicato em /sindicato/solicitacoes. Não repete se a mesma
// pessoa já tem aviso pendente pro mesmo documento (tentativas no /meu).
async function sinalizarSindicato(client, { associadoId, nome, whatsapp, cenario, sinalizar, origem }) {
  const jaTem = await client.query(
    `SELECT 1 FROM sindicato_solicitacoes_empresa
     WHERE associado_id = $1 AND cnpj_digitado = $2 AND status = 'pendente' LIMIT 1`,
    [associadoId, sinalizar.doc]
  );
  if (jaTem.rows[0]) return;
  await client.query(
    `INSERT INTO sindicato_solicitacoes_empresa
       (cnpj_digitado, nome_solicitante, whatsapp_solicitante, nome_empresa, mensagem, associado_id, origem, motivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sinalizar.doc, nome, whatsapp, sinalizar.nomeEmpresa, MENSAGEM_SINALIZACAO[cenario], associadoId, origem, cenario]
  );
}

function ipDe(req) {
  return ipCliente(req);
}

function validarCadastro(b) {
  const d = {
    nome: limpar(b.nome_completo, 255),
    cpf: onlyDigits(b.cpf),
    nasc: b.data_nascimento,
    zap: onlyDigits(b.whatsapp),
    email: limpar(b.email, 255).toLowerCase(),
    cep: onlyDigits(b.cep),
    endereco: limpar(b.endereco, 255),
    numero: limpar(b.numero, 20),
    bairro: limpar(b.bairro, 120),
    cidade: limpar(b.cidade, 120),
    estado: limpar(b.estado || 'GO', 2).toUpperCase(),
    cnpj: onlyDigits(b.cnpj) || null,
    senha: String(b.senha || ''),
  };
  const erro = (campo, error) => ({ erro: { error, campo } });
  if (d.nome.length < 3 || !d.nome.includes(' ')) return erro('nome_completo', 'Digite seu nome completo (nome e sobrenome).');
  if (!isValidCPF(d.cpf)) return erro('cpf', 'CPF inválido.');
  if (!idadeValida(d.nasc)) return erro('data_nascimento', 'Data de nascimento inválida.');
  if (d.zap.length < 10 || d.zap.length > 11) return erro('whatsapp', 'WhatsApp inválido — use DDD + número.');
  if (!EMAIL_RE.test(d.email)) return erro('email', 'E-mail inválido.');
  if (d.cep.length !== 8) return erro('cep', 'CEP inválido — são 8 números.');
  if (d.endereco.length < 3) return erro('endereco', 'Digite a rua.');
  if (!d.numero) return erro('numero', 'Digite o número (ou S/N).');
  if (d.bairro.length < 2) return erro('bairro', 'Digite o bairro.');
  if (d.cidade.length < 2) return erro('cidade', 'Digite a cidade.');
  if (!/^[A-Z]{2}$/.test(d.estado)) return erro('estado', 'Estado inválido.');
  if (d.cnpj && (d.cnpj.length !== 14 || !isValidCNPJ(d.cnpj))) return erro('cnpj', 'CNPJ inválido — confira ou deixe em branco.');
  if (d.senha.length < SENHA_MIN) return erro('senha', `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`);
  return { dados: d };
}

// POST /api/public/conta/criar — cadastro único ("grátis pra todos").
async function criar(req, res) {
  try {
    const { erro, dados: d } = validarCadastro(req.body || {});
    if (erro) return res.status(400).json(erro);
    const aceite = req.body.aceite_novidades === true;
    const senhaHash = await bcrypt.hash(d.senha, 10);

    const existente = (await db.query('SELECT * FROM sindicato_associados WHERE cpf = $1', [d.cpf])).rows[0];
    if (existente) {
      if (existente.senha_hash) return res.status(409).json({ error: 'Este CPF já tem conta. É só entrar.', code: 'JA_TEM_CONTA' });
      // Associado antigo que caiu no "criar conta": a data de nascimento do
      // formulário prova que é ele (mesmo bloqueio do primeiro acesso) e o
      // cadastro dele ganha senha + dados novos. Continua associado.
      if (!existente.ativo) return res.status(403).json({ error: 'Seu cadastro está desativado. Fale com o Sindicato pelo WhatsApp.', code: 'INATIVO' });
      if (!existente.data_nascimento) {
        return res.status(409).json({ error: 'Você já é associado, mas seu cadastro está sem data de nascimento. Fale com o Sindicato pelo WhatsApp que a gente libera.', code: 'SEM_NASCIMENTO' });
      }
      const conferencia = await conferirNascimento(existente, d.nasc);
      if (!conferencia.ok) {
        return res.status(conferencia.status).json({
          ...conferencia.body,
          ...(conferencia.status === 401 && { error: 'Você já é associado! Mas a data de nascimento não confere com o cadastro do Sindicato.', campo: 'data_nascimento' }),
        });
      }
      const precisaCarteirinha = existente.tipo_acesso === 'seci' && !existente.carteirinha_hash;
      const hash = precisaCarteirinha ? await gerarHashUnico('sindicato_associados') : existente.carteirinha_hash;
      await db.query(
        `UPDATE sindicato_associados
         SET senha_hash = $1, senha_definida_em = NOW(), whatsapp = $2, email = $3, cep = $4, endereco = $5,
             numero = $6, bairro = $7, cidade = $8, estado = $9,
             carteirinha_hash = $10,
             carteirinha_valida_ate = CASE WHEN $11 THEN $12::date ELSE carteirinha_valida_ate END,
             carteirinha_gerada_em = CASE WHEN $11 THEN NOW() ELSE carteirinha_gerada_em END,
             edit_token = COALESCE(edit_token, $13), updated_at = NOW()
         WHERE id = $14`,
        [senhaHash, d.zap, d.email, d.cep, d.endereco, d.numero, d.bairro, d.cidade, d.estado,
          hash, precisaCarteirinha, calcularValidoAte(), await gerarEditTokenUnico(), existente.id]
      );
      return res.json({
        token: gerarTokenPainel(existente.id), nome_curto: primeiroNome(existente.nome_completo),
        cpf_parcial: maskCpfParcial(d.cpf), cenario: 'associado_antigo',
      });
    }

    const { cenario, vinculo, sinalizar } = await classificarVinculo({ cpfDigits: d.cpf, cnpjDigits: d.cnpj });
    const ehAssociado = cenario === 'associado';
    const hash = ehAssociado ? await gerarHashUnico('sindicato_associados') : null;
    const editToken = await gerarEditTokenUnico();
    const empresaNome = ehAssociado && vinculo.tipo_documento === 'cnpj' ? (vinculo.nome_fantasia || vinculo.razao_social) : null;

    const conta = await db.transacao(async (client) => {
      const ins = await client.query(
        `INSERT INTO sindicato_associados
           (external_id, nome_completo, cpf, data_nascimento, whatsapp, email, cep, endereco, numero, bairro, cidade, estado,
            tipo_acesso, legado, empresa_seci_id, empresa_nome_livre, senha_hash, senha_definida_em, edit_token,
            receber_whatsapp, consent_at, consent_ip,
            carteirinha_hash, carteirinha_gerada_em, carteirinha_valida_ate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, false, $14, $15, $16, NOW(), $17,
                 $18, $19, $20,
                 $21, CASE WHEN $21::varchar IS NULL THEN NULL ELSE NOW() END, $22)
         RETURNING id, nome_completo`,
        [
          `CONTA-${Date.now()}-${d.cpf.slice(-4)}`, d.nome, d.cpf, d.nasc, d.zap, d.email, d.cep, d.endereco, d.numero,
          d.bairro, d.cidade, d.estado,
          ehAssociado ? 'seci' : 'cliente', ehAssociado ? vinculo.id : null, empresaNome, senhaHash, editToken,
          aceite, aceite ? new Date() : null, aceite ? ipDe(req) : null,
          hash, ehAssociado ? calcularValidoAte() : null,
        ]
      );
      const nova = ins.rows[0];
      if (sinalizar) {
        await sinalizarSindicato(client, { associadoId: nova.id, nome: d.nome, whatsapp: d.zap, cenario, sinalizar, origem: 'criar_conta' });
      }
      return nova;
    });

    return res.status(201).json({
      token: gerarTokenPainel(conta.id), nome_curto: primeiroNome(conta.nome_completo), cpf_parcial: maskCpfParcial(d.cpf),
      cenario, empresa_nome: empresaNome || sinalizar?.nomeEmpresa || null,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Este CPF já tem conta. É só entrar.', code: 'JA_TEM_CONTA' });
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos criar sua conta agora. Tente de novo em instantes.' });
  }
}

// POST /api/public/painel/empresa { cnpj? } — bloco do /meu: cliente ATIVA
// o desconto informando o CNPJ; associado RENOVA (+6 meses a partir de hoje)
// ou troca de empresa. Sem CNPJ, tenta pelo próprio CPF (filiado pessoa
// física). Nunca rebaixa ninguém: CNPJ devendo / fora da base só avisa o
// Sindicato. Legado não vence, não precisa.
async function vincularEmpresa(req, res) {
  try {
    const a = req.painelAssociado;
    if (a.tipo_acesso === 'seci' && a.legado) {
      return res.status(400).json({ error: 'Sua carteirinha é permanente — não precisa renovar.', code: 'LEGADO' });
    }
    const cnpj = onlyDigits(req.body?.cnpj) || null;
    if (cnpj && (cnpj.length !== 14 || !isValidCNPJ(cnpj))) return res.status(400).json({ error: 'CNPJ inválido — confira os números.', campo: 'cnpj' });

    const { cenario, vinculo, sinalizar } = await classificarVinculo({ cpfDigits: a.cpf, cnpjDigits: cnpj });
    if (cenario === 'cliente') return res.status(400).json({ error: 'Informe o CNPJ da empresa onde você trabalha.', campo: 'cnpj' });

    if (cenario === 'associado') {
      const eraAssociado = a.tipo_acesso === 'seci';
      const hash = a.carteirinha_hash || await gerarHashUnico('sindicato_associados');
      const empresaNome = vinculo.tipo_documento === 'cnpj' ? (vinculo.nome_fantasia || vinculo.razao_social) : a.empresa_nome_livre;
      await db.query(
        `UPDATE sindicato_associados
         SET tipo_acesso = 'seci', empresa_seci_id = $1, empresa_nome_livre = $2,
             carteirinha_hash = $3, carteirinha_gerada_em = COALESCE(carteirinha_gerada_em, NOW()),
             carteirinha_valida_ate = $4, updated_at = NOW()
         WHERE id = $5`,
        [vinculo.id, empresaNome, hash, calcularValidoAte(), a.id]
      );
      avisarRenovacao(a.id, eraAssociado ? 'renovada' : 'ativada')
        .catch(err => console.error('[aviso renovação] falhou:', err.message));
      return res.json({
        cenario: eraAssociado ? 'renovado' : 'ativado',
        empresa_nome: vinculo.tipo_documento === 'cnpj' ? empresaNome : null,
        beneficio: await situacaoDoAssociado(a.id),
      });
    }

    await db.transacao(client => sinalizarSindicato(client, {
      associadoId: a.id, nome: a.nome_completo, whatsapp: a.whatsapp, cenario, sinalizar, origem: 'meu',
    }));
    return res.json({ cenario, empresa_nome: sinalizar.nomeEmpresa });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos verificar agora. Tente de novo em instantes.' });
  }
}

const CODIGO_VALIDADE_MIN = 10;
const CODIGO_REENVIO_SEG = 60;
const CODIGOS_POR_HORA = 3;
const CODIGO_MAX_TENTATIVAS = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mascararWhatsapp(d) {
  const s = String(d || '');
  return s.length >= 10 ? `(${s.slice(0, 2)}) *****-${s.slice(-4)}` : '*****';
}

// POST /api/public/conta/esqueci-senha  { login: CPF ou WhatsApp, cpf? }
// Manda um código de 6 dígitos pro WhatsApp da conta. Se o número digitado
// é WhatsApp de mais de uma conta (família no mesmo celular), pede o CPF.
async function esqueciSenha(req, res) {
  try {
    const contas = await buscarContas(req.body?.login);
    if (!contas) return res.status(400).json({ error: 'Digite seu CPF ou seu WhatsApp com DDD.', campo: 'login' });
    if (contas.length === 0) return res.status(404).json({ error: 'Não encontramos conta com esse CPF ou WhatsApp.', code: 'NAO_ENCONTRADO' });

    let alvo = contas.filter(c => c.senha_hash);
    if (alvo.length === 0) {
      return res.status(409).json({ error: 'Você ainda não criou sua senha. Vamos fazer seu primeiro acesso!', code: 'PRIMEIRO_ACESSO', via: contas[0].via });
    }
    if (alvo.length > 1) {
      const cpf = onlyDigits(req.body?.cpf);
      if (!cpf) return res.status(409).json({ error: 'Esse WhatsApp está em mais de uma conta. Digite também o seu CPF.', code: 'INFORME_CPF' });
      alvo = alvo.filter(c => c.cpf === cpf);
      if (alvo.length === 0) return res.status(404).json({ error: 'Esse CPF não bate com a conta desse WhatsApp.', code: 'NAO_ENCONTRADO', campo: 'cpf' });
    }
    const c = alvo[0];
    if (!c.ativo) return res.status(403).json({ error: 'Seu cadastro está desativado. Fale com o Sindicato pelo WhatsApp.', code: 'INATIVO' });
    if (!c.whatsapp) return res.status(409).json({ error: 'Sua conta está sem WhatsApp cadastrado. Fale com o suporte que a gente te ajuda.', code: 'SEM_WHATSAPP' });

    const hist = (await db.query(
      `SELECT COUNT(*) FILTER (WHERE criado_em > NOW() - interval '1 hour')::int AS na_hora,
              EXTRACT(EPOCH FROM (NOW() - MAX(criado_em)))::int AS seg_desde_ultimo
       FROM senha_codigos WHERE associado_id = $1`,
      [c.id]
    )).rows[0];
    if (hist.seg_desde_ultimo !== null && hist.seg_desde_ultimo < CODIGO_REENVIO_SEG) {
      const aguarde = CODIGO_REENVIO_SEG - hist.seg_desde_ultimo;
      return res.status(429).json({ error: `Aguarde ${aguarde}s pra pedir outro código.`, code: 'AGUARDE', aguarde_seg: aguarde });
    }
    if (hist.na_hora >= CODIGOS_POR_HORA) {
      return res.status(429).json({ error: 'Você já pediu vários códigos. Tente de novo daqui a 1 hora ou fale com o suporte.', code: 'LIMITE_CODIGOS' });
    }

    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    // Pedido novo invalida os anteriores ainda abertos.
    await db.query('UPDATE senha_codigos SET expira_em = NOW() WHERE associado_id = $1 AND usado_em IS NULL AND expira_em > NOW()', [c.id]);
    const pedido = (await db.query(
      `INSERT INTO senha_codigos (associado_id, codigo_hash, expira_em, ip)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4) RETURNING id`,
      [c.id, await bcrypt.hash(codigo, 8), String(CODIGO_VALIDADE_MIN), ipDe(req)]
    )).rows[0].id;

    const envio = await sendWhatsAppMessage(c.whatsapp,
      `🔐 *IUB MAIS+*\n\nSeu código pra criar uma nova senha é: *${codigo}*\n\nVale por ${CODIGO_VALIDADE_MIN} minutos. Não passe esse código pra ninguém — nem pra quem disser que é do IUB MAIS+.\n\nNão pediu? É só ignorar esta mensagem.`);
    if (!envio.success) {
      await db.query('DELETE FROM senha_codigos WHERE id = $1', [pedido]);
      return res.status(503).json({ error: 'Não conseguimos enviar o código pelo WhatsApp agora. Tente de novo em alguns minutos ou fale com o suporte.', code: 'ENVIO_FALHOU' });
    }

    return res.json({ pedido, whatsapp_mascarado: mascararWhatsapp(c.whatsapp), validade_min: CODIGO_VALIDADE_MIN, reenvio_seg: CODIGO_REENVIO_SEG });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos enviar o código agora. Tente de novo em instantes.' });
  }
}

// POST /api/public/conta/redefinir-senha  { pedido, codigo, senha }
// Código certo = senha nova + já entra logado. 5 códigos errados queimam o
// pedido (precisa pedir outro).
async function redefinirSenha(req, res) {
  try {
    const { pedido, senha } = req.body || {};
    const codigo = onlyDigits(req.body?.codigo);
    if (!UUID_RE.test(String(pedido || ''))) return res.status(400).json({ error: 'Pedido inválido. Peça um código novo.', code: 'CODIGO_EXPIRADO' });
    if (codigo.length !== 6) return res.status(400).json({ error: 'O código tem 6 números.', campo: 'codigo' });
    if (String(senha || '').length < SENHA_MIN) return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`, campo: 'senha' });

    const p = (await db.query('SELECT * FROM senha_codigos WHERE id = $1', [pedido])).rows[0];
    if (!p || p.usado_em || new Date(p.expira_em) <= new Date()) {
      return res.status(410).json({ error: 'Esse código expirou. Peça um novo.', code: 'CODIGO_EXPIRADO' });
    }
    if (p.tentativas >= CODIGO_MAX_TENTATIVAS) {
      return res.status(429).json({ error: 'Muitas tentativas com código errado. Peça um código novo.', code: 'CODIGO_EXPIRADO' });
    }

    if (!(await bcrypt.compare(codigo, p.codigo_hash))) {
      const t = (await db.query('UPDATE senha_codigos SET tentativas = tentativas + 1 WHERE id = $1 RETURNING tentativas', [p.id])).rows[0].tentativas;
      if (t >= CODIGO_MAX_TENTATIVAS) return res.status(429).json({ error: 'Muitas tentativas com código errado. Peça um código novo.', code: 'CODIGO_EXPIRADO' });
      return res.status(401).json({ error: `Código incorreto. Restam ${CODIGO_MAX_TENTATIVAS - t} tentativa(s).`, campo: 'codigo' });
    }

    const conta = await db.transacao(async (client) => {
      // "usado_em IS NULL" no WHERE: o mesmo código não troca a senha duas vezes.
      const uso = await client.query('UPDATE senha_codigos SET usado_em = NOW() WHERE id = $1 AND usado_em IS NULL RETURNING associado_id', [p.id]);
      if (!uso.rows[0]) return null;
      await client.query('UPDATE senha_codigos SET expira_em = NOW() WHERE associado_id = $1 AND usado_em IS NULL', [p.associado_id]);
      const r = await client.query(
        `UPDATE sindicato_associados
         SET senha_hash = $1, senha_definida_em = NOW(), senha_tentativas = 0, senha_bloqueada_ate = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING id, nome_completo, cpf`,
        [await bcrypt.hash(String(senha), 10), p.associado_id]
      );
      return r.rows[0];
    });
    if (!conta) return res.status(410).json({ error: 'Esse código já foi usado. Peça um novo.', code: 'CODIGO_EXPIRADO' });

    return res.json({ token: gerarTokenPainel(conta.id), nome_curto: primeiroNome(conta.nome_completo), cpf_parcial: maskCpfParcial(conta.cpf) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Não conseguimos trocar a senha agora. Tente de novo em instantes.' });
  }
}

module.exports = { login, primeiroAcesso, criar, vincularEmpresa, esqueciSenha, redefinirSenha, SENHA_MIN };
