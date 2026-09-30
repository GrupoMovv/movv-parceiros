// Vendedor Pessoa Física (CPF) — decisões do Junior de 30/09/2026. Fonte
// única desses números: backend e (via /public/vender/pessoa-fisica/config)
// a tela de cadastro.

// Versão do texto dos Termos do Vendedor Pessoa Física aceito no cadastro.
// Mudou o texto → mude a versão (o aceite gravado aponta pra ela).
const TERMOS_PF_VERSAO = '2026-09-30';

const NIVEIS_PF = {
  casual: {
    label: 'Vendedor Casual',
    selo: '🏠 Vendedor Casual',
    resumo: 'Vende de vez em quando',
    max_produtos_ativos: 20,
    preco_sindicalizada: 19.90,
    preco_nao_sindicalizada: 29.90,
  },
  empreendedor: {
    label: 'Empreendedor',
    selo: '🚀 Empreendedor',
    resumo: 'Vende sempre',
    max_produtos_ativos: 50,
    preco_sindicalizada: 34.90,
    preco_nao_sindicalizada: 54.90,
  },
};

// Chave do lançamento (Junior, 30/09): enquanto estiver desligada, o /vender
// NÃO mostra "Como você vai vender?" — segue direto pro cadastro de CNPJ,
// como antes. O endereço direto /vender/pessoa-fisica continua funcionando
// (pra testes). Liga no Render: VENDEDOR_PF_ABERTO=true.
const VENDEDOR_PF_ABERTO = String(process.env.VENDEDOR_PF_ABERTO || '').trim().toLowerCase() === 'true';

const IDADE_MINIMA_PF = 18;
// Cadastros PF por IP em 24h (anti-robô; mesmo espírito do /vender)
const MAX_CADASTROS_PF_POR_IP_24H = 5;

const MENSAGEM_PROMOCAO_PF = 'Promoções ficam para uma próxima fase para quem vende com CPF. Por enquanto, só para MEI e empresas.';

function limiteProdutosAtivosPf(parceiro) {
  if (parceiro?.tipo_pessoa !== 'pf') return null;
  return NIVEIS_PF[parceiro.nivel_vendedor]?.max_produtos_ativos ?? 0;
}

module.exports = {
  VENDEDOR_PF_ABERTO, TERMOS_PF_VERSAO, NIVEIS_PF, IDADE_MINIMA_PF, MAX_CADASTROS_PF_POR_IP_24H, MENSAGEM_PROMOCAO_PF, limiteProdutosAtivosPf,
};
