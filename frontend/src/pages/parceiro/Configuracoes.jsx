import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Loader2, ShieldAlert, Bell as BellIcon, User, CreditCard, AlertTriangle,
} from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';

const CARGOS = [
  ['dono', 'Dono(a)'], ['gerente', 'Gerente'], ['socio', 'Sócio(a)'], ['atendente', 'Atendente'], ['outro', 'Outro'],
];

const NOTIFICACOES_CONFIG = [
  { chave: 'novos_clientes_whatsapp', label: 'Novos clientes interessados nos meus produtos', desc: 'Avisamos no WhatsApp toda vez que alguém clicar pra falar com você.' },
  { chave: 'resumo_semanal_email', label: 'Resumo semanal de métricas', desc: 'Um e-mail toda semana com visualizações, cliques e destaques.' },
  { chave: 'novidades_iub_email', label: 'Novidades e atualizações do IUB MAIS', desc: 'Fique por dentro de novos recursos do marketplace.' },
  { chave: 'promocoes_expirando_whatsapp', label: 'Alertas de promoções expirando', desc: 'Um lembrete no WhatsApp antes de uma promoção sua terminar.' },
];

function maskPhone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function forcaSenha(senha) {
  if (!senha) return 0;
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/[0-9]/.test(senha) && /[^a-zA-Z0-9]/.test(senha)) pontos++;
  return Math.min(pontos, 3);
}

const PLANO_LABEL = { gratis: 'Grátis — Parceiro IUB', oficial: 'Oficial', premium: 'Premium', master: 'Master' };

