const { Payment } = require('mercadopago');
const db = require('../config/database');
const mp = require('../config/mercadopago');
const { PLANOS, PLANOS_PAGOS, PIONEIRO_VAGAS_TOTAL, precoAssinatura, TRIAL_ASSINATURA_DIAS, DESCONTO_CARTAO_RECORRENTE } = require('../config/planos');
const { verificarSindicalizacao } = require('./sindicalizacaoService');
const emailService = require('./emailService');

// Assinatura dos planos pelo Mercado Pago. Fase B: PIX mensal, pago NA
// HORA, sem trial (decisão: trial de 7 dias só no cartão recorrente, fase
// C). Cada mês é um PIX novo — PIX não tem débito automático.
//
// Quem ativa o plano é SEMPRE processarPagamentoMp(), com o pagamento
// reconsultado na API do MP (nunca o corpo do webhook): tanto o webhook
// quanto o polling da tela caem nele, e ele é idempotente (lock na linha
// do pagamento + "já estava aprovado? não faz nada").

// O MP aceita PIX vencendo entre 30 min e 30 dias — 30 min é o mínimo
// (o pedido original era 10 min, abaixo do que a API aceita).
const PIX_VALIDADE_MIN = 30;
// Renovação do PIX liberada a partir de N dias antes do fim do período.
const RENOVACAO_PIX_ANTECEDENCIA_DIAS = 7;
// Lembrete "seu plano vence em breve" (PIX) a partir de N dias antes.
const LEMBRETE_PIX_DIAS = 3;
// URL pública do webhook, se quiser mandar em cada pagamento. Opcional: o
// normal é configurar a URL uma vez no painel do MP (Webhooks).
const NOTIFICATION_URL = (process.env.MP_NOTIFICATION_URL || '').trim() || undefined;

class ErroAssinatura extends Error {
  constructor(status, codigo, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.extra = extra;
  }
}

function exigirPronto() {
  if (!mp.PRONTO) {
    throw new ErroAssinatura(503, 'PAGAMENTO_INDISPONIVEL', 'Pagamento online indisponível no momento. Fale com a gente pelo WhatsApp pra assinar.');
  }
}

// external_reference que vai pro MP: amarra o pagamento do MP à nossa linha
// de sindicato_pagamentos e ao ambiente (teste nunca ativa plano em prod).
function referenciaExterna(pagamentoId) {
  return `iubmais:${mp.AMBIENTE}:pag:${pagamentoId}`;
}
function lerReferenciaExterna(ref) {
  const m = /^iubmais:(test|prod):pag:(\d+)$/.exec(String(ref || ''));
  return m ? { ambiente: m[1], pagamentoId: Number(m[2]) } : null;
}

// Formato de data que a API do MP pede (offset explícito). Brasil sem
// horário de verão desde 2019 -> -03:00 fixo.
function dataMp(date) {
  return new Date(date.getTime() - 3 * 3600 * 1000).toISOString().replace('Z', '-03:00');
}

function statusLocal(mpPay) {
  switch (mpPay.status) {
    case 'approved': return 'aprovado';
    case 'rejected': return 'rejeitado';
    case 'refunded':
    case 'charged_back': return 'reembolsado';
    case 'cancelled': return mpPay.status_detail === 'expired' ? 'expirado' : 'cancelado';
    default: return 'pendente'; // pending, in_process, authorized, in_mediation
  }
}

async function contatoDoParceiro(parceiroId, cx = db) {
  const r = await cx.query(
    `SELECT p.nome, u.email
       FROM sindicato_parceiros p
       LEFT JOIN LATERAL (
         SELECT email FROM sindicato_parceiro_usuarios
          WHERE parceiro_id = p.id AND ativo = true
          ORDER BY (cargo = 'dono') DESC, id ASC LIMIT 1
       ) u ON true
      WHERE p.id = $1`,
    [parceiroId]
  );
  return r.rows[0] || null;
}

