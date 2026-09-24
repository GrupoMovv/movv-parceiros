import { useEffect, useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Moped, WhatsappLogo, CaretLeft, CaretRight } from '@phosphor-icons/react';

const STATUS = [
  { valor: 'novo', rotulo: 'Novo', cor: 'bg-amber-100 text-amber-700' },
  { valor: 'contatado', rotulo: 'Contatado', cor: 'bg-blue-100 text-blue-700' },
  { valor: 'aprovado', rotulo: 'Aprovado', cor: 'bg-emerald-100 text-emerald-700' },
  { valor: 'descartado', rotulo: 'Descartado', cor: 'bg-slate-200 text-slate-600' },
];
const STATUS_POR_VALOR = Object.fromEntries(STATUS.map(s => [s.valor, s]));

function fmtData(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function fmtWhatsapp(d) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

function LinhaPreCadastro({ item, onAtualizado }) {
  const [obs, setObs] = useState(item.observacoes || '');
  const [salvando, setSalvando] = useState(false);

  async function salvar(dados) {
    setSalvando(true);
    try {
      const res = await api.patch(`/sindicato/entregadores/${item.id}/status`, dados);
      onAtualizado(res.data.pre_cadastro);
      toast.success('Atualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    } finally {
      setSalvando(false);
    }
  }

  const obsMudou = (obs.trim() || null) !== (item.observacoes || null);

  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{item.nome}</p>
          <a
            href={`https://wa.me/55${item.whatsapp}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline"
          >
            <WhatsappLogo size={15} weight="fill" /> {fmtWhatsapp(item.whatsapp)}
          </a>
          <p className="text-xs text-slate-500 mt-1">
            {item.tem_moto ? '🛵 Tem moto' : '🚶 Sem moto'} · Cadastro {fmtData(item.criado_em)}
            {item.contatado_em && <> · 1º contato {fmtData(item.contatado_em)}</>}
          </p>
          {item.bairros?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.bairros.map(b => <span key={b} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{b}</span>)}
            </div>
          )}
        </div>
        <select
          value={item.status}
          disabled={salvando}
          onChange={(e) => salvar({ status: e.target.value })}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 ${STATUS_POR_VALOR[item.status]?.cor || ''}`}
        >
          {STATUS.map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={obs} onChange={(e) => setObs(e.target.value)}
          placeholder="Observações (ex.: ligar sábado)"
          className="input text-sm flex-1"
        />
        {obsMudou && (
          <button type="button" disabled={salvando} onClick={() => salvar({ observacoes: obs })} className="btn-secondary text-sm">
            Salvar
          </button>
        )}
      </div>
    </div>
  );
}

export default function SindicatoEntregadores() {
  const [dados, setDados] = useState(null);
  const [status, setStatus] = useState('');
  const [temMoto, setTemMoto] = useState('');
  const [bairro, setBairro] = useState('');
  const [bairroAplicado, setBairroAplicado] = useState('');
  const [pagina, setPagina] = useState(1);

  const carregar = useCallback(() => {
    const params = { pagina, por_pagina: 30 };
    if (status) params.status = status;
    if (temMoto) params.tem_moto = temMoto;
    if (bairroAplicado) params.bairro = bairroAplicado;
    api.get('/sindicato/entregadores/pre-cadastros', { params })
      .then(res => setDados(res.data))
      .catch(() => toast.error('Erro ao carregar pré-cadastros'));
  }, [pagina, status, temMoto, bairroAplicado]);

  useEffect(() => { carregar(); }, [carregar]);

  function trocarFiltro(setter) {
    return (v) => { setter(v); setPagina(1); };
  }

  function aoAtualizar(atualizado) {
    setDados(d => ({ ...d, pre_cadastros: d.pre_cadastros.map(p => (p.id === atualizado.id ? atualizado : p)) }));
  }

  const porStatus = dados?.total_por_status || {};
  const totalGeral = Object.values(porStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Moped size={24} weight="duotone" className="text-movv-900" /> Pré-cadastro de Entregadores
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Motoboys que reservaram lugar em /entregadores — {totalGeral} no total.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS.map(s => (
          <div key={s.valor} className="card py-4 text-center">
            <p className="text-2xl font-bold text-movv-900">{porStatus[s.valor] || 0}</p>
            <p className="text-slate-500 text-xs mt-0.5">{s.rotulo}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={status} onChange={(e) => trocarFiltro(setStatus)(e.target.value)} className="input w-auto text-sm">
          <option value="">Todos os status</option>
          {STATUS.map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
        </select>
        <select value={temMoto} onChange={(e) => trocarFiltro(setTemMoto)(e.target.value)} className="input w-auto text-sm">
          <option value="">Com ou sem moto</option>
          <option value="true">Tem moto</option>
          <option value="false">Sem moto</option>
        </select>
        <form
          onSubmit={(e) => { e.preventDefault(); setBairroAplicado(bairro.trim()); setPagina(1); }}
          className="flex gap-2"
        >
          <input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" className="input w-40 text-sm" />
          <button type="submit" className="btn-secondary text-sm">Filtrar</button>
        </form>
      </div>

      <div className="card">
        {dados === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : dados.pre_cadastros.length === 0 ? (
          <p className="text-center text-slate-400 py-12">Nenhum pré-cadastro {totalGeral ? 'com esses filtros' : 'ainda'}</p>
        ) : (
          dados.pre_cadastros.map(item => <LinhaPreCadastro key={item.id} item={item} onAtualizado={aoAtualizar} />)
        )}
      </div>

      {dados && dados.total_paginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="btn-secondary disabled:opacity-40" aria-label="Página anterior">
            <CaretLeft size={16} />
          </button>
          <span className="text-slate-600">Página {dados.pagina} de {dados.total_paginas} · {dados.total} resultados</span>
          <button type="button" disabled={pagina >= dados.total_paginas} onClick={() => setPagina(p => p + 1)} className="btn-secondary disabled:opacity-40" aria-label="Próxima página">
            <CaretRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
