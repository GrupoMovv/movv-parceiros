const db = require('../config/database');
const cloudinaryService = require('../services/cloudinaryService');
const { planoEfetivo, limiteProdutos, limiteDestaquesBeer } = require('../config/planos');
const {
  TIPOS_ESTABELECIMENTO, DIAS, TERMO_VERSAO, MENSAGEM_TERMO_PROIBIDO, verificarTermos, normalizarDias,
  horarioConfigurado, turnoAtual, proximaAbertura, abertoEfetivo,
} = require('../config/beer');
const { onlyDigits, isValidCNPJ } = require('../utils/validators');

// Aba "Meu IUB Beer" do painel do parceiro (/api/parceiro/beer, sessão do
// parceiro). Modelo híbrido (migration 058): a extensão
// beer_estabelecimentos é 1:1 com o parceiro logado, e o plano que vale é
// o do parceiro — este controller só lê, nunca cobra nada.

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null;
}

async function buscarExtensao(parceiroId) {
  const r = await db.query('SELECT * FROM beer_estabelecimentos WHERE parceiro_id = $1', [parceiroId]);
  return r.rows[0] || null;
}

// Middleware: só segue com extensão ATIVA (produtos/status exigem estar no Beer).
async function exigirExtensaoAtiva(req, res, next) {
  try {
    const ext = await buscarExtensao(req.parceiro.id);
    if (!ext || !ext.ativo) return res.status(403).json({ error: 'Ative o IUB Disk Bebidas antes de cadastrar produtos.' });
    req.beer = ext;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao verificar IUB Disk Bebidas' });
  }
}

function limites(parceiro) {
  const plano = planoEfetivo(parceiro);
  const destaques = limiteDestaquesBeer(plano);
  const produtos = limiteProdutos(plano);
  return { plano, destaques: destaques === Infinity ? null : destaques, produtos: produtos === Infinity ? null : produtos };
}

// Situação do "Aberto agora" pro painel: o que o cliente vê (aberto), se
// dá pra ligar agora (dentro de um turno) e o texto de apoio.
function statusPainel(ext) {
  if (!ext) return null;
  const turno = turnoAtual(ext.horario_funcionamento);
  return {
    aberto: abertoEfetivo(ext),
    pode_abrir: Boolean(turno),
    turno: turno ? { abre: turno.abre, fecha: turno.fecha, fim: turno.fim } : null,
    proxima_abertura: turno ? null : proximaAbertura(ext.horario_funcionamento),
    horario_configurado: horarioConfigurado(ext.horario_funcionamento),
  };
}