// Preço que ESTE parceiro paga em cada plano/método (sindicalização conta).
async function opcoesDoParceiro(parceiroId) {
  const r = await db.query('SELECT cnpj, cortesia_interna FROM sindicato_parceiros WHERE id = $1', [parceiroId]);
  const parceiro = r.rows[0];
  const { sindicalizada } = parceiro?.cnpj ? await verificarSindicalizacao(parceiro.cnpj) : { sindicalizada: false };
  return {
    pronto: mp.PRONTO,
    ambiente: mp.AMBIENTE,
    public_key: mp.PRONTO ? mp.PUBLIC_KEY : null,
    cortesia_interna: Boolean(parceiro?.cortesia_interna),
    sindicalizada,
    trial_dias_cartao: TRIAL_ASSINATURA_DIAS,
    desconto_cartao_pct: Math.round(DESCONTO_CARTAO_RECORRENTE * 100),
    pix_validade_min: PIX_VALIDADE_MIN,
    planos: PLANOS_PAGOS.map(plano => ({
      plano,
      nome: PLANOS[plano].nome,
      pix: precoAssinatura(plano, sindicalizada, 'pix'),
      cartao_recorrente: precoAssinatura(plano, sindicalizada, 'cartao_recorrente'),
    })),
  };
}

async function transacao(fn) {
  const cx = await db.pool.connect();
  try {
    await cx.query('BEGIN');
    const r = await fn(cx);
    await cx.query('COMMIT');
    return r;
  } catch (err) {
    await cx.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cx.release();
  }
}

function pixDaLinha(pag) {
  return {
    pagamento_id: pag.id,
    valor: Number(pag.valor),
    status: pag.status,
    qr_code: pag.pix_qr_code,
    qr_code_base64: pag.pix_qr_code_base64,
    expires_at: pag.pix_expira_em,
  };
}

// Cria o PIX no MP pra uma linha de sindicato_pagamentos já gravada.
// Idempotency key = id da nossa linha: retry da mesma chamada nunca vira
// duas cobranças no MP.
async function gerarPixNoMp(pagamento, { plano, email, cnpj, descricao }) {
  const expira = new Date(Date.now() + PIX_VALIDADE_MIN * 60 * 1000);
  const body = {
    transaction_amount: Number(pagamento.valor),
    description: descricao || `IUB MAIS+ — ${PLANOS[plano].nome} (mensal)`,
    payment_method_id: 'pix',
    date_of_expiration: dataMp(expira),
    external_reference: referenciaExterna(pagamento.id),
    payer: {
      email,
      ...(cnpj && String(cnpj).replace(/\D/g, '').length === 14
        ? { identification: { type: 'CNPJ', number: String(cnpj).replace(/\D/g, '') } }
        : {}),
    },
    metadata: { pagamento_id: pagamento.id, assinatura_id: pagamento.assinatura_id, ambiente: mp.AMBIENTE },
    ...(NOTIFICATION_URL ? { notification_url: NOTIFICATION_URL } : {}),
  };

  let resp;
  try {
    resp = await new Payment(mp.client).create({ body, requestOptions: { idempotencyKey: `iubmais-${mp.AMBIENTE}-pix-${pagamento.id}` } });
  } catch (err) {
    console.error('[assinatura] Falha ao criar PIX no MP:', err?.status, err?.message, JSON.stringify(err?.cause || err?.error || '').slice(0, 500));
    await db.query(
      "UPDATE sindicato_pagamentos SET status = 'cancelado', status_detalhe = 'erro_criacao_mp', updated_at = NOW() WHERE id = $1",
      [pagamento.id]
    );
    throw new ErroAssinatura(502, 'ERRO_MP', 'Não foi possível gerar o PIX agora. Tente de novo em instantes.');
  }

  const tx = resp.point_of_interaction?.transaction_data || {};
  const upd = await db.query(
    `UPDATE sindicato_pagamentos
        SET mp_payment_id = $1, status_detalhe = $2, pix_qr_code = $3, pix_qr_code_base64 = $4,
            pix_expira_em = $5, data_vencimento = $5, updated_at = NOW()
      WHERE id = $6 RETURNING *`,
    [String(resp.id), resp.status_detail || null, tx.qr_code || null, tx.qr_code_base64 || null,
      resp.date_of_expiration ? new Date(resp.date_of_expiration) : expira, pagamento.id]
  );
  return upd.rows[0];
}

