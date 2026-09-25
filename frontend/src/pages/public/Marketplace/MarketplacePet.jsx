import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ImageOff, MapPin, SlidersHorizontal } from 'lucide-react';
import api, { assetUrl } from '../../../services/api';
import TopNav from './components/TopNav';
import MobileBottomNav from './components/MobileBottomNav';
import Footer from './components/Footer';
import SeloPlano from './components/SeloPlano';
import { useAssociadoSessao } from './useAssociadoSessao';
import { usePetCatalogo } from '../../../components/PetServicosPicker';
import { ROXO, ROXO_ESCURO, GRAFITE } from './theme';

const FILTROS = ['servico', 'porte', 'bairro', 'raca', 'preco_min', 'preco_max', 'ordem'];
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// 🐾 Pet em Itumbiara: pet shops com filtro por serviço, porte, bairro, raça
// especializada e faixa de preço (Pet parte 2). Filtros ficam na URL — dá pra
// compartilhar a busca ("banho pra porte grande no Centro").
export default function MarketplacePet() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { associado, carregando: carregandoAssociado, logout, recarregar } = useAssociadoSessao();
  const nomeAssociado = associado?.nome_completo?.trim().split(/\s+/)[0] || null;
  const catalogo = usePetCatalogo();

  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [precoMin, setPrecoMin] = useState(params.get('preco_min') || '');
  const [precoMax, setPrecoMax] = useState(params.get('preco_max') || '');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const filtro = Object.fromEntries(FILTROS.map(f => [f, params.get(f) || '']));
  const chave = params.toString();

  useEffect(() => {
    setErro(false);
    api.get('/public/pet/parceiros', { params: Object.fromEntries(FILTROS.filter(f => params.get(f)).map(f => [f, params.get(f)])) })
      .then(r => setDados(r.data))
      .catch(() => setErro(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  function definir(campo, valor) {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(campo, valor); else novo.delete(campo);
    setParams(novo, { replace: true });
  }
  function alternar(campo, valor) { definir(campo, filtro[campo] === valor ? '' : valor); }
  function aplicarPreco() {
    const novo = new URLSearchParams(params);
    for (const [k, v] of [['preco_min', precoMin], ['preco_max', precoMax]]) {
      const n = String(v).replace(/[^\d]/g, '');
      if (n) novo.set(k, n); else novo.delete(k);
    }
    setParams(novo, { replace: true });
  }
  function limpar() { setPrecoMin(''); setPrecoMax(''); setParams(new URLSearchParams(), { replace: true }); }

  const qtdFiltros = FILTROS.filter(f => f !== 'ordem' && filtro[f]).length;
  const nome = (lista, c) => lista?.find(x => x.codigo === c)?.nome;

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pb-14 sm:pb-0">
      <TopNav
        nomeAssociado={nomeAssociado}
        nomeCompleto={associado?.nome_completo}
        fotoUrl={associado?.foto_url ? assetUrl(associado.foto_url) : null}
        carteirinhaHash={associado?.carteirinha_hash}
        carregandoAssociado={carregandoAssociado}
        onSair={logout}
        onLoginSuccess={recarregar}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => navigate('/marketplace')}
      />

      <div className="px-6 py-10 sm:py-12 text-center" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 55%, #F59E0B 150%)' }}>
        <h1 className="text-white font-black text-2xl sm:text-4xl">🐾 PET EM ITUMBIARA</h1>
        <p className="text-white/85 text-sm sm:text-lg mt-2">Banho e tosa, veterinária, hotelzinho, ração e mais</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-6 flex-1">
        {catalogo && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {catalogo.servicos.map(s => (
                <Chip key={s.codigo} ativo={filtro.servico === s.codigo} onClick={() => alternar('servico', s.codigo)}>{s.emoji} {s.nome}</Chip>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <button type="button" onClick={() => setFiltrosAbertos(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-700">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros{qtdFiltros ? ` (${qtdFiltros})` : ''}
              </button>
              <select value={filtro.ordem} onChange={e => definir('ordem', e.target.value)} className="text-xs font-semibold rounded-xl border border-slate-200 px-2 py-2 text-slate-600" aria-label="Ordenar">
                <option value="">Destaques</option>
                <option value="preco">Menor preço</option>
                <option value="nome">A–Z</option>
              </select>
            </div>

            {filtrosAbertos && (
              <div className="mt-3 rounded-2xl border border-slate-100 p-4 space-y-4 bg-slate-50">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Porte do pet</p>
                  <div className="flex flex-wrap gap-2">
                    {catalogo.portes.map(p => (
                      <Chip key={p.codigo} ativo={filtro.porte === p.codigo} onClick={() => alternar('porte', p.codigo)}>{p.nome} <span className="font-normal opacity-70">({p.faixa})</span></Chip>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-500">Bairro
                    <select value={filtro.bairro} onChange={e => definir('bairro', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                      <option value="">Todos os bairros</option>
                      {(dados?.facetas.bairros || []).map(b => <option key={b.bairro} value={b.bairro}>{b.bairro} ({b.total})</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">Raça (especialista)
                    <select value={filtro.raca} onChange={e => definir('raca', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                      <option value="">Qualquer raça</option>
                      {catalogo.racas.map(r => <option key={r.codigo} value={r.codigo}>{r.nome}</option>)}
                    </select>
                  </label>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Faixa de preço{filtro.servico ? ` (${nome(catalogo.servicos, filtro.servico)})` : ''}</p>
                  <div className="flex items-center gap-2">
                    <input inputMode="numeric" value={precoMin} onChange={e => setPrecoMin(e.target.value)} onBlur={aplicarPreco}
                      placeholder={dados?.facetas.preco.min != null ? `de R$ ${Math.floor(dados.facetas.preco.min)}` : 'de R$'} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" aria-label="Preço mínimo" />
                    <span className="text-slate-400 text-xs">até</span>
                    <input inputMode="numeric" value={precoMax} onChange={e => setPrecoMax(e.target.value)} onBlur={aplicarPreco}
                      placeholder={dados?.facetas.preco.max != null ? `R$ ${Math.ceil(dados.facetas.preco.max)}` : 'R$'} className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" aria-label="Preço máximo" />
                    <button type="button" onClick={aplicarPreco} className="text-xs font-bold px-3 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Aplicar</button>
                  </div>
                </div>
                {qtdFiltros > 0 && <button type="button" onClick={limpar} className="text-xs font-semibold text-slate-500 underline">Limpar filtros</button>}
              </div>
            )}
          </>
        )}

        <p className="text-slate-400 text-xs mt-4 mb-3">
          {dados && `${dados.parceiros.length} pet shop${dados.parceiros.length === 1 ? '' : 's'}`}
        </p>

        {erro ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm">Não foi possível carregar os pet shops agora.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-3 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Tentar de novo</button>
          </div>
        ) : !dados ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[132px] rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : dados.parceiros.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm">Nenhum pet shop com esses filtros.</p>
            {qtdFiltros > 0 && <button type="button" onClick={limpar} className="mt-3 text-sm font-semibold underline" style={{ color: ROXO }}>Limpar filtros</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dados.parceiros.map(p => <CardPetShop key={p.slug} p={p} catalogo={catalogo} filtro={filtro} />)}
          </div>
        )}
      </div>

      <Footer />
      <MobileBottomNav nomeAssociado={nomeAssociado} onLoginSuccess={recarregar} />
    </div>
  );
}

function CardPetShop({ p, catalogo, filtro }) {
  const nome = (lista, c) => lista?.find(x => x.codigo === c)?.nome;
  const emojis = (catalogo?.servicos || []).filter(s => p.pet_servicos.includes(s.codigo));
  const racaFiltro = nome(catalogo?.racas, filtro.raca);
  const racasNomes = p.pet_racas.map(r => nome(catalogo?.racas, r)).filter(Boolean);
  const racasTexto = racasNomes.length > 2 ? `${racasNomes.slice(0, 2).join(', ')} +${racasNomes.length - 2}` : racasNomes.join(', ');
  const rotuloPreco = [nome(catalogo?.servicos, filtro.servico), nome(catalogo?.portes, filtro.porte)].filter(Boolean).join(' · ');
  return (
    <Link to={`/servicos/${p.slug}`} className="flex gap-3 rounded-2xl border border-slate-100 p-3 hover:border-slate-200 hover:shadow-sm transition">
      <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
        {p.logo_url ? <img src={p.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-6 h-6 text-slate-200" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm truncate" style={{ color: GRAFITE }}>{p.nome}</p>
          <SeloPlano plano={p.plano} />
        </div>
        {p.bairro && <p className="text-[11px] text-slate-400 flex items-center gap-0.5 mt-0.5"><MapPin className="w-3 h-3" /> {p.bairro}</p>}
        <p className="text-sm mt-1" title={emojis.map(s => s.nome).join(', ')}>{emojis.map(s => s.emoji).join(' ')}</p>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[11px] font-semibold text-slate-500 truncate">
            {p.especialista ? `⭐ Especialista em ${racaFiltro}` : racasTexto ? `Especialista: ${racasTexto}` : 'Atende todas as raças'}
          </span>
          {p.preco_a_partir != null && (
            <span className="text-xs font-black whitespace-nowrap" style={{ color: ROXO_ESCURO }} title={rotuloPreco}>a partir de {brl(p.preco_a_partir)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Chip({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${ativo ? 'text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
      style={ativo ? { backgroundColor: ROXO, borderColor: ROXO } : {}}>
      {children}
    </button>
  );
}
