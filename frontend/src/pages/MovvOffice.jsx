import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const PURPLE = '#4A0E8F';
const GOLD   = '#C9A84C';

const sections = [
  {
    icon: '🏛️',
    title: 'Órgãos Públicos e Protocolos',
    items: [
      'Protocolos em Prefeitura',
      'Receita Federal',
      'Junta Comercial',
      'Órgãos estaduais e municipais',
    ],
  },
  {
    icon: '📄',
    title: 'Cartórios e Documentações',
    items: [
      'Escrituras, registros, autenticações',
      'Reconhecimento de firma',
      'Apostilamento Haia',
      'Tradução juramentada',
      'Procurações públicas',
    ],
  },
  {
    icon: '📋',
    title: 'Certidões e Negativas',
    items: [
      'CND Federal / Estadual / Municipal',
      'Certidão de Falência e Concordata',
      'Certidão Trabalhista',
      'Negativa de Protesto',
      'Certidão de Distribuição Cível e Criminal',
    ],
  },
  {
    icon: '🏢',
    title: 'Constituição e Alteração de Empresas',
    items: [
      'Abertura (MEI, LTDA, S/A)',
      'Alterações contratuais',
      'Encerramento',
      'Transferência de cotas',
    ],
  },
  {
    icon: '📍',
    title: 'Licenças e Vigilâncias',
    items: [
      'Vigilância Sanitária',
      'Corpo de Bombeiros (AVCB)',
      'Licenças ambientais',
      'ANVISA',
    ],
  },
  {
    icon: '🎓',
    title: 'Órgãos de Classe',
    items: [
      'CRC, CREA, OAB, CRM',
      'Anuidades',
      'Certidões de regularidade',
    ],
  },
  {
    icon: '👤',
    title: 'Serviços para Pessoa Física',
    items: [
      'RG, Passaporte',
      'Antecedentes criminais',
      'Renovação CNH',
      'INSS e benefícios',
    ],
  },
];

export default function MovvOffice() {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  async function handleInterest() {
    setLoading(true);
    try {
      await api.post('/interest', { service: 'office' });
      setDone(true);
    } catch (err) {
      const msg = err.response?.data?.error;
      if (err.response?.status === 409) {
        setDone(true);
      } else {
        toast.error(msg || 'Erro ao registrar interesse');
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
          <h1 className="text-4xl font-extrabold mb-2">Movv Office</h1>
          <p className="text-white/80 text-lg max-w-2xl">
            Soluções operacionais para sua contabilidade focar no que realmente importa.
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
          Sabemos que tempo é o ativo mais valioso de um escritório contábil. Filas em prefeitura,
          idas a cartórios, atendimentos na Receita Federal e emissão de alvarás consomem horas
          preciosas do seu time. O <strong>Movv Office</strong> vai resolver isso para você.
          Centralizamos as demandas burocráticas e protocolares da sua contabilidade com excelência
          operacional, agilidade e total transparência.
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
              Avisaremos você em primeira mão quando lançarmos o Movv Office.
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
