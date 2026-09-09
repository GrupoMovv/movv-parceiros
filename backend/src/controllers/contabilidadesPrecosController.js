const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { onlyDigits, isValidCNPJ } = require('../utils/validators');

// Contabilidade agora é só cadastro (nome, CNPJ, contato, cidade,
// responsável) — sem preço fixo. Fernando negocia valor da venda e
// comissão da contabilidade caso a caso, direto no registro da venda (ver
// diretaSalesController/diretaCalcService). A identidade continua sendo
// uma linha em `partners` (type='accounting') — mantido assim de propósito
// pra não perder o FK já usado por direta_sales/sales_activities nem
// quebrar a página separada de login de contabilidade (/direta-certificacao,
// que não tem nada a ver com este módulo). `contabilidades_precos` é a
// tabela de extensão 1:1 com os campos de cadastro que faltavam em
// `partners` — o nome do arquivo ficou (era só sobre preço), mas agora é
// sobre cadastro; preço vira campo legado, opcional, não lido em lugar
// nenhum do fluxo de venda novo.

function gerarSenhaAleatoria() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 14; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

function normalizarTexto(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function gerarEmailPlaceholder(nome) {
  const base = normalizarTexto(nome).toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 40) || 'contabilidade';
  return `contab.${base}.${Date.now()}@placeholder.iubmais.local`;
}

async function gerarCodigo(client) {
  const countResult = await client.query("SELECT COUNT(*) FROM partners WHERE type = 'accounting'");
  const count = parseInt(countResult.rows[0].count, 10) + 1;
  return `CONT-IT-${String(count).padStart(3, '0')}`;
}

// Lista todas as contabilidades (partners type='accounting') + cadastro.
async function listContabilidades(req, res) {
  try {
    const result = await db.query(
      `SELECT p.id AS partner_id, p.code, p.name, p.email, p.whatsapp, p.is_active AS partner_ativo,
              cp.id, cp.cnpj, cp.endereco, cp.cidade, cp.responsavel_nome,
              cp.preco_certificado, cp.ativo, cp.observacoes,
              cp.created_at, cp.updated_at
       FROM partners p
       LEFT JOIN contabilidades_precos cp ON cp.partner_id = p.id
       WHERE p.type = 'accounting'
       ORDER BY p.name`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar contabilidades' });
  }
}

async function getContabilidade(req, res) {
  try {
    const { id } = req.params; // partner_id
    const result = await db.query(
      `SELECT p.id AS partner_id, p.code, p.name, p.email, p.whatsapp, p.is_active AS partner_ativo,
              cp.id, cp.cnpj, cp.endereco, cp.cidade, cp.responsavel_nome,
              cp.preco_certificado, cp.ativo, cp.observacoes
       FROM partners p
       LEFT JOIN contabilidades_precos cp ON cp.partner_id = p.id
       WHERE p.id = $1 AND p.type = 'accounting'`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contabilidade não encontrada' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar contabilidade' });
  }
}

function validarCadastro(b) {
  if (!b.razao_social?.trim()) return 'Razão social é obrigatória';
  const cnpjDigits = onlyDigits(b.cnpj);
  if (!isValidCNPJ(cnpjDigits)) return 'CNPJ inválido';
  return null;
}

// Cadastro rápido: cria a identidade (partners) e o cadastro (contabilidades_precos)
// juntos, numa única ação — Fernando não precisa mais inventar email/senha
// nem passar por dois passos separados pra cadastrar uma contabilidade.
async function createContabilidade(req, res) {
  const { razao_social, cnpj, endereco, cidade, whatsapp, email, responsavel_nome, observacoes } = req.body;

  const erro = validarCadastro(req.body);
  if (erro) return res.status(400).json({ error: erro });

  const cnpjDigits = onlyDigits(cnpj);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const jaExiste = await client.query('SELECT partner_id FROM contabilidades_precos WHERE cnpj = $1', [cnpjDigits]);
    if (jaExiste.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Já existe uma contabilidade cadastrada com este CNPJ' });
    }

    const emailFinal = email?.trim() || await gerarEmailPlaceholder(razao_social);
    const senhaHash = await bcrypt.hash(gerarSenhaAleatoria(), 10);
    const codigo = await gerarCodigo(client);

    const partnerResult = await client.query(
      `INSERT INTO partners (code, name, email, password_hash, type, whatsapp, is_admin, is_active)
       VALUES ($1,$2,$3,$4,'accounting',$5,false,true)
       RETURNING id, code, name, email, whatsapp, is_active`,
      [codigo, razao_social.trim(), emailFinal.toLowerCase(), senhaHash, whatsapp || null]
    );
    const partner = partnerResult.rows[0];

    const cadastroResult = await client.query(
      `INSERT INTO contabilidades_precos (partner_id, cnpj, endereco, cidade, responsavel_nome, observacoes, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,true)
       RETURNING *`,
      [partner.id, cnpjDigits, endereco || null, cidade || null, responsavel_nome || null, observacoes || null]
    );

    await client.query('COMMIT');
    return res.status(201).json({ ...partner, ...cadastroResult.rows[0], partner_id: partner.id });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email ou CNPJ já cadastrado' });
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cadastrar contabilidade' });
  } finally {
    client.release();
  }
}

