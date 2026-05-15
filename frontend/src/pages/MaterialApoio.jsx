import { useState } from 'react';
import {
  Download, BookOpen, CheckCircle2, UserPlus, ClipboardList, Banknote,
  ChevronDown, ChevronUp, MessageCircle, TrendingUp, Zap, Star, Info, AlertTriangle
} from 'lucide-react';

const FAIXAS = [
  {
    label: 'FAIXA ALTA', percentual: '1,5%', cor: '#1A6B3C',
    bgCls: 'bg-emerald-50 border-emerald-200', badgeCls: 'bg-emerald-600 text-white',
    dotCls: 'bg-emerald-500', textCls: 'text-emerald-800',
    produtos: [
      'Consignado INSS - Novo',
      'Cartão Benefício / Consignado INSS',
      'FGTS Saque Aniversário',
      'Seguros (Auto, Vida, Residencial, Empresarial)',
      'Crédito Pessoal',
      'Empréstimo via Cartão de Crédito',
    ],
  },
  {
    label: 'FAIXA MÉDIA', percentual: '1,0%', cor: '#C9A84C',
    bgCls: 'bg-yellow-50 border-yellow-200', badgeCls: 'bg-yellow-600 text-white',
    dotCls: 'bg-yellow-500', textCls: 'text-yellow-800',
    produtos: [
      'Consignado Servidor Público',
      'Consignado CLT',
      'Consignado Empresas Privadas',
      'Empréstimo na Conta de Energia',
      'Energia Solar',
      'Crédito Salário Banco do Brasil',
    ],
  },
  {
    label: 'FAIXA BAIXA', percentual: '0,3%', cor: '#1A4FA6',
    bgCls: 'bg-blue-50 border-blue-200', badgeCls: 'bg-blue-600 text-white',
    dotCls: 'bg-blue-500', textCls: 'text-blue-800',
    produtos: [
      'Portabilidade INSS',
      'Refinanciamento INSS',
      'Consignado Forças Armadas',
      'Consórcio',
      'Financiamento de Veículo',
      'Financiamento Imobiliário',
      'Refinanciamento Imóvel / Veículo',
      'Crédito PJ',
    ],
  },
];

const PASSOS = [
  { icon: UserPlus,     numero: '01', titulo: 'Cadastre-se',  desc: 'Crie sua conta como parceiro Movv e receba seu código único de identificação.' },
  { icon: ClipboardList, numero: '02', titulo: 'Indique',      desc: 'Registre clientes pelo portal, gere o protocolo e envie via WhatsApp em segundos.' },
  { icon: TrendingUp,   numero: '03', titulo: 'Acompanhe',    desc: 'Visualize o status de cada indicação em tempo real — pendente, convertida ou expirada.' },
  { icon: Banknote,     numero: '04', titulo: 'Receba',        desc: 'Comissão aprovada depositada via PIX até o 10º dia útil do mês seguinte.' },
];

const FAQ = [
  {
    q: 'Quando recebo minha comissão?',
    a: 'Comissões aprovadas são pagas até o 10º dia útil do mês seguinte via PIX. O status pode ser acompanhado na aba Extrato.',
  },
  {
    q: 'Como é calculada a comissão?',
    a: 'Depende da faixa do produto: 1,5% (Alta), 1,0% (Média) ou 0,3% (Baixa) sobre o valor operado. O total é dividido em 51% para o funcionário, 34% líquido para a contabilidade e 15% de imposto — retido pela contabilidade para pagamento de tributos. A contabilidade recebe 100% via PIX e é responsável por distribuir ao funcionário.',
  },
  {
    q: 'O que é o protocolo de indicação?',
    a: 'É um código único gerado para cada indicação, enviado automaticamente ao cliente via WhatsApp. Ele serve para rastrear e confirmar a origem do negócio.',
  },
  {
    q: 'Posso indicar quantos clientes quiser?',
    a: 'Sim! Não há limite de indicações. Quanto mais você indicar, maior será sua comissão mensal.',
  },
  {
    q: 'Como funciona o BPO Financeiro?',
    a: 'No 1º mês o parceiro recebe R$ 650,00 e a partir do 2º mês R$ 70,00/mês recorrente enquanto o cliente mantiver o plano ativo. Divisão: 51% funcionário · 34% contabilidade · 15% imposto — retido pela contabilidade.',
  },
];

