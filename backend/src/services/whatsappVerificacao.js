const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { onlyDigits } = require('../utils/validators');
const { sendWhatsAppMessage } = require('./zapApiService');

// "WhatsApp confirmado" do cliente (pedido pelo site, migration 080).
// Confirmado = sindicato_associados.whatsapp_verificado é o MESMO número de
// whatsapp: trocou o número em qualquer tela, deixa de bater sozinho.
// Código em tabela própria (whatsapp_codigos), mesmo desenho do "esqueci a
// senha" (contaController): bcrypt, 10 min, 1 por minuto, 3 por hora,
// 5 tentativas, uso único.
const CODIGO_VALIDADE_MIN = 10;
const CODIGO_REENVIO_SEG = 60;
const CODIGOS_POR_HORA = 3;
const CODIGO_MAX_TENTATIVAS = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DDD + número, sem o 55 (o banco guarda sem; telefoneZapi põe na hora de enviar)
function normalizarWhatsapp(n) {
  return onlyDigits(n).replace(/^55(?=\d{10,11}$)/, '');
}

function whatsappConfirmado(associado) {
  const atual = normalizarWhatsapp(associado?.whatsapp);
  return atual.length >= 10 && atual === normalizarWhatsapp(associado?.whatsapp_verificado);
}

function mascarar(d) {
  return d.length >= 10 ? `(${d.slice(0, 2)}) *****-${d.slice(-4)}` : '*****';
}

// Devolve { status, body } pronto pra resposta HTTP.
async function enviarCodigo(associado, ip) {
  const destino = normalizarWhatsapp(associado.whatsapp);
  if (destino.length < 10) {
    return { status: 409, body: { error: 'Cadastre seu WhatsApp com DDD em Meus Dados primeiro.', code: 'SEM_WHATSAPP' } };
  }
  if (whatsappConfirmado(associado)) {
    return { status: 200, body: { ja_confirmado: true } };
  }

  const hist = (await db.query(
    `SELECT COUNT(*) FILTER (WHERE criado_em > NOW() - interval '1 hour')::int AS na_hora,
            EXTRACT(EPOCH FROM (NOW() - MAX(criado_em)))::int AS seg_desde_ultimo
     FROM whatsapp_codigos WHERE associado_id = $1`,
    [associado.id]
  )).rows[0];
  if (hist.seg_desde_ultimo !== null && hist.seg_desde_ultimo < CODIGO_REENVIO_SEG) {
    const aguarde = CODIGO_REENVIO_SEG - hist.seg_desde_ultimo;
    return { status: 429, body: { error: `Aguarde ${aguarde}s pra pedir outro código.`, code: 'AGUARDE', aguarde_seg: aguarde } };
  }
  if (hist.na_hora >= CODIGOS_POR_HORA) {
    return { status: 429, body: { error: 'Você já pediu vários códigos. Tente de novo daqui a 1 hora.', code: 'LIMITE_CODIGOS' } };
  }

  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  // Pedido novo invalida os anteriores ainda abertos.
  await db.query('UPDATE whatsapp_codigos SET expira_em = NOW() WHERE associado_id = $1 AND usado_em IS NULL AND expira_em > NOW()', [associado.id]);
  const pedido = (await db.query(
    `INSERT INTO whatsapp_codigos (associado_id, whatsapp, codigo_hash, expira_em, ip)
     VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval, $5) RETURNING id`,
    [associado.id, destino, await bcrypt.hash(codigo, 8), String(CODIGO_VALIDADE_MIN), ip]
  )).rows[0].id;

  const envio = await sendWhatsAppMessage(destino,
    `✅ *IUB MAIS+*\n\nSeu código pra confirmar este WhatsApp é: *${codigo}*\n\nVale por ${CODIGO_VALIDADE_MIN} minutos. Não passe esse código pra ninguém — nem pra quem disser que é do IUB MAIS+.\n\nNão pediu? É só ignorar esta mensagem.`);
  if (!envio.success) {
    // Sem botão manual aqui: o código só vale se chegou pelo Z-API.
    await db.query('DELETE FROM whatsapp_codigos WHERE id = $1', [pedido]);
    return { status: 503, body: { error: 'Não conseguimos enviar o código pelo WhatsApp agora. Tente de novo em alguns minutos.', code: 'ENVIO_FALHOU' } };
  }

  return {
    status: 200,
    body: { pedido, whatsapp_mascarado: mascarar(destino), validade_min: CODIGO_VALIDADE_MIN, reenvio_seg: CODIGO_REENVIO_SEG },
  };
}

