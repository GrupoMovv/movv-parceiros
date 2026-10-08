import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, FlaskConical } from 'lucide-react';
import api from '../../services/api';

// /admin/testadores — acesso de testador (08/10). A conta de cliente marcada
// vê e compra nas lojas de teste (modo QA) sem a senha de admin. A marca
// vale 30 dias e desliga sozinha; cada ligar/desligar fica registrado.
const data = d => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const dataHora = d => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Linha({ c, onMudar, mudando }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 font-semibold text-sm truncate">{c.nome_completo}</p>
        <p className="text-slate-500 text-xs">
          {c.tipo_acesso === 'seci' ? 'Associado SECI' : 'Cliente'} · CPF {c.cpf || '—'} · WhatsApp {c.whatsapp || '—'}
        </p>
        {c.testador_ativo && <p className="text-amber-700 text-xs mt-0.5 font-semibold">🧪 Testador até {data(c.testador_ate)}</p>}
        {c.ultimo_registro && (
          <p className="text-slate-400 text-[11px] mt-0.5">
            Último: {c.ultimo_registro.acao} em {dataHora(c.ultimo_registro.em)}{c.ultimo_registro.por ? ` por ${c.ultimo_registro.por}` : ''}
          </p>
        )}
      </div>
      <button type="button" disabled={mudando === c.id} onClick={() => onMudar(c, !c.testador_ativo)}
        className={`text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 ${c.testador_ativo ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-amber-400 text-amber-950 hover:bg-amber-300'}`}>
        {c.testador_ativo ? 'Desligar' : 'Ligar por 30 dias'}
      </button>
    </div>
  );
}

export default function AdminTestadores() {
  const [q, setQ] = useState('');
  const [dados, setDados] = useState({ ativos: [], busca: [] });
  const [mudando, setMudando] = useState(null);

  async function carregar(termo = q) {
    try {
      const r = await api.get('/admin/testadores', { params: { q: termo } });
      setDados(r.data);
    } catch { toast.error('Erro ao carregar testadores'); }
  }
  useEffect(() => { carregar(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function mudar(c, ligar) {
    setMudando(c.id);
    try {
      await api.post(`/admin/testadores/${c.id}/${ligar ? 'ligar' : 'desligar'}`);
      toast.success(ligar ? `${c.nome_completo} é testador por 30 dias` : 'Acesso de testador desligado');
      await carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    } finally { setMudando(null); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-slate-900 text-2xl font-bold flex items-center gap-2"><FlaskConical className="w-6 h-6" /> Testadores</h1>
        <p className="text-slate-500 text-sm mt-1">
          Conta de cliente marcada como testador vê e compra nas lojas de teste, sem a senha de admin. A marca vale 30 dias e desliga sozinha.
          No site aparece o aviso "Modo teste".
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-slate-800 font-semibold text-sm mb-2">Testadores ativos ({dados.ativos.length})</h2>
        {dados.ativos.length === 0 ? <p className="text-slate-500 text-sm">Nenhum.</p>
          : dados.ativos.map(c => <Linha key={c.id} c={c} onMudar={mudar} mudando={mudando} />)}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <form onSubmit={e => { e.preventDefault(); carregar(q); }} className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, CPF ou WhatsApp da conta"
            className="flex-1 px-3 py-2.5 text-sm rounded-xl bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          <button type="submit" className="btn-primary flex items-center gap-1.5 text-sm"><Search className="w-4 h-4" /> Buscar</button>
        </form>
        {q.trim().length >= 3 && (
          <div className="mt-3">
            {dados.busca.length === 0 ? <p className="text-slate-500 text-sm">Nenhuma conta encontrada.</p>
              : dados.busca.map(c => <Linha key={c.id} c={c} onMudar={mudar} mudando={mudando} />)}
          </div>
        )}
      </div>
    </div>
  );
}
