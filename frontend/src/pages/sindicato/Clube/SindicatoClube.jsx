import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Gem, Store, Users, FileSignature, ChevronDown, TrendingUp } from 'lucide-react';
import api from '../../../services/api';

const dataBR = d => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
const fmtPct = n => `${String(Number(n)).replace('.', ',')}%`;
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Clube MAIS+ no admin (só admin): número de Lojas do Clube e de
// interessados na assinatura, as lojas com o benefício, os interessados e o
// termo de adesão da loja (versão vigente, marcada se for provisória, e
// publicação de versão nova: as lojas têm 15 dias para aceitar).
export default function SindicatoClube() {
  const [d, setD] = useState(null);
  const carregar = () => api.get('/sindicato-clube').then(r => setD(r.data)).catch(() => toast.error('Erro ao carregar o Clube MAIS+'));
  useEffect(() => { carregar(); }, []);

  if (!d) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;
  const t = d.termo_vigente;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-movv-900 flex items-center justify-center"><Gem className="w-5 h-5 text-gold-300" /></div>
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900">Clube MAIS+</h1>
          <p className="text-sm text-slate-500">Lojas do Clube, interessados na assinatura e termo de adesão da loja.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Numero icone={Store} valor={d.numeros.lojas_do_clube} rotulo="Lojas do Clube" />
        <Numero icone={Users} valor={d.numeros.interessados} rotulo="interessados na assinatura de R$ 9,90" />
        <Numero icone={Users} valor={d.numeros.interessados_autorizaram} rotulo="autorizaram contato" />
      </div>

      <AlertasPreco alertas={d.alertas_preco || []} regra={d.alerta_regra} />

      <Termo termo={t} termos={d.termos} onPublicado={carregar} />

      <div className="card p-0 overflow-x-auto">
        <h2 className="font-semibold text-slate-900 px-4 pt-4">Lojas</h2>
        <table className="w-full text-sm mt-2">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
            {['Loja', 'Situação', 'Benefício', 'Termo', 'Desde'].map(h => <th key={h} className="px-4 py-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {!d.lojas.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Nenhuma loja entrou no Clube ainda.</td></tr>}
            {d.lojas.map(l => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="px-4 py-3"><p className="font-medium text-slate-900">{l.nome}</p>{l.empresa_teste && <span className="badge-pending">teste</span>}</td>
                <td className="px-4 py-3">{l.ativo
                  ? <span className="badge-converted">No Clube</span>
                  : <span className="badge-expired">{l.motivo_saida === 'termo_nao_aceito' ? 'Saiu: termo não aceito' : 'Saiu'}</span>}</td>
                <td className="px-4 py-3 text-slate-700">
                  {l.percentual != null && <span>{fmtPct(l.percentual)} {l.alcance === 'escolhidos' ? `em ${l.produtos_escolhidos} produto(s)` : 'na loja toda'}</span>}
                  {l.percentual != null && l.entrega_gratis && <br />}
                  {l.entrega_gratis && <span>entrega grátis</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">v{l.termo_versao}{t && l.ativo && l.termo_versao < t.versao && <span className="block text-xs text-amber-700">falta aceitar a v{t.versao}</span>}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{dataBR(l.ativo ? l.entrou_em : l.saiu_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-0 overflow-x-auto">
        <h2 className="font-semibold text-slate-900 px-4 pt-4">Interessados na assinatura</h2>
        <table className="w-full text-sm mt-2">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
            {['Nome', 'WhatsApp', 'Autorizou contato', 'Quando'].map(h => <th key={h} className="px-4 py-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {!d.interessados.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Ninguém se inscreveu ainda.</td></tr>}
            {d.interessados.map(i => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="px-4 py-2.5 text-slate-900">{i.nome}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{i.whatsapp}</td>
                <td className="px-4 py-2.5">{i.autorizou_contato ? 'Sim' : 'Não'}</td>
                <td className="px-4 py-2.5 text-slate-500">{dataBR(i.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Alerta de preço (b4): Loja do Clube que subiu o preço normal de um produto
// acima do menor preço dele nos 30 dias anteriores. Só alerta: não bloqueia
// e a loja não é avisada.
function AlertasPreco({ alertas, regra }) {
  const pct = regra?.pct ?? 10; const dias = regra?.dias ?? 30;
  return (
    <div className="card p-0 overflow-x-auto">
      <div className="px-4 pt-4 flex items-start gap-2">
        <TrendingUp className={`w-5 h-5 mt-0.5 ${alertas.length ? 'text-amber-600' : 'text-slate-400'}`} />
        <div>
          <h2 className="font-semibold text-slate-900">Alertas de preço {alertas.length > 0 && <span className="badge-pending ml-1">{alertas.length}</span>}</h2>
          <p className="text-xs text-slate-500">Loja do Clube que subiu o preço normal de um produto mais de {pct}% acima do menor preço dele nos {dias} dias anteriores. Só alerta: não bloqueia e a loja não é avisada.</p>
        </div>
      </div>
      {alertas.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">Nenhum alerta agora.</p>
      ) : (
        <table className="w-full text-sm mt-2">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
            {['Loja', 'Produto', `Menor em ${dias} dias`, 'Hoje', 'Aumento', 'Subiu em'].map(h => <th key={h} className="px-4 py-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {alertas.map(a => (
              <tr key={`${a.catalogo}-${a.item_id}`} className="border-b border-slate-100">
                <td className="px-4 py-2.5 text-slate-900">{a.loja_nome}</td>
                <td className="px-4 py-2.5 text-slate-700">{a.produto_nome}{a.catalogo === 'beer' && <span className="block text-xs text-slate-400">Disk Bebidas</span>}</td>
                <td className="px-4 py-2.5 tabular-nums">{brl(a.menor_antes)}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium">{brl(a.preco_hoje)}</td>
                <td className="px-4 py-2.5 tabular-nums text-amber-700 font-semibold">+{fmtPct(a.aumento_pct)}</td>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{dataBR(a.subiu_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Numero({ icone: Icone, valor, rotulo }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Icone className="w-6 h-6 text-movv-900" />
      <div><p className="text-2xl font-bold tabular-nums text-slate-900">{valor}</p><p className="text-xs text-slate-500">{rotulo}</p></div>
    </div>
  );
}

function Termo({ termo, termos, onPublicado }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState(termo?.titulo || '');
  const [texto, setTexto] = useState(termo?.texto || '');
  const [provisoria, setProvisoria] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function publicar() {
    setEnviando(true);
    try {
      await api.post('/sindicato-clube/termos', { titulo, texto, provisoria });
      toast.success('Versão nova publicada. As Lojas do Clube têm 15 dias para aceitar.');
      setConfirmar(false); setAberto(false); onPublicado();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível publicar.');
    } finally { setEnviando(false); }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-movv-900" />
          <h2 className="font-semibold text-slate-900">Termo de adesão da loja</h2>
          {termo && <span className="badge-approved">versão {termo.versao}</span>}
          {termo?.provisoria && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">PROVISÓRIA</span>}
        </div>
        <button type="button" onClick={() => setAberto(a => !a)} className="btn-secondary !py-1.5 inline-flex items-center gap-2">
          Publicar versão nova <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {termo?.provisoria && <p className="mt-2 text-sm text-amber-800">A versão {termo.versao} é provisória: o texto definitivo vem com a revisão jurídica, como versão nova.</p>}
      <p className="mt-2 text-xs text-slate-500">
        {termos.map(v => `v${v.versao}${v.provisoria ? ' (provisória)' : ''} em ${dataBR(v.publicado_em)}`).join(' · ')}
      </p>
      {aberto && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Ao publicar, as Lojas do Clube recebem um WhatsApp e têm 15 dias para aceitar no painel (lembrete 3 dias antes). Sem aceite, o benefício da loja é desativado. Use <code>{'{{BENEFICIO}}'}</code> onde entra o benefício escolhido pela loja.</p>
          <div><label className="label" htmlFor="termo-loja-titulo">Título</label><input id="termo-loja-titulo" className="input" value={titulo} onChange={e => setTitulo(e.target.value)} /></div>
          <div><label className="label" htmlFor="termo-loja-texto">Texto</label><textarea id="termo-loja-texto" rows={14} className="input font-mono text-[13px]" value={texto} onChange={e => setTexto(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><input id="termo-loja-provisoria" type="checkbox" checked={provisoria} onChange={e => setProvisoria(e.target.checked)} /> Ainda é provisória</label>
          {confirmar ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Publicar como versão {(termo?.versao || 0) + 1}? Todas as Lojas do Clube precisarão aceitar de novo.</span>
              <button type="button" onClick={publicar} disabled={enviando} className="btn-primary !py-1.5">Publicar</button>
              <button type="button" onClick={() => setConfirmar(false)} className="btn-secondary !py-1.5">Cancelar</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmar(true)} className="btn-primary">Publicar versão {(termo?.versao || 0) + 1}</button>
          )}
        </div>
      )}
    </div>
  );
}
