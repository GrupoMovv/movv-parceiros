import toast from 'react-hot-toast';
import api, { backendOrigin } from '../services/api';

const GRAUS_DEPENDENTE = [['conjuge', 'Cônjuge'], ['filho', 'Filho'], ['filha', 'Filha']];
const GRAU_LABEL = Object.fromEntries(GRAUS_DEPENDENTE);
const GRAU_ORDEM = { conjuge: 0, filho: 1, filha: 2 };

// URL "canônica" da carteirinha: aponta pro backend, não pro frontend
// direto — é ele quem detecta bots de preview (WhatsApp etc.) e serve as
// meta tags certas; humanos são redirecionados pro app na hora.
export function publicCarteirinhaUrl(hash) {
  return `${backendOrigin()}/carteirinha/${hash}`;
}

export function carteirinhaBadge(a) {
  if (!a.carteirinha_hash || !a.carteirinha_valida_ate) {
    return { label: 'Não gerada', cls: 'bg-slate-100 text-slate-500' };
  }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const validaAte = new Date(a.carteirinha_valida_ate);
  const diffDias = Math.ceil((validaAte - hoje) / 86400000);
  if (diffDias < 0) return { label: 'Vencida', cls: 'bg-red-100 text-red-700' };
  if (diffDias <= 15) return { label: `Vence em ${diffDias}d`, cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Ativa', cls: 'bg-emerald-100 text-emerald-700' };
}

export function linkWhatsapp(numero) {
  const digits = String(numero || '').replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=55${digits}`;
}

// api.whatsapp.com em vez de wa.me: wa.me faz um redirect server-side que
// corrompe emoji (vira U+FFFD) mesmo com encodeURIComponent certo.
export function linkWhatsappComTexto(numero, mensagem) {
  const digits = String(numero || '').replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=55${digits}&text=${encodeURIComponent(mensagem)}`;
}

// Cônjuge primeiro, depois cada grau agrupado (filho, filha) e dentro de
// cada grupo em ordem alfabética pelo nome.
export function ordenarDependentes(deps) {
  return [...deps].sort((x, y) => {
    const ox = GRAU_ORDEM[x.grau] ?? 99;
    const oy = GRAU_ORDEM[y.grau] ?? 99;
    if (ox !== oy) return ox - oy;
    return (x.nome || '').localeCompare(y.nome || '', 'pt-BR');
  });
}

export function montarMensagemCarteirinha(nomeCurto, urlTitular, dependentesComCarteirinha) {
  if (dependentesComCarteirinha.length === 0) {
    return `Olá, ${nomeCurto}! 👋

Aqui está sua carteirinha digital de associado ao SECI — Sindicato dos Empregados no Comércio de Itumbiara.

🎫 Acesse pelo link:
${urlTitular}

Você pode salvar a carteirinha no celular e apresentá-la sempre que precisar usar seus benefícios com nossos parceiros.

Qualquer dúvida, estou à disposição!

Renan Araújo
SECI — Sindicato do Comércio de Itumbiara`;
  }

  const listaDependentes = ordenarDependentes(dependentesComCarteirinha)
    .map(d => `• ${GRAU_LABEL[d.grau] || 'Dependente'} — ${d.nome}: ${publicCarteirinhaUrl(d.carteirinha_hash)}`)
    .join('\n');

  return `Olá, ${nomeCurto}! 👋

Aqui estão as carteirinhas digitais SECI — Sindicato dos Empregados no Comércio de Itumbiara.

🎫 Sua carteirinha:
${urlTitular}

👨‍👩‍👧 Carteirinhas dos dependentes:
${listaDependentes}

Você pode salvar as carteirinhas no celular e apresentá-las sempre que precisar usar seus benefícios com nossos parceiros. Compartilhe com sua família!

Qualquer dúvida, estou à disposição!

Renan Araújo
SECI — Sindicato do Comércio de Itumbiara`;
}

export function toastAviso(mensagem) {
  toast(mensagem, { icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E' } });
}

// Busca os dependentes com carteirinha do associado, monta a mensagem
// (com ou sem a lista de dependentes) e abre o WhatsApp. Usado tanto na
// tabela de Associados quanto nas listas do dashboard de Carteirinhas.
export async function enviarCarteirinhaWhatsapp(a) {
  if (!a.carteirinha_hash) { toastAviso('Gere a carteirinha do titular primeiro'); return false; }
  if (!a.whatsapp) { toastAviso('Cadastre o WhatsApp do associado antes de enviar'); return false; }

  const res = await api.get(`/sindicato-associados/${a.id}`);
  const dependentesComCarteirinha = (res.data.dependentes || []).filter(d => d.carteirinha_hash);
  const nomeCurto = a.nome_completo.trim().split(/\s+/)[0];
  const urlTitular = publicCarteirinhaUrl(a.carteirinha_hash);
  const mensagem = montarMensagemCarteirinha(nomeCurto, urlTitular, dependentesComCarteirinha);
  window.open(linkWhatsappComTexto(a.whatsapp, mensagem), '_blank');
  return true;
}
