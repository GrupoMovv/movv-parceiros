import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  Store, Loader2, ChevronLeft, ChevronRight, MessageCircle,
  CheckCircle2, XCircle, Copy, Check, PartyPopper,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';

const LIMIT = 20;

const STATUS_LABEL = {
  pendente:  { label: 'Pendente',  cls: 'bg-amber-100 text-amber-700' },
  aprovado:  { label: 'Aprovado',  cls: 'bg-emerald-100 text-emerald-700' },
  rejeitado: { label: 'Rejeitado', cls: 'bg-slate-100 text-slate-500' },
};

const SEGMENTO_LABEL = {
  produtos: 'Produtos', servicos: 'Serviços', alimentacao: 'Alimentação', hospedagem: 'Hospedagem', outro: 'Outro',
};

function fmtCnpj(v) {
  const d = String(v || '').replace(/\D/g, '').padStart(14, '0');
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function fmtCpf(v) {
  const d = String(v || '').replace(/\D/g, '').padStart(11, '0');
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function fmtDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

export default function SindicatoParceirosSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState('pendente');
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState(null); // solicitação sendo rejeitada
  const [motivoTexto, setMotivoTexto] = useState('');
  const [credenciais, setCredenciais] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFiltro) params.status = statusFiltro;
      const res = await api.get('/sindicato-parceiros-solicitacoes', { params });
      setSolicitacoes(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }, [page, statusFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleAprovar(id) {
    setProcessando(true);
    try {
      const res = await api.patch(`/sindicato-parceiros-solicitacoes/${id}/aprovar`);
      toast.success('Parceiro aprovado!');
      setDetalhe(null);
      setCredenciais(res.data);
      setCopiado(false);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar');
    } finally {
      setProcessando(false);
    }
  }

  async function handleRejeitar() {
    setProcessando(true);
    try {
      await api.patch(`/sindicato-parceiros-solicitacoes/${motivoRejeicao.id}/rejeitar`, { motivo: motivoTexto });
      toast.success('Solicitação rejeitada');
      setMotivoRejeicao(null);
      setDetalhe(null);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao rejeitar');
    } finally {
      setProcessando(false);
    }
  }

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(credenciais.mensagem_whatsapp);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { toast.error('Erro ao copiar'); }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Store className="w-6 h-6 text-movv-900" /> Solicitações de Parceiros — IUB MAIS
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Comerciantes que se cadastraram pela página pública /vender e aguardam aprovação
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[['', 'Todas'], ['pendente', 'Pendentes'], ['aprovado', 'Aprovados'], ['rejeitado', 'Rejeitados']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => { setStatusFiltro(v); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFiltro === v ? 'bg-movv-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : solicitacoes.length === 0 ? (
          <p className="text-center text-slate-400 py-12">Nenhuma solicitação encontrada</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {solicitacoes.map(s => (
              <button
                key={s.id} onClick={() => setDetalhe(s)}
                className="w-full py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors -mx-6 px-6"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{s.nome_fantasia}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_LABEL[s.status]?.cls}`}>
                      {STATUS_LABEL[s.status]?.label}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {SEGMENTO_LABEL[s.segmento] || s.segmento} · CNPJ {fmtCnpj(s.cnpj)}
                  </p>
                  <p className="text-slate-400 text-xs mt-1">{fmtDataHora(s.created_at)}</p>
                </div>
                <span className="text-xs font-semibold text-movv-900 flex-shrink-0">Ver detalhes →</span>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-slate-500 text-xs">Página {page} de {totalPages} · {total} solicitações</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-2 py-1.5 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary px-2 py-1.5 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detalhe */}
      <Modal open={!!detalhe} onClose={() => setDetalhe(null)} title="Detalhes da solicitação" maxWidth="max-w-xl">
        {detalhe && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-sm">
              <Linha label="Nome fantasia" valor={detalhe.nome_fantasia} />
              <Linha label="Razão social" valor={detalhe.razao_social} />
              <Linha label="CNPJ" valor={fmtCnpj(detalhe.cnpj)} />
              <Linha label="Segmento" valor={SEGMENTO_LABEL[detalhe.segmento] || detalhe.segmento} />
              <Linha label="Categoria" valor={detalhe.categoria_principal} />
              <Linha label="Descrição" valor={detalhe.descricao_curta} />
              <Linha label="Endereço" valor={`${detalhe.endereco || ''}${detalhe.bairro ? `, ${detalhe.bairro}` : ''} — ${detalhe.cidade}/${detalhe.estado}`} />
              <Linha label="WhatsApp" valor={detalhe.whatsapp} />
              <Linha label="E-mail" valor={detalhe.email} />
              <Linha label="Instagram" valor={detalhe.instagram} />
              <Linha label="Responsável" valor={detalhe.responsavel_nome} />
              <Linha label="CPF do responsável" valor={fmtCpf(detalhe.responsavel_cpf)} />
              <Linha label="Cargo" valor={detalhe.responsavel_cargo} />
              <Linha label="Enviado em" valor={fmtDataHora(detalhe.created_at)} />
              {detalhe.status !== 'pendente' && (
                <Linha label="Status" valor={STATUS_LABEL[detalhe.status]?.label} />
              )}
              {detalhe.observacoes_admin && <Linha label="Motivo rejeição" valor={detalhe.observacoes_admin} />}
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={`https://api.whatsapp.com/send?phone=55${String(detalhe.whatsapp).replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>

              {detalhe.status === 'pendente' && (
                <>
                  <button
                    onClick={() => handleAprovar(detalhe.id)} disabled={processando}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 ml-auto"
                  >
                    {processando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Aprovar
                  </button>
                  <button
                    onClick={() => { setMotivoTexto(''); setMotivoRejeicao(detalhe); }}
                    disabled={processando}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Motivo de rejeição */}
      <Modal open={!!motivoRejeicao} onClose={() => setMotivoRejeicao(null)} title="Rejeitar solicitação">
        {motivoRejeicao && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Por que <strong>{motivoRejeicao.nome_fantasia}</strong> está sendo rejeitada? O motivo vai pro e-mail do comerciante.</p>
            <textarea
              className="input resize-none" rows={3} value={motivoTexto}
              onChange={e => setMotivoTexto(e.target.value)}
              placeholder="Ex: CNPJ inválido, dados incompletos..."
            />
            <div className="flex gap-3">
              <button onClick={() => setMotivoRejeicao(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleRejeitar} disabled={processando} className="btn-danger flex-1 flex items-center justify-center gap-2">
                {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Credenciais geradas na aprovação */}
      <Modal open={!!credenciais} onClose={() => setCredenciais(null)} title="Parceiro aprovado!">
        {credenciais && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
              <PartyPopper className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-semibold">{credenciais.parceiro.nome} já pode acessar o painel do parceiro.</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-sm">
              <CredRow label="E-mail" value={credenciais.email} />
              <CredRow label="Senha" value={credenciais.plain_password} highlight />
            </div>
            <p className="text-xs text-slate-500">Um e-mail com essas credenciais já foi enviado automaticamente. Você também pode mandar por WhatsApp.</p>
            <div className="flex gap-3">
              <button onClick={handleCopiar} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                {copiado ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar texto</>}
              </button>
              <a
                href={credenciais.whatsapp_link} target="_blank" rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Linha({ label, valor }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400 text-xs flex-shrink-0">{label}</span>
      <span className="text-slate-700 font-medium text-right">{valor}</span>
    </div>
  );
}

function CredRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono font-semibold ${highlight ? 'text-base text-movv-900' : ''}`}>{value}</span>
    </div>
  );
}