// Cancela no MP, sem travar o fluxo se falhar (PIX pendente que ninguém
// vai pagar só expira sozinho no MP de qualquer jeito).
async function cancelarPixNoMp(mpPaymentId) {
  if (!mpPaymentId || !mp.client) return;
  try {
    await new Payment(mp.client).cancel({ id: mpPaymentId });
  } catch (err) {
    console.warn('[assinatura] Não cancelou PIX', mpPaymentId, 'no MP:', err?.message);
  }
}

// POST /parceiro/assinatura/criar-pix — assina um plano pagando o 1º mês
// por PIX. Reaproveita o QR ainda válido se o parceiro fechou o modal e
// clicou de novo no mesmo plano.
async function iniciarAssinaturaPix({ parceiroId, email, plano }) {
  exigirPronto();
  if (!PLANOS_PAGOS.includes(plano)) throw new ErroAssinatura(400, 'PLANO_INVALIDO', 'Plano inválido');
  if (!email) throw new ErroAssinatura(400, 'SEM_EMAIL', 'Seu usuário não tem e-mail cadastrado.');

  const pr = await db.query('SELECT id, cnpj, cortesia_interna FROM sindicato_parceiros WHERE id = $1', [parceiroId]);
  const parceiro = pr.rows[0];
  if (!parceiro) throw new ErroAssinatura(404, 'NAO_ENCONTRADO', 'Parceiro não encontrado');
  if (parceiro.cortesia_interna) {
    throw new ErroAssinatura(409, 'CORTESIA', 'Sua loja tem plano de cortesia do IUB MAIS — não precisa assinar.');
  }

  const { sindicalizada } = parceiro.cnpj ? await verificarSindicalizacao(parceiro.cnpj) : { sindicalizada: false };
  const valor = precoAssinatura(plano, sindicalizada, 'pix');

  const { pagamento, reaproveitado, pixParaCancelar } = await transacao(async cx => {
    const viva = (await cx.query(
      `SELECT * FROM sindicato_assinaturas
        WHERE parceiro_id = $1 AND status IN ('aguardando_pagamento', 'trial', 'ativa', 'pausada')
        FOR UPDATE`,
      [parceiroId]
    )).rows[0];

    const cancelar = [];
    if (viva && viva.status !== 'aguardando_pagamento') {
      throw new ErroAssinatura(409, 'JA_ASSINANTE', 'Você já tem uma assinatura ativa. Veja em Minha Assinatura.', { assinatura_id: viva.id });
    }
    if (viva) {
      const pend = (await cx.query(
        `SELECT * FROM sindicato_pagamentos
          WHERE assinatura_id = $1 AND status = 'pendente' ORDER BY id DESC LIMIT 1`,
        [viva.id]
      )).rows[0];
      const aindaValido = pend?.pix_qr_code && pend.pix_expira_em && new Date(pend.pix_expira_em).getTime() - Date.now() > 2 * 60 * 1000;
      if (viva.plano_nome === plano && Number(viva.valor_mensal) === valor && aindaValido) {
        return { pagamento: pend, reaproveitado: true, pixParaCancelar: [] };
      }
      // Trocou de plano (ou o QR venceu): descarta a tentativa anterior.
      const antigos = await cx.query(
        `UPDATE sindicato_pagamentos SET status = 'cancelado', status_detalhe = 'substituido', updated_at = NOW()
          WHERE assinatura_id = $1 AND status = 'pendente' RETURNING mp_payment_id`,
        [viva.id]
      );
      cancelar.push(...antigos.rows.map(r => r.mp_payment_id).filter(Boolean));
      await cx.query("UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW() WHERE id = $1", [viva.id]);
    }

    const nova = (await cx.query(
      `INSERT INTO sindicato_assinaturas (parceiro_id, plano_nome, metodo_pagamento, valor_mensal, era_sindicalizada, status, ambiente)
       VALUES ($1, $2, 'pix', $3, $4, 'aguardando_pagamento', $5) RETURNING *`,
      [parceiroId, plano, valor, sindicalizada, mp.AMBIENTE]
    )).rows[0];
    const pag = (await cx.query(
      `INSERT INTO sindicato_pagamentos (assinatura_id, valor, metodo, status, ambiente)
       VALUES ($1, $2, 'pix', 'pendente', $3) RETURNING *`,
      [nova.id, valor, mp.AMBIENTE]
    )).rows[0];
    return { pagamento: pag, reaproveitado: false, pixParaCancelar: cancelar };
  }).catch(err => {
    // Dois cliques simultâneos: o índice único parcial barra o 2º.
    if (err.code === '23505') throw new ErroAssinatura(409, 'EM_ANDAMENTO', 'Já tem uma assinatura sendo criada — aguarde um instante e recarregue.');
    throw err;
  });

  pixParaCancelar.forEach(id => cancelarPixNoMp(id));
  if (reaproveitado) return { ...pixDaLinha(pagamento), assinatura_id: pagamento.assinatura_id, plano, reaproveitado: true };

  let comQr;
  try {
    comQr = await gerarPixNoMp(pagamento, { plano, email, cnpj: parceiro.cnpj });
  } catch (err) {
    await db.query("UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW() WHERE id = $1", [pagamento.assinatura_id]);
    throw err;
  }
  return { ...pixDaLinha(comQr), assinatura_id: pagamento.assinatura_id, plano, reaproveitado: false };
}

