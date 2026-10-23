const db = require('../config/database');
const { veTudo } = require('../config/perfilAdmin');
const { registrarLote } = require('../services/registroAdmin');
const { generateProtocol, getExpirationDate } = require('../services/protocolService');
const { sendWhatsAppMessage, buildProtocolMessage } = require('../services/zapApiService');
const { calculateCommissions } = require('../services/commissionService');
const emailService = require('../services/emailService');
const { onlyDigits, isValidCPF, mascararCpf, mascararDocumento } = require('../utils/validators');
const { registrarAcao, nomeDoAdmin } = require('../services/registroAdmin');
const dup = require('../services/indicacaoDuplicada');

// CPF do cliente na indicação (livro de comissões do Partner, Etapa 2):
// opcional, só dígitos, validado. Devolve { cpf } ou { erro }.
function cpfDaIndicacao(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return { cpf: null };
  const cpf = onlyDigits(valor);
  if (!isValidCPF(cpf)) return { erro: 'CPF do cliente inválido.' };
  return { cpf };
}

async function listReferrals(req, res) {
  try {
    const { month, status } = req.query;
    let query = `
      SELECT r.*, p.name AS partner_name, p.code AS partner_code,
             pr.name AS product_name, pr.type AS product_type,
             pr.percentual_repasse, pr.faixa
      FROM referrals r
      JOIN partners p ON p.id = r.partner_id
      JOIN products pr ON pr.id = r.product_id
      WHERE 1=1
    `;
    const params = [];

    if (!veTudo(req.user)) {
      params.push(req.user.id);
      query += ` AND r.partner_id = $${params.length}`;
    }
    if (month) {
      params.push(month);
      query += ` AND TO_CHAR(r.created_at,'YYYY-MM') = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }
    query += ' ORDER BY r.created_at DESC';

    const result = await db.query(query, params);
    // Parceiro vê o CPF do próprio cliente mascarado; a equipe vê inteiro
    if (!veTudo(req.user)) return res.json(result.rows.map(r => ({ ...r, client_cpf: mascararCpf(r.client_cpf), client_documento: mascararDocumento(r.client_documento) })));
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createReferral(req, res) {
  const { client_name, client_whatsapp, product_id, client_email, client_documento, client_cpf, partner_id } = req.body;
  if (!client_name || !client_whatsapp || !product_id) {
    return res.status(400).json({ error: 'Nome, WhatsApp e produto são obrigatórios' });
  }
  // CPF ou CNPJ no mesmo campo (client_cpf: nome antigo, ainda aceito).
  // Obrigatório só na indicação feita pelo próprio MOVV Partner.
  const doPartner = req.user.type === 'movv_partner';
  const { documento, erro: erroDoc } = dup.documentoDaIndicacao(client_documento ?? client_cpf, { obrigatorio: doPartner });
  if (erroDoc) return res.status(400).json({ error: erroDoc });

  try {
    // Dono da indicação: quem está logado, ou, se for a equipe registrando
    // para alguém, o MOVV Partner escolhido.
    let dono = req.user;
    if (partner_id && veTudo(req.user)) {
      const p = await db.query(
        `SELECT id, name, type FROM partners WHERE id = $1 AND is_active = true AND type = 'movv_partner'`, [partner_id]
      );
      if (!p.rows[0]) return res.status(400).json({ error: 'MOVV Partner não encontrado ou inativo' });
      dono = p.rows[0];
    }

    const productResult = await db.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [product_id]);
    if (!productResult.rows[0]) return res.status(404).json({ error: 'Produto não encontrado' });
    const product = productResult.rows[0];
    // MOVV Partner indica Azul, seguro e Movv Certificado (liberado em
    // 14/10/2026); BPO e conta, não. A comissão do Certificado continua
    // nascendo só da venda em que o Fernando marca o Partner.
    if (dono.type === 'movv_partner' && ['bpo', 'account'].includes(product.type)) {
      return res.status(400).json({ error: 'Este produto não faz parte das indicações do MOVV Partner' });
    }
    // Certificado como indicação é só do MOVV Partner; contabilidade e
    // funcionário vendem pelo módulo Direta Certificação.
    if (dono.type !== 'movv_partner' && product.type === 'digital_certificate') {
      return res.status(400).json({ error: 'O Certificado é vendido pelo módulo Direta Certificação, não por indicação' });
    }
    // Crédito da Azul é de pessoa física: só CPF
    if (documento && documento.length === 14 && product.type === 'credit') {
      return res.status(400).json({ error: 'Para este produto, informe o CPF do cliente.' });
    }

    const expiresAt = getExpirationDate();
    // Checagem de duplicidade, protocolo e INSERT na MESMA transação (trava
    // por documento + produto e trava do protocolo; ver indicacaoDuplicada.js)
    const r = await db.transacao(async cx => {
      let liberacaoId = null;
      let aviso = null;
      if (documento && doPartner) {
        const c = await dup.checarIndicacaoDoPartner(cx, { partnerId: dono.id, productId: product.id, documento });
        if (c.bloqueada) return { bloqueada: true };
        liberacaoId = c.liberacaoId;
      } else if (documento && dono.type === 'movv_partner') {
        // equipe registrando para um Partner: não barra (a Central decide),
        // mas avisa quem já tem o cliente
        await dup.travarDocumentoProduto(cx, documento, product.id);
        const dona = await dup.indicacaoQueProtege(cx, documento, product.id);
        if (dona) aviso = `Atenção: este cliente já tem a indicação ${dona.protocol} em andamento para este produto.`;
      }
      const protocol = await generateProtocol(cx);
      const ins = (await cx.query(
        `INSERT INTO referrals (protocol, partner_id, client_name, client_whatsapp, client_email, product_id, expires_at, client_cpf, client_documento)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [protocol, dono.id, client_name, client_whatsapp, client_email || null, product_id, expiresAt,
          documento && documento.length === 11 ? documento : null, documento]
      )).rows[0];
      if (liberacaoId) await dup.marcarLiberacaoUsada(cx, liberacaoId, ins.id);
      return { referral: ins, aviso };
    });
    // Sempre a mesma mensagem: sem dizer quem indicou nem quando
    if (r.bloqueada) return res.status(409).json({ error: dup.MSG_DUPLICADA });
    const { referral } = r;

    const message = buildProtocolMessage(
      client_name, referral.protocol, product.name, dono.name, expiresAt
    );
    sendWhatsAppMessage(client_whatsapp, message).catch(() => {});

    if (client_email) {
      emailService.enviarConfirmacaoIndicacao({
        nome: client_name,
        email: client_email,
        protocolo: referral.protocol,
        produto: product.name,
        validade: expiresAt,
      }).catch(err => console.error('[EMAIL]', err.message));
    }

    const equipe = veTudo(req.user);
    return res.status(201).json({
      ...referral, product_name: product.name,
      client_cpf: equipe ? referral.client_cpf : mascararCpf(referral.client_cpf),
      client_documento: equipe ? referral.client_documento : mascararDocumento(referral.client_documento),
      ...(r.aviso && { aviso_duplicidade: r.aviso }),
    });
  } catch (err) {
    // sem a mensagem do banco: ela pode trazer o documento digitado
    console.error('[INDICAÇÃO]', err?.code || err?.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function confirmSale(req, res) {
  const { operated_value, bpo_month_count } = req.body;
  if (!operated_value || operated_value <= 0) {
    return res.status(400).json({ error: 'Valor operado inválido' });
  }

  try {
    const refResult = await db.query(
      `SELECT r.*, pr.type AS product_type, pr.name AS product_name,
              pr.percentual_repasse, pr.commission_rate,
              p.type AS partner_type, p.parent_id
       FROM referrals r
       JOIN products pr ON pr.id = r.product_id
       JOIN partners p ON p.id = r.partner_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (!refResult.rows[0]) return res.status(404).json({ error: 'Indicação não encontrada' });
    const referral = refResult.rows[0];

    if (referral.status === 'converted') {
      return res.status(409).json({ error: 'Venda já confirmada' });
    }

    let parentPartner = null;
    if (referral.parent_id) {
      const parentResult = await db.query('SELECT * FROM partners WHERE id = $1', [referral.parent_id]);
      parentPartner = parentResult.rows[0];
    }

    const partner = { id: referral.partner_id, type: referral.partner_type, parent_id: referral.parent_id };
    const product = { type: referral.product_type, percentual_repasse: referral.percentual_repasse, commission_rate: referral.commission_rate };
    // MOVV Partner não entra no modelo antigo (contabilidade/funcionário): a
    // comissão dele vem do livro (importação da Azul), não daqui.
    const commissions = referral.partner_type === 'movv_partner'
      ? []
      : calculateCommissions(product, operated_value, partner, parentPartner, bpo_month_count || 1);

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Indicação convertida + comissões: tudo ou nada.
    await db.transacao(async (client) => {
      await client.query(
        'UPDATE referrals SET status=$1, operated_value=$2 WHERE id=$3',
        ['converted', operated_value, referral.id]
      );
      for (const comm of commissions) {
        await client.query(
          `INSERT INTO commissions (referral_id, partner_id, amount, type, reference_month)
           VALUES ($1,$2,$3,$4,$5)`,
          [referral.id, comm.partner_id, comm.amount, comm.type, currentMonth]
        );
      }
    });

    return res.json({ message: 'Venda confirmada e comissões calculadas', commissions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function expireOldReferrals(req, res) {
  try {
    // quem clicou, quando e quantas expiraram ficam no registro (admin_acoes),
    // mesmo quando nenhuma expira
    const rows = await db.transacao(async cx => {
      const result = await cx.query(
        // nunca expira indicação com contrato ou com lançamento no livro
        `UPDATE referrals SET status='expired'
         WHERE status='pending' AND expires_at < NOW()
           AND numero_contrato IS NULL
           AND NOT EXISTS (SELECT 1 FROM partner_comissoes pc WHERE pc.referral_id = referrals.id)
         RETURNING id, protocol`
      );
      await registrarLote(cx, req, 'indicacoes_expiradas', 'referrals', { quantidade: result.rows.length, protocolos: result.rows.map(r => r.protocol) });
      return result.rows;
    });
    return res.json({ expired: rows.length, protocols: rows.map(r => r.protocol) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Último clique no "Expirar pendentes" (Visão Geral): quem, quando e quantas.
async function ultimaExpiracao(req, res) {
  try {
    const r = await db.query(
      `SELECT admin_nome, criado_em, (detalhes->>'quantidade')::int AS quantidade
       FROM admin_acoes WHERE acao = 'indicacoes_expiradas'
       ORDER BY criado_em DESC, id DESC LIMIT 1`
    );
    return res.json(r.rows[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// CPF e número do contrato da indicação, depois de criada.
// Equipe: CPF e contrato a qualquer momento. Dono da indicação: só o CPF, e
// só enquanto estiver vazio (ele vê o CPF mascarado, não corrige por cima).
// O contrato só existe depois que a Azul digita a proposta; também é gravado
// sozinho quando o admin confirma um vínculo na importação da Azul.
async function atualizarDados(req, res) {
  const equipe = veTudo(req.user);
  const { client_cpf, numero_contrato } = req.body || {};
  try {
    const r = (await db.query('SELECT id, partner_id, client_cpf, client_documento, numero_contrato FROM referrals WHERE id = $1', [req.params.id])).rows[0];
    if (!r) return res.status(404).json({ error: 'Indicação não encontrada' });
    if (!equipe && r.partner_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

    const mudancas = {};
    if (client_cpf !== undefined) {
      const { cpf, erro } = cpfDaIndicacao(client_cpf);
      if (erro) return res.status(400).json({ error: erro });
      if (!equipe && (r.client_cpf || r.client_documento)) return res.status(403).json({ error: 'O CPF já foi informado; para corrigir, fale com a Central Movv.' });
      mudancas.client_cpf = cpf;
      // o documento acompanha o CPF (apagar o CPF só apaga o documento se ele era esse CPF)
      mudancas.client_documento = cpf || (r.client_documento === r.client_cpf ? null : r.client_documento);
    }
    if (numero_contrato !== undefined) {
      if (!equipe) return res.status(403).json({ error: 'O número do contrato é preenchido pela Central Movv.' });
      const contrato = String(numero_contrato || '').trim().replace(/\s/g, '') || null;
      if (contrato && !/^\d{4,20}$/.test(contrato)) return res.status(400).json({ error: 'Número do contrato inválido (só dígitos).' });
      if (contrato) {
        const outra = (await db.query('SELECT id FROM referrals WHERE numero_contrato = $1 AND id <> $2', [contrato, r.id])).rows[0];
        if (outra) return res.status(409).json({ error: `O contrato ${contrato} já está na indicação #${outra.id}.` });
      }
      mudancas.numero_contrato = contrato;
    }
    if (!Object.keys(mudancas).length) return res.status(400).json({ error: 'Nada para alterar' });

    const campos = Object.keys(mudancas);
    const atualizada = await db.transacao(async cx => {
      const u = (await cx.query(
        `UPDATE referrals SET ${campos.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
        [r.id, ...campos.map(c => mudancas[c])]
      )).rows[0];
      if (equipe) {
        await registrarAcao(cx, req, 'indicacao_dados', 'referrals', r.id, {
          cpf: mudancas.client_cpf !== undefined ? mascararCpf(mudancas.client_cpf) : undefined,
          contrato: mudancas.numero_contrato,
        });
      }
      return u;
    });
    return res.json({
      ...atualizada,
      client_cpf: equipe ? atualizada.client_cpf : mascararCpf(atualizada.client_cpf),
      client_documento: equipe ? atualizada.client_documento : mascararDocumento(atualizada.client_documento),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// ─── Tentativas bloqueadas (indicação duplicada) — só a equipe ─────────────

async function listarTentativas(req, res) {
  try {
    return res.json(await dup.listarTentativas(db));
  } catch (err) {
    console.error('[TENTATIVAS]', err?.code || err?.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Libera UMA tentativa: a próxima indicação do mesmo Partner, produto e
// documento passa. Motivo obrigatório; admin_acoes só com o documento mascarado.
async function liberarTentativa(req, res) {
  const motivo = String(req.body?.motivo || '').trim();
  if (motivo.length < 3) return res.status(400).json({ error: 'Informe o motivo da liberação.' });
  try {
    const t = await db.transacao(async cx => {
      const lib = await dup.liberarTentativa(cx, Number(req.params.id), motivo, nomeDoAdmin(req.user));
      if (lib) await registrarAcao(cx, req, 'indicacao_tentativa_liberada', 'referral_tentativas_bloqueadas', lib.id, { ...lib, motivo_liberacao: motivo });
      return lib;
    });
    if (!t) return res.status(404).json({ error: 'Tentativa não encontrada ou já liberada.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[TENTATIVAS]', err?.code || err?.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = {
  listReferrals, createReferral, confirmSale, expireOldReferrals, ultimaExpiracao, atualizarDados,
  listarTentativas, liberarTentativa,
};
