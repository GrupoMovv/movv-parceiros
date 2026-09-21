// Helpers compartilhados das telas de assinatura (Planos, Minha Assinatura).

export function formatarBRL(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataBR(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
}

export function diasAte(d) {
  return d ? Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 864e5)) : null;
}

export function mensagemErro(err, padrao = 'Não foi possível concluir agora. Tente de novo.') {
  return err?.response?.data?.error || (err?.code === 'ECONNABORTED' ? 'Demorou demais pra responder. Tente de novo.' : padrao);
}

// SDK JS do Mercado Pago (Bricks) — carregado só quando o parceiro abre o
// modal do cartão, uma vez por página.
let sdkPromise = null;
export function carregarSdkMercadoPago() {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://sdk.mercadopago.com/js/v2';
      s.async = true;
      s.onload = () => (window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error('SDK do Mercado Pago não carregou')));
      s.onerror = () => { sdkPromise = null; reject(new Error('Não foi possível carregar o Mercado Pago. Confira sua internet.')); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

export const ROTULO_STATUS = {
  aguardando_pagamento: { texto: 'Aguardando pagamento', cor: '#92400E', fundo: '#FEF3C7' },
  trial: { texto: 'Trial grátis', cor: '#1E40AF', fundo: '#DBEAFE' },
  ativa: { texto: 'Ativa', cor: '#166534', fundo: '#DCFCE7' },
  pausada: { texto: 'Pausada', cor: '#92400E', fundo: '#FEF3C7' },
  cancelada: { texto: 'Cancelada', cor: '#475569', fundo: '#F1F5F9' },
  vencida: { texto: 'Vencida', cor: '#991B1B', fundo: '#FEE2E2' },
};

export const NOME_BANDEIRA = { master: 'Mastercard', visa: 'Visa', elo: 'Elo', amex: 'American Express', hipercard: 'Hipercard' };
