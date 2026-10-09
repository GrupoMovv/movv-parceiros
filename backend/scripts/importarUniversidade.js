// Importa o conteúdo da Universidade MOVV Partner (Junior, 09/10/2026):
// módulos, aulas, tópicos, perguntas do quiz e o termo de adesão.
//
//   node scripts/importarUniversidade.js --dry-run          só lê os arquivos e mostra as contagens
//   node scripts/importarUniversidade.js                    grava (recusa o banco de produção)
//   node scripts/importarUniversidade.js --confirmar-producao
//
// Idempotente: casa por (modulo.numero, aula.ordem, topico.numero) e por
// (modulo.numero, pergunta.numero) e atualiza o texto SEM trocar os ids, para
// não perder o progresso dos Partners quando o conteúdo for reimportado.
// Nunca mexe em `publicado` do que já existe; o que é novo entra despublicado.
// Tópico editado ou criado pelo admin (editado_manual_em, migration 092) é
// pulado: a correção feita no portal não é sobrescrita pelo arquivo.
// O Módulo 7 (conteudo_pendente) fica sempre despublicado.
//
// Alternativas do quiz: cada uma ganha um id aleatório e fixo, e a resposta
// certa é guardada por esse id (nunca pela letra: no material original 62 das
// 85 certas são B). Na reimportação a alternativa é reconhecida pelo texto e
// mantém o id.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname, 'data');
const ESPERADO = { modulos: 17, modulos_com_conteudo: 16, aulas: 79, topicos: 379, perguntas: 85 };
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ACEITAR_CONTAGENS = args.includes('--aceitar-contagens');

function idAlternativa(usados) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id;
  do { id = Array.from(crypto.randomBytes(6), b => abc[b % abc.length]).join(''); } while (usados.has(id));
  usados.add(id);
  return id;
}

function lerArquivos() {
  const conteudo = JSON.parse(fs.readFileSync(path.join(DATA, 'universidade_conteudo.json'), 'utf8'));
  const quiz = JSON.parse(fs.readFileSync(path.join(DATA, 'universidade_quiz.json'), 'utf8'));
  const termo = fs.readFileSync(path.join(DATA, 'termo_adesao.md'), 'utf8').trim();
  return { conteudo, quiz, termo };
}

// Confere a estrutura e devolve as contagens. Lança erro com a lista de problemas.
function validar({ conteudo, quiz, termo }) {
  const erros = [];
  const nums = new Set();
  const c = { modulos: 0, modulos_com_conteudo: 0, aulas: 0, topicos: 0, perguntas: 0, certas_por_letra: {} };
  for (const m of conteudo.modulos) {
    if (!Number.isInteger(m.numero)) erros.push(`módulo sem número: ${m.titulo}`);
    if (nums.has(m.numero)) erros.push(`módulo ${m.numero} repetido`);
    nums.add(m.numero);
    if (!m.titulo) erros.push(`módulo ${m.numero} sem título`);
    c.modulos++;
    if (m.aulas.length) c.modulos_com_conteudo++;
    else if (!m.conteudo_pendente) erros.push(`módulo ${m.numero} sem aulas e sem conteudo_pendente`);
    const ordens = new Set();
    for (const a of m.aulas) {
      if (ordens.has(a.ordem)) erros.push(`módulo ${m.numero}: aula ${a.ordem} repetida`);
      ordens.add(a.ordem);
      if (!a.titulo) erros.push(`módulo ${m.numero} aula ${a.ordem} sem título`);
      if (!a.topicos?.length) erros.push(`módulo ${m.numero} aula ${a.ordem} sem tópicos`);
      c.aulas++;
      const tnums = new Set();
      for (const t of a.topicos || []) {
        if (tnums.has(t.numero)) erros.push(`módulo ${m.numero} aula ${a.ordem}: tópico ${t.numero} repetido`);
        tnums.add(t.numero);
        if (!t.titulo || !t.texto?.trim()) erros.push(`módulo ${m.numero} aula ${a.ordem} tópico ${t.numero} sem título ou texto`);
        c.topicos++;
      }
    }
  }
  const numsQuiz = new Set();
  for (const mq of quiz.modulos) {
    numsQuiz.add(mq.numero);
    if (!nums.has(mq.numero)) erros.push(`quiz do módulo ${mq.numero}, que não existe no conteúdo`);
    const pnums = new Set();
    for (const p of mq.perguntas) {
      if (pnums.has(p.numero)) erros.push(`quiz módulo ${mq.numero}: pergunta ${p.numero} repetida`);
      pnums.add(p.numero);
      const letras = p.alternativas.map(a => a.letra);
      const textos = p.alternativas.map(a => (a.texto || '').trim());
      if (p.alternativas.length < 2) erros.push(`quiz módulo ${mq.numero} pergunta ${p.numero}: menos de 2 alternativas`);
      if (new Set(textos).size !== textos.length || textos.some(t => !t)) erros.push(`quiz módulo ${mq.numero} pergunta ${p.numero}: alternativas vazias ou repetidas`);
      if (!letras.includes(p.correta)) erros.push(`quiz módulo ${mq.numero} pergunta ${p.numero}: correta "${p.correta}" não está nas alternativas`);
      c.certas_por_letra[p.correta] = (c.certas_por_letra[p.correta] || 0) + 1;
      c.perguntas++;
    }
  }
  for (const n of nums) if (!numsQuiz.has(n)) erros.push(`módulo ${n} sem quiz`);
  if (!termo) erros.push('termo_adesao.md vazio');
  if (erros.length) throw new Error('Arquivos com problema:\n  - ' + erros.join('\n  - '));
  return c;
}

