const db = require('../config/database');

// Regra oficial (Fase 1): Grátis NÃO entra na rotativa — só planos pagos
// disputam a vitrine. Números batem com o que é vendido em
// /parceiro/painel/planos ("X produtos em destaque").
//
// Exceção temporária: como ninguém pagou plano ainda (fase 100% grátis),
// PARCEIROS_SEED lista quem aparece como demonstração da vitrine mesmo
// estando no Grátis — tratados como se fossem `seed` (mesmo limite do
// Premium). Quando os planos pagos forem ativados de verdade, é só
// esvaziar essa lista.
const LIMITES = { gratis: 0, oficial: 3, premium: 8, master: 15, seed: 8 };
const PARCEIROS_SEED = ['nossa-drogaria', 'azul-emprestimo'];

const LIMITE_TOTAL = 50;

function limiteDoParceiro(row) {
  if (PARCEIROS_SEED.includes(row.parceiro_slug)) return LIMITES.seed;
  return LIMITES[row.plano] ?? LIMITES.gratis;
}

// Regenera tudo a cada 4h (produtos elegíveis + nova ordem de round-robin);
// entre uma regeneração e outra, qualquer request só serve o array já
// pronto — não recalcula por request (é a parte que faria "cache de
// 15min" ter efeito prático, já que ninguém bate 2x no banco dentro da
// mesma janela de qualquer forma).
const REGERAR_A_CADA_MS = 4 * 60 * 60 * 1000;

let cache = { geradoEm: 0, produtos: [] };

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Round-robin: 1 produto de cada parceiro por rodada (ordem embaralhada a
// cada rodada), até esgotar quem ainda tem produto sobrando ou bater o
// limite total. Garante que o mesmo parceiro nunca aparece 2x seguidas —
// inclusive nas rodadas finais, quando só sobra um parceiro "grande"
// (ex.: Master com muito mais produtos que todo o resto somado): nesse
// caso a fila para ali mesmo em vez de emendar vários produtos seguidos
// dele, mesmo que isso signifique não chegar nos 50 produtos do limite.
function montarRoundRobin(porParceiro) {
  const parceiroIds = [...porParceiro.keys()];
  const resultado = [];
  let ultimoParceiroId = null;
  let rodada = 0;

  while (resultado.length < LIMITE_TOTAL) {
    const ordemRodada = embaralhar(parceiroIds).filter(pid => porParceiro.get(pid)[rodada]);
    if (ordemRodada.length === 0) break;

    if (ordemRodada.length === 1) {
      // só sobrou quem acabou de "tocar" — continuar geraria adjacência
      // repetida, então a fila termina aqui.
      if (ordemRodada[0] === ultimoParceiroId) break;
    } else if (ordemRodada[0] === ultimoParceiroId) {
      [ordemRodada[0], ordemRodada[1]] = [ordemRodada[1], ordemRodada[0]];
    }

    for (const pid of ordemRodada) {
      resultado.push(porParceiro.get(pid)[rodada]);
      ultimoParceiroId = pid;
      if (resultado.length >= LIMITE_TOTAL) break;
    }
    rodada++;
  }

  return resultado;
}

async function gerarRotacao() {
  const result = await db.query(
    `SELECT pr.id, pr.nome, pr.preco, pr.preco_associado, pr.fotos, pr.destaque, pr.created_at,
            pa.id AS parceiro_id, pa.nome AS parceiro_nome, pa.slug AS parceiro_slug, pa.plano
     FROM sindicato_parceiro_produtos pr
     JOIN sindicato_parceiros pa ON pa.id = pr.parceiro_id
     WHERE pr.ativo = true AND pr.rascunho = false AND pa.status = 'ativo'
       AND pr.estoque_disponivel = true
       AND pr.preco IS NOT NULL
       AND pr.fotos IS NOT NULL AND jsonb_array_length(pr.fotos) > 0
     ORDER BY pa.id, pr.destaque DESC, pr.created_at DESC`
  );

  const porParceiro = new Map();
  for (const row of result.rows) {
    const limite = limiteDoParceiro(row);
    const lista = porParceiro.get(row.parceiro_id) || [];
    if (lista.length < limite) {
      lista.push(row);
      porParceiro.set(row.parceiro_id, lista);
    }
  }

  return montarRoundRobin(porParceiro).map(r => ({
    id: r.id,
    nome: r.nome,
    preco: r.preco,
    preco_associado: r.preco_associado,
    fotos: r.fotos,
    created_at: r.created_at,
    parceiro_id: r.parceiro_id,
    parceiro_nome: r.parceiro_nome,
    parceiro_slug: r.parceiro_slug,
  }));
}

// TODO (Bloco de admin futuro, não implementado ainda):
//  - velocidade de rotação configurável (hoje fixa em 5s no front)
//  - número de produtos simultâneos configurável (hoje 5/3/2 fixo)
//  - priorização de categoria específica dentro do round-robin
//  - blacklist de produtos que nunca devem entrar na vitrine
async function obterVitrineRotativa() {
  const expirado = Date.now() - cache.geradoEm > REGERAR_A_CADA_MS;
  if (expirado || cache.produtos.length === 0) {
    cache = { geradoEm: Date.now(), produtos: await gerarRotacao() };
  }
  return cache;
}

module.exports = { obterVitrineRotativa };
