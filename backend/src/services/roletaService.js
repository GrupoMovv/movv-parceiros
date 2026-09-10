const { customAlphabet } = require('nanoid');
const db = require('../config/database');

// Alfabeto alfanumérico puro (sem -/_ do nanoid padrão, sem 0/O/1/I pra não
// confundir na hora de digitar/ler o código na loja).
const gerarSufixo = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

// Servidor roda em UTC (Render) — "hoje" pro gate de 1 giro/dia sempre no
// horário de Brasília, mesma convenção de config/fechaMes.js.
const TIMEZONE = 'America/Sao_Paulo';

// Peso de sorteio atribuído a um parceiro quando ele ativa a roleta,
// derivado do plano no momento da ativação (ver parceiroJogosController).
// Grátis não pode ativar (bloqueado antes de chegar aqui). Master também
// deveria ter garantia de aparecer ~1x/dia — não implementado nesta fase
// (Fase 1/MVP), só o peso maior; ver TODO em sortearParceiro.
const PESO_POR_PLANO = { gratis: 0, oficial: 1, premium: 3, master: 5 };

// Probabilidades sugeridas pelo produto (somam 100) — ajustar aqui se
// mudar de ideia, é a única fonte de verdade do sorteio de prêmio.
// 100 = prêmio "DIAMANTE" (produto grátis), não é desconto real cobrado
// do parceiro.
const PREMIOS = [
  { desconto_percentual: 5, peso: 30 },
  { desconto_percentual: 10, peso: 25 },
  { desconto_percentual: 15, peso: 20 },
  { desconto_percentual: 20, peso: 12 },
  { desconto_percentual: 25, peso: 7 },
  { desconto_percentual: 30, peso: 4 },
  { desconto_percentual: 50, peso: 1.5 },
  { desconto_percentual: 100, peso: 0.5 },
];

function sortearPonderado(itens, pesoFn) {
  const pesoTotal = itens.reduce((soma, item) => soma + pesoFn(item), 0);
  if (pesoTotal <= 0) return null;
  let alvo = Math.random() * pesoTotal;
  for (const item of itens) {
    alvo -= pesoFn(item);
    if (alvo <= 0) return item;
  }
  return itens[itens.length - 1];
}

function sortearPremio() {
  return sortearPonderado(PREMIOS, p => p.peso).desconto_percentual;
}

// TODO(fase futura): Master "garantido aparecer 1x por dia" — hoje é só
// peso maior (5x), não uma garantia de verdade. Implementar exigiria
// rastrear se algum parceiro Master já saiu sorteado hoje (entre todos os
// associados) e, se não, forçar a próxima rodada — decisão de produto
// melhor tomada com dado real de quantos parceiros Master existem.
function sortearParceiro(parceirosElegiveis) {
  return sortearPonderado(parceirosElegiveis, p => p.peso_sorteio);
}

async function buscarParceirosElegiveis(jogoTipo) {
  const result = await db.query(
    `SELECT jp.parceiro_id, jp.desconto_percentual, jp.validade_dias, jp.peso_sorteio,
            p.nome, p.logo_url, p.slug
     FROM sindicato_jogos_parceiros jp
     JOIN sindicato_parceiros p ON p.id = jp.parceiro_id
     WHERE jp.jogo_tipo = $1 AND jp.ativo = true AND jp.peso_sorteio > 0
       AND p.status = 'ativo'`,
    [jogoTipo]
  );
  return result.rows;
}

async function jaJogouHoje(associadoId, jogoTipo = 'roleta') {
  const result = await db.query(
    `SELECT 1 FROM sindicato_cupons_roleta
     WHERE associado_id = $1 AND jogo_tipo = $2
       AND (jogado_em AT TIME ZONE $3)::date = (NOW() AT TIME ZONE $3)::date
     LIMIT 1`,
    [associadoId, jogoTipo, TIMEZONE]
  );
  return !!result.rows[0];
}

async function gerarCodigoCupomUnico() {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = `IUB${gerarSufixo()}`;
    const existe = await db.query('SELECT 1 FROM sindicato_cupons_roleta WHERE codigo_cupom = $1', [codigo]);
    if (!existe.rows[0]) return codigo;
  }
  throw new Error('Não foi possível gerar um código de cupom único');
}