// POST /parceiro/assinatura/pix/renovar — próximo mês de uma assinatura
// PIX ativa (a partir de RENOVACAO_PIX_ANTECEDENCIA_DIAS antes de vencer).
async function renovarPix({ parceiroId, email }) {
  exigirPronto();
  const a = (await db.query(
    `SELECT a.*, p.cnpj FROM sindicato_assinaturas a JOIN sindicato_parceiros p ON p.id = a.parceiro_id
      WHERE a.parceiro_id = $1 AND a.status = 'ativa' AND a.metodo_pagamento = 'pix'`,
    [parceiroId]
  )).rows[0];
  if (!a) throw new ErroAssinatura(404, 'SEM_ASSINATURA_PIX', 'Você não tem assinatura PIX ativa pra renovar.');

  const liberaEm = new Date(new Date(a.acesso_ate).getTime() - RENOVACAO_PIX_ANTECEDENCIA_DIAS * 864e5);
  if (Date.now() < liberaEm.getTime()) {
    throw new ErroAssinatura(409, 'CEDO_DEMAIS', `A renovação libera em ${liberaEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`, { libera_em: liberaEm });
  }

  const pend = (await db.query(
    `SELECT * FROM sindicato_pagamentos WHERE assinatura_id = $1 AND status = 'pendente'
      AND pix_qr_code IS NOT NULL AND pix_expira_em > NOW() + INTERVAL '2 minutes' ORDER BY id DESC LIMIT 1`,
    [a.id]
  )).rows[0];
  if (pend) return { ...pixDaLinha(pend), assinatura_id: a.id, plano: a.plano_nome, reaproveitado: true };

  const pag = (await db.query(
    `INSERT INTO sindicato_pagamentos (assinatura_id, valor, metodo, status, ambiente)
     VALUES ($1, $2, 'pix', 'pendente', $3) RETURNING *`,
    [a.id, a.valor_mensal, mp.AMBIENTE]
  )).rows[0];
  const comQr = await gerarPixNoMp(pag, { plano: a.plano_nome, email, cnpj: a.cnpj, descricao: `IUB MAIS+ — ${PLANOS[a.plano_nome].nome} (renovação mensal)` });
  return { ...pixDaLinha(comQr), assinatura_id: a.id, plano: a.plano_nome, reaproveitado: false };
}

