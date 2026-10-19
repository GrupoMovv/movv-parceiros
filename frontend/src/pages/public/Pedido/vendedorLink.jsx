import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../../services/api';

// Equipe de vendas da loja (e2): o cliente que entra pelo link de um vendedor
// (/v/CÓDIGO ou ?v=CÓDIGO) fica marcado com ele por 7 dias, SÓ no navegador
// dele. Entrou depois pelo link de outro vendedor: vale o último. No pedido, o
// site manda os códigos (do mais recente para o mais antigo) e o servidor fica
// com o mais recente que seja da loja do pedido. O cliente não vê nem escolhe.

const CHAVE = 'iub_vendedor_links';
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;
const RE_CODIGO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

function ler() {
  try {
    const l = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(l) ? l.filter(x => x && RE_CODIGO.test(x.c) && Date.now() - Number(x.em) < VALIDADE_MS) : [];
  } catch {
    return [];
  }
}

export function guardarVendedor(codigo) {
  const c = String(codigo || '').toUpperCase();
  if (!RE_CODIGO.test(c)) return;
  const lista = [{ c, em: Date.now() }, ...ler().filter(x => x.c !== c)].slice(0, 20);
  try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { /* sem armazenamento: segue sem marcar */ }
}

// Códigos válidos (7 dias), do mais recente para o mais antigo — vai no pedido.
export function codigosVendedor() {
  return ler().sort((a, b) => b.em - a.em).map(x => x.c);
}

// Em qualquer página: ?v=CÓDIGO marca o vendedor e sai do endereço (o cliente
// não fica vendo o código, nem o repassa sem querer).
export function CapturaVendedor() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('v')) return;
    guardarVendedor(params.get('v'));
    params.delete('v');
    const resto = params.toString();
    navigate(`${location.pathname}${resto ? `?${resto}` : ''}${location.hash}`, { replace: true });
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// /v/CÓDIGO — link curto da loja do vendedor: pergunta ao servidor a página
// da loja (loja, Food, serviço ou Disk Bebidas), marca e abre. Código que não
// existe: vai para a página inicial. Vendedor desativado: abre a loja sem marcar.
export function LinkVendedor() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    api.get(`/public/vendedor/${encodeURIComponent(String(codigo || '').toUpperCase())}`)
      .then(r => {
        if (r.data?.marcar) guardarVendedor(codigo);
        navigate(r.data?.destino || '/marketplace', { replace: true });
      })
      .catch(err => {
        if (err.response?.status === 404) navigate('/marketplace', { replace: true });
        else setFalhou(true);
      });
  }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm px-4 text-center">
      {falhou ? <a href="/marketplace" className="underline">Não conseguimos abrir a loja agora. Ver o IUB MAIS+</a> : 'Abrindo a loja...'}
    </div>
  );
}
