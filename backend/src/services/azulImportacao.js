// Importação mensal do relatório da Azul para o livro de comissões do
// Partner (Etapa 2). Toda função recebe `cx` (pool ou client de transação).
//
// Casamento de cada linha PAGA, nesta ordem:
//   1. numero_contrato igual ao de uma indicação de MOVV Partner -> "casada":
//      gera lançamento CONFIRMADO (a linha prova que a Azul pagou);
//   2. o CPF casa com UMA indicação de Partner ainda sem contrato -> "sugestao":
//      nada é lançado até o admin confirmar; ao confirmar, o contrato é
//      gravado na indicação (as próximas importações casam pelo contrato);
//   3. o CPF casa com MAIS de uma indicação sem contrato -> "ambigua": o admin
//      escolhe a indicação;
//   4. nada casa -> "sem_partner": venda da própria agência (a maioria). Só
//      conta nos totais; não é pendência.
// ESTORNADA com contrato de Partner -> "estorno_a_decidir" (nada é alterado
// sozinho). ESTORNADA sem contrato -> "desconto" da agência, sem lançamento.
//
// Idempotência: chave por linha (azulRelatorio.atribuirChaves), UNIQUE no
// banco. Reimportar ou sobrepor períodos só grava as linhas novas.
// CPF nunca vai para log; para a tela, sempre mascarado.
const { lerRelatorioAzul } = require('./azulRelatorio');
const pc = require('./partnerComissoes');
const { paraCentavos, formatarCentavos, valorPartnerCentavos, paraPct4, dividirArredondando } = require('./dinheiro');
const { mascararCpf } = require('../utils/validators');

const { ErroComissao } = pc;

// Indicação "da Azul": de MOVV Partner e de produto da Azul. Lista FECHADA
// de tipos (Junior, 13/10/2026): crédito ('credit') e os "outros" da Azul
// (consórcio, energia solar). Seguro ('insurance', ex.: Movv Seguros) NUNCA
// entra — vem de outra fonte e não pode casar com o relatório da Azul.
const TIPOS_PRODUTO_AZUL = ['credit', 'other'];
const SQL_INDICACAO_AZUL = `
  r.status <> 'cancelled'
  AND p.type = 'movv_partner'
  AND pr.type IN (${TIPOS_PRODUTO_AZUL.map(t => `'${t}'`).join(',')})`;

async function indicacoesPorContrato(cx, contrato) {
  return (await cx.query(
    `SELECT r.id, r.partner_id FROM referrals r
     JOIN partners p ON p.id = r.partner_id JOIN products pr ON pr.id = r.product_id
     WHERE r.numero_contrato = $1 AND ${SQL_INDICACAO_AZUL}`, [contrato]
  )).rows;
}

async function indicacoesSemContratoPorCpf(cx, cpf) {
  return (await cx.query(
    `SELECT r.id, r.partner_id FROM referrals r
     JOIN partners p ON p.id = r.partner_id JOIN products pr ON pr.id = r.product_id
     WHERE r.client_cpf = $1 AND r.numero_contrato IS NULL AND ${SQL_INDICACAO_AZUL}
     ORDER BY r.created_at DESC`, [cpf]
  )).rows;
}

// Percentual vigente do Partner na data do pagamento. Sem nível ou sem regra
// devolve { motivo } (a linha vira "sem_regra", à espera de correção).
async function regraDaLinha(cx, partnerId, linha) {
  const p = (await cx.query('SELECT id, code, nivel_partner, is_active FROM partners WHERE id = $1', [partnerId])).rows[0];
  if (!p?.nivel_partner) return { motivo: `Partner ${p?.code || partnerId} sem nível definido.` };
  const regra = await pc.regraVigente(cx, { origem: 'azul', produto: linha.produto, nivel: p.nivel_partner, data: linha.dt_pagamento });
  if (!regra) return { motivo: `Sem regra vigente da Azul para o nível ${p.nivel_partner} em ${linha.dt_pagamento}.` };
  return { regra };
}

