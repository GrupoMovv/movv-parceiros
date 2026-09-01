import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, AlertCircle } from 'lucide-react';
import api, { assetUrl, backendOrigin } from '../../services/api';
import { iniciais, corAvatar } from '../../utils/avatar';

const CATEGORIA_LABEL = {
  'Empregado': 'Empregado',
  'Empregador patronal': 'Empregador',
  'Profissional liberal': 'Liberal',
};

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Trabalha só com o texto "YYYY-MM-DD" (nunca com Date/timezone) — a data
// que vem do backend é um DATE puro, sem hora, então parsear via `new
// Date(iso)` arrisca cair no dia anterior/seguinte dependendo do fuso do
// navegador de quem tá vendo a carteirinha.
function partesData(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function fmtDataExtenso(iso) {
  const p = partesData(iso);
  if (!p) return null;
  return `${p.d} de ${MESES[p.m - 1]} de ${p.y}`;
}

function hojeYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function Carteirinha() {
  const { hash } = useParams();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [naoEncontrada, setNaoEncontrada] = useState(false);

  useEffect(() => {
    api.get(`/public/carteirinha/${hash}`)
      .then(res => setDados(res.data))
      .catch(() => setNaoEncontrada(true))
      .finally(() => setLoading(false));
  }, [hash]);

  // Título da aba / meta tags no client: não substitui o preview do
  // WhatsApp (o bot não roda JS — quem resolve isso é a rota do backend em
  // /carteirinha/:hash), mas deixa a aba do navegador e outros crawlers
  // que executam JS corretos.
  useEffect(() => {
    if (!dados) return;
    const titulo = `${dados.nome} - Carteirinha SECI`;
    document.title = titulo;
    upsertMeta('property', 'og:title', `Carteirinha do Associado - ${dados.nome}`);
    upsertMeta('property', 'og:description', 'SECI - Sindicato dos Empregados no Comércio de Itumbiara/GO');
    upsertMeta('property', 'og:image', assetUrl(dados.foto_url) || `${window.location.origin}/iub-logo-og.png`);
  }, [dados]);

  if (loading) {
    return (
      <PageShell>
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </PageShell>
    );
  }

  if (naoEncontrada || !dados) {
    return (
      <PageShell>
        <div className="w-full max-w-[380px] bg-white rounded-[2rem] shadow-2xl p-8 text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h1 className="text-lg font-bold text-slate-800">Carteirinha não encontrada</h1>
          <p className="text-slate-500 text-sm">Confira se o link ou QR Code está correto, ou procure o Sindicato pra emitir uma nova.</p>
        </div>
      </PageShell>
    );
  }

  const validaAteYMD = dados.valida_ate ? dados.valida_ate.slice(0, 10) : null;
  const vencida = !dados.ativo || !validaAteYMD || validaAteYMD < hojeYMD();
  const ehDependente = dados.tipo === 'dependente';
  const categoriaLabel = CATEGORIA_LABEL[dados.categoria] || dados.categoria;
  const temDependentes = !ehDependente && dados.dependentes_count > 0;
  const dependentesLabel = temDependentes
    ? `${dados.dependentes_count} dependente${dados.dependentes_count > 1 ? 's' : ''} cadastrado${dados.dependentes_count > 1 ? 's' : ''}`
    : null;
  const qrUrl = `${backendOrigin()}/carteirinha/${hash}`;

  return (
    <PageShell>
      <div
        className="w-full max-w-[380px] bg-white rounded-[2rem] overflow-hidden"
        style={{ boxShadow: '0 25px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}
      >
        {/* Seção 1 — header premium */}
        <div
          className="relative px-6 pt-6 pb-8 text-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1E4A8A 100%)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: 0.05,
              backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)',
            }}
          />

          <div className="relative flex items-start justify-between">
            <div className="text-left">
              <p className="text-white font-black text-lg tracking-wide leading-none">SECI</p>
              <p className="text-white/70 text-[10px] mt-1 leading-tight max-w-[140px]">Sindicato Comércio Itumbiara</p>
            </div>
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center text-center leading-none font-bold uppercase flex-shrink-0 ${
                vencida ? 'bg-red-500 text-white' : 'text-[#0B1F3A]'
              }`}
              style={!vencida ? { backgroundColor: '#B8E62C' } : undefined}
            >
              <span className={vencida ? 'text-[9px]' : 'text-[10px]'}>{vencida ? 'VENCIDO' : 'ATIVO'}</span>
            </div>
          </div>

          <div className="relative mt-5">
            {dados.foto_url ? (
              <img
                src={assetUrl(dados.foto_url)} alt={dados.nome}
                className="w-[140px] h-[140px] rounded-full object-cover mx-auto shadow-xl"
                style={{ border: '4px solid #D4AF37' }}
              />
            ) : (
              <div
                className="w-[140px] h-[140px] rounded-full mx-auto flex items-center justify-center text-white font-bold shadow-xl text-6xl"
                style={{ backgroundColor: corAvatar(dados.nome), border: '4px solid #D4AF37' }}
              >
                {iniciais(dados.nome)}
              </div>
            )}
          </div>

          {ehDependente && (
            <span className="relative inline-block mt-4 text-[10px] font-bold tracking-wide uppercase px-3 py-1 rounded-full bg-amber-400 text-[#0B1F3A]">
              Dependente
            </span>
          )}

          <h1 className="relative text-white font-bold text-2xl mt-2 leading-tight px-2">{dados.nome}</h1>

          {ehDependente ? (
            <p className="relative text-white/70 text-xs mt-1">Titular: {dados.titular_nome}</p>
          ) : (
            categoriaLabel && (
              <span className="relative inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-white/15 text-white">
                {categoriaLabel}
              </span>
            )
          )}
        </div>

        {/* Seção 2 — corpo */}
        <div className="px-6 py-6 space-y-5">
          <div className={`grid gap-4 ${dependentesLabel ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className={dependentesLabel ? '' : 'text-center'}>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">Empresa</p>
              {dados.empresa ? (
                <p className="text-slate-800 font-bold text-sm mt-0.5">{dados.empresa}</p>
              ) : (
                <p className="text-slate-400 italic text-sm mt-0.5 opacity-50">Empresa não vinculada</p>
              )}
            </div>
            {dependentesLabel && (
              <div>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">Dependentes</p>
                <p className="text-slate-800 font-bold text-sm mt-0.5">{dependentesLabel}</p>
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">
              {vencida ? 'Válida até (expirada)' : 'Validade'}
            </p>
            <p className={`text-sm font-semibold mt-0.5 ${vencida ? 'text-red-600' : 'text-slate-800'}`}>
              {fmtDataExtenso(dados.valida_ate) ? `Válida até ${fmtDataExtenso(dados.valida_ate)}` : '—'}
            </p>
          </div>

          {vencida && (
            <p className="text-center text-red-600 text-xs font-semibold bg-red-50 rounded-xl py-2.5 px-3">
              Renovação pendente — procure o Sindicato
            </p>
          )}

          <div className="flex flex-col items-center gap-2 pt-1">
            <div className="p-3 bg-white border border-slate-200 rounded-2xl">
              <QRCodeSVG value={qrUrl} className="w-full h-auto max-w-[180px] sm:max-w-[220px]" fgColor="#0B1F3A" />
            </div>
            <p className="text-slate-400 italic text-[11px]">Escaneie para validar</p>
          </div>
        </div>

        {/* Seção 3 — rodapé */}
        {!vencida && (
          <Link
            to={`/marketplace?associado=${hash}`}
            className="w-full h-20 flex items-center justify-center gap-3 font-bold uppercase tracking-wide text-white text-lg"
            style={{ backgroundColor: '#D4AF37', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}
          >
            <img src="/iub-logo-sm.png" alt="" className="h-10 w-10 rounded-lg" /> IUB Marketplace
          </Link>
        )}
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: '#111111' }}>
      {children}
    </div>
  );
}
