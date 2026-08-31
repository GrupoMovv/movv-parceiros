import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { Loader2, AlertCircle, ShieldCheck, ShieldX, Send } from 'lucide-react';
import api, { assetUrl } from '../../services/api';

const PARCEIROS = [
  'NOSSA DROGARIA', 'ACADEMIA ATLÉTICA', 'DIROMA FIORI', 'ÓTICAS DINIZ',
  'EZÉQUIEL REIS NUTRICIONISTA', 'PLENITUDE PSICOLOGIA', 'NESPLORA',
  'LAURA CLEMENTE ESTETA', 'STUDIO VIP',
];

const CATEGORIA_LABEL = {
  'Empregado': 'Empregado',
  'Empregador patronal': 'Empregador',
  'Profissional liberal': 'Liberal',
};

const AVATAR_CORES = ['#0C2D48', '#1D4E89', '#2E6F95', '#6A4C93', '#B5484D', '#118AB2', '#3D7A5C', '#8B5A2B'];

function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function corAvatar(nome) {
  let hash = 0;
  for (const ch of String(nome || '')) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return AVATAR_CORES[Math.abs(hash) % AVATAR_CORES.length];
}

function fmtData(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export default function Carteirinha() {
  const { hash } = useParams();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [naoEncontrada, setNaoEncontrada] = useState(false);

  const [registrando, setRegistrando] = useState(false);
  const [parceiroEscolhido, setParceiroEscolhido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [usoRegistrado, setUsoRegistrado] = useState(false);

  useEffect(() => {
    api.get(`/public/carteirinha/${hash}`)
      .then(res => setDados(res.data))
      .catch(() => setNaoEncontrada(true))
      .finally(() => setLoading(false));
  }, [hash]);

  async function handleRegistrarUso() {
    if (!parceiroEscolhido) return;
    setEnviando(true);
    try {
      await api.post(`/public/carteirinha/${hash}/registrar-uso`, { parceiro_nome: parceiroEscolhido });
      setUsoRegistrado(true);
      setRegistrando(false);
      toast.success('Uso registrado!');
    } catch {
      toast.error('Erro ao registrar uso. Tente novamente.');
    } finally { setEnviando(false); }
  }

  if (loading) {
    return (
      <PageShell>
        <Loader2 className="w-8 h-8 animate-spin text-white/70" />
      </PageShell>
    );
  }

  if (naoEncontrada || !dados) {
    return (
      <PageShell>
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h1 className="text-lg font-bold text-slate-800">Carteirinha não encontrada</h1>
          <p className="text-slate-500 text-sm">Confira se o link/QR Code está correto ou procure o Sindicato pra emitir uma nova.</p>
        </div>
      </PageShell>
    );
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const validaAteDate = dados.valida_ate ? new Date(dados.valida_ate) : null;
  const vencida = !dados.ativo || !validaAteDate || validaAteDate < hoje;
  const ehDependente = dados.tipo === 'dependente';
  const categoriaLabel = CATEGORIA_LABEL[dados.categoria] || dados.categoria;

  return (
    <PageShell>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Topo */}
        <div className="px-6 pt-6 pb-8 text-center" style={{ background: 'linear-gradient(160deg, #0B1F3A 0%, #1D4E89 100%)' }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo-header.png" alt="" className="h-6 w-auto opacity-90" />
            <span className="text-white/80 text-xs font-bold tracking-widest uppercase">SECI</span>
          </div>
          <p className="text-white/60 text-[10px] font-semibold tracking-[0.2em] uppercase mb-4">Carteirinha do Associado</p>

          {dados.foto_url ? (
            <img
              src={assetUrl(dados.foto_url)} alt={dados.nome}
              className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white/30 shadow-lg"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold border-4 border-white/30 shadow-lg"
              style={{ backgroundColor: corAvatar(dados.nome) }}
            >
              {iniciais(dados.nome)}
            </div>
          )}

          <h1 className="text-white font-bold text-xl mt-3 leading-tight">{dados.nome}</h1>

          {ehDependente ? (
            <div className="mt-2 space-y-1">
              <span className="inline-block text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-white/15 text-white">
                Dependente
              </span>
              <p className="text-white/70 text-xs">Titular: {dados.titular_nome}</p>
            </div>
          ) : (
            categoriaLabel && (
              <span
                className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: '#B8E62C', color: '#0B1F3A' }}
              >
                {categoriaLabel}
              </span>
            )
          )}
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-4">
          {dados.empresa && (
            <div className="text-center">
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">Empresa</p>
              <p className="text-slate-800 font-semibold text-sm">{dados.empresa}</p>
            </div>
          )}

          {dados.numero_associado && (
            <div className="text-center">
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">Nº do Associado</p>
              <p className="text-slate-800 font-mono font-semibold text-sm">{dados.numero_associado}</p>
            </div>
          )}

          <div className="flex justify-center py-2">
            <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <QRCodeSVG value={window.location.href} size={140} fgColor="#0B1F3A" />
            </div>
          </div>

          <p className="text-center text-slate-500 text-xs">
            {vencida ? 'Validade expirada em' : 'Válida até'} <strong className="text-slate-700">{fmtData(dados.valida_ate)}</strong>
          </p>

          {vencida ? (
            <p className="text-center text-red-600 text-xs font-semibold bg-red-50 rounded-xl py-2 px-3">
              Renovação pendente — procure o Sindicato
            </p>
          ) : (
            <div>
              {!usoRegistrado ? (
                registrando ? (
                  <div className="space-y-2">
                    <select
                      className="input text-sm"
                      value={parceiroEscolhido}
                      onChange={e => setParceiroEscolhido(e.target.value)}
                      autoFocus
                    >
                      <option value="">Selecione o parceiro...</option>
                      {PARCEIROS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setRegistrando(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                      <button
                        onClick={handleRegistrarUso}
                        disabled={!parceiroEscolhido || enviando}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Confirmar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setRegistrando(true)}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-colors"
                  >
                    <Send className="w-4 h-4" /> REGISTRAR USO
                  </button>
                )
              ) : (
                <p className="text-center text-emerald-700 text-xs font-semibold bg-emerald-50 rounded-xl py-2 px-3">
                  Uso registrado em {parceiroEscolhido}. Obrigado!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Barra inferior de status */}
        <div
          className={`flex items-center justify-center gap-2 py-2.5 font-bold text-xs tracking-widest ${
            vencida ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
          }`}
        >
          {vencida ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          {vencida ? 'VENCIDO' : 'ATIVO'}
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #0B1F3A 0%, #1D4E89 60%, #2E6F95 100%)' }}
    >
      {children}
    </div>
  );
}
