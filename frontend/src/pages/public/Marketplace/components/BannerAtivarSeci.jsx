import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from '@phosphor-icons/react';
import { ROXO } from '../theme';

const CHAVE = 'iub_banner_seci_fechado';

function lerFechado() {
  try { return sessionStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

// Faixa discreta no topo do marketplace pra quem vê o "preço de associado"
// nos produtos mas não tem o benefício ativo: visitante cria a conta;
// cliente ativa pelo CNPJ no /meu; carteirinha vencida/pausada resolve lá
// também. Associado ativo não vê nada. Fechou, some até fechar a aba.
export default function BannerAtivarSeci({ associado, ehAssociadoSeci, carregando }) {
  const [fechado, setFechado] = useState(lerFechado);
  if (carregando || ehAssociadoSeci || fechado) return null;

  const situacao = associado?.beneficio?.situacao;
  const conteudo = !associado
    ? { texto: '💡 É do comércio? Crie sua conta grátis e ative seu desconto SECI!', cta: 'Criar conta', to: '/criar-conta' }
    : situacao === 'expirado'
      ? { texto: '⌛ Sua carteirinha SECI venceu. Renove e volte a ter preço de associado!', cta: 'Renovar', to: '/meu' }
      : situacao === 'pausado'
        ? { texto: '⏸️ Seus descontos SECI estão pausados. Veja como resolver.', cta: 'Ver', to: '/meu' }
        : situacao === 'inativo'
          ? null
          : { texto: '💡 É do comércio? Ative seu desconto SECI!', cta: 'Ativar', to: '/meu' };
  if (!conteudo) return null;

  function fechar() {
    setFechado(true);
    try { sessionStorage.setItem(CHAVE, '1'); } catch { /* sem storage: só some nesta tela */ }
  }

  return (
    <div className="w-full bg-violet-50 border-b border-violet-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-2 flex items-center gap-3">
        <p className="flex-1 min-w-0 text-xs sm:text-sm font-semibold" style={{ color: ROXO }}>{conteudo.texto}</p>
        <Link to={conteudo.to} className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: ROXO }}>
          {conteudo.cta}
        </Link>
        <button type="button" onClick={fechar} aria-label="Fechar" className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-violet-400 hover:text-violet-700">
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