export default function MaterialApoio() {
  const [faqAberto, setFaqAberto] = useState(null);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#C9A84C]" />
          Material de Apoio
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Tudo que você precisa para indicar e comissionar com sucesso
        </p>
      </div>

      {/* Card de download */}
      <div className="relative overflow-hidden rounded-2xl bg-movv-900 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #C9A84C 0%, transparent 60%)' }} />
        <div className="flex-1 relative">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-[#C9A84C]" />
            <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest">Guia Completo</span>
          </div>
          <h2 className="text-white text-xl md:text-2xl font-bold leading-tight">
            Guia do Parceiro Azul Empréstimo
          </h2>
          <p className="text-white/60 text-sm mt-2">
            Apresentação completa dos produtos, comissões, scripts de abordagem e dicas para aumentar conversões.
          </p>
        </div>
        <a
          href="/material-parceiros.pdf"
          download
          className="relative flex items-center gap-2 bg-gold-gradient text-movv-900 font-bold px-6 py-3 rounded-xl shadow-gold hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Baixar Material em PDF
        </a>
      </div>

      {/* Como funciona */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Como funciona o programa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PASSOS.map(({ icon: Icon, numero, titulo, desc }) => (
            <div key={numero} className="card text-center space-y-3">
              <div className="inline-flex w-12 h-12 rounded-full bg-purple-50 border border-purple-100 items-center justify-center mx-auto">
                <Icon className="w-5 h-5 text-movv-900" />
              </div>
              <div>
                <p className="text-[#C9A84C] text-xs font-bold font-mono">{numero}</p>
                <p className="text-slate-900 font-semibold text-sm mt-0.5">{titulo}</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tabela de comissões */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Tabela de comissões — Azul Empréstimo</h2>
        <p className="text-slate-500 text-sm mb-3">
          Divisão: <strong>51%</strong> funcionário · <strong>34%</strong> contabilidade · <strong>15%</strong> imposto (retido pela contabilidade)
        </p>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-xs leading-relaxed">
            A contabilidade recebe <strong>100% do valor</strong> da comissão via PIX (51% + 34% + 15%) e é responsável por distribuir ao funcionário e pelo recolhimento do imposto sobre o serviço.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FAIXAS.map(f => (
            <div key={f.label} className={`rounded-2xl border p-5 ${f.bgCls}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${f.badgeCls}`}>{f.label}</span>
                <span className={`text-2xl font-black ${f.textCls}`}>{f.percentual}</span>
              </div>
              <ul className="space-y-1.5">
                {f.produtos.map(p => (
                  <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0`} style={{ color: f.cor }} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Manual de Boas Práticas */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Manual de Boas Práticas — Repasse Legal ao Funcionário</h2>
          <p className="text-slate-500 text-sm mt-1">
            Como a contabilidade pode repassar a comissão do funcionário seguindo a legislação trabalhista e fiscal
          </p>
        </div>

        {/* Alerta vermelho */}
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-bold text-sm">ATENÇÃO: Pagamento por fora gera riscos sérios</p>
            <p className="text-red-700 text-xs mt-1 leading-relaxed">
              Repassar a comissão sem registro pode gerar reclamação trabalhista, autuação fiscal e responsabilização do escritório.
              Sempre escolha um dos 3 modelos legais.
            </p>
          </div>
        </div>

        {/* Card de download */}
        <div className="relative overflow-hidden rounded-2xl bg-movv-900 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #C9A84C 0%, transparent 60%)' }} />
          <div className="flex-1 relative">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest">Manual Completo</span>
            </div>
            <h3 className="text-white text-xl md:text-2xl font-bold leading-tight">
              Manual de Boas Práticas — Repasse Legal ao Funcionário
            </h3>
            <p className="text-white/60 text-sm mt-2">
              Os 3 modelos legais de repasse, comparativo de encargos, exemplos práticos e orientações jurídicas para sua contabilidade.
            </p>
          </div>
          <a
            href="/manual-boas-praticas.pdf"
            download
            className="relative flex items-center gap-2 bg-gold-gradient text-movv-900 font-bold px-6 py-3 rounded-xl shadow-gold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Baixar Manual Completo (PDF)
          </a>
        </div>

        {/* 3 cards dos modelos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Modelo 1 — Folha */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white">Modelo 1</span>
              <span className="text-xs text-emerald-700 font-medium">Mais simples</span>
            </div>
            <p className="text-emerald-900 font-bold text-base">Folha de Pagamento</p>
            <p className="text-slate-600 text-sm leading-relaxed">
              Lance a comissão no holerite como <strong>Prêmio por Produtividade</strong> ou Comissão.
              Tem encargos (INSS, FGTS, IR) mas é 100% legalizado e operacionalmente simples.
            </p>
          </div>

          {/* Modelo 2 — PLR (Recomendado) */}
          <div className="rounded-2xl border-2 border-[#C9A84C] bg-yellow-50 p-5 space-y-3 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C9A84C] text-[#4A0E8F] text-[10px] font-extrabold px-3 py-1 rounded-full tracking-wider whitespace-nowrap">
              ⭐ RECOMENDADO
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-600 text-white">Modelo 2</span>
              <span className="text-xs text-yellow-700 font-medium">Mais econômico</span>
            </div>
            <p className="text-yellow-900 font-bold text-base">PLR Semestral</p>
            <p className="text-slate-600 text-sm leading-relaxed">
              Acumule as comissões e pague via <strong>Participação nos Lucros</strong> (Lei 10.101/2000).
              Sem INSS, sem FGTS, IR diferenciado. Até R$ 7.640/ano é <strong>ISENTO de IR</strong>.
            </p>
          </div>

          {/* Modelo 3 — MEI */}
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-700 text-white">Modelo 3</span>
              <span className="text-xs text-purple-700 font-medium">Mais flexível</span>
            </div>
            <p className="text-purple-900 font-bold text-base">MEI do Funcionário</p>
            <p className="text-slate-600 text-sm leading-relaxed">
              Funcionário abre MEI e emite NF mensal para a contabilidade. Sem vínculo trabalhista extra,
              mas atenção à pejotização. Recomendado quando há várias fontes de renda.
            </p>
          </div>
        </div>

        {/* Box disclaimer dourado */}
        <div className="flex items-start gap-3 rounded-xl border border-[#C9A84C] p-4" style={{ background: '#C9A84C18' }}>
          <Info className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
          <p className="text-slate-700 text-xs leading-relaxed">
            <strong>Importante:</strong> Este manual é um guia geral. Cada contabilidade deve avaliar com seu departamento
            jurídico/contábil qual modelo se encaixa melhor à sua estrutura tributária e operacional.
            O Grupo Movv não se responsabiliza pela escolha do modelo de repasse interno.
          </p>
        </div>
      </section>

      {/* BPO */}
      <section>
        <div className="relative overflow-hidden rounded-2xl bg-purple-900 border border-purple-700 p-6">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #C9A84C 0%, transparent 60%)' }} />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest">Produto Especial</span>
              </div>
              <h3 className="text-white text-lg font-bold">BPO Financeiro — Open Gestão Empresarial</h3>
              <p className="text-white/60 text-sm mt-1">Terceirização financeira completa para empresas</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs mb-1">Mensalidade</p>
                <p className="text-white font-bold text-lg">R$ 1.399</p>
              </div>
              <div className="bg-[#C9A84C]/20 rounded-xl p-3 border border-[#C9A84C]/40">
                <p className="text-[#C9A84C] text-xs mb-1">1º mês</p>
                <p className="text-white font-bold text-lg">R$ 650</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs mb-1">Recorrente</p>
                <p className="text-white font-bold text-lg">R$ 70<span className="text-xs font-normal">/mês</span></p>
              </div>
            </div>
          </div>
          <p className="relative text-white/50 text-xs mt-4">
            * Divisão: 51% funcionário · 34% contabilidade · 15% imposto. A contabilidade recebe o total e distribui ao funcionário. Recorrente ativo enquanto o cliente mantiver o plano.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Perguntas frequentes</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="card !p-0 overflow-hidden">
              <button
                onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="text-slate-900 font-medium text-sm">{item.q}</span>
                {faqAberto === i
                  ? <ChevronUp className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                }
              </button>
              {faqAberto === i && (
                <div className="px-5 pb-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Contato */}
      <section>
        <div className="card flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="inline-flex w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-slate-900 font-semibold">Dúvidas? Fale com nosso suporte</p>
            <p className="text-slate-500 text-sm mt-0.5">WhatsApp disponível em horário comercial</p>
          </div>
          <a
            href="https://wa.me/5564993252996"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" />
            (64) 99325-2996
          </a>
        </div>
      </section>
    </div>
  );
}
