import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import api from '../../services/api';
import { maskDocumento, validCPF, validCNPJ, soDigitos } from '../../utils/documentos';
import { AvisoPrevia } from './UniversidadeHome';

// "Indicar cliente" do MOVV Partner: nome, WhatsApp, produto (um toque) e
// CPF ou CNPJ do cliente (obrigatório desde 23/10/2026: o mesmo cliente no
// mesmo produto fica com quem indicou primeiro). E-mail escondido atrás de
// um link. Com `previa` ("Ver como Partner" do admin) nada é gravado.
// A lista de produtos vem da tabela products (o servidor já filtra o que o
// Partner pode indicar). As outras contas continuam com a tela antiga.

const mascaraWhats = valor => {
  const d = String(valor).replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const VAZIO = { nome: '', whats: '', produto: null, cpf: '', email: '' };

export default function PartnerIndicar({ previa = false }) {
  const [produtos, setProdutos] = useState(null);
  const [f, setF] = useState(VAZIO);
  const [comEmail, setComEmail] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(null);

  useEffect(() => {
    api.get('/products').then(r => setProdutos(r.data.filter(p => p.is_active !== false)))
      .catch(() => { setProdutos([]); toast.error('Não deu para carregar os produtos'); });
  }, []);

  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const whatsOk = f.whats.replace(/\D/g, '').length >= 10;
  const docDig = soDigitos(f.cpf);
  const docOk = validCPF(docDig) || validCNPJ(docDig);
  const docErrado = (docDig.length === 11 || docDig.length === 14) && !docOk;
  const pronto = f.nome.trim().length >= 2 && whatsOk && f.produto && docOk;

  async function enviar(e) {
    e.preventDefault();
    if (!pronto) return;
    if (previa) { toast('Prévia: nada foi gravado.', { icon: '👀' }); return; }
    setEnviando(true);
    try {
      const r = await api.post('/referrals', {
        client_name: f.nome.trim(),
        client_whatsapp: f.whats.replace(/\D/g, ''),
        product_id: f.produto.id,
        client_documento: docDig,
        ...(comEmail && f.email.trim() && { client_email: f.email.trim() }),
      });
      setFeito({ nome: f.nome.trim().split(' ')[0], produto: f.produto.name, protocolo: r.data.protocol });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não deu para registrar. Tente de novo.');
    } finally { setEnviando(false); }
  }

  if (feito) {
    return (
      <div className="max-w-md mx-auto card text-center py-8 space-y-4">
        <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" />
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900">Indicação registrada!</h1>
          <p className="text-slate-600 mt-1">{feito.nome} · {feito.produto}</p>
          <p className="text-xs text-slate-400 mt-1">Protocolo {feito.protocolo} enviado ao cliente pelo WhatsApp.</p>
        </div>
        <div className="grid gap-2">
          <button type="button" className="btn-primary min-h-[48px]" onClick={() => { setF(VAZIO); setComEmail(false); setFeito(null); }}>Indicar outro</button>
          <Link to="/partner/vendas" className="btn-secondary min-h-[48px] flex items-center justify-center">Ver minhas vendas</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="max-w-md mx-auto space-y-4">
      {previa && <AvisoPrevia />}
      <h1 className="text-xl font-display font-semibold text-slate-900">Indicar cliente</h1>

      <div>
        <label className="label" htmlFor="ind-nome">Nome do cliente</label>
        <input id="ind-nome" className="input min-h-[48px]" autoComplete="off" autoCapitalize="words"
          value={f.nome} onChange={e => set('nome', e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="ind-whats">WhatsApp</label>
        <input id="ind-whats" className="input min-h-[48px]" type="tel" inputMode="numeric" placeholder="(64) 99999-9999"
          value={f.whats} onChange={e => set('whats', mascaraWhats(e.target.value))} />
      </div>

      <div>
        <p className="label">Produto</p>
        {!produtos ? (
          <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-movv-900" /></div>
        ) : produtos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum produto disponível. Fale com a Central.</p>
        ) : (
          <div className={`grid grid-cols-2 gap-2 ${produtos.length > 6 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}>
            {produtos.map(p => {
              const ativo = f.produto?.id === p.id;
              return (
                <button key={p.id} type="button" onClick={() => set('produto', p)} aria-pressed={ativo}
                  className={`min-h-[56px] rounded-xl border px-3 py-2 text-sm font-semibold text-left leading-tight transition-colors ${ativo ? 'bg-movv-900 text-white border-movv-900' : 'bg-white text-slate-700 border-slate-200 hover:border-movv-700'}`}>
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="ind-cpf">CPF ou CNPJ do cliente</label>
        <input id="ind-cpf" className="input min-h-[48px]" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
          aria-invalid={docErrado} aria-describedby="ind-cpf-ajuda"
          value={f.cpf} onChange={e => set('cpf', maskDocumento(e.target.value))} />
        {docErrado
          ? <p id="ind-cpf-ajuda" role="alert" className="text-xs text-red-600 font-medium mt-1">CPF ou CNPJ inválido. Confira os números.</p>
          : <p id="ind-cpf-ajuda" className="text-xs text-slate-500 mt-1">Obrigatório. Garante que o cliente fique com você.</p>}
      </div>

      {comEmail ? (
        <div>
          <label className="label" htmlFor="ind-email">E-mail do cliente</label>
          <input id="ind-email" className="input min-h-[48px]" type="email" inputMode="email" autoComplete="off"
            value={f.email} onChange={e => set('email', e.target.value)} />
        </div>
      ) : (
        <button type="button" className="text-sm font-semibold text-movv-900 min-h-[44px]" onClick={() => setComEmail(true)}>+ adicionar e-mail</button>
      )}

      <button type="submit" disabled={!pronto || enviando}
        className="w-full min-h-[56px] rounded-2xl bg-gold-gradient text-movv-900 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
        {enviando ? <Loader2 className="w-6 h-6 animate-spin" /> : <><UserPlus className="w-6 h-6" /> Indicar</>}
      </button>
    </form>
  );
}
