import toast from 'react-hot-toast';
import { setParceiroToken } from '../../../services/apiParceiro';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';

// Abre a sessão que o login único (/entrar) ou a troca de senha devolveu:
//   pessoa  -> token do painel do associado (confere o cpf_parcial) -> voltar ou /marketplace
//   empresa -> token do painel do parceiro -> /parceiro/painel
// Devolve false se não deu pra abrir (a tela mostra o erro).
export async function abrirSessao(sessao, navigate, voltar = '/marketplace') {
  if (sessao.tipo === 'empresa') {
    setParceiroToken(sessao.token);
    toast.success(`Bem-vindo(a), ${sessao.nome_curto}! 👋`);
    navigate(voltar.startsWith('/parceiro/') ? voltar : '/parceiro/painel', { replace: true });
    return true;
  }
  const ok = await entrarNoPainelSeguro(sessao.token, { cpfParcial: sessao.cpf_parcial });
  if (!ok) return false;
  toast.success(`Olá, ${sessao.nome_curto}! 👋`);
  navigate(voltar.startsWith('/parceiro/') ? '/marketplace' : voltar, { replace: true });
  return true;
}
