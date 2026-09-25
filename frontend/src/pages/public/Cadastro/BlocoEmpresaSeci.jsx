import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import apiPainel from '../../../services/apiPainel';
import { maskCnpj, soDigitos, validCNPJ } from '../../../utils/documentos';

const DIA_MS = 24 * 3600 * 1000;

function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function diasAte(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(`${String(iso).slice(0, 10)}T23:59:59`).getTime() - Date.now()) / DIA_MS);
}

// Bloco "empresa" do /meu: o cliente ATIVA o desconto de associado
// informando o CNPJ; o associado RENOVA a carteirinha (6 meses) ou troca de
// empresa. A situação vem calculada do servidor (dados.beneficio — ver
// beneficioAssociado.js). Legado (carteirinha permanente) não vê o bloco.
export default function BlocoEmpresaSeci({ dados, recarregar }) {
  const [cnpj, setCnpj] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const b = dados.beneficio;
  if (!b || b.legado || b.situacao === 'inativo') return null;

  const dias = diasAte(b.valida_ate);
  const ehCliente = b.situacao === 'cliente';
  const podeRenovar = b.situacao === 'expirado' || (b.situacao === 'ativo' && dias !== null && dias <= 30);
  const mostrarCampo = ehCliente || podeRenovar || b.situacao === 'pausado';

  const empresaNome = b.empresa?.nome;
  let titulo; let texto; let cls;
  if (ehCliente) {
    titulo = '🏪 Trabalha no comércio?';
    texto = 'Ganhe descontos exclusivos! Informe o CNPJ da sua empresa — se ela for associada ao SECI, o desconto ativa na hora.';
    cls = 'bg-violet-50 border-violet-200 text-violet-900';
  } else if (b.situacao === 'expirado') {
    titulo = '⌛ Sua carteirinha venceu';
    texto = `Venceu em ${fmtData(b.valida_ate)}. Renove informando o CNPJ da empresa onde você trabalha hoje.`;
    cls = 'bg-red-50 border-red-200 text-red-900';
  } else if (b.situacao === 'pausado') {
    titulo = '⏸️ Benefícios pausados';
    texto = `${empresaNome || 'Sua empresa'} está com pendência no SECI. Assim que regularizar, seus descontos voltam sozinhos. Mudou de empresa? Informe o CNPJ novo.`;
    cls = 'bg-amber-50 border-amber-200 text-amber-900';
  } else {
    titulo = `✅ Associado SECI${empresaNome ? ` · ${empresaNome}` : ''}`;
    texto = podeRenovar
      ? `Sua carteirinha vence em ${fmtData(b.valida_ate)} (${dias <= 0 ? 'hoje' : `${dias} dia(s)`}). Renove agora informando o CNPJ da sua empresa.`
      : `Carteirinha válida até ${fmtData(b.valida_ate)}.`;
    cls = 'bg-emerald-50 border-emerald-200 text-emerald-900';
  }

  async function enviar(e) {
    e.preventDefault();
    setErro(null); setAviso(null);
    const d = soDigitos(cnpj);
    // Filiado pessoa física renova pelo próprio CPF, sem CNPJ.
    if (!d && !b.filiado_pessoa_fisica) { setErro('Informe o CNPJ da empresa.'); return; }
    if (d && !validCNPJ(d)) { setErro('CNPJ inválido — confira os números.'); return; }
    setEnviando(true);
    try {
      const res = await apiPainel.post('/public/painel/empresa', { cnpj: d || null });
      const r = res.data;
      if (r.cenario === 'ativado') toast.success('🎊 Bem-vindo(a) associado(a) SECI! Seus descontos já estão ativos.', { duration: 6000 });
      else if (r.cenario === 'renovado') toast.success(`Carteirinha renovada até ${fmtData(r.beneficio?.valida_ate)}! 🎉`, { duration: 6000 });
      else if (r.cenario === 'pendencia') setAviso(`Detectamos pendência${r.empresa_nome ? ` com ${r.empresa_nome}` : ''} no SECI. Vamos entrar em contato para regularizar sua associação.`);
      else if (r.cenario === 'nao_encontrada') setAviso('Essa empresa não foi encontrada na base do SECI. Vamos entrar em contato para verificar sua associação!');
      if (r.cenario === 'ativado' || r.cenario === 'renovado') { setCnpj(''); await recarregar(); }
    } catch (err) {
      setErro(err.response?.data?.error || 'Não conseguimos verificar agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={`rounded-2xl p-4 border ${cls}`}>
      <p className="font-bold text-sm">{titulo}</p>
      <p className="text-xs mt-1 opacity-90">{texto}</p>
      {mostrarCampo && (
        <form onSubmit={enviar} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              className="input bg-white flex-1 min-w-0" inputMode="numeric" placeholder="CNPJ da empresa"
              value={cnpj} onChange={e => { setCnpj(maskCnpj(e.target.value)); setErro(null); }}
            />
            <button type="submit" disabled={enviando} className="flex-shrink-0 px-4 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ backgroundColor: '#4C1D95' }}>
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : ehCliente ? 'Ativar' : 'Renovar'}
            </button>
          </div>
          {b.filiado_pessoa_fisica && !ehCliente && <p className="text-[11px] opacity-80">Filiado pessoa física: deixe em branco pra renovar pelo seu CPF.</p>}
          {erro && <p className="text-red-600 text-xs">{erro}</p>}
          {aviso && <p className="text-xs font-semibold">{aviso}</p>}
        </form>
      )}
    </div>
  );
}