// Classifica uma linha (sem gravar). Devolve { status, referral_id,
// partner_id, sugestao_referral_id, lancamento_estorno_id, regra, motivo }.
async function classificar(cx, linha) {
  if (linha.tipo === 'desconto') return { status: 'desconto' };

  if (linha.tipo === 'estorno') {
    const lanc = (await cx.query(
      `SELECT id, partner_id, referral_id FROM partner_comissoes
       WHERE origem = 'azul' AND numero_contrato = $1 AND status <> 'estornado' ORDER BY id DESC LIMIT 1`,
      [linha.numero_contrato]
    )).rows[0];
    if (lanc) return { status: 'estorno_a_decidir', lancamento_estorno_id: lanc.id, partner_id: lanc.partner_id, referral_id: lanc.referral_id };
    const ind = await indicacoesPorContrato(cx, linha.numero_contrato);
    if (ind.length) return { status: 'estorno_a_decidir', partner_id: ind[0].partner_id, referral_id: ind[0].id, motivo: 'Contrato de Partner ainda sem lançamento.' };
    return { status: 'sem_partner' };
  }

  if (linha.numero_contrato) {
    const ind = await indicacoesPorContrato(cx, linha.numero_contrato);
    if (ind.length === 1) {
      const { regra, motivo } = await regraDaLinha(cx, ind[0].partner_id, linha);
      return regra
        ? { status: 'casada', referral_id: ind[0].id, partner_id: ind[0].partner_id, regra }
        : { status: 'sem_regra', referral_id: ind[0].id, partner_id: ind[0].partner_id, motivo };
    }
    if (ind.length > 1) return { status: 'ambigua', motivo: 'Mais de uma indicação com este contrato.' };
  }
  if (linha.cliente_cpf) {
    const ind = await indicacoesSemContratoPorCpf(cx, linha.cliente_cpf);
    if (ind.length === 1) return { status: 'sugestao', sugestao_referral_id: ind[0].id, partner_id: ind[0].partner_id };
    if (ind.length > 1) return { status: 'ambigua', motivo: `${ind.length} indicações de Partner sem contrato com este CPF.` };
  }
  return { status: 'sem_partner' };
}

function valorDoPartner(linha, regra) {
  return formatarCentavos(valorPartnerCentavos(paraCentavos(linha.valor_comissao), paraPct4(regra.percentual)));
}

const CONTAGENS_ZERO = () => ({
  casada: 0, sugestao: 0, ambigua: 0, sem_partner: 0, sem_regra: 0, desconto: 0, estorno_a_decidir: 0,
});

// Lê o arquivo, separa novas de já importadas e classifica as novas.
async function analisar(cx, buffer) {
  const lido = lerRelatorioAzul(buffer);
  const chaves = lido.linhas.map(l => l.chave_linha);
  const ja = new Set(chaves.length
    ? (await cx.query('SELECT chave_linha FROM comissao_importacao_linhas WHERE chave_linha = ANY($1::text[])', [chaves])).rows.map(r => r.chave_linha.trim())
    : []);

  const novas = [];
  for (const l of lido.linhas) {
    if (ja.has(l.chave_linha)) { l.ja_importada = true; continue; }
    l.classe = await classificar(cx, l);
    if (l.classe.status === 'casada') l.valor_partner = valorDoPartner(l, l.classe.regra);
    novas.push(l);
  }

  // Totais do ARQUIVO inteiro (somando as linhas; nunca o rodapé)
  let bruto = 0n; let descontos = 0n; let estornos = 0n;
  const porProduto = new Map();
  for (const l of lido.linhas) {
    const v = paraCentavos(l.valor_comissao);
    if (l.tipo === 'comissao') {
      bruto += v;
      const k = l.produto || '(sem produto)';
      porProduto.set(k, (porProduto.get(k) || 0n) + v);
    } else if (l.tipo === 'desconto') descontos += v;
    else estornos += v;
  }
  const contagens = CONTAGENS_ZERO();
  let partners = 0n;
  for (const l of novas) {
    contagens[l.classe.status] += 1;
    if (l.valor_partner) partners += paraCentavos(l.valor_partner);
  }
  const liquido = bruto - descontos;
  const datas = lido.linhas.map(l => l.dt_pagamento).sort();

  return {
    lido, novas,
    resumo: {
      formato: lido.formato,
      arquivo_hash: lido.arquivo_hash,
      periodo_de: datas[0] || null,
      periodo_ate: datas[datas.length - 1] || null,
      linhas_total: lido.linhas.length,
      ja_importadas: lido.linhas.length - novas.length,
      novas: novas.length,
      contagens,
      erros: lido.erros,
      linhas_pagas: lido.linhas.filter(l => l.tipo === 'comissao').length,
      total_incentivo_bruto: formatarCentavos(bruto),
      total_descontos: formatarCentavos(descontos),
      total_incentivo_liquido: formatarCentavos(liquido),
      total_estornos: formatarCentavos(estornos),
      total_partners: formatarCentavos(partners),
      por_produto: [...porProduto.entries()].map(([produto, v]) => ({ produto, total: formatarCentavos(v) }))
        .sort((a, b) => a.produto.localeCompare(b.produto)),
      // Só informativo: o cálculo da Pabline não muda (base ainda em decisão)
      pabline: {
        bruto: formatarCentavos(bruto),
        liquido: formatarCentavos(liquido),
        dez_pct_bruto: formatarCentavos(dividirArredondando(bruto * 10n, 100n)),
        dez_pct_liquido: formatarCentavos(dividirArredondando(liquido * 10n, 100n)),
      },
    },
  };
}

