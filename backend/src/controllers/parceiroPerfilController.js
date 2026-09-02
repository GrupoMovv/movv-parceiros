const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { isValidCNPJ, onlyDigits } = require('../utils/validators');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads/parceiros');
const MAX_FOTOS_ESTABELECIMENTO = 5;
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

// Upload local no disco do Render — de propósito, enquanto o Cloudinary
// está instável. É efêmero (some a cada deploy/restart); migrar pra
// Cloudinary depois que estabilizar é o próximo passo natural, não algo
// pra "consertar" às pressas.
function dirLogo(parceiroId) { return path.join(UPLOAD_ROOT, String(parceiroId), 'logo'); }
function dirEstabelecimento(parceiroId) { return path.join(UPLOAD_ROOT, String(parceiroId), 'estabelecimento'); }

// Tira qualquer marcação de HTML (não usamos rich text, é textarea puro) e
// limita tamanho — defesa em profundidade, o React já escapa na renderização.
function sanitizeText(v, maxLen) {
  if (v === undefined || v === null) return null;
  const limpo = String(v).replace(/<[^>]*>/g, '').trim();
  return limpo ? limpo.slice(0, maxLen) : null;
}

function salvarArquivo(dir, file) {
  fs.mkdirSync(dir, { recursive: true });
  const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return filename;
}

