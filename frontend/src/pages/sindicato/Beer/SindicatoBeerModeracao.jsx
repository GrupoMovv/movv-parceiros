import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Wine, Check, X, AlertTriangle, ShieldAlert, ExternalLink, Clock } from 'lucide-react';
import api from '../../../services/api';
import { formatarBRL } from '../../../utils/iubFood';
import { textoDias } from '../../beer/beerConfig';

// Moderação do IUB Disk Bebidas (camada 3) — só admin. Produto novo ou
// editado chega aqui como pendente e só aparece no /beer depois de
// aprovado. "Termos sensíveis" = palavras de contexto (coca, doce,
// cristal...) que o filtro não bloqueia sozinho: é aqui que alguém olha.
const ABAS = [
  { id: 'pendente', label: 'Pendentes' },
  { id: 'auditoria', label: 'Conferir (amostra)' },
  { id: 'aprovado', label: 'Aprovados' },
  { id: 'rejeitado', label: 'Rejeitados' },
  { id: 'log', label: 'Tentativas bloqueadas' },
];

export default function SindicatoBeerModeracao() {
  const [aba, setAba] = useState('pendente');
  const [produtos, setProdutos] = useState(null);
  const [contagem, setContagem] = useState({});
  const [log, setLog] = useState(null);

  const carregar = useCallback(() => {
    if (aba === 'log') {
      setLog(null);
      api.get('/sindicato-beer/log', { params: { tipo: 'tentativa_cadastro_proibido' } })
        .then(res => setLog(res.data.log)).catch(() => { toast.error('Erro ao carregar log'); setLog([]); });
      return;
    }
    setProdutos(null);
    api.get('/sindicato-beer/produtos', { params: { status: aba } })
      .then(res => { setProdutos(res.data.produtos); setContagem(res.data.contagem); })
      .catch(() => { toast.error('Erro ao carregar produtos'); setProdutos([]); });
  }, [aba]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Wine className="w-6 h-6 text-purple-600" /> Moderação Disk Bebidas</h1>
          <p className="text-slate-500 text-sm mt-1">Produto do IUB Disk Bebidas só aparece no /beer depois de aprovado aqui. O parceiro recebe e-mail com o resultado.</p>
        </div>
        {/* Link relativo = MESMO domínio deste login de admin (o login fica
            guardado por domínio) → o /beer abre já na visão admin, com as
            empresas de teste. */}
        <a href="/beer" target="_blank" rel="noopener" className="text-sm font-semibold px-4 py-2 rounded-xl border border-purple-200 text-purple-700 hover:bg-purple-50 whitespace-nowrap">
          👁️ Ver o /beer como admin
        </a>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {ABAS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              aba === a.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {a.label}
            {a.id !== 'log' && contagem[a.id] > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${['pendente', 'auditoria'].includes(a.id) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{contagem[a.id]}</span>
            )}
          </button>
        ))}
      </div>

      {aba === 'log' ? <AbaLog log={log} /> : produtos == null ? (
        <p className="text-slate-400 text-sm">Carregando…</p>
      ) : produtos.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-16">{aba === 'pendente' ? 'Nada esperando moderação. 🍻' : aba === 'auditoria' ? 'Nada pra conferir. Aqui cai 1 em cada 10 produtos publicados direto pela moderação automática.' : 'Nenhum produto aqui.'}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {produtos.map(p => <CardModeracao key={p.id} produto={p} onModerado={carregar} />)}
        </div>
      )}
    </div>
  );
}

