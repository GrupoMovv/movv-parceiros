import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, CheckCircle2, XCircle, RotateCcw, Award } from 'lucide-react';
import api from '../../services/api';
import { identidade, pct } from './identidade';

// Quiz do módulo: uma pergunta por tela, barra de avanço e resultado com a
// resposta certa e a explicação. A ordem vem embaralhada do servidor, que
// também corrige (aqui não existe gabarito).
export default function UniversidadeQuiz() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  function carregar() {
    setQuiz(null); setResultado(null); setRespostas({}); setAtual(0);
    api.get(`/universidade/modulos/${numero}/quiz`)
      .then(r => setQuiz(r.data))
      .catch(err => {
        toast.error(err.response?.data?.error || 'Quiz indisponível.');
        navigate(`/universidade/modulo/${numero}`, { replace: true });
      });
  }
  useEffect(carregar, [numero]);

  async function enviar() {
    setEnviando(true);
    try {
      const r = await api.post(`/universidade/modulos/${numero}/quiz`, {
        respostas: quiz.perguntas.map(p => ({ pergunta_id: p.id, alternativa_id: respostas[p.id] })),
      });
      setResultado(r.data);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível enviar as respostas.');
    } finally { setEnviando(false); }
  }

  if (!quiz) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;
  const { cor } = identidade(quiz.modulo.numero);
  const total = quiz.perguntas.length;

  if (resultado) return <Resultado r={resultado} numero={numero} cor={cor} onRefazer={carregar} />;

  const p = quiz.perguntas[atual];
  const respondidas = quiz.perguntas.filter(x => respostas[x.id]).length;
  const ultima = atual === total - 1;

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/universidade/modulo/${numero}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-movv-900 mb-3">
        <ChevronLeft className="w-4 h-4" /> Módulo {quiz.modulo.numero}
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>Quiz · Módulo {quiz.modulo.numero}</p>
        <div className="mt-2 flex items-center justify-between text-sm text-slate-500 tabular-nums">
          <span>Pergunta {atual + 1} de {total}</span>
          <span>Aprovação: {pct(quiz.nota_minima)}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${(100 * respondidas) / total}%`, background: cor }} />
        </div>

        <h1 className="mt-5 text-lg sm:text-xl font-semibold text-slate-900 leading-snug">{p.enunciado}</h1>
        <div className="mt-4 space-y-2.5" role="radiogroup">
          {p.alternativas.map(a => {
            const marcada = respostas[p.id] === a.id;
            return (
              <button key={a.id} role="radio" aria-checked={marcada}
                onClick={() => setRespostas(r => ({ ...r, [p.id]: a.id }))}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 text-[15px] leading-snug transition-colors
                  ${marcada ? 'border-movv-900 bg-movv-900 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'}`}>
                {a.texto}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={() => setAtual(i => i - 1)} disabled={atual === 0} className="btn-secondary disabled:opacity-40">Anterior</button>
          {ultima ? (
            <button onClick={enviar} disabled={respondidas < total || enviando} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
              {enviando ? 'Corrigindo…' : respondidas < total ? `Faltam ${total - respondidas}` : 'Enviar respostas'}
            </button>
          ) : (
            <button onClick={() => setAtual(i => i + 1)} disabled={!respostas[p.id]} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">Próxima</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Resultado({ r, numero, cor, onRefazer }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className={`rounded-2xl p-5 sm:p-7 text-center border ${r.aprovado ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
        {r.aprovado ? <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" /> : <XCircle className="w-12 h-12 mx-auto text-orange-500" />}
        <h1 className="mt-2 text-xl font-display font-semibold text-slate-900">{r.aprovado ? 'Aprovado!' : 'Ainda não foi desta vez'}</h1>
        <p className="mt-1 text-slate-700 tabular-nums">Você acertou {r.acertos} de {r.total} ({pct(r.nota)}). Para aprovar: {pct(r.nota_minima)}.</p>
        {r.certificado && (
          <Link to="/universidade/certificado" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-5 py-2.5 font-semibold text-movv-900 shadow-gold">
            <Award className="w-5 h-5" /> Ver meu certificado
          </Link>
        )}
        <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={onRefazer} className="btn-secondary inline-flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> {r.aprovado ? 'Refazer' : 'Tentar de novo'}</button>
          <Link to={r.aprovado ? '/universidade' : `/universidade/modulo/${numero}`} className="btn-primary text-center">{r.aprovado ? 'Voltar à Universidade' : 'Rever o módulo'}</Link>
        </div>
      </div>

      <div className="space-y-3">
        {r.correcao.map((c, i) => (
          <div key={c.pergunta_id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-2">
              {c.acertou ? <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 flex-shrink-0" /> : <XCircle className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" />}
              <p className="font-semibold text-slate-900 leading-snug"><span className="tabular-nums" style={{ color: cor }}>{i + 1}.</span> {c.enunciado}</p>
            </div>
            <div className="mt-2 pl-7 space-y-1 text-sm">
              {!c.acertou && <p className="text-red-600"><span className="font-medium">Sua resposta:</span> {c.escolhida}</p>}
              <p className="text-emerald-700"><span className="font-medium">Resposta certa:</span> {c.correta}</p>
              {c.explicacao && <p className="text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mt-1">{c.explicacao}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