// Linha para a tela: CPF mascarado, sem a chave inteira
function linhaParaTela(l) {
  return {
    linha_numero: l.linha_numero, tipo: l.tipo, situacao: l.situacao,
    numero_contrato: l.numero_contrato, cliente_nome: l.cliente_nome, cliente_cpf: mascararCpf(l.cliente_cpf),
    produto: l.produto, dt_pagamento: l.dt_pagamento, valor_comissao: l.valor_comissao,
    ja_importada: Boolean(l.ja_importada), status: l.classe?.status || null, valor_partner: l.valor_partner || null,
    motivo: l.classe?.motivo || null,
  };
}

async function previa(cx, buffer) {
  const { lido, resumo } = await analisar(cx, buffer);
  return { ...resumo, linhas: lido.linhas.map(linhaParaTela) };
}

async function gerarLancamentoDaLinha(cx, linhaDb, referralId, partnerId, regra, quem) {
  const { lancamento } = await pc.criarLancamento(cx, {
    partner_id: partnerId, origem: 'azul', produto: linhaDb.produto || 'Azul',
    referral_id: referralId, numero_contrato: linhaDb.numero_contrato, cliente_nome: linhaDb.cliente_nome,
    competencia: linhaDb.competencia, base_valor: linhaDb.valor_comissao,
    percentual: regra.percentual, regra_id: regra.id, status: 'confirmado',
    chave_idempotencia: `azul:linha:${String(linhaDb.chave_linha).trim()}`, importacao_linha_id: linhaDb.id,
    criado_por: quem,
  });
  return lancamento;
}

// Confirma a importação: refaz a análise dentro da transação (não confia na
// prévia que o navegador viu) e grava tudo de uma vez.
async function confirmar(cx, buffer, nomeArquivo, quem, quemId) {
  const { novas, resumo } = await analisar(cx, buffer);
  if (resumo.erros.length) {
    throw new ErroComissao(`O arquivo tem ${resumo.erros.length} linha(s) com erro; corrija antes de importar (linha ${resumo.erros[0].linha_numero}: ${resumo.erros[0].motivo}).`);
  }
  const imp = (await cx.query(
    `INSERT INTO comissao_importacoes
       (origem, formato, arquivo_nome, arquivo_hash, periodo_de, periodo_ate, linhas_total, linhas_novas,
        linhas_ja_importadas, contagens, total_incentivo, total_descontos, total_partners, importado_por_id, importado_por)
     VALUES ('azul', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13) RETURNING *`,
    [resumo.formato, String(nomeArquivo || 'relatorio').slice(0, 300), resumo.arquivo_hash, resumo.periodo_de, resumo.periodo_ate,
      resumo.linhas_total, resumo.novas, resumo.ja_importadas, JSON.stringify(resumo.contagens),
      resumo.total_incentivo_bruto, resumo.total_descontos, quemId || null, quem]
  )).rows[0];

  let totalPartners = 0n;
  let gravadas = 0;
  for (const l of novas) {
    const c = l.classe;
    const ins = (await cx.query(
      `INSERT INTO comissao_importacao_linhas
         (importacao_id, linha_numero, chave_linha, tipo, numero_contrato, cliente_nome, cliente_cpf, banco, produto,
          valor_emprestimo, valor_comissao, percentual_comissao, dt_operacao, dt_emissao, dt_pagamento, competencia,
          situacao, origem_relatorio, observacao, cod_agente, status, referral_id, partner_id, sugestao_referral_id,
          lancamento_estorno_id, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       ON CONFLICT (chave_linha) DO NOTHING RETURNING *`,
      [imp.id, l.linha_numero, l.chave_linha, l.tipo, l.numero_contrato, l.cliente_nome, l.cliente_cpf, l.banco, l.produto,
        l.valor_emprestimo, l.valor_comissao, l.percentual_comissao, l.dt_operacao, l.dt_emissao, l.dt_pagamento, l.competencia,
        l.situacao, l.origem_relatorio, l.observacao, l.cod_agente, c.status, c.referral_id || null, c.partner_id || null,
        c.sugestao_referral_id || null, c.lancamento_estorno_id || null, c.motivo || null]
    )).rows[0];
    if (!ins) continue; // outra importação gravou a mesma linha no meio do caminho
    gravadas++;
    if (c.status === 'casada') {
      const lanc = await gerarLancamentoDaLinha(cx, ins, c.referral_id, c.partner_id, c.regra, quem);
      totalPartners += paraCentavos(lanc.valor_partner);
    }
  }
  const final = (await cx.query(
    `UPDATE comissao_importacoes SET total_partners = $2, linhas_novas = $3, linhas_ja_importadas = linhas_total - $3
     WHERE id = $1 RETURNING *`,
    [imp.id, formatarCentavos(totalPartners), gravadas]
  )).rows[0];
  return { importacao: final, resumo };
}

