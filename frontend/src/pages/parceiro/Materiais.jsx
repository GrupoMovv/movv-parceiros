import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { FileText, Video, LayoutTemplate, BookOpen, Lock, Download } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';

const TIPO = {
  video: { label: 'Vídeo', Icone: Video },
  pdf: { label: 'PDF', Icone: FileText },
  template: { label: 'Template', Icone: LayoutTemplate },
  ebook: { label: 'E-book', Icone: BookOpen },
};

const CATEGORIA_LABEL = { marketing: 'Marketing', fotografia: 'Fotografia', gestao: 'Gestão', precos: 'Preços' };

export default function ParceiroMateriais() {
  const { parceiro } = useOutletContext();
  const [estado, setEstado] = useState({ acesso: false, materiais: [] });
  const [carregando, setCarregando] = useState(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todas');

  useEffect(() => {
    apiParceiro.get('/parceiro/conteudo-master/materiais')
      .then(res => setEstado(res.data))
      .catch(() => setEstado({ acesso: false, materiais: [] }))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: `${ROXO}33`, borderTopColor: ROXO }} />
      </div>
    );
  }

  if (!estado.acesso) return <BannerUpgrade plano={parceiro.plano} />;

  const categorias = ['todas', ...new Set(estado.materiais.map(m => m.categoria))];
  const visiveis = categoriaAtiva === 'todas' ? estado.materiais : estado.materiais.filter(m => m.categoria === categoriaAtiva);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: PRETO }}>🌟 Materiais Exclusivos</h1>
        <p className="text-slate-500 text-sm mt-1">Vídeos, PDFs e templates pra você vender mais — benefício Master.</p>
      </div>

      {categorias.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {categorias.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoriaAtiva(c)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={categoriaAtiva === c
                ? { backgroundColor: ROXO, color: 'white', borderColor: ROXO }
                : { color: '#64748B', borderColor: '#E2E8F0' }}
            >
              {c === 'todas' ? 'Todas' : CATEGORIA_LABEL[c] || c}
            </button>
          ))}
        </div>
      )}

      {visiveis.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <p className="text-slate-400 text-sm">Nenhum material por aqui ainda — em breve tem novidade.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiveis.map(m => {
            const { Icone, label } = TIPO[m.tipo] || TIPO.pdf;
            return (
              <a
                key={m.id}
                href={m.url_conteudo}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5"
              >
                <div className="flex items-start justify-between">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${DOURADO}22` }}>
                    <Icone className="w-5 h-5" style={{ color: '#92700C' }} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
                </div>
                <p className="text-sm font-bold mt-3" style={{ color: PRETO }}>{m.titulo}</p>
                {m.descricao && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.descricao}</p>}
                <span className="flex items-center gap-1 text-xs font-semibold mt-3" style={{ color: ROXO }}>
                  <Download className="w-3.5 h-3.5" /> Acessar
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BannerUpgrade() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
      <Lock className="w-8 h-8 mx-auto text-slate-300" />
      <h1 className="font-bold text-lg mt-4" style={{ color: PRETO }}>Materiais Exclusivos é um benefício Master</h1>
      <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
        Vídeos, PDFs e templates de marketing, fotografia, gestão e preços ficam disponíveis no plano Master.
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
