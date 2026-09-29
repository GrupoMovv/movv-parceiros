import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import { emojiEspecie } from '../../../utils/pet';
import { ROXO } from '../Marketplace/theme';

// Pet parte 5 — /balcao/:token = QR do PET SHOP (fica no balcão). O cliente
// aponta a câmera, escolhe o pet e o serviço; o registro fica aguardando o
// pet shop confirmar — só aí vira carimbo.
export default function BalcaoPet() {
  const { token } = useParams();
  const logado = Boolean(getPainelToken());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);
  const [petId, setPetId] = useState('');
  const [servico, setServico] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    if (!logado) return;
    apiPainel.get(`/public/meus-pets/loja/${token}`).then(r => {
      setD(r.data);
      if (r.data.pets.length === 1) setPetId(r.data.pets[0].id);
      if (r.data.servicos.length === 1) setServico(r.data.servicos[0].codigo);
    }).catch(err => setErro(err.response?.data?.error || 'Não deu pra ler esse QR'));
  }, [token, logado]);

  async function registrar() {
    setEnviando(true);
    try {
      await apiPainel.post('/public/meus-pets/atendimentos', { loja_token: token, pet_id: Number(petId), servico });
      setFeito(true);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao registrar'); } finally { setEnviando(false); }
  }

  const casca = conteudo => (
    <div className="min-h-screen bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro px-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-3xl p-6 shadow-xl">{conteudo}</div>
    </div>
  );

  if (!logado) {
    return casca(
      <div className="text-center space-y-3">
        <p className="text-4xl">🐾</p>
        <h1 className="font-black text-lg" style={{ color: ROXO }}>Registre o atendimento do seu pet</h1>
        <p className="text-sm text-slate-600">Entre na sua conta pra juntar carimbos no cartão fidelidade deste pet shop.</p>
        <Link to={`/entrar?voltar=${encodeURIComponent(`/balcao/${token}`)}`} className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Entrar ou criar conta grátis</Link>
      </div>
    );
  }
  if (erro) return casca(<p className="text-center text-sm text-red-700">{erro}</p>);
  if (!d) return casca(<div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>);
  if (feito) {
    return casca(
      <div className="text-center space-y-3">
        <p className="text-4xl">📲</p>
        <h1 className="font-black text-lg" style={{ color: ROXO }}>Enviado pro {d.loja.nome}!</h1>
        <p className="text-sm text-slate-600">O carimbo entra no cartão assim que o pet shop confirmar o atendimento.</p>
        <Link to="/meu/pets" className="inline-block text-sm font-bold underline" style={{ color: ROXO }}>Ver meus pets</Link>
      </div>
    );
  }
  if (!d.pets.length) {
    return casca(
      <div className="text-center space-y-3">
        <p className="text-sm text-slate-600">Cadastre seu pet primeiro — leva 1 minuto.</p>
        <Link to="/meu/pets?novo=1" className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>🐾 Cadastrar meu pet</Link>
      </div>
    );
  }

  return casca(
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs text-slate-500">Atendimento em</p>
        <h1 className="font-black text-lg" style={{ color: ROXO }}>{d.loja.nome}</h1>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Qual pet?</p>
        <div className="flex flex-wrap gap-2">
          {d.pets.map(p => (
            <button key={p.id} type="button" onClick={() => setPetId(p.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border-2"
              style={Number(petId) === p.id ? { borderColor: ROXO, color: ROXO } : { borderColor: '#E2E8F0', color: '#475569' }}>
              {emojiEspecie(p.especie)} {p.nome}
            </button>
          ))}
        </div>
      </div>
      <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={servico} onChange={e => setServico(e.target.value)} aria-label="Serviço">
        <option value="">Qual serviço?</option>
        {d.servicos.map(s => <option key={s.codigo} value={s.codigo}>{s.emoji} {s.nome}</option>)}
      </select>
      <button type="button" onClick={registrar} disabled={!petId || !servico || enviando} className="w-full py-3 rounded-xl font-black text-white disabled:opacity-40" style={{ backgroundColor: ROXO }}>
        {enviando ? 'Enviando…' : 'Registrar atendimento'}
      </button>
      <p className="text-[11px] text-center text-slate-400">O pet shop confirma e o carimbo entra no cartão do pet.</p>
    </div>
  );
}
