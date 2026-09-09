import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import CurrencyInput from '../ui/CurrencyInput';
import { AlertTriangle, Loader2 } from 'lucide-react';

const CUSTO_CERTIFICADO  = 19.90;
const PRECO_AVISO_MINIMO = 30.00;

function validarPreco(preco) {
  const p = parseFloat(preco);
  if (isNaN(p) || p < CUSTO_CERTIFICADO) {
    return { bloqueado: true, aviso: `Valor não pode ser menor que o custo do certificado (R$ ${CUSTO_CERTIFICADO.toFixed(2)}).` };
  }
  if (p < PRECO_AVISO_MINIMO) {
    return { bloqueado: false, aviso: `Valor abaixo de R$ ${PRECO_AVISO_MINIMO.toFixed(2)} — lucro reduzido nesta venda.` };
  }
  return { bloqueado: false, aviso: null };
}

const fmt = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const EMPTY = {
  data_venda: new Date().toISOString().slice(0, 10),
  tipo_venda: 'direta',
  contabilidade_id: '',
  cliente_nome: '',
  cliente_cpf_cnpj: '',
  cliente_whatsapp: '',
  preco_venda: 0,
  comissao_contabilidade_valor: 0,
  observacoes: '',
};

export default function ModalNovaVenda({ open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [contabilidades, setContabilidades] = useState([]);
  const [comissaoPct, setComissaoPct] = useState(20);
  const [confirmado, setConfirmado] = useState(false);
  const [motivoReduzido, setMotivoReduzido] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setConfirmado(false);
    setMotivoReduzido('');
    api.get('/contabilidades-precos')
      .then(res => setContabilidades(res.data.filter(c => c.partner_id && c.ativo)))
      .catch(() => toast.error('Erro ao carregar contabilidades'));
    api.get('/direta/goal')
      .then(res => setComissaoPct(parseFloat(res.data.goal.comissao_pct)))
      .catch(() => setComissaoPct(20));
  }, [open]);

  const precoVenda = parseFloat(form.preco_venda || 0);
  const comissaoContab = form.tipo_venda === 'contabilidade' ? parseFloat(form.comissao_contabilidade_valor || 0) : 0;

  const { bloqueado, aviso } = validarPreco(precoVenda);
  const comissaoContabInvalida = form.tipo_venda === 'contabilidade' && comissaoContab > precoVenda;

  // Espelha diretaCalcService.calcularComissaoVenda — só pra preview em
  // tempo real, o cálculo de verdade é sempre refeito no backend.
  const base            = Math.max(0, precoVenda - comissaoContab);
  const comissaoVendedor = base * (comissaoPct / 100);
  const lucroMovv        = precoVenda - CUSTO_CERTIFICADO - comissaoContab - comissaoVendedor;

  const podeSubmeter = form.cliente_nome.trim()
    && precoVenda > 0
    && (form.tipo_venda === 'direta' || (!!form.contabilidade_id && form.comissao_contabilidade_valor !== ''))
    && !bloqueado && !comissaoContabInvalida
    && (!aviso || (confirmado && motivoReduzido.trim()));

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/direta/sales', {
        data_venda:        form.data_venda,
        tipo_venda:        form.tipo_venda,
        contabilidade_id:  form.tipo_venda === 'contabilidade' ? form.contabilidade_id : null,
        cliente_nome:      form.cliente_nome,
        cliente_cpf_cnpj:  form.cliente_cpf_cnpj || null,
        cliente_whatsapp:  form.cliente_whatsapp || null,
        preco_venda:       form.preco_venda,
        comissao_contabilidade_valor: form.tipo_venda === 'contabilidade' ? form.comissao_contabilidade_valor : undefined,
        observacoes:       form.observacoes || null,
        motivo_preco_reduzido: aviso ? motivoReduzido.trim() : undefined,
      });
      toast.success('Venda registrada com sucesso!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao registrar venda');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Venda" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="label">Data da venda</label>
          <input type="date" className="input" value={form.data_venda} onChange={e => set('data_venda', e.target.value)} />
        </div>

        <div>
          <label className="label">Tipo de venda</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'direta', l: 'Venda direta (cliente próprio)' },
              { v: 'contabilidade', l: 'Via contabilidade' },
            ].map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => { set('tipo_venda', opt.v); setConfirmado(false); setMotivoReduzido(''); }}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  form.tipo_venda === opt.v
                    ? 'bg-movv-gradient text-white border-[#0C2D48]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {form.tipo_venda === 'contabilidade' && (
          <div>
            <label className="label">Contabilidade</label>
            <select className="input" value={form.contabilidade_id} onChange={e => set('contabilidade_id', e.target.value)}>
              <option value="">Selecione...</option>
              {contabilidades.map(c => (
                <option key={c.partner_id} value={c.partner_id}>{c.name}</option>
              ))}
            </select>
            {contabilidades.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Nenhuma contabilidade ativa cadastrada.</p>
            )}
          </div>
        )}

        <div className={form.tipo_venda === 'contabilidade' ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="label">Valor total da venda</label>
            <CurrencyInput value={form.preco_venda} onChange={v => { set('preco_venda', v); setConfirmado(false); setMotivoReduzido(''); }} placeholder="Ex: 170,00" />
          </div>
          {form.tipo_venda === 'contabilidade' && (
            <div>
              <label className="label">Comissão da contabilidade</label>
              <CurrencyInput value={form.comissao_contabilidade_valor} onChange={v => set('comissao_contabilidade_valor', v)} placeholder="Ex: 75,00" />
              {comissaoContabInvalida && <p className="text-xs text-red-600 mt-1">Não pode ser maior que o valor da venda.</p>}
            </div>
          )}
        </div>

        {precoVenda > 0 && !bloqueado && !comissaoContabInvalida && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
            {form.tipo_venda === 'contabilidade' && (
              <p className="text-xs text-slate-500">Base pra sua comissão: <strong className="text-slate-700">{fmt(base)}</strong></p>
            )}
            <p className="text-sm text-slate-700">Sua comissão ({comissaoPct}%): <strong className="text-[#0C2D48]">{fmt(comissaoVendedor)}</strong></p>
            <p className="text-sm text-slate-700">Lucro Movv: <strong className="text-emerald-700">{fmt(lucroMovv)}</strong></p>
          </div>
        )}

        {aviso && (
          <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${bloqueado ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${bloqueado ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <p className={`text-xs ${bloqueado ? 'text-red-700' : 'text-amber-800'}`}>{aviso}</p>
              {!bloqueado && (
                <>
                  <label className="flex items-center gap-2 mt-2 text-xs text-amber-800">
                    <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />
                    Confirmo que quero registrar esta venda mesmo assim.
                  </label>
                  <div className="mt-2">
                    <label className="text-xs font-medium text-amber-800">Motivo do valor reduzido</label>
                    <textarea
                      className="input min-h-[50px] resize-none mt-1"
                      value={motivoReduzido}
                      onChange={e => setMotivoReduzido(e.target.value)}
                      placeholder="Explique por que este certificado foi vendido abaixo de R$ 30,00"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="label">Nome do cliente</label>
          <input className="input" value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} placeholder="Nome completo" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">CPF/CNPJ (opcional)</label>
            <input className="input" value={form.cliente_cpf_cnpj} onChange={e => set('cliente_cpf_cnpj', e.target.value)} />
          </div>
          <div>
            <label className="label">WhatsApp (opcional)</label>
            <input className="input" value={form.cliente_whatsapp} onChange={e => set('cliente_whatsapp', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Observações (opcional)</label>
          <textarea className="input min-h-[60px] resize-none" value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={!podeSubmeter || saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar Venda
          </button>
        </div>
      </div>
    </Modal>
  );
}
