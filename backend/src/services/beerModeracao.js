const db = require('../config/database');
const openaiService = require('./openaiService');
const {
  CONFIANCA_MIN_APROVADOS, CONFIANCA_DIAS_SEM_REJEICAO, TAXA_AUDITORIA,
  cnaeCompativel, FAIXAS_PRECO_GRUPO, FAIXA_PRECO_PADRAO, detectarPalavrao,
} = require('../config/beer');

// Moderação inteligente do Disk Bebidas (Junior, 29/09/2026). A moderação
// NÃO foi desligada: parceiro CONFIÁVEL (5+ aprovados, sem rejeição em 30
// dias, CNAE compatível) com TODOS os checks OK publica direto — e 1 em 10
// desses cai na aba "Conferir". Qualquer outro caso vai pra fila, já com o
// motivo de cada alerta. Check que não deu pra fazer (IA fora do ar,
// timeout) conta como NÃO OK: na dúvida, fila.

const TIMEOUT_IA_MS = 12000;
const comTimeout = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_IA_MS))]);
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Nível do parceiro no Disk Bebidas.
async function nivelDoParceiro(estabelecimentoId, cnae) {
  const aprovados = (await db.query("SELECT COUNT(*)::int n FROM beer_produtos WHERE estabelecimento_id = $1 AND status = 'aprovado'", [estabelecimentoId])).rows[0].n;
  const rejeicoes = (await db.query(
    `SELECT COUNT(*)::int n FROM beer_log_moderacao WHERE estabelecimento_id = $1 AND tipo = 'rejeicao'
       AND created_at > NOW() - ($2 || ' days')::interval`, [estabelecimentoId, String(CONFIANCA_DIAS_SEM_REJEICAO)]
  )).rows[0].n;
  const cnaeOk = cnaeCompativel(cnae);
  let nivel = 'confiavel';
  if (rejeicoes > 0) nivel = 'rejeicao_recente';
  else if (aprovados < CONFIANCA_MIN_APROVADOS) nivel = 'novo';
  return { nivel, aprovados, rejeicoes, cnaeOk };
}

// A IA do cadastro por foto já escolheu esta categoria (com certeza alta) pra
// este parceiro na última hora? Aí não precisa gastar outra chamada de visão.
async function categoriaVeioDaIA(parceiroId, categoria) {
  const r = await db.query(
    `SELECT 1 FROM sindicato_ia_uso WHERE parceiro_id = $1 AND data_uso > NOW() - INTERVAL '60 minutes'
       AND resposta_json->>'categoria_codigo' = $2 AND resposta_json->>'certeza' = 'alta' LIMIT 1`,
    [parceiroId, categoria]
  );
  return r.rows.length > 0;
}