async function updateContabilidade(req, res) {
  const { id } = req.params; // partner_id
  const { razao_social, cnpj, endereco, cidade, whatsapp, email, responsavel_nome, observacoes } = req.body;

  if (razao_social !== undefined && !razao_social.trim()) {
    return res.status(400).json({ error: 'Razão social é obrigatória' });
  }
  let cnpjDigits;
  if (cnpj !== undefined) {
    cnpjDigits = onlyDigits(cnpj);
    if (!isValidCNPJ(cnpjDigits)) return res.status(400).json({ error: 'CNPJ inválido' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const partnerCheck = await client.query(`SELECT * FROM partners WHERE id = $1 AND type = 'accounting'`, [id]);
    if (!partnerCheck.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Contabilidade não encontrada' }); }

    if (cnpjDigits) {
      const conflito = await client.query('SELECT partner_id FROM contabilidades_precos WHERE cnpj = $1 AND partner_id != $2', [cnpjDigits, id]);
      if (conflito.rows[0]) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Já existe outra contabilidade com este CNPJ' }); }
    }

    const p = partnerCheck.rows[0];
    await client.query(
      `UPDATE partners SET name=$1, whatsapp=$2, email=$3 WHERE id=$4`,
      [
        razao_social !== undefined ? razao_social.trim() : p.name,
        whatsapp !== undefined ? (whatsapp || null) : p.whatsapp,
        email !== undefined && email.trim() ? email.trim().toLowerCase() : p.email,
        id,
      ]
    );

    // Garante que a linha de cadastro existe (contabilidades cadastradas
    // antes desta reestruturação já foram todas backfilled na migration,
    // mas não custa ser defensivo aqui também).
    await client.query(
      `INSERT INTO contabilidades_precos (partner_id, ativo) VALUES ($1, true)
       ON CONFLICT (partner_id) DO NOTHING`,
      [id]
    );

    const cadastroAtual = await client.query('SELECT * FROM contabilidades_precos WHERE partner_id = $1', [id]);
    const c = cadastroAtual.rows[0];
    const result = await client.query(
      `UPDATE contabilidades_precos SET
         cnpj = $1, endereco = $2, cidade = $3, responsavel_nome = $4, observacoes = $5, updated_at = NOW()
       WHERE partner_id = $6
       RETURNING *`,
      [
        cnpjDigits !== undefined ? cnpjDigits : c.cnpj,
        endereco !== undefined ? (endereco || null) : c.endereco,
        cidade !== undefined ? (cidade || null) : c.cidade,
        responsavel_nome !== undefined ? (responsavel_nome || null) : c.responsavel_nome,
        observacoes !== undefined ? (observacoes || null) : c.observacoes,
        id,
      ]
    );

    await client.query('COMMIT');
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email ou CNPJ já cadastrado' });
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar contabilidade' });
  } finally {
    client.release();
  }
}

// Toggle ativo/inativo — separado de updateContabilidade pra não exigir
// validação de CNPJ/razão social num simples liga/desliga.
async function toggleAtivo(req, res) {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    const result = await db.query(
      `UPDATE contabilidades_precos SET ativo = $1, updated_at = NOW() WHERE partner_id = $2 RETURNING *`,
      [ativo, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contabilidade não encontrada' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar status' });
  }
}

// Excluir = soft delete (ativo=false). Cadastrada errada some do dropdown
// de novas vendas, mas continua existindo pra não quebrar o FK de vendas
// já registradas via ela.
async function deleteContabilidade(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE contabilidades_precos SET ativo = false, updated_at = NOW() WHERE partner_id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contabilidade não encontrada' });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir contabilidade' });
  }
}

module.exports = {
  listContabilidades,
  getContabilidade,
  createContabilidade,
  updateContabilidade,
  toggleAtivo,
  deleteContabilidade,
};
