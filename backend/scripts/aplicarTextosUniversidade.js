// Aplica o lote de ajuste dos textos da Universidade (Junior, 15/10/2026).
// Itens em scripts/textos-universidade/lote-2026-10.js.
//
//   cd backend
//   node scripts/aplicarTextosUniversidade.js             PRÉVIA: só lê (sessão somente leitura) e lista,
//                                                          item a item, o que aplicaria / já aplicado / pulado
//   node scripts/aplicarTextosUniversidade.js --simular   lê o conteúdo (só leitura), copia para um banco em
//                                                          memória NESTA máquina, aplica, roda de novo (tem de
//                                                          dar 0 mudança), desfaz e confere; grava antes/depois
//   node scripts/aplicarTextosUniversidade.js --aplicar --confirmar-producao      grava (só com autorização)
//   node scripts/aplicarTextosUniversidade.js --desfazer --confirmar-producao     volta os textos do lote
//
// A URL do banco é pedida na hora, sem aparecer na tela, e nunca é gravada
// nem impressa. Relatórios vão para relatorios-leitura/ (no .gitignore).
//
// Regras: localiza por módulo + aula (ordem) + tópico (número) e confere o
// título atual — se não conferir, PULA e lista; guarda a linha original em
// universidade_textos_backup (migration 097) uma vez só por lote; marca o
// tópico como editado (a reimportação não sobrescreve); registra em
// admin_acoes; NÃO mexe em versao_conteudo (não é "mudança relevante") nem
// no termo de adesão; rodar duas vezes não tem efeito. Ao gravar, cada
// UPDATE confere que a linha ainda é a que foi lida (senão desfaz tudo).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LOTE, ITENS: ITENS_TEXTOS, TROCAS_GERAIS } = require('./textos-universidade/lote-2026-10');
const { ITENS: ITENS_QUIZ } = require('./textos-universidade/lote-2026-10-quiz');
const ITENS = [...ITENS_TEXTOS, ...ITENS_QUIZ];

// ─── Ler (só SELECT) ────────────────────────────────────────────────────────

async function carregarConteudo(cx) {
  const q = async sql => (await cx.query(sql)).rows;
  return {
    modulos: await q('SELECT * FROM universidade_modulos ORDER BY id'),
    aulas: await q('SELECT * FROM universidade_aulas ORDER BY id'),
    topicos: await q('SELECT * FROM universidade_topicos ORDER BY id'),
    perguntas: await q('SELECT * FROM universidade_quiz_perguntas ORDER BY id'),
  };
}

// ─── Planejar (função pura: não toca no banco) ──────────────────────────────