// dados = produto validado (nome, descricao, categoria_codigo, preco, origem)
// foto  = req.file (foto NOVA) | null; fotoAntiga = imagem que já estava no produto
// anterior = produto antes da edição (pra reaproveitar o que não mudou) | null
async function avaliar({ parceiroId, estabelecimento, dados, foto, fotoAntiga, anterior, sinalizados }) {
  const checks = [];
  const add = (check, ok, motivo) => checks.push({ check, ok, motivo });
  const cat = (await db.query(
    `SELECT f.codigo, COALESCE(f.categoria_pai, f.codigo) AS grupo, COALESCE(g.nome_exibicao || ' › ', '') || f.nome_exibicao AS caminho
     FROM beer_categorias f LEFT JOIN beer_categorias g ON g.codigo = f.categoria_pai WHERE f.codigo = $1`, [dados.categoria_codigo]
  )).rows[0];

  // 1. termos sensíveis (o filtro já barra os proibidos; aqui entram os de contexto)
  add('termos', !sinalizados?.length, sinalizados?.length ? `Termos que pedem olhar humano: ${sinalizados.join(', ')}` : 'Nenhum termo sensível');

  // 5. palavrão
  const palavrao = detectarPalavrao(dados.nome, dados.descricao, dados.origem);
  add('palavrao', !palavrao, palavrao ? `Palavrão no texto: "${palavrao}"` : 'Sem palavrão');

  // 4. preço plausível pro grupo
  const [min, max] = FAIXAS_PRECO_GRUPO[cat?.grupo] || FAIXA_PRECO_PADRAO;
  const precoOk = dados.preco >= min && dados.preco <= max;
  add('preco', precoOk, precoOk ? `Preço dentro do comum (${brl(min)} a ${brl(max)})` : `Preço fora do comum pra essa categoria: ${brl(dados.preco)} (esperado ${brl(min)} a ${brl(max)})`);

  // 2. foto imprópria + 3. categoria × foto
  if (foto) {
    try {
      const m = await comTimeout(openaiService.moderarImagem(foto.buffer, foto.mimetype));
      add('foto_impropria', !m.flagged, m.flagged ? `Foto sinalizada: ${m.categorias.join(', ')}` : 'Foto sem conteúdo impróprio');
    } catch {
      add('foto_impropria', false, 'Não deu pra verificar a foto agora');
    }
    if (await categoriaVeioDaIA(parceiroId, dados.categoria_codigo)) {
      add('categoria_foto', true, 'Categoria escolhida pela IA a partir da foto');
    } else {
      try {
        const c = await comTimeout(openaiService.conferirCategoriaFoto(foto.buffer, foto.mimetype, { nome: dados.nome, caminhoCategoria: cat?.caminho || dados.categoria_codigo }));
        add('categoria_foto', c.compativel, c.compativel ? 'Foto combina com a categoria' : `Foto não parece ser de ${cat?.caminho}: ${c.motivo}`);
      } catch {
        add('categoria_foto', false, 'Não deu pra conferir a categoria pela foto agora');
      }
    }
  } else if (fotoAntiga && anterior) {
    // sem foto nova: a foto já passou antes; categoria só "vale" se não mudou
    const antes = (anterior.moderacao_checks || []).find(c => c.check === 'foto_impropria');
    add('foto_impropria', antes ? antes.ok : true, antes ? antes.motivo : 'Foto já publicada antes');
    const mesmaCategoria = anterior.categoria_codigo === dados.categoria_codigo;
    add('categoria_foto', mesmaCategoria, mesmaCategoria ? 'Categoria não mudou' : 'Categoria mudou sem foto nova — conferir');
  } else {
    add('foto_impropria', true, 'Sem foto');
    add('categoria_foto', true, 'Sem foto pra comparar');
  }

  // 6. CNAE + nível de confiança
  const n = await nivelDoParceiro(estabelecimento.id, estabelecimento.cnae);
  add('cnae', n.cnaeOk, n.cnaeOk ? 'CNAE compatível com bebidas' : `CNAE ${estabelecimento.cnae || 'não informado'} fora da lista de bebidas — sempre fila`);
  add('confianca', n.nivel === 'confiavel', {
    confiavel: `Parceiro confiável (${n.aprovados} aprovados, sem rejeição em ${CONFIANCA_DIAS_SEM_REJEICAO} dias)`,
    novo: `Parceiro novo: ${n.aprovados} de ${CONFIANCA_MIN_APROVADOS} aprovados pra publicar direto`,
    rejeicao_recente: `Teve ${n.rejeicoes} rejeição(ões) nos últimos ${CONFIANCA_DIAS_SEM_REJEICAO} dias`,
  }[n.nivel]);

  const publicarDireto = checks.every(c => c.ok);
  return { checks, nivel: n.nivel, publicarDireto, auditoria: publicarDireto && Math.random() < TAXA_AUDITORIA };
}

// CNAE do parceiro mudou pra um compatível: reavalia a fila dele. Só publica
// o que JÁ tinha todos os outros checks OK (não roda IA de novo).
async function reavaliarFila(estabelecimento) {
  const n = await nivelDoParceiro(estabelecimento.id, estabelecimento.cnae);
  if (!n.cnaeOk || n.nivel !== 'confiavel') return 0;
  const pend = (await db.query("SELECT id, moderacao_checks, nome, descricao FROM beer_produtos WHERE estabelecimento_id = $1 AND status = 'pendente'", [estabelecimento.id])).rows;
  let publicados = 0;
  for (const p of pend) {
    const checks = p.moderacao_checks || [];
    const outrosOk = checks.length && checks.filter(c => !['cnae', 'confianca'].includes(c.check)).every(c => c.ok);
    if (!outrosOk) continue;
    const novos = checks.map(c => (c.check === 'cnae' ? { ...c, ok: true, motivo: 'CNAE compatível com bebidas (atualizado)' }
      : c.check === 'confianca' ? { ...c, ok: true, motivo: `Parceiro confiável (${n.aprovados} aprovados)` } : c));
    await registrarDecisao(p.id, estabelecimento.id, { checks: novos, publicarDireto: true, auditoria: Math.random() < TAXA_AUDITORIA }, p);
    publicados++;
  }
  return publicados;
}

// Grava o resultado no produto (+ log quando publicou direto).
async function registrarDecisao(produtoId, estabelecimentoId, r, produto) {
  await db.query(
    `UPDATE beer_produtos SET moderacao_checks = $1,
       status = CASE WHEN $2 THEN 'aprovado' ELSE 'pendente' END,
       moderacao_origem = CASE WHEN $2 THEN 'automatica' ELSE NULL END,
       aprovado_em = CASE WHEN $2 THEN NOW() ELSE NULL END, aprovado_por = NULL, motivo_rejeicao = NULL,
       auditoria_pendente = $3, auditado_em = NULL
     WHERE id = $4`,
    [JSON.stringify(r.checks), r.publicarDireto, Boolean(r.auditoria), produtoId]
  );
  if (r.publicarDireto) {
    await db.query(
      `INSERT INTO beer_log_moderacao (tipo, estabelecimento_id, produto_id, produto_nome, produto_descricao, motivo)
       VALUES ('aprovacao_automatica', $1, $2, $3, $4, $5)`,
      [estabelecimentoId, produtoId, produto?.nome || null, produto?.descricao || null, r.auditoria ? 'sorteado pra auditoria' : null]
    );
  }
}

module.exports = { avaliar, registrarDecisao, reavaliarFila, nivelDoParceiro };
