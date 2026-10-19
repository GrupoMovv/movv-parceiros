import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Percent, Truck, Search, FileSignature, AlertTriangle, CheckCircle2 } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';
import TextoSimples from '../universidade/TextoSimples';

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';
const fmtPct = n => `${String(Number(n)).replace('.', ',')}%`;
const dataBR = d => (d ? new Date(d).toLocaleDateString('pt-BR') : '');

// Mesmo texto do servidor (services/lojaClube.js, descreverBeneficio): é o
// que entra no termo no lugar de {{BENEFICIO}}.
function descreverBeneficio({ percentual, alcance, entrega_gratis }, nProdutos) {
  const partes = [];
  if (percentual != null) {
    partes.push(alcance === 'escolhidos'
      ? `desconto de ${fmtPct(percentual)} sobre o preço normal nos produtos escolhidos no painel (${nProdutos} ${nProdutos === 1 ? 'produto' : 'produtos'})`
      : `desconto de ${fmtPct(percentual)} sobre o preço normal em todos os produtos e serviços da Loja no IUB MAIS+`);
  }
  if (entrega_gratis) partes.push('entrega grátis nos pedidos feitos pelo IUB MAIS+');
  return partes.join('; e ');
}

// /parceiro/painel/clube — a loja entra no Clube MAIS+ e escolhe o benefício
// permanente (migration 100). Entrar ou mudar sempre com o aceite do termo.
export default function ClubeMais() {
  const [d, setD] = useState(null);
  const [comDesconto, setComDesconto] = useState(true);
  const [percentual, setPercentual] = useState('');
  const [alcance, setAlcance] = useState('loja');
  const [entrega, setEntrega] = useState(false);
  const [escolhidos, setEscolhidos] = useState(new Set());
  const [busca, setBusca] = useState('');
  const [concordo, setConcordo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  function aplicar(dados) {
    setD(dados);
    const b = dados.beneficio;
    if (dados.ativo && b) {
      setComDesconto(b.percentual != null);
      setPercentual(b.percentual != null ? String(b.percentual).replace('.', ',') : '');
      setAlcance(b.alcance || 'loja');
      setEntrega(Boolean(b.entrega_gratis));
    } else if (!percentual) {
      setPercentual(String(dados.sugestao_minima.percentual));
    }
    setEscolhidos(new Set(dados.produtos.filter(p => p.escolhido).map(p => `${p.catalogo}:${p.item_id}`)));
    setConcordo(false);
  }

  useEffect(() => {
    apiParceiro.get('/parceiro/clube').then(r => aplicar(r.data)).catch(() => toast.error('Erro ao carregar o Clube MAIS+'));
  }, []);

  const pctNum = Number(String(percentual).replace(',', '.'));
  const beneficio = { percentual: comDesconto && percentual !== '' ? pctNum : null, alcance: comDesconto ? alcance : 'loja', entrega_gratis: entrega };
  const textoTermo = useMemo(
    () => (d?.termo ? d.termo.texto.replace('{{BENEFICIO}}', descreverBeneficio(beneficio, escolhidos.size) || '[escolha o benefício acima]') : ''),
    [d, comDesconto, percentual, alcance, entrega, escolhidos],
  );

  if (!d) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const abaixoDoSugerido = comDesconto && percentual !== '' && Number.isFinite(pctNum) && pctNum < d.sugestao_minima.percentual;
  // mesma regra do servidor: 1,5% a 30%, uma casa decimal; pelo menos um benefício
  const pctInvalido = comDesconto && (percentual === '' || !Number.isFinite(pctNum) || pctNum < d.limites.min || pctNum > d.limites.max || Math.round(pctNum * 10) !== pctNum * 10);
  const semProduto = comDesconto && alcance === 'escolhidos' && escolhidos.size === 0;
  const semBeneficio = !comDesconto && !entrega;
  const podeSalvar = concordo && !pctInvalido && !semProduto && !semBeneficio;
  const produtosFiltrados = d.produtos.filter(p => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  function marcar(p) {
    const k = `${p.catalogo}:${p.item_id}`;
    setEscolhidos(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const r = await apiParceiro.put('/parceiro/clube', {
        versao: d.termo.versao, concordo,
        percentual: beneficio.percentual, alcance: beneficio.alcance, entrega_gratis: entrega,
        produtos: [...escolhidos].map(k => { const [catalogo, item_id] = k.split(':'); return { catalogo, item_id: Number(item_id) }; }),
      });
      aplicar(r.data);
      toast.success(r.data.entrou ? 'Sua loja entrou no Clube MAIS+!' : 'Benefício do Clube atualizado.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível salvar.');
    } finally { setSalvando(false); }
  }

  async function sair() {
    setSalvando(true);
    try {
      const r = await apiParceiro.post('/parceiro/clube/sair');
      aplicar(r.data); setConfirmarSaida(false);
      toast.success('Sua loja saiu do Clube MAIS+.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível sair.');
    } finally { setSalvando(false); }
  }

  if (d.loja.pessoa_fisica) {
    return (
      <div className="max-w-3xl"><Secao titulo="Clube MAIS+">
        <p className="text-sm text-slate-600">A Loja do Clube é para empresas com CNPJ.</p>
      </Secao></div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>💎 Clube MAIS+</h1>
        <p className="text-slate-500 text-sm mt-0.5">Ofereça um benefício permanente aos membros do Clube MAIS+. Você pode sair quando quiser.</p>
      </div>

      {d.precisa_aceitar_versao_nova && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p><strong>O termo foi atualizado (versão {d.termo.versao}).</strong> Para continuar no Clube, leia e aceite a versão nova até <strong>{dataBR(d.prazo_aceite)}</strong>. Sem o aceite, o benefício da sua loja é desativado.</p>
        </div>
      )}

      <Secao titulo={d.ativo ? 'Sua loja está no Clube' : 'Sua loja ainda não está no Clube'}>
        {d.ativo ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-emerald-800"><CheckCircle2 className="w-5 h-5 flex-shrink-0" /> <span>Benefício: {d.beneficio.descricao}.</span></p>
            <p className="text-xs text-slate-500">No Clube desde {dataBR(d.beneficio.entrou_em)} · termo aceito: versão {d.beneficio.termo_versao}{d.ultimo_aceite ? ` em ${dataBR(d.ultimo_aceite.aceito_em)} por ${d.ultimo_aceite.usuario_email}` : ''}</p>
            {confirmarSaida ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-700">Sair do Clube agora? O benefício para na hora.</span>
                <button type="button" onClick={sair} disabled={salvando} className="px-4 py-2 rounded-xl font-semibold text-white bg-red-600">Sair do Clube</button>
                <button type="button" onClick={() => setConfirmarSaida(false)} className="px-4 py-2 rounded-xl font-semibold border border-slate-200">Cancelar</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmarSaida(true)} className="text-sm font-semibold text-red-600 underline">Sair do Clube</button>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {d.beneficio?.motivo_saida === 'termo_nao_aceito'
              ? `Sua loja saiu do Clube em ${dataBR(d.beneficio.saiu_em)} porque a versão nova do termo não foi aceita no prazo. Para voltar, escolha o benefício e aceite o termo abaixo.`
              : 'Escolha o benefício, leia o termo e aceite para entrar.'}
          </p>
        )}
      </Secao>

      <Secao titulo="Benefício para os membros" subtitulo="Pode oferecer desconto, entrega grátis ou os dois. O desconto não se soma a promoções: o membro paga o menor preço.">
        <div className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: PRETO }}>
            <input id="clube-com-desconto" type="checkbox" checked={comDesconto} onChange={e => setComDesconto(e.target.checked)} className="rounded" />
            <Percent className="w-4 h-4" /> Desconto do Clube
          </label>
          {comDesconto && (
            <div className="pl-6 space-y-4">
              <div className="max-w-[200px]">
                <label className="block text-xs font-semibold text-slate-500 mb-1" htmlFor="clube-percentual">Desconto permanente (%)</label>
                <input id="clube-percentual" inputMode="decimal" aria-invalid={pctInvalido} className={`${campoCls} ${pctInvalido ? '!border-red-400' : ''}`} value={percentual} onChange={e => setPercentual(e.target.value.replace(/[^\d,.]/g, ''))} />
              </div>
              {pctInvalido && <p className="text-xs font-semibold text-red-600">O desconto do Clube vai de {fmtPct(d.limites.min)} a {fmtPct(d.limites.max)}, com até uma casa decimal.</p>}
              <p className={`text-xs ${abaixoDoSugerido ? 'text-amber-700' : 'text-slate-500'}`}>
                De {fmtPct(d.limites.min)} a {fmtPct(d.limites.max)}. Sugestão para {d.sugestao_minima.rotulo}{d.sugestao_minima.categoria ? ` (sua categoria: ${d.sugestao_minima.categoria})` : ''}: pelo menos {fmtPct(d.sugestao_minima.percentual)}.
                {abaixoDoSugerido && ' Você pode usar um valor menor; é só uma orientação.'}
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="clube-alcance" checked={alcance === 'loja'} onChange={() => setAlcance('loja')} /> Em todos os produtos e serviços</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="clube-alcance" checked={alcance === 'escolhidos'} onChange={() => setAlcance('escolhidos')} /> Só nos produtos que eu escolher</label>
              </div>
              {alcance === 'escolhidos' && (
                <div className="rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input id="clube-busca" className="flex-1 text-sm outline-none" placeholder="Buscar produto" value={busca} onChange={e => setBusca(e.target.value)} />
                    <span className={`text-xs tabular-nums ${semProduto ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{semProduto ? 'escolha pelo menos 1' : `${escolhidos.size} escolhido(s)`}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {!d.produtos.length && <p className="px-3 py-4 text-sm text-slate-500">Cadastre produtos para escolher.</p>}
                    {produtosFiltrados.map(p => (
                      <label key={`${p.catalogo}:${p.item_id}`} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={escolhidos.has(`${p.catalogo}:${p.item_id}`)} onChange={() => marcar(p)} className="rounded" />
                        <span className="flex-1 min-w-0 truncate">{p.nome}{p.catalogo === 'beer' && <span className="ml-1 text-xs text-slate-400">· Disk Bebidas</span>}</span>
                        {p.preco != null && <span className="text-xs text-slate-500 tabular-nums">R$ {Number(p.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: PRETO }}>
            <input id="clube-entrega" type="checkbox" checked={entrega} onChange={e => setEntrega(e.target.checked)} className="rounded" />
            <Truck className="w-4 h-4" /> Entrega grátis para o Clube (vale também com promoção)
          </label>
        </div>
      </Secao>

      {d.termo && (
        <Secao titulo={d.termo.titulo} subtitulo={`Versão ${d.termo.versao}${d.termo.provisoria ? ' (provisória)' : ''} · o benefício escolhido acima entra no item 2.`}>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <TextoSimples texto={textoTermo} className="space-y-3 text-[14.5px] leading-relaxed text-slate-700" />
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
            <input id="clube-concordo" type="checkbox" checked={concordo} onChange={e => setConcordo(e.target.checked)} className="mt-0.5 w-5 h-5 rounded" />
            <span className="flex items-center gap-1.5"><FileSignature className="w-4 h-4 flex-shrink-0" /> Li e aceito o termo de adesão da Loja do Clube MAIS+ (versão {d.termo.versao}).</span>
          </label>
        </Secao>
      )}

      {semBeneficio && <p className="text-sm font-semibold text-red-600">Escolha pelo menos um benefício: desconto ou entrega grátis.</p>}
      <button type="button" onClick={salvar} disabled={salvando || !podeSalvar}
        className="flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        style={{ backgroundColor: ROXO }}>
        {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
        {d.ativo ? (d.precisa_aceitar_versao_nova ? 'Aceitar o termo novo e salvar' : 'Salvar benefício e aceitar o termo') : 'Entrar no Clube MAIS+'}
      </button>
      <p className="text-xs text-slate-500 -mt-3">Fica registrado: versão do termo, data e hora, IP, navegador, quem aceitou e o benefício escolhido.</p>
    </div>
  );
}

function Secao({ titulo, subtitulo, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-bold text-base" style={{ color: PRETO }}>{titulo}</h2>
      {subtitulo && <p className="text-xs text-slate-400 mt-1">{subtitulo}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}
