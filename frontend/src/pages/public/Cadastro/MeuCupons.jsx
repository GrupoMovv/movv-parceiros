import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Gift, Loader2 } from 'lucide-react';
import apiPainel from '../../../services/apiPainel';

const ABAS = [
  { valor: 'ativo', label: 'Ativos' },
  { valor: 'usado', label: 'Usados' },
  { valor: 'expirado', label: 'Expirados' },
];

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Cupons ganhos nos Joguinhos IUB MAIS+ (Roleta da Sorte, fase 1) — lista
// separada da carteirinha/benefícios porque tem ciclo de vida próprio
// (ativo/usado/expirado, um giro por dia).
export default function MeuCupons() {
  const [aba, setAba] = useState('ativo');
  const [cupons, setCupons] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [usandoId, setUsandoId] = useState(null);

  useEffect(() => {
    setCarregando(true);
    apiPainel.get('/roleta/meus-cupons', { params: { status: aba } })
      .then(res => setCupons(res.data.cupons))
      .catch(err => {
        // MeuPainelLayout (pai desta rota) já validou a sessão antes de
        // montar essa tela — um erro aqui é raro (rede, 401 bem no timing
        // errado). Sem toast vermelho: deixa a lista vazia, que já cai no
        // estado "nenhum cupom" existente logo abaixo, só loga pra debug.
        console.error('Erro ao carregar cupons:', err);
        setCupons([]);
      })
      .finally(() => setCarregando(false));
  }, [aba]);

  async function usarCupom(id) {
    setUsandoId(id);
    try {
      await apiPainel.post(`/roleta/cupons/${id}/usar`);
      toast.success('Cupom marcado como usado!');
      setCupons(atual => atual.filter(c => c.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao marcar cupom como usado');
    } finally {
      setUsandoId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-iub-roxo" />
        <h1 className="text-xl font-bold text-slate-900">Meus Cupons</h1>
      </div>

      <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
        {ABAS.map(a => (
          <button
            key={a.valor}
            type="button"
            onClick={() => setAba(a.valor)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${
              aba === a.valor ? 'bg-white text-iub-roxo shadow-sm' : 'text-slate-500'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-iub-roxo" /></div>
      ) : cupons.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-12">
          {aba === 'ativo' ? 'Nenhum cupom ativo. Gire a roleta pra ganhar um!' : `Nenhum cupom ${ABAS.find(a => a.valor === aba).label.toLowerCase()}.`}
        </p>
      ) : (
        <div className="space-y-3">
          {cupons.map(c => (
            <div key={c.id} className="rounded-2xl border-2 border-dashed border-iub-roxo/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {c.parceiro_logo_url ? (
                    <img src={c.parceiro_logo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-iub-roxo/10 flex items-center justify-center flex-shrink-0 text-iub-roxo font-bold">
                      {c.parceiro_nome?.[0]}
                    </div>
                  )}
                  <p className="font-semibold text-slate-800 text-sm truncate">{c.parceiro_nome}</p>
                </div>
                <p className="text-2xl font-black text-iub-dourado-escuro flex-shrink-0">
                  {c.desconto_percentual === 100 ? 'GRÁTIS' : `${c.desconto_percentual}%`}
                </p>
              </div>

              <p className="font-mono font-black text-center text-lg tracking-widest bg-slate-50 rounded-xl py-2 mt-3">
                {c.codigo_cupom}
              </p>

              <p className="text-center text-xs text-slate-400 mt-2">
                {c.status === 'usado' ? `Usado em ${formatarData(c.usado_em)}` : `Válido até ${formatarData(c.valido_ate)}`}
              </p>

              {aba === 'ativo' && (
                <button
                  type="button"
                  onClick={() => usarCupom(c.id)}
                  disabled={usandoId === c.id}
                  className="btn-iub-primary w-full mt-3 py-2.5 text-sm disabled:opacity-50"
                >
                  {usandoId === c.id ? 'Marcando...' : 'Usar cupom'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
