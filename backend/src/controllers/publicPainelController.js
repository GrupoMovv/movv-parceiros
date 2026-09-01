const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { substituirDependentes } = require('./sindicatoAssociadosController');
const { gerarCarteirinhaDependentes } = require('./publicCadastroController');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { montarViewAssociado } = require('../services/associadoPublicoView');

const UPLOAD_DIR_ASSOCIADO = path.join(__dirname, '../../uploads/associados');
const UPLOAD_DIR_DEPENDENTE = path.join(__dirname, '../../uploads/dependentes');
fs.mkdirSync(UPLOAD_DIR_ASSOCIADO, { recursive: true });
fs.mkdirSync(UPLOAD_DIR_DEPENDENTE, { recursive: true });

async function getMe(req, res) {
  try {
    return res.json(await montarViewAssociado(req.painelAssociado));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar cadastro' });
  }
}

// Mesmos campos editáveis do /meu-cadastro/:edit_token, mais cidade/estado
// (o painel novo pede tudo que a tela de "Editar dados" promete). Nunca
// CPF, CNPJ da empresa ou data de nascimento do titular.
async function updateMe(req, res) {
  try {
    const associado = req.painelAssociado;
    const { whatsapp, email, cidade, estado, dependentes } = req.body;
    const sets = [];
    const params = [];

    if (whatsapp !== undefined) { params.push(whatsapp.replace(/\D/g, '')); sets.push(`whatsapp = $${params.length}`); }
    if (email !== undefined) { params.push(email?.trim() || null); sets.push(`email = $${params.length}`); }
    if (cidade !== undefined && cidade.trim()) { params.push(cidade.trim()); sets.push(`cidade = $${params.length}`); }
    if (estado !== undefined && estado.trim()) { params.push(estado.trim().toUpperCase()); sets.push(`estado = $${params.length}`); }

    if (sets.length) {
      params.push(associado.id);
      await db.query(`UPDATE sindicato_associados SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
    }

    if (Array.isArray(dependentes)) {
      await substituirDependentes(associado.id, dependentes);
      await gerarCarteirinhaDependentes(associado.id);
    }

    const atualizado = await db.query('SELECT * FROM sindicato_associados WHERE id = $1', [associado.id]);
    return res.json(await montarViewAssociado(atualizado.rows[0]));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar cadastro' });
  }
}

async function reenviarCarteirinha(req, res) {
  try {
    let associado = req.painelAssociado;
    if (!associado.carteirinha_hash) {
      const hash = await gerarHashUnico('sindicato_associados');
      const validaAte = calcularValidoAte();
      const upd = await db.query(
        `UPDATE sindicato_associados
         SET carteirinha_hash = $1, carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [hash, validaAte, associado.id]
      );
      associado = upd.rows[0];
    }

    const depResult = await db.query(
      `SELECT nome, grau, carteirinha_hash FROM sindicato_associados_dependentes
       WHERE associado_id = $1 AND carteirinha_hash IS NOT NULL`,
      [associado.id]
    );

    return res.json({
      nome_completo: associado.nome_completo,
      whatsapp: associado.whatsapp,
      carteirinha_hash: associado.carteirinha_hash,
      dependentes: depResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reenviar carteirinha' });
  }
}

async function uploadFoto(req, res) {
  try {
    const associado = req.painelAssociado;
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

async function updateDependentes(req, res) {
  try {
    const associado = req.painelAssociado;
    const { dependentes } = req.body;
    if (!Array.isArray(dependentes)) return res.status(400).json({ error: 'dependentes (array) é obrigatório' });

    await substituirDependentes(associado.id, dependentes);
    await gerarCarteirinhaDependentes(associado.id);

    const view = await montarViewAssociado(associado);
    return res.json(view.dependentes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar dependentes' });
  }
}

async function uploadFotoDependente(req, res) {
  try {
    const associado = req.painelAssociado;
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

module.exports = { getMe, updateMe, reenviarCarteirinha, uploadFoto, updateDependentes, uploadFotoDependente };