const norm = s => String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase();
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function trocar(texto, regra) {
  let s = String(texto ?? '');
  for (const [de, para] of regra.trocas) {
    if (!regra.palavraInteira) { s = s.split(de).join(para); continue; }
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(de)}(?![\\p{L}\\p{N}])`, 'gu');
    s = s.replace(re, (m, pos, todo) => {
      const antes = todo.slice(0, pos);
      const inicio = regra.maiusculaNoInicio && (pos === 0 || /(^|[.!?:]\s+|\n\s*)$/.test(antes));
      return inicio ? para[0].toUpperCase() + para.slice(1) : para;
    });
  }
  return s;
}

function aplicarGerais(mod, tabela, texto, usadas, alvo) {
  let s = texto;
  for (const g of TROCAS_GERAIS) {
    if (!g.tabelas.includes(tabela) || g.excetoModulos.includes(mod)) continue;
    if (alvo && (g.excetoTopicos || []).some(e => e.mod === mod && e.aula === alvo.aula && e.top === alvo.top)) continue;
    const novo = trocar(s, g);
    if (novo !== s && usadas) usadas.add(g.id);
    s = novo;
  }
  return s;
}

// id de alternativa nova: 6 caracteres, fixo por lote + item + posição
const idOpcao = (item, i) => BigInt(`0x${crypto.createHash('sha256').update(`${LOTE}:${item}:${i}`).digest('hex').slice(0, 12)}`)
  .toString(36).padStart(6, '0').slice(-6);
const textosDe = p => (p.alternativas || []).map(a => a.texto);
const certaDe = p => (p.alternativas || []).find(a => a.id === p.correta)?.texto ?? null;

function planejar(conteudo, itens = ITENS) {
  const clonar = x => JSON.parse(JSON.stringify(x));
  const mods = new Map(conteudo.modulos.map(m => [m.id, m]));
  const aulas = conteudo.aulas.map(a => ({ ...clonar(a), mod: mods.get(a.modulo_id)?.numero }));
  const topicos = conteudo.topicos.map(clonar);
  const perguntas = conteudo.perguntas.map(p => ({ ...clonar(p), mod: mods.get(p.modulo_id)?.numero }));
  const modulos = conteudo.modulos.map(clonar);
  const original = new Map();
  for (const [tabela, lista] of [['universidade_topicos', conteudo.topicos], ['universidade_aulas', conteudo.aulas],
    ['universidade_modulos', conteudo.modulos], ['universidade_quiz_perguntas', conteudo.perguntas]]) {
    for (const r of lista) original.set(`${tabela}:${r.id}`, r);
  }
  const aulaDe = (mod, ordem) => aulas.find(a => a.mod === mod && a.ordem === ordem);
  const modDaAula = new Map(aulas.map(a => [a.id, a.mod]));
  const topicoDe = (mod, ordem, numero) => {
    const a = aulaDe(mod, ordem);
    return a ? topicos.find(t => t.aula_id === a.id && t.numero === numero) : undefined;
  };

  const tocados = new Map();   // `${tabela}:${id}` -> Set(itens)
  const tocar = (tabela, id, item) => {
    const k = `${tabela}:${id}`;
    if (!tocados.has(k)) tocados.set(k, new Set());
    tocados.get(k).add(item);
  };
  const novos = [];
  const relatorio = [];
  const rel = (item, status, motivo = '', alvo = '') => relatorio.push({ id: item.id, status, motivo, alvo });

  for (const it of itens) {
    const onde = it.top ? `M${it.mod} · Aula ${it.aula} · Tópico ${it.top}` : `M${it.mod} · Aula ${it.aula}`;
    if (it.tipo === 'adiado') { rel(it, 'adiado', it.motivo || 'aguardando autorização', onde); continue; }

    if (it.tipo === 'aula_titulo') {
      const a = aulaDe(it.mod, it.aula);
      if (!a) { rel(it, 'pulado', 'aula não encontrada', onde); continue; }
      const final = aplicarGerais(it.mod, 'aulas', it.novoTitulo);
      if (a.titulo === final) { rel(it, 'ja_aplicado', '', onde); continue; }
      if (norm(a.titulo) !== norm(it.tituloAtual)) { rel(it, 'pulado', `título atual não confere: "${a.titulo}"`, onde); continue; }
      a.titulo = final;
      tocar('universidade_aulas', a.id, it.id);
      rel(it, 'aplicar', '', onde);
      continue;
    }

    if (it.tipo === 'topico_novo') {
      const a = aulaDe(it.mod, it.aula);
      if (!a) { rel(it, 'pulado', 'aula não encontrada', onde); continue; }
      const daAula = topicos.filter(t => t.aula_id === a.id);
      if (daAula.some(t => norm(t.titulo) === norm(it.novoTitulo))) { rel(it, 'ja_aplicado', 'a aula já tem tópico com este título', onde); continue; }
      const numero = Math.max(0, ...daAula.map(t => t.numero)) + 1;
      const ordem = Math.max(0, ...daAula.map(t => t.ordem)) + 1;
      const novo = { id: null, aula_id: a.id, numero, ordem,
        titulo: aplicarGerais(it.mod, 'topicos', it.novoTitulo), texto: aplicarGerais(it.mod, 'topicos', it.novoTexto), item: it.id };
      topicos.push(novo);
      novos.push(novo);
      rel(it, 'aplicar', `novo tópico ${numero}`, `M${it.mod} · Aula ${it.aula} · Tópico ${numero} (novo)`);
      continue;
    }

    if (it.tipo === 'quiz_reescrita' || it.tipo === 'quiz_opcao') {
      const ondeQ = `M${it.mod} · Pergunta ${it.numero}`;
      const doModulo = perguntas.filter(x => x.mod === it.mod);
      const atualG = aplicarGerais(it.mod, 'quiz', it.enunciadoAtual);
      const porAtual = doModulo.find(x => norm(x.enunciado) === norm(it.enunciadoAtual) || norm(x.enunciado) === norm(atualG));
      const aviso = x => (x && x.numero !== it.numero ? ` (está como pergunta ${x.numero} no banco)` : '');

      if (it.tipo === 'quiz_opcao') {
        const x = porAtual;
        if (!x) { rel(it, 'pulado', 'enunciado atual não encontrado no módulo', ondeQ); continue; }
        let mudou = false;
        let faltou = null;
        const alternativas = x.alternativas.map(a => ({ ...a }));
        for (const [de, para] of it.trocas) {
          const final = aplicarGerais(it.mod, 'quiz', para);
          const alvo = alternativas.find(a => norm(a.texto) === norm(de) || norm(a.texto) === norm(aplicarGerais(it.mod, 'quiz', de)));
          if (alvo) { if (alvo.texto !== final) { alvo.texto = final; mudou = true; } } else if (!alternativas.some(a => a.texto === final)) faltou = de;
        }
        if (faltou) { rel(it, 'pulado', `opção não encontrada: "${faltou}"`, ondeQ); continue; }
        if (!mudou) { rel(it, 'ja_aplicado', '', ondeQ); continue; }
        x.alternativas = alternativas;
        tocar('universidade_quiz_perguntas', x.id, it.id);
        rel(it, 'aplicar', aviso(x).trim(), ondeQ);
        continue;
      }

      const enunciado = aplicarGerais(it.mod, 'quiz', it.novoEnunciado);
      const opcoes = it.opcoes.map(o => ({ ...o, texto: aplicarGerais(it.mod, 'quiz', o.texto) }));
      const certa = opcoes.find(o => o.correta).texto;
      const porNovo = doModulo.find(x => norm(x.enunciado) === norm(enunciado));
      const x = porAtual || porNovo;
      if (!x) { rel(it, 'pulado', 'enunciado atual não encontrado no módulo', ondeQ); continue; }
      const igual = x.enunciado === enunciado && JSON.stringify(textosDe(x)) === JSON.stringify(opcoes.map(o => o.texto))
        && certaDe(x) === certa && x.explicacao == null;
      if (igual) { rel(it, 'ja_aplicado', '', ondeQ); continue; }
      if (!porAtual) { rel(it, 'pulado', 'o enunciado já é o novo, mas as opções são outras (editado depois?)', ondeQ); continue; }
      x.enunciado = enunciado;
      x.alternativas = opcoes.map((o, i) => ({ id: idOpcao(it.id, i), texto: o.texto }));
      x.correta = x.alternativas[opcoes.findIndex(o => o.correta)].id;
      x.explicacao = null;
      tocar('universidade_quiz_perguntas', x.id, it.id);
      rel(it, 'aplicar', aviso(x).trim(), ondeQ);
      continue;
    }

    // topico e topico_trecho
    const t = topicoDe(it.mod, it.aula, it.top);
    if (!t) { rel(it, 'pulado', 'tópico não encontrado', onde); continue; }
    const alvoT = { aula: it.aula, top: it.top };
    const tituloConfere = norm(t.titulo) === norm(it.tituloAtual) || norm(t.titulo) === norm(aplicarGerais(it.mod, 'topicos', it.tituloAtual, null, alvoT));
    let novoTexto;
    let novoTitulo;
    if (it.tipo === 'topico_trecho') {
      if (!tituloConfere) { rel(it, 'pulado', `título atual não confere: "${t.titulo}"`, onde); continue; }
      let s = t.texto;
      let faltou = null;
      for (const [de, para] of it.trocas) {
        if (s.includes(de)) s = s.split(de).join(para);
        else if (!s.includes(para)) faltou = de;
      }
      if (faltou) { rel(it, 'pulado', `trecho não encontrado: "${faltou}"`, onde); continue; }
      novoTexto = aplicarGerais(it.mod, 'topicos', s);
      novoTitulo = aplicarGerais(it.mod, 'topicos', t.titulo);
    } else {
      novoTitulo = aplicarGerais(it.mod, 'topicos', it.novoTitulo ?? t.titulo);
      novoTexto = aplicarGerais(it.mod, 'topicos', it.novoTexto);
    }
    if (t.titulo === novoTitulo && t.texto === novoTexto) { rel(it, 'ja_aplicado', '', onde); continue; }
    if (!tituloConfere) {
      const motivo = norm(t.titulo) === norm(novoTitulo)
        ? 'o título já é o novo, mas o texto é outro (editado depois?)'
        : `título atual não confere: "${t.titulo}"`;
      rel(it, 'pulado', motivo, onde);
      continue;
    }
    t.titulo = novoTitulo;
    t.texto = novoTexto;
    tocar('universidade_topicos', t.id, it.id);
    rel(it, 'aplicar', '', onde);
  }

  // Trocas gerais (G1, R1) sobre o resultado dos itens
  const gerais = [];   // { id, tabela, mod }
  const contar = (usadas, tabela, mod) => { for (const g of usadas) gerais.push({ id: g, tabela, mod }); };
  for (const t of topicos) {
    const mod = modDaAula.get(t.aula_id);
    const usadas = new Set();
    const alvo = { aula: aulas.find(a => a.id === t.aula_id)?.ordem, top: t.numero };
    const titulo = aplicarGerais(mod, 'topicos', t.titulo, usadas, alvo);
    const texto = aplicarGerais(mod, 'topicos', t.texto, usadas, alvo);
    if (titulo !== t.titulo || texto !== t.texto) {
      t.titulo = titulo; t.texto = texto;
      if (t.id) for (const g of usadas) tocar('universidade_topicos', t.id, g);
      contar(usadas, 'topicos', mod);
    }
  }
  for (const a of aulas) {
    const usadas = new Set();
    const titulo = aplicarGerais(a.mod, 'aulas', a.titulo, usadas);
    if (titulo !== a.titulo) { a.titulo = titulo; for (const g of usadas) tocar('universidade_aulas', a.id, g); contar(usadas, 'aulas', a.mod); }
  }
  for (const m of modulos) {
    const usadas = new Set();
    const titulo = aplicarGerais(m.numero, 'modulos', m.titulo, usadas);
    const descricao = m.descricao == null ? m.descricao : aplicarGerais(m.numero, 'modulos', m.descricao, usadas);
    if (titulo !== m.titulo || descricao !== m.descricao) {
      m.titulo = titulo; m.descricao = descricao;
      for (const g of usadas) tocar('universidade_modulos', m.id, g);
      contar(usadas, 'modulos', m.numero);
    }
  }
  for (const p of perguntas) {
    const usadas = new Set();
    const enunciado = aplicarGerais(p.mod, 'quiz', p.enunciado, usadas);
    const explicacao = p.explicacao == null ? p.explicacao : aplicarGerais(p.mod, 'quiz', p.explicacao, usadas);
    const alternativas = (p.alternativas || []).map(a => ({ ...a, texto: aplicarGerais(p.mod, 'quiz', a.texto, usadas) }));
    if (enunciado !== p.enunciado || explicacao !== p.explicacao || JSON.stringify(alternativas) !== JSON.stringify(p.alternativas)) {
      p.enunciado = enunciado; p.explicacao = explicacao; p.alternativas = alternativas;
      for (const g of usadas) tocar('universidade_quiz_perguntas', p.id, g);
      contar(usadas, 'quiz', p.mod);
    }
  }

  // Mudanças finais por registro (antes = original lido; depois = estado final)
  const atual = { universidade_topicos: topicos, universidade_aulas: aulas, universidade_modulos: modulos, universidade_quiz_perguntas: perguntas };
  const CAMPOS = {
    universidade_topicos: ['titulo', 'texto'], universidade_aulas: ['titulo'],
    universidade_modulos: ['titulo', 'descricao'], universidade_quiz_perguntas: ['enunciado', 'alternativas', 'correta', 'explicacao'],
  };
  const mudancas = [];
  for (const [k, itensDoRegistro] of tocados) {
    const [tabela, id] = k.split(':');
    const antes = original.get(k);
    const depois = atual[tabela].find(r => String(r.id) === id);
    const campos = Object.fromEntries(CAMPOS[tabela].map(c => [c, depois[c]]));
    const mudou = CAMPOS[tabela].some(c => JSON.stringify(antes[c]) !== JSON.stringify(depois[c]));
    if (mudou) mudancas.push({ tabela, id: Number(id), mod: depois.mod ?? depois.numero ?? null, antes, depois: campos, itens: [...itensDoRegistro].sort() });
  }
  mudancas.sort((a, b) => a.tabela.localeCompare(b.tabela) || a.id - b.id);
  return { mudancas, novos, relatorio, gerais };
}

// ─── Executar (grava) ───────────────────────────────────────────────────────

async function executar(cx, plano, { lote = LOTE, quem = 'script aplicarTextosUniversidade' } = {}) {
  const marca = `Ajuste de textos ${lote} (script)`;
  const backup = (tabela, id, dados) => cx.query(
    `INSERT INTO universidade_textos_backup (lote, tabela, registro_id, dados) VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (lote, tabela, registro_id) DO NOTHING`, [lote, tabela, id, JSON.stringify(dados)]);
  const registrar = (tabela, id, detalhes) => cx.query(
    `INSERT INTO admin_acoes (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhes)
     VALUES (NULL, $1, 'universidade_texto_lote', $2, $3, $4::jsonb)`, [quem, tabela, id, JSON.stringify({ lote, ...detalhes })]);
  const conferir = (r, m) => {
    if (!r.rowCount && !(r.rows && r.rows.length)) {
      throw new Error(`${m.tabela} #${m.id} mudou depois da leitura; nada foi gravado. Rode a prévia de novo.`);
    }
  };

  for (const m of plano.mudancas) {
    await backup(m.tabela, m.id, m.antes);
    const a = m.antes;
    const d = m.depois;
    let r;
    if (m.tabela === 'universidade_topicos') {
      r = await cx.query(
        `UPDATE universidade_topicos SET titulo = $2, texto = $3, atualizado_em = NOW(), editado_manual_em = NOW(), editado_manual_por = $4
         WHERE id = $1 AND titulo = $5 AND texto = $6 RETURNING id`, [m.id, d.titulo, d.texto, marca, a.titulo, a.texto]);
    } else if (m.tabela === 'universidade_aulas') {
      r = await cx.query(`UPDATE universidade_aulas SET titulo = $2, atualizado_em = NOW() WHERE id = $1 AND titulo = $3 RETURNING id`,
        [m.id, d.titulo, a.titulo]);
    } else if (m.tabela === 'universidade_modulos') {
      r = await cx.query(
        `UPDATE universidade_modulos SET titulo = $2, descricao = $3, atualizado_em = NOW()
         WHERE id = $1 AND titulo = $4 AND descricao IS NOT DISTINCT FROM $5 RETURNING id`, [m.id, d.titulo, d.descricao, a.titulo, a.descricao]);
    } else {
      r = await cx.query(
        `UPDATE universidade_quiz_perguntas SET enunciado = $2, alternativas = $3::jsonb, explicacao = $4, correta = $8
         WHERE id = $1 AND enunciado = $5 AND alternativas = $6::jsonb AND explicacao IS NOT DISTINCT FROM $7 AND correta = $9 RETURNING id`,
        [m.id, d.enunciado, JSON.stringify(d.alternativas), d.explicacao, a.enunciado, JSON.stringify(a.alternativas), a.explicacao, d.correta, a.correta]);
    }
    conferir(r, m);
    await registrar(m.tabela, m.id, { itens: m.itens });
  }
  for (const n of plano.novos) {
    const r = await cx.query(
      `INSERT INTO universidade_topicos (aula_id, numero, titulo, texto, ordem, editado_manual_em, editado_manual_por)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING id`, [n.aula_id, n.numero, n.titulo, n.texto, n.ordem, marca]);
    const id = r.rows[0].id;
    await backup('universidade_topicos', id, { criado_pelo_lote: true, item: n.item });
    await registrar('universidade_topicos', id, { itens: [n.item], criado: true });
  }
  return { alterados: plano.mudancas.length, criados: plano.novos.length };
}

