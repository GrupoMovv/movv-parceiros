// Consultas SOMENTE LEITURA da Universidade MOVV Partner (Junior, 14 e 15/10/2026).
// Roda as Consultas 1 a 10 da revisão dos textos + a contagem de Partners
// por nível e grava os resultados em arquivos de texto (separados por TAB)
// em relatorios-leitura/universidade-AAAA-MM-DD/, na raiz do projeto.
//
//   cd backend
//   node scripts/consultasUniversidadeLeitura.js
//   (o script pede a URL do banco; cole e tecle Enter — ela não aparece)
//
// Proteções:
// - só SELECT/WITH: qualquer outra instrução é recusada antes de ir ao banco;
// - a sessão é aberta como somente leitura (default_transaction_read_only) e
//   tudo roda dentro de BEGIN READ ONLY: o próprio Postgres recusa escrita;
// - a URL nunca é gravada nem impressa (nem em mensagem de erro); o script
//   NÃO lê o .env — a URL vem só da digitação (ou de DATABASE_URL_LEITURA);
// - sem dado de Partner nem de cliente: nada de nome, e-mail, CPF ou texto
//   de Partner; de Partners, só contagens.
const fs = require('fs');
const path = require('path');

const CONSULTAS = [
  {
    arquivo: '01_estrutura_topicos.txt',
    titulo: 'Consulta 1 — estrutura (módulo, aula, tópico, título), sem os textos',
    sql: `
SELECT m.numero AS mod, m.publicado, a.ordem AS aula, a.titulo AS aula_titulo, t.numero AS top, t.titulo,
       (t.editado_manual_em IS NOT NULL) AS editado_no_admin
FROM universidade_topicos t
JOIN universidade_aulas a ON a.id = t.aula_id
JOIN universidade_modulos m ON m.id = a.modulo_id
ORDER BY m.numero, a.ordem, t.numero`,
  },
  {
    arquivo: '02_ocorrencias_g1_r1_r2.txt',
    titulo: 'Consulta 2 — G1 (Movv Certificado), R1 (CRM) e R2 (tabela vigente) em tópicos, aulas, módulos e quiz',
    sql: `
WITH txt AS (
  SELECT m.numero AS mod, 'topico' AS onde, a.ordem AS aula, t.numero AS item, t.titulo || ' ' || t.texto AS s
  FROM universidade_topicos t JOIN universidade_aulas a ON a.id = t.aula_id JOIN universidade_modulos m ON m.id = a.modulo_id
  UNION ALL SELECT m.numero, 'aula', a.ordem, NULL, a.titulo FROM universidade_aulas a JOIN universidade_modulos m ON m.id = a.modulo_id
  UNION ALL SELECT numero, 'modulo', NULL, NULL, titulo || ' ' || coalesce(descricao, '') FROM universidade_modulos
  UNION ALL SELECT m.numero, 'quiz', NULL, q.numero, q.enunciado || ' ' || q.alternativas::text || ' ' || coalesce(q.explicacao, '')
  FROM universidade_quiz_perguntas q JOIN universidade_modulos m ON m.id = q.modulo_id),
achados AS (
  SELECT mod, onde, aula, item, termo, s, position(termo IN s) AS pos FROM txt
  CROSS JOIN unnest(ARRAY['MOVV Certificados', 'Movv Certificados', 'MOVV Certificado', 'CRM']) AS termo
  WHERE position(termo IN s) > 0
  UNION ALL
  SELECT mod, onde, aula, item, termo, s, position(termo IN lower(s)) FROM txt
  CROSS JOIN unnest(ARRAY['tabela vigente', 'tabela de comissões', 'tabela de comissão']) AS termo
  WHERE position(termo IN lower(s)) > 0)
SELECT mod, onde, aula, item, termo,
       replace(replace(substring(s FROM greatest(1, pos - 50) FOR 140), E'\\n', ' '), E'\\t', ' ') AS trecho
FROM achados
ORDER BY 1, 2, 3, 4, 5`,
  },
  {
    arquivo: '03_contagens_progresso.txt',
    titulo: 'Consulta 3 — contagens de progresso (só números)',
    sql: `
SELECT (SELECT count(DISTINCT user_id) FROM universidade_progresso) AS partners_com_aula_lida,
       (SELECT count(DISTINCT user_id) FROM universidade_quiz_tentativas) AS partners_com_quiz,
       (SELECT count(*) FROM universidade_certificacoes WHERE status = 'valida') AS certificados_validos`,
  },
  {
    arquivo: '04_quiz_assuntos.txt',
    titulo: 'Consulta 4 — perguntas do quiz que tocam assuntos que vão mudar',
    sql: `
SELECT m.numero AS mod, q.numero, termo,
       replace(substring(q.enunciado FROM 1 FOR 140), E'\\n', ' ') AS enunciado
FROM universidade_quiz_perguntas q JOIN universidade_modulos m ON m.id = q.modulo_id
CROSS JOIN unnest(ARRAY['nota', 'rpa', 'offline', 'notifica', 'meta', 'recorr', 'permanên', 'ranking', 'point', 'hub',
                        'regional', 'deslig', 'devolu', 'prazo', 'dia útil', 'tabela', 'crm', 'benefício', 'federal', 'open gest']) AS termo
WHERE position(termo IN lower(q.enunciado || ' ' || q.alternativas::text || ' ' || coalesce(q.explicacao, ''))) > 0
ORDER BY 1, 2, 3`,
  },
  {
    arquivo: '05_modulo_7.txt',
    titulo: 'Consulta 5 — Módulo 7 (título e contagem de tópicos)',
    sql: `
SELECT m.numero, m.titulo, m.publicado, m.conteudo_pendente, count(t.id) AS topicos
FROM universidade_modulos m
LEFT JOIN universidade_aulas a ON a.modulo_id = m.id
LEFT JOIN universidade_topicos t ON t.aula_id = a.id
WHERE m.numero = 7
GROUP BY m.id`,
  },
  {
    arquivo: '06_partners_por_nivel.txt',
    titulo: 'Partners por nível (só números)',
    sql: `
SELECT coalesce(nivel_partner, 'sem nível') AS nivel,
       count(*) AS total, count(*) FILTER (WHERE is_active) AS ativos
FROM partners
WHERE type = 'movv_partner'
GROUP BY 1
ORDER BY 1`,
  },
];

