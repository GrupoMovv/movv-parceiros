import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { UserCheck, Loader2, ChevronRight, Upload, MessageCircle } from 'lucide-react';

function montarMensagemPadrao() {
  const link = `${window.location.origin}/cadastrar-associado`;
  return `🎉 Sua carteirinha SECI + IUB MAIS já está disponível!

Ative em 2 minutos:
👉 ${link}

Você vai precisar:
✅ Seu CPF
✅ CNPJ da sua empresa (peça ao RH se não souber)

Após ativar, você terá acesso:
🎫 Carteirinha digital no celular
💊 Descontos exclusivos em farmácias, ótica, restaurantes...
🛍️ Marketplace IUB MAIS — só pra associados

Dúvidas? Chame no WhatsApp do Sindicato!`;
}

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function SindicatoListaAprovadosTodasEmpresas() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sindicato-lista-aprovada/empresas');
      setEmpresas(res.data);
    } catch { toast.error('Erro ao carregar empresas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLembrete() {
    try {
      await navigator.clipboard.writeText(montarMensagemPadrao());
      toast.success('Mensagem copiada! Cole no WhatsApp e envie pro contato certo.');
    } catch {
      toast.error('Não foi possível copiar. Tente novamente.');
    }
  }

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" /></div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[#0C2D48]" />
            Lista de Aprovados
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Colaboradores de empresas parceiras (ex.: Reis) que podem se autocadastrar em /cadastrar-associado.
          </p>
        </div>
        <button
          onClick={() => navigate('/sindicato/lista-aprovados/importar')}
          className="flex items-center gap-2 whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
        >
          <Upload className="w-4 h-4" /> Importar Lista
        </button>
      </div>

      {empresas.length === 0 ? (
        <div className="card text-center py-16 text-slate-400">
          <p>Nenhuma lista importada ainda.</p>
          <button onClick={() => navigate('/sindicato/lista-aprovados/importar')} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Upload className="w-4 h-4" /> Importar primeira lista
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {empresas.map(e => (
            <div key={e.razao_social_empresa} className="card hover:border-[#C9A84C]/50 hover:shadow-gold transition-all duration-200 flex flex-col gap-3">
              <button
                onClick={() => navigate(`/sindicato/lista-aprovados/empresa/${encodeURIComponent(e.razao_social_empresa)}`)}
                className="text-left flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{e.razao_social_empresa}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{e.total_filiais} {e.total_filiais === 1 ? 'filial/CNPJ' : 'filiais/CNPJs'} · última importação {fmtData(e.ultima_importacao)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
              </button>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-lg font-bold text-slate-900">{e.total}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                </div>
                <div className="rounded-lg bg-emerald-50 py-2">
                  <p className="text-lg font-bold text-emerald-600">{e.ativados}</p>
                  <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Ativados</p>
                </div>
                <div className="rounded-lg bg-amber-50 py-2">
                  <p className="text-lg font-bold text-amber-600">{e.pendentes}</p>
                  <p className="text-[10px] text-amber-500 uppercase tracking-wide">Pendentes</p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => navigate(`/sindicato/lista-aprovados/empresa/${encodeURIComponent(e.razao_social_empresa)}`)}
                  className="btn-secondary flex-1 text-sm"
                >
                  Ver detalhes
                </button>
                <button onClick={handleLembrete} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl text-white" style={{ backgroundColor: '#25D366' }}>
                  <MessageCircle className="w-3.5 h-3.5" /> Lembrete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
