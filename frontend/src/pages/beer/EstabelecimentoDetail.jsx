import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { MapPin, Clock, Storefront, Wine } from '@phosphor-icons/react';
import api from '../../services/api';
import SeloPlano from '../public/Marketplace/components/SeloPlano';
import BadgeAberto from '../../components/beer/BadgeAberto';
import FiltroCategorias from '../../components/beer/FiltroCategorias';
import { GradeProdutos, Vazio } from './BeerLayout';
import { useProdutosBeer } from './useProdutosBeer';
import { BEER, DIAS, TIPOS_ESTABELECIMENTO } from './beerConfig';

// Horário da semana em linhas curtas ("Sex 18:00–02:00"). Dia sem horário
// não aparece; nada configurado = null.
function linhasHorario(h) {
  const linhas = DIAS.filter(d => h?.[d.chave]?.aberto).map(d => `${d.curto} ${h[d.chave].abre}–${h[d.chave].fecha}`);
  return linhas.length ? linhas : null;
}

// /beer/estabelecimento/:slug — cabeçalho da loja + cardápio com filtro
// pelos grupos que ELA tem (não os 19 do catálogo inteiro).
export default function EstabelecimentoDetail() {
  const { slug } = useParams();
  const { categorias } = useOutletContext();
  const [e, setE] = useState(undefined); // undefined = carregando, null = 404
  const [grupoAtivo, setGrupoAtivo] = useState(null);
  const { produtos, carregando, erro, tentarDeNovo } = useProdutosBeer(e ? `/public/beer/estabelecimentos/${slug}/produtos` : null);

  useEffect(() => {
    setE(undefined);
    setGrupoAtivo(null);
    api.get(`/public/beer/estabelecimentos/${slug}`).then(res => setE(res.data)).catch(() => setE(null));
  }, [slug]);

  // folha -> grupo (o produto só traz a folha)
  const grupoDaFolha = useMemo(() => {
    const m = {};
    (categorias || []).forEach(g => g.filhas.forEach(f => { m[f.codigo] = g; }));
    return m;
  }, [categorias]);

  const gruposDaLoja = useMemo(() => {
    const vistos = new Map();
    produtos.forEach(p => { const g = grupoDaFolha[p.categoria.codigo]; if (g && !vistos.has(g.codigo)) vistos.set(g.codigo, g); });
    return [...vistos.values()];
  }, [produtos, grupoDaFolha]);

  const filtrados = grupoAtivo ? produtos.filter(p => grupoDaFolha[p.categoria.codigo]?.codigo === grupoAtivo) : produtos;

  if (e === null) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-10">
        <Vazio emoji="🔎" titulo="Estabelecimento não encontrado" texto="Ele pode ter saído do Disk Bebidas." acao={<Link to="/beer" className="text-sm font-bold px-5 py-2.5 rounded-xl text-white inline-block" style={{ backgroundColor: BEER.violeta }}>Voltar pro Disk Bebidas</Link>} />
      </main>
    );
  }
  if (e === undefined) return <div className="h-72 m-4 rounded-3xl animate-pulse" style={{ backgroundColor: BEER.painel }} />;

  const horario = linhasHorario(e.horario_funcionamento);
  return (
    <>
      <header style={{ background: `radial-gradient(120% 160% at 90% 0%, ${BEER.violeta} 0%, ${BEER.roxo} 40%, ${BEER.painel} 85%)` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-6 sm:py-10">
          <Link to="/beer" className="text-xs font-semibold hover:underline" style={{ color: BEER.lavanda }}>← Disk Bebidas</Link>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
            <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-3xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BEER.painel, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: `1px solid ${BEER.borda}` }}>
              {e.logo_url ? <img src={e.logo_url} alt={e.nome} className="w-full h-full object-cover" /> : <Wine size={48} weight="duotone" color={BEER.lavanda} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: BEER.lavanda }}>{TIPOS_ESTABELECIMENTO[e.tipo]}</span>
                <BadgeAberto aberto={e.status_aberto} />
                <SeloPlano plano={e.plano} />
              </div>
              <h1 className="mt-1 text-2xl sm:text-4xl font-black text-white leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>{e.nome}</h1>
              <div className="mt-2 space-y-1 text-xs sm:text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {e.bairros_entrega?.length > 0 && <p className="flex items-start gap-1.5"><MapPin size={14} weight="fill" className="mt-0.5 flex-shrink-0" /> Entrega: {e.bairros_entrega.join(', ')}</p>}
                {(e.tempo_entrega_min || e.retirada_disponivel) && (
                  <p className="flex items-center gap-1.5">
                    <Clock size={14} className="flex-shrink-0" />
                    {[e.tempo_entrega_min && `Entrega em ~${e.tempo_entrega_min} min`, e.retirada_disponivel && 'retirada no local'].filter(Boolean).join(' · ')}
                  </p>
                )}
                {horario && <p className="flex items-start gap-1.5"><Storefront size={14} className="mt-0.5 flex-shrink-0" /> {horario.join(' · ')}</p>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 w-full py-5 sm:py-8">
        {!e.status_aberto && (
          <p className="mb-4 text-xs rounded-xl px-4 py-3" style={{ color: BEER.lavanda, backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${BEER.borda}` }}>
            Fechado agora — você ainda pode mandar o pedido no WhatsApp e combinar direto com o estabelecimento.
          </p>
        )}
        {gruposDaLoja.length > 1 && (
          <div className="mb-4">
            <FiltroCategorias opcoes={gruposDaLoja.map(g => ({ codigo: g.codigo, nome: g.nome, icone: g.icone }))} ativa={grupoAtivo} onSelecionar={setGrupoAtivo} />
          </div>
        )}
        <GradeProdutos
          produtos={filtrados}
          carregando={carregando}
          erro={erro}
          onTentarDeNovo={tentarDeNovo}
          mostrarEstabelecimento={false}
          vazio={<Vazio emoji="🥃" titulo="Cardápio em montagem" texto="Os produtos deste estabelecimento aparecem aqui depois da aprovação do IUB." />}
        />
      </main>
    </>
  );
}
