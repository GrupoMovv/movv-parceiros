const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { isValidCNPJ, onlyDigits } = require('../utils/validators');
const cloudinaryService = require('../services/cloudinaryService');

const MAX_FOTOS_ESTABELECIMENTO = 5;
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function pastaLogo(parceiroId) { return `iubmais/parceiros/${parceiroId}/logo`; }
function pastaEstabelecimento(parceiroId) { return `iubmais/parceiros/${parceiroId}/estabelecimento`; }

// Tira qualquer marcação de HTML (não usamos rich text, é textarea puro) e
// limita tamanho — defesa em profundidade, o React já escapa na renderização.
function sanitizeText(v, maxLen) {
  if (v === undefined || v === null) return null;
  const limpo = String(v).replace(/<[^>]*>/g, '').trim();
  return limpo ? limpo.slice(0, maxLen) : null;
}

// Fotos antigas (de antes da migração pro Cloudinary) foram salvas em disco
// local e não têm publicId — nesse caso a limpeza é o fs.unlink de sempre;
// nunca vão ser deletadas do Cloudinary porque nunca estiveram lá.
function removerArquivoLocalSeForCaminho(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fs.unlink(path.join(__dirname, '../..', url), () => {});
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

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Dia fechado pode vir com abre/fecha vazio; dia aberto precisa dos dois
// em HH:MM. fecha < abre é permitido de propósito: pizzaria que abre 18:00
// e fecha 02:00 (virada de dia — ver frontend/src/utils/iubFood.js).
function validarHorario(horario) {
  if (typeof horario !== 'object' || horario === null || Array.isArray(horario)) return { erro: 'Horário de funcionamento inválido' };
  const limpo = {};
  for (const [dia, info] of Object.entries(horario)) {
    if (!DIAS_SEMANA.includes(dia)) return { erro: `Dia inválido: ${dia}` };
    const aberto = info?.aberto === true;
    const abre = String(info?.abre || '');
    const fecha = String(info?.fecha || '');
    if (aberto && (!HHMM.test(abre) || !HHMM.test(fecha))) return { erro: 'Preencha o horário de abrir e fechar dos dias marcados como abertos' };
    if (aberto && abre === fecha) return { erro: 'Horário de abrir e fechar não podem ser iguais' };
    limpo[dia] = { aberto, abre: HHMM.test(abre) ? abre : '', fecha: HHMM.test(fecha) ? fecha : '' };
  }
  return { horario: limpo };
}

// Número opcional: undefined = não mexe, ''/null = limpa, senão valida faixa.
function numeroOpcional(v, { min, max, inteiro = false }) {
  if (v === '' || v === null) return { valor: null };
  const n = inteiro ? parseInt(v, 10) : parseFloat(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) return { erro: true };
  return { valor: inteiro ? n : Math.round(n * 100) / 100 };
}

const CAMPOS_ENTREGA_NUMERICOS = {
  taxa_entrega:         { min: 0, max: 500,  rotulo: 'Taxa de entrega' },
  entrega_gratis_acima: { min: 0, max: 5000, rotulo: 'Valor pra entrega grátis' },
  raio_entrega_km:      { min: 0, max: 200,  rotulo: 'Raio de entrega' },
  tempo_preparo_min:    { min: 1, max: 300,  rotulo: 'Tempo de preparo', inteiro: true },
};

// PATCH /parceiro/perfil/entrega — tela "Entrega" do painel (IUB Food).
// Update parcial igual updatePerfil: só mexe no que veio no body.
async function updateEntrega(req, res) {
  try {
    const b = req.body;
    const atualResult = await db.query('SELECT delivery_disponivel, retirada_disponivel FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    const atual = atualResult.rows[0];

    const delivery = b.delivery_disponivel !== undefined ? b.delivery_disponivel === true : atual.delivery_disponivel;
    const retirada = b.retirada_disponivel !== undefined ? b.retirada_disponivel === true : atual.retirada_disponivel;
    if (!delivery && !retirada) {
      return res.status(400).json({ error: 'Marque pelo menos uma forma de atendimento: delivery ou retirada' });
    }

    const sets = [];
    const params = [];
    function set(coluna, valor, cast = '') { params.push(valor); sets.push(`${coluna} = $${params.length}${cast}`); }

    if (b.delivery_disponivel !== undefined) set('delivery_disponivel', delivery);
    if (b.retirada_disponivel !== undefined) set('retirada_disponivel', retirada);

    if (b.horario_funcionamento !== undefined) {
      const { erro, horario } = validarHorario(b.horario_funcionamento);
      if (erro) return res.status(400).json({ error: erro });
      set('horario_funcionamento', JSON.stringify(horario), '::jsonb');
    }

    for (const [campo, cfg] of Object.entries(CAMPOS_ENTREGA_NUMERICOS)) {
      if (b[campo] === undefined) continue;
      const { erro, valor } = numeroOpcional(b[campo], cfg);
      if (erro) return res.status(400).json({ error: `${cfg.rotulo} inválido (entre ${cfg.min} e ${cfg.max})` });
      set(campo, valor);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    params.push(req.parceiro.id);
    const result = await db.query(
      `UPDATE sindicato_parceiros SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}
       RETURNING delivery_disponivel, retirada_disponivel, horario_funcionamento, taxa_entrega,
                 entrega_gratis_acima, raio_entrega_km, tempo_preparo_min`,
      params
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar configuração de entrega' });
  }
}

async function uploadLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem' });

    const anterior = await db.query('SELECT logo_public_id FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    const { url, publicId } = await cloudinaryService.uploadFoto(req.file.buffer, pastaLogo(req.parceiro.id), 'LOGO');

    await db.query(
      'UPDATE sindicato_parceiros SET logo_url = $1, logo_public_id = $2, updated_at = NOW() WHERE id = $3',
      [url, publicId, req.parceiro.id]
    );

    // só apaga a antiga DEPOIS de confirmar a nova gravada, pra nunca ficar
    // sem logo nenhuma se o passo do banco falhar entre os dois.
    await cloudinaryService.deletarFoto(anterior.rows[0]?.logo_public_id);

    return res.json({ logo_url: url });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Erro ao enviar logo', detalhes: err.cloudinaryMessage, codigo: err.cloudinaryCode });
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

    const folder = pastaEstabelecimento(req.parceiro.id);
    let ordem = fotos.length ? Math.max(...fotos.map(f => f.ordem)) + 1 : 1;
    for (const file of req.files) {
      const { url, publicId } = await cloudinaryService.uploadFoto(file.buffer, folder, 'ESTABELECIMENTO');
      fotos.push({ url, publicId, ordem: ordem++ });
    }

    await db.query('UPDATE sindicato_parceiros SET fotos_estabelecimento = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(fotos), req.parceiro.id]);
    return res.json({ fotos_estabelecimento: fotos });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Erro ao enviar fotos', detalhes: err.cloudinaryMessage, codigo: err.cloudinaryCode });
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
    if (removida?.publicId) await cloudinaryService.deletarFoto(removida.publicId);
    else removerArquivoLocalSeForCaminho(removida?.url);

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

module.exports = { getPerfil, updatePerfil, updateEntrega, uploadLogo, uploadFotos, deleteFoto, reordenarFotos };
