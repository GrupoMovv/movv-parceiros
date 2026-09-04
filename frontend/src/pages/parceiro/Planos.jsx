import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Bell, BellRinging, Sparkle, Diamond, Fire } from '@phosphor-icons/react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, ROXO_ESCURO, DOURADO, PRETO } from '../public/Marketplace/theme';

// Espelha LIMITE_VITRINE_POR_PLANO do backend (vitrineRotativaService) —
// quantos produtos cada plano coloca na fila da vitrine rotativa da home.
const VITRINE_POR_PLANO = { gratis: 1, oficial: 3, premium: 8, master: 15 };

const PLANOS = [
  {
    valor: 'gratis',
    nome: 'Parceiro IUB — Grátis',
    preco: 'R$ 0',
    periodo: '/mês SEMPRE',
    beneficios: [
      'Perfil completo da empresa',
      'Até 30 produtos',
      'WhatsApp direto',
      'Aparece no marketplace',
      '1 produto na vitrine rotativa da home',
      'Selo "Parceiro IUB"',
    ],
  },
  {
    valor: 'oficial',
    nome: 'Oficial',
    preco: 'R$ 37,90',
    periodo: '/mês',
    beneficios: [
      'Tudo do Grátis',
      'Selo dourado "PARCEIRO OFICIAL"',
      '3 produtos em destaque na home',
      'Analytics básico (visitas, cliques)',
      'Suporte prioritário por e-mail',
    ],
  },
  {
    valor: 'premium',
    nome: 'Premium',
    preco: 'R$ 49,90',
    precoOriginal: 'R$ 89,90',
    periodo: '/mês',
    maisEscolhido: true,
    beneficios: [
      'Tudo do Oficial',
      '8 produtos em destaque',
      'Push notification pros associados (2/mês)',
      'Aparece em "Parceiros em Destaque" (topo da home)',
      'Analytics completo',
      'Suporte prioritário por WhatsApp',
      'Boost mensal de fim de semana',
      'Integração com Instagram',
    ],
  },
  {
    valor: 'master',
    nome: 'Master',
    preco: 'R$ 89,90',
    periodo: '/mês',
    beneficios: [
      'Tudo do Premium',
      'Produtos ilimitados',
      '15 produtos em destaque',
      'Post no Instagram oficial IUB MAIS (mensal)',
      'Consultoria 1h/mês com nossa equipe',
      'Selo VIP dourado exclusivo',
      'Banner personalizado',
      'Convite pra eventos exclusivos',
    ],
  },
];

