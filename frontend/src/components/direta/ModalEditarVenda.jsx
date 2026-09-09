import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import CurrencyInput from '../ui/CurrencyInput';
import { Loader2, FileBadge2, Usb } from 'lucide-react';

const CUSTO_CERTIFICADO = 19.90;
const fmt = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Edita uma venda já registrada — só valores/dados do cliente. Tipo, mês,
// contabilidade e se tem token ou não não mudam por aqui (ver
// diretaSalesController.updateSale); pra corrigir isso, é excluir e
// recadastrar.
export default function ModalEditarVenda({ venda, onClose, onSaved }) {
  const [preco, setPreco] = useState(0);
  const [comissaoContab, setComissaoContab] = useState(0);
  const [compraToken, setCompraToken] = useState(0);
  const [vendaTokenValor, setVendaTokenValor] = useState(0);
  const [comissaoContabToken, setComissaoContabToken] = useState(0);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!venda) return;
    setPreco(parseFloat(venda.valor_venda_certificado));
    setComissaoContab(parseFloat(venda.comissao_contab_certificado || 0));
    setCompraToken(parseFloat(venda.valor_compra_token || 0));
    setVendaTokenValor(parseFloat(venda.valor_venda_token || 0));
    setComissaoContabToken(parseFloat(venda.comissao_contab_token || 0));
    setClienteNome(venda.cliente_nome || '');
    setClienteCpfCnpj(venda.cliente_cpf_cnpj || '');
    setClienteWhatsapp(venda.cliente_whatsapp || '');
    setObservacoes(venda.observacoes || '');
    setMotivo('');
  }, [venda]);

  if (!venda) return null;

  const viaContab = venda.tipo_venda === 'contabilidade';
  const pct = parseFloat(venda.comissao_pct);

  const comissaoContabCertFinal = viaContab ? comissaoContab : 0;
  const baseCert     = Math.max(0, preco - comissaoContabCertFinal);
  const comissaoCert = baseCert * (pct / 100);
  const lucroCert     = preco - CUSTO_CERTIFICADO - comissaoContabCertFinal - comissaoCert;
  const contabCertInvalida = viaContab && comissaoContab > preco;

  const temToken = !!venda.incluiu_token;
  const comissaoContabTokenFinal = (temToken && viaContab) ? comissaoContabToken : 0;
  const baseToken     = temToken ? Math.max(0, vendaTokenValor - comissaoContabTokenFinal) : 0;
  const comissaoToken = temToken ? baseToken * (pct / 100) : 0;
  const lucroToken     = temToken ? vendaTokenValor - compraToken - comissaoContabTokenFinal - comissaoToken : 0;
  const tokenValorInvalido = temToken && vendaTokenValor <= compraToken;
  const contabTokenInvalida = temToken && viaContab && comissaoContabToken > vendaTokenValor;

  const totalComissao = comissaoCert + comissaoToken;
  const totalLucro     = lucroCert + lucroToken;

  const podeSalvar = clienteNome.trim() && preco >= CUSTO_CERTIFICADO && !contabCertInvalida
    && (!temToken || (!tokenValorInvalido && !contabTokenInvalida));

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/direta/sales/${venda.id}`, {
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteCpfCnpj || null,
        cliente_whatsapp: clienteWhatsapp || null,
        valor_venda_certificado: preco,
        comissao_contab_certificado: viaContab ? comissaoContab : undefined,
        valor_compra_token: temToken ? compraToken : undefined,
        valor_venda_token: temToken ? vendaTokenValor : undefined,
        comissao_contab_token: (temToken && viaContab) ? comissaoContabToken : undefined,
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
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#0C2D48]/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0C2D48] text-white">
            <FileBadge2 className="w-4 h-4" />
            <p className="text-sm font-bold">Certificado Digital</p>
          </div>
          <div className="p-4 space-y-2">
            <div className={viaContab ? 'grid grid-cols-2 gap-3' : ''}>
              <div>
                <label className="label">Valor da venda</label>
                <CurrencyInput value={preco} onChange={setPreco} />
              </div>
              {viaContab && (
                <div>
                  <label className="label">Comissão da contabilidade</label>
                  <CurrencyInput value={comissaoContab} onChange={setComissaoContab} />
                  {contabCertInvalida && <p className="text-xs text-red-600 mt-1">Não pode ser maior que o valor da venda.</p>}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-700">Sua comissão ({pct}%): <strong className="text-[#0C2D48]">{fmt(comissaoCert)}</strong> · Lucro Movv: <strong className="text-emerald-700">{fmt(lucroCert)}</strong></p>
          </div>
        </div>

        {temToken && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50">
              <Usb className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-bold text-slate-700">Token</p>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor de compra</label>
                  <CurrencyInput value={compraToken} onChange={setCompraToken} />
                </div>
                <div>
                  <label className="label">Valor de venda</label>
                  <CurrencyInput value={vendaTokenValor} onChange={setVendaTokenValor} />
                </div>
              </div>
              {tokenValorInvalido && <p className="text-xs text-red-600">Valor de venda deve ser maior que o valor de compra.</p>}
              {viaContab && (
                <div>
                  <label className="label">Comissão da contabilidade (token)</label>
                  <CurrencyInput value={comissaoContabToken} onChange={setComissaoContabToken} />
                  {contabTokenInvalida && <p className="text-xs text-red-600 mt-1">Não pode ser maior que o valor de venda do token.</p>}
                </div>
              )}
              <p className="text-sm text-slate-700">Sua comissão ({pct}%): <strong className="text-[#0C2D48]">{fmt(comissaoToken)}</strong> · Lucro Movv: <strong className="text-emerald-700">{fmt(lucroToken)}</strong></p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-bold text-[#0C2D48]">Total sua comissão: {fmt(totalComissao)}</p>
          <p className="text-sm font-bold text-emerald-700">Total lucro Movv: {fmt(totalLucro)}</p>
        </div>
        <p className="text-[11px] text-slate-400 -mt-3">O percentual de comissão fica travado no que já foi gravado nesta venda ({pct}%) — editar não muda o degrau da meta.</p>

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
