const db = require('../config/database');
const { onlyDigits, isValidCPF, isValidCNPJ } = require('../utils/validators');
const { parseBaseSeci, mesesAtras } = require('../services/baseSeciParser');
const baseSeci = require('../services/baseSeciService');

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function estatisticas() {
  const contagem = (await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE em_dia)::int AS em_dia,
            COUNT(*) FILTER (WHERE NOT em_dia)::int AS devendo
     FROM empresas_seci`
  )).rows[0];

  const ult = (await db.query(
    `SELECT mes_referencia, total_arrecadado, arrecadado_por_mes, criado_em
     FROM empresas_seci_importacoes ORDER BY mes_referencia DESC, criado_em DESC LIMIT 1`
  )).rows[0];

  let arrecadado = null;
  if (ult) {
    const mesAnterior = mesesAtras(ult.mes_referencia, 1);
    // Relatório de vários meses já traz o mês anterior; relatório mensal
    // precisa da importação do mês anterior.
    let valorAnterior = ult.arrecadado_por_mes?.[mesAnterior] ?? null;
    if (valorAnterior == null) {
      const ant = (await db.query(
        `SELECT arrecadado_por_mes FROM empresas_seci_importacoes
         WHERE mes_referencia = $1 ORDER BY criado_em DESC LIMIT 1`,
        [mesAnterior]
      )).rows[0];
      valorAnterior = ant?.arrecadado_por_mes?.[mesAnterior] ?? null;
    }
    const valorAtual = Number(ult.arrecadado_por_mes?.[ult.mes_referencia] ?? ult.total_arrecadado);
    arrecadado = {
      mes: ult.mes_referencia,
      valor: valorAtual,
      mes_anterior: mesAnterior,
      valor_anterior: valorAnterior == null ? null : Number(valorAnterior),
      variacao_pct: valorAnterior ? Math.round(((valorAtual - valorAnterior) / valorAnterior) * 1000) / 10 : null,
      atualizado_em: ult.criado_em,
    };
  }

  return { ...contagem, arrecadado };
}

async function listar(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const busca = String(req.query.busca || '').trim();
    const { status } = req.query;

    const where = [];
    const params = [];
    if (busca) {
      const digitos = onlyDigits(busca);
      params.push(`%${busca}%`);
      const cond = [`razao_social ILIKE $${params.length}`, `nome_fantasia ILIKE $${params.length}`];
      if (digitos.length >= 3) {
        params.push(`%${digitos}%`);
        cond.push(`cnpj_cpf LIKE $${params.length}`);
      }
      where.push(`(${cond.join(' OR ')})`);
    }
    if (status === 'em_dia') where.push('em_dia = true');
    if (status === 'devendo') where.push('em_dia = false');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = (await db.query(`SELECT COUNT(*)::int AS n FROM empresas_seci ${whereSql}`, params)).rows[0].n;
    params.push(limit, offset);
    const data = (await db.query(
      `SELECT id, cnpj_cpf, tipo_documento, documento_exibicao, razao_social, nome_fantasia, codigo_filiado,
              em_dia, mes_referencia, ultimo_valor_pago, sempre_ativa, observacoes_ativacao, atualizado_em
       FROM empresas_seci ${whereSql}
       ORDER BY razao_social ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )).rows;

    return res.json({ data, total, page, limit, stats: await estatisticas() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar a base SECI' });
  }
}

