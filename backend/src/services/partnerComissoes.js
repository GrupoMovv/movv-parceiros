// Livro único de comissões do MOVV Partner (migration 093, Junior 13/10/2026).
//
// Toda função recebe `cx` (o pool, ou o client de uma transação: qualquer
// coisa com query(text, params) -> { rows }), pra rodar dentro da transação
// de quem chama (ex.: a venda do Movv Certificado e o lançamento dela entram
// ou saem juntos). `quem` é o nome de quem fez (registroAdmin.nomeDoAdmin).
//
// Regras do negócio que moram aqui:
// - percentual vem da regra vigente (origem/produto × nível) e é COPIADO para
//   o lançamento; mudar a regra depois não altera lançamento antigo;
// - valor_partner = ROUND_HALF_UP(base × percentual / 100, 2), em centavos
//   (services/dinheiro.js) — o banco confere com um CHECK;
// - status só anda uma casa: previsto -> confirmado -> aprovado -> pago;
//   estornado vale a partir de qualquer um (com motivo).
const {
  paraCentavos, paraPct4, valorPartnerCentavos, formatarCentavos, formatarPct4,
} = require('./dinheiro');

const ORIGENS = ['azul', 'certificado', 'seguro', 'movv_cred', 'federal_invest', 'seguro_auto'];
// Origens em uso (seguro desde 14/10/2026, migration 095; MOVV CRED, crédito
// do Grupo fora da Azul, só por lançamento manual, migration 105; Federal
// Invest e seguro_auto: só o modelo)
const ORIGENS_ATIVAS = ['azul', 'certificado', 'seguro', 'movv_cred'];
const NIVEIS = ['mobile', 'point', 'hub', 'regional'];
const BASES_POR_ORIGEM = {
  azul: ['comissao_recebida'],
  certificado: ['valor_venda', 'lucro_grupo'],
  seguro: ['comissao_recebida'],
  movv_cred: ['comissao_recebida'],
  federal_invest: ['comissao_recebida'],
  seguro_auto: ['comissao_recebida'],
};
const STATUS = ['previsto', 'confirmado', 'aprovado', 'pago', 'estornado'];

class ErroComissao extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

