// Portal do MOVV Partner, telas "Início" e "Minhas vendas" (Junior,
// 14/10/2026). Só leitura e apresentação: não muda regra, cálculo nem
// status. Os lançamentos vêm SEMPRE pela view v_partner_comissoes_partner
// (só as linhas do Partner logado, sem colunas internas); as indicações,
// pelas do próprio Partner.
const { paraCentavos, formatarCentavos } = require('./dinheiro');
const pc = require('./partnerComissoes');
const { mascararCpf } = require('../utils/validators');

const ORIGEM_ROTULO = { azul: 'Azul', certificado: 'Certificado', seguro: 'Seguros', federal_invest: 'Federal Invest', seguro_auto: 'Seguro de carro' };

const ddmm = data => {
  const s = String(data || '').slice(0, 10);
  return s.length === 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
};

// Situação em palavras simples (sem jargão na linha) e o grupo do filtro
// (a_receber | paga | outras). Indicação: sem contrato = "Indicado"; com
// contrato e sem comissão ainda = "Em análise"; cancelada = "Cancelada".
function situacaoDaVenda(v) {
  if (v.tipo === 'lancamento') {
    switch (v.status) {
      case 'previsto':   return { situacao: 'Comissão prevista', grupo: 'a_receber' };
      case 'confirmado': return { situacao: 'Comissão confirmada', grupo: 'a_receber' };
      case 'aprovado':   return { situacao: 'Aprovada, a pagar', grupo: 'a_receber' };
      case 'pago':       return { situacao: v.pago_em ? `Paga em ${ddmm(v.pago_em)}` : 'Paga', grupo: 'paga' };
      default:           return { situacao: 'Cancelada', grupo: 'outras' };
    }
  }
  if (v.status === 'cancelled') return { situacao: 'Cancelada', grupo: 'outras' };
  if (v.numero_contrato) return { situacao: 'Em análise', grupo: 'outras' };
  return { situacao: 'Indicado', grupo: 'outras' };
}

// "Sua comissão: Azul 30% · Certificado 20%" — da regra vigente do nível.
// Se a origem tiver percentuais diferentes por produto, mostra a faixa.
function comissaoVigente(regras) {
  const porOrigem = new Map();
  for (const r of regras) {
    const lista = porOrigem.get(r.origem) || [];
    lista.push(Number(r.percentual));
    porOrigem.set(r.origem, lista);
  }
  const fmt = n => `${String(n).replace('.', ',')}%`;
  return [...porOrigem.entries()].map(([origem, pcts]) => {
    const min = Math.min(...pcts);
    const max = Math.max(...pcts);
    return { origem, rotulo: ORIGEM_ROTULO[origem] || origem, texto: min === max ? fmt(min) : `${fmt(min)} a ${fmt(max)}` };
  });
}

// Mês corrente no fuso de Brasília ("2026-10")
const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

async function lancamentosDaView(db, partnerId) {
  return db.transacao(async cx => {
    await cx.query(`SELECT set_config('movv.partner_id', $1, true)`, [String(Number(partnerId))]);
    return (await cx.query('SELECT * FROM v_partner_comissoes_partner ORDER BY criado_em DESC, id DESC')).rows;
  });
}

async function indicacoesDoPartner(db, partnerId) {
  return (await db.query(
    `SELECT r.id, r.protocol, r.client_name, r.client_cpf, r.numero_contrato, r.status, r.created_at, pr.name AS produto
     FROM referrals r JOIN products pr ON pr.id = r.product_id
     WHERE r.partner_id = $1 ORDER BY r.created_at DESC, r.id DESC`,
    [partnerId]
  )).rows;
}