// GET /meu — extensão (ou null = ainda não entrou no Beer) + plano/limites.
async function getMeu(req, res) {
  try {
    const ext = await buscarExtensao(req.parceiro.id);
    const p = await db.query('SELECT cnpj, whatsapp FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    return res.json({
      estabelecimento: ext,
      status: statusPainel(ext),
      parceiro: { nome: req.parceiro.nome, slug: req.parceiro.slug, cnpj: p.rows[0]?.cnpj || null, whatsapp: p.rows[0]?.whatsapp || null },
      limites: limites(req.parceiro),
      termo_versao_atual: TERMO_VERSAO,
      tipos: TIPOS_ESTABELECIMENTO,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar IUB Disk Bebidas' });
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Mesmo formato do horario_funcionamento do parceiro (migration 025).
// Dia ausente ou inválido = fechado naquele dia.
function validarHorario(h) {
  if (!h || typeof h !== 'object') return {};
  return Object.fromEntries(DIAS.filter(d => h[d]).map(d => {
    const { aberto, abre, fecha } = h[d];
    return [d, aberto && HHMM.test(abre) && HHMM.test(fecha) ? { aberto: true, abre, fecha } : { aberto: false }];
  }));
}

// PUT /meu — cria (ativa) ou atualiza a extensão. Termo obrigatório ao
// ativar, ao reativar e quando o texto do termo mudou de versão.
async function salvarMeu(req, res) {
  try {
    const b = req.body || {};
    const ext = await buscarExtensao(req.parceiro.id);
    const precisaTermo = !ext || !ext.ativo || ext.termo_versao !== TERMO_VERSAO;
    if (precisaTermo && b.aceite_termo !== true) {
      return res.status(400).json({ error: 'Leia e aceite os termos do IUB Disk Bebidas pra continuar.' });
    }

    if (!TIPOS_ESTABELECIMENTO.includes(b.tipo)) return res.status(400).json({ error: 'Escolha o tipo do estabelecimento' });
    const whatsapp = onlyDigits(b.whatsapp);
    if (whatsapp.length < 10 || whatsapp.length > 13) return res.status(400).json({ error: 'WhatsApp comercial inválido' });
    const cnae = b.cnae ? onlyDigits(b.cnae) : null;
    if (cnae && cnae.length !== 7) return res.status(400).json({ error: 'CNAE deve ter 7 dígitos (ex.: 4723-7/00)' });

    // CNPJ mora no parceiro (é da empresa, não só do Beer) — o termo exige
    // CNPJ, então sem um válido no cadastro precisa informar aqui.
    const atual = await db.query('SELECT cnpj FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    const cnpjInformado = b.cnpj ? onlyDigits(b.cnpj) : null;
    const cnpj = cnpjInformado || onlyDigits(atual.rows[0]?.cnpj);
    if (!isValidCNPJ(cnpj)) return res.status(400).json({ error: 'Informe um CNPJ válido — o Disk Bebidas exige empresa com CNPJ' });

    const bairros = [...new Set((Array.isArray(b.bairros_entrega) ? b.bairros_entrega : [])
      .map(x => String(x || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 60);
    const tempo = b.tempo_entrega_min ? Number(b.tempo_entrega_min) : null;
    if (tempo !== null && !(Number.isInteger(tempo) && tempo >= 5 && tempo <= 240)) {
      return res.status(400).json({ error: 'Tempo de entrega deve ser entre 5 e 240 minutos' });
    }
    // Horário é obrigatório: o "Aberto agora" só liga dentro dele.
    const horario = validarHorario(b.horario_funcionamento);
    if (!horarioConfigurado(horario)) {
      return res.status(400).json({ error: 'Cadastre o horário de funcionamento de pelo menos um dia — o "Aberto agora" só funciona dentro dele.' });
    }
    const valores = [b.tipo, cnae, whatsapp, JSON.stringify(horario), bairros, tempo, b.retirada_disponivel === true];

    if (cnpjInformado && cnpjInformado !== onlyDigits(atual.rows[0]?.cnpj)) {
      await db.query('UPDATE sindicato_parceiros SET cnpj = $1, updated_at = NOW() WHERE id = $2', [cnpj, req.parceiro.id]);
    }

    let r;
    if (!ext) {
      r = await db.query(
        `INSERT INTO beer_estabelecimentos
           (parceiro_id, tipo, cnae, whatsapp, horario_funcionamento, bairros_entrega, tempo_entrega_min, retirada_disponivel,
            termo_versao, termo_aceito_em, termo_aceito_ip)
         VALUES ($8, $1, $2, $3, $4, $5, $6, $7, $9, NOW(), $10) RETURNING *`,
        [...valores, req.parceiro.id, TERMO_VERSAO, getIp(req)]
      );
    } else {
      r = await db.query(
        `UPDATE beer_estabelecimentos SET
           tipo = $1, cnae = $2, whatsapp = $3, horario_funcionamento = $4, bairros_entrega = $5,
           tempo_entrega_min = $6, retirada_disponivel = $7, ativo = true, updated_at = NOW()
           ${precisaTermo ? ', termo_versao = $9, termo_aceito_em = NOW(), termo_aceito_ip = $10' : ''}
         WHERE parceiro_id = $8 RETURNING *`,
        precisaTermo ? [...valores, req.parceiro.id, TERMO_VERSAO, getIp(req)] : [...valores, req.parceiro.id]
      );
    }
    // Devolve o parceiro junto (CNPJ pode ter mudado aqui): o painel usa essa
    // resposta direto, sem esperar recarregar o /meu.
    const pAtual = await db.query('SELECT cnpj, whatsapp FROM sindicato_parceiros WHERE id = $1', [req.parceiro.id]);
    return res.json({
      estabelecimento: r.rows[0], status: statusPainel(r.rows[0]),
      parceiro: { nome: req.parceiro.nome, slug: req.parceiro.slug, cnpj: pAtual.rows[0]?.cnpj || null, whatsapp: pAtual.rows[0]?.whatsapp || null },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao salvar IUB Disk Bebidas' });
  }
}

// POST /meu/desativar — sai do Beer (some do /beer inteiro). Produtos e
// dados ficam guardados pra quando reativar; o resto da conta não muda.
async function desativar(req, res) {
  try {
    await db.query(
      `UPDATE beer_estabelecimentos SET ativo = false, status_aberto = false, ultimo_status_update = NOW(), updated_at = NOW()
       WHERE parceiro_id = $1`,
      [req.parceiro.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao desativar' });
  }
}

// POST /meu/status { status_aberto } — o toggle grande "Aberto agora".
async function atualizarStatus(req, res) {
  try {
    if (typeof req.body?.status_aberto !== 'boolean') return res.status(400).json({ error: 'status_aberto deve ser true ou false' });
    // Só LIGA dentro de um turno do horário cadastrado (fechar pode sempre).
    if (req.body.status_aberto && !turnoAtual(req.beer.horario_funcionamento)) {
      const prox = proximaAbertura(req.beer.horario_funcionamento);
      return res.status(400).json({ error: `Fora do seu horário de funcionamento${prox ? ` — você abre ${prox}` : ''}. Ajuste o horário em "Editar dados" se abriu diferente hoje.` });
    }
    const r = await db.query(
      `UPDATE beer_estabelecimentos SET status_aberto = $1, ultimo_status_update = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.body.status_aberto, req.beer.id]
    );
    return res.json({ status_aberto: r.rows[0].status_aberto, ultimo_status_update: r.rows[0].ultimo_status_update, status: statusPainel(r.rows[0]) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar status' });
  }
}

// GET /produtos — todos os meus, qualquer status (pendente/aprovado/rejeitado).
async function listarProdutos(req, res) {
  try {
    const r = await db.query(
      `SELECT bp.*, bc.nome_exibicao AS categoria_nome, bc.icone AS categoria_icone, bc.regulamentada
       FROM beer_produtos bp JOIN beer_categorias bc ON bc.codigo = bp.categoria_codigo
       WHERE bp.estabelecimento_id = $1
       ORDER BY bp.created_at DESC`,
      [req.beer.id]
    );
    return res.json({ produtos: r.rows, limites: limites(req.parceiro) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar produtos' });
  }
}

async function logTentativaProibida(req, { nome, descricao, palavra }) {
  await db.query(
    `INSERT INTO beer_log_moderacao (tipo, estabelecimento_id, produto_nome, produto_descricao, palavra_detectada)
     VALUES ('tentativa_cadastro_proibido', $1, $2, $3, $4)`,
    [req.beer.id, String(nome || '').slice(0, 500), descricao || null, palavra]
  );
}

// Valida os campos comuns de criar/editar. Camada 1 (categoria só da lista,
// e só FOLHA — grupo "cervejas" não é categoria de produto) + camada 2
// (termos). Devolve { erro, status } ou { dados, sinalizados }.
async function validarProduto(req, b) {
  const nome = String(b.nome || '').trim();
  const descricao = String(b.descricao || '').trim() || null;
  if (nome.length < 2 || nome.length > 200) return { erro: 'Nome do produto deve ter entre 2 e 200 caracteres', status: 400 };
  if (descricao && descricao.length > 1000) return { erro: 'Descrição muito longa (máx. 1000 caracteres)', status: 400 };

  const cat = await db.query(
    'SELECT codigo FROM beer_categorias WHERE codigo = $1 AND ativo = true AND categoria_pai IS NOT NULL',
    [b.categoria_codigo]
  );
  if (!cat.rows[0]) return { erro: 'Escolha uma categoria da lista', status: 400 };

  const preco = Number(String(b.preco ?? '').replace(',', '.'));
  if (!Number.isFinite(preco) || preco <= 0 || preco > 100000) return { erro: 'Preço inválido', status: 400 };

  const { bloqueado, sinalizados } = verificarTermos(nome, descricao);
  if (bloqueado) {
    await logTentativaProibida(req, { nome, descricao, palavra: bloqueado });
    return { erro: MENSAGEM_TERMO_PROIBIDO, status: 422 };
  }

  let dias = b.dias_disponiveis;
  if (typeof dias === 'string') { try { dias = JSON.parse(dias); } catch { dias = null; } }
  const bool = v => v === true || v === 'true';
  return {
    dados: {
      nome, descricao, categoria_codigo: b.categoria_codigo, preco: Math.round(preco * 100) / 100,
      dias_disponiveis: normalizarDias(dias), disponivel_agora: bool(b.disponivel_agora),
    },
    sinalizados,
  };
}

async function subirFoto(req) {
  if (!req.file) return null;
  return cloudinaryService.uploadFoto(req.file.buffer, `iubmais/parceiros/${req.parceiro.id}/beer`, 'PRODUTO');
}

// POST /produtos (multipart: campos + foto opcional) — entra SEMPRE como
// pendente (camada 3); só aparece no /beer depois da moderação.
async function criarProduto(req, res) {
  try {
    const v = await validarProduto(req, req.body || {});
    if (v.erro) return res.status(v.status).json({ error: v.erro });

    const lim = limites(req.parceiro);
    if (lim.produtos !== null) {
      const total = await db.query('SELECT COUNT(*)::int n FROM beer_produtos WHERE estabelecimento_id = $1', [req.beer.id]);
      if (total.rows[0].n >= lim.produtos) {
        return res.status(400).json({ error: `Seu plano permite até ${lim.produtos} produtos no Disk Bebidas. Faça upgrade pra cadastrar mais.` });
      }
    }

    const foto = await subirFoto(req);
    const d = v.dados;
    const r = await db.query(
      `INSERT INTO beer_produtos
         (estabelecimento_id, categoria_codigo, nome, descricao, preco, imagem, imagem_public_id,
          dias_disponiveis, disponivel_agora, termos_sinalizados)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.beer.id, d.categoria_codigo, d.nome, d.descricao, d.preco, foto?.url || null, foto?.publicId || null,
        JSON.stringify(d.dias_disponiveis), d.disponivel_agora, v.sinalizados]
    );
    return res.status(201).json({ produto: r.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.cloudinaryCode) return res.status(502).json({ error: err.message, detalhes: err.cloudinaryMessage, codigo: err.cloudinaryCode });
    return res.status(500).json({ error: 'Erro ao cadastrar produto' });
  }
}

async function buscarMeuProduto(req) {
  const r = await db.query('SELECT * FROM beer_produtos WHERE id = $1 AND estabelecimento_id = $2', [req.params.id, req.beer.id]);
  return r.rows[0] || null;
}

// PUT /produtos/:id — mexeu em nome/descrição/categoria/foto (o que o
// moderador aprovou) = volta pra pendente. Preço/dias/disponível agora não
// reabrem moderação (são o dia a dia do balcão).
async function editarProduto(req, res) {
  try {
    const atual = await buscarMeuProduto(req);
    if (!atual) return res.status(404).json({ error: 'Produto não encontrado' });
    const v = await validarProduto(req, req.body || {});
    if (v.erro) return res.status(v.status).json({ error: v.erro });

    const d = v.dados;
    const foto = await subirFoto(req);
    const mudouConteudo = d.nome !== atual.nome || (d.descricao || null) !== (atual.descricao || null)
      || d.categoria_codigo !== atual.categoria_codigo || Boolean(foto);
    const voltaPendente = mudouConteudo || atual.status === 'rejeitado';

    const r = await db.query(
      `UPDATE beer_produtos SET
         nome = $1, descricao = $2, categoria_codigo = $3, preco = $4, dias_disponiveis = $5, disponivel_agora = $6,
         termos_sinalizados = $7,
         imagem = COALESCE($8, imagem), imagem_public_id = COALESCE($9, imagem_public_id),
         status = CASE WHEN $10 THEN 'pendente' ELSE status END,
         motivo_rejeicao = CASE WHEN $10 THEN NULL ELSE motivo_rejeicao END,
         aprovado_por = CASE WHEN $10 THEN NULL ELSE aprovado_por END,
         aprovado_em = CASE WHEN $10 THEN NULL ELSE aprovado_em END,
         updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [d.nome, d.descricao, d.categoria_codigo, d.preco, JSON.stringify(d.dias_disponiveis), d.disponivel_agora,
        v.sinalizados, foto?.url || null, foto?.publicId || null, voltaPendente, atual.id]
    );
    if (foto && atual.imagem_public_id) cloudinaryService.deletarFoto(atual.imagem_public_id).catch(() => {});
    return res.json({ produto: r.rows[0], voltou_moderacao: voltaPendente && atual.status !== 'pendente' });
  } catch (err) {
    console.error(err);
    if (err.cloudinaryCode) return res.status(502).json({ error: err.message, detalhes: err.cloudinaryMessage, codigo: err.cloudinaryCode });
    return res.status(500).json({ error: 'Erro ao editar produto' });
  }
}

async function excluirProduto(req, res) {
  try {
    const atual = await buscarMeuProduto(req);
    if (!atual) return res.status(404).json({ error: 'Produto não encontrado' });
    await db.query('DELETE FROM beer_produtos WHERE id = $1', [atual.id]);
    if (atual.imagem_public_id) cloudinaryService.deletarFoto(atual.imagem_public_id).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir produto' });
  }
}

// POST /produtos/:id/disponibilidade { disponivel_agora?, disponivel?, dias_disponiveis?, destaque? }
// Toggles rápidos da lista — não reabrem moderação. Destaque respeita o
// limite do plano (max_destaques_beer em config/planos.js).
async function atualizarDisponibilidade(req, res) {
  try {
    const atual = await buscarMeuProduto(req);
    if (!atual) return res.status(404).json({ error: 'Produto não encontrado' });
    const b = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (typeof b.disponivel_agora === 'boolean') set('disponivel_agora', b.disponivel_agora);
    if (typeof b.disponivel === 'boolean') set('disponivel', b.disponivel);
    if (b.dias_disponiveis !== undefined) set('dias_disponiveis', JSON.stringify(normalizarDias(b.dias_disponiveis)));
    if (typeof b.destaque === 'boolean') {
      if (b.destaque && !atual.destaque) {
        const lim = limites(req.parceiro).destaques;
        const usados = await db.query('SELECT COUNT(*)::int n FROM beer_produtos WHERE estabelecimento_id = $1 AND destaque = true', [req.beer.id]);
        if (lim !== null && usados.rows[0].n >= lim) {
          return res.status(400).json({ error: lim === 0 ? 'Destaque é benefício dos planos pagos. Faça upgrade pra destacar produtos.' : `Seu plano permite ${lim} produtos em destaque.` });
        }
      }
      set('destaque', b.destaque);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada pra atualizar' });

    params.push(atual.id);
    const r = await db.query(`UPDATE beer_produtos SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params);
    return res.json({ produto: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
}

module.exports = {
  exigirExtensaoAtiva, getMeu, salvarMeu, desativar, atualizarStatus,
  listarProdutos, criarProduto, editarProduto, excluirProduto, atualizarDisponibilidade,
};
