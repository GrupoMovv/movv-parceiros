// Livro de comissões do MOVV Partner (migration 093). Regras de negócio em
// services/partnerComissoes.js; aqui só HTTP, permissão e registro de quem
// fez (admin_acoes, alvo 'partner_comissoes' / 'partner_comissao_regras').
const db = require('../config/database');
const pc = require('../services/partnerComissoes');
const { registrarAcao, nomeDoAdmin } = require('../services/registroAdmin');

function responderErro(res, err, padrao) {
  if (err instanceof pc.ErroComissao) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: padrao });
}

// ─── Partner ────────────────────────────────────────────────────────────────

async function minhas(req, res) {
  try {
    const { competencia, status } = req.query;
    const dados = await pc.listarDoPartner(db, req.user.id, {
      competencia: /^\d{4}-\d{2}$/.test(competencia || '') ? competencia : null,
      status: pc.STATUS.includes(status) ? status : null,
    });
    return res.json(dados);
  } catch (err) {
    return responderErro(res, err, 'Erro ao carregar suas comissões');
  }
}

async function tabela(req, res) {
  try {
    return res.json(await pc.tabelaDoPartner(db, req.user.id));
  } catch (err) {
    return responderErro(res, err, 'Erro ao carregar a tabela vigente');
  }
}

// ─── Admin: lançamentos ─────────────────────────────────────────────────────

async function listar(req, res) {
  try {
    const { partner_id, competencia, status, origem } = req.query;
    return res.json(await pc.listarAdmin(db, {
      partner_id: Number(partner_id) || null,
      competencia: /^\d{4}-\d{2}$/.test(competencia || '') ? competencia : null,
      status: pc.STATUS.includes(status) ? status : null,
      origem: pc.ORIGENS.includes(origem) ? origem : null,
    }));
  } catch (err) {
    return responderErro(res, err, 'Erro ao listar lançamentos');
  }
}

async function criarManual(req, res) {
  try {
    const lanc = await db.transacao(async cx => {
      const l = await pc.criarManual(cx, req.body, nomeDoAdmin(req.user));
      await registrarAcao(cx, req, 'comissao_partner_manual', 'partner_comissoes', l.id, { valor: l.valor_partner, competencia: l.competencia });
      return l;
    });
    return res.status(201).json(lanc);
  } catch (err) {
    return responderErro(res, err, 'Erro ao criar lançamento');
  }
}

// confirmar | aprovar | pagar | estornar — individual ou em lote ({ ids: [...] })
function acao(nome) {
  return async (req, res) => {
    try {
      const ids = req.params.id ? [req.params.id] : req.body.ids;
      const r = await db.transacao(async cx => {
        const out = await pc.mudarStatus(cx, ids, nome, nomeDoAdmin(req.user), req.body || {});
        const detalhes = nome === 'pagar' ? { data_pagamento: req.body.data_pagamento }
          : nome === 'estornar' ? { motivo: req.body.motivo } : null;
        await registrarAcao(cx, req, `comissao_partner_${nome}`, 'partner_comissoes', out.alterados.map(x => x.id), detalhes);
        return out;
      });
      if (req.params.id && !r.alterados.length) return res.status(409).json({ error: r.recusados[0]?.motivo || 'Não foi possível', ...r });
      return res.json(r);
    } catch (err) {
      return responderErro(res, err, 'Erro ao atualizar lançamentos');
    }
  };
}

// ─── Admin: regras ──────────────────────────────────────────────────────────

async function listarRegras(req, res) {
  try {
    return res.json(await pc.listarRegras(db));
  } catch (err) {
    return responderErro(res, err, 'Erro ao listar regras');
  }
}

