import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Pause, Play, Star, Loader2 } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';
import { CATEGORIAS_FILTRO } from '../public/Marketplace/parceirosData';

const CATEGORIAS = CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').map(c => c.label);
const LIMITE = 30;

export default function ParceiroProdutos() {
  const [produtos, setProdutos] = useState(null);
  const [total, setTotal] = useState(0);
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [excluindoId, setExcluindoId] = useState(null);

  const carregar = useCallback(() => {
    const params = {};
    if (categoria) params.categoria = categoria;
    if (status) params.status = status;
    if (busca.trim()) params.busca = busca.trim();
    apiParceiro.get('/parceiro/produtos', { params })
      .then(res => { setProdutos(res.data.produtos); setTotal(res.data.total); })
      .catch(() => toast.error('Erro ao carregar produtos'));
  }, [categoria, status, busca]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleToggle(produto) {
    try {
      await apiParceiro.put(`/parceiro/produtos/${produto.id}/toggle-status`);
      toast.success(produto.ativo ? 'Produto pausado' : 'Produto ativado');
      carregar();
    } catch {
      toast.error('Erro ao alterar status');
    }
  }

  async function handleExcluir(produto) {
    if (!window.confirm(`Excluir "${produto.nome}"? Essa ação não pode ser desfeita.`)) return;
    setExcluindoId(produto.id);
    try {
      await apiParceiro.delete(`/parceiro/produtos/${produto.id}`);
      toast.success('Produto excluído');
      carregar();
    } catch {
      toast.error('Erro ao excluir produto');
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: PRETO }}>Produtos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} de {LIMITE} produtos usados</p>
        </div>
        <Link
          to="/parceiro/painel/produtos/novo"
          className="flex items-center gap-2 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundColor: ROXO }}
        >
          <Plus className="w-4 h-4" /> Cadastrar novo produto
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome..."
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-slate-400" />
        </div>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none">
          <option value="">Todas categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none">
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="rascunho">Rascunho</option>
        </select>
      </div>

      {produtos === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>
      ) : produtos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <p className="text-slate-500 text-sm">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center">
                {p.fotos?.[0]?.url ? (
                  <img src={p.fotos[0].url} alt={p.nome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-300 text-xs">Sem foto</span>
                )}
                {p.destaque && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
                    <Star className="w-2.5 h-2.5" fill="#0F0F14" /> Destaque
                  </span>
                )}
                <span
                  className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-full"
                  style={p.rascunho ? { backgroundColor: '#E2E8F0', color: '#475569' } : p.ativo ? { backgroundColor: '#DCFCE7', color: '#166534' } : { backgroundColor: '#FEE2E2', color: '#991B1B' }}
                >
                  {p.rascunho ? 'Rascunho' : p.ativo ? 'Ativo' : 'Pausado'}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-sm truncate" style={{ color: PRETO }}>{p.nome}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-sm" style={{ color: ROXO }}>R$ {parseFloat(p.preco).toFixed(2)}</span>
                  {p.preco_associado && <span className="text-xs text-slate-400 line-through">R$ {parseFloat(p.preco_associado).toFixed(2)}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-auto pt-3">
                  <Link to={`/parceiro/painel/produtos/${p.id}`} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Link>
                  <button type="button" onClick={() => handleToggle(p)} title={p.ativo ? 'Pausar' : 'Ativar'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    {p.ativo ? <Pause className="w-3.5 h-3.5 text-slate-500" /> : <Play className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                  <button type="button" onClick={() => handleExcluir(p)} disabled={excluindoId === p.id} title="Excluir"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-red-50 transition-colors disabled:opacity-50">
                    {excluindoId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
