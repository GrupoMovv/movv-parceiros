// Fonte única de verdade dos limites/benefícios de cada plano do IUB MAIS.
// Fase 2 (planos pagos) ainda está DESLIGADA — todo parceiro é 'gratis' até
// alguém trocar manualmente pelo admin (ver sindicatoPlanosController). Os
// campos aqui existem pra todo endpoint/tela que depende de plano ler DESTE
// arquivo em vez de reinventar o número em outro lugar — quando decidirmos
// mudar um limite ou lançar de verdade, é só editar aqui.
//
// `max_produtos_rotativa`, `boost_busca` etc. já são consumidos por código
// de verdade (vitrineRotativaService, marketplaceHomeController,
// parceiroProdutosController). Os campos "trabalho manual" (push_notification,
// instagram_integrado, live_mensal, prioridade_melhorias...) são só o
// contrato do que aquele plano promete — não disparam nada sozinhos.
const PLANOS = {
  gratis: {
    nome: 'IUB Grátis',
    preco: 0,
    max_produtos: 30,
    max_produtos_rotativa: 0, // não aparece na rotativa
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
  },
  oficial: {
    nome: 'IUB Oficial',
    preco: 37.90,
    max_produtos: 30,
    max_produtos_rotativa: 3,
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
  },
  premium: {
    nome: 'IUB Premium',
    preco: 49.90,
    max_produtos: 30,
    max_produtos_rotativa: 8,
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
  },
  master: {
    nome: 'IUB Master',
    preco: 89.90,
    max_produtos: null, // ilimitado
    max_produtos_rotativa: 15,
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
  },
};

// SEED de demonstração (não pagam nada, mas rodam com os benefícios do
// Premium) — enquanto ninguém paga plano de verdade (fase 100% grátis),
// mostra a vitrine/selo funcionando de verdade pra alguém. Esvaziar essa
// lista quando os planos pagos forem ativados.
const PARCEIROS_SEED_DEMONSTRACAO = ['nossa-drogaria', 'azul-emprestimo'];
const PLANO_SEED_DEMONSTRACAO = 'premium';

// Promoção Pioneiro: os primeiros N parceiros que virarem plano pago ganham
// o selo vitalício + 50% off nos 3 primeiros meses (o desconto em si é
// negociado manualmente pelo admin na troca de plano — esse número aqui só
// limita QUEM pode ganhar o selo `e_pioneiro`, ver sindicatoPlanosController).
const PIONEIRO_VAGAS_TOTAL = 20;

function planoValido(plano) {
  return Object.prototype.hasOwnProperty.call(PLANOS, plano);
}

// Plano "efetivo" pra fim de benefício — aplica o seed de demonstração por
// cima do plano real gravado no banco (que continua 'gratis' pra todo
// mundo, seed incluso — o seed nunca é cobrado, só finge ser premium nas
// telas/regras).
function planoEfetivo(parceiro) {
  if (!parceiro) return 'gratis';
  if (PARCEIROS_SEED_DEMONSTRACAO.includes(parceiro.slug)) return PLANO_SEED_DEMONSTRACAO;
  return planoValido(parceiro.plano) ? parceiro.plano : 'gratis';
}

function beneficios(plano) {
  return PLANOS[plano] || PLANOS.gratis;
}

function limiteProdutos(plano) {
  const max = beneficios(plano).max_produtos;
  return max === null || max === undefined ? Infinity : max;
}

module.exports = {
  PLANOS,
  PARCEIROS_SEED_DEMONSTRACAO,
  PLANO_SEED_DEMONSTRACAO,
  PIONEIRO_VAGAS_TOTAL,
  planoValido,
  planoEfetivo,
  beneficios,
  limiteProdutos,
};