// Grava o plano no parceiro (mesmas colunas que o admin grava em
// sindicatoPlanosController.alterarPlano, incluindo a promoção Pioneiro).
// Só registra histórico quando o plano MUDA — renovação fica em
// sindicato_pagamentos.
async function aplicarPlanoNoParceiro(cx, assinatura, acessoAte) {
  const atual = (await cx.query('SELECT plano, e_pioneiro FROM sindicato_parceiros WHERE id = $1 FOR UPDATE', [assinatura.parceiro_id])).rows[0];
  const mudou = atual.plano !== assinatura.plano_nome;
  let virouPioneiro = false;
  if (mudou && atual.plano === 'gratis' && !atual.e_pioneiro) {
    const n = (await cx.query('SELECT COUNT(*)::int AS n FROM sindicato_parceiros WHERE e_pioneiro = true')).rows[0].n;
    virouPioneiro = n < PIONEIRO_VAGAS_TOTAL;
  }
  await cx.query(
    `UPDATE sindicato_parceiros
        SET plano = $1, plano_expira_em = $2, plano_status = 'ativo',
            plano_ativo_desde = CASE WHEN $3 THEN NOW() ELSE plano_ativo_desde END,
            plano_iniciado_em = CASE WHEN $3 THEN NOW() ELSE plano_iniciado_em END,
            plano_preco_cobrado = $4, plano_era_sindicalizada = $5,
            e_pioneiro = e_pioneiro OR $6
      WHERE id = $7`,
    [assinatura.plano_nome, acessoAte, mudou, assinatura.valor_mensal, assinatura.era_sindicalizada, virouPioneiro, assinatura.parceiro_id]
  );
  if (mudou) {
    await cx.query(
      `INSERT INTO sindicato_plano_historico (parceiro_id, plano_anterior, plano_novo, motivo, observacoes, alterado_por, preco_cobrado, era_sindicalizada)
       VALUES ($1, $2, $3, 'assinatura_ativa', $4, 'mercado_pago', $5, $6)`,
      [assinatura.parceiro_id, atual.plano, assinatura.plano_nome, `Assinatura #${assinatura.id} (${assinatura.metodo_pagamento})`,
        assinatura.valor_mensal, assinatura.era_sindicalizada]
    );
  }
  return { mudou, virouPioneiro, planoAnterior: atual.plano };
}