export default function ParceiroConfiguracoes() {
  const { parceiro } = useOutletContext();
  const [conta, setConta] = useState(null);
  const [status, setStatus] = useState(parceiro?.status || 'ativo');
  const [interesses, setInteresses] = useState([]);

  useEffect(() => {
    apiParceiro.get('/parceiro/conta').then(res => setConta(res.data)).catch(() => toast.error('Erro ao carregar configurações'));
    apiParceiro.get('/parceiro/interessados').then(res => setInteresses(res.data.planos)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold" style={{ color: PRETO }}>Configurações</h1>

      <SecaoSenha />

      {conta && <SecaoNotificacoes preferencias={conta.preferencias_notificacao} />}

      {conta && <SecaoDadosConta conta={conta} onAtualizado={setConta} />}

      <SecaoPlano parceiro={parceiro} status={status} interesses={interesses} />

      <SecaoZonaPerigo status={status} onStatusMudou={setStatus} />
    </div>
  );
}

function Card({ titulo, icone: Icone, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 ${className}`}>
      <h2 className="flex items-center gap-2 text-lg font-bold mb-1" style={{ color: PRETO }}>
        {Icone && <Icone className="w-5 h-5" style={{ color: ROXO }} />} {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function CampoSenha({ label, value, onChange, mostrar, onToggleMostrar }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={mostrar ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${campoCls} pr-10`}
        />
        <button
          type="button" onClick={onToggleMostrar}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── 1. Senha e Segurança ────────────────────────────────────────────────

function SecaoSenha() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState({ atual: false, nova: false, confirmar: false });
  const [salvando, setSalvando] = useState(false);

  const forca = forcaSenha(senhaNova);
  const forcaLabel = ['Muito fraca', 'Fraca', 'Boa', 'Forte'][forca];
  const forcaCor = ['#EF4444', '#F97316', '#EAB308', '#16A34A'][forca];

  function validar() {
    if (!senhaAtual) return 'Informe sua senha atual';
    if (senhaNova.length < 8) return 'A nova senha precisa ter pelo menos 8 caracteres';
    if (!/[a-zA-Z]/.test(senhaNova) || !/[0-9]/.test(senhaNova)) return 'A nova senha precisa misturar letra e número';
    if (senhaNova === senhaAtual) return 'A nova senha precisa ser diferente da atual';
    if (senhaNova !== confirmar) return 'A confirmação não bate com a nova senha';
    return null;
  }

  async function handleSalvar() {
    const erro = validar();
    if (erro) return toast.error(erro);

    setSalvando(true);
    try {
      await apiParceiro.put('/parceiro/auth/senha', { senha_atual: senhaAtual, senha_nova: senhaNova });
      toast.success('Senha alterada com sucesso!');
      setSenhaAtual(''); setSenhaNova(''); setConfirmar('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card titulo="Senha e Segurança" icone={ShieldAlert}>
      <div className="space-y-4">
        <CampoSenha label="Senha atual" value={senhaAtual} onChange={setSenhaAtual} mostrar={mostrar.atual} onToggleMostrar={() => setMostrar(m => ({ ...m, atual: !m.atual }))} />
        <div>
          <CampoSenha label="Nova senha" value={senhaNova} onChange={setSenhaNova} mostrar={mostrar.nova} onToggleMostrar={() => setMostrar(m => ({ ...m, nova: !m.nova }))} />
          {senhaNova && (
            <div className="mt-1.5">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i <= forca ? forcaCor : '#E2E8F0' }} />
                ))}
              </div>
              <p className="text-[11px] mt-1" style={{ color: forcaCor }}>{forcaLabel}</p>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-1">Mínimo 8 caracteres, com letra e número.</p>
        </div>
        <CampoSenha label="Confirmar nova senha" value={confirmar} onChange={setConfirmar} mostrar={mostrar.confirmar} onToggleMostrar={() => setMostrar(m => ({ ...m, confirmar: !m.confirmar }))} />

        <button
          type="button" onClick={handleSalvar} disabled={salvando}
          className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
          style={{ backgroundColor: ROXO }}
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Alterar senha
        </button>
      </div>
    </Card>
  );
}

// ─── 2. Notificações ─────────────────────────────────────────────────────

function Toggle({ ligado, onToggle, disabled }) {
  return (
    <button
      type="button" onClick={onToggle} disabled={disabled}
      aria-pressed={ligado}
      className="relative w-10 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: ligado ? ROXO : '#E2E8F0' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: ligado ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

function SecaoNotificacoes({ preferencias }) {
  const [prefs, setPrefs] = useState(preferencias);
  const [salvandoChave, setSalvandoChave] = useState(null);

  async function alternar(chave) {
    const novasPrefs = { ...prefs, [chave]: !prefs[chave] };
    setPrefs(novasPrefs);
    setSalvandoChave(chave);
    try {
      await apiParceiro.put('/parceiro/notificacoes', { preferencias: novasPrefs });
      toast('Preferência atualizada', { icon: '🔔', duration: 1800 });
    } catch {
      setPrefs(prefs);
      toast.error('Erro ao salvar preferência');
    } finally {
      setSalvandoChave(null);
    }
  }

  return (
    <Card titulo="Notificações" icone={BellIcon}>
      <div className="space-y-4">
        {NOTIFICACOES_CONFIG.map(n => (
          <div key={n.chave} className="flex items-start justify-between gap-4 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: PRETO }}>{n.label}</p>
              <p className="text-slate-400 text-xs mt-0.5">{n.desc}</p>
            </div>
            {salvandoChave === n.chave ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-300 mt-1 flex-shrink-0" />
            ) : (
              <Toggle ligado={!!prefs[n.chave]} onToggle={() => alternar(n.chave)} />
            )}
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 pt-1 opacity-50">
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: PRETO }}>Novos comentários ou avaliações</p>
            <p className="text-slate-400 text-xs mt-0.5">Em breve — ainda não temos avaliações no marketplace.</p>
          </div>
          <Toggle ligado={false} disabled />
        </div>
      </div>
    </Card>
  );
}

// ─── 3. Dados da conta ───────────────────────────────────────────────────

function SecaoDadosConta({ conta, onAtualizado }) {
  const [form, setForm] = useState({
    nome: conta.nome || '', email: conta.email || '', cargo: conta.cargo || 'dono', whatsapp_pessoal: conta.whatsapp_pessoal ? maskPhone(conta.whatsapp_pessoal) : '',
  });
  const [salvando, setSalvando] = useState(false);

  function setCampo(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

  function validar() {
    if (form.nome.trim().length < 3) return 'Nome precisa ter pelo menos 3 caracteres';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'E-mail inválido';
    return null;
  }

  async function handleSalvar() {
    const erro = validar();
    if (erro) return toast.error(erro);

    setSalvando(true);
    try {
      const res = await apiParceiro.put('/parceiro/dados-conta', {
        nome: form.nome.trim(), email: form.email.trim().toLowerCase(), cargo: form.cargo, whatsapp_pessoal: form.whatsapp_pessoal,
      });
      if (res.data.email_pendente) {
        toast.success(`Enviamos um link de confirmação pra ${res.data.email_pendente}. Seu login continua o mesmo até você confirmar.`, { duration: 6000 });
        onAtualizado(c => ({ ...c, email_pendente: res.data.email_pendente }));
      } else {
        toast.success('Dados atualizados!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar dados');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card titulo="Dados da Minha Conta" icone={User}>
      {conta.email_pendente && (
        <p className="text-xs bg-amber-50 text-amber-700 rounded-xl px-3 py-2 mb-4">
          Confirmação pendente pra <strong>{conta.email_pendente}</strong> — confira sua caixa de entrada.
        </p>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nome completo</label>
          <input value={form.nome} onChange={e => setCampo('nome', e.target.value)} className={campoCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">E-mail de contato</label>
          <input type="email" value={form.email} onChange={e => setCampo('email', e.target.value)} className={campoCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Cargo</label>
            <select value={form.cargo} onChange={e => setCampo('cargo', e.target.value)} className={campoCls}>
              {CARGOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">WhatsApp pessoal</label>
            <input value={form.whatsapp_pessoal} onChange={e => setCampo('whatsapp_pessoal', maskPhone(e.target.value))} className={campoCls} placeholder="(64) 90000-0000" />
          </div>
        </div>
        <button
          type="button" onClick={handleSalvar} disabled={salvando}
          className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
          style={{ backgroundColor: ROXO }}
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar alterações
        </button>
      </div>
    </Card>
  );
}

// ─── 4. Assinatura ───────────────────────────────────────────────────────

function SecaoPlano({ parceiro, status, interesses }) {
  const planoInteresse = interesses[0];

  return (
    <Card titulo="Assinatura" icone={CreditCard}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-bold text-base" style={{ color: PRETO }}>{PLANO_LABEL[parceiro?.plano] || 'Grátis — Parceiro IUB'}</p>
          <p className="text-slate-500 text-xs mt-1">
            Cadastrado em {parceiro?.created_at ? new Date(parceiro.created_at).toLocaleDateString('pt-BR') : '—'}
          </p>
          <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {status === 'ativo' ? 'Ativo' : 'Pausado'}
          </span>
          {planoInteresse && (
            <p className="text-xs mt-2" style={{ color: '#92700C' }}>
              🔔 Aguardando lançamento do {PLANO_LABEL[planoInteresse] || planoInteresse}
            </p>
          )}
        </div>
        <Link
          to="/parceiro/painel/planos"
          className="text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors hover:bg-slate-50 flex-shrink-0"
          style={{ borderColor: ROXO, color: ROXO }}
        >
          Ver todos os planos
        </Link>
      </div>
    </Card>
  );
}

// ─── 5. Zona de perigo ───────────────────────────────────────────────────

function SecaoZonaPerigo({ status, onStatusMudou }) {
  const [modal, setModal] = useState(null); // 'pausar' | 'excluir' | null

  return (
    <Card titulo="Zona de Perigo" icone={AlertTriangle} className="border-red-100 bg-red-50/40">
      <p className="text-slate-500 text-sm mb-5">Ações irreversíveis. Prossiga com cuidado.</p>
      <div className="flex flex-col gap-3">
        {status === 'ativo' ? (
          <button
            type="button" onClick={() => setModal('pausar')}
            className="text-sm font-semibold px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            Pausar minha conta temporariamente
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              try { await apiParceiro.post('/parceiro/conta/reativar'); onStatusMudou('ativo'); toast.success('Conta reativada!'); }
              catch { toast.error('Erro ao reativar conta'); }
            }}
            className="text-sm font-semibold px-5 py-3 rounded-xl text-white transition-colors text-left"
            style={{ backgroundColor: ROXO }}
          >
            Reativar minha conta
          </button>
        )}
        <button
          type="button" onClick={() => setModal('excluir')}
          className="text-sm font-semibold px-5 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-left"
        >
          Excluir minha conta permanentemente
        </button>
      </div>

      {modal === 'pausar' && (
        <ModalPausar
          onCancelar={() => setModal(null)}
          onConfirmado={() => { onStatusMudou('pausado'); setModal(null); }}
        />
      )}
      {modal === 'excluir' && <ModalExcluir onCancelar={() => setModal(null)} />}
    </Card>
  );
}

function ModalPausar({ onCancelar, onConfirmado }) {
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!senha) return toast.error('Informe sua senha');
    setEnviando(true);
    try {
      await apiParceiro.post('/parceiro/conta/pausar', { senha });
      toast.success('Conta pausada. Seu perfil ficou oculto no marketplace.');
      onConfirmado();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao pausar conta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={onCancelar}>
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold" style={{ color: PRETO }}>Pausar minha conta?</h2>
        <p className="text-slate-600 text-sm mt-2">Ao pausar, seu perfil e produtos ficarão ocultos no marketplace. Você pode reativar quando quiser, direto por aqui.</p>
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Confirme sua senha</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className={campoCls} />
        </div>
        <div className="flex flex-col gap-2 mt-5">
          <button type="button" onClick={confirmar} disabled={enviando} className="flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white bg-slate-800 hover:bg-slate-900 transition-colors disabled:opacity-60">
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Pausar minha conta
          </button>
          <button type="button" onClick={onCancelar} disabled={enviando} className="text-sm font-semibold py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalExcluir({ onCancelar }) {
  const [senha, setSenha] = useState('');
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const habilitado = confirmacaoTexto.trim().toUpperCase() === 'EXCLUIR' && senha;

  async function confirmar() {
    if (!habilitado) return;
    setEnviando(true);
    try {
      const res = await apiParceiro.post('/parceiro/conta/solicitar-exclusao', { senha });
      setEnviado(true);
      toast.success(res.data.message || 'Verifique seu e-mail pra confirmar.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao solicitar exclusão');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15,15,20,0.7)' }} onClick={enviando ? undefined : onCancelar}>
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        {enviado ? (
          <div className="text-center py-2">
            <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
            <h2 className="text-lg font-extrabold mt-3" style={{ color: PRETO }}>Verifique seu e-mail</h2>
            <p className="text-slate-600 text-sm mt-2">
              Mandamos um link de confirmação. Por segurança, ele só funciona depois de <strong>24 horas</strong> — dá tempo de mudar de ideia, é só não clicar.
            </p>
            <button type="button" onClick={onCancelar} className="mt-5 text-sm font-semibold px-6 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              Entendi
            </button>
          </div>
        ) : (
          <>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-red-600">
              <AlertTriangle className="w-5 h-5" /> Atenção! Isso é irreversível!
            </h2>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-3">
              <p className="text-red-700 text-sm font-semibold">Serão apagados permanentemente:</p>
              <ul className="text-red-700 text-xs mt-1.5 space-y-0.5 list-disc list-inside">
                <li>Todos os produtos</li>
                <li>Todas as promoções</li>
                <li>Todo o histórico</li>
                <li>Todas as fotos</li>
              </ul>
              <p className="text-red-700 text-xs font-semibold mt-2">Você não poderá recuperar depois.</p>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Digite <strong>EXCLUIR</strong> pra confirmar
              </label>
              <input value={confirmacaoTexto} onChange={e => setConfirmacaoTexto(e.target.value)} className={campoCls} placeholder="EXCLUIR" />
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Confirme sua senha</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className={campoCls} />
            </div>

            <div className="flex flex-col gap-2 mt-5">
              <button
                type="button" onClick={confirmar} disabled={!habilitado || enviando}
                className="flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Excluir minha conta permanentemente
              </button>
              <button type="button" onClick={onCancelar} disabled={enviando} className="text-sm font-semibold py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