// Volta o que o lote mudou: restaura o original guardado e apaga os tópicos criados
async function desfazer(cx, { lote = LOTE, quem = 'script aplicarTextosUniversidade' } = {}) {
  const b = (await cx.query(`SELECT tabela, registro_id, dados FROM universidade_textos_backup WHERE lote = $1 ORDER BY id`, [lote])).rows;
  let restaurados = 0;
  let apagados = 0;
  for (const x of b) {
    const d = x.dados;
    if (d.criado_pelo_lote) {
      const r = await cx.query(`DELETE FROM universidade_topicos WHERE id = $1 RETURNING id`, [x.registro_id]);
      apagados += r.rows.length;
    } else if (x.tabela === 'universidade_topicos') {
      await cx.query(`UPDATE universidade_topicos SET titulo = $2, texto = $3, editado_manual_em = $4, editado_manual_por = $5, atualizado_em = NOW() WHERE id = $1`,
        [x.registro_id, d.titulo, d.texto, d.editado_manual_em, d.editado_manual_por]);
      restaurados++;
    } else if (x.tabela === 'universidade_aulas') {
      await cx.query(`UPDATE universidade_aulas SET titulo = $2, atualizado_em = NOW() WHERE id = $1`, [x.registro_id, d.titulo]);
      restaurados++;
    } else if (x.tabela === 'universidade_modulos') {
      await cx.query(`UPDATE universidade_modulos SET titulo = $2, descricao = $3, atualizado_em = NOW() WHERE id = $1`, [x.registro_id, d.titulo, d.descricao]);
      restaurados++;
    } else {
      await cx.query(`UPDATE universidade_quiz_perguntas SET enunciado = $2, alternativas = $3::jsonb, explicacao = $4, correta = $5 WHERE id = $1`,
        [x.registro_id, d.enunciado, JSON.stringify(d.alternativas), d.explicacao, d.correta]);
      restaurados++;
    }
    await cx.query(
      `INSERT INTO admin_acoes (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhes)
       VALUES (NULL, $1, 'universidade_texto_desfeito', $2, $3, $4::jsonb)`, [quem, x.tabela, x.registro_id, JSON.stringify({ lote })]);
  }
  return { restaurados, apagados };
}

