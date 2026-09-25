import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Inbox, Loader2, ChevronLeft, ChevronRight, MessageCircle,
  CheckCircle2, XCircle, PhoneCall,
} from 'lucide-react';
import { linkWhatsapp } from '../../../utils/carteirinhaWhatsapp';

const LIMIT = 20;

const STATUS_LABEL = {
  pendente:   { label: 'Pendente',   cls: 'bg-amber-100 text-amber-700' },
  contatado:  { label: 'Contatado',  cls: 'bg-blue-100 text-blue-700' },
  convertido: { label: 'Convertido', cls: 'bg-emerald-100 text-emerald-700' },
  rejeitado:  { label: 'Rejeitado',  cls: 'bg-slate-100 text-slate-500' },
};

function fmtCnpj(v) {
  const d = String(v || '').replace(/\D/g, '').padStart(14, '0');
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function fmtDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

export default function SindicatoSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState('pendente');
  const [loading, setLoading] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFiltro) params.status = statusFiltro;
      const res = await api.get('/sindicato-solicitacoes', { params });
      setSolicitacoes(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }, [page, statusFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleAtualizarStatus(id, status) {
    setAtualizandoId(id);
    try {
      await api.patch(`/sindicato-solicitacoes/${id}/status`, { status });
      toast.success('Atualizado!');
      carregar();
    } catch {
      toast.error('Erro ao atualizar');
    } finally {
      setAtualizandoId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Inbox className="w-6 h-6 text-movv-900" /> Solicitações de Empresas
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Colaboradores de empresas ainda não cadastradas no Sindicato que pediram contato pelo /cadastrar
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[['', 'Todas'], ['pendente', 'Pendentes'], ['contatado', 'Contatados'], ['convertido', 'Convertidos'], ['rejeitado', 'Rejeitados']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => { setStatusFiltro(v); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFiltro === v ? 'bg-movv-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : solicitacoes.length === 0 ? (
          <p className="text-center text-slate-400 py-12">Nenhuma solicitação encontrada</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {solicitacoes.map(s => (
              <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{s.nome_solicitante}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_LABEL[s.status]?.cls}`}>
                      {STATUS_LABEL[s.status]?.label}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {s.nome_empresa || 'Empresa não informada'} · CNPJ {fmtCnpj(s.cnpj_digitado)}
                    {s.cargo && ` · ${s.cargo}`}
                  </p>
                  {s.mensagem && <p className="text-slate-400 text-xs mt-1 italic">"{s.mensagem}"</p>}
                  <p className="text-slate-400 text-xs mt-1">
                    {fmtDataHora(s.created_at)}
                    {s.atendido_por_nome && ` · atendido por ${s.atendido_por_nome}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  <a
                    href={linkWhatsapp(s.whatsapp_solicitante)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                  {s.status !== 'contatado' && (
                    <button
                      onClick={() => handleAtualizarStatus(s.id, 'contatado')}
                      disabled={atualizandoId === s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      <PhoneCall className="w-3.5 h-3.5" /> Contatado
                    </button>
                  )}
                  {s.status !== 'convertido' && (
                    <button
                      onClick={() => handleAtualizarStatus(s.id, 'convertido')}
                      disabled={atualizandoId === s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Convertido
                    </button>
                  )}
                  {s.status !== 'rejeitado' && (
                    <button
                      onClick={() => handleAtualizarStatus(s.id, 'rejeitado')}
                      disabled={atualizandoId === s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rejeitar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-slate-500 text-xs">Página {page} de {totalPages} · {total} solicitações</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-2 py-1.5 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary px-2 py-1.5 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
