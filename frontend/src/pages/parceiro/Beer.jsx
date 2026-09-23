import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Wine, Plus, Pencil, Trash2, Upload, Loader2, Star, Zap, X, Clock, AlertTriangle } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import CampoPreco from '../../components/ui/CampoPreco';
import TermoDiskBebidas from '../../components/beer/TermoDiskBebidas';
import { DIAS, TIPOS_ESTABELECIMENTO, textoDias } from '../beer/beerConfig';
import { formatarBRL } from '../../utils/iubFood';
import { ROXO, PRETO } from '../public/Marketplace/theme';

// Aba "🍻 Meu IUB Beer" (IUB Disk Bebidas) do painel. Parceiro que ainda
// não entrou vê o cadastro + termo ("Quero vender no IUB Beer"); quem já
// entrou vê o toggle "Aberto agora", os produtos (com status da moderação)
// e os dados do estabelecimento. Plano é o MESMO do parceiro (aba Planos).

const STATUS_PRODUTO = {
  pendente: { label: 'Em análise', cor: '#92400E', fundo: '#FEF3C7' },
  aprovado: { label: 'Aprovado', cor: '#166534', fundo: '#DCFCE7' },
  rejeitado: { label: 'Rejeitado', cor: '#991B1B', fundo: '#FEE2E2' },
};

const NOME_PLANO = { gratis: 'Grátis', oficial: 'Oficial', premium: 'Premium', master: 'Master' };

function mensagemErro(err, padrao) {
  return err.response?.data?.error || padrao;
}