// Núcleo idempotente: recebe o pagamento JÁ reconsultado na API do MP.
// Retorna { resultado, ... } pra log (sindicato_mp_eventos).
async function processarPagamentoMp(mpPay) {
  const ref = lerReferenciaExterna(mpPay.external_reference);
  if (!ref) return { resultado: 'ignorado', motivo: 'external_reference de fora do IUB MAIS' };
  if (ref.ambiente !== mp.AMBIENTE) return { resultado: 'ignorado', motivo: `pagamento de ${ref.ambiente}, servidor em ${mp.AMBIENTE}` };

  const efeitos = [];
  const saida = await transacao(async cx => {
    const pag = (await cx.query('SELECT * FROM sindicato_pagamentos WHERE id = $1 FOR UPDATE', [ref.pagamentoId])).rows[0];
    if (!pag) return { resultado: 'ignorado', motivo: `pagamento local ${ref.pagamentoId} não existe` };
    if (pag.mp_payment_id && pag.mp_payment_id !== String(mpPay.id)) {
      return { resultado: 'ignorado', motivo: `mp_payment_id diferente (${pag.mp_payment_id} x ${mpPay.id})` };
    }
    const assinatura = (await cx.query('SELECT * FROM sindicato_assinaturas WHERE id = $1 FOR UPDATE', [pag.assinatura_id])).rows[0];
    const novo = statusLocal(mpPay);

    if (pag.status === novo) return { resultado: 'sem_mudanca', status: novo };
    if (pag.status === 'aprovado' && novo === 'pendente') return { resultado: 'sem_mudanca', status: pag.status };

    await cx.query(
      `UPDATE sindicato_pagamentos
          SET status = $1, status_detalhe = $2, mp_payment_id = COALESCE(mp_payment_id, $3),
              data_pagamento = COALESCE($4, data_pagamento), updated_at = NOW()
        WHERE id = $5`,
      [novo, mpPay.status_detail || null, String(mpPay.id), mpPay.date_approved ? new Date(mpPay.date_approved) : null, pag.id]
    );

    if (novo === 'aprovado') {
      // Valor pago menor que o cobrado = não ativa (não deveria acontecer
      // com PIX gerado por nós; fica no log pra olhar à mão).
      if (Number(mpPay.transaction_amount) + 0.001 < Number(pag.valor)) {
        return { resultado: 'requer_atencao', motivo: `valor pago ${mpPay.transaction_amount} < cobrado ${pag.valor}` };
      }
      // Renovação soma a partir do fim do período atual (pagou adiantado
      // não perde dias); 1ª vez ou já vencida começa agora.
      const per = (await cx.query(
        `SELECT GREATEST(NOW(), COALESCE($1::timestamptz, NOW())) AS inicio,
                GREATEST(NOW(), COALESCE($1::timestamptz, NOW())) + INTERVAL '1 month' AS fim`,
        [assinatura.status === 'ativa' ? assinatura.acesso_ate : null]
      )).rows[0];
      await cx.query('UPDATE sindicato_pagamentos SET periodo_inicio = $1, periodo_fim = $2 WHERE id = $3', [per.inicio, per.fim, pag.id]);
      const renovacao = assinatura.status === 'ativa';
      await cx.query(
        `UPDATE sindicato_assinaturas
            SET status = 'ativa', acesso_ate = $1, data_proxima_cobranca = $1,
                ultimo_lembrete_tipo = NULL, ultimo_lembrete_em = NULL, updated_at = NOW()
          WHERE id = $2`,
        [per.fim, assinatura.id]
      );
      const plano = await aplicarPlanoNoParceiro(cx, assinatura, per.fim);
      efeitos.push({ tipo: 'email_confirmado', assinatura, valor: pag.valor, acessoAte: per.fim, renovacao });
      return { resultado: 'processado', status: novo, assinatura_id: assinatura.id, acesso_ate: per.fim, renovacao, ...plano };
    }

    if (['expirado', 'cancelado', 'rejeitado'].includes(novo) && assinatura.status === 'aguardando_pagamento') {
      const outroPendente = (await cx.query(
        "SELECT 1 FROM sindicato_pagamentos WHERE assinatura_id = $1 AND id <> $2 AND status = 'pendente' LIMIT 1",
        [assinatura.id, pag.id]
      )).rows[0];
      if (!outroPendente) {
        await cx.query("UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW() WHERE id = $1", [assinatura.id]);
      }
    }
    // Estorno/chargeback de pagamento já aprovado: marca e deixa pra
    // decisão manual (não derruba o plano sozinho nesta fase).
    if (novo === 'reembolsado') return { resultado: 'requer_atencao', status: novo, motivo: 'pagamento estornado' };
    return { resultado: 'processado', status: novo };
  });

  for (const e of efeitos) {
    if (e.tipo !== 'email_confirmado') continue;
    contatoDoParceiro(e.assinatura.parceiro_id).then(c => c?.email && emailService.enviarPagamentoAssinaturaConfirmado({
      nome: c.nome, nomeFantasia: c.nome, email: c.email, plano: e.assinatura.plano_nome, valor: e.valor,
      metodo: e.assinatura.metodo_pagamento, acessoAte: e.acessoAte, renovacao: e.renovacao,
    })).catch(err => console.error('[assinatura] e-mail de confirmação falhou:', err.message));
  }
  return saida;
}

async function buscarPagamentoMp(mpPaymentId) {
  return new Payment(mp.client).get({ id: mpPaymentId });
}

// Polling da tela do QR: consulta o MP direto (no máximo a cada 5s por
// pagamento) — o plano ativa mesmo se o webhook atrasar ou não estiver
// configurado ainda.
const ultimaConsulta = new Map();
async function sincronizarPagamento({ parceiroId, pagamentoId }) {
  const q = () => db.query(
    `SELECT pg.*, a.status AS assinatura_status, a.plano_nome, a.acesso_ate
       FROM sindicato_pagamentos pg JOIN sindicato_assinaturas a ON a.id = pg.assinatura_id
      WHERE pg.id = $1 AND a.parceiro_id = $2`,
    [pagamentoId, parceiroId]
  );
  let row = (await q()).rows[0];
  if (!row) throw new ErroAssinatura(404, 'NAO_ENCONTRADO', 'Pagamento não encontrado');

  const agora = Date.now();
  if (row.status === 'pendente' && row.mp_payment_id && mp.client && agora - (ultimaConsulta.get(row.id) || 0) > 5000) {
    ultimaConsulta.set(row.id, agora);
    try {
      await processarPagamentoMp(await buscarPagamentoMp(row.mp_payment_id));
      row = (await q()).rows[0];
    } catch (err) {
      console.warn('[assinatura] polling: não consultou o MP agora:', err?.message);
    }
  }
  return {
    pagamento_id: row.id,
    status: row.status,
    assinatura_status: row.assinatura_status,
    plano: row.plano_nome,
    acesso_ate: row.acesso_ate,
    expires_at: row.pix_expira_em,
  };
}