// ─── Relatórios (sem dado de Partner) ───────────────────────────────────────

const ROTULO = { aplicar: 'APLICARIA', ja_aplicado: 'já aplicado', pulado: 'PULADO', adiado: 'adiado' };

function textoDoRelatorio(plano, titulo) {
  const linhas = [`# ${titulo}`, `# lote ${LOTE}`, ''];
  const cont = plano.relatorio.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});
  linhas.push(`Itens: ${plano.relatorio.length} | aplicaria ${cont.aplicar || 0} | já aplicados ${cont.ja_aplicado || 0} | pulados ${cont.pulado || 0} | adiados ${cont.adiado || 0}`);
  linhas.push(`Registros que mudariam: ${plano.mudancas.length} | tópicos novos: ${plano.novos.length}`, '');
  for (const r of plano.relatorio) linhas.push(`${r.id}\t${ROTULO[r.status]}\t${r.alvo}\t${r.motivo}`);
  linhas.push('', '## Trocas gerais (registros, por troca, tabela e módulo)');
  const g = new Map();
  for (const x of plano.gerais) { const k = `${x.id}\t${x.tabela}\tM${x.mod}`; g.set(k, (g.get(k) || 0) + 1); }
  for (const [k, n] of [...g].sort()) linhas.push(`${k}\t${n}`);
  if (!g.size) linhas.push('(nenhuma)');
  return `${linhas.join('\n')}\n`;
}