const RE_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(s) {
  if (!RE_DATA.test(String(s || ''))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const textoOuNull = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

// ─── Regras ─────────────────────────────────────────────────────────────────

// Regra vigente na data: a do produto específico ganha da regra "todos os
// produtos" (produto NULL); entre iguais, a de vigência mais recente.
async function regraVigente(cx, { origem, produto, nivel, data }) {
  const r = await cx.query(
    `SELECT * FROM partner_comissao_regras
     WHERE origem = $1 AND nivel_partner = $2
       AND vigente_desde <= $3::date AND (vigente_ate IS NULL OR vigente_ate >= $3::date)
       AND (produto IS NULL OR LOWER(produto) = LOWER($4))
     ORDER BY (produto IS NULL), vigente_desde DESC, id DESC
     LIMIT 1`,
    [origem, nivel, data, produto || '']
  );
  return r.rows[0] || null;
}

function validarRegra(d) {
  if (!ORIGENS.includes(d.origem)) throw new ErroComissao('Origem inválida.');
  if (!NIVEIS.includes(d.nivel_partner)) throw new ErroComissao('Nível inválido.');
  if (!BASES_POR_ORIGEM[d.origem].includes(d.base)) throw new ErroComissao('Base não vale para essa origem.');
  let pct;
  try { pct = paraPct4(d.percentual); } catch { throw new ErroComissao('Percentual inválido.'); }
  if (pct < 0n || pct > 1000000n) throw new ErroComissao('Percentual precisa ficar entre 0 e 100.');
  if (!dataValida(d.vigente_desde)) throw new ErroComissao('Data de início da vigência inválida.');
  if (d.vigente_ate && !dataValida(d.vigente_ate)) throw new ErroComissao('Data de fim da vigência inválida.');
  if (d.vigente_ate && d.vigente_ate < d.vigente_desde) throw new ErroComissao('O fim da vigência é antes do início.');
  return formatarPct4(pct);
}

async function salvarRegra(cx, dados, quem, id = null) {
  const d = {
    origem: dados.origem,
    produto: textoOuNull(dados.produto),
    nivel_partner: dados.nivel_partner,
    base: dados.base,
    percentual: dados.percentual,
    vigente_desde: dados.vigente_desde,
    vigente_ate: textoOuNull(dados.vigente_ate),
    observacao: textoOuNull(dados.observacao),
  };
  const percentual = validarRegra(d);

  const sobrepoe = await cx.query(
    `SELECT id FROM partner_comissao_regras
     WHERE origem = $1 AND COALESCE(LOWER(produto), '') = COALESCE(LOWER($2), '') AND nivel_partner = $3
       AND vigente_desde <= COALESCE($5::date, 'infinity'::date)
       AND $4::date <= COALESCE(vigente_ate, 'infinity'::date)
       AND ($6::int IS NULL OR id <> $6::int)
     LIMIT 1`,
    [d.origem, d.produto, d.nivel_partner, d.vigente_desde, d.vigente_ate, id]
  );
  if (sobrepoe.rows[0]) {
    throw new ErroComissao(`Já existe regra #${sobrepoe.rows[0].id} para essa origem, produto e nível nesse período. Encerre a vigência dela antes.`, 409);
  }

  if (id) {
    const r = await cx.query(
      `UPDATE partner_comissao_regras SET
         origem = $1, produto = $2, nivel_partner = $3, base = $4, percentual = $5,
         vigente_desde = $6, vigente_ate = $7, observacao = $8,
         atualizado_por = $9, atualizado_em = NOW()
       WHERE id = $10 RETURNING *`,
      [d.origem, d.produto, d.nivel_partner, d.base, percentual, d.vigente_desde, d.vigente_ate, d.observacao, quem, id]
    );
    if (!r.rows[0]) throw new ErroComissao('Regra não encontrada.', 404);
    return r.rows[0];
  }
  const r = await cx.query(
    `INSERT INTO partner_comissao_regras
       (origem, produto, nivel_partner, base, percentual, vigente_desde, vigente_ate, observacao, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [d.origem, d.produto, d.nivel_partner, d.base, percentual, d.vigente_desde, d.vigente_ate, d.observacao, quem]
  );
  return r.rows[0];
}

async function listarRegras(cx) {
  const r = await cx.query(
    `SELECT * FROM partner_comissao_regras
     ORDER BY origem, nivel_partner, produto NULLS FIRST, vigente_desde DESC`
  );
  return r.rows;
}

// ─── Lançamentos ────────────────────────────────────────────────────────────

// Grava um lançamento. Calcula valor_partner em centavos (nunca float).
// Com chave_idempotencia repetida não grava de novo: devolve o que já existe.
async function criarLancamento(cx, d) {
  if (!ORIGENS.includes(d.origem)) throw new ErroComissao('Origem inválida.');
  if (!RE_COMPETENCIA.test(String(d.competencia || ''))) throw new ErroComissao('Competência inválida (use AAAA-MM).');
  if (!textoOuNull(d.produto)) throw new ErroComissao('Produto é obrigatório.');
  if (!['previsto', 'confirmado'].includes(d.status)) throw new ErroComissao('Lançamento nasce previsto ou confirmado.');

  let base, pct;
  try { base = paraCentavos(d.base_valor); } catch { throw new ErroComissao('Base inválida.'); }
  try { pct = paraPct4(d.percentual); } catch { throw new ErroComissao('Percentual inválido.'); }
  if (base < 0n) throw new ErroComissao('A base não pode ser negativa.');
  if (pct < 0n || pct > 1000000n) throw new ErroComissao('Percentual precisa ficar entre 0 e 100.');
  const valor = valorPartnerCentavos(base, pct);

  const confirmado = d.status === 'confirmado';
  const r = await cx.query(
    `INSERT INTO partner_comissoes
       (partner_id, origem, produto, referral_id, direta_sale_id, numero_contrato, cliente_nome,
        competencia, base_valor, percentual, valor_partner, regra_id, lancado_manualmente,
        status, confirmado_em, confirmado_por, observacao, chave_idempotencia, importacao_linha_id, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
             CASE WHEN $15::boolean THEN NOW() END, CASE WHEN $15::boolean THEN $16 END,
             $17,$18,$19,$16)
     ON CONFLICT (chave_idempotencia) DO NOTHING
     RETURNING *`,
    [
      d.partner_id, d.origem, String(d.produto).trim(), d.referral_id || null, d.direta_sale_id || null,
      textoOuNull(d.numero_contrato), textoOuNull(d.cliente_nome),
      d.competencia, formatarCentavos(base), formatarPct4(pct), formatarCentavos(valor),
      d.regra_id || null, Boolean(d.lancado_manualmente),
      d.status, confirmado, d.criado_por,
      textoOuNull(d.observacao), d.chave_idempotencia || null, d.importacao_linha_id || null,
    ]
  );
  if (r.rows[0]) return { lancamento: r.rows[0], jaExistia: false };
  const existente = await cx.query('SELECT * FROM partner_comissoes WHERE chave_idempotencia = $1', [d.chave_idempotencia]);
  return { lancamento: existente.rows[0], jaExistia: true };
}

async function partnerDoLivro(cx, partnerId) {
  const r = await cx.query(
    `SELECT id, name, code, type, is_active, nivel_partner FROM partners WHERE id = $1`, [partnerId]
  );
  const p = r.rows[0];
  if (!p || p.type !== 'movv_partner') return { erro: 'Não é um MOVV Partner.' };
  if (!p.is_active) return { erro: `Partner ${p.code} está inativo.` };
  if (!p.nivel_partner) return { erro: `Partner ${p.code} está sem nível definido (Mobile, Point, Hub ou Regional).` };
  return { partner: p };
}

// Data em que se procura a regra vigente de um lançamento manual: a que o
// admin informar (dentro da competência) ou, sem ela, o último dia da
// competência, sem passar de hoje (fuso de Brasília). Antes era o 1º dia
// do mês, o que deixava sem regra o mês em que uma regra começa (ex.:
// seguro, desde 14/10/2026).
function dataDeReferenciaManual(competencia, informada, hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })) {
  if (informada) {
    if (!dataValida(informada) || informada.slice(0, 7) !== competencia) {
      throw new ErroComissao('A data de referência precisa ser um dia da competência.');
    }
    return informada;
  }
  const [a, m] = competencia.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return ultimo < hoje ? ultimo : (hoje.slice(0, 7) === competencia ? hoje : ultimo);
}

// Lançamento manual do admin (casos fora da Azul automática, como o
// seguro). Mesma regra de percentual, copiado para o lançamento.
async function criarManual(cx, dados, quem) {
  if (!ORIGENS_ATIVAS.includes(dados.origem)) throw new ErroComissao('Origem não disponível para lançamento manual.');
  const { partner, erro } = await partnerDoLivro(cx, dados.partner_id);
  if (erro) throw new ErroComissao(erro);
  if (!RE_COMPETENCIA.test(String(dados.competencia || ''))) throw new ErroComissao('Competência inválida (use AAAA-MM).');
  const produto = textoOuNull(dados.produto);
  if (!produto) throw new ErroComissao('Produto é obrigatório.');
  if (!textoOuNull(dados.observacao)) throw new ErroComissao('Explique na observação por que o lançamento é manual.');

  const data = dataDeReferenciaManual(dados.competencia, textoOuNull(dados.data_referencia));
  const regra = await regraVigente(cx, { origem: dados.origem, produto, nivel: partner.nivel_partner, data });
  if (!regra) throw new ErroComissao(`Sem regra vigente para ${dados.origem} / nível ${partner.nivel_partner} em ${data}. Cadastre a regra antes.`);

  const { lancamento } = await criarLancamento(cx, {
    partner_id: partner.id, origem: dados.origem, produto,
    numero_contrato: dados.numero_contrato, cliente_nome: dados.cliente_nome,
    competencia: dados.competencia, base_valor: dados.base_valor,
    percentual: regra.percentual, regra_id: regra.id,
    status: dados.status_inicial === 'previsto' ? 'previsto' : 'confirmado',
    lancado_manualmente: true, observacao: dados.observacao, criado_por: quem,
  });
  return lancamento;
}

// ─── Mudança de status ──────────────────────────────────────────────────────

const ACOES = {
  confirmar: { de: ['previsto'], para: 'confirmado' },
  aprovar:   { de: ['confirmado'], para: 'aprovado' },
  pagar:     { de: ['aprovado'], para: 'pago' },
  estornar:  { de: ['previsto', 'confirmado', 'aprovado', 'pago'], para: 'estornado' },
};

const NOME_STATUS = { previsto: 'previsto', confirmado: 'confirmado', aprovado: 'aprovado', pago: 'pago', estornado: 'estornado' };

// Muda o status de uma lista de lançamentos. Só anda quem está no status
// anterior certo (WHERE status = ANY(de)) — o resto volta em `recusados`
// com o motivo, sem erro: aprovar em lote não para no primeiro problema.
async function mudarStatus(cx, ids, acao, quem, extras = {}) {
  const regra = ACOES[acao];
  if (!regra) throw new ErroComissao('Ação inválida.');
  const lista = [...new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  if (!lista.length) throw new ErroComissao('Nenhum lançamento informado.');

  // Cadastro de pagamento do Partner (migration 098): PAGAR é bloqueado sem
  // chave PIX ou sem CPF/CNPJ; APROVAR passa, mas avisa.
  const faltas = await faltasPorLancamento(cx, lista);
  const bloqueados = acao === 'pagar' ? lista.filter(id => faltas.get(id)?.length) : [];
  const alvo = lista.filter(id => !bloqueados.includes(id));

  let sql;
  let params;
  if (acao === 'confirmar') {
    sql = `UPDATE partner_comissoes SET status = 'confirmado', confirmado_em = NOW(), confirmado_por = $3, atualizado_em = NOW()
           WHERE id = ANY($1::int[]) AND status = ANY($2::text[]) RETURNING *`;
    params = [alvo, regra.de, quem];
  } else if (acao === 'aprovar') {
    sql = `UPDATE partner_comissoes SET status = 'aprovado', aprovado_em = NOW(), aprovado_por = $3, atualizado_em = NOW()
           WHERE id = ANY($1::int[]) AND status = ANY($2::text[]) RETURNING *`;
    params = [alvo, regra.de, quem];
  } else if (acao === 'pagar') {
    if (!dataValida(extras.data_pagamento)) throw new ErroComissao('Informe a data do pagamento.');
    sql = `UPDATE partner_comissoes SET status = 'pago', pago_em = $4::date, pago_registrado_em = NOW(), pago_por = $3,
             observacao_pagamento = $5, atualizado_em = NOW()
           WHERE id = ANY($1::int[]) AND status = ANY($2::text[]) RETURNING *`;
    params = [alvo, regra.de, quem, extras.data_pagamento, textoOuNull(extras.observacao)];
  } else {
    const motivo = textoOuNull(extras.motivo);
    if (!motivo) throw new ErroComissao('Informe o motivo do estorno.');
    sql = `UPDATE partner_comissoes SET status_antes_estorno = status, status = 'estornado', estornado_em = NOW(),
             estornado_por = $3, motivo_estorno = $4, atualizado_em = NOW()
           WHERE id = ANY($1::int[]) AND status = ANY($2::text[]) RETURNING *`;
    params = [alvo, regra.de, quem, motivo];
  }

  const alterados = alvo.length ? (await cx.query(sql, params)).rows : [];
  const feitos = new Set(alterados.map(r => r.id));
  const faltam = alvo.filter(id => !feitos.has(id));
  let recusados = bloqueados.map(id => ({
    id, motivo: `Cadastro incompleto para pagamento: falta ${faltas.get(id).join(' e ')}. O Partner cadastra o PIX em "Meu perfil"; o CPF/CNPJ é cadastrado pela equipe em "Cadastro para pagamento".`,
  }));
  if (faltam.length) {
    const atuais = (await cx.query('SELECT id, status FROM partner_comissoes WHERE id = ANY($1::int[])', [faltam])).rows;
    const porId = new Map(atuais.map(r => [r.id, r.status]));
    recusados = recusados.concat(faltam.map(id => {
      const st = porId.get(id);
      if (!st) return { id, motivo: 'Lançamento não encontrado.' };
      return { id, status: st, motivo: `Está ${NOME_STATUS[st]}; para ${acao} precisa estar ${regra.de.join(' ou ')}.` };
    }));
  }
  const avisos = acao === 'aprovar'
    ? alterados.filter(l => faltas.get(l.id)?.length).map(l => ({ id: l.id, motivo: `Aprovado, mas o Partner ainda não tem ${faltas.get(l.id).join(' nem ')}: o pagamento fica bloqueado até completar o cadastro.` }))
    : [];
  return { alterados, recusados, avisos };
}

// O que falta no cadastro de pagamento do Partner de cada lançamento
async function faltasPorLancamento(cx, ids) {
  const r = await cx.query(
    `SELECT pc.id, p.pix_key, p.pix_key_type, p.documento
     FROM partner_comissoes pc JOIN partners p ON p.id = pc.partner_id
     WHERE pc.id = ANY($1::int[])`, [ids]
  );
  return new Map(r.rows.map(x => {
    const f = [];
    if (!x.pix_key || !x.pix_key_type) f.push('chave PIX');
    if (!x.documento) f.push('CPF/CNPJ');
    return [x.id, f];
  }));
}

// ─── Movv Certificado ───────────────────────────────────────────────────────

const produtoDaVendaCertificado = venda => (venda.incluiu_token ? 'Certificado digital + Token' : 'Certificado digital');
const chaveCertificado = vendaId => `certificado:venda:${vendaId}`;

// Base da comissão do Partner numa venda do Movv Certificado, em texto "0.00".
//   valor_venda: total da venda (certificado + token)
//   lucro_grupo: preço de venda − custos (Junior, 13/10/2026) =
//     (preço do certificado − custo do certificado gravado na venda, R$ 19,90)
//     + (preço do token − valor de compra do token), quando a venda tem token.
//     NÃO desconta a comissão do vendedor nem a da contabilidade: por isso
//     não é o total_lucro_movv da venda (que desconta as duas).
function baseDaVendaCertificado(venda, tipoBase) {
  if (tipoBase === 'valor_venda') return formatarCentavos(paraCentavos(venda.total_venda));
  if (tipoBase === 'lucro_grupo') {
    let c = paraCentavos(venda.preco_venda) - paraCentavos(venda.custo);
    if (venda.incluiu_token) c += paraCentavos(venda.valor_venda_token ?? '0') - paraCentavos(venda.valor_compra_token ?? '0');
    return formatarCentavos(c);
  }
  return null;
}

async function registrarAviso(cx, { origem, direta_sale_id, partner_id, motivo }) {
  await cx.query(
    `INSERT INTO partner_comissao_avisos (origem, direta_sale_id, partner_id, motivo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (direta_sale_id) WHERE resolvido_em IS NULL AND direta_sale_id IS NOT NULL
     DO UPDATE SET motivo = EXCLUDED.motivo, partner_id = EXCLUDED.partner_id, criado_em = NOW()`,
    [origem, direta_sale_id, partner_id, motivo]
  );
}

async function resolverAvisosDaVenda(cx, vendaId, quem, resolucao) {
  await cx.query(
    `UPDATE partner_comissao_avisos SET resolvido_em = NOW(), resolvido_por = $2, resolucao = $3
     WHERE direta_sale_id = $1 AND resolvido_em IS NULL`,
    [vendaId, quem, resolucao]
  );
}

// Venda do Movv Certificado com Partner responsável -> lançamento "previsto".
// Sem regra vigente (ou Partner sem nível) NÃO inventa valor: não gera e
// deixa um aviso para o admin. Devolve { lancamento } ou { aviso } ou null.
async function lancarCertificado(cx, venda, quem) {
  if (!venda?.partner_id || venda.status !== 'confirmada') return null;
  const avisar = async motivo => {
    await registrarAviso(cx, { origem: 'certificado', direta_sale_id: venda.id, partner_id: venda.partner_id, motivo });
    return { aviso: motivo };
  };

  const { partner, erro } = await partnerDoLivro(cx, venda.partner_id);
  if (erro) return avisar(erro);

  const produto = produtoDaVendaCertificado(venda);
  const regra = await regraVigente(cx, { origem: 'certificado', produto, nivel: partner.nivel_partner, data: venda.data_venda });
  if (!regra) return avisar(`Sem regra de comissão do Movv Certificado para o nível ${partner.nivel_partner} em ${venda.data_venda}. Cadastre a regra e clique em "Tentar de novo".`);

  const base = baseDaVendaCertificado(venda, regra.base);
  if (base === null || paraCentavos(base) <= 0n) {
    return avisar(`A base da comissão (${regra.base === 'lucro_grupo' ? 'preço − custos' : 'valor da venda'}) deu ${base ?? 'vazia'} nesta venda: zero ou negativa não gera lançamento. Confira a venda.`);
  }

  const { lancamento } = await criarLancamento(cx, {
    partner_id: partner.id, origem: 'certificado', produto,
    direta_sale_id: venda.id, cliente_nome: venda.cliente_nome,
    competencia: venda.reference_month, base_valor: base,
    percentual: regra.percentual, regra_id: regra.id,
    status: 'previsto', chave_idempotencia: chaveCertificado(venda.id), criado_por: quem,
  });
  await resolverAvisosDaVenda(cx, venda.id, quem, `Lançamento #${lancamento.id} gerado`);
  return { lancamento };
}

// Venda editada: lançamento ainda previsto/confirmado acompanha a nova base
// (o percentual copiado continua o mesmo). Aprovado ou pago não muda
// sozinho: vira aviso para o admin conferir.
async function aoEditarVendaCertificado(cx, venda, quem) {
  const atual = (await cx.query(
    `SELECT pc.*, r.base AS regra_base FROM partner_comissoes pc
     LEFT JOIN partner_comissao_regras r ON r.id = pc.regra_id
     WHERE pc.direta_sale_id = $1 AND pc.status <> 'estornado'`, [venda.id]
  )).rows[0];
  if (!atual) return lancarCertificado(cx, venda, quem);

  const novaBase = baseDaVendaCertificado(venda, atual.regra_base);
  if (novaBase === null || paraCentavos(novaBase) === paraCentavos(atual.base_valor)) {
    await cx.query(`UPDATE partner_comissoes SET cliente_nome = $2, atualizado_em = NOW() WHERE id = $1`, [atual.id, venda.cliente_nome]);
    return { lancamento: atual };
  }
  if (['previsto', 'confirmado'].includes(atual.status) && paraCentavos(novaBase) > 0n) {
    const valor = valorPartnerCentavos(paraCentavos(novaBase), paraPct4(atual.percentual));
    const r = await cx.query(
      `UPDATE partner_comissoes SET base_valor = $2, valor_partner = $3, cliente_nome = $4, produto = $5, atualizado_em = NOW()
       WHERE id = $1 RETURNING *`,
      [atual.id, formatarCentavos(paraCentavos(novaBase)), formatarCentavos(valor), venda.cliente_nome, produtoDaVendaCertificado(venda)]
    );
    return { lancamento: r.rows[0] };
  }
  const motivo = `Venda editada com o lançamento #${atual.id} já ${atual.status}: a base mudou de ${atual.base_valor} para ${novaBase}. Confira e, se for o caso, estorne e lance de novo.`;
  await registrarAviso(cx, { origem: 'certificado', direta_sale_id: venda.id, partner_id: atual.partner_id, motivo });
  return { aviso: motivo };
}

// Venda cancelada ou excluída: estorna o lançamento (seja qual for o status)
async function aoCancelarVendaCertificado(cx, vendaId, motivo, quem) {
  const r = await cx.query(
    `SELECT id FROM partner_comissoes WHERE direta_sale_id = $1 AND status <> 'estornado'`, [vendaId]
  );
  await resolverAvisosDaVenda(cx, vendaId, quem, motivo);
  if (!r.rows.length) return null;
  return mudarStatus(cx, r.rows.map(x => x.id), 'estornar', quem, { motivo });
}

// "Tentar de novo" no aviso (depois de cadastrar a regra ou o nível)
async function tentarAvisoDeNovo(cx, avisoId, quem) {
  const a = (await cx.query('SELECT * FROM partner_comissao_avisos WHERE id = $1', [avisoId])).rows[0];
  if (!a) throw new ErroComissao('Aviso não encontrado.', 404);
  if (a.resolvido_em) throw new ErroComissao('Aviso já resolvido.');
  if (!a.direta_sale_id) throw new ErroComissao('Aviso sem venda ligada.');
  const venda = (await cx.query('SELECT * FROM direta_sales WHERE id = $1', [a.direta_sale_id])).rows[0];
  if (!venda || venda.status !== 'confirmada' || !venda.partner_id) {
    await resolverAvisosDaVenda(cx, a.direta_sale_id, quem, 'Venda não está mais confirmada ou ficou sem Partner');
    return { resolvido: true };
  }
  const ja = (await cx.query(`SELECT id FROM partner_comissoes WHERE direta_sale_id = $1 AND status <> 'estornado'`, [venda.id])).rows[0];
  if (ja) {
    await resolverAvisosDaVenda(cx, venda.id, quem, `Conferido; lançamento #${ja.id}`);
    return { resolvido: true };
  }
  return lancarCertificado(cx, venda, quem);
}

// ─── Leitura do Partner (decisão A) ─────────────────────────────────────────

// Só pela view, com o id do Partner logado gravado na transação: a view já
// filtra as linhas dele e não tem as colunas internas.
async function listarDoPartner(db, partnerId, { competencia, status } = {}) {
  return db.transacao(async cx => {
    await cx.query(`SELECT set_config('movv.partner_id', $1, true)`, [String(Number(partnerId))]);
    const filtros = [];
    const params = [];
    if (competencia) { params.push(competencia); filtros.push(`competencia = $${params.length}`); }
    const whereComp = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    if (status) { params.push(status); filtros.push(`status = $${params.length}`); }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

    const lancamentos = (await cx.query(
      `SELECT * FROM v_partner_comissoes_partner ${where} ORDER BY competencia DESC, criado_em DESC, id DESC`, params
    )).rows;
    const totais = (await cx.query(
      `SELECT
         COALESCE(SUM(valor_partner) FILTER (WHERE status IN ('previsto','confirmado')), 0) AS a_receber,
         COALESCE(SUM(valor_partner) FILTER (WHERE status = 'aprovado'), 0)                AS aprovado,
         COALESCE(SUM(valor_partner) FILTER (WHERE status = 'pago'), 0)                    AS pago
       FROM v_partner_comissoes_partner ${whereComp}`,
      competencia ? [competencia] : []
    )).rows[0];
    const competencias = (await cx.query(
      `SELECT DISTINCT competencia FROM v_partner_comissoes_partner ORDER BY competencia DESC`
    )).rows.map(r => r.competencia);
    return { lancamentos, totais, competencias };
  });
}

// Tabela vigente do nível do Partner (só o nível dele, só o que vale hoje)
async function tabelaDoPartner(cx, partnerId) {
  const p = (await cx.query('SELECT nivel_partner FROM partners WHERE id = $1', [partnerId])).rows[0];
  const nivel = p?.nivel_partner || null;
  if (!nivel) return { nivel: null, regras: [] };
  const regras = (await cx.query(
    `SELECT origem, produto, base, percentual, vigente_desde, vigente_ate
     FROM partner_comissao_regras
     WHERE nivel_partner = $1 AND vigente_desde <= CURRENT_DATE AND (vigente_ate IS NULL OR vigente_ate >= CURRENT_DATE)
     ORDER BY origem, produto NULLS FIRST`,
    [nivel]
  )).rows;
  return { nivel, regras };
}

// ─── Admin ──────────────────────────────────────────────────────────────────

async function listarAdmin(cx, { partner_id, competencia, status, origem } = {}) {
  const filtros = [];
  const params = [];
  const add = (cond, v) => { params.push(v); filtros.push(cond.replace('?', `$${params.length}`)); };
  if (partner_id) add('pc.partner_id = ?', Number(partner_id));
  if (competencia) add('pc.competencia = ?', competencia);
  if (status) add('pc.status = ?', status);
  if (origem) add('pc.origem = ?', origem);
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const r = await cx.query(
    `SELECT pc.*, p.name AS partner_nome, p.code AS partner_codigo, p.nivel_partner
     FROM partner_comissoes pc JOIN partners p ON p.id = pc.partner_id
     ${where}
     ORDER BY pc.competencia DESC, pc.criado_em DESC, pc.id DESC
     LIMIT 2000`,
    params
  );
  return r.rows;
}

async function listarAvisos(cx, { abertos = true } = {}) {
  const r = await cx.query(
    `SELECT a.*, p.name AS partner_nome, p.code AS partner_codigo,
            ds.cliente_nome, ds.data_venda, ds.total_venda, ds.status AS venda_status
     FROM partner_comissao_avisos a
     LEFT JOIN partners p ON p.id = a.partner_id
     LEFT JOIN direta_sales ds ON ds.id = a.direta_sale_id
     ${abertos ? 'WHERE a.resolvido_em IS NULL' : ''}
     ORDER BY a.criado_em DESC LIMIT 500`
  );
  return r.rows;
}

async function listarPartners(cx) {
  const r = await cx.query(
    `SELECT id, name, code, nivel_partner, is_active FROM partners
     WHERE type = 'movv_partner' ORDER BY is_active DESC, name`
  );
  return r.rows;
}

module.exports = {
  ORIGENS, ORIGENS_ATIVAS, NIVEIS, BASES_POR_ORIGEM, STATUS, ACOES, ErroComissao,
  regraVigente, salvarRegra, listarRegras,
  criarLancamento, criarManual, mudarStatus, dataDeReferenciaManual,
  lancarCertificado, aoEditarVendaCertificado, aoCancelarVendaCertificado, tentarAvisoDeNovo, registrarAviso,
  produtoDaVendaCertificado, chaveCertificado,
  listarDoPartner, tabelaDoPartner, listarAdmin, listarAvisos, listarPartners,
};
