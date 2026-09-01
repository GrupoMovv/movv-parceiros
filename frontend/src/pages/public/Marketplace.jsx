import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Sparkles } from 'lucide-react';
import { linkWhatsappComTexto } from '../../utils/carteirinhaWhatsapp';

const NAVY = '#0B1F3A';
const LIME = '#B8E62C';

const MENSAGEM_PADRAO = 'Olá! Sou associado do SECI e gostaria de saber mais sobre os benefícios oferecidos.';

// ⚠️ IMPORTANTE: dados dos parceiros hardcoded aqui temporariamente.
// Quando Portal do Parceiro estiver implementado, buscar dinamicamente
// da tabela sindicato_parceiros e mostrar promoções/produtos ativos.
// Ver issue/tarefa: "Portal do Parceiro - Fase 2"
const PARCEIROS = [
  {
    nome: 'Nossa Drogaria', icone: '💊', corBg: '#A7F3D0', corTexto: '#047857',
    descricao: 'Descontos exclusivos em produtos e medicamentos', categoria: 'Saúde',
    whatsapp: '64992991403', beneficio: 'Super descontos pra associados',
  },
  {
    nome: 'Academia Atlética', icone: '🏋️', corBg: '#FED7AA', corTexto: '#C2410C',
    descricao: 'Mensalidade especial pra associados SECI', categoria: 'Esportes',
    whatsapp: null, beneficio: 'R$ 30,00 por mês, todos os dias',
  },
  {
    nome: 'Diroma Fiori — Caldas Novas', icone: '🏨', corBg: '#BAE6FD', corTexto: '#0369A1',
    descricao: 'Pacote de final de semana em Caldas Novas', categoria: 'Hotelaria',
    whatsapp: '64992640899', beneficio: 'R$ 300 sexta a domingo',
  },
  {
    nome: 'Óticas Diniz', icone: '👓', corBg: '#E0E7FF', corTexto: '#1E3A8A',
    descricao: 'Descontos em armações e lentes', categoria: 'Ótica',
    whatsapp: '6434320708', beneficio: '20% de desconto',
  },
  {
    nome: 'Ezequiel Reis — Nutricionista', icone: '🥗', corBg: '#D9F99D', corTexto: '#4D7C0F',
    descricao: 'Consulta com nutricionista e plano alimentar', categoria: 'Nutrição',
    whatsapp: '64993222304', beneficio: 'Consulta por R$ 70,00',
  },
  {
    nome: 'Plenitude — Psicologia', icone: '🧠', corBg: '#E9D5FF', corTexto: '#7E22CE',
    descricao: 'Atendimento psicológico especializado', categoria: 'Psicologia',
    whatsapp: '64992012585', beneficio: 'Psicoterapia adulto, infantil, ABA, neuropsicologia',
  },
  {
    nome: 'Nesplora — Avaliação Neuropsicológica', icone: '🥽', corBg: '#BFDBFE', corTexto: '#1D4ED8',
    descricao: 'Avaliação neuropsicológica com realidade virtual', categoria: 'Psicologia',
    whatsapp: '64992012585', beneficio: 'R$ 400 com relatório',
  },
  {
    nome: 'Laura Clemente — Estética', icone: '💆‍♀️', corBg: '#FBCFE8', corTexto: '#BE185D',
    descricao: 'Serviços de estética corporal e facial', categoria: 'Estética',
    whatsapp: '64992300587', beneficio: '10% desconto em qualquer região',
  },
  {
    nome: 'Studio Vip — Beleza', icone: '💇‍♀️', corBg: '#FDE68A', corTexto: '#92400E',
    descricao: 'Serviços de beleza e saúde capilar', categoria: 'Beleza',
    whatsapp: null, beneficio: '20% de desconto',
  },
];

const CATEGORIAS = [
  { label: 'Todas', emoji: null },
  { label: 'Saúde', emoji: '💊' },
  { label: 'Esportes', emoji: '🏋️' },
  { label: 'Ótica', emoji: '👓' },
  { label: 'Nutrição', emoji: '🥗' },
  { label: 'Psicologia', emoji: '🧠' },
  { label: 'Estética', emoji: '💆' },
  { label: 'Hotelaria', emoji: '🏨' },
  { label: 'Beleza', emoji: '💇' },
];

export default function Marketplace() {
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');

  const parceirosFiltrados = categoriaAtiva === 'Todas'
    ? PARCEIROS
    : PARCEIROS.filter(p => p.categoria === categoriaAtiva);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div className="relative px-6 pt-10 pb-8 text-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1E4A8A 100%)` }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.05, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)' }}
        />
        <p className="relative text-white font-black text-lg tracking-wide">SECI</p>
        <h1 className="relative text-white font-black text-2xl sm:text-3xl mt-2">Marketplace SECI</h1>
        <p className="relative text-white/70 text-sm mt-1.5">Benefícios exclusivos pra você</p>
      </div>

      {/* Filtro de categorias */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 max-w-5xl mx-auto w-fit sm:w-full sm:justify-center">
          {CATEGORIAS.map(c => (
            <button
              key={c.label}
              onClick={() => setCategoriaAtiva(c.label)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
              style={categoriaAtiva === c.label
                ? { backgroundColor: LIME, color: NAVY }
                : { backgroundColor: '#F1F5F9', color: '#475569' }}
            >
              {c.emoji ? `${c.emoji} ${c.label}` : c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de parceiros */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {parceirosFiltrados.map(p => (
            <CardParceiro key={p.nome} parceiro={p} />
          ))}
        </div>

        {parceirosFiltrados.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-12">Nenhum parceiro nessa categoria ainda.</p>
        )}
      </div>

      {/* Rodapé */}
      <div className="text-center px-6 py-10 space-y-2">
        <p className="text-slate-500 text-sm flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4" style={{ color: '#C9A84C' }} />
          Você está no Marketplace SECI — benefícios exclusivos pra associados ativos
        </p>
        <Link to="/cadastrar" className="inline-block text-sm font-semibold underline" style={{ color: NAVY }}>
          Faça sua carteirinha digital
        </Link>
      </div>
    </div>
  );
}

function CardParceiro({ parceiro }) {
  const link = parceiro.whatsapp ? linkWhatsappComTexto(parceiro.whatsapp, MENSAGEM_PADRAO) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-3"
        style={{ backgroundColor: parceiro.corBg }}
      >
        {parceiro.icone}
      </div>

      <h2 className="font-bold text-slate-900 text-sm leading-tight">{parceiro.nome}</h2>
      <p className="text-slate-500 text-xs mt-1 leading-snug flex-1">{parceiro.descricao}</p>

      <span
        className="inline-block mt-3 text-[11px] font-bold px-2.5 py-1 rounded-full w-fit"
        style={{ backgroundColor: parceiro.corBg, color: parceiro.corTexto }}
      >
        {parceiro.beneficio}
      </span>

      {link ? (
        <a
          href={link} target="_blank" rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl text-white transition-colors"
          style={{ backgroundColor: '#25D366' }}
        >
          <MessageCircle className="w-3.5 h-3.5" /> Falar no WhatsApp
        </a>
      ) : (
        <span className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl text-slate-400 bg-slate-100">
          Em breve
        </span>
      )}
    </div>
  );
}
