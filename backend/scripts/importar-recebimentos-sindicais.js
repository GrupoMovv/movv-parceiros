/**
 * importar-recebimentos-sindicais.js — Importa o "Relatório de
 * Recebimentos" bruto do financeiro (linha por pagamento) pra base de
 * empresas contribuintes que controla o autocadastro público de associados.
 *
 * Regra: empresa é considerada SINDICALIZADA/ATIVA se pagou em pelo menos 1
 * dos 3 meses mais representados no arquivo (o financeiro reexporta os
 * últimos ~3 meses a cada atualização — ver contribuintesRecebimentosParser.js
 * pra como isso é descoberto automaticamente, sem hardcodar mês/ano).
 *
 * Empresa que já estava cadastrada mas não aparece nesse arquivo (não pagou
 * nenhum dos 3 meses) é marcada inativa — nunca apagada.
 *
 * USO:
 *   node scripts/importar-recebimentos-sindicais.js /caminho/arquivo.xlsx
 *
 * TODO: rotina mensal automática — lembrar o Junior de atualizar a
 * planilha todo mês (a validação de /cadastrar-associado depende disso
 * estar em dia).
 * TODO: notificação automática quando a última importação (ultima_atualizacao
 * mais recente na tabela) tiver mais de 30 dias — sinal de que a rotina
 * mensal não rodou.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const { parseRecebimentosBuffer } = require('../src/services/contribuintesRecebimentosParser');
const { importarLista, desativarAusentes } = require('../src/services/contribuintesImportService');

async function run() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error('Uso: node scripts/importar-recebimentos-sindicais.js /caminho/arquivo.xlsx');
    process.exit(1);
  }

  const caminhoAbsoluto = path.isAbsolute(caminho) ? caminho : path.join(process.cwd(), caminho);
  if (!fs.existsSync(caminhoAbsoluto)) {
    console.error(`Arquivo não encontrado: ${caminhoAbsoluto}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(caminhoAbsoluto);
  const { empresas, tresMesesRecentes, linhasIgnoradasCpf } = parseRecebimentosBuffer(buffer);

  if (empresas.length === 0) {
    console.error('Nenhuma empresa com CNPJ válido encontrada na planilha.');
    process.exit(1);
  }

  console.log(`Meses considerados "recentes" (detectados pelo próprio arquivo): ${tresMesesRecentes.join(', ')}`);
  console.log(`Empresas únicas (CNPJ) encontradas: ${empresas.length}`);
  if (linhasIgnoradasCpf > 0) console.log(`Linhas de CPF (pessoa física) ignoradas: ${linhasIgnoradasCpf}`);

  const resumo = await importarLista(empresas);
  const cnpjsPresentes = empresas.map(e => e.cnpj);
  const desativadas = await desativarAusentes(cnpjsPresentes);

  const totalAtivasResult = await db.query(`SELECT COUNT(*)::int AS total FROM sindicato_empresas_contribuintes WHERE status = 'adimplente'`);

  const importadoPorId = null; // rodado via CLI, não por um usuário admin logado
  await db.query(
    `INSERT INTO sindicato_contribuintes_importacoes
       (importado_por_id, novas, atualizadas, status_mudou, total_linhas, desativadas)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [importadoPorId, resumo.novas, resumo.atualizadas, resumo.status_mudou, resumo.total_linhas, desativadas]
  );

  console.log('\n=== RESUMO ===');
  console.log(`Empresas processadas: ${resumo.total_linhas}`);
  console.log(`Novas empresas cadastradas: ${resumo.novas}`);
  console.log(`Empresas atualizadas: ${resumo.atualizadas}`);
  console.log(`Empresas desativadas (sem pagamento 3m): ${desativadas}`);
  console.log(`Total ATIVAS agora: ${totalAtivasResult.rows[0].total}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Erro na importação:', err.message);
  process.exit(1);
});
