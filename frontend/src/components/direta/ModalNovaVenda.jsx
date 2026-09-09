import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import CurrencyInput from '../ui/CurrencyInput';
import { AlertTriangle, Loader2, FileBadge2, Usb } from 'lucide-react';

const CUSTO_CERTIFICADO  = 19.90;
const PRECO_AVISO_MINIMO = 30.00;

function validarPrecoCert(preco) {
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
  valor_venda_certificado: 0,
  comissao_contab_certificado: 0,
  incluiu_token: false,
  valor_compra_token: 0,
  valor_venda_token: 0,
  comissao_contab_token: 0,
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

  const viaContab = form.tipo_venda === 'contabilidade';
  const precoCert = parseFloat(form.valor_venda_certificado || 0);
  const contabCert = viaContab ? parseFloat(form.comissao_contab_certificado || 0) : 0;
  const { bloqueado, aviso } = validarPrecoCert(precoCert);
  const contabCertInvalida = viaContab && contabCert > precoCert;

  const baseCert     = Math.max(0, precoCert - contabCert);
  const comissaoCert = baseCert * (comissaoPct / 100);
  const lucroCert     = precoCert - CUSTO_CERTIFICADO - contabCert - comissaoCert;

  const compraToken = parseFloat(form.valor_compra_token || 0);
  const vendaToken   = parseFloat(form.valor_venda_token || 0);
  const contabToken  = viaContab ? parseFloat(form.comissao_contab_token || 0) : 0;
  const tokenValorInvalido = form.incluiu_token && vendaToken <= compraToken;
  const contabTokenInvalida = form.incluiu_token && viaContab && contabToken > vendaToken;

  const baseToken     = form.incluiu_token ? Math.max(0, vendaToken - contabToken) : 0;
  const comissaoToken = form.incluiu_token ? baseToken * (comissaoPct / 100) : 0;
  const lucroToken     = form.incluiu_token ? vendaToken - compraToken - contabToken - comissaoToken : 0;

  const totalVenda    = precoCert + (form.incluiu_token ? vendaToken : 0);
  const totalComissao = comissaoCert + comissaoToken;
  const totalLucro     = lucroCert + lucroToken;

  const podeSubmeter = form.cliente_nome.trim()
    && precoCert > 0
    && (!viaContab || (!!form.contabilidade_id && form.comissao_contab_certificado !== ''))
    && !bloqueado && !contabCertInvalida
    && (!aviso || (confirmado && motivoReduzido.trim()))
    && (!form.incluiu_token || (
      compraToken >= 0 && vendaToken > 0 && !tokenValorInvalido && !contabTokenInvalida
      && (!viaContab || form.comissao_contab_token !== '')
    ));

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/direta/sales', {
        data_venda:        form.data_venda,
        tipo_venda:        form.tipo_venda,
        contabilidade_id:  viaContab ? form.contabilidade_id : null,
        cliente_nome:      form.cliente_nome,
        cliente_cpf_cnpj:  form.cliente_cpf_cnpj || null,
        cliente_whatsapp:  form.cliente_whatsapp || null,
        valor_venda_certificado:     form.valor_venda_certificado,
        comissao_contab_certificado: viaContab ? form.comissao_contab_certificado : undefined,
        incluiu_token:        form.incluiu_token,
        valor_compra_token:   form.incluiu_token ? form.valor_compra_token : undefined,
        valor_venda_token:    form.incluiu_token ? form.valor_venda_token : undefined,
        comissao_contab_token: (form.incluiu_token && viaContab) ? form.comissao_contab_token : undefined,
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
      <div className="space-y-5">
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

        {viaContab && (
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

        {/* Bloco 1 — Certificado (sempre) */}
        <div className="rounded-2xl border border-[#0C2D48]/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0C2D48] text-white">
            <FileBadge2 className="w-4 h-4" />
            <p className="text-sm font-bold">Certificado Digital</p>
          </div>
          <div className="p-4 space-y-3">
            <div className={viaContab ? 'grid grid-cols-2 gap-3' : ''}>
              <div>
                <label className="label">Valor da venda</label>
                <CurrencyInput value={form.valor_venda_certificado} onChange={v => { set('valor_venda_certificado', v); setConfirmado(false); setMotivoReduzido(''); }} placeholder="Ex: 170,00" />
              </div>
              {viaContab && (
                <div>
                  <label className="label">Comissão da contabilidade</label>
                  <CurrencyInput value={form.comissao_contab_certificado} onChange={v => set('comissao_contab_certificado', v)} placeholder="Ex: 75,00" />
                  {contabCertInvalida && <p className="text-xs text-red-600 mt-1">Não pode ser maior que o valor da venda.</p>}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Custo do certificado: R$ 19,90 (fixo)</p>

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
          </div>
        </div>

        {/* Bloco 2 — Token (opcional) */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <label className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 cursor-pointer select-none">
            <input type="checkbox" checked={form.incluiu_token} onChange={e => set('incluiu_token', e.target.checked)} />
            <Usb className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-bold text-slate-700">Incluir Token nessa venda?</p>
          </label>
          {form.incluiu_token && (
            <div className="p-4 space-y-3">
              <div className={viaContab ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3'}>
                <div>
                  <label className="label">Valor de compra</label>
                  <CurrencyInput value={form.valor_compra_token} onChange={v => set('valor_compra_token', v)} placeholder="Ex: 30,00" />
                </div>
                <div>
                  <label className="label">Valor de venda</label>
                  <CurrencyInput value={form.valor_venda_token} onChange={v => set('valor_venda_token', v)} placeholder="Ex: 50,00" />
                </div>
              </div>
              {tokenValorInvalido && <p className="text-xs text-red-600">Valor de venda deve ser maior que o valor de compra.</p>}
              {viaContab && (
                <div>
                  <label className="label">Comissão da contabilidade (token)</label>
                  <CurrencyInput value={form.comissao_contab_token} onChange={v => set('comissao_contab_token', v)} placeholder="Ex: 10,00" />
                  {contabTokenInvalida && <p className="text-xs text-red-600 mt-1">Não pode ser maior que o valor de venda do token.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prévia de cálculo */}
        {precoCert > 0 && !bloqueado && !contabCertInvalida && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2.5">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Certificado</p>
              {viaContab && <p className="text-xs text-slate-500 mt-0.5">Base pra comissão: <strong className="text-slate-700">{fmt(baseCert)}</strong></p>}
              <p className="text-sm text-slate-700">Sua comissão ({comissaoPct}%): <strong className="text-[#0C2D48]">{fmt(comissaoCert)}</strong></p>
              <p className="text-sm text-slate-700">Lucro Movv: <strong className="text-emerald-700">{fmt(lucroCert)}</strong></p>
            </div>
            {form.incluiu_token && !tokenValorInvalido && !contabTokenInvalida && (
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Token</p>
                {viaContab && <p className="text-xs text-slate-500 mt-0.5">Base pra comissão: <strong className="text-slate-700">{fmt(baseToken)}</strong></p>}
                <p className="text-sm text-slate-700">Sua comissão ({comissaoPct}%): <strong className="text-[#0C2D48]">{fmt(comissaoToken)}</strong></p>
                <p className="text-sm text-slate-700">Lucro Movv: <strong className="text-emerald-700">{fmt(lucroToken)}</strong></p>
              </div>
            )}
            <div className="pt-2 border-t border-slate-300 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total da venda: <strong>{fmt(totalVenda)}</strong></p>
                <p className="text-sm font-bold text-[#0C2D48]">Total sua comissão: {fmt(totalComissao)}</p>
              </div>
              <p className="text-sm font-bold text-emerald-700">Lucro Movv: {fmt(totalLucro)}</p>
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
