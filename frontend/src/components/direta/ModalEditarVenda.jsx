import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import CurrencyInput from '../ui/CurrencyInput';
import { Loader2 } from 'lucide-react';

const CUSTO_CERTIFICADO = 19.90;
const fmt = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Edita uma venda já registrada — só valores/dados do cliente. Tipo, mês e
// contabilidade não mudam por aqui (ver diretaSalesController.updateSale);
// pra corrigir isso, é excluir e recadastrar.
export default function ModalEditarVenda({ venda, onClose, onSaved }) {
  const [preco, setPreco] = useState(0);
  const [comissaoContab, setComissaoContab] = useState(0);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!venda) return;
    setPreco(parseFloat(venda.preco_venda));
    setComissaoContab(parseFloat(venda.comissao_contabilidade_valor || 0));
    setClienteNome(venda.cliente_nome || '');
    setClienteCpfCnpj(venda.cliente_cpf_cnpj || '');
    setClienteWhatsapp(venda.cliente_whatsapp || '');
    setObservacoes(venda.observacoes || '');
    setMotivo('');
  }, [venda]);

  if (!venda) return null;

  const pct = parseFloat(venda.comissao_pct);
  const comissaoContabFinal = venda.tipo_venda === 'contabilidade' ? comissaoContab : 0;
  const base            = Math.max(0, preco - comissaoContabFinal);
  const comissaoVendedor = base * (pct / 100);
  const lucroMovv        = preco - CUSTO_CERTIFICADO - comissaoContabFinal - comissaoVendedor;
  const comissaoContabInvalida = venda.tipo_venda === 'contabilidade' && comissaoContab > preco;

  const podeSalvar = clienteNome.trim() && preco >= CUSTO_CERTIFICADO && !comissaoContabInvalida;

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/direta/sales/${venda.id}`, {
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteCpfCnpj || null,
        cliente_whatsapp: clienteWhatsapp || null,
        preco_venda: preco,
        comissao_contabilidade_valor: venda.tipo_venda === 'contabilidade' ? comissaoContab : undefined,
        observacoes: observacoes || null,
        motivo: motivo.trim() || null,
      });
      toast.success('Venda atualizada!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao editar venda');
    } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Editar venda — ${venda.cliente_nome}`} maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className={venda.tipo_venda === 'contabilidade' ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="label">Valor total da venda</label>
            <CurrencyInput value={preco} onChange={setPreco} />
          </div>
          {venda.tipo_venda === 'contabilidade' && (
            <div>
              <label className="label">Comissão da contabilidade</label>
              <CurrencyInput value={comissaoContab} onChange={setComissaoContab} />
              {comissaoContabInvalida && <p className="text-xs text-red-600 mt-1">Não pode ser maior que o valor da venda.</p>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
          <p className="text-sm text-slate-700">Sua comissão ({pct}%): <strong className="text-[#0C2D48]">{fmt(comissaoVendedor)}</strong></p>
          <p className="text-sm text-slate-700">Lucro Movv: <strong className="text-emerald-700">{fmt(lucroMovv)}</strong></p>
          <p className="text-[11px] text-slate-400">O percentual de comissão fica travado no que já foi gravado nesta venda ({pct}%) — editar não muda o degrau da meta.</p>
        </div>

        <div>
          <label className="label">Nome do cliente</label>
          <input className="input" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">CPF/CNPJ (opcional)</label>
            <input className="input" value={clienteCpfCnpj} onChange={e => setClienteCpfCnpj(e.target.value)} />
          </div>
          <div>
            <label className="label">WhatsApp (opcional)</label>
            <input className="input" value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Observações (opcional)</label>
          <textarea className="input min-h-[60px] resize-none" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
        </div>
        <div>
          <label className="label">Motivo da correção (opcional, fica no histórico)</label>
          <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: cliente pediu pra trocar o valor" />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={!podeSalvar || saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
