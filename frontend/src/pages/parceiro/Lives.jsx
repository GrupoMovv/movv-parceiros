import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { PlayCircle, Clock, Lock } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';

// Aceita link "normal" do Youtube/Vimeo e devolve a URL de embed — cadastro
// admin guarda o link como as pessoas realmente colam (watch?v=, youtu.be,
// vimeo.com/ID), não precisa já vir em formato de embed.
function paraEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return url;
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (u.hostname.includes('vimeo.com')) {
      if (u.hostname.includes('player.vimeo.com')) return url;
      const id = u.pathname.split('/').filter(Boolean).pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

function fmtData(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function ParceiroLives() {
  const { parceiro } = useOutletContext();
  const [estado, setEstado] = useState({ acesso: false, lives: [] });
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('gravadas');
  const [selecionada, setSelecionada] = useState(null);

  useEffect(() => {
    apiParceiro.get('/parceiro/conteudo-master/lives')
      .then(res => setEstado(res.data))
      .catch(() => setEstado({ acesso: false, lives: [] }))
      .finally(() => setCarregando(false));
  }, []);

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const proximas = estado.lives.filter(l => l.data_gravacao && l.data_gravacao.slice(0, 10) >= hoje);
  const gravadas = estado.lives.filter(l => !l.data_gravacao || l.data_gravacao.slice(0, 10) < hoje);
  const visiveis = filtro === 'proximas' ? proximas : gravadas;

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: `${ROXO}33`, borderTopColor: ROXO }} />
      </div>
    );
  }

  if (!estado.acesso) return <BannerUpgrade />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: PRETO }}>🎥 Lives Exclusivas</h1>
        <p className="text-slate-500 text-sm mt-1">Conteúdo ao vivo e gravado pra quem é Master.</p>
      </div>

      <div className="flex gap-2">
        {[{ id: 'gravadas', label: `Gravadas (${gravadas.length})` }, { id: 'proximas', label: `Próximas (${proximas.length})` }].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFiltro(t.id)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors"
            style={filtro === t.id ? { backgroundColor: ROXO, color: 'white', borderColor: ROXO } : { color: '#64748B', borderColor: '#E2E8F0' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {selecionada && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={paraEmbedUrl(selecionada.video_url)}
              title={selecionada.titulo}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{selecionada.titulo}</p>
          {selecionada.descricao && <p className="text-slate-500 text-xs mt-1">{selecionada.descricao}</p>}
        </div>
      )}

      {visiveis.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <p className="text-slate-400 text-sm">{filtro === 'proximas' ? 'Nenhuma live agendada por enquanto.' : 'Nenhuma live gravada por aqui ainda.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiveis.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelecionada(l)}
              className="flex flex-col text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5"
            >
              <PlayCircle className="w-8 h-8" style={{ color: ROXO }} />
              <p className="text-sm font-bold mt-3" style={{ color: PRETO }}>{l.titulo}</p>
              {l.descricao && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{l.descricao}</p>}
              <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
                {l.data_gravacao && <span>{fmtData(l.data_gravacao)}</span>}
                {l.duracao_minutos && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {l.duracao_minutos}min</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BannerUpgrade() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
      <Lock className="w-8 h-8 mx-auto text-slate-300" />
      <h1 className="font-bold text-lg mt-4" style={{ color: PRETO }}>Lives Exclusivas é um benefício Master</h1>
      <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
        Lives mensais com nossa equipe ficam disponíveis a partir do plano Master.
      </p>
      <Link
        to="/parceiro/painel/planos"
        className="inline-flex items-center gap-1.5 mt-5 text-sm font-bold px-5 py-2.5 rounded-xl text-white"
        style={{ backgroundColor: ROXO }}
      >
        Fazer upgrade pra Master
      </Link>
    </div>
  );
}
