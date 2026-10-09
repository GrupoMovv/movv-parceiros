import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GraduationCap, Lock, ChevronRight, Award, Clock, CheckCircle2, Eye } from 'lucide-react';
import api from '../../services/api';
import { identidade, SITUACAO, dataBR, modoUniversidade } from './identidade';

// Home da Universidade MOVV Partner: progresso geral, "Continuar de onde
// parei" e um cartão por módulo com a situação. Com `previa`, é o "Ver como
// Partner" do admin: mostra também o que não foi publicado e nada é gravado.
export default function UniversidadeHome({ previa = false }) {
  const modo = modoUniversidade(previa);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    api.get(modo.api)
      .then(r => setDados(r.data))
      .catch(() => toast.error('Não foi possível carregar a Universidade.'));
  }, [modo.api]);

  if (!dados) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const publicados = dados.modulos.filter(m => m.publicado);
  const concluidos = publicados.filter(m => m.aprovado).length;
  const cert = dados.certificado;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {previa && <AvisoPrevia publicados={dados.publicados} total={dados.modulos.length} />}
      {/* topo: progresso geral */}
      <div className="rounded-2xl bg-movv-gradient text-white p-5 sm:p-7 shadow-card">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gold-gradient flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-movv-900" />
          </div>
          <div className="min-w-0">
            <p className="text-gold-300 text-xs font-bold uppercase tracking-widest">Universidade MOVV Partner</p>
            <h1 className="text-xl sm:text-2xl font-display font-semibold leading-tight mt-0.5">Olá, {dados.nome?.split(' ')[0]}!</h1>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-white/80">{previa ? `${dados.publicados} de ${dados.modulos.length} módulos publicados` : `${concluidos} de ${publicados.length} módulos concluídos`}</span>
            <span className="font-bold text-gold-300 tabular-nums">{dados.progresso_geral}%</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-gold-gradient transition-all" style={{ width: `${dados.progresso_geral}%` }} />
          </div>
        </div>
        {dados.continuar && (
          <Link
            to={`${modo.base}/modulo/${dados.continuar.numero}${dados.continuar.aula_id ? `#aula-${dados.continuar.aula_id}` : ''}`}
            className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-white text-movv-900 px-4 py-3 font-semibold hover:bg-gold-100 transition-colors"
          >
            <span className="min-w-0">
              <span className="block text-xs font-medium text-slate-500">Continuar de onde parei</span>
              <span className="block truncate">Módulo {dados.continuar.numero} · {dados.continuar.titulo}</span>
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" />
          </Link>
        )}
      </div>

      {/* certificado */}
      {cert && (
        <Link to={`${modo.base}/certificado`}
          className={`flex items-center gap-3 rounded-2xl border p-4 ${dados.certificado_valido ? 'border-gold-500/50 bg-gold-100' : 'border-orange-300 bg-orange-50'}`}>
          <Award className={`w-8 h-8 flex-shrink-0 ${dados.certificado_valido ? 'text-gold-700' : 'text-orange-600'}`} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">
              {cert.status === 'vencida' ? 'Certificado vencido: refaça os quizzes para renovar'
                : cert.suspenso ? 'Certificado suspenso: atualize os módulos pendentes'
                  : 'Você é MOVV Partner certificado'}
            </p>
            <p className="text-sm text-slate-600 font-mono">{cert.codigo} · válido até {dataBR(cert.valido_ate)}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </Link>
      )}

      {/* aviso do Módulo 0 / termo */}
      {!dados.liberado && publicados.length > 0 && (
        <div className="rounded-xl border border-gold-500/40 bg-gold-100 px-4 py-3 text-sm text-gold-900">
          {dados.modulo0_lido
            ? (dados.termo ? 'Falta aceitar o termo de adesão no fim do Módulo 0 para liberar os outros módulos.'
              : 'O termo de adesão ainda está em revisão. Os outros módulos abrem quando ele for publicado e você aceitar.')
            : 'Comece pelo Módulo 0. Os outros módulos abrem depois que você ler o Módulo 0 e aceitar o termo de adesão.'}
        </div>
      )}

      {/* módulos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dados.modulos.map(m => <CartaoModulo key={m.id} m={m} rota={modo.base} />)}
      </div>
      {previa && (
        <Link to={`${modo.base}/certificado`} className="flex items-center gap-3 rounded-2xl border border-gold-500/50 bg-gold-100 p-4">
          <Award className="w-8 h-8 flex-shrink-0 text-gold-700" />
          <span className="min-w-0 flex-1 font-semibold text-slate-900">Ver o modelo do certificado</span>
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </Link>
      )}
    </div>
  );
}

// Faixa do "Ver como Partner" (só admin e comercial_full veem).
export function AvisoPrevia({ publicados, total }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-dashed border-movv-700 bg-blue-50 px-4 py-3 text-sm text-movv-900">
      <Eye className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p>
        <strong>Ver como Partner.</strong> Esta é a tela da Partner, com tudo aberto. Nada do que você fizer aqui é gravado: leitura, aceite, quiz e certificado.
        {publicados !== undefined ? ` ${publicados} de ${total} módulos estão publicados.` : ''}
      </p>
    </div>
  );
}

export function SeloNaoPublicado({ className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-dashed border-orange-400 bg-orange-50 text-orange-700 ${className}`}>
      Visualização: não publicado
    </span>
  );
}

function CartaoModulo({ m, rota }) {
  const { cor, icone: Icone } = identidade(m.numero);
  const s = SITUACAO[m.situacao] || SITUACAO.disponivel;
  const aberto = m.situacao !== 'em_breve' && m.situacao !== 'bloqueado';
  const conteudo = (
    <>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: aberto ? cor : '#CBD5E1' }}>
          {m.situacao === 'bloqueado' ? <Lock className="w-5 h-5 text-white" /> : <Icone className="w-5 h-5 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: aberto ? cor : '#94A3B8' }}>Módulo {m.numero}</p>
          <p className={`font-semibold leading-snug ${aberto ? 'text-slate-900' : 'text-slate-400'}`}>{m.titulo}</p>
        </div>
        {m.situacao === 'concluido' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {m.nao_publicado
          ? <SeloNaoPublicado />
          : <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.classe}`}>{s.rotulo}</span>}
        {m.publicado && m.aulas_total > 0 && (
          <span className="text-xs text-slate-500 tabular-nums">{m.aulas_lidas}/{m.aulas_total} aulas</span>
        )}
        {m.prazo_atualizar && (
          <span className="inline-flex items-center gap-1 text-xs text-orange-700"><Clock className="w-3 h-3" />até {dataBR(m.prazo_atualizar)}</span>
        )}
      </div>
      {aberto && (
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${m.progresso}%`, background: cor }} />
        </div>
      )}
    </>
  );
  const base = 'block rounded-2xl border bg-white p-4 shadow-card';
  return aberto
    ? <Link to={`${rota}/modulo/${m.numero}`} className={`${base} border-slate-200 hover:border-gold-500/60 transition-colors`}>{conteudo}</Link>
    : <div className={`${base} border-slate-100 opacity-80`} aria-disabled="true">{conteudo}</div>;
}
