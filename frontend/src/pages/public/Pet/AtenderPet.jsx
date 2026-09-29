import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import apiParceiro, { getParceiroToken } from '../../../services/apiParceiro';
import { emojiEspecie } from '../../../utils/pet';
import { ROXO } from '../Marketplace/theme';

// Pet parte 5 — /atender/:token = QR do PET. O pet shop aponta a câmera do
// celular (já logado no painel) e registra o atendimento; carimbo na hora.
// Quem não é pet shop logado vê só uma explicação (nada do pet vaza).
export default function AtenderPet() {
  const { token } = useParams();
  const logadoLoja = Boolean(getParceiroToken());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);
  const [servico, setServico] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(null);

  function carregar() {
    apiParceiro.get(`/parceiro/pet-fidelidade/qr/${token}`)
      .then(r => { setD(r.data); if (r.data.servicos.length === 1) setServico(r.data.servicos[0].codigo); })
      .catch(err => setErro(err.response?.data?.error || 'Não deu pra ler esse QR'));
  }
  useEffect(() => { if (logadoLoja) carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function registrar() {
    setEnviando(true);
    try {
      const r = await apiParceiro.post('/parceiro/pet-fidelidade/atendimentos', { pet_token: token, servico });
      setFeito(r.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao registrar'); } finally { setEnviando(false); }
  }
  async function resgatar(p) {
    if (!window.confirm(`Entregar "${p.premio_texto}" agora?`)) return;
    try { await apiParceiro.post(`/parceiro/pet-fidelidade/premios/${p.id}/resgatar`); toast.success('Prêmio resgatado!'); carregar(); } catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }

  const casca = conteudo => (
    <div className="min-h-screen bg-gradient-to-br from-iub-roxo to-iub-roxo-escuro px-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-3xl p-6 shadow-xl">{conteudo}</div>
    </div>
  );

  if (!logadoLoja) {
    return casca(
      <div className="text-center space-y-3">
        <p className="text-4xl">🐾</p>
        <h1 className="font-black text-lg" style={{ color: ROXO }}>QR do pet no IUB MAIS+</h1>
        <p className="text-sm text-slate-600">Este QR serve pro <strong>pet shop</strong> registrar o atendimento e dar o carimbo no cartão fidelidade.</p>
        <p className="text-sm text-slate-600">É o pet shop? Entre no seu painel e leia de novo.</p>
        <Link to={`/entrar?voltar=${encodeURIComponent(`/atender/${token}`)}`} className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Entrar como pet shop</Link>
      </div>
    );
  }
  if (erro) return casca(<p className="text-center text-sm text-red-700">{erro}</p>);
  if (!d) return casca(<div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>);

  const premios = d.fidelidade.premios.filter(p => !p.resgatado_em && new Date(p.expira_em) > new Date());
  if (feito) {
    const f = feito.fidelidade;
    return casca(
      <div className="text-center space-y-3">
        <p className="text-4xl">✅</p>
        <h1 className="font-black text-lg" style={{ color: ROXO }}>Atendimento do {d.pet.nome} registrado!</h1>
        {f?.premio ? <p className="text-sm font-bold text-green-700">🎁 Cartão completo! {d.pet.dono} ganhou: {f.premio.premio_texto}</p>
          : f ? <p className="text-sm text-slate-600">🎟️ Cartão: {f.carimbos}/{f.meta} — faltam {f.meta - f.carimbos} pra “{f.cartao.premio}”</p>
          : <p className="text-sm text-slate-500">Você não tem cartão fidelidade ativo — o atendimento ficou registrado.</p>}
        <p className="text-xs text-slate-400">{feito.whatsapp_avisado ? `${d.pet.dono} recebeu o aviso no WhatsApp.` : ''}</p>
        <Link to="/parceiro/painel/fidelidade" className="inline-block text-sm font-bold underline" style={{ color: ROXO }}>Ir pra Fidelidade</Link>
      </div>
    );
  }

  return casca(
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center text-3xl flex-shrink-0">
          {d.pet.foto_url ? <img src={d.pet.foto_url} alt="" className="w-full h-full object-cover" /> : emojiEspecie(d.pet.especie)}
        </div>
        <div>
          <p className="font-black text-lg" style={{ color: ROXO }}>{d.pet.nome}</p>
          <p className="text-xs text-slate-500">{d.pet.resumo} · tutor(a): {d.pet.dono}</p>
        </div>
      </div>
      {d.fidelidade.cartoes.map(c => (
        <div key={c.id} className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold text-slate-600">🎟️ {c.servico ? d.servicos.find(s => s.codigo === c.servico)?.nome : 'Cartão geral'}: {c.carimbos}/{c.meta} → {c.premio}</p>
          <div className="flex gap-1 mt-1.5">{Array.from({ length: c.meta }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < c.carimbos ? 'bg-amber-400' : 'bg-slate-200'}`} />)}</div>
        </div>
      ))}
      {premios.map(p => (
        <div key={p.id} className="rounded-xl border-2 border-green-200 px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-green-800">🎁 {p.premio_texto}</p>
          <button type="button" onClick={() => resgatar(p)} className="text-xs font-bold px-3 py-1.5 rounded-lg text-white bg-green-600">Resgatar</button>
        </div>
      ))}
      {d.atendimento_hoje ? (
        <p className="text-sm text-center text-slate-600 bg-slate-50 rounded-xl py-3">✅ O atendimento de hoje do {d.pet.nome} já está registrado.</p>
      ) : d.servicos.length === 0 ? (
        <p className="text-sm text-slate-500">Seu cadastro não tem serviço de atendimento pet (banho, veterinária…).</p>
      ) : (
        <>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" value={servico} onChange={e => setServico(e.target.value)} aria-label="Serviço feito">
            <option value="">Qual serviço foi feito?</option>
            {d.servicos.map(s => <option key={s.codigo} value={s.codigo}>{s.emoji} {s.nome}</option>)}
          </select>
          <button type="button" onClick={registrar} disabled={!servico || enviando} className="w-full py-3 rounded-xl font-black text-white disabled:opacity-40" style={{ backgroundColor: ROXO }}>
            {enviando ? 'Registrando…' : '✅ Registrar atendimento'}
          </button>
        </>
      )}
    </div>
  );
}
