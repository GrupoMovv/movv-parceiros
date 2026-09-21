const { Payment, PreApproval } = require('mercadopago');
const db = require('../config/database');
const mp = require('../config/mercadopago');
const { PLANOS, PLANOS_PAGOS, PIONEIRO_VAGAS_TOTAL, precoAssinatura, TRIAL_ASSINATURA_DIAS, DESCONTO_CARTAO_RECORRENTE, planoEfetivo } = require('../config/planos');
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
// Cartão: o MP cobra no fim do período e retenta cobrança recusada por
// alguns dias. O plano segue valendo CARENCIA_CARTAO_DIAS além do período
// pra não cair entre a data da cobrança e o webhook/retentativa chegarem.
const CARENCIA_CARTAO_DIAS = 3;
const URL_MINHA_ASSINATURA = `${(process.env.FRONTEND_URL || 'https://portal.grupomovv.com.br').replace(/\/$/, '')}/parceiro/painel/minha-assinatura`;

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
function referenciaAssinatura(assinaturaId) {
  return `iubmais:${mp.AMBIENTE}:ass:${assinaturaId}`;
}
function lerReferenciaExterna(ref) {
  const m = /^iubmais:(test|prod):(pag|ass):(\d+)$/.exec(String(ref || ''));
  return m ? { ambiente: m[1], tipo: m[2], id: Number(m[3]) } : null;
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
    trial_disponivel: await trialDisponivel(parceiroId),
    credito_troca: await creditoTrocaDePlano(parceiroId).then(c => c && {
      ate: c.ate, plano_anterior: c.planoAnterior, plano_anterior_nome: PLANOS[c.planoAnterior]?.nome, janela_ate: c.janelaAte,
    }),
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

  await cancelarCartoesSoltos(parceiroId);
  const credito = await creditoTrocaDePlano(parceiroId);
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
      `INSERT INTO sindicato_assinaturas (parceiro_id, plano_nome, metodo_pagamento, valor_mensal, era_sindicalizada, status, ambiente,
         origem_credito_id, credito_ate)
       VALUES ($1, $2, 'pix', $3, $4, 'aguardando_pagamento', $5, $6, $7) RETURNING *`,
      [parceiroId, plano, valor, sindicalizada, mp.AMBIENTE, credito?.assinaturaId || null, credito?.ate || null]
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
async function aplicarPlanoNoParceiro(cx, assinatura, planoExpiraEm, motivo = 'assinatura_ativa') {
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
    [assinatura.plano_nome, planoExpiraEm, mudou, assinatura.valor_mensal, assinatura.era_sindicalizada, virouPioneiro, assinatura.parceiro_id]
  );
  if (mudou) {
    await cx.query(
      `INSERT INTO sindicato_plano_historico (parceiro_id, plano_anterior, plano_novo, motivo, observacoes, alterado_por, preco_cobrado, era_sindicalizada)
       VALUES ($1, $2, $3, $4, $5, 'mercado_pago', $6, $7)`,
      [assinatura.parceiro_id, atual.plano, assinatura.plano_nome, motivo, `Assinatura #${assinatura.id} (${assinatura.metodo_pagamento})`,
        assinatura.valor_mensal, assinatura.era_sindicalizada]
    );
  }
  return { mudou, virouPioneiro, planoAnterior: atual.plano };
}