// Consultas 7 a 10 (15/10/2026): quiz e textos completos, um arquivo por
// módulo e em blocos legíveis (o texto sai como está no banco, com as
// quebras de linha); termos a revisar; todos os campos dos módulos.
CONSULTAS.push(
  {
    arquivo: '07_quiz_modulo_{mod}.txt',
    titulo: 'Consulta 7 — quiz completo do módulo {mod}',
    dividirPor: 'mod',
    formato: 'blocos',
    cabecalhoBloco: r => `Pergunta ${r.numero}${r.ativa ? '' : ' (INATIVA)'}`,
    corpoBloco: r => [
      `Enunciado: ${r.enunciado}`,
      ...(Array.isArray(r.alternativas) ? r.alternativas : []).map(a => `  ${a.id === r.correta ? '(CERTA) ' : '        '}${a.texto}`),
      `Explicação: ${r.explicacao || '—'}`,
    ].join('\n'),
    sql: `
SELECT m.numero AS mod, q.numero, q.ativa, q.enunciado, q.alternativas, q.correta, q.explicacao
FROM universidade_quiz_perguntas q JOIN universidade_modulos m ON m.id = q.modulo_id
ORDER BY m.numero, q.numero`,
  },
  {
    arquivo: '08_textos_modulo_{mod}.txt',
    titulo: 'Consulta 8 — título e texto completo dos tópicos do módulo {mod}',
    dividirPor: 'mod',
    formato: 'blocos',
    cabecalhoBloco: r => `M${r.mod} · Aula ${r.aula} (${r.aula_titulo}) · Tópico ${r.top} — ${r.titulo}${r.editado_no_admin ? '  [editado no admin]' : ''}`,
    corpoBloco: r => r.texto,
    sql: `
SELECT m.numero AS mod, a.ordem AS aula, a.titulo AS aula_titulo, t.numero AS top, t.titulo, t.texto,
       (t.editado_manual_em IS NOT NULL) AS editado_no_admin
FROM universidade_topicos t
JOIN universidade_aulas a ON a.id = t.aula_id
JOIN universidade_modulos m ON m.id = a.modulo_id
WHERE m.numero IN (0, 1, 3, 4, 5, 6, 8, 10, 11)
ORDER BY m.numero, a.ordem, t.numero`,
  },
  {
    arquivo: '09_termos_revisar.txt',
    titulo: 'Consulta 9 — aplicativo, app, Jesley, complemento técnico, diretriz, sandbox, roteiro, vídeo',
    sql: `
WITH txt AS (
  SELECT m.numero AS mod, 'topico' AS onde, a.ordem AS aula, t.numero AS item, t.titulo || ' ' || t.texto AS s
  FROM universidade_topicos t JOIN universidade_aulas a ON a.id = t.aula_id JOIN universidade_modulos m ON m.id = a.modulo_id
  UNION ALL SELECT m.numero, 'aula', a.ordem, NULL, a.titulo FROM universidade_aulas a JOIN universidade_modulos m ON m.id = a.modulo_id
  UNION ALL SELECT numero, 'modulo', NULL, NULL, titulo || ' ' || coalesce(descricao, '') FROM universidade_modulos
  UNION ALL SELECT m.numero, 'quiz', NULL, q.numero, q.enunciado || ' ' || q.alternativas::text || ' ' || coalesce(q.explicacao, '')
  FROM universidade_quiz_perguntas q JOIN universidade_modulos m ON m.id = q.modulo_id),
achados AS (
  SELECT mod, onde, aula, item, termo, s, position(termo IN lower(s)) AS pos FROM txt
  CROSS JOIN unnest(ARRAY['aplicativo', ' app', 'jesley', 'complemento técnico', 'diretriz', 'sandbox', 'roteiro', 'vídeo']) AS termo
  WHERE position(termo IN lower(s)) > 0)
SELECT mod, onde, aula, item, termo,
       replace(replace(substring(s FROM greatest(1, pos - 50) FOR 140), E'\\n', ' '), E'\\t', ' ') AS trecho
FROM achados
ORDER BY 1, 2, 3, 4, 5`,
  },
  {
    arquivo: '10_modulos_campos.txt',
    titulo: 'Consulta 10 — todos os campos dos módulos + aulas, tópicos e perguntas ativas (não há campo "obrigatório": todo módulo publicado conta para a certificação)',
    sql: `
SELECT m.*,
       (SELECT count(*) FROM universidade_aulas a WHERE a.modulo_id = m.id) AS aulas,
       (SELECT count(*) FROM universidade_aulas a JOIN universidade_topicos t ON t.aula_id = a.id WHERE a.modulo_id = m.id) AS topicos,
       (SELECT count(*) FROM universidade_quiz_perguntas q WHERE q.modulo_id = m.id AND q.ativa) AS perguntas_ativas
FROM universidade_modulos m
ORDER BY m.numero`,
  },
  {
    arquivo: '10b_config_universidade.txt',
    titulo: 'Consulta 10b — configuração da Universidade (nota mínima, validade, prazo, trava do portal)',
    sql: `SELECT chave, valor, atualizado_em FROM universidade_config ORDER BY chave`,
  },
);

