// Loja do Clube MAIS+ (migration 100): benefício da loja, termo com versão,
// aceites e avisos de versão nova. Regras em config/clube.js.
const db = require('../config/database');
const { sendWhatsAppMessage } = require('./zapApiService');
const {
  PERCENTUAL_MIN, PERCENTUAL_MAX, MINIMOS_SUGERIDOS, MINIMO_PADRAO, AVISO_DIAS_ANTES,
} = require('../config/clube');

const DIA = 24 * 60 * 60 * 1000;

class ErroClube extends Error {
  constructor(msg, status = 400, codigo) { super(msg); this.status = status; this.codigo = codigo; }
}

const fmtPct = n => `${String(Number(n)).replace('.', ',')}%`;

// Mínimo sugerido pelo tipo da loja (só orientação).
function sugestaoMinima(loja, temBeer = false) {
  const cats = [loja.categoria_principal, ...(loja.categorias || [])].filter(Boolean);
  if (temBeer) cats.push('Bebidas');
  const principal = loja.categoria_principal;
  const achar = lista => MINIMOS_SUGERIDOS.find(m => lista.some(c => m.categorias.includes(c)));
  const m = (principal && achar([principal])) || achar(cats) || MINIMO_PADRAO;
  return { tipo: m.tipo, rotulo: m.rotulo, percentual: m.percentual, categoria: principal || cats[0] || null };
}

// Texto do benefício, do jeito que entra no termo e no painel.
function descreverBeneficio(b, nProdutos = 0) {
  const partes = [];
  if (b.percentual != null) {
    partes.push(b.alcance === 'escolhidos'
      ? `desconto de ${fmtPct(b.percentual)} sobre o preço normal nos produtos escolhidos no painel (${nProdutos} ${nProdutos === 1 ? 'produto' : 'produtos'})`
      : `desconto de ${fmtPct(b.percentual)} sobre o preço normal em todos os produtos e serviços da Loja no IUB MAIS+`);
  }
  if (b.entrega_gratis) partes.push('entrega grátis nos pedidos feitos pelo IUB MAIS+');
  return partes.join('; e ');
}

const textoComBeneficio = (termo, b, n) => termo.texto.replace('{{BENEFICIO}}', descreverBeneficio(b, n));

async function termoVigente(cx = db) {
  return (await cx.query(`SELECT * FROM loja_clube_termos ORDER BY versao DESC LIMIT 1`)).rows[0] || null;
}

async function dadosDaLoja(parceiroId, cx = db) {
  const loja = (await cx.query(
    `SELECT p.id, p.nome, p.whatsapp, p.categoria_principal, p.categorias, p.tipo_pessoa,
            (SELECT be.id FROM beer_estabelecimentos be WHERE be.parceiro_id = p.id) AS beer_id
       FROM sindicato_parceiros p WHERE p.id = $1`, [parceiroId])).rows[0];
  if (!loja) throw new ErroClube('Loja não encontrada', 404);
  return loja;
}

// Produtos que a loja pode escolher (catálogo geral ativo + Disk Bebidas).
async function produtosDaLoja(parceiroId, cx = db) {
  const geral = (await cx.query(
    `SELECT 'geral' AS catalogo, id AS item_id, nome, preco FROM sindicato_parceiro_produtos
      WHERE parceiro_id = $1 AND ativo ORDER BY nome`, [parceiroId])).rows;
  const beer = (await cx.query(
    `SELECT 'beer' AS catalogo, bp.id AS item_id, bp.nome, COALESCE(bp.preco_original, bp.preco) AS preco
       FROM beer_produtos bp JOIN beer_estabelecimentos be ON be.id = bp.estabelecimento_id
      WHERE be.parceiro_id = $1 ORDER BY bp.nome`, [parceiroId])).rows;
  return [...geral, ...beer];
}

