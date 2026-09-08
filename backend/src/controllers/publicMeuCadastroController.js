const db = require('../config/database');
const { onlyDigits } = require('../utils/validators');
const { substituirDependentes } = require('./sindicatoAssociadosController');
const { gerarCarteirinhaDependentes } = require('./publicCadastroController');
const { montarViewAssociado } = require('../services/associadoPublicoView');
const fotoAssociadoService = require('../services/fotoAssociadoService');

async function buscarPorToken(token) {
  const result = await db.query('SELECT * FROM sindicato_associados WHERE edit_token = $1', [token]);
  return result.rows[0] || null;
}

async function getMeuCadastro(req, res) {
  try {
    const associado = await buscarPorToken(req.params.edit_token);
    if (!associado) return res.status(404).json({ error: 'Cadastro não encontrado' });
    return res.json(await montarViewAssociado(associado));
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

    const { url: fotoUrl, publicId } = await fotoAssociadoService.uploadFotoAssociado(req.file.buffer, associado.id);

    await db.query('UPDATE sindicato_associados SET foto_url = $1, foto_public_id = $2, updated_at = NOW() WHERE id = $3', [fotoUrl, publicId, associado.id]);
    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (associado_id, tipo_dono, url_arquivo) VALUES ($1, 'associado', $2)`,
      [associado.id, fotoUrl]
    );
    if (associado.foto_public_id) await fotoAssociadoService.deletarFotoAntiga(associado.foto_public_id);

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
      'SELECT id, foto_public_id FROM sindicato_associados_dependentes WHERE id = $1 AND associado_id = $2',
      [req.params.dependente_id, associado.id]
    );
    if (!dep.rows[0]) return res.status(404).json({ error: 'Dependente não encontrado' });

    const { url: fotoUrl, publicId } = await fotoAssociadoService.uploadFotoDependente(req.file.buffer, dep.rows[0].id);

    await db.query('UPDATE sindicato_associados_dependentes SET foto_url = $1, foto_public_id = $2 WHERE id = $3', [fotoUrl, publicId, dep.rows[0].id]);
    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (dependente_id, tipo_dono, url_arquivo) VALUES ($1, 'dependente', $2)`,
      [dep.rows[0].id, fotoUrl]
    );
    if (dep.rows[0].foto_public_id) await fotoAssociadoService.deletarFotoAntiga(dep.rows[0].foto_public_id);

    return res.json({ foto_url: fotoUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar foto' });
  }
}

module.exports = { getMeuCadastro, updateMeuCadastro, updateFotoTitular, updateFotoDependente };