// Núcleo idempotente: recebe o pagamento JÁ reconsultado na API do MP.
// Retorna { resultado, ... } pra log (sindicato_mp_eventos).
async function processarPagamentoMp(mpPay) {
  const ref = lerReferenciaExterna(mpPay.external_reference);
  // Cobrança recorrente do cartão: o pagamento carrega a referência da
  // ASSINATURA (ou o id da preapproval) em vez da de um pagamento nosso.
  const subscriptionId = mpPay.metadata?.preapproval_id || mpPay.point_of_interaction?.transaction_data?.subscription_id || null;
  if (ref?.tipo === 'ass' || (!ref && subscriptionId)) {
    if (ref && ref.ambiente !== mp.AMBIENTE) return { resultado: 'ignorado', motivo: `pagamento de ${ref.ambiente}, servidor em ${mp.AMBIENTE}` };
    return registrarCobrancaCartao({
      assinaturaId: ref?.tipo === 'ass' ? ref.id : null, subscriptionId,
      mpPaymentId: mpPay.id, status: statusLocal(mpPay), statusDetalhe: mpPay.status_detail,
      valor: mpPay.transaction_amount, dataAprovacao: mpPay.date_approved,
    });
  }
  if (!ref) return { resultado: 'ignorado', motivo: 'external_reference de fora do IUB MAIS' };
  if (ref.ambiente !== mp.AMBIENTE) return { resultado: 'ignorado', motivo: `pagamento de ${ref.ambiente}, servidor em ${mp.AMBIENTE}` };

  const efeitos = [];
  const saida = await transacao(async cx => {
    const pag = (await cx.query('SELECT * FROM sindicato_pagamentos WHERE id = $1 FOR UPDATE', [ref.id])).rows[0];
    if (!pag) return { resultado: 'ignorado', motivo: `pagamento local ${ref.id} não existe` };
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
        // 1º PIX de uma troca de plano: o mês começa depois dos dias já
        // pagos da assinatura anterior (credito_ate) — nada cobrado 2x.
        [assinatura.status === 'ativa' ? assinatura.acesso_ate : assinatura.credito_ate]
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
  const parceiro = (await db.query(
    'SELECT plano, plano_expira_em, cortesia_interna FROM sindicato_parceiros WHERE id = $1', [parceiroId]
  )).rows[0];
  const base = {
    cortesia_interna: Boolean(parceiro?.cortesia_interna),
    plano_atual: planoEfetivo(parceiro),
    plano_atual_nome: PLANOS[planoEfetivo(parceiro)]?.nome,
  };

  const a = (await db.query(
    `SELECT * FROM sindicato_assinaturas WHERE parceiro_id = $1
      ORDER BY (status IN ('aguardando_pagamento', 'trial', 'ativa', 'pausada')) DESC, created_at DESC LIMIT 1`,
    [parceiroId]
  )).rows[0];
  if (!a) return { ...base, assinatura: null, pagamentos: [], pix_pendente: null };

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

  const viva = ['aguardando_pagamento', 'trial', 'ativa', 'pausada'].includes(a.status);
  const renovacaoLiberaEm = a.metodo_pagamento === 'pix' && a.acesso_ate
    ? new Date(new Date(a.acesso_ate).getTime() - RENOVACAO_PIX_ANTECEDENCIA_DIAS * 864e5) : null;
  const trialDiasRestantes = a.status === 'trial' && a.trial_ate
    ? Math.max(0, Math.ceil((new Date(a.trial_ate).getTime() - Date.now()) / 864e5)) : null;
  return {
    ...base,
    assinatura: {
      id: a.id, plano: a.plano_nome, plano_nome: PLANOS[a.plano_nome]?.nome, metodo: a.metodo_pagamento,
      valor_mensal: Number(a.valor_mensal), status: a.status, trial_ate: a.trial_ate, trial_dias_restantes: trialDiasRestantes,
      data_inicio: a.data_inicio, acesso_ate: a.acesso_ate, data_proxima_cobranca: a.data_proxima_cobranca,
      data_cancelamento: a.data_cancelamento, ambiente: a.ambiente,
      cartao_bandeira: a.cartao_bandeira, cartao_final: a.cartao_final,
      // Veio de troca de plano: o "trial" são dias já pagos do plano anterior.
      credito: Boolean(a.origem_credito_id && a.credito_ate), credito_ate: a.credito_ate,
      renovacao_pix_libera_em: renovacaoLiberaEm,
      pode_renovar_pix: a.status === 'ativa' && a.metodo_pagamento === 'pix' && renovacaoLiberaEm && Date.now() >= renovacaoLiberaEm.getTime(),
      pode_cancelar: viva,
    },
    pagamentos: pagamentos.map(p => ({ ...p, valor: Number(p.valor) })),
    pix_pendente: pend ? pixDaLinha(pend) : null,
  };
}

// ---------------------------------------------------------------------------
// Cartão recorrente (fase C): preapproval do MP com free_trial de 7 dias.
// O cartão é tokenizado no navegador (Bricks) — aqui só chega o token.
// ---------------------------------------------------------------------------

// Troca de plano sem cobrança em dobro: cancelou há menos de
// JANELA_TROCA_HORAS e ainda tem dias pagos (ou de trial) -> a próxima
// assinatura aproveita esses dias. "ate" nunca passa da data original:
// se a origem já era um crédito ainda não pago, vale o credito_ate dela
// (trocar várias vezes seguidas não cria dia extra).
const JANELA_TROCA_HORAS = 24;
async function creditoTrocaDePlano(parceiroId, cx = db) {
  const r = (await cx.query(
    `SELECT a.id, a.plano_nome, a.data_cancelamento,
            CASE WHEN a.credito_ate IS NOT NULL AND NOT EXISTS (
                   SELECT 1 FROM sindicato_pagamentos p WHERE p.assinatura_id = a.id AND p.status = 'aprovado')
                 THEN LEAST(a.acesso_ate, a.credito_ate) ELSE a.acesso_ate END AS ate
       FROM sindicato_assinaturas a
      WHERE a.parceiro_id = $1 AND a.status = 'cancelada' AND a.ambiente = $2 AND a.acesso_ate IS NOT NULL
        AND a.data_cancelamento >= NOW() - ($3 || ' hours')::interval
        -- Crédito "gasto" = uma assinatura nova que chegou a DAR ACESSO com
        -- ele (trial de cartão ou PIX pago). PIX aguardando/abandonado não
        -- gasta: acesso_ate dele é NULL até pagar.
        AND NOT EXISTS (
          SELECT 1 FROM sindicato_assinaturas n
           WHERE n.origem_credito_id = a.id AND n.acesso_ate IS NOT NULL)
      ORDER BY a.data_cancelamento DESC LIMIT 1`,
    [parceiroId, mp.AMBIENTE, String(JANELA_TROCA_HORAS)]
  )).rows[0];
  if (!r || new Date(r.ate).getTime() < Date.now() + 3600 * 1000) return null; // menos de 1h: não vale a pena
  return { assinaturaId: r.id, ate: r.ate, planoAnterior: r.plano_nome, janelaAte: new Date(new Date(r.data_cancelamento).getTime() + JANELA_TROCA_HORAS * 3600 * 1000) };
}

// Trial de 7 dias é UMA vez por parceiro (cancelar e assinar de novo não
// ganha outro trial). Só conta trial que chegou a existir no MP
// (mp_subscription_id): tentativa com cartão recusado não consome o trial.
async function trialDisponivel(parceiroId) {
  const r = await db.query(
    'SELECT 1 FROM sindicato_assinaturas WHERE parceiro_id = $1 AND trial_ate IS NOT NULL AND mp_subscription_id IS NOT NULL LIMIT 1',
    [parceiroId]
  );
  return !r.rows[0];
}

// Endpoints do MP que o SDK não cobre (authorized_payments).
async function mpApiGet(caminho) {
  const r = await fetch(`https://api.mercadopago.com${caminho}`, {
    headers: { Authorization: `Bearer ${process.env[`MP_ACCESS_TOKEN_${mp.AMBIENTE === 'prod' ? 'PROD' : 'TEST'}`]}` },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const erro = new Error(`MP ${caminho} -> ${r.status} ${corpo.message || ''}`);
    erro.status = r.status;
    throw erro;
  }
  return corpo;
}

async function cancelarPreapprovalNoMp(subscriptionId) {
  await new PreApproval(mp.client).update({ id: subscriptionId, body: { status: 'cancelled' } });
}

// Assinatura de cartão que venceu (cobrança falhou até depois da carência)
// continua "authorized" no MP e poderia cobrar de novo depois — antes de o
// parceiro assinar outra vez, solta essas no MP pra nunca cobrar dobrado.
async function cancelarCartoesSoltos(parceiroId) {
  if (!mp.client) return;
  const soltas = (await db.query(
    `SELECT id, mp_subscription_id FROM sindicato_assinaturas
      WHERE parceiro_id = $1 AND metodo_pagamento = 'cartao_recorrente' AND status = 'vencida' AND mp_subscription_id IS NOT NULL`,
    [parceiroId]
  )).rows;
  for (const s of soltas) {
    try {
      await cancelarPreapprovalNoMp(s.mp_subscription_id);
      await db.query("UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW() WHERE id = $1", [s.id]);
    } catch (err) {
      console.warn('[assinatura] não soltou preapproval', s.mp_subscription_id, err?.message);
    }
  }
}

// Mensagem amigável pra recusa do MP na criação (cartão inválido, dados
// errados etc.) — o erro técnico vai pro log.
function erroCartaoMp(err) {
  const bruto = JSON.stringify(err?.cause || err?.error || err?.message || '').toLowerCase();
  console.error('[assinatura] MP recusou a assinatura de cartão:', err?.status, bruto.slice(0, 500));
  if (err?.status >= 500 || !err?.status) {
    return new ErroAssinatura(502, 'ERRO_MP', 'O Mercado Pago não respondeu agora. Tente de novo em instantes.');
  }
  if (bruto.includes('payer') && bruto.includes('email')) {
    return new ErroAssinatura(422, 'EMAIL_PAGADOR', 'O e-mail informado não foi aceito pelo Mercado Pago. Confira e tente de novo.');
  }
  return new ErroAssinatura(422, 'CARTAO_RECUSADO', 'Não foi possível validar esse cartão. Confira os dados ou use outro cartão.');
}

// POST /parceiro/assinatura/criar-cartao-recorrente
async function iniciarAssinaturaCartao({ parceiroId, plano, cardToken, payerEmail, bandeira, final4 }) {
  exigirPronto();
  if (!PLANOS_PAGOS.includes(plano)) throw new ErroAssinatura(400, 'PLANO_INVALIDO', 'Plano inválido');
  if (typeof cardToken !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(cardToken)) {
    throw new ErroAssinatura(400, 'TOKEN_INVALIDO', 'Dados do cartão inválidos. Preencha o cartão de novo.');
  }
  const email = String(payerEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroAssinatura(400, 'EMAIL_INVALIDO', 'Informe um e-mail válido.');

  const parceiro = (await db.query('SELECT id, cnpj, cortesia_interna FROM sindicato_parceiros WHERE id = $1', [parceiroId])).rows[0];
  if (!parceiro) throw new ErroAssinatura(404, 'NAO_ENCONTRADO', 'Parceiro não encontrado');
  if (parceiro.cortesia_interna) {
    throw new ErroAssinatura(409, 'CORTESIA', 'Sua loja tem plano de cortesia do IUB MAIS — não precisa assinar.');
  }

  await cancelarCartoesSoltos(parceiroId);
  const comTrial = await trialDisponivel(parceiroId);
  const credito = await creditoTrocaDePlano(parceiroId);
  const { sindicalizada } = parceiro.cnpj ? await verificarSindicalizacao(parceiro.cnpj) : { sindicalizada: false };
  const valor = precoAssinatura(plano, sindicalizada, 'cartao_recorrente');

  // Dias sem cobrança = o maior entre o trial (1ª assinatura de cartão) e
  // os dias já pagos da assinatura cancelada há pouco (troca de plano).
  // O MP conta free_trial em dias inteiros: arredonda pra CIMA (nunca
  // cobra antes de acabar o que já foi pago).
  const agoraMs = Date.now();
  const fimTrialMs = comTrial ? agoraMs + TRIAL_ASSINATURA_DIAS * 864e5 : 0;
  const fimCreditoMs = credito ? new Date(credito.ate).getTime() : 0;
  const diasGratis = Math.max(fimTrialMs, fimCreditoMs) > agoraMs ? Math.ceil((Math.max(fimTrialMs, fimCreditoMs) - agoraMs) / 864e5) : 0;
  const gratisAte = diasGratis ? new Date(agoraMs + diasGratis * 864e5) : null;
  const porCredito = Boolean(credito) && fimCreditoMs >= fimTrialMs;

  const { assinatura, pixParaCancelar } = await transacao(async cx => {
    const viva = (await cx.query(
      `SELECT * FROM sindicato_assinaturas
        WHERE parceiro_id = $1 AND status IN ('aguardando_pagamento', 'trial', 'ativa', 'pausada') FOR UPDATE`,
      [parceiroId]
    )).rows[0];
    const cancelar = [];
    if (viva && viva.status !== 'aguardando_pagamento') {
      throw new ErroAssinatura(409, 'JA_ASSINANTE', 'Você já tem uma assinatura ativa. Veja em Minha Assinatura.', { assinatura_id: viva.id });
    }
    if (viva) {
      // Tinha um PIX em aberto e preferiu cartão: descarta o PIX.
      const antigos = await cx.query(
        `UPDATE sindicato_pagamentos SET status = 'cancelado', status_detalhe = 'substituido', updated_at = NOW()
          WHERE assinatura_id = $1 AND status = 'pendente' RETURNING mp_payment_id`,
        [viva.id]
      );
      cancelar.push(...antigos.rows.map(r => r.mp_payment_id).filter(Boolean));
      await cx.query("UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW() WHERE id = $1", [viva.id]);
    }
    const nova = (await cx.query(
      `INSERT INTO sindicato_assinaturas
         (parceiro_id, plano_nome, metodo_pagamento, valor_mensal, era_sindicalizada, status, trial_ate, ambiente,
          mp_payer_email, cartao_bandeira, cartao_final, origem_credito_id, credito_ate)
       VALUES ($1, $2, 'cartao_recorrente', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [parceiroId, plano, valor, sindicalizada, gratisAte ? 'trial' : 'aguardando_pagamento',
        gratisAte, mp.AMBIENTE,
        email, String(bandeira || '').slice(0, 30) || null, /^\d{4}$/.test(String(final4 || '')) ? String(final4) : null,
        credito?.assinaturaId || null, credito?.ate || null]
    )).rows[0];
    return { assinatura: nova, pixParaCancelar: cancelar };
  }).catch(err => {
    if (err.code === '23505') throw new ErroAssinatura(409, 'EM_ANDAMENTO', 'Já tem uma assinatura sendo criada — aguarde um instante e recarregue.');
    throw err;
  });
  pixParaCancelar.forEach(id => cancelarPixNoMp(id));

  const body = {
    reason: `IUB MAIS+ — ${PLANOS[plano].nome}`,
    external_reference: referenciaAssinatura(assinatura.id),
    payer_email: email,
    card_token_id: cardToken,
    back_url: URL_MINHA_ASSINATURA,
    status: 'authorized',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: valor,
      currency_id: 'BRL',
      ...(diasGratis ? { free_trial: { frequency: diasGratis, frequency_type: 'days' } } : {}),
    },
  };

  let resp;
  try {
    resp = await new PreApproval(mp.client).create({ body, requestOptions: { idempotencyKey: `iubmais-${mp.AMBIENTE}-ass-${assinatura.id}` } });
  } catch (err) {
    await db.query("UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW() WHERE id = $1", [assinatura.id]);
    throw erroCartaoMp(err);
  }

  const proxima = resp.next_payment_date ? new Date(resp.next_payment_date) : assinatura.trial_ate;
  const final = await transacao(async cx => {
    const upd = (await cx.query(
      `UPDATE sindicato_assinaturas
          SET mp_subscription_id = $1, mp_customer_id = $2, data_proxima_cobranca = $3,
              acesso_ate = CASE WHEN status = 'trial' THEN trial_ate ELSE acesso_ate END, updated_at = NOW()
        WHERE id = $4 RETURNING *`,
      [String(resp.id), resp.payer_id ? String(resp.payer_id) : null, proxima, assinatura.id]
    )).rows[0];
    // Trial/crédito: libera o plano JÁ, até o fim dos dias grátis (+
    // carência pra a 1ª cobrança chegar). Sem: ativa na 1ª cobrança.
    if (gratisAte) {
      await aplicarPlanoNoParceiro(cx, upd, new Date(new Date(upd.trial_ate).getTime() + CARENCIA_CARTAO_DIAS * 864e5), 'assinatura_trial');
    }
    return upd;
  });

  if (gratisAte) {
    contatoDoParceiro(parceiroId).then(c => c?.email && emailService.enviarTrialAtivado({
      nome: c.nome, nomeFantasia: c.nome, email: c.email, plano, valor, trialAte: final.trial_ate, credito: porCredito,
    })).catch(err => console.error('[assinatura] e-mail de trial falhou:', err.message));
  }

  return {
    assinatura_id: final.id,
    subscription_id: final.mp_subscription_id,
    status: final.status,
    trial: Boolean(gratisAte) && !porCredito,
    credito: porCredito,
    dias_gratis: diasGratis,
    trial_ate: final.trial_ate,
    primeira_cobranca: final.data_proxima_cobranca,
    valor,
    plano,
  };
}

// Cobrança recorrente do cartão (webhook subscription_authorized_payment
// ou payment de uma preapproval). Idempotente por mp_payment_id.
async function registrarCobrancaCartao({ assinaturaId, subscriptionId, mpPaymentId, status, statusDetalhe, valor, dataAprovacao }) {
  if (!mpPaymentId) return { resultado: 'ignorado', motivo: 'cobrança ainda sem pagamento' };
  const efeitos = [];
  const saida = await transacao(async cx => {
    const a = (await cx.query(
      `SELECT * FROM sindicato_assinaturas
        WHERE (($1::int IS NOT NULL AND id = $1) OR ($2::text IS NOT NULL AND mp_subscription_id = $2))
          AND metodo_pagamento = 'cartao_recorrente' FOR UPDATE`,
      [assinaturaId, subscriptionId ? String(subscriptionId) : null]
    )).rows[0];
    if (!a) return { resultado: 'ignorado', motivo: `assinatura de cartão não encontrada (${assinaturaId || subscriptionId})` };
    if (a.ambiente !== mp.AMBIENTE) return { resultado: 'ignorado', motivo: `assinatura de ${a.ambiente}` };

    let pag = (await cx.query('SELECT * FROM sindicato_pagamentos WHERE mp_payment_id = $1 FOR UPDATE', [String(mpPaymentId)])).rows[0];
    if (pag && pag.assinatura_id !== a.id) return { resultado: 'ignorado', motivo: 'pagamento pertence a outra assinatura' };
    if (pag && (pag.status === status || (pag.status === 'aprovado' && status === 'pendente'))) {
      return { resultado: 'sem_mudanca', status: pag.status };
    }
    const statusAnterior = pag?.status || null;
    if (!pag) {
      pag = (await cx.query(
        `INSERT INTO sindicato_pagamentos (assinatura_id, valor, metodo, status, status_detalhe, mp_payment_id, data_pagamento, ambiente)
         VALUES ($1, $2, 'cartao', $3, $4, $5, $6, $7) RETURNING *`,
        [a.id, Number(valor) || a.valor_mensal, status, statusDetalhe || null, String(mpPaymentId),
          dataAprovacao ? new Date(dataAprovacao) : null, mp.AMBIENTE]
      )).rows[0];
    } else {
      await cx.query(
        `UPDATE sindicato_pagamentos SET status = $1, status_detalhe = $2, data_pagamento = COALESCE($3, data_pagamento), updated_at = NOW()
          WHERE id = $4`,
        [status, statusDetalhe || null, dataAprovacao ? new Date(dataAprovacao) : null, pag.id]
      );
    }

    if (status === 'aprovado' && statusAnterior !== 'aprovado') {
      if (Number(valor) + 0.001 < Number(a.valor_mensal)) {
        return { resultado: 'requer_atencao', motivo: `valor cobrado ${valor} < contratado ${a.valor_mensal}` };
      }
      // Soma a partir do fim do período atual (fim do trial / mês anterior);
      // assinatura que já tinha vencido recomeça agora.
      const per = (await cx.query(
        `SELECT GREATEST(NOW(), COALESCE($1::timestamptz, NOW())) AS inicio,
                GREATEST(NOW(), COALESCE($1::timestamptz, NOW())) + INTERVAL '1 month' AS fim`,
        [['trial', 'ativa'].includes(a.status) ? a.acesso_ate : null]
      )).rows[0];
      await cx.query('UPDATE sindicato_pagamentos SET periodo_inicio = $1, periodo_fim = $2 WHERE id = $3', [per.inicio, per.fim, pag.id]);
      const renovacao = a.status === 'ativa';
      await cx.query(
        `UPDATE sindicato_assinaturas
            SET status = 'ativa', acesso_ate = $1, data_proxima_cobranca = $1,
                ultimo_lembrete_tipo = NULL, ultimo_lembrete_em = NULL, updated_at = NOW()
          WHERE id = $2`,
        [per.fim, a.id]
      );
      const plano = await aplicarPlanoNoParceiro(cx, a, new Date(new Date(per.fim).getTime() + CARENCIA_CARTAO_DIAS * 864e5));
      efeitos.push({ tipo: 'confirmado', a, valor: pag.valor, acessoAte: per.fim, renovacao });
      return { resultado: 'processado', status, assinatura_id: a.id, acesso_ate: per.fim, renovacao, ...plano };
    }
    if (status === 'rejeitado') efeitos.push({ tipo: 'falha', a, valor: pag.valor });
    if (status === 'reembolsado') return { resultado: 'requer_atencao', status, motivo: 'cobrança do cartão estornada' };
    return { resultado: 'processado', status };
  });

  for (const e of efeitos) {
    contatoDoParceiro(e.a.parceiro_id).then(c => {
      if (!c?.email) return null;
      if (e.tipo === 'confirmado') {
        return emailService.enviarPagamentoAssinaturaConfirmado({
          nome: c.nome, nomeFantasia: c.nome, email: c.email, plano: e.a.plano_nome, valor: e.valor,
          metodo: 'cartao_recorrente', acessoAte: e.acessoAte, renovacao: e.renovacao,
        });
      }
      return emailService.enviarFalhaPagamentoCartao({ nome: c.nome, nomeFantasia: c.nome, email: c.email, plano: e.a.plano_nome, valor: e.valor });
    }).catch(err => console.error('[assinatura] e-mail da cobrança do cartão falhou:', err.message));
  }
  return saida;
}

// Webhook subscription_authorized_payment: uma cobrança agendada da
// preapproval. Consulta no MP e registra (sem pagamento ainda = ignora).
async function processarCobrancaAutorizada(authorizedPaymentId) {
  const ap = await mpApiGet(`/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`);
  const pay = ap.payment || {};
  return registrarCobrancaCartao({
    subscriptionId: ap.preapproval_id,
    mpPaymentId: pay.id,
    status: statusLocal({ status: pay.status, status_detail: pay.status_detail }),
    statusDetalhe: pay.status_detail,
    valor: ap.transaction_amount,
    dataAprovacao: pay.status === 'approved' ? (ap.last_modified || ap.date_created || new Date().toISOString()) : null,
  });
}

// Webhook subscription_preapproval: mudou a ASSINATURA no MP (cancelada
// por lá, pausada, próxima data de cobrança).
async function sincronizarPreapproval(subscriptionId) {
  const pre = await new PreApproval(mp.client).get({ id: subscriptionId });
  return transacao(async cx => {
    const a = (await cx.query('SELECT * FROM sindicato_assinaturas WHERE mp_subscription_id = $1 FOR UPDATE', [String(subscriptionId)])).rows[0];
    if (!a) return { resultado: 'ignorado', motivo: `preapproval ${subscriptionId} não é nossa` };
    const proxima = pre.next_payment_date ? new Date(pre.next_payment_date) : a.data_proxima_cobranca;

    if (pre.status === 'cancelled' && a.status !== 'cancelada') {
      await cx.query(
        "UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = COALESCE(data_cancelamento, NOW()), updated_at = NOW() WHERE id = $1",
        [a.id]
      );
      // Sem mais cobrança: o plano vale até o fim do período, sem carência.
      if (a.acesso_ate) {
        await cx.query('UPDATE sindicato_parceiros SET plano_expira_em = $1 WHERE id = $2 AND NOT cortesia_interna', [a.acesso_ate, a.parceiro_id]);
      }
      return { resultado: 'processado', status: 'cancelada' };
    }
    if (pre.status === 'paused' && a.status !== 'pausada') {
      await cx.query("UPDATE sindicato_assinaturas SET status = 'pausada', updated_at = NOW() WHERE id = $1", [a.id]);
      return { resultado: 'processado', status: 'pausada' };
    }
    if (pre.status === 'authorized' && a.status === 'pausada') {
      await cx.query("UPDATE sindicato_assinaturas SET status = CASE WHEN trial_ate > NOW() THEN 'trial' ELSE 'ativa' END, updated_at = NOW() WHERE id = $1", [a.id]);
    }
    await cx.query('UPDATE sindicato_assinaturas SET data_proxima_cobranca = $1, updated_at = NOW() WHERE id = $2', [proxima, a.id]);
    return { resultado: 'processado', status: pre.status };
  });
}

// POST /parceiro/assinatura/cancelar — cancela a assinatura viva. O plano
// continua até o fim do período já pago (ou do trial); depois a rotina
// devolve pro Grátis. Cartão: cancela no MP ANTES de marcar aqui — se o MP
// falhar, não finge que cancelou (senão a cobrança continuaria).
async function cancelarAssinatura({ parceiroId }) {
  const a = (await db.query(
    "SELECT * FROM sindicato_assinaturas WHERE parceiro_id = $1 AND status IN ('aguardando_pagamento', 'trial', 'ativa', 'pausada')",
    [parceiroId]
  )).rows[0];
  if (!a) throw new ErroAssinatura(404, 'SEM_ASSINATURA', 'Você não tem assinatura ativa pra cancelar.');

  if (a.metodo_pagamento === 'cartao_recorrente' && a.mp_subscription_id) {
    if (!mp.client) throw new ErroAssinatura(503, 'PAGAMENTO_INDISPONIVEL', 'Não foi possível cancelar agora. Tente de novo em instantes.');
    try {
      await cancelarPreapprovalNoMp(a.mp_subscription_id);
    } catch (err) {
      console.error('[assinatura] falha ao cancelar preapproval', a.mp_subscription_id, err?.status, err?.message);
      throw new ErroAssinatura(502, 'ERRO_MP', 'O Mercado Pago não confirmou o cancelamento. Tente de novo em instantes.');
    }
  }

  const pixParaCancelar = await transacao(async cx => {
    const pend = await cx.query(
      `UPDATE sindicato_pagamentos SET status = 'cancelado', status_detalhe = 'assinatura_cancelada', updated_at = NOW()
        WHERE assinatura_id = $1 AND status = 'pendente' RETURNING mp_payment_id`,
      [a.id]
    );
    await cx.query("UPDATE sindicato_assinaturas SET status = 'cancelada', data_cancelamento = NOW(), updated_at = NOW() WHERE id = $1", [a.id]);
    if (a.acesso_ate) {
      await cx.query('UPDATE sindicato_parceiros SET plano_expira_em = $1 WHERE id = $2 AND NOT cortesia_interna', [a.acesso_ate, a.parceiro_id]);
    }
    return pend.rows.map(r => r.mp_payment_id).filter(Boolean);
  });
  pixParaCancelar.forEach(id => cancelarPixNoMp(id));

  const acessoAte = a.acesso_ate && new Date(a.acesso_ate) > new Date() ? a.acesso_ate : null;
  contatoDoParceiro(parceiroId).then(c => c?.email && emailService.enviarAssinaturaCancelada({
    nome: c.nome, nomeFantasia: c.nome, email: c.email, plano: a.plano_nome, acessoAte,
  })).catch(err => console.error('[assinatura] e-mail de cancelamento falhou:', err.message));

  return { assinatura_id: a.id, status: 'cancelada', acesso_ate: acessoAte };
}

// Rotina diária (Render Cron Job -> POST /api/interno/assinaturas/rotina).
// Idempotente: rodar 2x no mesmo dia não duplica e-mail nem histórico.
async function rotinaDiaria() {
  const res = { planos_encerrados: 0, assinaturas_vencidas: 0, lembretes_pix: 0, pix_expirados: 0, assinaturas_abandonadas: 0, erros: [] };

  // 1. Período pago acabou -> assinatura 'vencida' (PIX não renovado).
  //    Cancelada continua 'cancelada' (só perde o acesso).
  //    Cartão (trial ou ativa) só depois da carência: a cobrança/retentativa
  //    do MP pode chegar alguns dias depois do fim do período.
  res.assinaturas_vencidas = (await db.query(
    `UPDATE sindicato_assinaturas SET status = 'vencida', updated_at = NOW()
      WHERE status IN ('ativa', 'trial') AND acesso_ate IS NOT NULL
        AND acesso_ate + (CASE WHEN metodo_pagamento = 'cartao_recorrente' THEN $1::int ELSE 0 END) * INTERVAL '1 day' <= NOW()`,
    [CARENCIA_CARTAO_DIAS]
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

  // 3b. Trial do cartão acabando: "faltam 2 dias" e "amanhã vamos cobrar"
  //     (uma vez cada — a chave leva o tipo e a data do fim do trial).
  const trials = (await db.query(
    `SELECT a.*, TO_CHAR(a.trial_ate AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS fim_dia,
            (a.trial_ate <= NOW() + INTERVAL '1 day') AS amanha
       FROM sindicato_assinaturas a JOIN sindicato_parceiros p ON p.id = a.parceiro_id
      WHERE a.status = 'trial' AND a.metodo_pagamento = 'cartao_recorrente' AND NOT p.cortesia_interna
        AND a.trial_ate > NOW() AND a.trial_ate <= NOW() + INTERVAL '2 days'`
  )).rows;
  res.lembretes_trial = 0;
  for (const a of trials) {
    const chave = `${a.amanha ? 'trial_amanha' : 'trial_2dias'}:${a.fim_dia}`;
    if (a.ultimo_lembrete_tipo === chave) continue;
    try {
      const c = await contatoDoParceiro(a.parceiro_id);
      if (c?.email) {
        await emailService.enviarTrialTerminando({
          nome: c.nome, nomeFantasia: c.nome, email: c.email, plano: a.plano_nome,
          valor: a.valor_mensal, dataCobranca: a.trial_ate, amanha: a.amanha, credito: Boolean(a.origem_credito_id),
        });
      }
      await db.query('UPDATE sindicato_assinaturas SET ultimo_lembrete_tipo = $1, ultimo_lembrete_em = NOW() WHERE id = $2', [chave, a.id]);
      res.lembretes_trial++;
    } catch (err) {
      res.erros.push(`lembrete trial ${a.id}: ${err.message}`);
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
      WHERE status = 'aguardando_pagamento' AND metodo_pagamento = 'pix' AND created_at < NOW() - INTERVAL '1 day'`
  )).rowCount;

  return res;
}

module.exports = {
  ErroAssinatura,
  iniciarAssinaturaCartao,
  cancelarAssinatura,
  registrarCobrancaCartao,
  processarCobrancaAutorizada,
  sincronizarPreapproval,
  trialDisponivel,
  CARENCIA_CARTAO_DIAS,
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
