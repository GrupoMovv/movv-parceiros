import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { MapPin, Tag, CalendarCheck, ImageOff, Instagram } from 'lucide-react';
import { WhatsappLogo } from '@phosphor-icons/react';
import BotaoVoltar from '../../../components/ui/BotaoVoltar';
import api from '../../../services/api';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';
import { DIAS, horarioConfigurado, statusFuncionamento, textoTaxaEntrega } from '../../../utils/iubFood';
import SeloPlano from './components/SeloPlano';
import CardProdutoGrande from './components/CardProdutoGrande';
import CardPromocao from './components/CardPromocao';
import { ROXO, ROXO_ESCURO, GRAFITE } from './theme';

// /marketplace/parceiro/:slug — página da loja (08/10). Antes esta rota só
// mostrava os convênios escritos no código; loja de verdade voltava pra home.
// Dados, horário, atendimento, promoções e produtos. Um botão principal por
// tela: "Falar com a loja" (cada produto tem o Comprar na página dele).
// Loja pausada ou de teste: o servidor responde 404 (só abre no modo QA).
// Restaurante usa a página do IUB Food; prestador de serviço, a de serviços.
export default function LojaDetalhe() {
  const { slug } = useParams();
  const [loja, setLoja] = useState(null);
  const [estado, setEstado] = useState('carregando'); // carregando | ok | nao_encontrada

  useEffect(() => {
    setEstado('carregando');
    api.get(`/public/lojas/${slug}`)
      .then(r => { setLoja(r.data); setEstado('ok'); })
      .catch(() => setEstado('nao_encontrada'));
  }, [slug]);

  if (estado === 'carregando') return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  if (estado === 'nao_encontrada' || !loja) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-bold text-lg" style={{ color: GRAFITE }}>Loja não encontrada</p>
        <Link to="/marketplace" className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Ver o marketplace</Link>
      </div>
    );
  }
  if (loja.e_restaurante) return <Navigate to={`/food/${slug}`} replace />;
  if (loja.tipo_negocio === 'servico') return <Navigate to={`/servicos/${slug}`} replace />;

  const tipo = loja.categoria_principal || loja.categorias?.[0] || null;
  const foto = loja.fotos_estabelecimento?.[0]?.url || loja.logo_url;
  const descricao = loja.descricao_completa || loja.descricao;
  const endereco = [loja.endereco, loja.bairro, loja.cidade].filter(Boolean).join(', ');
  const status = statusFuncionamento(loja.horario_funcionamento, new Date());
  const linkWpp = loja.whatsapp ? linkWhatsappComTexto(loja.whatsapp, `Olá! Vi a ${loja.nome} no IUB MAIS+ e queria saber mais.`) : null;
  const instagram = loja.instagram ? `https://instagram.com/${String(loja.instagram).replace(/^@/, '')}` : null;

  return (
    <div className="min-h-screen w-full bg-white pb-28">
      <div className="relative px-6 pt-8 pb-12 text-center overflow-hidden" style={{ background: `linear-gradient(150deg, ${ROXO_ESCURO} 0%, ${ROXO} 130%)` }}>
        <div className="relative text-left -mt-4 mb-2"><BotaoVoltar variante="claro" fallback="/marketplace" /></div>
        <div className="relative flex justify-center mb-3"><SeloPlano plano={loja.plano} size="lg" /></div>
        <div className="relative w-24 h-24 rounded-3xl mx-auto shadow-2xl bg-white overflow-hidden flex items-center justify-center">
          {foto ? <img src={foto} alt={loja.nome} className="w-full h-full object-cover" /> : <span className="text-4xl">{loja.icone || <ImageOff className="w-8 h-8 text-slate-200" />}</span>}
        </div>
        <h1 className="relative text-white font-black text-xl sm:text-3xl mt-4">{loja.nome}</h1>
        {tipo && <p className="relative text-white/70 text-xs font-semibold uppercase tracking-wide mt-1.5 flex items-center justify-center gap-1"><Tag className="w-3 h-3" /> {tipo}</p>}
        {status && (
          <p className="relative inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mt-3"
            style={{ backgroundColor: status.aberto ? '#DCFCE7' : '#FEE2E2', color: status.aberto ? '#166534' : '#991B1B' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.aberto ? '#16A34A' : '#DC2626' }} />{status.texto}
          </p>
        )}
        {(loja.delivery_disponivel || loja.retirada_disponivel) && (
          <div className="relative flex items-center justify-center gap-2 flex-wrap mt-3">
            {loja.delivery_disponivel && <span className="text-xs font-semibold text-white bg-white/15 px-3 py-1.5 rounded-full">🚚 {textoTaxaEntrega(loja)}</span>}
            {loja.retirada_disponivel && <span className="text-xs font-semibold text-white bg-white/15 px-3 py-1.5 rounded-full">🏪 Retirada na loja</span>}
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {loja.promocoes.length > 0 && (
          <section>
            <h2 className="font-black text-lg mb-3" style={{ color: GRAFITE }}>🔥 Promoções</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {loja.promocoes.map(pm => <CardPromocao key={pm.id} produto={pm} />)}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-black text-lg mb-3" style={{ color: GRAFITE }}>Produtos{loja.produtos.length ? ` (${loja.produtos.length})` : ''}</h2>
          {loja.produtos.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {loja.produtos.map(p => <CardProdutoGrande key={p.id} produto={p} />)}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Esta loja ainda não cadastrou produtos.</p>
          )}
        </section>

        {descricao && (
          <section>
            <h2 className="font-bold text-sm mb-2" style={{ color: GRAFITE }}>Sobre</h2>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{descricao}</p>
          </section>
        )}

        {horarioConfigurado(loja.horario_funcionamento) && (
          <section className="flex items-start gap-2">
            <CalendarCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-500 mb-1">Horário de funcionamento</p>
              <ul className="text-sm space-y-0.5" style={{ color: GRAFITE }}>
                {DIAS.map(d => {
                  const info = loja.horario_funcionamento[d.chave];
                  return (
                    <li key={d.chave} className="flex justify-between max-w-[260px]">
                      <span>{d.label}</span>
                      <span className={info?.aberto ? '' : 'text-slate-400'}>{info?.aberto ? `${info.abre} – ${info.fecha}` : 'Fechado'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {(endereco || instagram) && (
          <section className="space-y-2">
            {endereco && (
              <p className="flex items-start gap-2 text-sm" style={{ color: GRAFITE }}>
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ROXO }} />
                {loja.google_maps_url ? <a href={loja.google_maps_url} target="_blank" rel="noreferrer" className="underline">{endereco}</a> : endereco}
              </p>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold" style={{ color: ROXO }}>
                <Instagram className="w-4 h-4" /> @{String(loja.instagram).replace(/^@/, '')}
              </a>
            )}
          </section>
        )}
      </div>

      {linkWpp && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-100 px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <a href={linkWpp} target="_blank" rel="noreferrer" className="max-w-md mx-auto flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-white" style={{ backgroundColor: '#25D366' }}>
            <WhatsappLogo size={22} weight="fill" /> Falar com a loja
          </a>
        </div>
      )}
    </div>
  );
}