export default function ParceiroBeer() {
  const [dados, setDados] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [editandoCadastro, setEditandoCadastro] = useState(false);
  const [modalProduto, setModalProduto] = useState(null); // null | 'novo' | produto
  const [mudandoStatus, setMudandoStatus] = useState(false);

  const carregar = useCallback(async () => {
    const res = await apiParceiro.get('/parceiro/beer/meu');
    setDados(res.data);
    if (res.data.estabelecimento?.ativo) {
      const p = await apiParceiro.get('/parceiro/beer/produtos');
      setProdutos(p.data.produtos);
    }
  }, []);

  useEffect(() => {
    carregar().catch(() => toast.error('Erro ao carregar IUB Disk Bebidas'));
    apiParceiro.get('/public/beer/categorias').then(res => setCategorias(res.data.grupos)).catch(() => {});
  }, [carregar]);

  if (!dados) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const est = dados.estabelecimento;
  const ativo = Boolean(est?.ativo);

  if (!ativo || editandoCadastro) {
    return (
      <FormCadastro
        dados={dados}
        editando={editandoCadastro}
        onCancelar={editandoCadastro ? () => setEditandoCadastro(false) : null}
        onSalvo={async () => { setEditandoCadastro(false); await carregar(); }}
      />
    );
  }

  async function alternarStatus() {
    setMudandoStatus(true);
    try {
      const res = await apiParceiro.post('/parceiro/beer/meu/status', { status_aberto: !est.status_aberto });
      setDados(d => ({ ...d, estabelecimento: { ...d.estabelecimento, ...res.data } }));
      toast.success(res.data.status_aberto ? 'Você está ABERTO no Disk Bebidas' : 'Você está FECHADO no Disk Bebidas');
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao mudar status'));
    } finally {
      setMudandoStatus(false);
    }
  }

  async function sairDoBeer() {
    if (!window.confirm('Sair do IUB Disk Bebidas? Você some do /beer na hora. Seus produtos ficam guardados pra quando voltar.')) return;
    try {
      await apiParceiro.post('/parceiro/beer/meu/desativar');
      toast.success('Você saiu do IUB Disk Bebidas');
      await carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao sair'));
    }
  }

  const lim = dados.limites;
  const destaquesUsados = produtos.filter(p => p.destaque).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: PRETO }}>
            <Wine className="w-5 h-5" style={{ color: ROXO }} /> Meu IUB Beer
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {TIPOS_ESTABELECIMENTO[est.tipo]} no IUB Disk Bebidas ·{' '}
            <Link to={`/beer/estabelecimento/${dados.parceiro.slug}`} target="_blank" className="font-semibold underline" style={{ color: ROXO }}>ver minha página</Link>
          </p>
        </div>
        <button type="button" onClick={() => setEditandoCadastro(true)} className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
          Editar dados do estabelecimento
        </button>
      </div>

      {/* Toggle grande de status */}
      <button
        type="button"
        onClick={alternarStatus}
        disabled={mudandoStatus}
        className="w-full rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4 text-left transition-colors disabled:opacity-70"
        style={{ backgroundColor: est.status_aberto ? '#DCFCE7' : '#FEE2E2', border: `2px solid ${est.status_aberto ? '#16A34A' : '#DC2626'}` }}
        aria-pressed={est.status_aberto}
      >
        <div>
          <p className="text-lg sm:text-2xl font-black" style={{ color: est.status_aberto ? '#166534' : '#991B1B' }}>
            {est.status_aberto ? '🟢 Aberto agora' : '🔴 Fechado'}
          </p>
          <p className="text-xs sm:text-sm mt-1" style={{ color: est.status_aberto ? '#166534' : '#991B1B' }}>
            {est.status_aberto
              ? 'Seus produtos "disponível agora" aparecem no Quero Agora. Toque pra fechar.'
              : 'Você não aparece no Quero Agora. Toque pra abrir.'}
          </p>
          {est.ultimo_status_update && (
            <p className="text-[11px] mt-1 text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> desde {new Date(est.ultimo_status_update).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <span className="relative w-16 h-9 rounded-full flex-shrink-0 transition-colors" style={{ backgroundColor: est.status_aberto ? '#16A34A' : '#CBD5E1' }}>
          <span className="absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all" style={{ left: est.status_aberto ? '2.1rem' : '0.25rem' }} />
        </span>
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-bold text-sm" style={{ color: PRETO }}>Meus produtos</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Todo produto novo passa pela aprovação do IUB antes de aparecer.
              {' '}Destaques: {destaquesUsados}/{lim.destaques === null ? '∞' : lim.destaques}
              {lim.produtos !== null && ` · Produtos: ${produtos.length}/${lim.produtos}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalProduto('novo')}
            className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl text-white"
            style={{ backgroundColor: ROXO }}
          >
            <Plus className="w-4 h-4" /> Adicionar produto
          </button>
        </div>

        {produtos.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">Nenhum produto ainda. Comece pelos mais pedidos: cerveja gelada, gelo, carvão…</p>
        ) : (
          <div className="space-y-2">
            {produtos.map(p => (
              <LinhaProduto
                key={p.id}
                produto={p}
                onEditar={() => setModalProduto(p)}
                onAtualizado={novo => setProdutos(lista => lista.map(x => (x.id === novo.id ? { ...x, ...novo } : x)))}
                onExcluido={() => setProdutos(lista => lista.filter(x => x.id !== p.id))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Seu plano (vale pro IUB MAIS+ inteiro)</p>
          <p className="text-lg font-black mt-0.5" style={{ color: PRETO }}>IUB {NOME_PLANO[lim.plano] || lim.plano}</p>
          <p className="text-xs text-slate-500">{lim.destaques === null ? 'Destaques ilimitados' : lim.destaques === 0 ? 'Sem destaques no Disk Bebidas' : `${lim.destaques} produtos em destaque`}</p>
        </div>
        <Link to="/parceiro/painel/planos" className="text-sm font-bold px-4 py-2.5 rounded-xl border-2" style={{ borderColor: ROXO, color: ROXO }}>Ver planos</Link>
      </div>

      <div className="text-center">
        <button type="button" onClick={sairDoBeer} className="text-xs font-semibold text-red-600 hover:underline">Sair do IUB Disk Bebidas</button>
      </div>

      {modalProduto && (
        <ModalProduto
          produto={modalProduto === 'novo' ? null : modalProduto}
          categorias={categorias}
          onClose={() => setModalProduto(null)}
          onSalvo={async msg => { setModalProduto(null); toast.success(msg); await carregar(); }}
        />
      )}
    </div>
  );
}

function LinhaProduto({ produto: p, onEditar, onAtualizado, onExcluido }) {
  const [ocupado, setOcupado] = useState(false);
  const st = STATUS_PRODUTO[p.status] || STATUS_PRODUTO.pendente;

  async function atualizar(campos) {
    setOcupado(true);
    try {
      const res = await apiParceiro.post(`/parceiro/beer/produtos/${p.id}/disponibilidade`, campos);
      onAtualizado(res.data.produto);
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao atualizar'));
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir "${p.nome}"?`)) return;
    setOcupado(true);
    try {
      await apiParceiro.delete(`/parceiro/beer/produtos/${p.id}`);
      onExcluido();
      toast.success('Produto excluído');
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao excluir'));
      setOcupado(false);
    }
  }

  const todos = !p.dias_disponiveis || p.dias_disponiveis.todos;
  function alternarDia(chave) {
    const atual = todos ? {} : { ...p.dias_disponiveis };
    if (atual[chave]) delete atual[chave]; else atual[chave] = true;
    atualizar({ dias_disponiveis: Object.keys(atual).length ? atual : { todos: true } });
  }

  return (
    <div className={`rounded-xl border border-slate-100 p-3 ${ocupado ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0 text-2xl">
          {p.imagem ? <img src={p.imagem} alt="" className="w-full h-full object-cover" /> : <span aria-hidden="true">{p.categoria_icone}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: PRETO }}>{p.nome}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.cor, backgroundColor: st.fundo }}>{st.label}</span>
          </div>
          <p className="text-xs text-slate-500">{p.categoria_nome} · <strong>{formatarBRL(p.preco)}</strong>{textoDias(p.dias_disponiveis) ? ` · ${textoDias(p.dias_disponiveis)}` : ''}</p>
          {p.status === 'rejeitado' && p.motivo_rejeicao && (
            <p className="text-xs text-red-700 mt-1 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {p.motivo_rejeicao} — edite e envie de novo.</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={() => atualizar({ destaque: !p.destaque })} title={p.destaque ? 'Tirar destaque' : 'Destacar'} className="p-2 rounded-lg hover:bg-slate-50">
            <Star className="w-4 h-4" style={{ color: p.destaque ? '#F59E0B' : '#CBD5E1' }} fill={p.destaque ? '#F59E0B' : 'none'} />
          </button>
          <button type="button" onClick={onEditar} title="Editar" className="p-2 rounded-lg hover:bg-slate-50"><Pencil className="w-4 h-4 text-slate-500" /></button>
          <button type="button" onClick={excluir} title="Excluir" className="p-2 rounded-lg hover:bg-slate-50"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => atualizar({ disponivel_agora: !p.disponivel_agora })}
          aria-pressed={p.disponivel_agora}
          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border"
          style={p.disponivel_agora ? { backgroundColor: ROXO, borderColor: ROXO, color: '#fff' } : { borderColor: '#E2E8F0', color: '#64748B' }}
        >
          <Zap className="w-3 h-3" /> Disponível agora
        </button>
        <span className="text-[11px] text-slate-400 ml-1">Dias:</span>
        {DIAS.map(d => {
          const marcado = todos || p.dias_disponiveis?.[d.chave];
          return (
            <button
              key={d.chave}
              type="button"
              onClick={() => alternarDia(d.chave)}
              aria-pressed={!todos && Boolean(p.dias_disponiveis?.[d.chave])}
              className="text-[11px] font-semibold w-9 py-1 rounded-md border"
              style={marcado && !todos ? { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD', color: ROXO } : { borderColor: '#E2E8F0', color: todos ? '#94A3B8' : '#64748B' }}
            >
              {d.curto}
            </button>
          );
        })}
        {!todos && (
          <button type="button" onClick={() => atualizar({ dias_disponiveis: { todos: true } })} className="text-[11px] font-semibold underline text-slate-500">todos os dias</button>
        )}
      </div>
    </div>
  );
}

// Cadastro/edição do produto. Categoria só da lista (camada 1); o backend
// ainda passa o filtro de termos (camada 2) e manda pra moderação (camada 3).
function ModalProduto({ produto, categorias, onClose, onSalvo }) {
  const [nome, setNome] = useState(produto?.nome || '');
  const [descricao, setDescricao] = useState(produto?.descricao || '');
  const [categoria, setCategoria] = useState(produto?.categoria_codigo || '');
  const [preco, setPreco] = useState(produto ? String(produto.preco) : '');
  const [dias, setDias] = useState(produto?.dias_disponiveis && !produto.dias_disponiveis.todos ? produto.dias_disponiveis : { todos: true });
  const [agora, setAgora] = useState(Boolean(produto?.disponivel_agora));
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(produto?.imagem || null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const fileRef = useRef(null);

  const podeSalvar = nome.trim().length >= 2 && categoria && parseFloat(preco) > 0;

  function alternarDia(chave) {
    const atual = dias.todos ? {} : { ...dias };
    if (atual[chave]) delete atual[chave]; else atual[chave] = true;
    setDias(Object.keys(atual).length ? atual : { todos: true });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append('nome', nome.trim());
      fd.append('descricao', descricao.trim());
      fd.append('categoria_codigo', categoria);
      fd.append('preco', preco);
      fd.append('dias_disponiveis', JSON.stringify(dias));
      fd.append('disponivel_agora', String(agora));
      if (foto) fd.append('foto', foto);
      if (produto) {
        const res = await apiParceiro.put(`/parceiro/beer/produtos/${produto.id}`, fd);
        onSalvo(res.data.voltou_moderacao ? 'Salvo — o produto voltou pra análise do IUB' : 'Produto atualizado');
      } else {
        await apiParceiro.post('/parceiro/beer/produtos', fd);
        onSalvo('Produto enviado pra análise do IUB');
      }
    } catch (err) {
      // termo proibido (422) e demais validações aparecem DENTRO do modal,
      // sem perder o que o parceiro digitou
      setErro(mensagemErro(err, 'Erro ao salvar produto'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100" aria-label="Fechar"><X className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold" style={{ color: PRETO }}>{produto ? 'Editar produto' : 'Adicionar produto'}</h2>
        <p className="text-slate-500 text-xs mt-1">
          {produto?.status === 'aprovado'
            ? 'Mudar nome, descrição, categoria ou foto manda o produto de volta pra análise.'
            : 'O produto aparece no Disk Bebidas depois da aprovação do IUB.'}
        </p>

        <div className="space-y-3 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nome *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={200} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Ex: Heineken long neck 330ml" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} maxLength={1000} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none" placeholder="Ex: gelada, caixa com 12" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Categoria *</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Escolha…</option>
              {categorias.map(g => (
                <optgroup key={g.codigo} label={`${g.icone} ${g.nome}${g.regulamentada ? ' (regulamentado)' : ''}`}>
                  {g.filhas.map(f => <option key={f.codigo} value={f.codigo}>{f.nome}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Preço *</label>
            <CampoPreco value={preco} onChange={setPreco} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Foto</label>
            <div onClick={() => fileRef.current?.click()} className="w-full h-28 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-slate-300 overflow-hidden bg-slate-50">
              {preview ? <img src={preview} alt="" className="w-full h-full object-contain" /> : (
                <span className="flex flex-col items-center gap-1 text-slate-400 text-xs"><Upload className="w-5 h-5" /> Escolher foto</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFoto(f); setPreview(URL.createObjectURL(f)); } }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Dias disponíveis</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setDias({ todos: true })} className="text-xs font-semibold px-2.5 py-1 rounded-md border" style={dias.todos ? { backgroundColor: ROXO, borderColor: ROXO, color: '#fff' } : { borderColor: '#E2E8F0', color: '#64748B' }}>Todos</button>
              {DIAS.map(d => (
                <button key={d.chave} type="button" onClick={() => alternarDia(d.chave)} className="text-xs font-semibold w-10 py-1 rounded-md border" style={!dias.todos && dias[d.chave] ? { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD', color: ROXO } : { borderColor: '#E2E8F0', color: '#64748B' }}>{d.curto}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={agora} onChange={e => setAgora(e.target.checked)} className="w-4 h-4 accent-violet-700" />
            <span className="text-sm text-slate-700">Disponível agora <span className="text-slate-400">(entra no Quero Agora quando você estiver aberto)</span></span>
          </label>
          {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">{erro}</p>}
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} disabled={salvando} className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={salvar} disabled={!podeSalvar || salvando} className="flex-1 text-sm font-bold py-2.5 rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: ROXO }}>
            {salvando ? 'Salvando…' : produto ? 'Salvar' : 'Enviar pra análise'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Cadastro da extensão (primeira vez = "Quero vender no IUB Beer"; depois,
// edição). CNPJ é o do parceiro — só pede se o cadastro não tiver um válido.
function FormCadastro({ dados, editando, onCancelar, onSalvo }) {
  const est = dados.estabelecimento;
  const reativando = est && !est.ativo;
  const precisaTermo = !est || !est.ativo || est.termo_versao !== dados.termo_versao_atual;
  const [tipo, setTipo] = useState(est?.tipo || '');
  const [cnpj, setCnpj] = useState(dados.parceiro.cnpj || '');
  const [cnae, setCnae] = useState(est?.cnae || '');
  const [whatsapp, setWhatsapp] = useState(est?.whatsapp || dados.parceiro.whatsapp || '');
  const [bairros, setBairros] = useState(est?.bairros_entrega || []);
  const [bairroNovo, setBairroNovo] = useState('');
  const [tempo, setTempo] = useState(est?.tempo_entrega_min || '');
  const [retirada, setRetirada] = useState(Boolean(est?.retirada_disponivel));
  const [horario, setHorario] = useState(est?.horario_funcionamento || {});
  const [aceite, setAceite] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function adicionarBairro() {
    const b = bairroNovo.trim();
    if (b && !bairros.some(x => x.toLowerCase() === b.toLowerCase())) setBairros([...bairros, b]);
    setBairroNovo('');
  }

  function setDia(chave, campo, valor) {
    setHorario(h => ({ ...h, [chave]: { aberto: false, abre: '18:00', fecha: '23:00', ...h[chave], [campo]: valor } }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await apiParceiro.put('/parceiro/beer/meu', {
        tipo, cnpj, cnae, whatsapp, bairros_entrega: bairros, tempo_entrega_min: tempo ? Number(tempo) : null,
        retirada_disponivel: retirada, horario_funcionamento: horario, aceite_termo: aceite,
      });
      toast.success(editando ? 'Dados atualizados' : 'Bem-vindo ao IUB Disk Bebidas! 🍻');
      onSalvo();
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao salvar'));
    } finally {
      setSalvando(false);
    }
  }

  const campo = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg';
  return (
    <form onSubmit={salvar} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: PRETO }}>
          <Wine className="w-5 h-5" style={{ color: ROXO }} /> {editando ? 'Dados do estabelecimento' : reativando ? 'Voltar pro IUB Disk Bebidas' : 'Quero vender no IUB Beer'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {editando ? 'O que o cliente vê no Disk Bebidas.' : 'Adega, distribuidora, bar, conveniência ou empório: apareça no IUB Disk Bebidas com o mesmo login e o mesmo plano que você já tem.'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nome fantasia</label>
            <input value={dados.parceiro.nome} disabled className={`${campo} bg-slate-50 text-slate-500`} />
            <p className="text-[11px] text-slate-400 mt-1">Muda em Meu Perfil.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={`${campo} bg-white`} required>
              <option value="">Escolha…</option>
              {dados.tipos.map(t => <option key={t} value={t}>{TIPOS_ESTABELECIMENTO[t] || t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">CNPJ *</label>
            <input value={cnpj} onChange={e => setCnpj(e.target.value)} className={campo} placeholder="00.000.000/0000-00" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">CNAE de bebidas</label>
            <input value={cnae} onChange={e => setCnae(e.target.value)} className={campo} placeholder="4723-7/00" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">WhatsApp comercial (pedidos) *</label>
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={campo} placeholder="(64) 99999-9999" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tempo médio de entrega (min)</label>
            <input type="number" min="5" max="240" value={tempo} onChange={e => setTempo(e.target.value)} className={campo} placeholder="Ex: 30" />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={retirada} onChange={e => setRetirada(e.target.checked)} className="w-4 h-4 accent-violet-700" />
          <span className="text-sm text-slate-700">Cliente pode retirar no local</span>
        </label>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Bairros de entrega</label>
          <div className="flex gap-2">
            <input
              value={bairroNovo}
              onChange={e => setBairroNovo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); adicionarBairro(); } }}
              className={campo}
              placeholder="Digite o bairro e aperte Enter"
            />
            <button type="button" onClick={adicionarBairro} className="px-3 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50">Adicionar</button>
          </div>
          {bairros.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {bairros.map(b => (
                <span key={b} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#EDE9FE', color: ROXO }}>
                  {b}
                  <button type="button" onClick={() => setBairros(bairros.filter(x => x !== b))} aria-label={`Tirar ${b}`}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">Horário de funcionamento</label>
          <div className="space-y-1.5">
            {DIAS.map(d => {
              const h = horario[d.chave] || {};
              return (
                <div key={d.chave} className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-2 w-28 cursor-pointer">
                    <input type="checkbox" checked={Boolean(h.aberto)} onChange={e => setDia(d.chave, 'aberto', e.target.checked)} className="w-4 h-4 accent-violet-700" />
                    <span className="text-slate-700">{d.label}</span>
                  </label>
                  {h.aberto ? (
                    <>
                      <input type="time" value={h.abre || '18:00'} onChange={e => setDia(d.chave, 'abre', e.target.value)} className="px-2 py-1 border border-slate-200 rounded-md text-sm" />
                      <span className="text-slate-400">às</span>
                      <input type="time" value={h.fecha || '23:00'} onChange={e => setDia(d.chave, 'fecha', e.target.value)} className="px-2 py-1 border border-slate-200 rounded-md text-sm" />
                    </>
                  ) : <span className="text-slate-400 text-xs">fechado</span>}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">Informativo. Quem decide se você aparece como aberto é o botão “Aberto agora” do painel.</p>
        </div>
      </div>

      {precisaTermo && <TermoDiskBebidas aceito={aceite} onChange={setAceite} />}

      <div className="flex gap-2">
        {onCancelar && <button type="button" onClick={onCancelar} className="flex-1 sm:flex-none px-6 text-sm font-semibold py-3 rounded-xl border border-slate-200 hover:bg-slate-50">Cancelar</button>}
        <button type="submit" disabled={salvando || (precisaTermo && !aceite) || !tipo} className="flex-1 sm:flex-none px-8 text-sm font-bold py-3 rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: ROXO }}>
          {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Ativar Disk Bebidas'}
        </button>
      </div>
    </form>
  );
}
