import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { MagnifyingGlass, Storefront, CaretDown } from '@phosphor-icons/react';
import api from '../../services/api';
import MenuMobileMaisAcessados from '../../components/beer/MenuMobileMaisAcessados';
import BotaoMonteSeuDrink from '../../components/beer/BotaoMonteSeuDrink';
import CardEstabelecimento from '../../components/beer/CardEstabelecimento';
import { Vazio } from './BeerLayout';
import { BEER, ROXINHO_GENTLEMAN_URL } from './beerConfig';

// Faixa de cada plano na lista de estabelecimentos — a ORDEM vem do backend
// (Master > Premium > Oficial > Grátis); aqui só a grade de cada faixa,
// porque cada plano tem um tamanho de card.
const GRADE_POR_PLANO = {
  master: 'grid grid-cols-1 lg:grid-cols-2 gap-4',
  premium: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  oficial: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3',
  gratis: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
};

function hojeEhDomingo() {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date()) === 'Sun';
}

// Home do IUB DISK BEBIDAS (/beer) — mobile-first: status de quem está
// aberto, busca, "Mais acessados", Monte seu Drink (em breve), todas as
// categorias e os estabelecimentos. Porta +18 e rodapé legal ficam no
// BeerLayout.
export default function IUBBeerHome() {
  const navigate = useNavigate();
  const { categorias, resumo } = useOutletContext();
  const [busca, setBusca] = useState('');
  const [estabelecimentos, setEstabelecimentos] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get('/public/beer/estabelecimentos')
      .then(res => setEstabelecimentos(res.data.estabelecimentos))
      .catch(() => { setErro(true); setEstabelecimentos([]); });
  }, []);

  function buscar(e) {
    e.preventDefault();
    if (busca.trim()) navigate(`/beer/busca?q=${encodeURIComponent(busca.trim())}`);
  }

  const lista = estabelecimentos || [];
  const grupos = ['master', 'premium', 'oficial', 'gratis']
    .map(plano => ({ plano, itens: lista.filter(e => (GRADE_POR_PLANO[e.plano] ? e.plano : 'gratis') === plano) }))
    .filter(g => g.itens.length > 0);

  return (
    <>
      <header className="relative overflow-hidden" style={{ background: `radial-gradient(120% 140% at 85% 0%, ${BEER.violeta} 0%, ${BEER.roxo} 38%, ${BEER.painel} 78%, ${BEER.fundo} 100%)` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-7 sm:py-12 flex items-center gap-4 sm:gap-10">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.5px] sm:tracking-[2px] px-3 py-1 rounded-full whitespace-nowrap" style={{ color: BEER.lavanda, border: `1px solid ${BEER.borda}`, backgroundColor: 'rgba(0,0,0,0.25)' }}>
              🔞 +18 · Beba com responsabilidade
            </span>
            <h1 className="mt-3 text-[34px] sm:text-6xl font-black text-white tracking-tight leading-[0.95]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              IUB <span style={{ color: BEER.lavanda }}>DISK</span>
              <br className="sm:hidden" /> BEBIDAS
            </h1>
            <div className="mt-3 h-px w-16" style={{ backgroundColor: BEER.dourado, opacity: 0.7 }} />
            <p className="mt-3 text-sm sm:text-lg max-w-md" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Bebida gelada, petisco, churrasco e a domingueira — direto no WhatsApp de quem entrega em Itumbiara.
            </p>
          </div>
          <img
            src={ROXINHO_GENTLEMAN_URL}
            alt="Roxinho Gentleman, de bigode fino e gravata-borboleta"
            className="w-24 h-24 sm:w-44 sm:h-44 rounded-full object-cover flex-shrink-0"
            style={{ boxShadow: `0 0 0 3px ${BEER.borda}, 0 20px 50px rgba(0,0,0,0.55)` }}
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 sm:py-8 space-y-7 sm:space-y-9">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: BEER.lavanda }}>
          <span className="relative flex w-2.5 h-2.5">
            {resumo?.abertos > 0 && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: '#22C55E' }} />}
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full" style={{ backgroundColor: resumo?.abertos > 0 ? '#22C55E' : '#6B7280' }} />
          </span>
          {resumo == null ? 'Carregando…' : resumo.abertos > 0
            ? `${resumo.abertos} estabelecimento${resumo.abertos === 1 ? '' : 's'} aberto${resumo.abertos === 1 ? '' : 's'} agora`
            : 'Nenhum estabelecimento aberto agora'}
        </div>

        <form onSubmit={buscar} className="flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
          <MagnifyingGlass size={18} color={BEER.lavanda} />
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar bebidas, petiscos…"
            aria-label="Buscar no Disk Bebidas"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-violet-300/50"
          />
        </form>

        <section>
          <TituloSecao>Mais acessados</TituloSecao>
          <MenuMobileMaisAcessados ehDomingo={hojeEhDomingo()} />
        </section>

        <BotaoMonteSeuDrink />

        <section>
          <TituloSecao>Todas as categorias</TituloSecao>
          {categorias == null
            ? <div className="h-40 rounded-2xl animate-pulse" style={{ backgroundColor: BEER.painel }} />
            : <TodasCategorias grupos={categorias} />}
        </section>

        <section>
          <TituloSecao>Estabelecimentos</TituloSecao>
          {estabelecimentos == null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ backgroundColor: BEER.painel }} />)}
            </div>
          ) : grupos.length === 0 ? (
            <Vazio
              emoji="🥃"
              titulo={erro ? 'Não foi possível carregar agora.' : 'As primeiras adegas de Itumbiara estão chegando'}
              texto={erro ? null : 'Em breve você pede cerveja, whisky, gelo e a comida de domingo aqui, direto no WhatsApp do estabelecimento.'}
              acao={!erro && (
                <Link to="/vender" className="inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-2xl" style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>
                  <Storefront size={18} weight="bold" /> Tem adega, bar ou distribuidora? Anuncie
                </Link>
              )}
            />
          ) : (
            <div className="space-y-4">
              {grupos.map(g => (
                // Master sozinho ocupa a linha inteira (em 2 colunas sobrava meia linha vazia)
                <div key={g.plano} className={g.plano === 'master' && g.itens.length === 1 ? 'grid grid-cols-1' : GRADE_POR_PLANO[g.plano]}>
                  {g.itens.map(e => <CardEstabelecimento key={e.id} estabelecimento={e} />)}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function TituloSecao({ children }) {
  return <h2 className="mb-3 text-xs font-bold uppercase tracking-[2px]" style={{ color: BEER.lavandaFraca }}>{children}</h2>;
}

// Grade completa grupo -> categorias. No celular cada grupo é um acordeão
// (fechado); do sm pra cima tudo aberto. Cigarros vem com aviso de
// categoria regulamentada.
function TodasCategorias({ grupos }) {
  const [aberto, setAberto] = useState(null);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {grupos.map(g => {
        const expandido = aberto === g.codigo;
        return (
          <div key={g.codigo} className="rounded-2xl" style={{ backgroundColor: BEER.painel, border: `1px solid ${BEER.borda}` }}>
            <div className="flex items-center gap-2 px-4 py-3">
              <Link to={`/beer/categoria/${g.codigo}`} className="flex-1 min-w-0 flex items-center gap-2 group">
                <span className="text-xl" aria-hidden="true">{g.icone}</span>
                <span className="text-sm font-bold text-white group-hover:underline truncate">{g.nome}</span>
                {g.total > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124,58,237,0.35)', color: BEER.lavanda }}>{g.total}</span>}
              </Link>
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : g.codigo)}
                aria-expanded={expandido}
                aria-label={`${expandido ? 'Fechar' : 'Abrir'} ${g.nome}`}
                className="sm:hidden p-1.5 rounded-lg"
                style={{ color: BEER.lavanda }}
              >
                <CaretDown size={16} weight="bold" className={`transition-transform ${expandido ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className={`${expandido ? 'flex' : 'hidden'} sm:flex flex-wrap gap-1.5 px-4 pb-4`}>
              {g.regulamentada && <p className="w-full text-[10px] mb-1" style={{ color: '#FCA5A5' }}>Categoria regulamentada · venda só para maiores de 18</p>}
              {g.filhas.map(f => (
                <Link
                  key={f.codigo}
                  to={`/beer/categoria/${f.codigo}`}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors hover:bg-white/10"
                  style={{ color: f.total > 0 ? '#fff' : BEER.lavandaFraca, border: `1px solid ${BEER.borda}` }}
                >
                  {f.nome}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
