import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const PURPLE = '#4A0E8F';
const GOLD   = '#C9A84C';

const sections = [
  {
    icon: '💼',
    title: 'Recuperação Amigável',
    items: [
      'Régua de cobrança automatizada por WhatsApp / e-mail / SMS',
      'Negociação personalizada',
      'Acordos parcelados',
      'Recuperação extrajudicial',
    ],
  },
  {
    icon: '⚖️',
    title: 'Cobrança Judicial',
    items: [
      'Notificações extrajudiciais',
      'Protesto em cartório',
      'Inclusão em SPC / Serasa',
      'Ações judiciais',
    ],
  },
  {
    icon: '📊',
    title: 'Gestão de Carteira',
    items: [
      'Análise da carteira de inadimplentes',
      'Classificação por idade da dívida',
      'Estratégia personalizada',
      'Relatórios detalhados',
    ],
  },
  {
    icon: '💳',
    title: 'Soluções Tecnológicas',
    items: [
      'Plataforma online em tempo real',
      'Boletos e PIX para acordos',
      'Histórico completo',
      'Integração com sistemas',
    ],
  },
  {
    icon: '🤝',
    title: 'Cobrança B2B',
    items: [
      'Duplicatas vencidas',
      'Notas fiscais não pagas',
      'Contratos inadimplentes',
    ],
  },
  {
    icon: '📱',
    title: 'Cobrança PF',
    items: [
      'Cartões de crédito',
      'Empréstimos',
      'Contas de consumo',
      'Aluguéis e condomínios',
    ],
  },
];

export default function MovvCobrancas() {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  async function handleInterest() {
    setLoading(true);
    try {
      await api.post('/interest', { service: 'collections' });
      setDone(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setDone(true);
      } else {
        toast.error(err.response?.data?.error || 'Erro ao registrar interesse');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div
        className="rounded-2xl p-8 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, #2D0661 100%)` }}
      >
        <div className="relative z-10">
          <span
            className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-widest uppercase"
            style={{ background: GOLD, color: PURPLE }}
          >
            EM BREVE
          </span>
          <h1 className="text-4xl font-extrabold mb-2">Movv Cobranças</h1>
          <p className="text-white/80 text-lg max-w-2xl">
            Recupere o que é seu, sem desgastar a relação com o cliente.
          </p>
        </div>
        <div
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: GOLD }}
        />
        <div
          className="absolute -right-4 -bottom-20 w-48 h-48 rounded-full opacity-5"
          style={{ background: GOLD }}
        />
      </div>

      {/* Intro */}
      <div className="card p-6">
        <p className="text-slate-700 leading-relaxed text-base">
          A inadimplência é uma das maiores dores das empresas brasileiras. Cobrar exige tempo,
          técnica e conhecimento jurídico. O <strong>Movv Cobranças</strong> atua como o braço de
          recuperação de crédito que sua contabilidade pode oferecer aos clientes, com
          profissionalismo, técnicas atualizadas e respeito ao relacionamento comercial.
        </p>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(s => (
          <div key={s.title} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{s.icon}</span>
              <h3 className="font-bold text-slate-900 text-sm">{s.title}</h3>
            </div>
            <ul className="space-y-1.5">
              {s.items.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Destaque */}
      <div
        className="rounded-2xl p-6 border-2 text-center"
        style={{ borderColor: GOLD, background: `${GOLD}15` }}
      >
        <p className="font-bold text-slate-900 text-lg">
          💡 Modelo baseado em sucesso:
        </p>
        <p className="text-slate-700 mt-1 text-base">
          Se não recuperamos, ninguém paga.
        </p>
      </div>

      {/* CTA */}
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: `linear-gradient(135deg, ${PURPLE}18 0%, ${GOLD}18 100%)` }}
      >
        {done ? (
          <div className="space-y-2">
            <span className="text-4xl">✅</span>
            <p className="font-bold text-slate-900 text-lg">Interesse registrado!</p>
            <p className="text-slate-600">
              Avisaremos você em primeira mão quando lançarmos o Movv Cobranças.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-700 font-medium text-lg">
              Quer ser avisado no lançamento?
            </p>
            <button
              onClick={handleInterest}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-base
                         transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed
                         hover:brightness-110 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, #2D0661 100%)` }}
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Tenho Interesse
            </button>
            <p className="text-slate-400 text-xs">
              Sem compromisso — apenas para ser notificado no lançamento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