// GET /parceiro/assinatura/minha
async function minhaAssinatura(parceiroId) {
  const a = (await db.query(
    `SELECT * FROM sindicato_assinaturas WHERE parceiro_id = $1
      ORDER BY (status IN ('aguardando_pagamento', 'trial', 'ativa', 'pausada')) DESC, created_at DESC LIMIT 1`,
    [parceiroId]
  )).rows[0];
  if (!a) return { assinatura: null, pagamentos: [], pix_pendente: null };

  const pagamentos = (await db.query(
    `SELECT pg.id, pg.valor, pg.metodo, pg.status, pg.data_pagamento, pg.periodo_inicio, pg.periodo_fim, pg.created_at
       FROM sindicato_pagamentos pg JOIN sindicato_assinaturas s ON s.id = pg.assinatura_id
      WHERE s.parceiro_id = $1 AND pg.status IN ('aprovado', 'reembolsado', 'rejeitado')
      ORDER BY pg.created_at DESC LIMIT 6`,
    [parceiroId]
  )).rows;
  const pend = (await db.query(
    `SELECT * FROM sindicato_pagamentos WHERE assinatura_id = $1 AND status = 'pendente'
      AND pix_qr_code IS NOT NULL AND pix_expira_em > NOW() ORDER BY id DESC LIMIT 1`,
    [a.id]
  )).rows[0];

  const renovacaoLiberaEm = a.metodo_pagamento === 'pix' && a.acesso_ate
    ? new Date(new Date(a.acesso_ate).getTime() - RENOVACAO_PIX_ANTECEDENCIA_DIAS * 864e5) : null;
  return {
    assinatura: {
      id: a.id, plano: a.plano_nome, plano_nome: PLANOS[a.plano_nome]?.nome, metodo: a.metodo_pagamento,
      valor_mensal: Number(a.valor_mensal), status: a.status, trial_ate: a.trial_ate, data_inicio: a.data_inicio,
      acesso_ate: a.acesso_ate, data_proxima_cobranca: a.data_proxima_cobranca, data_cancelamento: a.data_cancelamento,
      ambiente: a.ambiente,
      renovacao_pix_libera_em: renovacaoLiberaEm,
      pode_renovar_pix: a.status === 'ativa' && a.metodo_pagamento === 'pix' && renovacaoLiberaEm && Date.now() >= renovacaoLiberaEm.getTime(),
    },
    pagamentos: pagamentos.map(p => ({ ...p, valor: Number(p.valor) })),
    pix_pendente: pend ? pixDaLinha(pend) : null,
  };
}