// Situação completa para o painel da loja.
async function estado(parceiroId, cx = db) {
  const loja = await dadosDaLoja(parceiroId, cx);
  const termo = await termoVigente(cx);
  const b = (await cx.query(`SELECT * FROM loja_clube WHERE parceiro_id = $1`, [parceiroId])).rows[0] || null;
  const escolhidos = (await cx.query(`SELECT catalogo, item_id FROM loja_clube_produtos WHERE parceiro_id = $1`, [parceiroId])).rows;
  const marcados = new Set(escolhidos.map(e => `${e.catalogo}:${e.item_id}`));
  const produtos = (await produtosDaLoja(parceiroId, cx)).map(p => ({ ...p, escolhido: marcados.has(`${p.catalogo}:${p.item_id}`) }));
  const ultimoAceite = (await cx.query(
    `SELECT versao, aceito_em, usuario_email FROM loja_clube_aceites WHERE parceiro_id = $1 ORDER BY aceito_em DESC, id DESC LIMIT 1`,
    [parceiroId])).rows[0] || null;
  const ativo = Boolean(b?.ativo);
  const versaoAtrasada = ativo && termo && (b.termo_versao || 0) < termo.versao;
  const prazo = versaoAtrasada ? new Date(new Date(termo.publicado_em).getTime() + termo.prazo_aceite_dias * DIA) : null;
  return {
    loja: { id: loja.id, nome: loja.nome, pessoa_fisica: loja.tipo_pessoa === 'pf' },
    ativo,
    beneficio: b ? {
      percentual: b.percentual != null ? Number(b.percentual) : null, alcance: b.alcance, entrega_gratis: b.entrega_gratis,
      termo_versao: b.termo_versao, entrou_em: b.entrou_em, saiu_em: b.saiu_em, motivo_saida: b.motivo_saida,
      descricao: ativo ? descreverBeneficio({ ...b, percentual: b.percentual != null ? Number(b.percentual) : null }, escolhidos.length) : null,
    } : null,
    produtos,
    termo: termo ? { versao: termo.versao, titulo: termo.titulo, texto: termo.texto, provisoria: termo.provisoria, publicado_em: termo.publicado_em, prazo_aceite_dias: termo.prazo_aceite_dias } : null,
    ultimo_aceite: ultimoAceite,
    precisa_aceitar_versao_nova: Boolean(versaoAtrasada),
    prazo_aceite: prazo,
    sugestao_minima: sugestaoMinima(loja, Boolean(loja.beer_id)),
    limites: { min: PERCENTUAL_MIN, max: PERCENTUAL_MAX },
  };
}

// Benefício em vigor (o que a b3 vai usar no preço). null = não é Loja do Clube.
async function lojaNoClube(parceiroId, cx = db) {
  const b = (await cx.query(`SELECT * FROM loja_clube WHERE parceiro_id = $1 AND ativo`, [parceiroId])).rows[0];
  if (!b) return null;
  return { percentual: b.percentual != null ? Number(b.percentual) : null, alcance: b.alcance, entrega_gratis: b.entrega_gratis };
}

function validarBeneficio(body, produtosValidos) {
  const temPct = body?.percentual !== null && body?.percentual !== undefined && body?.percentual !== '';
  const entrega = body?.entrega_gratis === true;
  let percentual = null;
  if (temPct) {
    percentual = Number(String(body.percentual).replace(',', '.'));
    if (!Number.isFinite(percentual) || percentual < PERCENTUAL_MIN || percentual > PERCENTUAL_MAX) {
      throw new ErroClube(`O desconto do Clube vai de ${fmtPct(PERCENTUAL_MIN)} a ${fmtPct(PERCENTUAL_MAX)}.`);
    }
    if (Math.round(percentual * 10) !== percentual * 10) throw new ErroClube('Use no máximo uma casa decimal no desconto (ex.: 7,5%).');
  }
  if (!temPct && !entrega) throw new ErroClube('Escolha pelo menos um benefício: desconto ou entrega grátis.');
  const alcance = temPct && body?.alcance === 'escolhidos' ? 'escolhidos' : 'loja';
  let produtos = [];
  if (alcance === 'escolhidos') {
    const validos = new Set(produtosValidos.map(p => `${p.catalogo}:${p.item_id}`));
    const vistos = new Set();
    for (const p of Array.isArray(body.produtos) ? body.produtos : []) {
      const k = `${p?.catalogo}:${Number(p?.item_id)}`;
      if (validos.has(k) && !vistos.has(k)) { vistos.add(k); produtos.push({ catalogo: p.catalogo, item_id: Number(p.item_id) }); }
    }
    if (!produtos.length) throw new ErroClube('Escolha pelo menos 1 produto para o desconto do Clube.');
  }
  return { percentual, alcance, entrega_gratis: entrega, produtos };
}

