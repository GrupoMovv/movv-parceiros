// Clube MAIS+ — regras da Loja do Clube (migration 100, Junior 19/10/2026).
// Fonte única dos números; a tela do painel lê daqui pelo GET /api/parceiro/clube.

// Desconto permanente do Clube: 1,5% a 30%, com uma casa decimal.
const PERCENTUAL_MIN = 1.5;
const PERCENTUAL_MAX = 30;

// Mínimo SUGERIDO pelo tipo da loja: só orientação na tela, não trava.
// O tipo vem da categoria principal (e das outras categorias da loja).
const MINIMOS_SUGERIDOS = [
  { tipo: 'servicos', rotulo: 'serviços', percentual: 10, categorias: ['Serviços'] },
  { tipo: 'essenciais', rotulo: 'mercado, farmácia e bebidas', percentual: 3, categorias: ['Alimentação', 'Saúde', 'Bebidas'] },
];
const MINIMO_PADRAO = { tipo: 'produtos', rotulo: 'demais produtos', percentual: 5 };

// Versão nova do termo: dias para a loja aceitar e aviso antes do fim.
const AVISO_DIAS_ANTES = 3;

// b3 liga o preço Clube da loja no site e no pedido. Até lá o benefício só
// fica gravado e o painel avisa que ainda não vale no site.
const PRECO_LOJA_CLUBE_NO_SITE = false;

module.exports = { PERCENTUAL_MIN, PERCENTUAL_MAX, MINIMOS_SUGERIDOS, MINIMO_PADRAO, AVISO_DIAS_ANTES, PRECO_LOJA_CLUBE_NO_SITE };
