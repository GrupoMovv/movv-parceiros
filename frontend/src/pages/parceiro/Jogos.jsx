import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Sparkles } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO } from '../public/Marketplace/theme';

const NOMES_PLANO = { gratis: 'IUB Grátis', oficial: 'IUB Oficial', premium: 'IUB Premium', master: 'IUB Master' };

// Aba "🎰 Roleta da Sorte" no painel do parceiro — opt-in no jogo (Fase 1
// dos IUB MAIS+ Joguinhos). Grátis não participa; os outros planos
// configuram desconto/cupons por dia/validade dentro de limites fixos
// (validados também no backend, ver parceiroJogosController.js).
export default function ParceiroJogos() {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [dados, setDados] = useState(null); // resposta de GET /parceiro/jogos
  const [form, setForm] = useState({ ativo: false, desconto_percentual: 10, cupons_dia: 5, validade_dias: 7 });

  useEffect(() => {
    apiParceiro.get('/parceiro/jogos')
      .then(res => {
        setDados(res.data);
        if (res.data.config) {
          setForm({
            ativo: res.data.config.ativo,
            desconto_percentual: res.data.config.desconto_percentual,
            cupons_dia: res.data.config.cupons_dia,
            validade_dias: res.data.config.validade_dias,
          });
        }
      })
      .catch(() => toast.error('Erro ao carregar configuração dos jogos'))
      .finally(() => setCarregando(false));
  }, []);

  async function salvar(novoAtivo) {
    setSalvando(true);
    const payload = { ...form, ativo: novoAtivo };
    try {
      const res = await apiParceiro.put('/parceiro/jogos', payload);
      setForm({ ativo: res.data.ativo, desconto_percentual: res.data.desconto_percentual, cupons_dia: res.data.cupons_dia, validade_dias: res.data.validade_dias });
      setDados(d => ({ ...d, config: res.data }));
      toast.success('Configuração salva!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;
  }

  if (!dados.pode_ativar) {
    return (
      <div className="card text-center py-12">
        <Sparkles className="w-10 h-10 mx-auto text-slate-300" />
        <h2 className="text-lg font-bold text-slate-800 mt-3">🎰 Roleta da Sorte</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
          Seu plano atual ({NOMES_PLANO[dados.plano] || dados.plano}) não participa dos Joguinhos IUB MAIS+.
          Fale com o Sindicato pra fazer upgrade e distribuir cupons pra milhares de associados todo dia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">🎰 Roleta da Sorte</h2>
            <p className="text-slate-500 text-sm mt-1">
              Associados giram 1x por dia e podem ganhar um cupom da sua loja. Você controla quanto dar e quantos por dia.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => salvar(e.target.checked)}
              disabled={salvando}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-checked:bg-emerald-500 rounded-full transition-colors" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
          </label>
        </div>

        {form.ativo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div>
              <label className="label">Desconto (5-50%)</label>
              <input
                type="number" min={5} max={50} className="input"
                value={form.desconto_percentual}
                onChange={e => setForm(f => ({ ...f, desconto_percentual: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Cupons por dia (1-20)</label>
              <input
                type="number" min={1} max={20} className="input"
                value={form.cupons_dia}
                onChange={e => setForm(f => ({ ...f, cupons_dia: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Validade (1-30 dias)</label>
              <input
                type="number" min={1} max={30} className="input"
                value={form.validade_dias}
                onChange={e => setForm(f => ({ ...f, validade_dias: Number(e.target.value) }))}
              />
            </div>
          </div>
        )}

        {form.ativo && (
          <button type="button" onClick={() => salvar(true)} disabled={salvando} className="btn-primary mt-5 disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        )}
      </div>

      {dados.config && (
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-4">Analytics</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-slate-900">{dados.analytics.cupons_distribuidos_hoje}</p>
              <p className="text-xs text-slate-400 mt-1">Distribuídos hoje</p>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{dados.analytics.cupons_usados_hoje}</p>
              <p className="text-xs text-slate-400 mt-1">Usados hoje</p>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{dados.analytics.taxa_resgate_percentual}%</p>
              <p className="text-xs text-slate-400 mt-1">Taxa de resgate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
