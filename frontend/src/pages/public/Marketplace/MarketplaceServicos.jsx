import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../../../services/api';
import TopNav from './components/TopNav';
import CardServico from './components/CardServico';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import { useFavoritos } from './useFavoritos';
import { useAssociadoSessao } from './useAssociadoSessao';
import { ROXO } from './theme';

function normalizarCategoria(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Listagem de prestadores de serviço (tipo_negocio servico/hibrido) — os
// chips de filtro vêm das categorias[] REAIS dos parceiros (não a
// taxonomia de 6 categorias do brief original, que não bate 1:1 com o
// dado real — ex.: Diroma Fiori é "Hotelaria", não cabe em nenhuma das 6
// — inventar esse mapeamento seria dado fabricado, não uso).
export default function MarketplaceServicos() {
  const navigate = useNavigate();
  const { favoritos } = useFavoritos();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);
  const [ordemAlfabetica, setOrdemAlfabetica] = useState(false);

  useEffect(() => {
    setCarregando(true);
    setErro(false);
    api.get('/public/marketplace/servicos')
      .then(res => setServicos(res.data.servicos))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);

  const categorias = useMemo(() => {
    const vistas = new Map();
    servicos.forEach(s => (s.categorias || []).forEach(c => {
      const chave = normalizarCategoria(c);
      if (chave && !vistas.has(chave)) vistas.set(chave, c);
    }));
    return [...vistas.values()];
  }, [servicos]);

  const servicosFiltrados = useMemo(() => {
    let lista = servicos;
    if (categoriaAtiva) {
      lista = lista.filter(s => (s.categorias || []).some(c => normalizarCategoria(c) === normalizarCategoria(categoriaAtiva)));
    }
    if (ordemAlfabetica) lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return lista;
  }, [servicos, categoriaAtiva, ordemAlfabetica]);

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregandoAssociado}
        favoritosAtivos={false}
        onToggleFavoritos={() => navigate('/marketplace')}
        qtdFavoritos={favoritos.length}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => navigate('/marketplace')}
      />

      <div className="px-6 py-10 sm:py-14 text-center" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 60%, #B87E00 150%)' }}>
        <h1 className="text-white font-black text-2xl sm:text-4xl">🎯 SERVIÇOS EM ITUMBIARA</h1>
        <p className="text-white/85 text-sm sm:text-lg mt-2">Encontre profissionais qualificados</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-6 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <ChipFiltro label="Todos" ativo={!categoriaAtiva} onClick={() => setCategoriaAtiva(null)} />
          {categorias.map(c => (
            <ChipFiltro key={c} label={c} ativo={normalizarCategoria(categoriaAtiva) === normalizarCategoria(c)} onClick={() => setCategoriaAtiva(c)} />
          ))}
        </div>

        <div className="flex items-center justify-between mb-4 mt-3">
          <p className="text-slate-400 text-xs">
            {!carregando && `${servicosFiltrados.length} prestador${servicosFiltrados.length === 1 ? '' : 'es'}`}
          </p>
          <button type="button" onClick={() => setOrdemAlfabetica(v => !v)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline">
            {ordemAlfabetica ? 'Ordenar por destaque' : 'Ordenar A-Z'}
          </button>
        </div>

        {erro ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-slate-500 text-sm">Não foi possível carregar os serviços agora.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
              style={{ backgroundColor: ROXO }}
            >
              Tentar de novo
            </button>
          </div>
        ) : carregando ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[220px] rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : servicosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p className="text-slate-400 text-sm">Nenhum serviço encontrado nessa categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {servicosFiltrados.map(s => <CardServico key={s.id} servico={s} />)}
          </div>
        )}
      </div>

      <Footer />

      <MobileBottomNav favoritosAtivos={false} onToggleFavoritos={() => navigate('/marketplace')} nomeAssociado={nomeAssociado} onLoginSuccess={recarregar} />
    </div>
  );
}

function ChipFiltro({ label, ativo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors mb-2 ${
        ativo ? 'text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
      style={ativo ? { backgroundColor: ROXO, borderColor: ROXO } : {}}
    >
      {label}
    </button>
  );
}