function quizLegivel(x) {
  const ops = (x.alternativas || []).map(a => `  ${a.id === x.correta ? '(CERTA) ' : '        '}${a.texto}`).join('\n');
  return `Enunciado: ${x.enunciado}\n${ops}\nExplicação: ${x.explicacao ?? '—'}`;
}

function textoAntesDepois(plano) {
  const blocos = plano.mudancas.map(m => {
    if (m.tabela === 'universidade_quiz_perguntas') {
      return `=== quiz M${m.mod ?? ''} pergunta ${m.antes.numero} (#${m.id}) — ${m.itens.join(', ')}\nANTES:\n${quizLegivel(m.antes)}\nDEPOIS:\n${quizLegivel(m.depois)}\n`;
    }
    const campos = Object.keys(m.depois);
    const partes = campos.map(c => {
      const antes = typeof m.antes[c] === 'object' ? JSON.stringify(m.antes[c], null, 1) : m.antes[c];
      const depois = typeof m.depois[c] === 'object' ? JSON.stringify(m.depois[c], null, 1) : m.depois[c];
      return antes === depois ? `[${c}] (igual)` : `[${c}] ANTES:\n${antes}\n[${c}] DEPOIS:\n${depois}`;
    });
    return `=== ${m.tabela} #${m.id} — ${m.itens.join(', ')}\n${partes.join('\n')}\n`;
  });
  const novos = plano.novos.map(n => `=== NOVO tópico ${n.numero} na aula #${n.aula_id} — ${n.item}\n${n.titulo}\n${n.texto}\n`);
  return `${blocos.join('\n')}\n${novos.join('\n')}`;
}

