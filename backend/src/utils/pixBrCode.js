// Pix "copia e cola" (BR Code estático) com valor, no padrão do Banco
// Central (Manual de Padrões para Iniciação do Pix). O dinheiro vai direto
// para a chave da loja; o IUB só monta o texto. Sem Mercado Pago.

function campo(id, valor) {
  const v = String(valor);
  return id + String(v.length).padStart(2, '0') + v;
}

// CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), exigido no campo 63.
function crc16(texto) {
  let crc = 0xFFFF;
  for (const byte of Buffer.from(texto, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Nome e cidade: sem acento e só caracteres simples (alguns bancos recusam
// o resto). O banco mostra o nome real da conta ao pagar; este é informativo.
function textoSimples(s, max) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, ' ').replace(/\s+/g, ' ').trim()
    .slice(0, max).trim();
}

// { chave, nome, cidade, valor, txid } → texto do copia e cola.
// txid: só letras e números, até 25; sem txid vai "***".
function gerarBrCode({ chave, nome, cidade, valor, txid }) {
  if (!chave) return null;
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
  const id = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  let texto =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor != null && Number(valor) > 0 ? campo('54', Number(valor).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', textoSimples(nome, 25) || 'LOJA') +
    campo('60', textoSimples(cidade, 15) || 'ITUMBIARA') +
    campo('62', campo('05', id)) +
    '6304';
  return texto + crc16(texto);
}

// Código do pedido (o mesmo no QR da tela do pedido e na mensagem do
// WhatsApp). null se não houver chave ou se não der para gerar.
function copiaEColaDoPedido(p, loja = {}) {
  if (!p?.pix_chave) return null;
  try {
    const codigo = gerarBrCode({ chave: p.pix_chave, nome: p.pix_nome_recebedor || loja.nome, cidade: loja.cidade, valor: p.total, txid: `IUB${p.id}` });
    return codigo && /^[\x20-\x7E]+$/.test(codigo) ? codigo : null; // só caracteres simples, sem quebra de linha
  } catch {
    return null;
  }
}

module.exports = { gerarBrCode, crc16, copiaEColaDoPedido };