async function confirmarCodigo(associado, pedido, codigoBruto) {
  const codigo = onlyDigits(codigoBruto);
  if (!UUID_RE.test(String(pedido || ''))) {
    return { status: 400, body: { error: 'Pedido inválido. Peça um código novo.', code: 'CODIGO_EXPIRADO' } };
  }
  if (codigo.length !== 6) return { status: 400, body: { error: 'O código tem 6 números.', campo: 'codigo' } };

  const p = (await db.query('SELECT * FROM whatsapp_codigos WHERE id = $1 AND associado_id = $2', [pedido, associado.id])).rows[0];
  if (!p || p.usado_em || new Date(p.expira_em) <= new Date()) {
    return { status: 410, body: { error: 'Esse código expirou. Peça um novo.', code: 'CODIGO_EXPIRADO' } };
  }
  if (p.tentativas >= CODIGO_MAX_TENTATIVAS) {
    return { status: 429, body: { error: 'Muitas tentativas com código errado. Peça um código novo.', code: 'CODIGO_EXPIRADO' } };
  }
  // O código vale pro número que o recebeu. Se a pessoa trocou o WhatsApp
  // depois de pedir, o código não confirma o número novo.
  if (p.whatsapp !== normalizarWhatsapp(associado.whatsapp)) {
    return { status: 410, body: { error: 'Seu WhatsApp mudou depois do envio. Peça um código novo.', code: 'CODIGO_EXPIRADO' } };
  }

  if (!(await bcrypt.compare(codigo, p.codigo_hash))) {
    const t = (await db.query('UPDATE whatsapp_codigos SET tentativas = tentativas + 1 WHERE id = $1 RETURNING tentativas', [p.id])).rows[0].tentativas;
    if (t >= CODIGO_MAX_TENTATIVAS) {
      return { status: 429, body: { error: 'Muitas tentativas com código errado. Peça um código novo.', code: 'CODIGO_EXPIRADO' } };
    }
    return { status: 401, body: { error: `Código incorreto. Restam ${CODIGO_MAX_TENTATIVAS - t} tentativa(s).`, campo: 'codigo' } };
  }

  const ok = await db.transacao(async (client) => {
    // "usado_em IS NULL" no WHERE: o mesmo código não confirma duas vezes.
    const uso = await client.query('UPDATE whatsapp_codigos SET usado_em = NOW() WHERE id = $1 AND usado_em IS NULL RETURNING id', [p.id]);
    if (!uso.rows[0]) return false;
    await client.query('UPDATE whatsapp_codigos SET expira_em = NOW() WHERE associado_id = $1 AND usado_em IS NULL', [associado.id]);
    await client.query(
      'UPDATE sindicato_associados SET whatsapp_verificado = $1, whatsapp_verificado_em = NOW(), updated_at = NOW() WHERE id = $2',
      [p.whatsapp, associado.id]
    );
    return true;
  });
  if (!ok) return { status: 410, body: { error: 'Esse código já foi usado. Peça um novo.', code: 'CODIGO_EXPIRADO' } };
  return { status: 200, body: { confirmado: true } };
}

module.exports = { normalizarWhatsapp, whatsappConfirmado, enviarCodigo, confirmarCodigo };
