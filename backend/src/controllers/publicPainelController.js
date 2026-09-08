const db = require('../config/database');
const { substituirDependentes } = require('./sindicatoAssociadosController');
const { gerarCarteirinhaDependentes } = require('./publicCadastroController');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { montarViewAssociado } = require('../services/associadoPublicoView');
const emailService = require('../services/emailService');
const fotoAssociadoService = require('../services/fotoAssociadoService');

// Dispara "novo dependente" só pra quem realmente ganhou carteirinha nessa
// chamada (gerarCarteirinhaDependentes já filtra isso) — no ar-e-fogo, não
// atrasa nem derruba a resposta do painel se o Resend falhar.
function notificarNovosDependentes(associado, novos) {
  if (!associado.email || !novos.length || !associado.carteirinha_hash) return;
  for (const dep of novos) {
    emailService.enviarNovoDependente({
      nomeTitular: associado.nome_completo,
      email: associado.email,
      dependenteNome: dep.nome,
      dependenteCarteirinhaHash: dep.carteirinha_hash,
      titularCarteirinhaHash: associado.carteirinha_hash,
    }).catch(err => console.error('[painel] falha ao enviar email de novo dependente:', err.message));
  }
}

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
    const { whatsapp, email, cidade, estado, empresa, dependentes } = req.body;
    const sets = [];
    const params = [];

    if (whatsapp !== undefined) { params.push(whatsapp.replace(/\D/g, '')); sets.push(`whatsapp = $${params.length}`); }
    if (email !== undefined) { params.push(email?.trim() || null); sets.push(`email = $${params.length}`); }
    if (cidade !== undefined && cidade.trim()) { params.push(cidade.trim()); sets.push(`cidade = $${params.length}`); }
    if (estado !== undefined && estado.trim()) { params.push(estado.trim().toUpperCase()); sets.push(`estado = $${params.length}`); }
    // Empresa é opcional e sempre em texto livre — se o Sindicato já linkou
    // o associado a um cadastro formal (empresa_id), esse campo fica "em
    // reserva" (montarViewAssociado prioriza o nome do cadastro formal),
    // então editar aqui nunca sobrescreve um vínculo que o admin fez.
    if (empresa !== undefined) { params.push(empresa?.trim() || null); sets.push(`empresa_nome_livre = $${params.length}`); }

    if (sets.length) {
      params.push(associado.id);
      await db.query(`UPDATE sindicato_associados SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
    }

    if (Array.isArray(dependentes)) {
      await substituirDependentes(associado.id, dependentes);
      const novos = await gerarCarteirinhaDependentes(associado.id);
      notificarNovosDependentes(associado, novos);
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

async function updateDependentes(req, res) {
  try {
    const associado = req.painelAssociado;
    const { dependentes } = req.body;
    if (!Array.isArray(dependentes)) return res.status(400).json({ error: 'dependentes (array) é obrigatório' });

    await substituirDependentes(associado.id, dependentes);
    const novos = await gerarCarteirinhaDependentes(associado.id);
    notificarNovosDependentes(associado, novos);

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

module.exports = { getMe, updateMe, reenviarCarteirinha, uploadFoto, updateDependentes, uploadFotoDependente };