async function salvarRegra(req, res) {
  try {
    const id = req.params.id ? Number(req.params.id) : null;
    const regra = await db.transacao(async cx => {
      const antes = id ? (await cx.query('SELECT * FROM partner_comissao_regras WHERE id = $1', [id])).rows[0] : null;
      const r = await pc.salvarRegra(cx, req.body, nomeDoAdmin(req.user), id);
      await registrarAcao(cx, req, id ? 'regra_comissao_editada' : 'regra_comissao_criada', 'partner_comissao_regras', r.id,
        { antes: antes ? { percentual: antes.percentual, vigente_desde: antes.vigente_desde, vigente_ate: antes.vigente_ate } : null,
          depois: { percentual: r.percentual, vigente_desde: r.vigente_desde, vigente_ate: r.vigente_ate } });
      return r;
    });
    return res.status(id ? 200 : 201).json(regra);
  } catch (err) {
    return responderErro(res, err, 'Erro ao salvar regra');
  }
}

// ─── Admin: avisos e apoio ──────────────────────────────────────────────────

async function listarAvisos(req, res) {
  try {
    return res.json(await pc.listarAvisos(db, { abertos: req.query.todos !== '1' }));
  } catch (err) {
    return responderErro(res, err, 'Erro ao listar avisos');
  }
}

async function tentarAviso(req, res) {
  try {
    const r = await db.transacao(cx => pc.tentarAvisoDeNovo(cx, Number(req.params.id), nomeDoAdmin(req.user)));
    return res.json(r || { resolvido: true });
  } catch (err) {
    return responderErro(res, err, 'Erro ao tentar de novo');
  }
}

async function partners(req, res) {
  try {
    return res.json(await pc.listarPartners(db));
  } catch (err) {
    return responderErro(res, err, 'Erro ao listar Partners');
  }
}

module.exports = {
  minhas, tabela,
  listar, criarManual,
  confirmar: acao('confirmar'), aprovar: acao('aprovar'), pagar: acao('pagar'), estornar: acao('estornar'),
  listarRegras, salvarRegra, listarAvisos, tentarAviso, partners,
};

// ─── Portal do Partner: Início e Minhas vendas (só leitura) ─────────────────
const portal = require('../services/partnerPortal');
const { dataLimitePagamento } = require('../services/calendarioPagamento');

async function inicio(req, res) {
  try {
    return res.json({ nome: req.user.name, ...(await portal.inicioDoPartner(db, req.user.id)) });
  } catch (err) {
    return responderErro(res, err, 'Erro ao carregar o início');
  }
}

async function vendas(req, res) {
  try {
    return res.json(await portal.minhasVendas(db, req.user.id));
  } catch (err) {
    return responderErro(res, err, 'Erro ao carregar suas vendas');
  }
}

// "Ver como Partner" do admin: a mesma tela, sem dado de ninguém e sem
// gravar nada — só a comissão vigente do nível escolhido (padrão Mobile).
async function previa(req, res) {
  try {
    const nivel = pc.NIVEIS.includes(req.query.nivel) ? req.query.nivel : 'mobile';
    const regras = (await db.query(
      `SELECT origem, produto, percentual FROM partner_comissao_regras
       WHERE nivel_partner = $1 AND vigente_desde <= CURRENT_DATE AND (vigente_ate IS NULL OR vigente_ate >= CURRENT_DATE)`,
      [nivel]
    )).rows;
    return res.json({
      previa: true, nivel, nome: req.user.name,
      comissao: portal.comissaoVigente(regras),
      resumo: { a_receber: '0.00', pago_mes: '0.00', mes: portal.mesAtual() },
      proximo_pagamento: dataLimitePagamento(portal.mesAtual()),
      ultimas: [], vendas: [], total_vendas: 0,
    });
  } catch (err) {
    return responderErro(res, err, 'Erro ao montar a prévia');
  }
}

// Nova Venda do Certificado: sugere o Partner de uma indicação em aberto
async function sugestaoCertificado(req, res) {
  try {
    return res.json(await portal.sugestoesCertificado(db, { nome: req.query.nome, cpf: req.query.cpf }));
  } catch (err) {
    return responderErro(res, err, 'Erro ao buscar indicação');
  }
}

module.exports.inicio = inicio;
module.exports.vendas = vendas;
module.exports.previa = previa;
module.exports.sugestaoCertificado = sugestaoCertificado;