// Rotina diária (Render Cron Job -> POST /api/interno/assinaturas/rotina).
// Idempotente: rodar 2x no mesmo dia não duplica e-mail nem histórico.
async function rotinaDiaria() {
  const res = { planos_encerrados: 0, assinaturas_vencidas: 0, lembretes_pix: 0, pix_expirados: 0, assinaturas_abandonadas: 0, erros: [] };

  // 1. Período pago acabou -> assinatura 'vencida' (PIX não renovado).
  //    Cancelada continua 'cancelada' (só perde o acesso).
  res.assinaturas_vencidas = (await db.query(
    `UPDATE sindicato_assinaturas SET status = 'vencida', updated_at = NOW()
      WHERE status = 'ativa' AND acesso_ate IS NOT NULL AND acesso_ate <= NOW()`
  )).rowCount;

  // 2. Plano pago com prazo vencido volta pro Grátis NO BANCO (o acesso já
  //    tinha caído na hora via planoEfetivo). Cortesia nunca.
  const vencidos = (await db.query(
    `SELECT id, plano FROM sindicato_parceiros
      WHERE plano <> 'gratis' AND NOT cortesia_interna AND plano_expira_em IS NOT NULL AND plano_expira_em <= NOW()`
  )).rows;
  for (const p of vencidos) {
    try {
      const temAssinatura = await transacao(async cx => {
        const r = await cx.query(
          `UPDATE sindicato_parceiros SET plano = 'gratis', plano_ativo_desde = NOW(), plano_preco_cobrado = NULL, plano_era_sindicalizada = NULL
            WHERE id = $1 AND plano = $2 AND NOT cortesia_interna AND plano_expira_em <= NOW()`,
          [p.id, p.plano]
        );
        if (!r.rowCount) return null;
        const a = (await cx.query('SELECT id FROM sindicato_assinaturas WHERE parceiro_id = $1 ORDER BY created_at DESC LIMIT 1', [p.id])).rows[0];
        await cx.query(
          `INSERT INTO sindicato_plano_historico (parceiro_id, plano_anterior, plano_novo, motivo, observacoes, alterado_por)
           VALUES ($1, $2, 'gratis', $3, $4, 'rotina_assinaturas')`,
          [p.id, p.plano, a ? 'assinatura_encerrada' : 'downgrade', a ? `Fim do período pago da assinatura #${a.id}` : 'Prazo do plano (plano_expira_em) terminou']
        );
        return true;
      });
      if (temAssinatura === null) continue;
      res.planos_encerrados++;
      const c = await contatoDoParceiro(p.id);
      if (c?.email) {
        emailService.enviarPlanoExpirado({ nome: c.nome, nomeFantasia: c.nome, email: c.email, planoAnterior: p.plano })
          .catch(err => console.error('[assinatura] e-mail de plano expirado falhou:', err.message));
      }
    } catch (err) {
      res.erros.push(`parceiro ${p.id}: ${err.message}`);
    }
  }

  // 3. Lembrete de renovar o PIX (uma vez por período: a chave do lembrete
  //    leva a data de fim do período).
  const aVencer = (await db.query(
    `SELECT a.*, TO_CHAR(a.acesso_ate AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS fim_dia
       FROM sindicato_assinaturas a JOIN sindicato_parceiros p ON p.id = a.parceiro_id
      WHERE a.status = 'ativa' AND a.metodo_pagamento = 'pix' AND NOT p.cortesia_interna
        AND a.acesso_ate > NOW() AND a.acesso_ate <= NOW() + ($1 || ' days')::interval`,
    [String(LEMBRETE_PIX_DIAS)]
  )).rows;
  for (const a of aVencer) {
    const chave = `pix_renovar:${a.fim_dia}`;
    if (a.ultimo_lembrete_tipo === chave) continue;
    try {
      const c = await contatoDoParceiro(a.parceiro_id);
      if (c?.email) await emailService.enviarPlanoExpirandoBreve({ nome: c.nome, nomeFantasia: c.nome, email: c.email, plano: a.plano_nome, dataExpiracao: a.acesso_ate });
      await db.query('UPDATE sindicato_assinaturas SET ultimo_lembrete_tipo = $1, ultimo_lembrete_em = NOW() WHERE id = $2', [chave, a.id]);
      res.lembretes_pix++;
    } catch (err) {
      res.erros.push(`lembrete assinatura ${a.id}: ${err.message}`);
    }
  }

  // 4. Limpeza: PIX pendente vencido há mais de 1h e primeira assinatura
  //    PIX nunca paga há mais de 1 dia.
  res.pix_expirados = (await db.query(
    `UPDATE sindicato_pagamentos SET status = 'expirado', status_detalhe = COALESCE(status_detalhe, 'expirado_rotina'), updated_at = NOW()
      WHERE status = 'pendente' AND metodo = 'pix' AND pix_expira_em < NOW() - INTERVAL '1 hour'`
  )).rowCount;
  res.assinaturas_abandonadas = (await db.query(
    `UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW()
      WHERE status = 'aguardando_pagamento' AND created_at < NOW() - INTERVAL '1 day'`
  )).rowCount;

  return res;
}

module.exports = {
  ErroAssinatura,
  opcoesDoParceiro,
  iniciarAssinaturaPix,
  renovarPix,
  processarPagamentoMp,
  buscarPagamentoMp,
  sincronizarPagamento,
  minhaAssinatura,
  rotinaDiaria,
  // exportados pra teste
  lerReferenciaExterna,
  statusLocal,
  dataMp,
  PIX_VALIDADE_MIN,
};
