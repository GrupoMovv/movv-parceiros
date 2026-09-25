import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, WhatsappLogo, Eye, EyeSlash, CircleNotch } from '@phosphor-icons/react';
import { MASCOTE_URL } from '../../../components/MascoteIubMais';
import { ROXO, ROXO_ESCURO } from '../Marketplace/theme';
import { CONTATO_IUB, linkWhatsappIub, MSG_WHATSAPP_SUPORTE } from '../../../config/contato';

// Casca comum das telas do primeiro acesso: fundo roxo, "Voltar" e WhatsApp
// sempre visíveis no topo, conteúdo num cartão branco. Mobile-first — no
// desktop só centraliza numa coluna estreita.
export function CascaAcesso({ titulo, subtitulo, onVoltar, voltarPara = '/marketplace', mensagemWhatsapp, mascote = false, children }) {
  const navigate = useNavigate();
  const voltar = onVoltar || (() => navigate(voltarPara));

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 pt-4 pb-10"
      style={{ background: `linear-gradient(160deg, ${ROXO_ESCURO} 0%, ${ROXO} 55%, #2D0A5C 100%)` }}
    >
      <div className="w-full max-w-[460px] flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={voltar}
            className="inline-flex items-center gap-1.5 text-white font-semibold text-sm min-h-[44px] px-3 -ml-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={18} weight="bold" /> Voltar
          </button>
          <BotaoWhatsapp mensagem={mensagemWhatsapp} compacto />
        </div>

        <div className="text-center mt-2">
          {mascote && (
            <img src={MASCOTE_URL} alt="" className="h-16 sm:h-20 mx-auto object-contain" style={{ filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.35))' }} />
          )}
          {titulo && (
            <h1 className="text-white font-black text-2xl sm:text-3xl mt-2 leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {titulo}
            </h1>
          )}
          {subtitulo && <p className="text-white/75 text-sm mt-2">{subtitulo}</p>}
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Cartao({ children, className = '' }) {
  return <div className={`bg-white rounded-3xl p-5 sm:p-6 shadow-2xl ${className}`}>{children}</div>;
}

export function BotaoWhatsapp({ mensagem = MSG_WHATSAPP_SUPORTE, compacto = false, children }) {
  const href = linkWhatsappIub(mensagem);
  if (compacto) {
    return (
      <a
        href={href} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-white text-xs font-bold rounded-full px-3 min-h-[36px]"
        style={{ backgroundColor: '#25D366' }}
      >
        <WhatsappLogo size={18} weight="fill" /> Ajuda
      </a>
    );
  }
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl font-bold text-white text-base"
      style={{ backgroundColor: '#25D366' }}
    >
      <WhatsappLogo size={22} weight="fill" /> {children || `Falar no WhatsApp ${CONTATO_IUB.whatsappExibicao}`}
    </a>
  );
}

export function BotaoPrimario({ children, carregando, disabled, type = 'submit', onClick }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || carregando}
      className="w-full min-h-[56px] flex items-center justify-center gap-2 rounded-2xl font-black text-base text-white transition-opacity disabled:opacity-50"
      style={{ backgroundColor: ROXO }}
    >
      {carregando ? <CircleNotch size={22} className="animate-spin" /> : children}
    </button>
  );
}

export function BotaoSecundario({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl font-bold text-base border-2"
      style={{ borderColor: ROXO, color: ROXO }}
    >
      {children}
    </button>
  );
}

export function Campo({ label, erro, dica, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {erro ? <p className="text-red-600 text-xs mt-1">{erro}</p> : dica ? <p className="text-slate-400 text-xs mt-1">{dica}</p> : null}
    </div>
  );
}

export function InputSenha({ value, onChange, placeholder, autoComplete = 'new-password' }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input
        type={ver ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="input pr-12"
      />
      <button
        type="button"
        onClick={() => setVer(v => !v)}
        aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400"
      >
        {ver ? <EyeSlash size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}

export function Aviso({ tipo = 'info', titulo, children }) {
  const cores = {
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    alerta: 'bg-amber-50 border-amber-200 text-amber-900',
    erro: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-violet-50 border-violet-200 text-violet-900',
  };
  return (
    <div className={`border rounded-2xl p-4 ${cores[tipo]}`}>
      {titulo && <p className="font-bold text-base leading-snug">{titulo}</p>}
      {children && <div className="text-sm mt-1 leading-relaxed">{children}</div>}
    </div>
  );
}