// Recusa tudo que não for uma única consulta SELECT/WITH
function somenteLeitura(sql) {
  const limpo = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")      // conteúdo de strings não conta
    .trim();
  if (!/^(select|with)\b/i.test(limpo)) throw new Error('Instrução recusada: só SELECT/WITH é permitido.');
  if (limpo.replace(/;\s*$/, '').includes(';')) throw new Error('Instrução recusada: uma consulta por vez.');
  if (/\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|copy|call|do|vacuum|reindex|cluster|lock|set|reset|refresh|comment|security|listen|notify)\b/i
    .test(limpo.replace(/\bset\s+transaction\b/gi, ''))) {
    throw new Error('Instrução recusada: contém palavra de escrita ou de configuração.');
  }
  // funções que mudam configuração, sequência ou acessam fora do banco
  if (/\b(set_config|setval|nextval|pg_\w+|lo_\w+|dblink\w*)\s*\(/i.test(limpo)) {
    throw new Error('Instrução recusada: chama função que não é de leitura.');
  }
  return sql;
}

const celula = v => (v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)))
  .replace(/[\t\r\n]+/g, ' ');

function emTexto(c, rows, fields) {
  const cab = fields.map(f => f.name);
  const linhas = rows.map(r => cab.map(k => celula(r[k])).join('\t'));
  return `# ${c.titulo}\n# ${rows.length} linha(s)\n${cab.join('\t')}\n${linhas.join('\n')}\n`;
}

