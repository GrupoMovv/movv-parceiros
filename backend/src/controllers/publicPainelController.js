const db = require('../config/database');
const { substituirDependentes, GRAUS_VALIDOS } = require('./sindicatoAssociadosController');
const { gerarCarteirinhaDependentes } = require('./publicCadastroController');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { montarViewAssociado } = require('../services/associadoPublicoView');
const emailService = require('../services/emailService');
const fotoAssociadoService = require('../services/fotoAssociadoService');
const { onlyDigits, isValidCPF } = require('../utils/validators');

const MAX_DEPENDENTES_ATIVOS = 5;

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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function updateMe(req, res) {
  try {
    const associado = req.painelAssociado;
    const {
      whatsapp, email, cidade, estado, empresa, cargo, cep, endereco, numero, bairro,
      receber_whatsapp, receber_email, dependentes,
    } = req.body;

    if (email !== undefined && email?.trim() && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'E-mail inválido' });
    }
    if (whatsapp !== undefined && whatsapp.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ error: 'WhatsApp precisa ter pelo menos 10 dígitos (DDD + número)' });
    }
    if (cep !== undefined && cep && cep.replace(/\D/g, '').length !== 8) {
      return res.status(400).json({ error: 'CEP precisa ter 8 dígitos' });
    }

    const sets = [];
    const params = [];

    if (whatsapp !== undefined) { params.push(whatsapp.replace(/\D/g, '')); sets.push(`whatsapp = $${params.length}`); }
    if (email !== undefined) { params.push(email?.trim() || null); sets.push(`email = $${params.length}`); }
    if (cidade !== undefined && cidade.trim()) { params.push(cidade.trim()); sets.push(`cidade = $${params.length}`); }
    if (estado !== undefined && estado.trim()) { params.push(estado.trim().toUpperCase()); sets.push(`estado = $${params.length}`); }
    if (cargo !== undefined) { params.push(cargo?.trim() || null); sets.push(`cargo = $${params.length}`); }
    if (cep !== undefined) { params.push(cep ? cep.replace(/\D/g, '') : null); sets.push(`cep = $${params.length}`); }
    if (endereco !== undefined) { params.push(endereco?.trim() || null); sets.push(`endereco = $${params.length}`); }
    if (numero !== undefined) { params.push(numero?.trim() || null); sets.push(`numero = $${params.length}`); }
    if (bairro !== undefined) { params.push(bairro?.trim() || null); sets.push(`bairro = $${params.length}`); }
    if (receber_whatsapp !== undefined) { params.push(Boolean(receber_whatsapp)); sets.push(`receber_whatsapp = $${params.length}`); }
    if (receber_email !== undefined) { params.push(Boolean(receber_email)); sets.push(`receber_email = $${params.length}`); }
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