async function historico(req, res) {
  try {
    const r = await db.query(
      `SELECT i.*, c.name AS importado_por_nome
       FROM empresas_seci_importacoes i
       LEFT JOIN internal_collaborators c ON c.id = i.importado_por_id
       ORDER BY i.criado_em DESC LIMIT 24`
    );
    return res.json(r.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao carregar histórico' });
  }
}

function lerArquivo(req) {
  if (!req.file) {
    const e = new Error('Envie o arquivo do Higestor (.xlsx, .xls ou .csv)');
    e.status = 400;
    throw e;
  }
  const mesInformado = req.body?.mes_referencia;
  if (mesInformado && !MES_RE.test(mesInformado)) {
    const e = new Error('Mês de referência inválido (use AAAA-MM)');
    e.status = 400;
    throw e;
  }
  const parsed = parseBaseSeci(req.file.buffer, { mesInformado: mesInformado || undefined });
  if (parsed.empresas.length === 0) {
    const e = new Error('Nenhum CPF/CNPJ válido com pagamento encontrado no arquivo');
    e.status = 400;
    throw e;
  }
  return parsed;
}

function responderErroArquivo(res, err, padrao) {
  if (err.code === 'MES_OBRIGATORIO') return res.status(422).json({ error: err.message, code: err.code });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(400).json({ error: err.message || padrao });
}

// Não grava nada — o front mostra os números e reenvia o MESMO arquivo em
// /importar, que reprocessa do zero (nunca confia numa lista vinda do cliente).
async function previewImportacao(req, res) {
  try {
    const parsed = lerArquivo(req);
    const diff = await baseSeci.preview(parsed);
    return res.json({
      ...diff,
      arquivo: {
        nome: req.file.originalname,
        filtro: parsed.filtro,
        origem_mes: parsed.origemMes,
        titulos_quitados: parsed.titulosQuitados,
        total_pagamentos: parsed.totalPagamentos,
        total_arrecadado: parsed.totalArrecadado,
        arrecadado_por_mes: parsed.arrecadadoPorMes,
        linhas_ignoradas: parsed.linhasIgnoradas,
        exemplos_ignorados: parsed.exemplosIgnorados,
        linhas_sem_pagamento: parsed.linhasSemPagamento,
      },
    });
  } catch (err) {
    return responderErroArquivo(res, err, 'Erro ao ler o arquivo');
  }
}

async function importar(req, res) {
  try {
    const parsed = lerArquivo(req);
    const resultado = await baseSeci.aplicar(parsed, {
      importadoPorId: req.user?.type === 'internal' ? req.user.id : null,
      arquivoNome: req.file.originalname,
    });
    return res.status(201).json(resultado);
  } catch (err) {
    return responderErroArquivo(res, err, 'Erro ao importar');
  }
}

function celulaCsv(v) {
  if (v == null) return '';
  let s = String(v);
  // Evita fórmula no Excel (=, +, -, @ no início da célula)
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportar(req, res) {
  try {
    const r = await db.query(
      `SELECT documento_exibicao, tipo_documento, razao_social, nome_fantasia, codigo_filiado,
              em_dia, mes_referencia, ultimo_valor_pago, sempre_ativa
       FROM empresas_seci ORDER BY razao_social ASC`
    );
    const cabecalho = ['CPF/CNPJ', 'Tipo', 'Razão Social', 'Nome Fantasia', 'Código do Filiado', 'Situação', 'Último pagamento', 'Valor pago no mês', 'Sempre ativa'];
    const linhas = r.rows.map(e => [
      e.documento_exibicao, e.tipo_documento.toUpperCase(), e.razao_social, e.nome_fantasia, e.codigo_filiado,
      e.em_dia ? 'Em dia' : 'Devendo',
      e.mes_referencia ? `${e.mes_referencia.slice(5)}/${e.mes_referencia.slice(0, 4)}` : '',
      e.ultimo_valor_pago == null ? '' : String(e.ultimo_valor_pago).replace('.', ','),
      e.sempre_ativa ? 'Sim' : '',
    ].map(celulaCsv).join(';'));

    const hoje = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="base-seci-${hoje}.csv"`);
    // BOM: sem ele o Excel abre o UTF-8 com acento quebrado
    return res.send(`﻿${[cabecalho.join(';'), ...linhas].join('\r\n')}`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao exportar' });
  }
}

// Empresa do grupo que não paga guia mas precisa ficar liberada (ex.: Open
// Gestão). Ao desligar, volta a valer a janela dos 3 meses do último mês importado.
async function setSempreAtiva(req, res) {
  try {
    const { sempre_ativa, observacoes_ativacao } = req.body;
    if (typeof sempre_ativa !== 'boolean') return res.status(400).json({ error: 'sempre_ativa (boolean) é obrigatório' });

    const ultimoMes = await baseSeci.ultimoMesImportado();
    const limite = ultimoMes ? baseSeci.inicioJanela(ultimoMes) : null;
    const r = await db.query(
      `UPDATE empresas_seci
       SET sempre_ativa = $1,
           observacoes_ativacao = $2,
           em_dia = CASE WHEN $1 THEN true
                         WHEN $3::varchar IS NULL THEN em_dia
                         ELSE COALESCE(mes_referencia >= $3::varchar, false) END,
           atualizado_em = NOW()
       WHERE id = $4
       RETURNING *`,
      [sempre_ativa, observacoes_ativacao?.trim() || null, limite, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Empresa não encontrada' });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar' });
  }
}

// Público (sem login): usado no /acesso. CNPJ devolve razão social e nome
// fantasia (dado público da Receita). CPF devolve SÓ a situação — nome +
// situação de pagamento de uma pessoa física por CPF seria vazamento (LGPD).
async function verificarPublico(req, res) {
  try {
    const digitos = onlyDigits(req.query.documento);
    const valido = (digitos.length === 11 && isValidCPF(digitos)) || (digitos.length === 14 && isValidCNPJ(digitos));
    if (!valido) {
      return res.status(400).json({ error: 'Digite um CPF (11 números) ou CNPJ (14 números) válido.' });
    }

    const e = await baseSeci.consultarDocumento(digitos);
    const tipo = digitos.length === 14 ? 'cnpj' : 'cpf';
    if (!e) return res.json({ encontrado: false, tipo });

    const resposta = { encontrado: true, tipo, em_dia: e.em_dia };
    if (tipo === 'cnpj') {
      resposta.razao_social = e.razao_social;
      resposta.nome_fantasia = e.nome_fantasia;
    }
    return res.json(resposta);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar. Tente de novo em instantes.' });
  }
}

// Conferência pro Sindicato: quem virou associado (conta nova ou cliente
// que ativou pelo /meu) por empresa num período. O CNPJ é público — qualquer
// pessoa que digitar o CNPJ de uma empresa em dia vira associado (risco
// aceito pelo Junior); aqui o Renan enxerga isso e confere com a empresa.
// Empresa com muitos novos no período ganha o selo "conferir".
const ALERTA_NOVOS_POR_EMPRESA = 5;

async function novosAssociados(req, res) {
  try {
    const dias = [7, 30, 90].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
    const r = await db.query(
      `SELECT es.id, es.documento_exibicao, es.tipo_documento, es.razao_social, es.nome_fantasia, es.em_dia,
              COUNT(*)::int AS novos,
              json_agg(json_build_object(
                'id', a.id, 'nome', a.nome_completo, 'whatsapp', a.whatsapp,
                'desde', COALESCE(a.carteirinha_gerada_em, a.created_at)
              ) ORDER BY COALESCE(a.carteirinha_gerada_em, a.created_at) DESC) AS pessoas
       FROM sindicato_associados a
       JOIN empresas_seci es ON es.id = a.empresa_seci_id
       WHERE a.tipo_acesso = 'seci' AND NOT a.legado
         AND COALESCE(a.carteirinha_gerada_em, a.created_at) >= NOW() - ($1 || ' days')::interval
       GROUP BY es.id
       ORDER BY novos DESC, es.razao_social ASC
       LIMIT 200`,
      [String(dias)]
    );
    return res.json({
      dias,
      alerta_a_partir_de: ALERTA_NOVOS_POR_EMPRESA,
      total_novos: r.rows.reduce((s, e) => s + e.novos, 0),
      empresas: r.rows.map(e => ({ ...e, conferir: e.novos >= ALERTA_NOVOS_POR_EMPRESA })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar novos associados' });
  }
}

module.exports = { listar, historico, previewImportacao, importar, exportar, setSempreAtiva, verificarPublico, novosAssociados };
