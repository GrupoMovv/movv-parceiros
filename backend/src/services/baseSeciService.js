// Base SECI (empresas_seci): preview e aplicação da importação mensal do
// Relatório de Recebimentos, e a consulta "está em dia?" usada pelo
// autocadastro, pelos planos de parceiro e pelo /acesso.
//
// Regra dos 3 meses (tolerância do Sindicato, decisão do Junior em
// 25/09/2026): em dia = último pagamento no mês do arquivo ou nos 2
// anteriores. O relatório é mensal, então quem não aparece num mês NÃO vira
// devendo na hora — só quando o último pagamento (mes_referencia) sai da
// janela. sempre_ativa nunca vira devendo.
const db = require('../config/database');
const { mesesAtras } = require('./baseSeciParser');

// Chave arbitrária do advisory lock: duas importações ao mesmo tempo
// calculariam o diff sobre o mesmo estado e uma sobrescreveria a outra.
const LOCK_IMPORTACAO = 620062;

function inicioJanela(mesReferencia) {
  return mesesAtras(mesReferencia, 2);
}

async function ultimoMesImportado(client = db) {
  const r = await client.query('SELECT MAX(mes_referencia) AS mes FROM empresas_seci_importacoes');
  return r.rows[0].mes || null;
}

// Importar um relatório mais antigo que o último já importado recalcularia
// "em dia" contra um mês velho e desfaria renovações — bloqueia. Reimportar
// o MESMO mês (correção) é permitido.
function erroArquivoAntigo(mesArquivo, ultimoMes) {
  if (!ultimoMes || mesArquivo >= ultimoMes) return null;
  const fmt = m => `${m.slice(5)}/${m.slice(0, 4)}`;
  return `Este arquivo é de ${fmt(mesArquivo)}, mas a base já está atualizada até ${fmt(ultimoMes)}. Envie o relatório do mês mais recente.`;
}

async function calcularDiff(client, parsed) {
  const limite = inicioJanela(parsed.mesReferencia);
  const docs = parsed.empresas.map(e => e.cnpj_cpf);

  const existentesR = await client.query(
    'SELECT cnpj_cpf, em_dia, sempre_ativa FROM empresas_seci WHERE cnpj_cpf = ANY($1::varchar[])',
    [docs]
  );
  const existentes = new Map(existentesR.rows.map(r => [r.cnpj_cpf, r]));

  const novos = [];
  let renovados = 0;
  const voltaram = [];
  let foraDaJanela = 0; // no arquivo, mas o pagamento é anterior à janela (relatório de vários meses)
  for (const e of parsed.empresas) {
    const atual = existentes.get(e.cnpj_cpf);
    const emDia = e.mes_referencia >= limite;
    if (!emDia) foraDaJanela++;
    if (!atual) { novos.push(e); continue; }
    if (emDia) {
      renovados++;
      if (!atual.em_dia) voltaram.push(e);
    }
  }

  const ausentesR = await client.query(
    `SELECT cnpj_cpf, documento_exibicao, razao_social, nome_fantasia, mes_referencia, sempre_ativa
     FROM empresas_seci
     WHERE NOT (cnpj_cpf = ANY($1::varchar[])) AND em_dia = true`,
    [docs]
  );
  const marcarDevendo = [];
  let emTolerancia = 0;
  for (const a of ausentesR.rows) {
    if (a.sempre_ativa || (a.mes_referencia && a.mes_referencia >= limite)) emTolerancia++;
    else marcarDevendo.push(a);
  }

  const resumoEmpresa = e => ({
    documento: e.documento_exibicao, razao_social: e.razao_social, nome_fantasia: e.nome_fantasia,
    mes_referencia: e.mes_referencia,
  });
  const AMOSTRA = 50;

  return {
    mes_referencia: parsed.mesReferencia,
    janela_em_dia: { inicio: limite, fim: parsed.mesReferencia },
    total_empresas: parsed.empresas.length,
    novos: novos.length,
    renovados,
    voltaram_em_dia: voltaram.length,
    fora_da_janela: foraDaJanela,
    marcar_devendo: marcarDevendo.length,
    ausentes_em_tolerancia: emTolerancia,
    amostras: {
      novos: novos.slice(0, AMOSTRA).map(resumoEmpresa),
      voltaram: voltaram.slice(0, AMOSTRA).map(resumoEmpresa),
      marcar_devendo: marcarDevendo.slice(0, AMOSTRA).map(resumoEmpresa),
    },
  };
}