function CardModeracao({ produto: p, onModerado }) {
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function moderar(status) {
    setEnviando(true);
    try {
      const res = await api.post(`/sindicato-beer/moderar/${p.id}`, { status, motivo: status === 'rejeitado' ? motivo : undefined });
      toast.success(`${status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}${res.data.email_enviado ? ' — parceiro avisado por e-mail' : ' — e-mail NÃO enviado (sem e-mail ou falha)'}`);
      onModerado();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao moderar');
      setEnviando(false);
    }
  }

  async function auditar() {
    setEnviando(true);
    try {
      await api.post(`/sindicato-beer/auditar/${p.id}`);
      toast.success('Conferido');
      onModerado();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro');
      setEnviando(false);
    }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${p.termos_sinalizados?.length ? 'border-amber-300' : 'border-slate-100'}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-3xl">
            {p.imagem ? <a href={p.imagem} target="_blank" rel="noopener noreferrer"><img src={p.imagem} alt="" className="w-full h-full object-cover" /></a> : <span aria-hidden="true">{p.categoria_icone}</span>}
          </div>
          {/* várias fotos: as outras em miniatura (todas passam pelo moderador) */}
          {p.fotos?.length > 1 && (
            <div className="flex gap-1 mt-1 w-24">
              {p.fotos.slice(1).map(f => (
                <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="w-[30px] h-[30px] rounded-md overflow-hidden bg-slate-100 flex-shrink-0">
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          {p.fotos?.length > 1 && <p className="text-[10px] text-slate-400 mt-0.5">{p.fotos.length} fotos</p>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-400">{p.grupo_nome} › {p.categoria_nome}</p>
          <p className="font-bold text-slate-900 leading-snug">{p.nome}</p>
          {p.descricao && <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">{p.descricao}</p>}
          <p className="text-sm font-bold text-slate-900 mt-1">{formatarBRL(p.preco)}{textoDias(p.dias_disponiveis) ? <span className="font-normal text-slate-500"> · {textoDias(p.dias_disponiveis)}</span> : null}</p>
          <a href={`/beer/estabelecimento/${p.parceiro_slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-700 font-semibold inline-flex items-center gap-1 mt-1 hover:underline">
            {p.parceiro_nome} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.regulamentada && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Categoria regulamentada</span>}
        {p.termos_sinalizados?.length > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Termo sensível: {p.termos_sinalizados.join(', ')}
          </span>
        )}
        <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(p.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {p.status === 'rejeitado' && p.motivo_rejeicao && <p className="mt-2 text-xs text-red-700">Motivo: {p.motivo_rejeicao}</p>}

      <ChecksModeracao produto={p} />

      {rejeitando ? (
        <div className="mt-3 space-y-2">
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} autoFocus placeholder="Motivo (vai no e-mail pro parceiro)" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setRejeitando(false)} disabled={enviando} className="flex-1 text-sm font-semibold py-2 rounded-lg border border-slate-200">Voltar</button>
            <button type="button" onClick={() => moderar('rejeitado')} disabled={enviando || !motivo.trim()} className="flex-1 text-sm font-bold py-2 rounded-lg bg-red-600 text-white disabled:opacity-40">Confirmar rejeição</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {p.status !== 'rejeitado' && (
            <button type="button" onClick={() => setRejeitando(true)} disabled={enviando} className="flex-1 inline-flex items-center justify-center gap-1 text-sm font-semibold py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50">
              <X className="w-4 h-4" /> {p.status === 'aprovado' ? 'Tirar do ar' : 'Rejeitar'}
            </button>
          )}
          {p.status !== 'aprovado' && (
            <button type="button" onClick={() => moderar('aprovado')} disabled={enviando} className="flex-1 inline-flex items-center justify-center gap-1 text-sm font-bold py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
              <Check className="w-4 h-4" /> Aprovar
            </button>
          )}
          {p.auditoria_pendente && (
            <button type="button" onClick={auditar} disabled={enviando} className="flex-1 inline-flex items-center justify-center gap-1 text-sm font-bold py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
              <Check className="w-4 h-4" /> Conferido, tudo certo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Resultado da moderação inteligente: o que falhou em destaque (é por isso
// que está na fila); o que passou fica recolhido.
const NOME_CHECK = {
  termos: 'Termos', palavrao: 'Palavrão', preco: 'Preço', foto_impropria: 'Foto imprópria',
  categoria_foto: 'Categoria × foto', cnae: 'CNAE', confianca: 'Confiança do parceiro',
};
function ChecksModeracao({ produto: p }) {
  const checks = p.moderacao_checks || [];
  if (!checks.length) return null;
  const falhas = checks.filter(c => !c.ok);
  return (
    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
      {p.moderacao_origem === 'automatica' && <p className="font-bold text-green-700 mb-1">🤖 Publicado direto pela moderação automática</p>}
      {falhas.length > 0 && (
        <ul className="space-y-0.5">
          {falhas.map(c => <li key={c.check} className="text-red-700"><strong>⚠️ {NOME_CHECK[c.check] || c.check}:</strong> {c.motivo}</li>)}
        </ul>
      )}
      <details className={falhas.length ? 'mt-1.5' : ''}>
        <summary className="cursor-pointer text-slate-500">{checks.length - falhas.length} de {checks.length} checks OK</summary>
        <ul className="mt-1 space-y-0.5 text-slate-600">
          {checks.filter(c => c.ok).map(c => <li key={c.check}>✅ {NOME_CHECK[c.check] || c.check}: {c.motivo}</li>)}
        </ul>
      </details>
    </div>
  );
}

function AbaLog({ log }) {
  if (log == null) return <p className="text-slate-400 text-sm">Carregando…</p>;
  if (!log.length) return <p className="text-slate-400 text-sm text-center py-16">Nenhuma tentativa bloqueada.</p>;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 text-left">
          <tr><th className="px-4 py-2">Quando</th><th className="px-4 py-2">Parceiro</th><th className="px-4 py-2">Produto tentado</th><th className="px-4 py-2">Termo</th></tr>
        </thead>
        <tbody>
          {log.map(l => (
            <tr key={l.id} className="border-t border-slate-100 align-top">
              <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="px-4 py-2">{l.parceiro_nome || '—'}</td>
              <td className="px-4 py-2"><p className="font-semibold">{l.produto_nome}</p>{l.produto_descricao && <p className="text-xs text-slate-500">{l.produto_descricao}</p>}</td>
              <td className="px-4 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">{l.palavra_detectada}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
