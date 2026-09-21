// Fonte única de verdade dos limites/benefícios de cada plano do IUB MAIS.
// Todo endpoint/tela que depende de plano lê DESTE arquivo em vez de
// reinventar o número em outro lugar — mudar um limite é só editar aqui.
//
// Fase 2 (planos pagos) LIGADA: o parceiro assina sozinho pelo Mercado Pago
// (PIX mensal ou cartão recorrente — ver config/mercadopago.js e
// sindicato_assinaturas, migration 052), e o admin ainda pode trocar plano
// à mão (sindicatoPlanosController). Quem vale é sindicato_parceiros.plano,
// lido por planoEfetivo():
//   - cortesia_interna (migration 053) -> o plano gravado vale sempre,
//     nunca vence e nunca é cobrado
//   - plano 'gratis' -> nada a cobrar
//   - plano pago com plano_expira_em (fim do período pago da assinatura)
//     no passado -> vale como Grátis NA HORA, mesmo antes da rotina diária
//     gravar o downgrade no banco
//   - plano pago sem plano_expira_em (troca manual sem prazo) -> vale
//
// `max_produtos_rotativa`, `boost_busca` etc. já são consumidos por código
// de verdade (vitrineRotativaService, marketplaceHomeController,
// parceiroProdutosController). Os campos "trabalho manual" (push_notification,
// instagram_integrado, live_mensal, prioridade_melhorias...) são só o
// contrato do que aquele plano promete — não disparam nada sozinhos.
//
// Preço diferenciado por sindicalização: empresa com CNPJ em dia em
// sindicato_empresas_contribuintes (status 'adimplente', ver
// sindicalizacaoService) paga `preco_sindicalizada` — o SECI subsidia a
// diferença pra incentivar a sindicalização. Quem não está em dia (ou nem
// consta) paga `preco_nao_sindicalizada`. Ver publicPlanosController pro
// endpoint que expõe essa conta pro front.
const PLANOS = {
  gratis: {
    nome: 'IUB Grátis',
    preco_sindicalizada: 0,
    preco_nao_sindicalizada: 0,
    max_produtos: 30,
    max_produtos_rotativa: 0, // não aparece na rotativa
    // Fecha Mês: Grátis agora participa, mas só com os produtos bônus
    // (exclusivos daquela edição) — zero vaga de catálogo normal.
    participa_fecha_mes: true,
    max_produtos_bonus_fecha_mes: 3,
    tem_selo: false,
    selo_nome: 'Parceiro IUB',
    selo_cor: 'cinza',
    analytics_avancado: false,
    aparece_destaques_parceiros: false,
    push_notification: false,
    instagram_integrado: false,
    banner_personalizado: false,
    materiais_educativos: false,
    grupo_vip: false,
    boost_busca: 0,
    // IUB MAIS+ Joguinhos (Roleta da Sorte, fase 1): Grátis não participa
    // (peso 0 = nunca sorteado, max_jogos 0 = nem consegue ativar).
    max_jogos: 0,
    peso_roleta: 0,
    // IA Assistente de cadastro (analisa foto do produto, sugere nome/
    // descrição/marca/categoria) — ver openaiService.js/parceiroIaController.js.
    max_ia_mes: 10,
    // Cadastro por VOZ (IUB Food — Whisper + GPT-4o, ver
    // openaiService.cadastrarProdutoPorVoz). Cota DIÁRIA e separada da
    // max_ia_mes de foto: cada uso custa ~R$ 0,02, bem mais barato.
    max_voz_dia: 20,
  },
  oficial: {
    nome: 'IUB Oficial',
    preco_sindicalizada: 34.90,
    preco_nao_sindicalizada: 69.90,
    max_produtos: 30,
    max_produtos_rotativa: 4,
    participa_fecha_mes: true,
    max_produtos_bonus_fecha_mes: 3,
    tem_selo: true,
    selo_nome: 'Parceiro Oficial',
    selo_cor: 'dourado',
    analytics_avancado: true,
    aparece_destaques_parceiros: false,
    push_notification: false,
    instagram_integrado: false,
    banner_personalizado: false,
    materiais_educativos: false,
    grupo_vip: false,
    boost_busca: 1,
    max_jogos: 1, // só a Roleta existe na fase 1, mas já prevê Tigrinho/Raspadinha
    peso_roleta: 1,
    max_ia_mes: 50,
    max_voz_dia: 100,
  },
  premium: {
    nome: 'IUB Premium',
    preco_sindicalizada: 49.90,
    preco_nao_sindicalizada: 79.90,
    max_produtos: 30,
    max_produtos_rotativa: 9,
    participa_fecha_mes: true,
    max_produtos_bonus_fecha_mes: 3,
    tem_selo: true,
    selo_nome: 'Parceiro Premium',
    selo_cor: 'dourado_estrela',
    analytics_avancado: true,
    aparece_destaques_parceiros: true,
    push_notification: true,
    push_por_mes: 2,
    instagram_integrado: true,
    banner_personalizado: false,
    materiais_educativos: false,
    grupo_vip: false,
    boost_busca: 2,
    boost_fim_semana: true,
    max_jogos: 2,
    peso_roleta: 3,
    max_ia_mes: 150,
    max_voz_dia: 500,
  },
  master: {
    nome: 'IUB Master',
    preco_sindicalizada: 97.90,
    preco_nao_sindicalizada: 127.90,
    max_produtos: null, // ilimitado
    max_produtos_rotativa: 15,
    participa_fecha_mes: true,
    max_produtos_bonus_fecha_mes: 3,
    tem_selo: true,
    selo_nome: 'Parceiro VIP Master',
    selo_cor: 'vip_dourado_brilho',
    analytics_avancado: true,
    aparece_destaques_parceiros: true,
    push_notification: true,
    push_por_mes: 4,
    instagram_integrado: true,
    banner_personalizado: true,
    materiais_educativos: true,
    grupo_vip: true,
    live_mensal: true,
    stories_exclusivos: true,
    prioridade_melhorias: true,
    boost_busca: 3,
    boost_fim_semana: true,
    max_jogos: null, // ilimitado
    peso_roleta: 5,
    max_ia_mes: 500,
    max_voz_dia: null, // ilimitado
  },
};