async function preview(parsed) {
  const ultimoMes = await ultimoMesImportado();
  const diff = await calcularDiff(db, parsed);
  return { ...diff, ultimo_mes_importado: ultimoMes, erro_arquivo_antigo: erroArquivoAntigo(parsed.mesReferencia, ultimoMes) };
}

// Tudo numa transação só: upsert de quem pagou, recálculo de quem não
// apareceu e o registro no histórico. Qualquer erro = nada muda.
async function aplicar(parsed, { importadoPorId, arquivoNome }) {
  return db.transacao(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_IMPORTACAO]);

    const erro = erroArquivoAntigo(parsed.mesReferencia, await ultimoMesImportado(client));
    if (erro) {
      const e = new Error(erro);
      e.status = 409;
      throw e;
    }

    const diff = await calcularDiff(client, parsed);
    const limite = inicioJanela(parsed.mesReferencia);
    const col = campo => parsed.empresas.map(e => e[campo]);

    await client.query(
      `INSERT INTO empresas_seci AS s
         (cnpj_cpf, tipo_documento, documento_exibicao, razao_social, nome_fantasia, codigo_filiado,
          em_dia, mes_referencia, ultimo_valor_pago)
       SELECT d, t, ex, rs, nf, cf, (mr >= $9), mr, v
       FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[],
                   $6::varchar[], $7::varchar[], $8::numeric[]) AS x(d, t, ex, rs, nf, cf, mr, v)
       ON CONFLICT (cnpj_cpf) DO UPDATE SET
         tipo_documento     = EXCLUDED.tipo_documento,
         documento_exibicao = EXCLUDED.documento_exibicao,
         razao_social       = EXCLUDED.razao_social,
         nome_fantasia      = COALESCE(EXCLUDED.nome_fantasia, s.nome_fantasia),
         codigo_filiado     = COALESCE(EXCLUDED.codigo_filiado, s.codigo_filiado),
         mes_referencia     = GREATEST(EXCLUDED.mes_referencia, s.mes_referencia),
         ultimo_valor_pago  = CASE WHEN s.mes_referencia IS NULL OR EXCLUDED.mes_referencia >= s.mes_referencia
                                   THEN EXCLUDED.ultimo_valor_pago ELSE s.ultimo_valor_pago END,
         em_dia             = s.sempre_ativa OR GREATEST(EXCLUDED.mes_referencia, s.mes_referencia) >= $9,
         atualizado_em      = NOW()`,
      [
        col('cnpj_cpf'), col('tipo_documento'), col('documento_exibicao'), col('razao_social'),
        col('nome_fantasia'), col('codigo_filiado'), col('mes_referencia'), col('ultimo_valor_pago'),
        limite,
      ]
    );

    // Quem não veio no arquivo: recalcula pela janela dos 3 meses.
    await client.query(
      `UPDATE empresas_seci
       SET em_dia = false, atualizado_em = NOW()
       WHERE NOT (cnpj_cpf = ANY($1::varchar[]))
         AND em_dia = true AND sempre_ativa = false
         AND (mes_referencia IS NULL OR mes_referencia < $2)`,
      [col('cnpj_cpf'), limite]
    );

    const emDiaDepois = (await client.query('SELECT COUNT(*)::int AS n FROM empresas_seci WHERE em_dia')).rows[0].n;

    await client.query(
      `INSERT INTO empresas_seci_importacoes
         (importado_por_id, arquivo_nome, mes_referencia, titulos_quitados, total_empresas, total_arrecadado,
          arrecadado_por_mes, novos, renovados, voltaram_em_dia, marcados_devendo, total_em_dia_depois)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        importadoPorId || null, arquivoNome || null, parsed.mesReferencia, parsed.titulosQuitados,
        parsed.empresas.length, parsed.totalArrecadado, JSON.stringify(parsed.arrecadadoPorMes),
        diff.novos, diff.renovados, diff.voltaram_em_dia, diff.marcar_devendo, emDiaDepois,
      ]
    );

    return { ...diff, total_em_dia_depois: emDiaDepois };
  });
}

// Consulta pontual por documento (só dígitos). null = não consta na base.
async function consultarDocumento(digitos) {
  const r = await db.query(
    'SELECT id, cnpj_cpf, tipo_documento, razao_social, nome_fantasia, em_dia FROM empresas_seci WHERE cnpj_cpf = $1',
    [digitos]
  );
  return r.rows[0] || null;
}

module.exports = { preview, aplicar, consultarDocumento, ultimoMesImportado, inicioJanela };
