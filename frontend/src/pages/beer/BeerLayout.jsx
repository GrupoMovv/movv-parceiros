import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../../services/api';
import TopNav from '../public/Marketplace/components/TopNav';
import Footer from '../public/Marketplace/components/Footer';
import MobileBottomNav from '../public/Marketplace/components/MobileBottomNav';
import { useAssociadoSessao } from '../public/Marketplace/useAssociadoSessao';
import ModalMaiorIdade from '../../components/beer/ModalMaiorIdade';
import CardProduto from '../../components/beer/CardProduto';
import { useAcessoBeer } from './useAcessoBeer';
import { AVISO_VITRINE, BEER } from './beerConfig';

// Casca de TODAS as rotas /beer/* (home, Quero Agora, categoria,
// estabelecimento, busca): porta +18 num lugar só — nada da área é buscado
// nem renderizado antes de liberar — e o catálogo de categorias carregado
// uma vez e repassado pelo Outlet (useOutletContext nas páginas).
export default function BeerLayout() {
  const navigate = useNavigate();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;
  const { estado, confirmar } = useAcessoBeer();
  const [busca, setBusca] = useState('');
  const [categorias, setCategorias] = useState(null);
  const [resumo, setResumo] = useState(null);

  useEffect(() => {
    if (estado !== 'liberado') return;
    api.get('/public/beer/categorias').then(res => setCategorias(res.data.grupos)).catch(() => setCategorias([]));
    api.get('/public/beer/resumo').then(res => setResumo(res.data)).catch(() => {});
  }, [estado]);

  return (
    <div className="min-h-screen w-full flex flex-col pb-14 sm:pb-0" style={{ backgroundColor: BEER.fundo }}>
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregandoAssociado}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery={busca}
        onSearchChange={setBusca}
        onSearchSubmit={() => busca.trim() && navigate(`/beer/busca?q=${encodeURIComponent(busca.trim())}`)}
      />

      {estado === 'modal' && <ModalMaiorIdade onConfirmar={confirmar} onCancelar={() => navigate('/marketplace')} />}

      {estado === 'bloqueado' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
          <div className="text-5xl" aria-hidden="true">🔞</div>
          <h1 className="mt-4 text-xl sm:text-2xl font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Área exclusiva para maiores de 18 anos</h1>
          <p className="mt-2 text-sm max-w-sm" style={{ color: BEER.lavanda }}>Pela data de nascimento do seu cadastro, o IUB Disk Bebidas ainda não está liberado pra você.</p>
          <Link to="/marketplace" className="mt-6 text-sm font-bold px-6 py-3 rounded-2xl text-white" style={{ backgroundColor: BEER.violeta }}>Voltar pro marketplace</Link>
        </div>
      )}

      {(estado === 'verificando' || estado === 'modal') && <div className="flex-1 min-h-[60vh]" />}

      {estado === 'liberado' && (
        <>
          <div className="flex-1">
            <Outlet context={{ categorias, resumo }} />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full pb-10 pt-4 text-center space-y-2">
            <p className="text-[11px] leading-relaxed max-w-2xl mx-auto" style={{ color: BEER.lavandaFraca }}>{AVISO_VITRINE}</p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(196,181,253,0.45)' }}>
              Proibida a venda de bebidas alcoólicas e cigarros para menores de 18 anos (Lei 13.106/2015). Aprecie com moderação. Se beber, não dirija.
            </p>
          </div>
        </>
      )}

      <Footer />
      <MobileBottomNav nomeAssociado={nomeAssociado} onLoginSuccess={recarregar} />
    </div>
  );
}

// Cabeçalho das páginas internas (Quero Agora, categoria, busca...).
export function CabecalhoBeer({ titulo, subtitulo, voltar = '/beer', direita = null }) {
  return (
    <header style={{ background: `radial-gradient(120% 160% at 90% 0%, ${BEER.violeta} 0%, ${BEER.roxo} 40%, ${BEER.painel} 85%)` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-6 sm:py-9 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {voltar && <Link to={voltar} className="text-xs font-semibold hover:underline" style={{ color: BEER.lavanda }}>← Disk Bebidas</Link>}
          <h1 className="mt-1 text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>{titulo}</h1>
          {subtitulo && <p className="mt-1.5 text-sm sm:text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>{subtitulo}</p>}
        </div>
        {direita}
      </div>
    </header>
  );
}

// Grade padrão de produtos + estados de carregando/vazio/erro.
export function GradeProdutos({ produtos, carregando, erro, vazio, agora = false, mostrarEstabelecimento = true, onTentarDeNovo }) {
  if (erro) {
    return (
      <Vazio titulo="Não foi possível carregar agora." acao={onTentarDeNovo && (
        <button type="button" onClick={onTentarDeNovo} className="text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: BEER.violeta }}>Tentar de novo</button>
      )} />
    );
  }
  if (carregando) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ backgroundColor: BEER.painel }} />)}
      </div>
    );
  }
  if (!produtos.length) return vazio;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {produtos.map(p => <CardProduto key={p.id} produto={p} agora={agora} mostrarEstabelecimento={mostrarEstabelecimento} />)}
    </div>
  );
}

export function Vazio({ emoji, titulo, texto, acao }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-14 px-4 rounded-3xl" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
      {emoji && <div className="text-5xl" aria-hidden="true">{emoji}</div>}
      <p className="text-lg font-black text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{titulo}</p>
      {texto && <p className="text-sm max-w-md" style={{ color: BEER.lavanda }}>{texto}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}
