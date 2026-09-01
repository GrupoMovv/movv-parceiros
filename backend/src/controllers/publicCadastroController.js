const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { gerarHashUnico, calcularValidoAte } = require('./sindicatoCarteirinhaController');
const { substituirDependentes } = require('./sindicatoAssociadosController');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/associados');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const SEXOS_VALIDOS = ['F', 'M', 'P'];
const CATEGORIAS_VALIDAS = ['Empregado', 'Empregador patronal', 'Profissional liberal'];

async function validarCnpj(req, res) {
  try {
    const cnpj = onlyDigits(req.body.cnpj);
    if (!isValidCNPJ(cnpj)) return res.status(400).json({ error: 'CNPJ inválido' });

    const result = await db.query('SELECT * FROM sindicato_empresas_contribuintes WHERE cnpj = $1', [cnpj]);
    if (!result.rows[0]) return res.json({ status: 'nao_existe' });

    const e = result.rows[0];
    return res.json({
      status: e.status,
      empresa: {
        id: e.id,
        razao_social: e.razao_social,
        nome_fantasia: e.nome_fantasia,
        cidade: e.cidade,
        estado: e.estado,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao validar CNPJ' });
  }
}

async function solicitarEmpresa(req, res) {
  try {
    const { cnpj, nome_solicitante, whatsapp, cargo, nome_empresa, mensagem } = req.body;
    if (!cnpj || !nome_solicitante || !whatsapp) {
      return res.status(400).json({ error: 'cnpj, nome_solicitante e whatsapp são obrigatórios' });
    }

    await db.query(
      `INSERT INTO sindicato_solicitacoes_empresa
         (cnpj_digitado, nome_solicitante, whatsapp_solicitante, cargo, nome_empresa, mensagem)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [onlyDigits(cnpj), nome_solicitante.trim(), onlyDigits(whatsapp), cargo || null, nome_empresa || null, mensagem || null]
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar solicitação' });
  }
}

async function verificarCpf(req, res) {
  try {
    const cpf = onlyDigits(req.body.cpf);
    if (!isValidCPF(cpf)) return res.status(400).json({ error: 'CPF inválido' });

    const result = await db.query(
      'SELECT id, nome_completo, carteirinha_hash, whatsapp FROM sindicato_associados WHERE cpf = $1',
      [cpf]
    );
    if (!result.rows[0]) return res.json({ existe: false });

    const a = result.rows[0];
    return res.json({ existe: true, tem_carteirinha: !!a.carteirinha_hash, nome: a.nome_completo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao verificar CPF' });
  }
}

// CPF já cadastrado (passo 2 do wizard): gera a carteirinha se ainda não
// existir e devolve os dados pro front montar o link de WhatsApp (mesmo
// utilitário client-side usado no botão "Enviar Carteirinha" do admin).
async function gerarEditTokenUnico() {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const token = nanoid(32);
    const existe = await db.query('SELECT 1 FROM sindicato_associados WHERE edit_token = $1', [token]);
    if (!existe.rows[0]) return token;
  }
  throw new Error('Não foi possível gerar um token de edição único');
}

async function reenviarCarteirinha(req, res) {
  try {
    const cpf = onlyDigits(req.body.cpf);
    const result = await db.query('SELECT * FROM sindicato_associados WHERE cpf = $1', [cpf]);
    if (!result.rows[0]) return res.status(404).json({ error: 'CPF não encontrado' });

    let associado = result.rows[0];
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

    // Associados criados antes do "Meu Cadastro" (importados do Higestor ou
    // cadastrados pelo admin) não têm edit_token — gera na primeira vez que
    // alguém reenvia, pra também ganhar acesso à edição.
    if (!associado.edit_token) {
      const editToken = await gerarEditTokenUnico();
      const upd = await db.query(
        'UPDATE sindicato_associados SET edit_token = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [editToken, associado.id]
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
      edit_token: associado.edit_token,
      dependentes: depResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar/reenviar carteirinha' });
  }
}

// Só gera pra quem ainda não tem hash — reaproveitado tanto no cadastro
// novo (todo mundo sem hash ainda) quanto na edição via Meu Cadastro
// (dependente existente editado NUNCA pode trocar de hash, senão invalida
// um QR que já pode ter sido compartilhado/impresso).
async function gerarCarteirinhaDependentes(associadoId) {
  const deps = await db.query(
    'SELECT id FROM sindicato_associados_dependentes WHERE associado_id = $1 AND carteirinha_hash IS NULL',
    [associadoId]
  );
  for (const dep of deps.rows) {
    const hash = await gerarHashUnico('sindicato_associados_dependentes');
    const validaAte = calcularValidoAte();
    await db.query(
      `UPDATE sindicato_associados_dependentes
       SET carteirinha_hash = $1, carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $2 WHERE id = $3`,
      [hash, validaAte, dep.id]
    );
  }
}

// Fluxo completo do wizard público: valida tudo de novo no servidor (nunca
// confia no que o CNPJ/CPF já validados nos passos anteriores do front
// mandam de volta), cria o associado + dependentes, salva a foto tirada na
// hora, gera a carteirinha do titular e de cada dependente.
async function finalizarCadastro(req, res) {
  try {
    const {
      cnpj, nome_completo, cpf, data_nascimento, sexo, categoria_profissional,
      whatsapp, email, cidade, estado, dependentes, aceite_comunicacao,
    } = req.body;

    if (!nome_completo || !cpf || !data_nascimento || !sexo || !categoria_profissional || !whatsapp || !cidade || !estado) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    }
    if (!SEXOS_VALIDOS.includes(sexo)) return res.status(400).json({ error: 'Sexo inválido' });
    if (!CATEGORIAS_VALIDAS.includes(categoria_profissional)) return res.status(400).json({ error: 'Categoria inválida' });
    if (String(aceite_comunicacao) !== 'true') return res.status(400).json({ error: 'É necessário aceitar receber comunicações via WhatsApp' });
    if (!req.file) return res.status(400).json({ error: 'Foto é obrigatória' });

    const cpfDigits = onlyDigits(cpf);
    if (!isValidCPF(cpfDigits)) return res.status(400).json({ error: 'CPF inválido' });

    const cnpjDigits = onlyDigits(cnpj);
    if (!isValidCNPJ(cnpjDigits)) return res.status(400).json({ error: 'CNPJ inválido' });

    const contribuinte = await db.query('SELECT * FROM sindicato_empresas_contribuintes WHERE cnpj = $1', [cnpjDigits]);
    if (!contribuinte.rows[0] || contribuinte.rows[0].status !== 'adimplente') {
      return res.status(403).json({ error: 'Empresa não está apta para autocadastro no momento' });
    }

    const jaExiste = await db.query('SELECT id FROM sindicato_associados WHERE cpf = $1', [cpfDigits]);
    if (jaExiste.rows[0]) {
      return res.status(409).json({ error: 'Este CPF já possui cadastro. Use a opção de reenvio.' });
    }

    let dependentesArr = [];
    if (dependentes) {
      try { dependentesArr = JSON.parse(dependentes); } catch { dependentesArr = []; }
    }

    const emp = contribuinte.rows[0];
    const externalId = `PUBLICO-${Date.now()}`;
    const editToken = await gerarEditTokenUnico();

    const result = await db.query(
      `INSERT INTO sindicato_associados
         (external_id, nome_completo, cpf, data_nascimento, sexo, categoria_profissional,
          whatsapp, email, cidade, estado, empresa_nome_livre, edit_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        externalId, nome_completo.trim(), cpfDigits, data_nascimento, sexo, categoria_profissional,
        onlyDigits(whatsapp), email?.trim() || null, cidade.trim(), estado.trim().toUpperCase(),
        emp.nome_fantasia || emp.razao_social, editToken,
      ]
    );

    let associado = result.rows[0];
    await substituirDependentes(associado.id, dependentesArr);

    const ext = (req.file.mimetype === 'image/png') ? '.png' : '.jpg';
    const filename = `associado_${associado.id}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
    const fotoUrl = `/uploads/associados/${filename}`;

    const hash = await gerarHashUnico('sindicato_associados');
    const validaAte = calcularValidoAte();
    const upd = await db.query(
      `UPDATE sindicato_associados
       SET foto_url = $1, carteirinha_hash = $2, carteirinha_gerada_em = NOW(), carteirinha_valida_ate = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [fotoUrl, hash, validaAte, associado.id]
    );
    associado = upd.rows[0];

    await db.query(
      `INSERT INTO sindicato_carteirinha_upload (associado_id, tipo_dono, url_arquivo) VALUES ($1, 'associado', $2)`,
      [associado.id, fotoUrl]
    );

    await gerarCarteirinhaDependentes(associado.id);

    const depResult = await db.query(
      `SELECT nome, grau, carteirinha_hash FROM sindicato_associados_dependentes
       WHERE associado_id = $1 AND carteirinha_hash IS NOT NULL`,
      [associado.id]
    );

    return res.status(201).json({
      nome_completo: associado.nome_completo,
      whatsapp: associado.whatsapp,
      foto_url: associado.foto_url,
      carteirinha_hash: associado.carteirinha_hash,
      carteirinha_valida_ate: associado.carteirinha_valida_ate,
      edit_token: associado.edit_token,
      dependentes: depResult.rows,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este CPF já possui cadastro.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao finalizar cadastro' });
  }
}

module.exports = {
  validarCnpj, solicitarEmpresa, verificarCpf, reenviarCarteirinha, finalizarCadastro,
  // exportados pro publicMeuCadastroController reaproveitar (gera
  // carteirinha de dependente novo adicionado na tela de edição).
  gerarCarteirinhaDependentes,
};
