const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { onlyDigits } = require('../utils/validators');
const { substituirDependentes } = require('./sindicatoAssociadosController');
const { gerarCarteirinhaDependentes } = require('./publicCadastroController');

const UPLOAD_DIR_ASSOCIADO = path.join(__dirname, '../../uploads/associados');
const UPLOAD_DIR_DEPENDENTE = path.join(__dirname, '../../uploads/dependentes');
fs.mkdirSync(UPLOAD_DIR_ASSOCIADO, { recursive: true });
fs.mkdirSync(UPLOAD_DIR_DEPENDENTE, { recursive: true });

// Mostra só os 3 primeiros e os 2 últimos dígitos — o link de edição já é o
// "segredo" de acesso, isso aqui é só pra pessoa confirmar que é o cadastro
// dela, não pra reexibir o CPF completo numa página sem login.
function maskCpfParcial(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

async function buscarPorToken(token) {
  const result = await db.query('SELECT * FROM sindicato_associados WHERE edit_token = $1', [token]);
  return result.rows[0] || null;
}

async function getMeuCadastro(req, res) {
  try {
    const associado = await buscarPorToken(req.params.edit_token);
    if (!associado) return res.status(404).json({ error: 'Cadastro não encontrado' });

    const empresaResult = associado.empresa_id
      ? await db.query('SELECT nome_fantasia, razao_social FROM sindicato_empresas WHERE id = $1', [associado.empresa_id])
      : null;
    const empresaNome = empresaResult?.rows[0]
      ? (empresaResult.rows[0].nome_fantasia || empresaResult.rows[0].razao_social)
      : associado.empresa_nome_livre;

    const depResult = await db.query(
      `SELECT id, nome, grau, data_nascimento, foto_url, carteirinha_hash
       FROM sindicato_associados_dependentes WHERE associado_id = $1 ORDER BY ordem ASC`,
      [associado.id]
    );

    return res.json({
      nome_completo: associado.nome_completo,
      cpf_parcial: maskCpfParcial(associado.cpf),
      whatsapp: associado.whatsapp,
      email: associado.email,
      foto_url: associado.foto_url,
      categoria_profissional: associado.categoria_profissional,
      cidade: associado.cidade,
      estado: associado.estado,
      empresa: empresaNome,
      carteirinha_hash: associado.carteirinha_hash,
      dependentes: depResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar cadastro' });
  }
}

// Só campos de contato + lista de dependentes (nome/grau/nascimento) — nunca
// CPF, CNPJ da empresa ou data de nascimento do titular.
async function updateMeuCadastro(req, res) {
  try {
    const associado = await buscarPorToken(req.params.edit_token);
    if (!associado) return res.status(404).json({ error: 'Cadastro não encontrado' });

    const { whatsapp, email, dependentes } = req.body;
    const sets = [];
    const params = [];
    if (whatsapp !== undefined) {
      params.push(onlyDigits(whatsapp));
      sets.push(`whatsapp = $${params.length}`);
    }
    if (email !== undefined) {
      params.push(email?.trim() || null);
      sets.push(`email = $${params.length}`);
    }

    if (sets.length) {
      params.push(associado.id);
      await db.query(`UPDATE sindicato_associados SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
    }

    if (Array.isArray(dependentes)) {
      await substituirDependentes(associado.id, dependentes);
      await gerarCarteirinhaDependentes(associado.id);
    }

    return getMeuCadastro(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar cadastro' });
  }
}

async function updateFotoTitular(req, res) {
  try {
    const associado = await buscarPorToken(req.params.edit_token);
    if (!associado) return res.status(404).json({ error: 'Cadastro não encontrado' });
    if (!req.file) return res.status(400).json({ error: 'Envie uma foto' });

    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const filename = `associado_${associado.id}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR_ASSOCIADO, filename), req.file.buffer);
    const fotoUrl = `/uploads/associados/${filename}`;

    await db.query('UPDATE sindicato_associados SET foto_url = $1, updated_at = NOW() WHERE id = $2', [fotoUrl, associado.id]);
    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (associado_id, tipo_dono, url_arquivo) VALUES ($1, 'associado', $2)`,
      [associado.id, fotoUrl]
    );

    return res.json({ foto_url: fotoUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar foto' });
  }
}

async function updateFotoDependente(req, res) {
  try {
    const associado = await buscarPorToken(req.params.edit_token);
    if (!associado) return res.status(404).json({ error: 'Cadastro não encontrado' });
    if (!req.file) return res.status(400).json({ error: 'Envie uma foto' });

    const dep = await db.query(
      'SELECT id FROM sindicato_associados_dependentes WHERE id = $1 AND associado_id = $2',
      [req.params.dependente_id, associado.id]
    );
    if (!dep.rows[0]) return res.status(404).json({ error: 'Dependente não encontrado' });

    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const filename = `dependente_${dep.rows[0].id}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR_DEPENDENTE, filename), req.file.buffer);
    const fotoUrl = `/uploads/dependentes/${filename}`;

    await db.query('UPDATE sindicato_associados_dependentes SET foto_url = $1 WHERE id = $2', [fotoUrl, dep.rows[0].id]);
    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (dependente_id, tipo_dono, url_arquivo) VALUES ($1, 'dependente', $2)`,
      [dep.rows[0].id, fotoUrl]
    );

    return res.json({ foto_url: fotoUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar foto' });
  }
}

module.exports = { getMeuCadastro, updateMeuCadastro, updateFotoTitular, updateFotoDependente };