// ─── Pendências e ações do admin ────────────────────────────────────────────

async function travarLinha(cx, linhaId, statusAceitos) {
  const l = (await cx.query('SELECT * FROM comissao_importacao_linhas WHERE id = $1 FOR UPDATE', [linhaId])).rows[0];
  if (!l) throw new ErroComissao('Linha não encontrada.', 404);
  if (!statusAceitos.includes(l.status)) throw new ErroComissao(`A linha ${l.id} está "${l.status}"; esta ação vale para: ${statusAceitos.join(', ')}.`, 409);
  return l;
}

// Liga a linha a uma indicação de Partner: grava o contrato na indicação
// (se ela ainda não tiver) e gera o lançamento confirmado.
async function ligarLinhaAIndicacao(cx, linha, referralId, quem) {
  if (linha.tipo !== 'comissao') throw new ErroComissao('Só linha de comissão paga pode ser vinculada.');
  const r = (await cx.query(
    `SELECT r.id, r.partner_id, r.numero_contrato, r.client_cpf FROM referrals r
     JOIN partners p ON p.id = r.partner_id JOIN products pr ON pr.id = r.product_id
     WHERE r.id = $1 AND ${SQL_INDICACAO_AZUL} FOR UPDATE OF r`, [referralId]
  )).rows[0];
  if (!r) throw new ErroComissao('Indicação não encontrada ou não é uma indicação Azul de MOVV Partner.');
  if (linha.numero_contrato) {
    if (r.numero_contrato && r.numero_contrato !== linha.numero_contrato) {
      throw new ErroComissao(`A indicação #${r.id} já tem o contrato ${r.numero_contrato}; esta linha é do contrato ${linha.numero_contrato}.`, 409);
    }
    const outra = (await cx.query('SELECT id FROM referrals WHERE numero_contrato = $1 AND id <> $2', [linha.numero_contrato, r.id])).rows[0];
    if (outra) throw new ErroComissao(`O contrato ${linha.numero_contrato} já está na indicação #${outra.id}.`, 409);
    await cx.query(
      `UPDATE referrals SET numero_contrato = $2, client_cpf = COALESCE(client_cpf, $3) WHERE id = $1`,
      [r.id, linha.numero_contrato, linha.cliente_cpf]
    );
  }
  const { regra, motivo } = await regraDaLinha(cx, r.partner_id, linha);
  if (!regra) {
    await cx.query(
      `UPDATE comissao_importacao_linhas SET status = 'sem_regra', referral_id = $2, partner_id = $3, motivo = $4,
         resolvido_por = $5, resolvido_em = NOW() WHERE id = $1`,
      [linha.id, r.id, r.partner_id, motivo, quem]
    );
    return { linha_id: linha.id, sem_regra: motivo };
  }
  const lanc = await gerarLancamentoDaLinha(cx, linha, r.id, r.partner_id, regra, quem);
  await cx.query(
    `UPDATE comissao_importacao_linhas SET status = 'vinculada', referral_id = $2, partner_id = $3, motivo = NULL,
       resolvido_por = $4, resolvido_em = NOW() WHERE id = $1`,
    [linha.id, r.id, r.partner_id, quem]
  );
  return { linha_id: linha.id, lancamento: lanc };
}

async function confirmarSugestao(cx, linhaId, quem) {
  const l = await travarLinha(cx, linhaId, ['sugestao']);
  return ligarLinhaAIndicacao(cx, l, l.sugestao_referral_id, quem);
}