function conferirContagens(c) {
  const diferentes = Object.keys(ESPERADO).filter(k => c[k] !== ESPERADO[k]);
  if (diferentes.length && !ACEITAR_CONTAGENS) {
    throw new Error('Contagens diferentes do esperado: ' + diferentes.map(k => `${k} ${c[k]} (esperado ${ESPERADO[k]})`).join(', ')
      + '\nSe o conteúdo cresceu de propósito, rode de novo com --aceitar-contagens.');
  }
}

function tituloDoTermo(md) {
  const h = md.split('\n').find(l => l.startsWith('# '));
  return h ? h.slice(2).trim() : 'Termo de adesão';
}

async function importar(client, { conteudo, quiz, termo }) {
  const r = { modulos: [0, 0], aulas: [0, 0], topicos: [0, 0], perguntas: [0, 0], termo: '', topicos_pulados: [] };
  const conta = (k, novo) => { r[k][novo ? 0 : 1]++; };
  const idModulo = {};

  for (const m of conteudo.modulos) {
    const pendente = !!m.conteudo_pendente;
    const ex = (await client.query('SELECT id FROM universidade_modulos WHERE numero = $1', [m.numero])).rows[0];
    if (ex) {
      await client.query(
        `UPDATE universidade_modulos SET titulo = $2, descricao = COALESCE($3, descricao), conteudo_pendente = $4,
                publicado = CASE WHEN $4 THEN false ELSE publicado END, atualizado_em = NOW()
          WHERE id = $1`, [ex.id, m.titulo, m.descricao || null, pendente]);
      idModulo[m.numero] = ex.id;
    } else {
      idModulo[m.numero] = (await client.query(
        `INSERT INTO universidade_modulos (numero, titulo, descricao, ordem, publicado, conteudo_pendente)
         VALUES ($1, $2, $3, $1, false, $4) RETURNING id`, [m.numero, m.titulo, m.descricao || null, pendente])).rows[0].id;
    }
    conta('modulos', !ex);

    for (const a of m.aulas) {
      const exA = (await client.query('SELECT id FROM universidade_aulas WHERE modulo_id = $1 AND ordem = $2', [idModulo[m.numero], a.ordem])).rows[0];
      let aulaId;
      if (exA) {
        aulaId = exA.id;
        await client.query(
          `UPDATE universidade_aulas SET titulo = $2, video_url = COALESCE($3, video_url), atualizado_em = NOW() WHERE id = $1`,
          [aulaId, a.titulo, a.video_url || null]);
      } else {
        aulaId = (await client.query(
          `INSERT INTO universidade_aulas (modulo_id, ordem, titulo, video_url) VALUES ($1, $2, $3, $4) RETURNING id`,
          [idModulo[m.numero], a.ordem, a.titulo, a.video_url || null])).rows[0].id;
      }
      conta('aulas', !exA);
      for (const [i, t] of a.topicos.entries()) {
        const up = await client.query(
          `INSERT INTO universidade_topicos (aula_id, numero, titulo, texto, ordem) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (aula_id, numero) DO UPDATE SET titulo = EXCLUDED.titulo, texto = EXCLUDED.texto, ordem = EXCLUDED.ordem,
             atualizado_em = CASE WHEN universidade_topicos.texto IS DISTINCT FROM EXCLUDED.texto
                                    OR universidade_topicos.titulo IS DISTINCT FROM EXCLUDED.titulo
                                  THEN NOW() ELSE universidade_topicos.atualizado_em END
           WHERE universidade_topicos.editado_manual_em IS NULL
           RETURNING (xmax = 0) AS novo`, [aulaId, t.numero, t.titulo, t.texto.trim(), i + 1]);
        // sem linha de volta = já existia e foi editado no admin: fica como está
        if (!up.rows[0]) r.topicos_pulados.push(`M${m.numero} aula ${a.ordem} tópico ${t.numero}`);
        else conta('topicos', up.rows[0].novo);
      }
    }
  }

  for (const mq of quiz.modulos) {
    for (const p of mq.perguntas) {
      const ex = (await client.query(
        'SELECT id, alternativas FROM universidade_quiz_perguntas WHERE modulo_id = $1 AND numero = $2',
        [idModulo[mq.numero], p.numero])).rows[0];
      const porTexto = new Map((ex?.alternativas || []).map(a => [a.texto, a.id]));
      const usados = new Set(porTexto.values());
      const alternativas = p.alternativas.map(a => {
        const texto = a.texto.trim();
        return { id: porTexto.get(texto) || idAlternativa(usados), texto };
      });
      const correta = alternativas[p.alternativas.findIndex(a => a.letra === p.correta)].id;
      if (ex) {
        await client.query(
          `UPDATE universidade_quiz_perguntas SET enunciado = $2, alternativas = $3, correta = $4,
                  explicacao = COALESCE(explicacao, $5) WHERE id = $1`,
          [ex.id, p.enunciado, JSON.stringify(alternativas), correta, p.explicacao || null]);
      } else {
        await client.query(
          `INSERT INTO universidade_quiz_perguntas (modulo_id, numero, enunciado, alternativas, correta, explicacao)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [idModulo[mq.numero], p.numero, p.enunciado, JSON.stringify(alternativas), correta, p.explicacao || null]);
      }
      conta('perguntas', !ex);
    }
  }

  // Termo: versão 1 despublicada. Se já foi publicado, não mexe (texto novo = versão nova pelo admin).
  const t = (await client.query(`SELECT id, publicado, texto FROM universidade_documentos WHERE documento = 'termo_adesao' ORDER BY versao DESC LIMIT 1`)).rows[0];
  if (!t) {
    await client.query(`INSERT INTO universidade_documentos (documento, versao, titulo, texto) VALUES ('termo_adesao', 1, $1, $2)`, [tituloDoTermo(termo), termo]);
    r.termo = 'criado (versão 1, despublicado)';
  } else if (t.publicado) {
    r.termo = 'já publicado: não alterado';
  } else if (t.texto !== termo) {
    await client.query(`UPDATE universidade_documentos SET titulo = $2, texto = $3 WHERE id = $1`, [t.id, tituloDoTermo(termo), termo]);
    r.termo = 'texto atualizado (continua despublicado)';
  } else {
    r.termo = 'sem mudança';
  }
  return r;
}

async function main() {
  const arquivos = lerArquivos();
  const c = validar(arquivos);
  console.log('Arquivos lidos de', DATA);
  console.log(`  módulos ............ ${c.modulos} (${c.modulos_com_conteudo} com conteúdo)`);
  console.log(`  aulas .............. ${c.aulas}`);
  console.log(`  tópicos ............ ${c.topicos}`);
  console.log(`  perguntas .......... ${c.perguntas}`);
  console.log(`  certas por letra ... ${Object.entries(c.certas_por_letra).sort().map(([l, n]) => `${l}=${n}`).join(' ')} (no portal a ordem é embaralhada)`);
  console.log(`  termo .............. ${arquivos.termo.length} caracteres, "${tituloDoTermo(arquivos.termo)}"`);
  conferirContagens(c);
  console.log('  contagens conferem com o esperado' + (ACEITAR_CONTAGENS ? ' (ou foram aceitas com --aceitar-contagens)' : ''));
  if (DRY) { console.log('\n--dry-run: nada foi gravado.'); return; }

  const url = process.env.DATABASE_URL || '';
  const host = (url.match(/@([^/:]+)/) || [])[1] || '(sem DATABASE_URL)';
  const producao = /render\.com/.test(host);
  console.log('\nBanco:', host, producao ? '(PRODUÇÃO)' : '');
  if (producao && !args.includes('--confirmar-producao')) {
    throw new Error('Banco de produção: rode com --confirmar-producao para gravar.');
  }
  const db = require('../src/config/database');
  const r = await db.transacao(client => importar(client, arquivos));
  const f = ([n, a]) => `${n} novos, ${a} atualizados`;
  console.log(`Gravado. módulos: ${f(r.modulos)} · aulas: ${f(r.aulas)} · tópicos: ${f(r.topicos)}, ${r.topicos_pulados.length} pulados (editados no admin) · perguntas: ${f(r.perguntas)} · termo: ${r.termo}`);
  if (r.topicos_pulados.length) console.log('  pulados:', r.topicos_pulados.join(', '));
  await db.pool?.end?.();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error('\nERRO:', e.message); process.exit(1); });
}

module.exports = { lerArquivos, validar, importar };
