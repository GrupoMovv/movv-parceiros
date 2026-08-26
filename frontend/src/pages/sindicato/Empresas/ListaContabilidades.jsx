import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { Building2, Loader2, ChevronRight } from 'lucide-react';

export default function SindicatoEmpresasListaContabilidades() {
  const navigate = useNavigate();
  const [contabilidades, setContabilidades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/sindicato-empresas/contabilidades');
        setContabilidades(res.data);
      } catch { toast.error('Erro ao carregar contabilidades'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#0C2D48]" />
          Empresas
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Contabilidades parceiras do Sindicato — escolha uma para ver e cobrar as empresas vinculadas.
        </p>
      </div>

      {contabilidades.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">Nenhuma contabilidade cadastrada</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contabilidades.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/sindicato/empresas/contabilidade/${c.id}`)}
              className="card text-left hover:border-[#C9A84C]/50 hover:shadow-gold transition-all duration-200 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{c.nome_fantasia || c.razao_social}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{c.cnpj || 'CNPJ não informado'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{c.cidade || '—'}{c.estado ? `/${c.estado}` : ''}</span>
                <span className="badge-approved">{c.total_empresas} {c.total_empresas === 1 ? 'empresa' : 'empresas'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
