import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, MessageCircle, AlertTriangle } from 'lucide-react';

const WA_NUMBER = '5564993252996';

const PF = [
  { produto: 'PF A1',               preco: 170, comissao: 47.22 },
  { produto: 'A3 1 Ano',            preco: 170, comissao: 47.22 },
  { produto: 'A3 2 Anos',           preco: 200, comissao: 55.56 },
  { produto: 'A3 + Cartão 1 Ano',   preco: 230, comissao: 63.89 },
  { produto: 'A3 + Cartão 2 Anos',  preco: 260, comissao: 72.22 },
  { produto: 'A3 + Token 1 Ano',    preco: 240, comissao: 66.67 },
  { produto: 'A3 + Token 2 Anos',   preco: 280, comissao: 77.78 },
];

const PJ = [
  { produto: 'PJ A1',               preco: 180, comissao: 50.00 },
  { produto: 'A3 1 Ano',            preco: 180, comissao: 50.00 },
  { produto: 'A3 2 Anos',           preco: 220, comissao: 61.11 },
  { produto: 'A3 + Cartão 1 Ano',   preco: 240, comissao: 66.67 },
  { produto: 'A3 + Cartão 2 Anos',  preco: 280, comissao: 77.78 },
  { produto: 'A3 + Token 1 Ano',    preco: 260, comissao: 72.22 },
  { produto: 'A3 + Token 2 Anos',   preco: 300, comissao: 83.33 },
];

const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function waLink(produto, preco, tipo, code) {
  const msg = `Olá! Sou parceiro Movv (cód. ${code}). Gostaria de solicitar o Certificado Digital:\n\n*Produto:* ${tipo} ${produto}\n*Valor:* ${fmt(preco)}\n\nPor favor, entre em contato para prosseguir.`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function TabelaCertificados({ titulo, dados, tipo, code }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-movv-900" />
        <h3 className="font-bold text-slate-900">{titulo}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-5 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider">Produto</th>
              <th className="text-right px-5 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider">Preço cliente</th>
              <th className="text-right px-5 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider">Sua comissão</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {dados.map((row, i) => (
              <tr key={i} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors`}>
                <td className="px-5 py-3.5 font-medium text-slate-900">{row.produto}</td>
                <td className="px-5 py-3.5 text-right text-slate-600">{fmt(row.preco)}</td>
                <td className="px-5 py-3.5 text-right">
                  <span className="font-bold text-emerald-700">{fmt(row.comissao)}</span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <a
                    href={waLink(row.produto, row.preco, tipo, code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Solicitar via WhatsApp
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DiretaCertificacao() {
  const { user } = useAuth();
  const code = user?.code || 'PARCEIRO';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#C9A84C]" />
          Direta Certificação Digital
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Tabela exclusiva de certificados — comissão 100% para a contabilidade
        </p>
      </div>

      {/* Aviso exclusivo */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-800 font-semibold text-sm">Canal exclusivo para contabilidades</p>
          <p className="text-amber-700 text-sm mt-0.5">
            Funcionários não participam dessa comissão. Os valores são <strong>100% para o escritório contábil</strong>, sem divisão com funcionários.
          </p>
        </div>
      </div>

      {/* Card resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center space-y-1">
          <p className="text-slate-500 text-xs uppercase tracking-wider">Canal</p>
          <p className="text-slate-900 font-bold">Direta Certificação</p>
        </div>
        <div className="card text-center space-y-1">
          <p className="text-slate-500 text-xs uppercase tracking-wider">Comissão</p>
          <p className="text-emerald-700 font-bold text-lg">100% ao escritório</p>
        </div>
        <div className="card text-center space-y-1">
          <p className="text-slate-500 text-xs uppercase tracking-wider">Seu código</p>
          <p className="text-gradient font-bold font-mono tracking-wider">{code}</p>
        </div>
      </div>

      {/* Tabelas */}
      <TabelaCertificados titulo="Pessoa Física (PF)" dados={PF} tipo="PF" code={code} />
      <TabelaCertificados titulo="Pessoa Jurídica (PJ)" dados={PJ} tipo="PJ" code={code} />

      {/* Nota de rodapé */}
      <div className="bg-[#FDF8ED] border border-[#C9A84C]/30 rounded-2xl p-5">
        <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-wider mb-2">Observações</p>
        <ul className="text-slate-600 text-sm space-y-1 list-disc list-inside">
          <li>Preços sujeitos a alteração sem aviso prévio. Consulte sempre a tabela atualizada.</li>
          <li>Comissão creditada após confirmação de emissão pela operadora.</li>
          <li>Ao clicar em "Solicitar via WhatsApp", sua mensagem já inclui o produto e seu código.</li>
        </ul>
      </div>

      {/* Contato */}
      <div className="card flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        <div className="inline-flex w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-slate-900 font-semibold">Suporte Direta Certificação</p>
          <p className="text-slate-500 text-sm mt-0.5">Dúvidas sobre emissão, valores ou prazos</p>
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
    </div>
  );
}
