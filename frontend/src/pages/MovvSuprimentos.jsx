import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const PURPLE = '#4A0E8F';
const GOLD   = '#C9A84C';

const sections = [
  {
    icon: '📝',
    title: 'Papelaria e Escritório',
    items: ['Papel A4', 'Canetas e lápis', 'Cadernos e blocos', 'Pastas e arquivos', 'Material de expediente geral'],
  },
  {
    icon: '🖨️',
    title: 'Insumos para Impressão',
    items: ['Cartuchos e toners', 'Papel para impressora', 'Etiquetas adesivas', 'Envelopes'],
  },
  {
    icon: '☕',
    title: 'Copa e Cozinha',
    items: ['Café e açúcar', 'Água mineral', 'Copos e descartáveis', 'Biscoitos e lanches'],
  },
  {
    icon: '🧹',
    title: 'Limpeza e Higiene',
    items: ['Produtos de limpeza', 'Papel higiênico e toalhas', 'Álcool gel', 'Sabonete e dispenser'],
  },
  {
    icon: '💻',
    title: 'Tecnologia e Acessórios',
    items: ['Pen drives', 'Mouses e teclados', 'Headsets', 'Cabos e adaptadores'],
  },
  {
    icon: '🛡️',
    title: 'EPIs e Segurança',
    items: ['Máscaras descartáveis', 'Álcool 70%', 'Extintores', 'Sinalização de segurança'],
  },
];

const comoFunciona = [
  'Pedido simples pelo portal exclusivo',
  'Preços competitivos de atacado',
  'Entrega programada (semanal / quinzenal / mensal)',
  'Faturamento mensal facilitado',
];

const vantagens = [
  { emoji: '✓', texto: 'Economia real — preços bem abaixo do varejo' },
  { emoji: '✓', texto: 'Mais tempo — sem correr para mercados' },
  { emoji: '✓', texto: 'Padronização — escritório sempre abastecido' },
  { emoji: '✓', texto: 'Faturamento único — tudo em uma fatura mensal' },
  { emoji: '✓', texto: 'Atendimento dedicado para contabilidades parceiras' },
];

export default function MovvSuprimentos() {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  async function handleInterest() {
    setLoading(true);
    try {
      await api.post('/interest', { service: 'supplies' });
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
          <h1 className="text-4xl font-extrabold mb-2">Movv Suprimentos</h1>
          <p className="text-white/80 text-lg max-w-2xl">
            Tudo o que sua contabilidade precisa, com preços de atacado.
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
          Comprar suprimentos de escritório no varejo é caro, demorado e fragmentado. O{' '}
          <strong>Movv Suprimentos</strong> vai mudar essa realidade. Centralizamos o fornecimento
          dos itens que sua contabilidade mais usa, com preços de atacado, entrega programada e
          atendimento dedicado.
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

      {/* Como vai funcionar */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-slate-900 text-base">Como vai funcionar</h2>
        <ul className="space-y-3">
          {comoFunciona.map((item, i) => (
            <li key={i} className="flex items-center gap-3 text-slate-700 text-sm">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                style={{ background: PURPLE }}
              >
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Vantagens — box dourado */}
      <div
        className="rounded-2xl p-6 border-2 space-y-4"
        style={{ borderColor: GOLD, background: `${GOLD}15` }}
      >
        <h2 className="font-bold text-slate-900 text-base" style={{ color: PURPLE }}>
          Vantagens para sua contabilidade
        </h2>
        <ul className="space-y-2.5">
          {vantagens.map((v, i) => (
            <li key={i} className="flex items-center gap-3 text-slate-700 text-sm">
              <span className="font-bold text-base" style={{ color: GOLD }}>{v.emoji}</span>
              {v.texto}
            </li>
          ))}
        </ul>
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
              Avisaremos você em primeira mão quando lançarmos o Movv Suprimentos.
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