// Ambígua, sugestão (outra indicação) ou "sem Partner" (correção manual)
async function vincular(cx, linhaId, referralId, quem) {
  const l = await travarLinha(cx, linhaId, ['sugestao', 'ambigua', 'sem_partner']);
  return ligarLinhaAIndicacao(cx, l, Number(referralId), quem);
}

// Sugestão ou ambígua que não é de Partner -> volta a ser "sem Partner"
async function descartar(cx, linhaId, quem) {
  await travarLinha(cx, linhaId, ['sugestao', 'ambigua']);
  await cx.query(
    `UPDATE comissao_importacao_linhas SET status = 'sem_partner', sugestao_referral_id = NULL,
       motivo = 'Descartada pelo admin', resolvido_por = $2, resolvido_em = NOW() WHERE id = $1`,
    [linhaId, quem]
  );
  return { linha_id: linhaId };
}

// Linha de Partner que estava sem regra/nível: tenta de novo
async function tentarSemRegra(cx, linhaId, quem) {
  const l = await travarLinha(cx, linhaId, ['sem_regra']);
  const { regra, motivo } = await regraDaLinha(cx, l.partner_id, l);
  if (!regra) throw new ErroComissao(motivo);
  const lanc = await gerarLancamentoDaLinha(cx, l, l.referral_id, l.partner_id, regra, quem);
  await cx.query(
    `UPDATE comissao_importacao_linhas SET status = 'vinculada', motivo = NULL, resolvido_por = $2, resolvido_em = NOW() WHERE id = $1`,
    [l.id, quem]
  );
  return { linha_id: l.id, lancamento: lanc };
}

// Estorno da Azul num contrato de Partner: a política ainda vai ser
// definida; por enquanto o admin decide caso a caso.
async function decidirEstorno(cx, linhaId, acao, motivo, quem) {
  const l = await travarLinha(cx, linhaId, ['estorno_a_decidir']);
  const texto = String(motivo || '').trim();
  if (!texto) throw new ErroComissao('Informe o motivo da decisão.');
  if (!['estornar', 'manter'].includes(acao)) throw new ErroComissao('Ação inválida.');
  let resultado = null;
  if (acao === 'estornar') {
    if (!l.lancamento_estorno_id) throw new ErroComissao('Não há lançamento para estornar neste contrato; use "manter".');
    resultado = await pc.mudarStatus(cx, [l.lancamento_estorno_id], 'estornar', quem,
      { motivo: `Azul estornou o contrato ${l.numero_contrato} em ${l.dt_pagamento}: ${texto}` });
    if (!resultado.alterados.length) throw new ErroComissao(resultado.recusados[0]?.motivo || 'Não foi possível estornar.');
  }
  await cx.query(
    `UPDATE comissao_importacao_linhas SET status = 'estorno_resolvido', motivo = $2, resolvido_por = $3, resolvido_em = NOW()
     WHERE id = $1`,
    [l.id, `${acao === 'estornar' ? 'Lançamento estornado' : 'Lançamento mantido'}: ${texto}`, quem]
  );
  return { linha_id: l.id, acao };
}

const COLUNAS_LINHA_TELA = `
  l.id, l.importacao_id, l.linha_numero, l.tipo, l.numero_contrato, l.cliente_nome, l.cliente_cpf, l.produto,
  l.valor_comissao, l.dt_pagamento, l.competencia, l.status, l.motivo, l.referral_id, l.partner_id,
  l.sugestao_referral_id, l.lancamento_estorno_id`;

const mascarar = row => ({ ...row, cliente_cpf: mascararCpf(row.cliente_cpf) });

async function candidatosPorCpf(cx, cpf) {
  if (!cpf) return [];
  return (await cx.query(
    `SELECT r.id, r.protocol, r.client_name, r.created_at, r.status, pr.name AS produto,
            p.id AS partner_id, p.name AS partner_nome, p.code AS partner_codigo
     FROM referrals r JOIN partners p ON p.id = r.partner_id JOIN products pr ON pr.id = r.product_id
     WHERE r.client_cpf = $1 AND r.numero_contrato IS NULL AND ${SQL_INDICACAO_AZUL}
     ORDER BY r.created_at DESC`, [cpf]
  )).rows;
}