// Lista única de "vendas": cada lançamento é uma linha; cada indicação que
// ainda não virou comissão é outra. A indicação some quando já existe
// lançamento com o MESMO contrato (aí a linha é a da comissão). Indicação de
// Certificado não tem contrato: fica "Indicado" (a comissão do Certificado
// nasce da venda registrada pelo Fernando, sem vínculo com a indicação).
async function vendasDoPartner(db, partnerId) {
  const [lancs, inds] = [await lancamentosDaView(db, partnerId), await indicacoesDoPartner(db, partnerId)];
  const contratosComComissao = new Set(lancs.map(l => l.numero_contrato).filter(Boolean));

  const linhas = lancs.map(l => ({
    chave: `l-${l.id}`,
    tipo: 'lancamento',
    cliente_nome: l.cliente_nome,
    produto: l.produto,
    valor: l.valor_partner,
    data: l.pago_em || l.criado_em,
    ...situacaoDaVenda({ tipo: 'lancamento', status: l.status, pago_em: l.pago_em }),
    detalhes: {
      origem: ORIGEM_ROTULO[l.origem] || l.origem,
      base_valor: l.base_valor, percentual: l.percentual, valor_partner: l.valor_partner,
      competencia: l.competencia, numero_contrato: l.numero_contrato, pago_em: l.pago_em,
    },
  }));
  for (const r of inds) {
    if (r.numero_contrato && contratosComComissao.has(r.numero_contrato)) continue;
    linhas.push({
      chave: `i-${r.id}`,
      tipo: 'indicacao',
      cliente_nome: r.client_name,
      produto: r.produto,
      valor: null,
      data: r.created_at,
      ...situacaoDaVenda({ tipo: 'indicacao', status: r.status, numero_contrato: r.numero_contrato }),
      detalhes: {
        indicacao_id: r.id, protocolo: r.protocol, indicado_em: r.created_at,
        cpf: mascararCpf(r.client_cpf), cpf_pendente: !r.client_cpf, numero_contrato: r.numero_contrato,
      },
    });
  }
  linhas.sort((a, b) => new Date(b.data) - new Date(a.data));
  return linhas;
}

// A receber = previsto + confirmado + aprovado; Pago no mês = pagos com
// data de pagamento no mês corrente (fuso de Brasília). Somas em centavos.
function resumoDosLancamentos(lancs, mes = mesAtual()) {
  let aReceber = 0n;
  let pagoMes = 0n;
  for (const l of lancs) {
    if (['previsto', 'confirmado', 'aprovado'].includes(l.status)) aReceber += paraCentavos(l.valor_partner);
    if (l.status === 'pago' && String(l.pago_em || '').slice(0, 7) === mes) pagoMes += paraCentavos(l.valor_partner);
  }
  return { a_receber: formatarCentavos(aReceber), pago_mes: formatarCentavos(pagoMes), mes };
}

async function inicioDoPartner(db, partnerId, mes = mesAtual()) {
  const [{ regras }, lancs, vendas] = [
    await pc.tabelaDoPartner(db, partnerId),
    await lancamentosDaView(db, partnerId),
    await vendasDoPartner(db, partnerId),
  ];
  return {
    comissao: comissaoVigente(regras),
    resumo: resumoDosLancamentos(lancs, mes),
    ultimas: vendas.slice(0, 3),
    total_vendas: vendas.length,
  };
}

async function minhasVendas(db, partnerId) {
  const { regras } = await pc.tabelaDoPartner(db, partnerId);
  return { comissao: comissaoVigente(regras), vendas: await vendasDoPartner(db, partnerId) };
}

// Nova Venda do Movv Certificado (Fernando): indicação de Certificado em
// aberto, de MOVV Partner, com o mesmo CPF ou o mesmo nome do cliente. Só
// SUGESTÃO — quem decide é o Fernando. CPF sempre mascarado.
async function sugestoesCertificado(db, { nome, cpf }) {
  const n = String(nome || '').trim().replace(/\s+/g, ' ');
  const c = String(cpf || '').replace(/\D/g, '');
  const porCpf = c.length === 11 ? c : '';
  const porNome = n.length >= 5 ? n : '';
  if (!porCpf && !porNome) return [];
  const r = await db.query(
    `SELECT r.id, r.protocol, r.client_name, r.client_cpf, r.created_at,
            p.id AS partner_id, p.name AS partner_nome, p.code AS partner_codigo
     FROM referrals r
     JOIN partners p ON p.id = r.partner_id AND p.type = 'movv_partner' AND p.is_active = true
     JOIN products pr ON pr.id = r.product_id AND pr.type = 'digital_certificate'
     WHERE r.status = 'pending'
       AND (($1 <> '' AND r.client_cpf = $1) OR ($2 <> '' AND LOWER(r.client_name) = LOWER($2)))
     ORDER BY r.created_at DESC LIMIT 5`,
    [porCpf, porNome]
  );
  return r.rows.map(x => ({ ...x, client_cpf: mascararCpf(x.client_cpf) }));
}

module.exports = {
  situacaoDaVenda, comissaoVigente, resumoDosLancamentos, mesAtual,
  vendasDoPartner, inicioDoPartner, minhasVendas, sugestoesCertificado,
};
