import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Loader2, ShieldAlert, Unlock } from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/ui/Modal';

// Indicação duplicada (migration 103): tentativas de MOVV Partner barradas
// porque o cliente (CPF/CNPJ) já tem indicação em andamento no mesmo
// produto, ou porque o Partner passou de 5 tentativas barradas em 24 h.
// O Partner só vê "Fale com a Central"; aqui a equipe vê quem tem o
// cliente e pode liberar (motivo obrigatório): a próxima indicação do
// mesmo Partner, produto e documento passa, uma vez. Documento sempre
// mascarado.

const dataHora = v => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '');
const STATUS = { pending: 'pendente', converted: 'convertida', expired: 'expirada', cancelled: 'cancelada' };

export function situacaoTentativa(x) {
  if (x.usada_em) return { texto: `Liberada e usada${x.liberada_protocolo ? ` (${x.liberada_protocolo})` : ''}`, cls: 'text-emerald-700' };
  if (x.liberada_em) return { texto: 'Liberada, aguardando o Partner indicar', cls: 'text-emerald-700' };
  return { texto: 'Bloqueada', cls: 'text-red-600' };
}

export default function TentativasBloqueadas({ onContagem }) {
  const [lista, setLista] = useState(null);
  const [liberando, setLiberando] = useState(null);

  const carregar = useCallback(() => {
    api.get('/referrals/tentativas')
      .then(r => { setLista(r.data); onContagem?.(r.data.filter(x => !x.liberada_em).length); })
      .catch(err => { setLista([]); toast.error(err.response?.data?.error || 'Erro ao carregar as tentativas'); });
  }, [onContagem]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 max-w-3xl">
        O Partner que tenta indicar um cliente que já tem indicação em andamento no mesmo produto vê só
        "Fale com a Central Movv", sem saber quem indicou. Depois de 5 tentativas barradas em 24 horas,
        toda indicação dele recebe a mesma mensagem. Para um caso legítimo (ex.: segundo contrato do mesmo
        cliente), use <strong>Liberar</strong>: a próxima indicação daquele Partner, para aquele cliente e
        produto, passa.
      </p>
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>{['Quando', 'Partner que tentou', 'Produto · cliente', 'Por quê', 'Situação', ''].map(h => <th key={h} className="text-left text-slate-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {!lista ? (
                <tr><td colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-movv-900 mx-auto" /></td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Nenhuma tentativa bloqueada.</td></tr>
              ) : lista.map(x => {
                const sit = situacaoTentativa(x);
                return (
                  <tr key={x.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">{dataHora(x.criado_em)}</td>
                    <td className="py-3 px-3 text-xs">
                      <p className="text-slate-900 font-medium">{x.partner_nome}</p>
                      <p className="text-[#C9A84C] font-mono">{x.partner_codigo}</p>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <p className="text-slate-900">{x.produto}</p>
                      <p className="font-mono text-slate-500">{x.documento_mascarado}</p>
                    </td>
                    <td className="py-3 px-3 text-xs max-w-[260px]">
                      {x.motivo === 'limite' ? (
                        <p className="text-amber-800">Passou de 5 tentativas barradas em 24 h</p>
                      ) : x.bloqueadora_protocolo ? (
                        <p className="text-slate-700">
                          Já indicado por <strong>{x.bloqueadora_partner_nome}</strong> <span className="font-mono text-[#C9A84C]">{x.bloqueadora_partner_codigo}</span>
                          <span className="block text-slate-500">{x.bloqueadora_protocolo} · {dataHora(x.bloqueadora_em)} · {STATUS[x.bloqueadora_status] || x.bloqueadora_status}{x.bloqueadora_contrato ? ` · contrato ${x.bloqueadora_contrato}` : ''}</span>
                        </p>
                      ) : <p className="text-slate-500">Duplicidade</p>}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <p className={`font-medium ${sit.cls}`}>{sit.texto}</p>
                      {x.liberada_em && <p className="text-slate-500 mt-0.5">por {x.liberada_por} em {dataHora(x.liberada_em)}: {x.motivo_liberacao}</p>}
                    </td>
                    <td className="py-3 px-3">
                      {!x.liberada_em && (
                        <button className="inline-flex items-center gap-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-slate-100 min-h-[36px]" onClick={() => setLiberando(x)}>
                          <Unlock className="w-3.5 h-3.5" /> Liberar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ModalLiberar tentativa={liberando} onFechar={() => setLiberando(null)} onLiberado={() => { setLiberando(null); carregar(); }} />
    </div>
  );
}

function ModalLiberar({ tentativa, onFechar, onLiberado }) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setMotivo(''); }, [tentativa?.id]);
  async function liberar() {
    setSalvando(true);
    try {
      await api.post(`/referrals/tentativas/${tentativa.id}/liberar`, { motivo });
      toast.success('Liberada. A próxima indicação deste Partner para este cliente e produto vai passar.');
      onLiberado();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao liberar');
    } finally { setSalvando(false); }
  }
  return (
    <Modal open={Boolean(tentativa)} onClose={onFechar} title="Liberar indicação">
      {tentativa && (
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {tentativa.partner_nome} poderá indicar <span className="font-mono">{tentativa.documento_mascarado}</span> em {tentativa.produto} uma vez.
              {tentativa.bloqueadora_partner_nome ? ` A indicação de ${tentativa.bloqueadora_partner_nome} continua valendo.` : ''}
            </span>
          </div>
          <div>
            <label className="label" htmlFor="lib-motivo">Motivo (obrigatório)</label>
            <textarea id="lib-motivo" className="input min-h-[80px]" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ex.: segundo contrato legítimo do mesmo cliente na Azul" />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button className="btn-secondary" onClick={onFechar}>Voltar</button>
            <button className="btn-primary" disabled={salvando || motivo.trim().length < 3} onClick={liberar}>Liberar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