// Promoção Pioneiro: os primeiros N parceiros que virarem plano pago ganham
// o selo vitalício + 50% off nos 3 primeiros meses (o desconto em si é
// negociado manualmente pelo admin na troca de plano — esse número aqui só
// limita QUEM pode ganhar o selo `e_pioneiro`, ver sindicatoPlanosController).
const PIONEIRO_VAGAS_TOTAL = 20;

function planoValido(plano) {
  return Object.prototype.hasOwnProperty.call(PLANOS, plano);
}

function planoVencido(parceiro, agora = new Date()) {
  if (!parceiro?.plano_expira_em || parceiro.cortesia_interna) return false;
  return new Date(parceiro.plano_expira_em).getTime() <= agora.getTime();
}

// Plano que vale AGORA pra fim de benefício (ver regras no topo do arquivo).
// Quem chama com uma linha parcial (sem plano_expira_em/cortesia_interna
// no SELECT) cai no plano gravado — a rotina diária de assinaturas grava o
// downgrade no banco, então a diferença dura no máximo até ela rodar.
function planoEfetivo(parceiro) {
  if (!parceiro || !planoValido(parceiro.plano)) return 'gratis';
  if (parceiro.plano !== 'gratis' && planoVencido(parceiro)) return 'gratis';
  return parceiro.plano;
}

// Mesma regra de planoEfetivo() em SQL, pra consultas que filtram/ordenam
// por plano no banco (boost de busca, destaques). `alias` = prefixo da
// tabela sindicato_parceiros na query ('pa.' ou '').
function sqlPlanoVigente(alias = '') {
  return `(${alias}plano <> 'gratis' AND (${alias}cortesia_interna OR ${alias}plano_expira_em IS NULL OR ${alias}plano_expira_em > NOW()))`;
}

function beneficios(plano) {
  return PLANOS[plano] || PLANOS.gratis;
}

function limiteProdutos(plano) {
  const max = beneficios(plano).max_produtos;
  return max === null || max === undefined ? Infinity : max;
}

function limiteJogos(plano) {
  const max = beneficios(plano).max_jogos;
  return max === null || max === undefined ? Infinity : max;
}

function limiteIA(plano) {
  const max = beneficios(plano).max_ia_mes;
  return max === null || max === undefined ? Infinity : max;
}

function limiteVozDia(plano) {
  const max = beneficios(plano).max_voz_dia;
  return max === null || max === undefined ? Infinity : max;
}

// Preço de verdade a cobrar de um plano, dado se o CNPJ do parceiro está
// sindicalizado ou não (ver sindicalizacaoService.verificarSindicalizacao).
function precoPlano(plano, sindicalizada) {
  const cfg = beneficios(plano);
  return sindicalizada ? cfg.preco_sindicalizada : cfg.preco_nao_sindicalizada;
}

// Assinatura automática (Mercado Pago): PIX mensal paga o preço cheio do
// plano; cartão recorrente ganha DESCONTO_CARTAO_RECORRENTE em cima dele
// (incentivo pra cobrança automática, que não depende de o empresário
// lembrar de pagar). Vale pros dois preços (sindicalizada ou não).
const DESCONTO_CARTAO_RECORRENTE = 0.05;
const TRIAL_ASSINATURA_DIAS = 7;
const METODOS_ASSINATURA = ['pix', 'cartao_recorrente'];
const PLANOS_PAGOS = Object.keys(PLANOS).filter(p => PLANOS[p].preco_sindicalizada > 0);

// Conta em CENTAVOS inteiros: em float, 34.90 * 0.95 = 33.1549999... e
// arredondaria pra 33,15 — o preço combinado é 33,16 (meio centavo pra cima).
function precoAssinatura(plano, sindicalizada, metodo) {
  const centavos = Math.round(precoPlano(plano, sindicalizada) * 100);
  const final = metodo === 'cartao_recorrente' ? Math.round(centavos * (1 - DESCONTO_CARTAO_RECORRENTE)) : centavos;
  return final / 100;
}

module.exports = {
  PLANOS,
  PIONEIRO_VAGAS_TOTAL,
  planoValido,
  planoEfetivo,
  planoVencido,
  sqlPlanoVigente,
  beneficios,
  limiteProdutos,
  limiteJogos,
  limiteIA,
  limiteVozDia,
  precoPlano,
  precoAssinatura,
  DESCONTO_CARTAO_RECORRENTE,
  TRIAL_ASSINATURA_DIAS,
  METODOS_ASSINATURA,
  PLANOS_PAGOS,
};