// Mantém dias_seguidos: joga de novo no dia seguinte ao último giro =
// soma 1; qualquer intervalo maior (perdeu um dia) reseta pra 1.
// tentativas_bonus não é usado ainda (reservado pra fase de streak-bonus).
async function atualizarStreak(associadoId) {
  const atual = await db.query('SELECT * FROM sindicato_jogos_streak WHERE associado_id = $1', [associadoId]);
  const registro = atual.rows[0];

  if (!registro) {
    await db.query(
      'INSERT INTO sindicato_jogos_streak (associado_id, dias_seguidos, ultimo_jogo) VALUES ($1, 1, NOW())',
      [associadoId]
    );
    return 1;
  }

  const foiOntem = await db.query(
    `SELECT (($1::timestamptz AT TIME ZONE $2)::date + 1) = (NOW() AT TIME ZONE $2)::date AS foi_ontem`,
    [registro.ultimo_jogo, TIMEZONE]
  );
  const novosDias = foiOntem.rows[0].foi_ontem ? registro.dias_seguidos + 1 : 1;

  await db.query(
    'UPDATE sindicato_jogos_streak SET dias_seguidos = $1, ultimo_jogo = NOW() WHERE associado_id = $2',
    [novosDias, associadoId]
  );
  return novosDias;
}

// Orquestra um giro completo: valida 1x/dia, sorteia parceiro + prêmio,
// grava o cupom e atualiza streak. Lança Error com .status pra controller
// traduzir em resposta HTTP.
async function girarRoleta(associadoId, jogoTipo = 'roleta') {
  if (await jaJogouHoje(associadoId, jogoTipo)) {
    const err = new Error('Você já jogou hoje! Volte amanhã pra girar de novo.');
    err.status = 409;
    throw err;
  }

  const parceiros = await buscarParceirosElegiveis(jogoTipo);
  if (parceiros.length === 0) {
    const err = new Error('Nenhum parceiro disponível na roleta no momento. Volte mais tarde!');
    err.status = 503;
    throw err;
  }

  const parceiroSorteado = sortearParceiro(parceiros);
  const descontoSorteado = sortearPremio();
  // O parceiro escolhe (na tela de configuração) até quanto de desconto
  // topa dar — o setor da roleta é só o "quão generoso" o sorteio tenta
  // ser; nunca obriga o parceiro a dar mais do que ele configurou (ex.:
  // roleta caiu em DIAMANTE/100% mas o parceiro só autorizou até 50% ->
  // cupom sai de 50%, não de 100%). `capeado` avisa o front pra mostrar
  // "seu parceiro está dando o desconto máximo dele!" em vez do prêmio
  // literal, quando isso acontecer.
  const descontoFinal = Math.min(descontoSorteado, parceiroSorteado.desconto_percentual);
  const codigoCupom = await gerarCodigoCupomUnico();

  const insertResult = await db.query(
    `INSERT INTO sindicato_cupons_roleta
       (associado_id, parceiro_id, codigo_cupom, desconto_percentual, jogo_tipo, valido_ate)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' days')::interval)
     RETURNING *`,
    [associadoId, parceiroSorteado.parceiro_id, codigoCupom, descontoFinal, jogoTipo, parceiroSorteado.validade_dias]
  );

  const diasSeguidos = await atualizarStreak(associadoId);

  return {
    cupom: insertResult.rows[0],
    parceiro: { id: parceiroSorteado.parceiro_id, nome: parceiroSorteado.nome, logo_url: parceiroSorteado.logo_url, slug: parceiroSorteado.slug },
    dias_seguidos: diasSeguidos,
    premio_sorteado_percentual: descontoSorteado,
    capeado: descontoFinal < descontoSorteado,
  };
}

module.exports = {
  PESO_POR_PLANO,
  PREMIOS,
  TIMEZONE,
  sortearPremio,
  sortearParceiro,
  buscarParceirosElegiveis,
  jaJogouHoje,
  gerarCodigoCupomUnico,
  atualizarStreak,
  girarRoleta,
};