// ─── Linha de comando ───────────────────────────────────────────────────────

async function copiarParaMemoria(conteudo) {
  const { novoBanco } = require('../tests/helpers/bancoTeste');
  const db = await novoBanco();
  for (const m of conteudo.modulos) {
    await db.query(
      `INSERT INTO universidade_modulos (id, numero, titulo, descricao, icone, ordem, publicado, publicado_em, conteudo_pendente,
         exige_recertificacao, versao_conteudo, recertificar_desde, atualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [m.id, m.numero, m.titulo, m.descricao, m.icone, m.ordem, m.publicado, m.publicado_em, m.conteudo_pendente,
        m.exige_recertificacao, m.versao_conteudo, m.recertificar_desde, m.atualizado_em]);
  }
  for (const a of conteudo.aulas) {
    await db.query(`INSERT INTO universidade_aulas (id, modulo_id, ordem, titulo, video_url, publicado, atualizado_em) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.id, a.modulo_id, a.ordem, a.titulo, a.video_url, a.publicado, a.atualizado_em]);
  }
  for (const t of conteudo.topicos) {
    await db.query(
      `INSERT INTO universidade_topicos (id, aula_id, numero, titulo, texto, ordem, atualizado_em, editado_manual_em, editado_manual_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [t.id, t.aula_id, t.numero, t.titulo, t.texto, t.ordem, t.atualizado_em, t.editado_manual_em, t.editado_manual_por]);
  }
  for (const p of conteudo.perguntas) {
    await db.query(
      `INSERT INTO universidade_quiz_perguntas (id, modulo_id, numero, enunciado, alternativas, correta, explicacao, ativa)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
      [p.id, p.modulo_id, p.numero, p.enunciado, JSON.stringify(p.alternativas), p.correta, p.explicacao, p.ativa]);
  }
  for (const t of ['universidade_modulos', 'universidade_aulas', 'universidade_topicos', 'universidade_quiz_perguntas']) {
    await db.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1))`);
  }
  return db;
}

const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  const args = new Set(process.argv.slice(2));
  const modo = args.has('--aplicar') ? 'aplicar' : args.has('--desfazer') ? 'desfazer' : args.has('--simular') ? 'simular' : 'previa';
  const { perguntarSemEco } = require('./consultasUniversidadeLeitura');
  const url = process.env.DATABASE_URL_UNIVERSIDADE || await perguntarSemEco('Cole a URL do banco (não aparece na tela) e tecle Enter: ');
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('Isso não parece uma URL de banco Postgres.');
  const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
  if ((modo === 'aplicar' || modo === 'desfazer') && !local && !args.has('--confirmar-producao')) {
    throw new Error(`Para ${modo} num banco que não é local, acrescente --confirmar-producao (só com autorização).`);
  }
  const esconder = msg => String(msg || '').split(url).join('[URL]');
  const somenteLeitura = modo === 'previa' || modo === 'simular';

  const { Client } = require('pg');
  const cliente = new Client({
    connectionString: url,
    ssl: url.includes('render.com') ? { rejectUnauthorized: false } : false,
    ...(somenteLeitura ? { options: '-c default_transaction_read_only=on' } : {}),
    application_name: `textos-universidade-${modo}`,
  });
  const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const pasta = path.join(__dirname, '../../relatorios-leitura', `textos-${modo}-${dia}`);
  fs.mkdirSync(pasta, { recursive: true });
  const rel = p => path.relative(path.join(__dirname, '../..'), p);

  try {
    await cliente.connect();
    if (modo === 'previa' || modo === 'simular') {
      await cliente.query('BEGIN READ ONLY');
      const conteudo = await carregarConteudo(cliente);
      await cliente.query('ROLLBACK');
      const plano = planejar(conteudo);
      fs.writeFileSync(path.join(pasta, 'relatorio.txt'), textoDoRelatorio(plano, `Prévia (somente leitura) — ${dia}`), 'utf8');
      fs.writeFileSync(path.join(pasta, 'antes-depois.txt'), textoAntesDepois(plano), 'utf8');
      if (modo === 'simular') {
        const db = await copiarParaMemoria(conteudo);
        const r1 = await db.transacao(cx => executar(cx, plano, { quem: 'simulação local' }));
        const plano2 = planejar(await carregarConteudo(db));
        const vers = (await db.query('SELECT numero, versao_conteudo FROM universidade_modulos ORDER BY numero')).rows;
        const versOk = iguais(vers, conteudo.modulos.map(m => ({ numero: m.numero, versao_conteudo: m.versao_conteudo })).sort((a, b) => a.numero - b.numero));
        const d = await db.transacao(cx => desfazer(cx, { quem: 'simulação local' }));
        const depoisDesfazer = await carregarConteudo(db);
        const campos = ['id', 'titulo', 'texto'];
        const volta = iguais(depoisDesfazer.topicos.map(t => campos.map(c => t[c])), conteudo.topicos.map(t => campos.map(c => t[c])))
          && iguais(depoisDesfazer.aulas.map(a => [a.id, a.titulo]), conteudo.aulas.map(a => [a.id, a.titulo]))
          && iguais(depoisDesfazer.perguntas.map(p => [p.id, p.enunciado, p.alternativas, p.explicacao]), conteudo.perguntas.map(p => [p.id, p.enunciado, p.alternativas, p.explicacao]))
          && iguais(depoisDesfazer.modulos.map(m => [m.id, m.titulo, m.descricao]), conteudo.modulos.map(m => [m.id, m.titulo, m.descricao]));
        const resumo = [
          `Simulação num banco em memória NESTA máquina (o banco lido não foi alterado) — ${dia}`,
          `1ª aplicação: ${r1.alterados} registro(s) alterado(s), ${r1.criados} tópico(s) criado(s)`,
          `2ª rodada (prévia sobre o resultado): ${plano2.mudancas.length} mudança(s), ${plano2.novos.length} tópico(s) novo(s) — tem de ser 0 e 0`,
          `versao_conteudo dos módulos sem mudança: ${versOk ? 'sim' : 'NÃO'}`,
          `desfazer: ${d.restaurados} restaurado(s), ${d.apagados} apagado(s); conteúdo voltou ao original: ${volta ? 'sim' : 'NÃO'}`,
        ].join('\n');
        fs.writeFileSync(path.join(pasta, 'simulacao.txt'), `${resumo}\n`, 'utf8');
        await db.fechar();
        console.log(resumo);
      }
      const cont = plano.relatorio.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});
      console.log(`Prévia: aplicaria ${cont.aplicar || 0}, já aplicados ${cont.ja_aplicado || 0}, pulados ${cont.pulado || 0}, adiados ${cont.adiado || 0}; ${plano.mudancas.length} registro(s) mudariam e ${plano.novos.length} tópico(s) novo(s).`);
      console.log(`Relatórios em ${rel(pasta)} (relatorio.txt e antes-depois.txt).`);
      return;
    }
    await cliente.query('BEGIN');
    try {
      if (modo === 'aplicar') {
        const plano = planejar(await carregarConteudo(cliente));
        const r = await executar(cliente, plano, { quem: 'Junior (script aplicarTextosUniversidade)' });
        fs.writeFileSync(path.join(pasta, 'relatorio.txt'), textoDoRelatorio(plano, `Aplicado — ${dia}`), 'utf8');
        await cliente.query('COMMIT');
        console.log(`Aplicado: ${r.alterados} registro(s) alterado(s), ${r.criados} tópico(s) criado(s). Relatório em ${rel(pasta)}.`);
      } else {
        const r = await desfazer(cliente, { quem: 'Junior (script aplicarTextosUniversidade)' });
        await cliente.query('COMMIT');
        console.log(`Desfeito: ${r.restaurados} restaurado(s), ${r.apagados} tópico(s) criado(s) apagado(s).`);
      }
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw err;
    }
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

module.exports = { carregarConteudo, planejar, executar, desfazer, trocar, textoDoRelatorio, textoAntesDepoisPublico: textoAntesDepois, copiarParaMemoria };