// Acha a menor ordem (1-6) sem dependente ATIVO — se uma linha inativa
// (removida) já ocupa esse slot, reaproveita (upsert) em vez de inserir,
// respeitando a constraint UNIQUE(associado_id, ordem). Zera os campos de
// carteirinha/foto da linha reaproveitada: senão o dependente novo herdaria
// o hash/foto de quem ocupava o slot antes.
async function inserirOuReativarDependente(associadoId, { nome, cpf, data_nascimento, grau }) {
  const ocupadas = await db.query(
    'SELECT ordem FROM sindicato_associados_dependentes WHERE associado_id = $1 AND ativo = true',
    [associadoId]
  );
  const usadas = new Set(ocupadas.rows.map(r => r.ordem));
  let ordemLivre = null;
  for (let o = 1; o <= 6; o++) { if (!usadas.has(o)) { ordemLivre = o; break; } }
  if (!ordemLivre) throw Object.assign(new Error('Sem espaço disponível'), { status: 400 });

  const existente = await db.query(
    'SELECT id, foto_public_id FROM sindicato_associados_dependentes WHERE associado_id = $1 AND ordem = $2',
    [associadoId, ordemLivre]
  );

  if (existente.rows[0]) {
    if (existente.rows[0].foto_public_id) await fotoAssociadoService.deletarFotoAntiga(existente.rows[0].foto_public_id);
    const upd = await db.query(
      `UPDATE sindicato_associados_dependentes
       SET nome = $1, cpf = $2, data_nascimento = $3, grau = $4, ativo = true, removido_em = NULL,
           carteirinha_hash = NULL, carteirinha_gerada_em = NULL, carteirinha_valida_ate = NULL,
           foto_url = NULL, foto_public_id = NULL
       WHERE id = $5 RETURNING id`,
      [nome, cpf, data_nascimento, grau, existente.rows[0].id]
    );
    return upd.rows[0].id;
  }

  const ins = await db.query(
    `INSERT INTO sindicato_associados_dependentes (associado_id, nome, ordem, cpf, data_nascimento, grau)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [associadoId, nome, ordemLivre, cpf, data_nascimento, grau]
  );
  return ins.rows[0].id;
}

async function verificarCpfDuplicado(cpfDigits, excluirDependenteId) {
  const params = excluirDependenteId ? [cpfDigits, excluirDependenteId] : [cpfDigits];
  const dup = await db.query(
    `SELECT 1 FROM sindicato_associados_dependentes WHERE cpf = $1 AND ativo = true ${excluirDependenteId ? 'AND id != $2' : ''}
     UNION SELECT 1 FROM sindicato_associados WHERE cpf = $1`,
    params
  );
  return Boolean(dup.rows[0]);
}

async function adicionarDependente(req, res) {
  try {
    const associado = req.painelAssociado;
    const { nome, cpf, data_nascimento, grau } = req.body;

    const nomeTrim = String(nome || '').trim();
    if (!nomeTrim) return res.status(400).json({ error: 'Nome é obrigatório' });
    if (grau && !GRAUS_VALIDOS.includes(grau)) return res.status(400).json({ error: 'Parentesco inválido' });

    const cpfDigits = cpf ? onlyDigits(cpf) : null;
    if (cpfDigits && !isValidCPF(cpfDigits)) return res.status(400).json({ error: 'CPF inválido' });
    if (cpfDigits && await verificarCpfDuplicado(cpfDigits)) {
      return res.status(409).json({ error: 'Esse CPF já está cadastrado no sistema' });
    }

    const ativosResult = await db.query(
      'SELECT COUNT(*)::int c FROM sindicato_associados_dependentes WHERE associado_id = $1 AND ativo = true',
      [associado.id]
    );
    if (ativosResult.rows[0].c >= MAX_DEPENDENTES_ATIVOS) {
      return res.status(400).json({ error: `Limite de ${MAX_DEPENDENTES_ATIVOS} dependentes atingido` });
    }

    const depId = await inserirOuReativarDependente(associado.id, {
      nome: nomeTrim, cpf: cpfDigits, data_nascimento: data_nascimento || null, grau: grau || null,
    });

    const novos = await gerarCarteirinhaDependentes(associado.id);
    notificarNovosDependentes(associado, novos);

    const view = await montarViewAssociado(associado);
    return res.status(201).json(view.dependentes.find(d => d.id === depId) || null);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Erro ao adicionar dependente' });
  }
}

async function editarDependente(req, res) {
  try {
    const associado = req.painelAssociado;
    const depId = Number(req.params.id);
    const { nome, cpf, data_nascimento, grau } = req.body;

    const check = await db.query(
      'SELECT id FROM sindicato_associados_dependentes WHERE id = $1 AND associado_id = $2 AND ativo = true',
      [depId, associado.id]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Dependente não encontrado' });
    if (grau !== undefined && grau && !GRAUS_VALIDOS.includes(grau)) return res.status(400).json({ error: 'Parentesco inválido' });

    const cpfDigits = cpf !== undefined ? (cpf ? onlyDigits(cpf) : null) : undefined;
    if (cpfDigits && !isValidCPF(cpfDigits)) return res.status(400).json({ error: 'CPF inválido' });
    if (cpfDigits && await verificarCpfDuplicado(cpfDigits, depId)) {
      return res.status(409).json({ error: 'Esse CPF já está cadastrado no sistema' });
    }

    const sets = [];
    const params = [];
    if (nome !== undefined) {
      const nomeTrim = String(nome).trim();
      if (!nomeTrim) return res.status(400).json({ error: 'Nome não pode ficar vazio' });
      params.push(nomeTrim); sets.push(`nome = $${params.length}`);
    }
    if (cpfDigits !== undefined) { params.push(cpfDigits); sets.push(`cpf = $${params.length}`); }
    if (data_nascimento !== undefined) { params.push(data_nascimento || null); sets.push(`data_nascimento = $${params.length}`); }
    if (grau !== undefined) { params.push(grau || null); sets.push(`grau = $${params.length}`); }

    if (sets.length) {
      params.push(depId);
      await db.query(`UPDATE sindicato_associados_dependentes SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    }

    const view = await montarViewAssociado(associado);
    return res.json(view.dependentes.find(d => d.id === depId) || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao editar dependente' });
  }
}

async function removerDependente(req, res) {
  try {
    const associado = req.painelAssociado;
    const result = await db.query(
      `UPDATE sindicato_associados_dependentes SET ativo = false, removido_em = NOW()
       WHERE id = $1 AND associado_id = $2 AND ativo = true RETURNING id`,
      [req.params.id, associado.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Dependente não encontrado' });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover dependente' });
  }
}

async function uploadFotoDependente(req, res) {
  try {
    const associado = req.painelAssociado;
    if (!req.file) return res.status(400).json({ error: 'Envie uma foto' });

    const dep = await db.query(
      'SELECT id, foto_public_id FROM sindicato_associados_dependentes WHERE id = $1 AND associado_id = $2 AND ativo = true',
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

module.exports = {
  getMe, updateMe, reenviarCarteirinha, uploadFoto, updateDependentes, uploadFotoDependente,
  adicionarDependente, editarDependente, removerDependente,
};
