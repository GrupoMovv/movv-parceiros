import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, GraduationCap, Award, ChevronRight, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { reais, dataBR } from './comissoesRotulos';
import { LinhaComissao, LinhaVenda } from './PartnerVendas';
import { AvisoPrevia } from './UniversidadeHome';

// Início do MOVV Partner (primeira tela depois do login): quanto tem a
// receber, botão de indicar, onde parou na Universidade e as últimas vendas.
// Com a trava do portal ligada e sem certificado, o servidor recusa e a
// Universidade vem primeiro (como antes). Com `previa`, é o "Ver como
// Partner" do admin: sem dado de ninguém e nada é gravado.
export default function PartnerInicio({ previa = false }) {
  const [dados, setDados] = useState(null);
  const [univ, setUniv] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(previa ? '/partner-comissoes/previa' : '/partner-comissoes/inicio')
      .then(r => setDados(r.data))
      .catch(err => {
        if (err.response?.data?.codigo === 'CERTIFICACAO_PENDENTE') navigate('/universidade', { replace: true });
        else toast.error(err.response?.data?.error || 'Não deu para carregar o início');
      });
    api.get(previa ? '/universidade/admin/previa' : '/universidade').then(r => setUniv(r.data)).catch(() => {});
  }, [previa, navigate]);

  if (!dados) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-movv-900" /></div>;
  const primeiroNome = (dados.nome || '').split(' ')[0];
  const base = previa ? '/admin/universidade/ver-como-partner' : '';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {previa && <AvisoPrevia />}
      <div>
        <h1 className="text-2xl font-display font-semibold text-slate-900">Olá, {primeiroNome}!</h1>
        <LinhaComissao comissao={dados.comissao} className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">A receber</p>
          <p className="mt-1 text-xl sm:text-3xl font-bold text-movv-900 tabular-nums break-words">{reais(dados.resumo.a_receber)}</p>
          {dados.proximo_pagamento && <p className="mt-1 text-xs text-slate-500">Próximo pagamento: até {ddmm(dados.proximo_pagamento)}</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pago no mês</p>
          <p className="mt-1 text-xl sm:text-3xl font-bold text-emerald-700 tabular-nums break-words">{reais(dados.resumo.pago_mes)}</p>
        </div>
      </div>

      {previa ? (
        // prévia do formulário: mostra a tela, não grava nada
        <Link to={`${base}/indicar`} className="w-full min-h-[56px] rounded-2xl bg-gold-gradient text-movv-900 font-bold text-lg flex items-center justify-center gap-2 shadow-card">
          <UserPlus className="w-6 h-6" /> Indicar cliente
        </Link>
      ) : (
        <Link to="/indicar" className="w-full min-h-[56px] rounded-2xl bg-gold-gradient text-movv-900 font-bold text-lg flex items-center justify-center gap-2 shadow-card">
          <UserPlus className="w-6 h-6" /> Indicar cliente
        </Link>
      )}

      {univ && <CartaoUniversidade u={univ} base={base} />}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">Últimas vendas</h2>
          {dados.total_vendas > 0 && <Link to={previa ? `${base}/vendas` : '/partner/vendas'} className="text-sm font-semibold text-movv-900 min-h-[44px] flex items-center">Ver todas</Link>}
        </div>
        {dados.ultimas.length === 0
          ? <p className="text-sm text-slate-500">Nenhuma venda ainda. Indique seu primeiro cliente!</p>
          : dados.ultimas.map(v => <LinhaVenda key={v.chave} v={v} previa={previa} />)}
      </div>
    </div>
  );
}

// "2026-11-09" -> "09/11"
const ddmm = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// "Continue de onde parou" ou, com tudo concluído, o selo da certificação
function CartaoUniversidade({ u, base }) {
  const raiz = base || '/universidade';
  if (u.certificado_valido && !u.continuar) {
    return (
      <Link to={`${raiz}/certificado`} className="card p-4 flex items-center gap-3 min-h-[64px] border-gold-500/50 bg-gold-100">
        <Award className="w-8 h-8 text-gold-700 flex-shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">MOVV Partner certificado</span>
          <span className="block text-sm text-slate-600">Válido até {dataBR(u.certificado.valido_ate)}</span>
        </span>
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </Link>
    );
  }
  if (!u.continuar) return null;
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <GraduationCap className="w-7 h-7 text-movv-900 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">Continue de onde parou</p>
          <p className="font-semibold text-slate-900 truncate">Módulo {u.continuar.numero} · {u.continuar.titulo}</p>
        </div>
        <span className="text-sm font-bold text-movv-900 tabular-nums">{u.progresso_geral}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${u.progresso_geral}%` }} />
      </div>
      <Link to={`${raiz}/modulo/${u.continuar.numero}${u.continuar.aula_id ? `#aula-${u.continuar.aula_id}` : ''}`}
        className="btn-primary w-full min-h-[48px] flex items-center justify-center">Continuar</Link>
    </div>
  );
}