// Bloco legível: cabeçalho do item e o texto como está no banco
function emBlocos(c, rows) {
  const blocos = rows.map(r => `=== ${c.cabecalhoBloco(r)}\n${String(c.corpoBloco(r) ?? '').replace(/\r\n/g, '\n')}\n`);
  return `# ${c.titulo}\n# ${rows.length} item(ns)\n\n${blocos.join('\n')}`;
}

// Roda as consultas num cliente já aberto (pg ou equivalente) — separado
// para poder ser testado sem banco de produção.
async function rodarConsultas(cliente, pasta) {
  fs.mkdirSync(pasta, { recursive: true });
  const resumo = [];
  await cliente.query('BEGIN READ ONLY');
  try {
    for (const c of CONSULTAS) {
      const r = await cliente.query(somenteLeitura(c.sql));
      // um arquivo por valor da coluna (ex.: um por módulo) ou um arquivo só
      const grupos = new Map();
      if (c.dividirPor) for (const row of r.rows) {
        const k = String(row[c.dividirPor]).padStart(2, '0');
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(row);
      } else grupos.set('', r.rows);
      for (const [k, rows] of grupos) {
        const cfg = { ...c, titulo: c.titulo.replace('{mod}', Number(k)) };
        const nome = c.arquivo.replace('{mod}', k);
        const corpo = c.formato === 'blocos' ? emBlocos(cfg, rows) : emTexto(cfg, rows, r.fields);
        fs.writeFileSync(path.join(pasta, nome), corpo, 'utf8');
        resumo.push(`${nome}: ${rows.length} linha(s)`);
      }
    }
  } finally {
    await cliente.query('ROLLBACK');   // nada a confirmar: só leitura
  }
  return resumo;
}

function perguntarSemEco(pergunta) {
  return new Promise((ok, falha) => {
    if (!process.stdin.isTTY) return falha(new Error('Rode num terminal interativo (a URL é digitada sem aparecer).'));
    process.stdout.write(pergunta);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let valor = '';
    const ao = ch => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', ao); process.stdout.write('\n'); return ok(valor.trim()); }
        if (c === '\u0003') { stdin.setRawMode(false); process.stdout.write('\n'); process.exit(1); }
        if (c === '\u007f' || c === '\b') valor = valor.slice(0, -1); else valor += c;
      }
    };
    stdin.on('data', ao);
  });
}

async function main() {
  const url = process.env.DATABASE_URL_LEITURA || await perguntarSemEco('Cole a URL do banco (não aparece na tela) e tecle Enter: ');
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('Isso não parece uma URL de banco Postgres.');
  const esconder = msg => String(msg || '').split(url).join('[URL]');

  const { Client } = require('pg');
  const cliente = new Client({
    connectionString: url,
    ssl: url.includes('render.com') ? { rejectUnauthorized: false } : false,
    options: '-c default_transaction_read_only=on',
    application_name: 'consultas-universidade-leitura',
  });
  const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const pasta = path.join(__dirname, '../../relatorios-leitura', `universidade-${dia}`);
  try {
    await cliente.connect();
    const resumo = await rodarConsultas(cliente, pasta);
    console.log(`Pronto (somente leitura). Arquivos em ${path.relative(path.join(__dirname, '../..'), pasta)}:`);
    for (const l of resumo) console.log(`  ${l}`);
  } catch (err) {
    console.error('Erro:', esconder(err.message));
    process.exitCode = 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

if (require.main === module) {
  main().catch(err => { console.error('Erro:', err.message); process.exitCode = 1; });
}

module.exports = { CONSULTAS, somenteLeitura, rodarConsultas };