// Entrar no Clube ou mudar o benefício: sempre com o aceite da versão vigente.
async function salvar(parceiroId, usuario, body, meta) {
  return db.transacao(async cx => {
    const termo = await termoVigente(cx);
    if (!termo) throw new ErroClube('O termo do Clube ainda não foi publicado.', 409);
    if (body?.concordo !== true) throw new ErroClube('Marque "Li e aceito o termo" para continuar.', 400, 'SEM_ACEITE');
    if (Number(body?.versao) !== termo.versao) {
      throw new ErroClube('O termo foi atualizado. Recarregue a página e leia a versão nova.', 409, 'TERMO_DESATUALIZADO');
    }
    const loja = await dadosDaLoja(parceiroId, cx);
    if (loja.tipo_pessoa === 'pf') throw new ErroClube('A Loja do Clube é só para empresas (CNPJ).', 403);
    const b = validarBeneficio(body, await produtosDaLoja(parceiroId, cx));
    const antes = (await cx.query(`SELECT * FROM loja_clube WHERE parceiro_id = $1 FOR UPDATE`, [parceiroId])).rows[0];
    const quem = usuario?.email ? `${usuario.email} (usuário ${usuario.id})` : 'loja';
    await cx.query(
      `INSERT INTO loja_clube (parceiro_id, ativo, percentual, alcance, entrega_gratis, termo_versao, entrou_em, saiu_em, motivo_saida, atualizado_em, atualizado_por)
       VALUES ($1, true, $2, $3, $4, $5, NOW(), NULL, NULL, NOW(), $6)
       ON CONFLICT (parceiro_id) DO UPDATE SET ativo = true, percentual = $2, alcance = $3, entrega_gratis = $4, termo_versao = $5,
         entrou_em = CASE WHEN loja_clube.ativo THEN loja_clube.entrou_em ELSE NOW() END,
         saiu_em = NULL, motivo_saida = NULL, atualizado_em = NOW(), atualizado_por = $6`,
      [parceiroId, b.percentual, b.alcance, b.entrega_gratis, termo.versao, quem]);
    await cx.query(`DELETE FROM loja_clube_produtos WHERE parceiro_id = $1`, [parceiroId]);
    for (const p of b.produtos) {
      await cx.query(`INSERT INTO loja_clube_produtos (parceiro_id, catalogo, item_id) VALUES ($1, $2, $3)`, [parceiroId, p.catalogo, p.item_id]);
    }
    const beneficio = { percentual: b.percentual, alcance: b.alcance, entrega_gratis: b.entrega_gratis, produtos: b.produtos.length };
    await cx.query(
      `INSERT INTO loja_clube_aceites (parceiro_id, versao, ip, user_agent, usuario_id, usuario_email, beneficio, texto_aceito)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [parceiroId, termo.versao, meta.ip, meta.userAgent, usuario?.id || null, usuario?.email || null,
        JSON.stringify(beneficio), textoComBeneficio(termo, b, b.produtos.length)]);
    await cx.query(`INSERT INTO loja_clube_eventos (parceiro_id, evento, beneficio, quem) VALUES ($1, $2, $3, $4)`,
      [parceiroId, antes?.ativo ? 'mudou' : 'entrou', JSON.stringify(beneficio), quem]);
    return { entrou: !antes?.ativo };
  });
}

async function sair(parceiroId, usuario) {
  return db.transacao(async cx => {
    const antes = (await cx.query(`SELECT * FROM loja_clube WHERE parceiro_id = $1 FOR UPDATE`, [parceiroId])).rows[0];
    if (!antes?.ativo) throw new ErroClube('Sua loja não está no Clube.', 409);
    const quem = usuario?.email ? `${usuario.email} (usuário ${usuario.id})` : 'loja';
    await cx.query(`UPDATE loja_clube SET ativo = false, saiu_em = NOW(), motivo_saida = 'loja', atualizado_em = NOW(), atualizado_por = $2 WHERE parceiro_id = $1`, [parceiroId, quem]);
    await cx.query(`INSERT INTO loja_clube_eventos (parceiro_id, evento, quem) VALUES ($1, 'saiu', $2)`, [parceiroId, quem]);
  });
}

// ---------- Versão nova do termo: avisos e saída por prazo ----------

function mensagem(tipo, loja, termo, prazo) {
  const data = prazo.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const painel = 'https://iubmais.com.br/parceiro/painel/clube';
  if (tipo === 'nova_versao') {
    return `Olá, ${loja.nome}! O termo da Loja do Clube MAIS+ foi atualizado (versão ${termo.versao}).\n\nPara continuar no Clube, leia e aceite a versão nova no painel até ${data}:\n${painel}\n\nSe não aceitar até lá, o benefício do Clube da sua loja é desativado.`;
  }
  if (tipo === 'faltam_3_dias') {
    return `Olá, ${loja.nome}! Faltam ${AVISO_DIAS_ANTES} dias para aceitar a versão ${termo.versao} do termo da Loja do Clube MAIS+ (prazo: ${data}).\n\nAceite no painel para continuar no Clube:\n${painel}`;
  }
  return `Olá, ${loja.nome}! O prazo para aceitar a versão ${termo.versao} do termo da Loja do Clube MAIS+ terminou e o benefício do Clube da sua loja foi desativado.\n\nPara voltar ao Clube, é só entrar de novo pelo painel:\n${painel}`;
}

async function avisar(loja, termo, tipo, prazo) {
  // registra antes de mandar: rodar em dobro não manda duas vezes
  const r = await db.query(
    `INSERT INTO loja_clube_avisos (parceiro_id, versao, tipo, ok) VALUES ($1, $2, $3, false)
     ON CONFLICT DO NOTHING RETURNING parceiro_id`, [loja.id, termo.versao, tipo]);
  if (!r.rows[0]) return false;
  const envio = loja.whatsapp
    ? await sendWhatsAppMessage(loja.whatsapp, mensagem(tipo, loja, termo, prazo))
    : { success: false, reason: 'loja sem WhatsApp' };
  await db.query(`UPDATE loja_clube_avisos SET ok = $4, erro = $5 WHERE parceiro_id = $1 AND versao = $2 AND tipo = $3`,
    [loja.id, termo.versao, tipo, Boolean(envio.success), envio.success ? null : String(envio.reason || 'falhou').slice(0, 300)]);
  return true;
}

// Uma rodada: lojas ativas com aceite de versão antiga.
async function rodarAvisos(agora = new Date()) {
  const termo = await termoVigente();
  const r = { nova_versao: 0, faltam_3_dias: 0, saiu_prazo: 0 };
  if (!termo) return r;
  const prazo = new Date(new Date(termo.publicado_em).getTime() + termo.prazo_aceite_dias * DIA);
  const lojas = (await db.query(
    `SELECT p.id, p.nome, p.whatsapp FROM loja_clube lc JOIN sindicato_parceiros p ON p.id = lc.parceiro_id
      WHERE lc.ativo AND COALESCE(lc.termo_versao, 0) < $1`, [termo.versao])).rows;
  for (const loja of lojas) {
    try {
      if (agora >= prazo) {
        const saiu = await db.transacao(async cx => {
          const u = await cx.query(
            `UPDATE loja_clube SET ativo = false, saiu_em = NOW(), motivo_saida = 'termo_nao_aceito', atualizado_em = NOW(), atualizado_por = 'sistema'
              WHERE parceiro_id = $1 AND ativo AND COALESCE(termo_versao, 0) < $2 RETURNING parceiro_id`, [loja.id, termo.versao]);
          if (u.rows[0]) await cx.query(`INSERT INTO loja_clube_eventos (parceiro_id, evento, quem) VALUES ($1, 'saiu_prazo', 'sistema')`, [loja.id]);
          return Boolean(u.rows[0]);
        });
        if (saiu) { r.saiu_prazo++; await avisar(loja, termo, 'saiu_prazo', prazo); }
        continue;
      }
      if (await avisar(loja, termo, 'nova_versao', prazo)) r.nova_versao++;
      if (agora >= new Date(prazo.getTime() - AVISO_DIAS_ANTES * DIA) && await avisar(loja, termo, 'faltam_3_dias', prazo)) r.faltam_3_dias++;
    } catch (err) {
      console.error(`[loja do clube] avisos da loja ${loja.id} falharam:`, err.message);
    }
  }
  return r;
}

function iniciarTimer(intervaloMs = 60 * 60 * 1000) {
  let rodando = false;
  const passo = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await rodarAvisos();
      if (Object.values(r).some(n => n > 0)) console.log('[loja do clube]', JSON.stringify(r));
    } catch (err) {
      console.error('[loja do clube] rodada falhou:', err.message);
    } finally { rodando = false; }
  };
  setTimeout(passo, 30 * 1000);
  setInterval(passo, intervaloMs);
  console.log('[loja do clube] timer dos avisos do termo ligado');
}

// Admin publica uma versão nova (a 2 vem com a revisão do advogado e a parte c).
async function publicarVersao({ titulo, texto, provisoria }, quem) {
  if (!String(texto || '').includes('{{BENEFICIO}}')) {
    throw new ErroClube('O texto precisa ter {{BENEFICIO}} no lugar onde entra o benefício escolhido pela loja.');
  }
  if (!String(titulo || '').trim()) throw new ErroClube('Informe o título do termo.');
  return db.transacao(async cx => {
    const atual = await termoVigente(cx);
    const versao = (atual?.versao || 0) + 1;
    return (await cx.query(
      `INSERT INTO loja_clube_termos (versao, titulo, texto, provisoria, publicado_por) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [versao, String(titulo).trim(), String(texto).trim(), Boolean(provisoria), quem])).rows[0];
  });
}

module.exports = {
  ErroClube, sugestaoMinima, descreverBeneficio, textoComBeneficio, termoVigente, estado, lojaNoClube,
  salvar, sair, rodarAvisos, iniciarTimer, publicarVersao,
};