async function getPerfil(req, res) {
  try {
    const result = await db.query('SELECT * FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
}

// Campo so entra no UPDATE se a chave existir no body — igual ao padrao de
// updateAssociado() em sindicatoAssociadosController.js. Sem isso, um campo
// omitido (nao "enviado vazio", genuinamente ausente do payload) apagaria
// dado existente sempre que o formulario mandasse so uma secao da tela.
const CAMPOS_TEXTO_SIMPLES = {
  nome: 160, razao_social: 255, descricao: 200, descricao_completa: 2000,
  beneficio: 255, endereco: 255, bairro: 120,
};

async function updatePerfil(req, res) {
  try {
    const b = req.body;
    const sets = [];
    const params = [];

    if (b.cnpj !== undefined) {
      const cnpjDigits = onlyDigits(b.cnpj);
      if (cnpjDigits && !isValidCNPJ(cnpjDigits)) {
        return res.status(400).json({ error: 'CNPJ inválido' });
      }
      params.push(cnpjDigits || null);
      sets.push(`cnpj = $${params.length}`);
    }

    if (b.categorias_extras !== undefined && !Array.isArray(b.categorias_extras)) {
      return res.status(400).json({ error: 'categorias_extras precisa ser uma lista' });
    }
    if (Array.isArray(b.categorias_extras) && b.categorias_extras.length > 3) {
      return res.status(400).json({ error: 'Máximo de 3 categorias extras' });
    }

    if (b.horario_funcionamento !== undefined) {
      if (typeof b.horario_funcionamento !== 'object' || b.horario_funcionamento === null) {
        return res.status(400).json({ error: 'horario_funcionamento inválido' });
      }
      for (const dia of Object.keys(b.horario_funcionamento)) {
        if (!DIAS_SEMANA.includes(dia)) return res.status(400).json({ error: `Dia inválido: ${dia}` });
      }
      params.push(JSON.stringify(b.horario_funcionamento));
      sets.push(`horario_funcionamento = $${params.length}::jsonb`);
    }

    for (const [campo, maxLen] of Object.entries(CAMPOS_TEXTO_SIMPLES)) {
      if (b[campo] === undefined) continue;
      params.push(sanitizeText(b[campo], maxLen));
      sets.push(`${campo} = $${params.length}`);
    }

    // categoria_principal e categorias_extras juntos formam a coluna
    // `categorias` (usada pelo marketplace pra filtro) — só recalcula se
    // pelo menos um dos dois veio no body.
    if (b.categoria_principal !== undefined || b.categorias_extras !== undefined) {
      const categoriaPrincipal = sanitizeText(b.categoria_principal, 60);
      const categoriasExtras = Array.isArray(b.categorias_extras) ? b.categorias_extras.slice(0, 3) : [];
      const categorias = [categoriaPrincipal, ...categoriasExtras].filter(Boolean);

      if (b.categoria_principal !== undefined) {
        params.push(categoriaPrincipal);
        sets.push(`categoria_principal = $${params.length}`);
      }
      params.push(categorias.length ? categorias : null);
      sets.push(`categorias = $${params.length}`);
    }

    if (b.cidade !== undefined) { params.push(sanitizeText(b.cidade, 120)); sets.push(`cidade = $${params.length}`); }
    if (b.estado !== undefined) { params.push(String(b.estado || '').trim().toUpperCase().slice(0, 2) || null); sets.push(`estado = $${params.length}`); }
    if (b.whatsapp !== undefined) { params.push(onlyDigits(b.whatsapp) || null); sets.push(`whatsapp = $${params.length}`); }
    if (b.telefone_fixo !== undefined) { params.push(onlyDigits(b.telefone_fixo) || null); sets.push(`telefone_fixo = $${params.length}`); }
    if (b.instagram !== undefined) { params.push(sanitizeText(String(b.instagram || '').replace(/^@/, ''), 100)); sets.push(`instagram = $${params.length}`); }
    if (b.google_maps_url !== undefined) { params.push(sanitizeText(b.google_maps_url, 500)); sets.push(`google_maps_url = $${params.length}`); }

    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    params.push(req.parceiro.id);
    const result = await db.query(
      `UPDATE sindicato_parceiros SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
}

async function uploadLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem' });

    const filename = salvarArquivo(dirLogo(req.parceiro.id), req.file);
    const logoUrl = `/uploads/parceiros/${req.parceiro.id}/logo/${filename}`;

    await db.query('UPDATE sindicato_parceiros SET logo_url = $1, updated_at = NOW() WHERE id = $2', [logoUrl, req.parceiro.id]);
    return res.json({ logo_url: logoUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar logo' });
  }
}

async function uploadFotos(req, res) {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Envie ao menos uma imagem' });

    const atual = await db.query('SELECT fotos_estabelecimento FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    const fotos = atual.rows[0].fotos_estabelecimento || [];

    if (fotos.length + req.files.length > MAX_FOTOS_ESTABELECIMENTO) {
      return res.status(400).json({ error: `Máximo de ${MAX_FOTOS_ESTABELECIMENTO} fotos no total` });
    }

    const dir = dirEstabelecimento(req.parceiro.id);
    let ordem = fotos.length ? Math.max(...fotos.map(f => f.ordem)) + 1 : 1;
    for (const file of req.files) {
      const filename = salvarArquivo(dir, file);
      fotos.push({ url: `/uploads/parceiros/${req.parceiro.id}/estabelecimento/${filename}`, ordem: ordem++ });
    }

    await db.query('UPDATE sindicato_parceiros SET fotos_estabelecimento = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(fotos), req.parceiro.id]);
    return res.json({ fotos_estabelecimento: fotos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar fotos' });
  }
}

async function deleteFoto(req, res) {
  try {
    const index = parseInt(req.params.index, 10);
    const atual = await db.query('SELECT fotos_estabelecimento FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    const fotos = atual.rows[0].fotos_estabelecimento || [];
    if (!Number.isInteger(index) || index < 0 || index >= fotos.length) {
      return res.status(404).json({ error: 'Foto não encontrada' });
    }

    const [removida] = fotos.splice(index, 1);
    if (removida?.url) {
      const caminho = path.join(__dirname, '../..', removida.url);
      fs.unlink(caminho, () => {}); // silencioso — se o arquivo já não existe (deploy novo), tudo bem
    }

    await db.query('UPDATE sindicato_parceiros SET fotos_estabelecimento = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(fotos), req.parceiro.id]);
    return res.json({ fotos_estabelecimento: fotos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover foto' });
  }
}

async function reordenarFotos(req, res) {
  try {
    const { urls } = req.body; // array de urls na nova ordem
    if (!Array.isArray(urls)) return res.status(400).json({ error: 'urls (array) é obrigatório' });

    const atual = await db.query('SELECT fotos_estabelecimento FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    const fotos = atual.rows[0].fotos_estabelecimento || [];
    const porUrl = new Map(fotos.map(f => [f.url, f]));

    if (urls.length !== fotos.length || !urls.every(u => porUrl.has(u))) {
      return res.status(400).json({ error: 'Lista de urls não confere com as fotos atuais' });
    }

    const reordenadas = urls.map((u, i) => ({ ...porUrl.get(u), ordem: i + 1 }));
    await db.query('UPDATE sindicato_parceiros SET fotos_estabelecimento = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(reordenadas), req.parceiro.id]);
    return res.json({ fotos_estabelecimento: reordenadas });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reordenar fotos' });
  }
}

module.exports = { getPerfil, updatePerfil, uploadLogo, uploadFotos, deleteFoto, reordenarFotos };
