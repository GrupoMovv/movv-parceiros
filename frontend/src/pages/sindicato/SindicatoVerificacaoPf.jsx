import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserCheck, Check, X, Loader2, ExternalLink } from 'lucide-react';
import api from '../../services/api';

// Verificação do Vendedor Pessoa Física (CPF) — só admin. A pessoa se
// cadastra em /vender/pessoa-fisica com documento + selfie (fotos PRIVADAS
// no Cloudinary) e fica "em verificação" até a decisão aqui. Aprovar ou
// rejeitar APAGA as duas fotos e grava o registro (pf_verificacao_log).

const ABAS = [
  { id: 'pendente', label: 'Pendentes' },
  { id: 'aprovada', label: 'Aprovados' },
  { id: 'rejeitada', label: 'Rejeitados' },
];
const MOTIVOS = [
  'Foto do documento ilegível',
  'Selfie sem o documento ou sem o rosto',
  'Documento não confere com o nome ou o CPF',
  'Documento parece ser de outra pessoa',
];

const cpfFmt = c => String(c || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const foneFmt = f => String(f || '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
const dataHora = d => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
function idade(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const h = new Date();
  let anos = h.getFullYear() - a;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) anos--;
  return anos;
}

export default function SindicatoVerificacaoPf() {
  const [aba, setAba] = useState('pendente');
  const [itens, setItens] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [pendentes, setPendentes] = useState(0);

  const carregar = useCallback(() => {
    setItens(null);
    api.get('/sindicato-pf/verificacao', { params: { status: aba } })
      .then(r => setItens(r.data.itens))
      .catch(() => { toast.error('Erro ao carregar'); setItens([]); });
    api.get('/sindicato-pf/contagem').then(r => setPendentes(r.data.pendentes)).catch(() => {});
  }, [aba]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><UserCheck className="w-6 h-6 text-purple-600" /> Verificação Pessoa Física</h1>
        <p className="text-slate-500 text-sm mt-1">Quem se cadastrou para vender com CPF. Confira documento e selfie: aprovar publica a pessoa no site; aprovar ou rejeitar apaga as duas fotos e avisa pelo WhatsApp.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map(a => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap ${aba === a.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {a.label}
            {a.id === 'pendente' && pendentes > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{pendentes}</span>}
          </button>
        ))}
      </div>

      {itens == null ? <p className="text-slate-400 text-sm">Carregando…</p>
        : itens.length === 0 ? <p className="text-slate-400 text-sm py-10 text-center">{aba === 'pendente' ? 'Nenhum cadastro esperando verificação.' : 'Nada por aqui ainda.'}</p>
        : (
          <div className="space-y-3">
            {itens.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{p.nome_completo}{p.nome_vitrine && p.nome_vitrine !== p.nome_completo && <span className="font-normal text-slate-500"> · vitrine “{p.nome_vitrine}”</span>}</p>
                  <p className="text-sm text-slate-600 mt-0.5">CPF {cpfFmt(p.cpf)} · {idade(p.data_nascimento)} anos · {[p.bairro, p.cidade].filter(Boolean).join(', ')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.categoria_principal} · {p.nivel_label} · {foneFmt(p.whatsapp)} · {p.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Cadastro em {dataHora(p.identidade_enviada_em || p.created_at)}</p>
                  {p.ultima_decisao && (
                    <p className="text-xs mt-1" style={{ color: p.ultima_decisao.acao === 'aprovada' ? '#15803D' : '#B91C1C' }}>
                      {p.ultima_decisao.acao === 'aprovada' ? 'Aprovado' : 'Rejeitado'} por {p.ultima_decisao.admin_nome} em {dataHora(p.ultima_decisao.em)}
                      {p.identidade_motivo && ` — ${p.identidade_motivo}`}
                      {!p.ultima_decisao.fotos_apagadas && <strong className="text-amber-700"> · ⚠️ fotos não foram apagadas</strong>}
                    </p>
                  )}
                </div>
                {aba === 'pendente' && (
                  <button type="button" onClick={() => setAberto(p)} className="text-sm font-bold px-4 py-2.5 rounded-xl bg-purple-700 text-white hover:bg-purple-800 whitespace-nowrap">
                    Ver documentos
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      {aberto && <ModalDocumentos pessoa={aberto} onFechar={() => setAberto(null)} onDecidido={() => { setAberto(null); carregar(); }} />}
    </div>
  );
}

// Busca a foto PRIVADA pelo backend (com o token do admin) e mostra como blob
// — a imagem nunca tem um link público.
function FotoPrivada({ pessoaId, tipo, titulo }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    let revogar = null;
    api.get(`/sindicato-pf/${pessoaId}/documento/${tipo}`, { responseType: 'blob', timeout: 30000 })
      .then(r => { revogar = URL.createObjectURL(r.data); setUrl(revogar); })
      .catch(err => setErro(err.response?.status === 404 ? 'Foto já foi apagada' : 'Não deu para abrir a foto'));
    return () => { if (revogar) URL.revokeObjectURL(revogar); };
  }, [pessoaId, tipo]);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{titulo}</p>
      <div className="aspect-[3/4] rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" title="Abrir em tamanho real" className="w-full h-full">
            <img src={url} alt={titulo} className="w-full h-full object-contain" />
          </a>
        ) : erro ? <p className="text-sm text-red-600 px-3 text-center">{erro}</p> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
      </div>
    </div>
  );
}

function ModalDocumentos({ pessoa: p, onFechar, onDecidido }) {
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function decidir(acao) {
    setEnviando(true);
    try {
      const { data } = await api.post(`/sindicato-pf/${p.id}/${acao}`, acao === 'rejeitar' ? { motivo } : {});
      if (!data.fotos_apagadas) toast.error('Decisão registrada, mas o Cloudinary não confirmou que apagou as fotos. Aparece um aviso na lista.', { duration: 8000 });
      if (data.whatsapp_link) setResultado(data); // WhatsApp não saiu sozinho: botão pra mandar na mão
      else { toast.success(acao === 'aprovar' ? 'Aprovado! A pessoa já foi avisada no WhatsApp.' : 'Rejeitado. A pessoa foi avisada no WhatsApp.'); onDecidido(); }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar a decisão');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={enviando ? undefined : onFechar}>
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-h-[94vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" onClick={onFechar} disabled={enviando} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100" aria-label="Fechar"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-slate-900">{p.nome_completo}</h2>
        <p className="text-sm text-slate-600">CPF {cpfFmt(p.cpf)} · nascido(a) em {String(p.data_nascimento || '').slice(0, 10).split('-').reverse().join('/')} ({idade(p.data_nascimento)} anos)</p>
        <p className="text-xs text-slate-500 mt-1">Confira: o nome e o CPF do documento batem com os de cima, e a pessoa da selfie é a da foto do documento.</p>

        {resultado ? (
          <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="font-bold text-amber-900">Decisão registrada, mas o WhatsApp não saiu sozinho.</p>
            <a href={resultado.whatsapp_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-green-600 text-white">
              Mandar o aviso no WhatsApp <ExternalLink className="w-4 h-4" />
            </a>
            <button type="button" onClick={onDecidido} className="ml-3 text-sm font-semibold text-slate-600 underline">Fechar</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <FotoPrivada pessoaId={p.id} tipo="documento" titulo="Documento (RG ou CNH)" />
              <FotoPrivada pessoaId={p.id} tipo="selfie" titulo="Selfie com o documento" />
            </div>

            {rejeitando ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-700">Motivo da rejeição (vai no WhatsApp da pessoa)</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {MOTIVOS.map(m => <button key={m} type="button" onClick={() => setMotivo(m)} className={`text-xs px-2.5 py-1.5 rounded-lg border ${motivo === m ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}>{m}</button>)}
                </div>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={500} className="w-full mt-2 px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Ou escreva o motivo" />
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setRejeitando(false)} disabled={enviando} className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-slate-200">Voltar</button>
                  <button type="button" onClick={() => decidir('rejeitar')} disabled={enviando || motivo.trim().length < 5} className="flex-1 text-sm font-bold py-2.5 rounded-xl bg-red-600 text-white disabled:opacity-40 flex items-center justify-center gap-2">
                    {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Rejeitar e avisar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-5">
                <button type="button" onClick={() => setRejeitando(true)} disabled={enviando} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-3 rounded-xl bg-red-600 text-white hover:bg-red-700">
                  <X className="w-4 h-4" /> REJEITAR
                </button>
                <button type="button" onClick={() => decidir('aprovar')} disabled={enviando} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-3 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} APROVAR
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-3">Aprovar ou rejeitar apaga as duas fotos do Cloudinary e guarda só o registro (quem decidiu, quando e o motivo).</p>
          </>
        )}
      </div>
    </div>
  );
}