// Só o que precisa de decisão: sugestões, ambíguas, estornos a decidir e
// linhas de Partner sem regra. "Sem Partner" NÃO entra.
async function pendencias(cx) {
  const sugestoes = (await cx.query(
    `SELECT ${COLUNAS_LINHA_TELA}, r.protocol, r.client_name AS indicacao_cliente, p.name AS partner_nome, p.code AS partner_codigo
     FROM comissao_importacao_linhas l
     JOIN referrals r ON r.id = l.sugestao_referral_id JOIN partners p ON p.id = r.partner_id
     WHERE l.status = 'sugestao' ORDER BY l.dt_pagamento, l.id`
  )).rows.map(mascarar);
  const ambiguasBrutas = (await cx.query(
    `SELECT ${COLUNAS_LINHA_TELA} FROM comissao_importacao_linhas l WHERE l.status = 'ambigua' ORDER BY l.dt_pagamento, l.id`
  )).rows;
  const ambiguas = [];
  for (const a of ambiguasBrutas) ambiguas.push({ ...mascarar(a), candidatos: await candidatosPorCpf(cx, a.cliente_cpf) });
  const estornos = (await cx.query(
    `SELECT ${COLUNAS_LINHA_TELA}, pc.valor_partner AS lancamento_valor, pc.status AS lancamento_status,
            p.name AS partner_nome, p.code AS partner_codigo
     FROM comissao_importacao_linhas l
     LEFT JOIN partner_comissoes pc ON pc.id = l.lancamento_estorno_id
     LEFT JOIN partners p ON p.id = l.partner_id
     WHERE l.status = 'estorno_a_decidir' ORDER BY l.dt_pagamento, l.id`
  )).rows.map(mascarar);
  const semRegra = (await cx.query(
    `SELECT ${COLUNAS_LINHA_TELA}, p.name AS partner_nome, p.code AS partner_codigo
     FROM comissao_importacao_linhas l LEFT JOIN partners p ON p.id = l.partner_id
     WHERE l.status = 'sem_regra' ORDER BY l.dt_pagamento, l.id`
  )).rows.map(mascarar);
  return { sugestoes, ambiguas, estornos, sem_regra: semRegra };
}

// Busca para vincular à mão uma linha "sem Partner" (nome, contrato ou CPF)
async function buscarLinhas(cx, busca) {
  const t = String(busca || '').trim();
  if (t.length < 3) return [];
  const digitos = t.replace(/\D/g, '');
  const r = await cx.query(
    `SELECT ${COLUNAS_LINHA_TELA} FROM comissao_importacao_linhas l
     WHERE l.status = 'sem_partner' AND l.tipo = 'comissao'
       AND (l.cliente_nome ILIKE $1 OR l.numero_contrato = $2 OR ($3 <> '' AND l.cliente_cpf = $3))
     ORDER BY l.dt_pagamento DESC LIMIT 50`,
    [`%${t}%`, t, digitos.length === 11 ? digitos : '']
  );
  return r.rows.map(mascarar);
}

// Busca de indicações Azul de Partner (para vincular)
async function buscarIndicacoes(cx, busca) {
  const t = String(busca || '').trim();
  if (t.length < 3) return [];
  const digitos = t.replace(/\D/g, '');
  const r = await cx.query(
    `SELECT r.id, r.protocol, r.client_name, r.client_cpf, r.numero_contrato, r.created_at, pr.name AS produto,
            p.name AS partner_nome, p.code AS partner_codigo
     FROM referrals r JOIN partners p ON p.id = r.partner_id JOIN products pr ON pr.id = r.product_id
     WHERE ${SQL_INDICACAO_AZUL}
       AND (r.client_name ILIKE $1 OR r.protocol ILIKE $1 OR p.code ILIKE $1 OR ($2 <> '' AND r.client_cpf = $2))
     ORDER BY r.created_at DESC LIMIT 30`,
    [`%${t}%`, digitos.length === 11 ? digitos : '']
  );
  return r.rows.map(x => ({ ...x, client_cpf: mascararCpf(x.client_cpf) }));
}

async function historico(cx) {
  return (await cx.query(
    `SELECT id, origem, formato, arquivo_nome, periodo_de, periodo_ate, linhas_total, linhas_novas, linhas_ja_importadas,
            contagens, total_incentivo, total_descontos, total_partners, importado_por, importado_em
     FROM comissao_importacoes ORDER BY importado_em DESC, id DESC LIMIT 100`
  )).rows;
}

module.exports = {
  TIPOS_PRODUTO_AZUL, analisar, previa, confirmar, classificar,
  confirmarSugestao, vincular, descartar, tentarSemRegra, decidirEstorno,
  pendencias, buscarLinhas, buscarIndicacoes, historico,
};
