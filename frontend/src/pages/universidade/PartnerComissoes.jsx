import { useEffect, useState, useCallback } from 'react';
import { Percent, Wallet, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  STATUS_LANC, ORIGEM, BASE, NIVEIS, reais, pct, competenciaBR, dataBR,
} from './comissoesRotulos';

// "Minhas comissões / Tabela vigente" do MOVV Partner (livro de comissões,
// migration 093). Decisão A (transparência): cada lançamento mostra a base
// (o que o Grupo recebeu), o percentual e o valor do Partner. A tabela
// vigente mostra só o nível dele. Nada de percentual na Universidade: ele
// mora aqui.
export default function PartnerComissoes() {
  const [aba, setAba] = useState('minhas');
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gold-gradient flex items-center justify-center"><Percent className="w-6 h-6 text-movv-900" /></div>
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900">Minhas comissões</h1>
          <p className="text-sm text-slate-500">MOVV Partner</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-slate-200">
        {[['minhas', 'Meus lançamentos'], ['tabela', 'Tabela vigente']].map(([k, r]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${aba === k ? 'border-movv-900 text-movv-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {r}
          </button>
        ))}
      </div>
      {aba === 'minhas' ? <MeusLancamentos /> : <TabelaVigente />}
    </div>
  );
}

function MeusLancamentos() {
  const [competencia, setCompetencia] = useState('');
  const [status, setStatus] = useState('');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get('/partner-comissoes/minhas', { params: { competencia: competencia || undefined, status: status || undefined } });
      setDados(r.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao carregar suas comissões');
    } finally { setCarregando(false); }
  }, [competencia, status]);

  useEffect(() => { carregar(); }, [carregar]);

  const totais = dados?.totais || {};
  const lancamentos = dados?.lancamentos || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Total icone={Clock} rotulo="A receber" valor={totais.a_receber} dica="Previstos e confirmados" cor="text-amber-700" />
        <Total icone={CheckCircle2} rotulo="Aprovado" valor={totais.aprovado} dica="Aprovado para pagamento" cor="text-movv-900" />
        <Total icone={Wallet} rotulo="Pago" valor={totais.pago} dica="Já pago a você" cor="text-emerald-700" />
      </div>

      <div className="card py-3 flex flex-col sm:flex-row gap-3">
        <select className="input sm:w-48" value={competencia} onChange={e => setCompetencia(e.target.value)}>
          <option value="">Todos os meses</option>
          {(dados?.competencias || []).map(c => <option key={c} value={c}>{competenciaBR(c)}</option>)}
        </select>
        <select className="input sm:w-48" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LANC).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}
        </select>
      </div>

      {carregando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-movv-900" /></div>
      ) : lancamentos.length === 0 ? (
        <div className="card text-center py-10 text-slate-500 text-sm">Nenhum lançamento {competencia || status ? 'com esses filtros' : 'ainda'}.</div>
      ) : (
        <div className="space-y-2">
          {lancamentos.map(l => <Lancamento key={l.id} l={l} />)}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Dúvida sobre algum lançamento? Fale com a Central Movv informando o mês e o cliente.
      </p>
    </div>
  );
}

function Total({ icone: Icone, rotulo, valor, dica, cor }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><Icone className="w-4 h-4" />{rotulo}</div>
      <p className={`mt-1 text-2xl font-bold ${cor}`}>{reais(valor || '0')}</p>
      <p className="text-xs text-slate-400">{dica}</p>
    </div>
  );
}

function Lancamento({ l }) {
  const st = STATUS_LANC[l.status] || STATUS_LANC.previsto;
  return (
    <div className={`card p-4 ${l.eh_estorno ? 'opacity-70' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{l.produto}</p>
          <p className="text-sm text-slate-600 truncate">{l.cliente_nome || 'Cliente não informado'}{l.numero_contrato ? ` · contrato ${l.numero_contrato}` : ''}</p>
          <p className="text-xs text-slate-400 mt-0.5">{ORIGEM[l.origem] || l.origem} · competência {competenciaBR(l.competencia)}{l.pago_em ? ` · pago em ${dataBR(l.pago_em)}` : ''}</p>
        </div>
        <div className="sm:text-right">
          <p className={`text-lg font-bold ${l.eh_estorno ? 'line-through text-slate-500' : 'text-slate-900'}`}>{reais(l.valor_partner)}</p>
          <p className="text-xs text-slate-500">{pct(l.percentual)} de {reais(l.base_valor)}</p>
          <span title={st.explica} className={`inline-flex mt-1 items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.classe}`}>{st.rotulo}</span>
        </div>
      </div>
    </div>
  );
}

function TabelaVigente() {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    api.get('/partner-comissoes/tabela').then(r => setDados(r.data))
      .catch(err => toast.error(err.response?.data?.error || 'Erro ao carregar a tabela'));
  }, []);
  if (!dados) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-movv-900" /></div>;
  if (!dados.nivel) {
    return <div className="card text-center py-10 text-slate-600 text-sm">Seu nível ainda não foi definido pela Central Movv. Assim que for, a sua tabela aparece aqui.</div>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Seu nível: <strong>{NIVEIS[dados.nivel]}</strong>. É assim que a sua comissão é calculada hoje:</p>
      {dados.regras.length === 0 ? (
        <div className="card text-center py-8 text-slate-500 text-sm">Nenhuma regra vigente no momento. Fale com a Central Movv.</div>
      ) : dados.regras.map((r, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <div className="text-2xl font-bold text-movv-900 w-24 flex-shrink-0">{pct(r.percentual)}</div>
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{ORIGEM[r.origem] || r.origem}{r.produto ? ` · ${r.produto}` : ' · todos os produtos'}</p>
            <p>Você recebe {pct(r.percentual)} {BASE[r.base] || ''}{r.vigente_ate ? `, até ${dataBR(r.vigente_ate)}` : ''}.</p>
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500">O percentual de cada venda fica gravado no lançamento no dia em que ele nasce: se a tabela mudar, os lançamentos antigos continuam como estavam.</p>
    </div>
  );
}
