import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Loader2, AlertTriangle, Pencil, X } from 'lucide-react';
import api from '../../services/api';
import { reais, NIVEIS } from '../universidade/comissoesRotulos';

// Cadastro para pagamento do MOVV Partner (migration 098): chave PIX (o
// Partner preenche em "Meu perfil") e CPF/CNPJ + tipo (a equipe preenche
// aqui). Só admin e financeiro chegam nesta tela. Na lista, tudo mascarado.

export const TIPO_PIX = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Celular', aleatoria: 'Chave aleatória' };
export const TIPO_PARCEIRO = { mei: 'MEI', pj: 'PJ', autonomo: 'Autônomo' };
const dataHora = v => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '');

export function CadastroPagamento() {
  const [lista, setLista] = useState(null);
  const [soIncompletos, setSoIncompletos] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(() => {
    api.get('/partner-comissoes/admin/cadastros', { params: soIncompletos ? { incompletos: 1 } : {} })
      .then(r => setLista(r.data))
      .catch(err => toast.error(err.response?.data?.error || 'Erro ao carregar os cadastros'));
  }, [soIncompletos]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 max-w-2xl">Sem chave PIX ou sem CPF/CNPJ, o pagamento da comissão fica bloqueado. A chave PIX o próprio Partner cadastra em "Meu perfil"; o CPF/CNPJ e o tipo, a equipe cadastra aqui.</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={soIncompletos} onChange={e => setSoIncompletos(e.target.checked)} /> Só cadastro incompleto (ativos)
        </label>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>{['Partner', 'Chave PIX', 'CPF/CNPJ', 'A receber', 'Situação', ''].map(h => <th key={h} className="text-left text-slate-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {!lista ? (
                <tr><td colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-movv-900 mx-auto" /></td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">{soIncompletos ? 'Nenhum Partner ativo com cadastro incompleto.' : 'Nenhum Partner.'}</td></tr>
              ) : lista.map(p => (
                <tr key={p.id} className="border-b border-slate-100 align-top">
                  <td className="py-3 px-3 text-xs">
                    <p className="text-slate-900 font-medium">{p.name}</p>
                    <p className="text-[#C9A84C] font-mono">{p.code} · {NIVEIS[p.nivel_partner] || 'sem nível'}{p.is_active ? '' : ' · inativo'}</p>
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {p.pix ? <><p className="font-mono text-slate-900">{p.pix}</p><p className="text-slate-400">{TIPO_PIX[p.pix_key_type]}</p></> : <span className="text-red-600">não cadastrada</span>}
                    {p.pix_alterada_em && <p className="text-amber-700 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> trocada em {dataHora(p.pix_alterada_em)}</p>}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {p.documento ? <><p className="font-mono text-slate-900">{p.documento}</p><p className="text-slate-400">{TIPO_PARCEIRO[p.tipo_parceiro]}{p.razao_social ? ` · ${p.razao_social}` : ''}</p></> : <span className="text-red-600">não cadastrado</span>}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">{reais(p.a_receber)}{Number(p.aprovado_a_pagar) > 0 && <p className="text-xs text-slate-500">{reais(p.aprovado_a_pagar)} aprovado</p>}</td>
                  <td className="py-3 px-3 text-xs">{p.faltas.length ? <span className="text-red-600 font-medium">falta {p.faltas.join(' e ')}</span> : <span className="text-emerald-700 font-medium">completo</span>}</td>
                  <td className="py-3 px-3"><button className="inline-flex items-center gap-1 text-xs border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-100" onClick={() => setEditando(p)}><Pencil className="w-3.5 h-3.5" /> CPF/CNPJ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editando && <ModalDocumento partner={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ModalDocumento({ partner, onFechar, onSalvo }) {
  const [f, setF] = useState({ documento: '', tipo_parceiro: partner.tipo_parceiro || 'mei', razao_social: partner.razao_social || '' });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    // completo só aqui, para quem pode editar (admin e financeiro)
    api.get(`/partner-comissoes/admin/partners/${partner.id}/cadastro`)
      .then(r => setF(x => ({ ...x, documento: r.data.documento || '' })))
      .catch(() => {});
  }, [partner.id]);
  async function salvar() {
    setSalvando(true);
    try {
      await api.put(`/partner-comissoes/admin/partners/${partner.id}/documento`, f);
      toast.success('Documento salvo');
      onSalvo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">CPF/CNPJ de {partner.name}</h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="label">Tipo de parceiro</label>
            <select className="input" value={f.tipo_parceiro} onChange={e => setF(x => ({ ...x, tipo_parceiro: e.target.value }))}>
              {Object.entries(TIPO_PARCEIRO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">Autônomo usa CPF; MEI e PJ usam CNPJ.</p>
          </div>
          <div><label className="label">{f.tipo_parceiro === 'autonomo' ? 'CPF' : 'CNPJ'}</label>
            <input className="input font-mono" inputMode="numeric" value={f.documento} onChange={e => setF(x => ({ ...x, documento: e.target.value.replace(/[^\d./-]/g, '').slice(0, 18) }))} />
          </div>
          {f.tipo_parceiro !== 'autonomo' && (
            <div><label className="label">Razão social (opcional)</label>
              <input className="input" value={f.razao_social} onChange={e => setF(x => ({ ...x, razao_social: e.target.value }))} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onFechar}>Voltar</button>
            <button className="btn-primary" disabled={salvando || !f.documento} onClick={salvar}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dentro do modal de pagar: para quem vai o PIX (chave completa só aqui)
export function ParaQuemPagar({ partnerIds }) {
  const [cadastros, setCadastros] = useState(null);
  useEffect(() => {
    Promise.all([...new Set(partnerIds)].map(id => api.get(`/partner-comissoes/admin/partners/${id}/cadastro`).then(r => r.data)))
      .then(setCadastros)
      .catch(() => setCadastros([]));
  }, [partnerIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cadastros) return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando a chave PIX…</p>;
  return (
    <div className="space-y-2">
      {cadastros.map(c => (
        <div key={c.id} className={`rounded-xl border p-3 text-sm ${c.faltas.length ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
          <p className="font-medium text-slate-900">{c.name} <span className="text-xs font-mono text-[#C9A84C]">{c.code}</span></p>
          {c.pix_key ? <p className="text-slate-700">PIX ({TIPO_PIX[c.pix_key_type]}): <span className="font-mono select-all">{c.pix_key}</span></p> : null}
          {c.faltas.length > 0 && <p className="text-red-700 font-medium">Cadastro incompleto: falta {c.faltas.join(' e ')}. O pagamento será bloqueado.</p>}
          {c.pix_alterada_em && <p className="text-amber-800 flex items-center gap-1 mt-1"><AlertTriangle className="w-4 h-4" /> Chave trocada em {dataHora(c.pix_alterada_em)} por {c.pix_alterada_por}. Confira com o Partner antes de pagar.</p>}
        </div>
      ))}
    </div>
  );
}
