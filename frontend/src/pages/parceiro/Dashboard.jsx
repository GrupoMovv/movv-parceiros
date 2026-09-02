import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Eye, MessageCircle, Package, Tag, PackagePlus, UserCog, Camera } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';

const METRICAS = [
  { chave: 'visitas_30d', label: 'Visitas ao meu perfil', sub: '(30 dias)', icone: Eye },
  { chave: 'cliques_whatsapp_30d', label: 'Cliques no WhatsApp', sub: '(30 dias)', icone: MessageCircle },
  { chave: 'produtos_cadastrados', label: 'Produtos cadastrados', sub: null, meta: 30, icone: Package },
  { chave: 'promocoes_ativas', label: 'Promoções ativas', sub: null, meta: 10, icone: Tag },
];

const COMECE_AGORA = [
  { texto: 'Cadastre seu primeiro produto', to: '/parceiro/painel/produtos', icone: PackagePlus },
  { texto: 'Complete seu perfil', to: '/parceiro/painel/perfil', icone: UserCog },
  { texto: 'Adicione fotos do estabelecimento', to: '/parceiro/painel/perfil', icone: Camera },
];

export default function ParceiroDashboard() {
  const { parceiro } = useOutletContext();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiParceiro.get('/parceiro/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => setStats({ visitas_30d: 0, cliques_whatsapp_30d: 0, produtos_cadastrados: 0, promocoes_ativas: 0 }));
  }, []);

  return (
    <div className="space-y-8">
      <div
        className="rounded-3xl p-6 sm:p-8 text-white"
        style={{ background: `linear-gradient(135deg, ${ROXO} 0%, #7C3AED 100%)` }}
      >
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Olá, {parceiro.nome}! 👋</h1>
        <p className="text-white/80 text-sm mt-1.5">Aqui você acompanha as visitas, gerencia produtos e promoções do seu comércio no IUB MAIS.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICAS.map((m) => {
          const Icone = m.icone;
          const valor = stats ? stats[m.chave] : null;
          return (
            <div key={m.chave} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${ROXO}12` }}>
                <Icone className="w-4.5 h-4.5" style={{ color: ROXO }} />
              </div>
              <p className="text-2xl font-extrabold" style={{ color: PRETO }}>
                {valor === null ? '—' : m.meta ? `${valor}/${m.meta}` : valor}
              </p>
              <p className="text-slate-500 text-xs font-medium mt-1">{m.label} {m.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-bold text-sm mb-4" style={{ color: PRETO }}>Visitas por dia</h2>
        <GraficoPlaceholder />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-bold text-sm mb-4" style={{ color: PRETO }}>Comece agora</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {COMECE_AGORA.map((item) => {
            const Icone = item.icone;
            return (
              <Link
                key={item.texto}
                to={item.to}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${DOURADO}22` }}>
                  <Icone className="w-4 h-4" style={{ color: '#92700C' }} />
                </span>
                <span className="text-sm font-semibold" style={{ color: PRETO }}>{item.texto}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GraficoPlaceholder() {
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return (
    <div className="relative">
      <div className="flex items-end justify-between gap-2 h-32">
        {dias.map((d) => (
          <div key={d} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full rounded-t-md bg-slate-100" style={{ height: 4 }} />
            <span className="text-[10px] text-slate-400 font-medium">{d}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-slate-400 text-xs font-medium bg-white/90 px-3 py-1 rounded-full">
          Assim que você tiver visitas, o gráfico aparece aqui
        </p>
      </div>
    </div>
  );
}
