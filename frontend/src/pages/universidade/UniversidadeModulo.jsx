import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, CheckCircle2, Circle, ListOrdered, ChevronDown, PlayCircle, FileSignature } from 'lucide-react';
import api from '../../services/api';
import { identidade, dataBR, pct } from './identidade';
import TextoSimples from './TextoSimples';

// Página do módulo: índice das aulas (no celular, abre no topo; no computador,
// coluna fixa), texto dos tópicos, "Marquei como lida" ao fim de cada aula,
// o termo de adesão no Módulo 0 e o botão do quiz quando tudo estiver lido.
export default function UniversidadeModulo() {
  const { numero } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [m, setM] = useState(null);
  const [indiceAberto, setIndiceAberto] = useState(false);
  const [marcando, setMarcando] = useState(null);

  useEffect(() => {
    setM(null);
    api.get(`/universidade/modulos/${numero}`)
      .then(r => setM(r.data))
      .catch(err => {
        toast.error(err.response?.data?.error || 'Módulo indisponível.');
        navigate('/universidade', { replace: true });
      });
  }, [numero]);

  useEffect(() => {
    if (!m || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 50);
  }, [m, location.hash]);

  async function marcarLida(aula) {
    setMarcando(aula.id);
    try {
      const r = await api.post(`/universidade/aulas/${aula.id}/lida`);
      setM(atual => ({
        ...atual,
        aulas_lidas: r.data.aulas_lidas,
        todas_lidas: r.data.aulas_lidas === r.data.aulas_total,
        quiz_liberado: r.data.quiz_liberado,
        aulas: atual.aulas.map(a => (a.id === aula.id ? { ...a, lida_em: a.lida_em || new Date().toISOString() } : a)),
      }));
      const proxima = m.aulas[m.aulas.findIndex(a => a.id === aula.id) + 1];
      if (proxima) document.getElementById(`aula-${proxima.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else document.getElementById('fim-do-modulo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível marcar a aula.');
    } finally { setMarcando(null); }
  }

  if (!m) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  const { cor, icone: Icone } = identidade(m.numero);
  const indice = (
    <ol className="space-y-1">
      {m.aulas.map(a => (
        <li key={a.id}>
          <a href={`#aula-${a.id}`} onClick={() => setIndiceAberto(false)}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
            {a.lida_em ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" /> : <Circle className="w-4 h-4 mt-0.5 text-slate-300 flex-shrink-0" />}
            <span><span className="text-slate-400 tabular-nums">{a.ordem}.</span> {a.titulo}</span>
          </a>
        </li>
      ))}
      <li>
        <a href="#fim-do-modulo" onClick={() => setIndiceAberto(false)}
          className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-movv-900 hover:bg-slate-100">
          {m.aprovado ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" /> : <Circle className="w-4 h-4 mt-0.5 text-slate-300" />}
          {m.numero === 0 ? 'Termo e quiz' : 'Quiz do módulo'}
        </a>
      </li>
    </ol>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/universidade" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-movv-900 mb-3">
        <ChevronLeft className="w-4 h-4" /> Universidade
      </Link>

      <header className="rounded-2xl text-white p-5 sm:p-6 mb-4" style={{ background: `linear-gradient(135deg, ${cor} 0%, #0C2D48 130%)` }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0"><Icone className="w-6 h-6" /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-white/75">Módulo {m.numero}</p>
            <h1 className="text-xl sm:text-2xl font-display font-semibold leading-tight">{m.titulo}</h1>
            <p className="text-sm text-white/80 mt-1 tabular-nums">{m.aulas_lidas} de {m.aulas_total} aulas lidas{m.aprovado ? ' · quiz aprovado' : ''}</p>
          </div>
        </div>
      </header>

      {/* índice no celular */}
      <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur border-b border-slate-200 mb-4">
        <button onClick={() => setIndiceAberto(v => !v)} className="w-full flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2"><ListOrdered className="w-4 h-4" /> Aulas ({m.aulas_lidas}/{m.aulas_total})</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${indiceAberto ? 'rotate-180' : ''}`} />
        </button>
        {indiceAberto && <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-xl bg-white border border-slate-200 p-2 shadow-card">{indice}</div>}
      </div>

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white p-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Aulas</p>
            {indice}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {m.aulas.map(a => (
            <section key={a.id} id={`aula-${a.id}`} className="scroll-mt-20 lg:scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>Aula {a.ordem}</p>
              <h2 className="text-lg sm:text-xl font-display font-semibold text-slate-900 leading-snug mt-0.5">{a.titulo}</h2>
              {a.video_url && (
                <a href={a.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-movv-900 hover:underline">
                  <PlayCircle className="w-4 h-4" /> Assistir ao vídeo da aula
                </a>
              )}
              <div className="mt-4 space-y-5 max-w-[65ch]">
                {a.topicos.map(t => (
                  <div key={t.id}>
                    <h3 className="font-semibold text-slate-900 leading-snug">{t.numero}. {t.titulo}</h3>
                    <TextoSimples texto={t.texto} className="mt-1.5 space-y-3 text-[16.5px] leading-[1.7] text-slate-700" />
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                {a.lida_em ? (
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" /> Lida em {dataBR(a.lida_em)}
                  </p>
                ) : (
                  <button onClick={() => marcarLida(a)} disabled={marcando === a.id} className="btn-primary w-full sm:w-auto">
                    {marcando === a.id ? 'Marcando…' : 'Marquei como lida'}
                  </button>
                )}
              </div>
            </section>
          ))}

          <section id="fim-do-modulo" className="scroll-mt-20 lg:scroll-mt-4 space-y-4">
            {m.numero === 0 && <BlocoTermo m={m} onAceito={termo => setM(atual => ({ ...atual, termo }))} />}
            <div className="rounded-2xl border border-gold-500/40 bg-white p-5 sm:p-6">
              <h2 className="font-display font-semibold text-slate-900 text-lg">Quiz do módulo</h2>
              <p className="text-sm text-slate-600 mt-1">
                {m.quiz_liberado
                  ? `${m.aprovado ? 'Você já foi aprovado neste módulo.' : `Para ser aprovado, acerte pelo menos ${pct(m.nota_minima)}.`} Pode tentar quantas vezes quiser.`
                  : `Marque as ${m.aulas_total} aulas como lidas para liberar o quiz (faltam ${m.aulas_total - m.aulas_lidas}).`}
                {m.ultima_nota !== null && ` Última nota: ${pct(m.ultima_nota)}.`}
              </p>
              {m.quiz_liberado
                ? <Link to={`/universidade/modulo/${m.numero}/quiz`} className="btn-primary inline-flex mt-4 w-full sm:w-auto justify-center">{m.aprovado ? 'Refazer o quiz' : 'Fazer o quiz do módulo'}</Link>
                : <button disabled className="btn-primary mt-4 w-full sm:w-auto opacity-40 cursor-not-allowed">Fazer o quiz do módulo</button>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BlocoTermo({ m, onAceito }) {
  const [termo, setTermo] = useState(null);
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { api.get('/universidade/termo').then(r => setTermo(r.data)).catch(() => setTermo({ publicado: false })); }, []);

  async function aceitar() {
    setEnviando(true);
    try {
      await api.post('/universidade/aceite', { versao: termo.versao, concordo: true });
      const aceito = { ...termo, aceito_em: new Date().toISOString() };
      setTermo(aceito);
      onAceito?.({ versao: aceito.versao, titulo: aceito.titulo, aceito_em: aceito.aceito_em });
      toast.success('Termo aceito. Os outros módulos foram liberados.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível registrar o aceite.');
    } finally { setEnviando(false); }
  }

  if (!termo) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <FileSignature className="w-5 h-5 text-movv-900" />
        <h2 className="font-display font-semibold text-slate-900 text-lg">Termo de adesão</h2>
      </div>
      {!termo.publicado ? (
        <p className="text-sm text-slate-600 mt-2">O termo de adesão está em revisão jurídica. Assim que for publicado, ele aparece aqui para você ler e aceitar, e os outros módulos são liberados.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500 mt-1">Versão {termo.versao}</p>
          <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <TextoSimples texto={termo.texto} className="space-y-3 text-[15px] leading-relaxed text-slate-700 max-w-[65ch]" />
          </div>
          {termo.aceito_em ? (
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="w-5 h-5" /> Você aceitou esta versão em {dataBR(termo.aceito_em)}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {!m.todas_lidas && <p className="text-sm text-amber-700">Marque todas as aulas do Módulo 0 como lidas antes de aceitar.</p>}
              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                <input id="concordo-termo" type="checkbox" checked={concordo} onChange={e => setConcordo(e.target.checked)}
                  disabled={!m.todas_lidas} className="mt-0.5 w-5 h-5 accent-[#0C2D48]" />
                <span>Li e concordo com o termo de adesão e o código de conduta do MOVV Partner (versão {termo.versao}).</span>
              </label>
              <button onClick={aceitar} disabled={!concordo || !m.todas_lidas || enviando} className="btn-primary w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed">
                {enviando ? 'Registrando…' : 'Aceitar o termo'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
