const { PLANOS } = require('../config/planos');
const { onlyDigits, isValidCNPJ } = require('../utils/validators');
const { formatarValorDiario, formatarPrecoBRL } = require('../utils/planos');
const { verificarSindicalizacao } = require('../services/sindicalizacaoService');

function montarPlanos(sindicalizada) {
  const planos = {};
  for (const [chave, cfg] of Object.entries(PLANOS)) {
    const precoAtual = sindicalizada ? cfg.preco_sindicalizada : cfg.preco_nao_sindicalizada;
    const precoAlternativo = sindicalizada ? cfg.preco_nao_sindicalizada : cfg.preco_sindicalizada;
    const economiaMensal = Math.max(0, Math.round((cfg.preco_nao_sindicalizada - cfg.preco_sindicalizada) * 100) / 100);

    planos[chave] = {
      nome: cfg.nome,
      preco_mensal: precoAtual,
      preco_mensal_formatado: formatarPrecoBRL(precoAtual),
      preco_diario_formatado: `R$ ${formatarValorDiario(precoAtual)}`,
      preco_alternativo: precoAlternativo,
      preco_alternativo_formatado: formatarPrecoBRL(precoAlternativo),
      // economia: quanto essa cotação específica já está economizando (só
      // sindicalizada tem economia de verdade aplicada). economia_maxima:
      // quanto dá pra economizar por mês se sindicalizar — útil pra empresa
      // não-sindicalizada, mesmo quando `economia` acima é 0.
      economia: sindicalizada ? economiaMensal : 0,
      economia_formatada: formatarPrecoBRL(sindicalizada ? economiaMensal : 0),
      economia_maxima: economiaMensal,
      economia_maxima_formatada: formatarPrecoBRL(economiaMensal),
      produtos_rotativa: cfg.max_produtos_rotativa,
    };
  }
  return planos;
}

// GET /api/public/planos/precos?cnpj=xxxxxxxxxxxxxx — público. Sem CNPJ (ou
// CNPJ que não bate com nenhuma empresa sindicalizada em dia), retorna preço
// cheio (não-sindicalizada) por padrão conservador — nunca dá desconto de
// graça só por pedir sem provar o CNPJ.
async function precos(req, res) {
  try {
    const cnpjRaw = req.query.cnpj;
    if (!cnpjRaw) {
      return res.json({ cnpj_limpo: null, e_sindicalizada: false, razao_social: null, planos: montarPlanos(false) });
    }

    const cnpj = onlyDigits(cnpjRaw);
    if (!isValidCNPJ(cnpj)) return res.status(400).json({ error: 'CNPJ inválido' });

    const { sindicalizada, razaoSocial } = await verificarSindicalizacao(cnpj);
    return res.json({
      cnpj_limpo: cnpj,
      e_sindicalizada: sindicalizada,
      razao_social: razaoSocial,
      planos: montarPlanos(sindicalizada),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar preços dos planos' });
  }
}

module.exports = { precos, montarPlanos };
