import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, MessageCircle, TrendingUp, Package, Lock } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO_ESCURO, PRETO } from '../public/Marketplace/theme';

const ORIGEM_LABEL = {
  nao_classificado: 'Não classificado',
  direto: 'Direto',
  busca: 'Busca / categoria',
  vitrine: 'Vitrine da home',
};

function formatarDiaCurto(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// Preenche os 30 dias corridos (mesmo os sem evento nenhum) pra o gráfico
// não parecer "quebrado" quando só teve movimento em alguns dias.
function preencherSerie(pontos) {
  const porDia = new Map(pontos.map(p => [p.dia, p.n]));
  const serie = [];
  for (let i = 29; i >= 0; i--) {
    const data = new Date();
    data.setDate(data.getDate() - i);
    const chave = data.toISOString().slice(0, 10);
    serie.push({ dia: chave, label: formatarDiaCurto(chave), n: porDia.get(chave) || 0 });
  }
  return serie;
}

function TooltipGrafico({ active, payload, label, corLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-sm font-bold" style={{ color: corLabel }}>{payload[0].value}</p>
    </div>
  );
}

function GraficoLinha({ dados, cor, alturaId }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={dados} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id={alturaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.28} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EEF0F5" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={4} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip content={<TooltipGrafico corLabel={cor} />} />
        <Area type="monotone" dataKey="n" stroke={cor} strokeWidth={2} fill={`url(#${alturaId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function ParceiroEstatisticas() {
  const { parceiro } = useOutletContext();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [semAcesso, setSemAcesso] = useState(false);

  const ehGratis = parceiro.plano === 'gratis';

  useEffect(() => {
    if (ehGratis) { setCarregando(false); return; }
    apiParceiro.get('/parceiro/dashboard/stats-detalhado')
      .then(res => setDados(res.data))
      .catch(err => { if (err.response?.status === 403) setSemAcesso(true); })
      .finally(() => setCarregando(false));
  }, [ehGratis]);

  if (ehGratis || semAcesso) return <BannerUpgrade />;

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: `${ROXO}33`, borderTopColor: ROXO }} />
      </div>
    );
  }

  const visitas = preencherSerie(dados.visitas_por_dia);
  const cliques = preencherSerie(dados.cliques_whatsapp_por_dia);
  const totalVisitas = visitas.reduce((s, p) => s + p.n, 0);
  const totalCliques = cliques.reduce((s, p) => s + p.n, 0);
  const totalOrigem = dados.origem_trafego.reduce((s, o) => s + o.n, 0) || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>Estatísticas</h1>
        <p className="text-slate-500 text-sm mt-1">Analytics avançado — benefício do seu plano.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile icone={Eye} label="Visitas (30 dias)" valor={totalVisitas} />
        <Tile icone={MessageCircle} label="Cliques WhatsApp (30 dias)" valor={totalCliques} />
        <Tile
          icone={TrendingUp} label="Taxa de conversão"
          valor={dados.taxa_conversao === null ? '—' : `${dados.taxa_conversao}%`}
          sub="cliques / visitas"
        />
        <Tile icone={Package} label="Produtos com visualização" valor={dados.top_produtos.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-sm mb-1" style={{ color: PRETO }}>Visitas ao perfil</h2>
          <p className="text-xs text-slate-400 mb-2">Últimos 30 dias</p>
          <GraficoLinha dados={visitas} cor={ROXO} alturaId="gradVisitas" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-sm mb-1" style={{ color: PRETO }}>Cliques no WhatsApp</h2>
          <p className="text-xs text-slate-400 mb-2">Últimos 30 dias</p>
          <GraficoLinha dados={cliques} cor={DOURADO_ESCURO} alturaId="gradCliques" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-sm mb-4" style={{ color: PRETO }}>Top 5 produtos mais vistos</h2>
          {dados.top_produtos.length === 0 ? (
            <p className="text-slate-400 text-xs py-6 text-center">Nenhuma visualização de produto ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {dados.top_produtos.map((p, i) => (
                <Link key={p.id} to={`/parceiro/painel/produtos/${p.id}`} className="flex items-center gap-3 hover:bg-slate-50 rounded-lg p-1.5 -m-1.5 transition-colors">
                  <span className="w-5 text-xs font-bold text-slate-300 text-center flex-shrink-0">{i + 1}</span>
                  <div className="w-9 h-9 rounded-lg bg-slate-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {p.fotos?.[0]?.url ? <img src={p.fotos[0].url} alt="" className="w-full h-full object-cover" /> : <Package className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                  <p className="text-sm font-medium truncate flex-1" style={{ color: PRETO }}>{p.nome}</p>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: ROXO }}>{p.visualizacoes}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-sm mb-1" style={{ color: PRETO }}>Origem do tráfego</h2>
          <p className="text-xs text-slate-400 mb-4">Últimos 30 dias</p>
          <div className="space-y-3">
            {dados.origem_trafego.map(o => (
              <div key={o.origem}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">{ORIGEM_LABEL[o.origem] || o.origem}</span>
                  <span className="text-slate-400">{o.n}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(o.n / totalOrigem) * 100}%`, backgroundColor: ROXO }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icone: Icone, label, valor, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${ROXO}12` }}>
        <Icone className="w-4.5 h-4.5" style={{ color: ROXO }} />
      </div>
      <p className="text-2xl font-extrabold" style={{ color: PRETO }}>{valor}</p>
      <p className="text-slate-500 text-xs font-medium mt-1">{label}{sub ? ` (${sub})` : ''}</p>
    </div>
  );
}

function BannerUpgrade() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
      <Lock className="w-8 h-8 mx-auto text-slate-300" />
      <h1 className="font-bold text-lg mt-4" style={{ color: PRETO }}>Analytics avançado é um benefício pago</h1>
      <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
        Gráficos de visitas, top produtos e taxa de conversão ficam disponíveis a partir do plano Oficial.
      </p>
      <Link
        to="/parceiro/painel/planos"
        className="inline-flex items-center gap-1.5 mt-5 text-sm font-bold px-5 py-2.5 rounded-xl text-white"
        style={{ backgroundColor: ROXO }}
      >
        Ver planos
      </Link>
    </div>
  );
}
