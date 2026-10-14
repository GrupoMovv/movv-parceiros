// Migrations do livro de comissões rodando DUAS vezes (Junior, 14/10/2026).
// O run.js hoje só roda migration nova (schema_migrations), mas a 093 tem de
// aguentar uma segunda rodada sem erro e sem duplicar nada — principalmente
// as regras iniciais (Azul 30% e Certificado 20%).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { novoBanco, DIR_MIGRATIONS } = require('./helpers/bancoTeste');

const TODAS = fs.readdirSync(DIR_MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
let db;

const regras = async () => (await db.query(
  `SELECT origem, nivel_partner, percentual, vigente_desde FROM partner_comissao_regras ORDER BY origem, nivel_partner, vigente_desde`
)).rows;
const contagens = async () => (await db.query(`
  SELECT (SELECT count(*) FROM partner_comissao_regras)::int AS regras,
         (SELECT count(*) FROM partner_comissoes)::int AS lancamentos,
         (SELECT count(*) FROM partner_comissao_avisos)::int AS avisos,
         (SELECT count(*) FROM comissao_importacoes)::int AS importacoes,
         (SELECT count(*) FROM comissao_importacao_linhas)::int AS linhas`)).rows[0];
const rodarDeNovo = async () => {
  for (const f of TODAS) await db.exec(fs.readFileSync(path.join(DIR_MIGRATIONS, f), 'utf8'));
};

before(async () => { db = await novoBanco(); });
after(async () => { await db.fechar(); });

test('todas as migrations (001 em diante) rodam uma 2ª e uma 3ª vez sem erro e sem duplicar', async () => {
  assert.ok(TODAS.includes('093_livro_comissoes_partner.sql'));
  const antes = await regras();
  assert.equal(antes.length, 8, '4 níveis × (Azul 30% + Certificado 20%)');
  const contAntes = await contagens();

  await rodarDeNovo();
  await rodarDeNovo();

  assert.deepEqual(await regras(), antes);
  assert.deepEqual(await contagens(), contAntes);
});

test('segunda rodada não recria a regra inicial que o admin encerrou ou trocou', async () => {
  // admin encerra os 30% da Azul do Mobile e cria 35% a partir de novembro
  await db.query(`UPDATE partner_comissao_regras SET vigente_ate = '2026-10-31' WHERE origem = 'azul' AND nivel_partner = 'mobile'`);
  await db.query(`INSERT INTO partner_comissao_regras (origem, nivel_partner, base, percentual, vigente_desde, criado_por)
                  VALUES ('azul', 'mobile', 'comissao_recebida', 35, '2026-11-01', 'admin')`);
  // e muda a data de início dos 20% do Certificado do Hub
  await db.query(`UPDATE partner_comissao_regras SET vigente_desde = '2026-10-20' WHERE origem = 'certificado' AND nivel_partner = 'hub'`);
  const antes = await regras();

  await rodarDeNovo();

  assert.deepEqual(await regras(), antes, 'a migration não pode recolocar 30%/20% por cima do que o admin decidiu');
});
