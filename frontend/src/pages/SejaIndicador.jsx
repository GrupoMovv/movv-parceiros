import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Smartphone, DollarSign, Eye, CheckCircle, ArrowRight } from 'lucide-react';

const PRODUTOS_ALTA = ['Cartão Benefício INSS', 'Antecipação FGTS', 'Seguros', 'Consignado INSS Novo', 'Crédito Pessoal', 'Empr. Cartão de Crédito'];
const PRODUTOS_MEDIA = ['Consignado Servidor', 'Consignado CLT', 'Empresas Privadas', 'Energia', 'Energia Solar', 'Crédito Salário BB'];
const PRODUTOS_BAIXA = ['Portabilidade INSS', 'Refinanciamento INSS', 'Forças Armadas', 'Consórcio', 'Financiamento Veículo', 'Financiamento Imobiliário', 'Refi Imóvel/Veículo', 'Crédito PJ'];

const PCT = { alta: 0.01, media: 0.007, baixa: 0.002 };

function formatBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SejaIndicador() {
  const [simQtd, setSimQtd] = useState(5);
  const [simValor, setSimValor] = useState(10000);
  const [simCat, setSimCat] = useState('alta');

  const simResult = simQtd * simValor * PCT[simCat];

  return (
    <div className="min-h-screen bg-[#0f0a1e] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4" style={{ background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0a3e 50%, #0f0a1e 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#0C2D48]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#C9A84C]/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Texto */}
          <p className="text-[#C9A84C] text-xs font-bold uppercase tracking-[4px] mb-4">Grupo Movv — Itumbiara/GO</p>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            INDIQUE AZUL<br />
            <span className="text-[#C9A84C]">E GANHE</span>
          </h1>
          <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
            Indique clientes para os produtos financeiros Azul e receba comissão direto na sua chave PIX. Sem mensalidade, sem burocracia.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              to="/cadastro-indicador"
              className="inline-flex items-center gap-2 bg-[#0C2D48] hover:bg-[#5a1eaf] text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-[#0C2D48]/30"
            >
              QUERO SER INDICADOR <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all border border-white/20"
            >
              Já sou indicador — Entrar
            </Link>
          </div>

          {/* Imagem em destaque */}
          <div className="relative mx-auto w-full max-w-3xl">
            <div className="absolute -inset-4 bg-[#0C2D48]/30 rounded-3xl blur-2xl" />
            <img
              src="/indique-e-ganhe.jpg"
              alt="Indique Azul e Ganhe"
              className="relative w-full rounded-3xl shadow-2xl border border-white/10 object-cover"
            />
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-16 px-4 bg-[#0f0a1e]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Por que ser um <span className="text-[#C9A84C]">Indicador Azul</span>?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: DollarSign, title: 'Sem mensalidade', desc: 'Cadastro 100% gratuito. Você só recebe, nunca paga.' },
              { icon: Smartphone, title: 'PIX na sua chave', desc: 'Receba suas comissões via PIX (CPF, e-mail, telefone ou aleatória).' },
              { icon: TrendingUp, title: 'Quanto mais indica, mais ganha', desc: 'Sem teto de ganhos. Você cria sua própria renda extra.' },
              { icon: Eye, title: 'Acompanhamento em tempo real', desc: 'Veja o status de cada indicação no seu painel.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all">
                <div className="w-12 h-12 bg-[#0C2D48]/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-[#C9A84C]" />
                </div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-white/60 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-16 px-4 bg-white/3">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Como Funciona</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: '1', title: 'Cadastre-se', desc: 'Preencha o formulário com seus dados e chave PIX.' },
              { n: '2', title: 'Aguarde aprovação', desc: 'Nossa equipe analisa e aprova seu cadastro em até 24h.' },
              { n: '3', title: 'Indique clientes', desc: 'Use seu painel para registrar indicações com nome, CPF e produto.' },
              { n: '4', title: 'Receba via PIX', desc: 'Quando a indicação for concluída, você recebe sua comissão.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="relative">
                <div className="bg-[#1a0a3e] border border-[#0C2D48]/40 rounded-2xl p-6">
                  <div className="w-10 h-10 bg-[#0C2D48] rounded-xl flex items-center justify-center font-black text-xl text-[#C9A84C] mb-4">{n}</div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-white/60 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabela de Comissões */}
      <section className="py-16 px-4 bg-[#0f0a1e]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Tabela de Comissões</h2>
          <p className="text-center text-white/60 mb-12">Comissão calculada sobre o valor do contrato/operação</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Faixa Alta', pct: '1,0%', color: '#22c55e', bg: 'bg-green-500/10 border-green-500/30', produtos: PRODUTOS_ALTA },
              { label: 'Faixa Média', pct: '0,7%', color: '#eab308', bg: 'bg-yellow-500/10 border-yellow-500/30', produtos: PRODUTOS_MEDIA },
              { label: 'Faixa Baixa', pct: '0,2%', color: '#94a3b8', bg: 'bg-slate-500/10 border-slate-500/30', produtos: PRODUTOS_BAIXA },
            ].map(({ label, pct, color, bg, produtos }) => (
              <div key={label} className={`border rounded-2xl p-6 ${bg}`}>
                <div className="text-center mb-4">
                  <p className="text-sm font-semibold text-white/60 uppercase tracking-wider">{label}</p>
                  <p className="text-4xl font-black mt-1" style={{ color }}>{pct}</p>
                  <p className="text-xs text-white/40 mt-1">de comissão</p>
                </div>
                <ul className="space-y-1.5">
                  {produtos.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Exemplos de ganho */}
      <section className="py-16 px-4 bg-[#1a0a3e]/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Exemplos de Ganho</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Antecipação FGTS', valor: 'R$ 15.000', comissao: 'R$ 150,00', faixa: 'Alta (1%)', color: '#22c55e' },
              { label: 'Consignado Servidor', valor: 'R$ 20.000', comissao: 'R$ 140,00', faixa: 'Média (0,7%)', color: '#eab308' },
              { label: 'Consórcio', valor: 'R$ 50.000', comissao: 'R$ 100,00', faixa: 'Baixa (0,2%)', color: '#94a3b8' },
            ].map(({ label, valor, comissao, faixa, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <p className="text-white/60 text-sm mb-1">{label}</p>
                <p className="text-white font-semibold mb-3">Operação de {valor}</p>
                <div className="border-t border-white/10 pt-3">
                  <p className="text-xs text-white/40 mb-1">Sua comissão ({faixa})</p>
                  <p className="text-2xl font-black" style={{ color }}>{comissao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulador */}
      <section className="py-16 px-4 bg-[#0f0a1e]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simule seus Ganhos</h2>
          <p className="text-center text-white/60 mb-10">Calcule quanto você pode ganhar por mês</p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-2">Indicações/mês</label>
                <input
                  type="number"
                  min="1"
                  value={simQtd}
                  onChange={e => setSimQtd(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-[#0C2D48]"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-2">Valor médio (R$)</label>
                <input
                  type="number"
                  min="0"
                  value={simValor}
                  onChange={e => setSimValor(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-[#0C2D48]"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 font-semibold uppercase tracking-wider mb-2">Categoria</label>
                <select
                  value={simCat}
                  onChange={e => setSimCat(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-[#0C2D48]"
                >
                  <option value="alta">Alta (1%)</option>
                  <option value="media">Média (0,7%)</option>
                  <option value="baixa">Baixa (0,2%)</option>
                </select>
              </div>
            </div>
            <div className="bg-[#0C2D48]/20 border border-[#0C2D48]/40 rounded-2xl p-6 text-center">
              <p className="text-white/60 text-sm mb-2">Estimativa de ganhos mensais</p>
              <p className="text-5xl font-black text-[#C9A84C]">{formatBRL(simResult)}</p>
              <p className="text-white/40 text-xs mt-2">* Estimativa com base nos valores informados</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(135deg, #1a0a3e 0%, #0C2D48 100%)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-4">Pronto para começar?</h2>
          <p className="text-white/70 text-lg mb-8">Cadastre-se gratuitamente e comece a ganhar comissões hoje mesmo.</p>
          <Link
            to="/cadastro-indicador"
            className="inline-flex items-center gap-3 bg-[#C9A84C] hover:bg-[#d4b85e] text-[#1a0a3e] font-black text-xl px-10 py-5 rounded-2xl transition-all shadow-xl shadow-[#C9A84C]/30"
          >
            QUERO SER INDICADOR <ArrowRight className="w-6 h-6" />
          </Link>
          <p className="text-white/40 text-sm mt-6">
            Já tem cadastro?{' '}
            <Link to="/login" className="text-[#C9A84C] underline">
              Fazer login
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <div className="py-6 text-center text-white/30 text-xs bg-[#0f0a1e]">
        © {new Date().getFullYear()} Grupo Movv — Itumbiara/GO
      </div>
    </div>
  );
}