export default function ParceiroPlanos() {
  const { parceiro } = useOutletContext();
  const [interesses, setInteresses] = useState(null);
  const [planoModal, setPlanoModal] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const planoAtual = parceiro?.plano || 'gratis';

  useEffect(() => {
    apiParceiro.get('/parceiro/interessados')
      .then(res => setInteresses(res.data.planos))
      .catch(() => setInteresses([]));
  }, []);

  async function confirmarInteresse() {
    setEnviando(true);
    try {
      await apiParceiro.post('/parceiro/interessados', { plano_interesse: planoModal.valor });
      setInteresses(atuais => [...(atuais || []), planoModal.valor]);
      toast.success(`Você será notificado quando o ${planoModal.nome} lançar!`);
      setPlanoModal(null);
    } catch {
      toast.error('Erro ao registrar interesse. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold" style={{ color: PRETO }}>Escolha o plano ideal pra sua empresa</h1>
        <span
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-4 py-2 rounded-full"
          style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}
        >
          🔥 Todos os planos estão em breve — aproveite o Grátis ilimitado!
        </span>
        <p className="text-slate-500 text-sm mt-4">
          Estamos ativando planos pagos em breve. Enquanto isso, aproveite o Grátis sem limites e garanta seu bônus como Pioneiro do IUB MAIS!
        </p>
      </div>

      <div className="rounded-3xl p-8 text-white" style={{ background: `linear-gradient(135deg, ${PRETO} 0%, #1F1F27 100%)` }}>
        <div className="flex items-start gap-4 max-w-2xl mx-auto">
          <Fire size={32} weight="duotone" color={DOURADO} className="flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-extrabold">No IUB MAIS, sua empresa não fica apenas cadastrada</h2>
            <p className="text-white/70 text-sm mt-2 leading-relaxed">
              Seus produtos entram numa <strong className="text-white">vitrine rotativa</strong> que gira todos os dias na home do marketplace pra milhares de consumidores de Itumbiara. Mais produtos na fila = mais oportunidades de aparecer!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {PLANOS.map(p => (
                <div key={p.valor} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
                  <p className="text-xl font-black" style={{ color: DOURADO }}>{VITRINE_POR_PLANO[p.valor]}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">produto{VITRINE_POR_PLANO[p.valor] > 1 ? 's' : ''} — {p.nome.replace('Parceiro IUB — ', '')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANOS.map(plano => (
          <CardPlano
            key={plano.valor}
            plano={plano}
            ehAtual={planoAtual === plano.valor}
            jaInteressado={interesses?.includes(plano.valor)}
            onNotificar={() => setPlanoModal(plano)}
          />
        ))}
      </div>

      <div className="rounded-3xl p-8 text-center text-white" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <p className="text-2xl">💎</p>
        <h2 className="text-xl font-extrabold mt-2">Pioneiros ganham prêmio especial!</h2>
        <p className="text-white/80 text-sm mt-3 max-w-xl mx-auto leading-relaxed">
          Todos os parceiros que se cadastrarem agora (fase gratuita) ganham <strong>3 meses de Premium grátis</strong> quando ativarmos os planos pagos!
        </p>
        <p className="text-white/80 text-sm mt-2">Aproveita e já garante seu lugar como parceiro Pioneiro.</p>
      </div>

      {planoModal && (
        <ModalNotificar
          plano={planoModal}
          enviando={enviando}
          onConfirmar={confirmarInteresse}
          onCancelar={() => setPlanoModal(null)}
        />
      )}
    </div>
  );
}

function CardPlano({ plano, ehAtual, jaInteressado, onNotificar }) {
  const emBreve = plano.valor !== 'gratis';

  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col ${emBreve ? 'opacity-90' : ''} ${plano.maisEscolhido ? 'shadow-lg' : 'shadow-sm'}`}
      style={{
        borderColor: plano.maisEscolhido ? DOURADO : ehAtual ? '#10B981' : '#E2E8F0',
        borderWidth: plano.maisEscolhido ? 2 : 1,
        background: plano.maisEscolhido ? `linear-gradient(160deg, white 0%, ${DOURADO}0D 100%)` : 'white',
      }}
    >
      {ehAtual && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full bg-emerald-500 text-white whitespace-nowrap">
          Seu plano atual
        </span>
      )}
      {emBreve && (
        <span className="absolute -top-3 right-4 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-700 text-white whitespace-nowrap">
          🔜 Em breve
        </span>
      )}
      {plano.maisEscolhido && (
        <span
          className="absolute -top-3 left-4 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          <Sparkle size={11} weight="fill" /> Mais escolhido
        </span>
      )}

      <p className="font-bold text-base mt-3" style={{ color: PRETO }}>{plano.nome}</p>

      <div className="mt-2">
        {plano.precoOriginal && (
          <p className="text-slate-400 text-sm line-through">{plano.precoOriginal}</p>
        )}
        <p className="text-3xl font-extrabold" style={{ color: plano.maisEscolhido ? ROXO : PRETO }}>
          {plano.preco} <span className="text-sm font-medium text-slate-400">{plano.periodo}</span>
        </p>
      </div>

      <ul className="space-y-2 mt-5 flex-1">
        {plano.beneficios.map(b => (
          <li key={b} className="flex items-start gap-2 text-xs text-slate-600">
            <Check size={14} weight="bold" className="flex-shrink-0 mt-0.5" style={{ color: '#16A34A' }} />
            {b}
          </li>
        ))}
      </ul>

      {plano.valor === 'gratis' ? (
        <button disabled className="mt-6 w-full text-sm font-semibold py-3 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed">
          Plano ativo
        </button>
      ) : jaInteressado ? (
        <button disabled className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl bg-emerald-50 text-emerald-600 cursor-not-allowed">
          <Check size={16} weight="bold" /> Você será notificado
        </button>
      ) : (
        <button
          type="button"
          onClick={onNotificar}
          className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundColor: plano.maisEscolhido ? DOURADO : ROXO, color: plano.maisEscolhido ? '#0F0F14' : 'white' }}
        >
          <Bell size={15} weight="fill" /> Notificar-me quando lançar!
        </button>
      )}
    </div>
  );
}

function ModalNotificar({ plano, enviando, onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={onCancelar}>
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
        <BellRinging size={40} weight="duotone" color={ROXO} className="mx-auto" />
        <h2 className="text-lg font-extrabold mt-3" style={{ color: PRETO }}>Ótimo!</h2>
        <p className="text-slate-600 text-sm mt-2">
          Quando ativarmos o <strong>{plano.nome}</strong>, você será um dos primeiros a saber!
        </p>

        <div className="rounded-2xl p-4 mt-4 text-left" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}>
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide" style={{ color: '#92700C' }}>
            <Diamond size={14} weight="duotone" /> Bônus Pioneiro
          </p>
          <p className="text-sm mt-1.5" style={{ color: '#7A5E00' }}>
            Como Pioneiro, você ganha <strong>3 meses grátis</strong> do plano quando lançarmos!
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button
            type="button" onClick={onConfirmar} disabled={enviando}
            className="flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            <Check size={16} weight="bold" /> Quero ser Pioneiro
          </button>
          <button type="button" onClick={onCancelar} disabled={enviando} className="text-sm font-semibold py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
