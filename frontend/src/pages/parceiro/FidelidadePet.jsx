import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Plus, Printer, Trash2 } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';
import { dataBR } from '../../utils/pet';

// Pet parte 5 — painel do pet shop: cartão fidelidade (definido aqui),
// QR do balcão (o cliente lê com a câmera), atendimentos que o cliente
// registrou pelo QR (confirmar/recusar) e prêmios pra resgatar.
export default function FidelidadePet() {
  const [d, setD] = useState(null);
  const [cartoes, setCartoes] = useState([]);
  const [salvando, setSalvando] = useState(false);

  function aplicar(dados) {
    setD(dados);
    setCartoes(dados.cartoes.filter(c => c.ativo).map(c => ({ servico: c.servico || '', meta: String(c.meta), premio: c.premio })));
  }
  useEffect(() => {
    apiParceiro.get('/parceiro/pet-fidelidade').then(r => aplicar(r.data)).catch(() => toast.error('Erro ao carregar'));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await apiParceiro.put('/parceiro/pet-fidelidade/cartoes', { cartoes: cartoes.map(c => ({ servico: c.servico || null, meta: Number(c.meta), premio: c.premio })) });
      aplicar(r.data);
      toast.success('Cartões salvos!');
    } catch (err) { toast.error(err.response?.data?.error || 'Erro ao salvar'); } finally { setSalvando(false); }
  }
  async function acao(url, msg) {
    try { aplicar((await apiParceiro.post(url)).data); toast.success(msg); } catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  }

  if (!d) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;
  const linkBalcao = `${window.location.origin}/balcao/${d.qr_token}`;
  const nomeServico = c => d.servicos.find(s => s.codigo === c)?.nome || 'Todos os serviços';
  const usados = new Set(cartoes.map(c => c.servico));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>🎟️ Fidelidade & QR</h1>
        <p className="text-sm text-slate-500 mt-1">Cada atendimento registrado vira um carimbo no cartão do pet. Cartão completo = prêmio (vale 90 dias).</p>
      </div>

      {(d.aguardando.length > 0 || d.premios.length > 0) && (
        <section className="space-y-3">
          {d.aguardando.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border-2 border-amber-200 p-4">
              <p className="text-sm font-bold" style={{ color: PRETO }}>📲 {a.cliente} registrou pelo QR do balcão</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.pet_nome} ({a.pet_resumo}) · {nomeServico(a.servico)} · {dataBR(a.dia)}</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => acao(`/parceiro/pet-fidelidade/atendimentos/${a.id}/confirmar`, 'Atendimento confirmado — carimbo dado!')} className="flex-1 text-sm font-bold py-2 rounded-xl text-white bg-green-600">✅ Foi atendido aqui</button>
                <button type="button" onClick={() => window.confirm('Recusar? O cliente não ganha carimbo.') && acao(`/parceiro/pet-fidelidade/atendimentos/${a.id}/recusar`, 'Registro recusado')} className="text-sm font-semibold py-2 px-4 rounded-xl border border-slate-200 text-slate-500">Não foi</button>
              </div>
            </div>
          ))}
          {d.premios.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border-2 border-green-200 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: PRETO }}>🎁 {p.pet_nome} ({p.cliente}) ganhou: {p.premio_texto}</p>
                <p className="text-xs text-slate-500">Vale até {new Date(p.expira_em).toLocaleDateString('pt-BR')}</p>
              </div>
              <button type="button" onClick={() => window.confirm(`Entregar "${p.premio_texto}" pro ${p.pet_nome} agora?`) && acao(`/parceiro/pet-fidelidade/premios/${p.id}/resgatar`, 'Prêmio resgatado!')} className="flex-shrink-0 text-sm font-bold py-2 px-4 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Resgatar</button>
            </div>
          ))}
        </section>
      )}

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold" style={{ color: PRETO }}>Cartões fidelidade</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Um cartão por serviço, ou um geral que vale pros serviços sem cartão próprio. Conta por pet.</p>
        {cartoes.length === 0 && <p className="text-sm text-slate-400 mb-3">Nenhum cartão ativo — atendimentos são registrados, mas sem carimbo.</p>}
        <div className="space-y-3">
          {cartoes.map((c, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-[1fr_90px_1.3fr_auto] gap-2 items-end">
              <label className="text-[11px] font-semibold text-slate-500">Serviço
                <select className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm bg-white" value={c.servico} onChange={e => setCartoes(cs => cs.map((x, j) => (j === i ? { ...x, servico: e.target.value } : x)))}>
                  <option value="" disabled={usados.has('') && c.servico !== ''}>Todos os serviços (geral)</option>
                  {d.servicos.map(s => <option key={s.codigo} value={s.codigo} disabled={usados.has(s.codigo) && c.servico !== s.codigo}>{s.emoji} {s.nome}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-slate-500">Atendimentos
                <input type="number" min={2} max={30} className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" value={c.meta} onChange={e => setCartoes(cs => cs.map((x, j) => (j === i ? { ...x, meta: e.target.value } : x)))} />
              </label>
              <label className="text-[11px] font-semibold text-slate-500">Prêmio
                <input className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" maxLength={120} value={c.premio} placeholder="Ex.: Banho grátis" onChange={e => setCartoes(cs => cs.map((x, j) => (j === i ? { ...x, premio: e.target.value } : x)))} />
              </label>
              <button type="button" onClick={() => setCartoes(cs => cs.filter((_, j) => j !== i))} aria-label="Tirar cartão" className="p-2 rounded-lg text-red-500 hover:bg-red-50 justify-self-end"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {cartoes.length < d.servicos.length + 1 && (
            <button type="button" onClick={() => {
              const livre = ['', ...d.servicos.map(s => s.codigo)].find(s => !usados.has(s));
              setCartoes(cs => [...cs, { servico: livre ?? '', meta: '10', premio: '' }]);
            }} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-600"><Plus className="w-4 h-4" /> Adicionar cartão</button>
          )}
          <button type="button" onClick={salvar} disabled={salvando} className="text-sm font-bold px-5 py-2 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: ROXO }}>{salvando ? 'Salvando…' : 'Salvar cartões'}</button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold" style={{ color: PRETO }}>QR do balcão</h2>
        <p className="text-xs text-slate-500 mt-1">Imprima e deixe no balcão. O cliente aponta a câmera, escolhe o pet e o serviço — e você confirma aqui (só aí conta o carimbo).</p>
        <p className="text-xs text-slate-500 mt-1">Pra registrar pelo lado de cá: aponte a câmera do celular pro <strong>QR do pet</strong> (fica no app do cliente, em Meus Pets) — o carimbo sai na hora.</p>
        <div id="qr-balcao" className="mt-4 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-5">
          <p className="font-black text-lg" style={{ color: ROXO }}>🐾 Registre seu atendimento</p>
          <QRCodeSVG value={linkBalcao} size={200} level="M" includeMargin />
          <p className="text-xs text-slate-500 text-center">Aponte a câmera do celular · IUB MAIS+</p>
        </div>
        <button type="button" onClick={() => window.print()} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600"><Printer className="w-4 h-4" /> Imprimir</button>
      </section>

      {d.recentes.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold mb-3" style={{ color: PRETO }}>Atendimentos registrados</h2>
          <ul className="divide-y divide-slate-100">
            {d.recentes.map(a => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{a.pet_nome} <span className="text-slate-400">· {a.cliente} · {nomeServico(a.servico)}</span></span>
                <span className="text-xs text-slate-500 flex-shrink-0">{dataBR(a.dia)} · {{ confirmado: '✅', contestado: '⚠️ contestado', recusado: '❌ recusado' }[a.status] || a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
