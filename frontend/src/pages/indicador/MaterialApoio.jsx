import { useState } from 'react';
import { BookOpen, Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PORTAL_URL = 'https://portal.grupomovv.com.br';

const TEMPLATES = [
  {
    title: 'Abordagem direta',
    text: `Oi [nome]! Tudo bem? 😊\n\nEstou indicando pessoas para conhecer os produtos financeiros do Banco Azul — tem opções de consignado, antecipação de FGTS, cartão benefício INSS e muito mais.\n\nO atendimento é rápido e as condições são ótimas! Posso passar seu contato para a equipe dar um retorno? Não tem compromisso! 🤝`,
  },
  {
    title: 'Foco em FGTS',
    text: `Oi [nome]! Você sabia que pode antecipar seu FGTS e ter o dinheiro na conta em até 24h? 💰\n\nEstou trabalhando com uma equipe especializada que ajuda a fazer isso de forma rápida e segura.\n\nQuer saber mais? É sem compromisso e pode ser ótimo pra resolver aquele projeto que você tem em mente! 👊`,
  },
  {
    title: 'Abordagem consignado',
    text: `Olá [nome]! Passando para indicar algo que pode ser útil para você.\n\nTemos ótimas condições de crédito consignado com taxas baixíssimas para servidores públicos, INSS e CLT. Parcelas que cabem no bolso e aprovação rápida. ✅\n\nSe tiver interesse, posso indicar seu contato para a equipe fazer uma simulação gratuita. Sem compromisso! 😉`,
  },
];

const DICAS = [
  'Fale primeiro com pessoas próximas — família, amigos e colegas de trabalho confiam mais em você.',
  'Sempre mencione que não tem compromisso. A simulação é gratuita.',
  'Evite pressionar. Apresente a oportunidade e deixe a equipe fazer o trabalho.',
  'Quanto mais informações você passar sobre o cliente, mais rápido a equipe consegue atender.',
  'Acompanhe o status das suas indicações no painel para saber quando follow-up.',
];

export default function IndicadorMaterialApoio() {
  const [copied, setCopied] = useState(null);

  function handleCopy(text, idx) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#4A0E8F]/10 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[#4A0E8F]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Material de Apoio</h1>
          <p className="text-slate-500 text-sm">Mensagens prontas e dicas para suas indicações</p>
        </div>
      </div>

      {/* Templates */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Mensagens prontas para WhatsApp</h2>
        <div className="space-y-4">
          {TEMPLATES.map((t, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">{t.title}</h3>
                <button
                  onClick={() => handleCopy(t.text, idx)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    copied === idx
                      ? 'bg-green-100 text-green-700'
                      : 'bg-[#4A0E8F]/10 text-[#4A0E8F] hover:bg-[#4A0E8F]/20'
                  }`}
                >
                  {copied === idx ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === idx ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <pre className="text-slate-600 text-sm whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl p-4">
                {t.text}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Link do portal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Link do Portal</h2>
        <p className="text-slate-500 text-sm mb-3">Compartilhe este link com clientes que queiram se cadastrar diretamente:</p>
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
          <span className="flex-1 text-sm font-mono text-[#4A0E8F] truncate">{PORTAL_URL}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(PORTAL_URL); toast.success('Link copiado!'); }}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4A0E8F]/10 text-[#4A0E8F] hover:bg-[#4A0E8F]/20 rounded-lg text-xs font-semibold transition-all"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar
          </button>
        </div>
      </div>

      {/* Dicas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Como convencer (sem forçar)</h2>
        <ul className="space-y-3">
          {DICAS.map((d, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#4A0E8F]/10 text-[#4A0E8F] rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-slate-600 text-sm leading-relaxed">{d}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
