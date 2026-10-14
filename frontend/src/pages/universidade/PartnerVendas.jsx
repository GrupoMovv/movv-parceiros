import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronDown, Loader2, UserPlus, ShoppingBag } from 'lucide-react';
import api from '../../services/api';
import { reais, pct, competenciaBR, dataBR } from './comissoesRotulos';
import { AvisoPrevia } from './UniversidadeHome';

// "Minhas vendas" do MOVV Partner: indicações e comissões numa lista só.
// Na linha, só palavras simples; base, percentual e mês ficam no "ver
// detalhes" (decisão A). Com `previa`, é o "Ver como Partner" do admin.

const COR = {
  'Indicado': 'bg-slate-100 text-slate-600',
  'Em análise': 'bg-amber-100 text-amber-800',
  'Comissão prevista': 'bg-sky-50 text-sky-800',
  'Comissão confirmada': 'bg-blue-100 text-movv-900',
  'Aprovada, a pagar': 'bg-indigo-100 text-indigo-800',
  'Cancelada': 'bg-red-50 text-red-600',
};
const corDa = s => (s.startsWith('Paga') ? 'bg-emerald-100 text-emerald-800' : COR[s] || 'bg-slate-100 text-slate-600');

// "Sua comissão: Azul 30% · Certificado 20%" (da regra vigente do nível)
export function LinhaComissao({ comissao, className = '' }) {
  if (!comissao?.length) return <p className={`text-sm text-slate-500 ${className}`}>Sua comissão aparece aqui quando a Central definir seu nível.</p>;
  return (
    <p className={`text-sm text-slate-700 ${className}`}>
      Sua comissão: {comissao.map((c, i) => (
        <span key={c.origem}>{i > 0 && ' · '}<strong>{c.rotulo} {c.texto}</strong></span>
      ))}
    </p>
  );
}

export function LinhaVenda({ v, onCpfSalvo, previa }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="card p-0 overflow-hidden">
      <button type="button" onClick={() => setAberta(a => !a)} aria-expanded={aberta}
        className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 truncate">{v.cliente_nome || 'Cliente'}</span>
          <span className="block text-xs text-slate-500 truncate">{v.produto}</span>
        </span>
        <span className="flex flex-col items-end gap-1 flex-shrink-0">
          {v.valor && <span className={`font-bold tabular-nums ${v.situacao === 'Cancelada' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{reais(v.valor)}</span>}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${corDa(v.situacao)}`}>{v.situacao}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>
      {aberta && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 text-sm">
          {v.tipo === 'lancamento' ? <DetalhesComissao d={v.detalhes} /> : <DetalhesIndicacao d={v.detalhes} onCpfSalvo={onCpfSalvo} previa={previa} />}
        </div>
      )}
    </div>
  );
}

function Item({ rotulo, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="text-slate-900 text-right font-medium">{children}</dd>
    </div>
  );
}

function DetalhesComissao({ d }) {
  return (
    <dl className="divide-y divide-slate-100">
      <Item rotulo="Origem">{d.origem}</Item>
      <Item rotulo="Base">{reais(d.base_valor)}</Item>
      <Item rotulo="Percentual">{pct(d.percentual)}</Item>
      <Item rotulo="Seu valor">{reais(d.valor_partner)}</Item>
      <Item rotulo="Competência">{competenciaBR(d.competencia)}</Item>
      {d.numero_contrato && <Item rotulo="Contrato"><span className="font-mono">{d.numero_contrato}</span></Item>}
      {d.pago_em && <Item rotulo="Pago em">{dataBR(d.pago_em)}</Item>}
    </dl>
  );
}

function DetalhesIndicacao({ d, onCpfSalvo, previa }) {
  const [cpf, setCpf] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setSalvando(true);
    try {
      await api.patch(`/referrals/${d.indicacao_id}/dados`, { client_cpf: cpf.replace(/\D/g, '') });
      toast.success('CPF salvo');
      onCpfSalvo?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não deu para salvar o CPF');
    } finally { setSalvando(false); }
  }
  return (
    <dl className="divide-y divide-slate-100">
      <Item rotulo="Indicado em">{dataBR(d.indicado_em)}</Item>
      <Item rotulo="Protocolo"><span className="font-mono">{d.protocolo}</span></Item>
      <Item rotulo="Contrato">{d.numero_contrato ? <span className="font-mono">{d.numero_contrato}</span> : 'ainda não'}</Item>
      {d.cpf_pendente && !previa ? (
        <div className="pt-2">
          <p className="text-slate-600 mb-1.5">Informe o CPF: sua comissão é ligada à venda mais rápido.</p>
          <div className="flex gap-2">
            <input className="input min-h-[44px] flex-1" inputMode="numeric" placeholder="000.000.000-00"
              value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))} />
            <button type="button" className="btn-primary min-h-[44px] px-4" disabled={salvando || cpf.replace(/\D/g, '').length !== 11} onClick={salvar}>Salvar</button>
          </div>
        </div>
      ) : (
        <Item rotulo="CPF"><span className="font-mono">{d.cpf || '—'}</span></Item>
      )}
    </dl>
  );
}

export function mascaraCpf(valor) {
  const d = String(valor).replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const FILTROS = [['todas', 'Todas'], ['a_receber', 'A receber'], ['paga', 'Pagas']];

export default function PartnerVendas({ previa = false }) {
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState('todas');

  const carregar = useCallback(() => {
    api.get(previa ? '/partner-comissoes/previa' : '/partner-comissoes/vendas')
      .then(r => setDados(r.data))
      .catch(err => toast.error(err.response?.data?.error || 'Não deu para carregar suas vendas'));
  }, [previa]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!dados) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-movv-900" /></div>;
  const lista = filtro === 'todas' ? dados.vendas : dados.vendas.filter(v => v.grupo === filtro);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {previa && <AvisoPrevia />}
      <div>
        <h1 className="text-xl font-display font-semibold text-slate-900">Minhas vendas</h1>
        <LinhaComissao comissao={dados.comissao} className="mt-1" />
      </div>

      {dados.vendas.length === 0 ? (
        <Vazio previa={previa} />
      ) : (
        <>
          <div className="flex gap-2">
            {FILTROS.map(([k, r]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)}
                className={`min-h-[44px] flex-1 rounded-xl text-sm font-semibold border ${filtro === k ? 'bg-movv-900 text-white border-movv-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                {r}
              </button>
            ))}
          </div>
          {lista.length === 0
            ? <p className="text-center text-sm text-slate-500 py-8">Nada aqui por enquanto.</p>
            : <div className="space-y-2">{lista.map(v => <LinhaVenda key={v.chave} v={v} onCpfSalvo={carregar} previa={previa} />)}</div>}
        </>
      )}
    </div>
  );
}

function Vazio({ previa }) {
  return (
    <div className="card text-center py-10 space-y-4">
      <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
      <p className="text-slate-600">Você ainda não tem vendas.</p>
      {previa
        ? <span className="btn-primary inline-flex items-center justify-center gap-2 min-h-[48px] px-6 opacity-60"><UserPlus className="w-5 h-5" /> Indicar cliente</span>
        : <Link to="/indicar" className="btn-primary inline-flex items-center justify-center gap-2 min-h-[48px] px-6"><UserPlus className="w-5 h-5" /> Indicar cliente</Link>}
    </div>
  );
}
