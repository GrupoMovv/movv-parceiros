import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermosIndicador() {
  return (
    <div className="min-h-screen bg-[#0f0a1e] py-10 px-4 text-white">
      <div className="max-w-3xl mx-auto">
        <Link to="/seja-indicador" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <p className="text-[#C9A84C] text-xs font-bold uppercase tracking-[4px] mb-2">Grupo Movv</p>
            <h1 className="text-3xl font-black">Termos de Uso</h1>
            <p className="text-white/50 text-sm mt-2">Programa Indique Azul e Ganhe</p>
            <p className="text-white/40 text-xs mt-1">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-white/70 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Definições</h2>
              <p>O programa <strong className="text-white">Indique Azul e Ganhe</strong> é uma iniciativa do Grupo Movv que permite que pessoas físicas (doravante "Indicadores") indiquem clientes para os produtos financeiros da linha Azul, recebendo comissão pelas indicações que resultem em negócios concretizados.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Cadastro e Aprovação</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>O cadastro no programa é gratuito e não gera nenhuma obrigação financeira para o Indicador.</li>
                <li>Após o envio do formulário, o cadastro será analisado pela equipe Movv em até 24 horas úteis.</li>
                <li>A Movv se reserva o direito de aprovar ou recusar cadastros a seu critério, sem necessidade de justificativa.</li>
                <li>O Indicador deve ter mais de 18 anos e possuir CPF válido no Brasil.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Comissões</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>As comissões são calculadas sobre o valor do contrato/operação realizada com o cliente indicado.</li>
                <li>Os percentuais são: Faixa Alta (1%), Faixa Média (0,7%) e Faixa Baixa (0,2%), conforme tabela disponível no portal.</li>
                <li>A comissão só é devida após a efetiva conclusão da operação pelo cliente indicado.</li>
                <li>O pagamento das comissões será realizado via PIX para a chave cadastrada pelo Indicador.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Regras de Indicação</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Cada indicação tem validade de 10 dias corridos a partir do cadastro.</li>
                <li>O Indicador pode renovar indicações pendentes por mais 10 dias.</li>
                <li>Não é permitido indicar o mesmo cliente para o mesmo produto caso já exista uma indicação ativa.</li>
                <li>O Indicador não pode indicar clientes que já sejam parceiros ou colaboradores do Grupo Movv.</li>
                <li>É proibida qualquer prática de captação abusiva ou enganosa de clientes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Proteção de Dados</h2>
              <p>Os dados dos clientes indicados serão tratados em conformidade com a Lei Geral de Proteção de Dados (LGPD). O Indicador é responsável por obter o consentimento do cliente para compartilhamento de seus dados com o Grupo Movv.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Suspensão e Encerramento</h2>
              <p>O Grupo Movv pode suspender ou encerrar o acesso de um Indicador ao programa a qualquer momento, em especial em casos de violação destes termos, conduta inadequada ou inatividade prolongada.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">7. Disposições Gerais</h2>
              <p>Este programa não caracteriza vínculo empregatício entre o Indicador e o Grupo Movv. O Indicador atua como pessoa física autônoma. Estes termos podem ser alterados a qualquer momento, com notificação prévia aos Indicadores cadastrados.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">8. Contato</h2>
              <p>Dúvidas sobre o programa: <strong className="text-[#C9A84C]">contato@grupomovv.com.br</strong></p>
            </section>
          </div>

          <div className="mt-10 text-center">
            <Link to="/cadastro-indicador" className="inline-block bg-[#0C2D48] hover:bg-[#5a1eaf] text-white font-semibold px-8 py-3 rounded-xl transition-all">
              Aceitar e Cadastrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
