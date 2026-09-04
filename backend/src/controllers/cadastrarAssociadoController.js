const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { substituirDependentes } = require('./sindicatoAssociadosController');
const { gerarCarteirinhaDependentes } = require('./publicCadastroController');
const { gerarTokenPainel } = require('../middleware/painelPublicoAuth');
const emailService = require('../services/emailService');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/associados');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function gerarEditTokenUnico() {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const token = nanoid(32);
    const existe = await db.query('SELECT 1 FROM sindicato_associados WHERE edit_token = $1', [token]);
    if (!existe.rows[0]) return token;
  }
  throw new Error('Não foi possível gerar um token de edição único');
}

// Tela 2 do wizard /cadastrar-associado: prova de identidade é achar o CPF
// na lista aprovada daquela empresa específica (CNPJ) — nunca busca só por
// CPF sozinho, pra não vazar "esse CPF está em alguma lista" sem saber a
// empresa certa.
async function verificarElegibilidade(req, res) {
  try {
    const cpf = onlyDigits(req.body.cpf);
    const cnpj = onlyDigits(req.body.cnpj);
    if (!isValidCPF(cpf)) return res.status(400).json({ error: 'CPF inválido' });
    if (!isValidCNPJ(cnpj)) return res.status(400).json({ error: 'CNPJ inválido' });

    const result = await db.query(
      `SELECT * FROM sindicato_lista_aprovada WHERE cpf_colaborador = $1 AND cnpj_empresa = $2`,
      [cpf, cnpj]
    );
    const registro = result.rows[0];
    if (!registro) {
      return res.status(404).json({ error: 'CPF não encontrado na lista da sua empresa. Confirme os dados ou entre em contato com o RH.' });
    }

    if (registro.status === 'cancelado') {
      return res.status(403).json({ error: 'Seu acesso foi cancelado. Entre em contato com o RH ou com o Sindicato.' });
    }

    if (registro.status === 'ativado') {
      return res.status(409).json({ error: 'Você já possui carteirinha. Faça login no Marketplace com seu CPF e data de nascimento.', ja_ativado: true });
    }

    return res.json({
      lista_id: registro.id,
      nome: registro.nome_colaborador,
      cpf: registro.cpf_colaborador,
      cnpj: registro.cnpj_empresa,
      razao_social_empresa: registro.razao_social_empresa,
      matricula_interna: registro.matricula_interna,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao validar seus dados' });
  }
}

// Tela 4: completa o cadastro e ativa a carteirinha na hora. Reaproveita a
// mesma lógica de geração de carteirinha do autocadastro tradicional
// (finalizarCadastro), mas os dados de identidade (nome/CPF/empresa) vêm
// da lista aprovada, não do formulário — o colaborador não pode alterá-los.
async function completarCadastro(req, res) {
  try {
    const { lista_id, data_nascimento, whatsapp, email, cidade, estado, dependentes, aceite_termos } = req.body;

    if (!lista_id || !data_nascimento || !whatsapp) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    }
    if (String(aceite_termos) !== 'true') {
      return res.status(400).json({ error: 'É necessário aceitar os termos e o regulamento SECI' });
    }
    if (!req.file) return res.status(400).json({ error: 'Foto é obrigatória' });

    const listaResult = await db.query('SELECT * FROM sindicato_lista_aprovada WHERE id = $1', [lista_id]);
    const registro = listaResult.rows[0];
    if (!registro) return res.status(404).json({ error: 'Registro não encontrado' });
    if (registro.status === 'cancelado') return res.status(403).json({ error: 'Seu acesso foi cancelado. Entre em contato com o RH ou com o Sindicato.' });
    if (registro.status === 'ativado') return res.status(409).json({ error: 'Você já ativou essa carteirinha. Faça login no Marketplace.' });

    const jaExiste = await db.query('SELECT id FROM sindicato_associados WHERE cpf = $1', [registro.cpf_colaborador]);
    if (jaExiste.rows[0]) return res.status(409).json({ error: 'Este CPF já possui cadastro. Use a opção de login.' });

    let dependentesArr = [];
    if (dependentes) {
      try { dependentesArr = JSON.parse(dependentes); } catch { dependentesArr = []; }
    }

    const externalId = `LISTA-${registro.id}`;
    const editToken = await gerarEditTokenUnico();
    const ipOrigem = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;

    const insertResult = await db.query(
      `INSERT INTO sindicato_associados
         (external_id, nome_completo, cpf, data_nascimento, whatsapp, email, cidade, estado,
          empresa_nome_livre, edit_token, consent_at, consent_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
       RETURNING *`,
      [
        externalId, registro.nome_colaborador, registro.cpf_colaborador, data_nascimento,
        onlyDigits(whatsapp), email?.trim() || null, cidade?.trim() || null, estado?.trim().toUpperCase() || null,
        registro.razao_social_empresa, editToken, ipOrigem,
      ]
    );

    let associado = insertResult.rows[0];
    await substituirDependentes(associado.id, dependentesArr);

    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const filename = `associado_${associado.id}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
    const fotoUrl = `/uploads/associados/${filename}`;

    const hash = await gerarHashUnico('sindicato_associados');
    const validaAte = calcularValidoAte();
    const updResult = await db.query(
      `UPDATE sindicato_associados
       SET foto_url = $1, carteirinha_hash = $2, carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [fotoUrl, hash, validaAte, associado.id]
    );
    associado = updResult.rows[0];

    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (associado_id, tipo_dono, url_arquivo) VALUES ($1, 'associado', $2)`,
      [associado.id, fotoUrl]
    );

    await gerarCarteirinhaDependentes(associado.id);

    await db.query(
      `UPDATE sindicato_lista_aprovada SET status = 'ativado', ativado_em = NOW(), associado_id = $1, updated_at = NOW() WHERE id = $2`,
      [associado.id, registro.id]
    );

    if (associado.email) {
      emailService.enviarCarteirinhaAtivada({
        nome: associado.nome_completo,
        email: associado.email,
        carteirinhaHash: associado.carteirinha_hash,
      }).catch(err => console.error('[cadastrar-associado] falha ao enviar email:', err.message));
    }

    return res.status(201).json({
      nome_completo: associado.nome_completo,
      foto_url: associado.foto_url,
      carteirinha_hash: associado.carteirinha_hash,
      carteirinha_valida_ate: associado.carteirinha_valida_ate,
      whatsapp: associado.whatsapp,
      matricula_interna: registro.matricula_interna,
      token: gerarTokenPainel(associado.id),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao completar cadastro' });
  }
}

module.exports = { verificarElegibilidade, completarCadastro };
