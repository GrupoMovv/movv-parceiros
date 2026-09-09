import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Flame, Lock, Clock, Check, TrendingUp, Pencil, Trash2, Plus, Upload, Loader2, Gift } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import CampoPreco from '../../components/ui/CampoPreco';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';

const VERMELHO = '#DC2626';
const AZUL = '#2563EB';

function formatarPreco(v) {
  return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function formatarDataCurta(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ParceiroFechaMes() {
  const { parceiro } = useOutletContext();
  const [info, setInfo] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [confirmados, setConfirmados] = useState([]);
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState({}); // { [produto_id]: preco_fecha_mes }
  const [enviando, setEnviando] = useState(false);
  const [modalBonus, setModalBonus] = useState(null); // null | true (novo)
  const [modalEditar, setModalEditar] = useState(null); // item de sindicato_fecha_mes_produtos
  const [modalRemover, setModalRemover] = useState(null);
  const [removendo, setRemovendo] = useState(false);

  const carregar = async () => {
    try {
      const [infoRes, meusRes] = await Promise.all([
        apiParceiro.get('/parceiro/fecha-mes/proximo'),
        apiParceiro.get('/parceiro/fecha-mes/meus'),
      ]);
      setInfo(infoRes.data);
      setConfirmados(meusRes.data.produtos);
      if (infoRes.data.pode_participar) {
        const produtosRes = await apiParceiro.get('/parceiro/produtos', { params: { status: 'ativo' } });
        setProdutos(produtosRes.data.produtos);
      }
    } catch {
      toast.error('Erro ao carregar Fecha Mês');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    apiParceiro.get('/parceiro/fecha-mes/historico').then(res => setHistorico(res.data.historico)).catch(() => setHistorico([]));
  }, []);

  const confirmadosCatalogo = useMemo(() => confirmados.filter(c => !c.e_produto_bonus), [confirmados]);
  const confirmadosBonus    = useMemo(() => confirmados.filter(c => c.e_produto_bonus), [confirmados]);
  const idsConfirmados = useMemo(() => new Set(confirmadosCatalogo.map(c => c.produto_id)), [confirmadosCatalogo]);
  const produtosDisponiveis = produtos.filter(p => !idsConfirmados.has(p.id));
  const qtdSelecionados = Object.keys(selecionados).length;

  const podeEditar = info ? !info.passou_prazo_edicao : false;
  const vagasCatalogo = info ? info.limite_catalogo - confirmadosCatalogo.length - qtdSelecionados : 0;
  const vagasBonus = info ? info.limite_bonus - confirmadosBonus.length : 0;

  function alternarSelecao(produto) {
    setSelecionados(atual => {
      const novo = { ...atual };
      if (produto.id in novo) { delete novo[produto.id]; return novo; }
      if (vagasCatalogo <= 0) { toast.error(`Limite de ${info.limite_catalogo} produtos do catálogo do seu plano atingido`); return atual; }
      novo[produto.id] = '';
      return novo;
    });
  }

  function mudarPreco(produtoId, valor) {
    setSelecionados(atual => ({ ...atual, [produtoId]: valor }));
  }

  async function confirmarParticipacao() {
    const itens = Object.entries(selecionados).map(([produto_id, preco_fecha_mes]) => ({ produto_id: Number(produto_id), preco_fecha_mes }));
    if (itens.some(it => !it.preco_fecha_mes || parseFloat(it.preco_fecha_mes) <= 0)) {
      return toast.error('Preencha o preço especial de todos os produtos selecionados');
    }
    setEnviando(true);
    try {
      const res = await apiParceiro.post('/parceiro/fecha-mes/participar', { produtos: itens });
      if (res.data.rejeitados?.length > 0) {
        res.data.rejeitados.forEach(r => toast.error(`Produto #${r.produto_id}: ${r.motivo}`));
      }
      if (res.data.confirmados?.length > 0) toast.success(`${res.data.confirmados.length} produto(s) confirmado(s) no Fecha Mês!`);
      setSelecionados({});
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao confirmar participação');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover() {
    if (!modalRemover) return;
    setRemovendo(true);
    try {
      await apiParceiro.delete(`/parceiro/fecha-mes/produtos/${modalRemover.id}`);
      toast.success('Produto removido dessa edição.');
      setModalRemover(null);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover produto');
    } finally {
      setRemovendo(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: `${ROXO}33`, borderTopColor: ROXO }} />
      </div>
    );
  }

  if (!info?.pode_participar) return <BannerUpgrade />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: PRETO }}>
          <Flame className="w-5 h-5" style={{ color: VERMELHO }} /> Fecha Mês
        </h1>
        <p className="text-slate-500 text-sm mt-1">A super promoção de 24h do IUB MAIS — benefício do seu plano, com bônus exclusivo.</p>
      </div>

      <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${ROXO} 0%, #7C3AED 100%)` }}>
        <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Próximo Fecha Mês</p>
        <p className="text-2xl font-extrabold mt-1">{formatarData(info.data_evento)}</p>
        <p className="text-white/80 text-sm mt-1">
          {info.ativo_hoje ? '🔥 Está ativo agora!' : `Faltam ${info.dias_restantes} dia${info.dias_restantes === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold" style={{ color: podeEditar ? DOURADO : '#FCA5A5' }}>
          <Clock className="w-3.5 h-3.5" />
          {podeEditar
            ? `Você pode editar até ${formatarData(info.prazo_edicao.slice(0, 10))}`
            : `🔒 Edição encerrada — próximo Fecha Mês em ${formatarDataCurta(info.data_evento)}`}
        </div>
      </div>

      <ProgressoDuplo
        catalogoAtual={confirmadosCatalogo.length + qtdSelecionados} catalogoLimite={info.limite_catalogo}
        bonusAtual={confirmadosBonus.length} bonusLimite={info.limite_bonus}
      />

      {podeEditar && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-sm" style={{ color: PRETO }}>Produtos do catálogo</h2>
            <span className="text-xs font-semibold text-slate-400">{confirmadosCatalogo.length + qtdSelecionados} / {info.limite_catalogo}</span>
          </div>
          <p className="text-slate-400 text-xs mb-4">Você pode editar preço/estoque ou remover até 3 dias antes do evento.</p>

          {confirmadosCatalogo.length > 0 && (
            <div className="space-y-2 mb-4">
              {confirmadosCatalogo.map(c => (
                <ItemConfirmado key={c.id} item={c} onEditar={() => setModalEditar(c)} onRemover={() => setModalRemover(c)} />
              ))}
            </div>
          )}

          {info.limite_catalogo === 0 ? (
            <p className="text-slate-400 text-xs text-center py-4">Seu plano não inclui vagas de catálogo no Fecha Mês — participe com produtos bônus abaixo.</p>
          ) : produtosDisponiveis.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-4">
              {produtos.length === 0 ? 'Cadastre produtos ativos pra poder participar.' : 'Todos os seus produtos já foram confirmados ou você atingiu o limite.'}
            </p>
          ) : (
            <div className="space-y-2">
              {produtosDisponiveis.map(p => {
                const marcado = p.id in selecionados;
                return (
                  <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${marcado ? 'border-purple-200 bg-purple-50' : 'border-slate-100'}`}>
                    <input type="checkbox" checked={marcado} onChange={() => alternarSelecao(p)} className="w-4 h-4 flex-shrink-0" style={{ accentColor: ROXO }} />
                    <div className="w-9 h-9 rounded-lg bg-slate-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {p.fotos?.[0]?.url && <img src={p.fotos[0].url} alt="" className="w-full h-full object-contain" />}
                    </div>
                    <p className="text-sm font-medium flex-1 truncate" style={{ color: PRETO }}>{p.nome}</p>
                    <p className="text-xs text-slate-400 line-through flex-shrink-0">{formatarPreco(p.preco)}</p>
                    {marcado && (
                      <CampoPreco
                        value={selecionados[p.id]} onChange={v => mudarPreco(p.id, v)}
                        className="w-28 px-2 py-1.5 text-sm border border-slate-200 rounded-lg flex-shrink-0"
                        placeholder="Preço Fecha Mês"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {qtdSelecionados > 0 && (
            <button
              type="button" onClick={confirmarParticipacao} disabled={enviando}
              className="mt-4 w-full text-sm font-bold py-2.5 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: ROXO }}
            >
              {enviando ? 'Confirmando...' : `Confirmar participação (${qtdSelecionados} produto${qtdSelecionados === 1 ? '' : 's'})`}
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-sm flex items-center gap-1.5" style={{ color: PRETO }}>
            <Gift className="w-4 h-4" style={{ color: DOURADO }} /> Produtos bônus (exclusivos dessa edição)
          </h2>
          <span className="text-xs font-semibold text-slate-400">{confirmadosBonus.length} / {info.limite_bonus}</span>
        </div>
        <p className="text-slate-400 text-xs mb-4">Não entram no seu catálogo normal — só aparecem no Fecha Mês.</p>

        {confirmadosBonus.length > 0 && (
          <div className="space-y-2 mb-4">
            {confirmadosBonus.map(c => (
              <ItemConfirmado key={c.id} item={c} onEditar={podeEditar ? () => setModalEditar(c) : null} onRemover={podeEditar ? () => setModalRemover(c) : null} />
            ))}
          </div>
        )}

        {podeEditar && vagasBonus > 0 && (
          <button
            type="button" onClick={() => setModalBonus(true)}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-lg border-2 border-dashed transition-colors hover:bg-slate-50"
            style={{ borderColor: DOURADO, color: '#92700C' }}
          >
            <Plus className="w-4 h-4" /> Adicionar produto bônus ({confirmadosBonus.length}/{info.limite_bonus})
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-bold text-sm mb-4 flex items-center gap-1.5" style={{ color: PRETO }}>
          <TrendingUp className="w-4 h-4" style={{ color: ROXO }} /> Histórico
        </h2>
        {!historico ? (
          <p className="text-slate-400 text-xs">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-4">Você ainda não participou de nenhuma edição do Fecha Mês.</p>
        ) : (
          <div className="space-y-2">
            {historico.map(h => (
              <div key={h.data_evento} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 text-sm">
                <span className="font-medium" style={{ color: PRETO }}>{formatarData(h.data_evento)}</span>
                <span className="text-xs text-slate-400">{h.produtos_participantes} produto{h.produtos_participantes === 1 ? '' : 's'}</span>
                <span className="text-xs font-bold" style={{ color: ROXO }}>{h.cliques_no_dia} cliques</span>
                <span className="text-[11px] text-slate-400">vs {h.media_cliques_dia_normal} num dia normal</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalBonus && (
        <ModalProdutoBonus
          onClose={() => setModalBonus(null)}
          onSaved={() => { setModalBonus(null); carregar(); }}
        />
      )}

      {modalEditar && (
        <ModalEditarItem
          item={modalEditar}
          onClose={() => setModalEditar(null)}
          onSaved={() => { setModalEditar(null); carregar(); }}
        />
      )}

      {modalRemover && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={() => setModalRemover(null)}>
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold" style={{ color: PRETO }}>Remover produto?</h2>
            <p className="text-slate-600 text-sm mt-2">
              Tem certeza? Você poderá adicionar outro produto no lugar (se ainda estiver dentro do prazo de edição).
            </p>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setModalRemover(null)} disabled={removendo} className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                type="button" onClick={handleRemover} disabled={removendo}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-xl text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
              >
                {removendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressoDuplo({ catalogoAtual, catalogoLimite, bonusAtual, bonusLimite }) {
  const total = catalogoAtual + bonusAtual;
  const totalLimite = catalogoLimite + bonusLimite;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <BarraProgresso label="Produtos do catálogo" atual={catalogoAtual} limite={catalogoLimite} cor={AZUL} />
      <BarraProgresso label="Produtos bônus" atual={bonusAtual} limite={bonusLimite} cor={DOURADO} />
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-sm font-bold" style={{ color: PRETO }}>Total</span>
        <span className="text-sm font-black" style={{ color: ROXO }}>{total} / {totalLimite}</span>
      </div>
    </div>
  );
}

function BarraProgresso({ label, atual, limite, cor }) {
  const pct = limite > 0 ? Math.min(100, Math.round((atual / limite) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: cor }}>{atual}</span>
          <span className="text-xs text-slate-400">/ {limite}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
    </div>
  );
}

function ItemConfirmado({ item, onEditar, onRemover }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
      <div className="w-9 h-9 rounded-lg bg-white flex-shrink-0 overflow-hidden flex items-center justify-center">
        {item.fotos?.[0]?.url && <img src={item.fotos[0].url} alt="" className="w-full h-full object-contain" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: PRETO }}>{item.nome}</p>
        {item.estoque_disponivel != null && <p className="text-[11px] text-slate-400">Estoque: {item.estoque_disponivel}</p>}
      </div>
      <p className="text-xs text-slate-400 line-through">{formatarPreco(item.preco_original)}</p>
      <p className="text-sm font-bold" style={{ color: VERMELHO }}>{formatarPreco(item.preco_fecha_mes)}</p>
      {(onEditar || onRemover) ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEditar && (
            <button type="button" onClick={onEditar} className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 transition-colors" title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onRemover && (
            <button type="button" onClick={onRemover} className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-red-600 transition-colors" title="Remover">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <span className="text-[10px] font-bold text-emerald-600 uppercase flex-shrink-0">Confirmado</span>
      )}
    </div>
  );
}

function ModalProdutoBonus({ onClose, onSaved }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [precoOriginal, setPrecoOriginal] = useState('');
  const [precoFechaMes, setPrecoFechaMes] = useState('');
  const [estoque, setEstoque] = useState('');
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef(null);

  function escolherFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setPreview(URL.createObjectURL(file));
  }

  const precoOK = parseFloat(precoOriginal) > 0 && parseFloat(precoFechaMes) > 0 && parseFloat(precoFechaMes) < parseFloat(precoOriginal);
  const podeSalvar = nome.trim().length >= 3 && precoOK && !!foto;

  async function salvar() {
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('nome', nome.trim());
      if (descricao.trim()) fd.append('descricao', descricao.trim());
      fd.append('preco_original', precoOriginal);
      fd.append('preco_fecha_mes', precoFechaMes);
      if (estoque) fd.append('estoque_disponivel', estoque);
      fd.append('foto', foto);
      await apiParceiro.post('/parceiro/fecha-mes/produto-bonus', fd);
      toast.success('Produto bônus cadastrado!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar produto bônus');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold flex items-center gap-1.5" style={{ color: PRETO }}>
          <Gift className="w-5 h-5" style={{ color: DOURADO }} /> Adicionar produto bônus
        </h2>
        <p className="text-slate-500 text-xs mt-1">Exclusivo dessa edição — não vai pro seu catálogo normal.</p>

        <div className="space-y-3 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nome do produto *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Ex: Kit degustação" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição curta (opcional)</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Foto *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full h-32 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-slate-300 overflow-hidden bg-slate-50"
            >
              {preview ? <img src={preview} alt="" className="w-full h-full object-contain" /> : (
                <span className="flex flex-col items-center gap-1 text-slate-400 text-xs">
                  <Upload className="w-5 h-5" /> Escolher foto
                </span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={escolherFoto} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Preço original *</label>
              <CampoPreco value={precoOriginal} onChange={setPrecoOriginal} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Preço Fecha Mês *</label>
              <CampoPreco value={precoFechaMes} onChange={setPrecoFechaMes} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
          </div>
          {precoOriginal && precoFechaMes && !precoOK && (
            <p className="text-xs text-red-600">Preço Fecha Mês precisa ser menor que o preço original.</p>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Estoque disponível (opcional)</label>
            <input type="number" min="1" value={estoque} onChange={e => setEstoque(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Ex: 10" />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} disabled={salvando} className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="button" onClick={salvar} disabled={!podeSalvar || salvando}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-xl text-white disabled:opacity-50"
            style={{ backgroundColor: ROXO }}
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalEditarItem({ item, onClose, onSaved }) {
  const [nome, setNome] = useState(item.nome);
  const [descricao, setDescricao] = useState(item.descricao || '');
  const [precoOriginal, setPrecoOriginal] = useState(item.preco_original);
  const [precoFechaMes, setPrecoFechaMes] = useState(item.preco_fecha_mes);
  const [estoque, setEstoque] = useState(item.estoque_disponivel ?? '');
  const [salvando, setSalvando] = useState(false);

  const precoOK = parseFloat(precoFechaMes) > 0 && parseFloat(precoFechaMes) < parseFloat(precoOriginal || item.preco_original);
  const podeSalvar = (!item.e_produto_bonus || nome.trim().length >= 3) && precoOK;

  async function salvar() {
    setSalvando(true);
    try {
      const payload = { preco_fecha_mes: precoFechaMes, estoque_disponivel: estoque === '' ? null : estoque };
      if (item.e_produto_bonus) {
        payload.nome = nome.trim();
        payload.descricao = descricao.trim() || null;
        payload.preco_original = precoOriginal;
      }
      await apiParceiro.put(`/parceiro/fecha-mes/produtos/${item.id}`, payload);
      toast.success('Produto atualizado!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao editar produto');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold" style={{ color: PRETO }}>Editar produto</h2>

        <div className="space-y-3 mt-4">
          {item.e_produto_bonus && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição curta</label>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none" />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Preço original {item.e_produto_bonus ? '' : '(fixo)'}</label>
              {item.e_produto_bonus ? (
                <CampoPreco value={precoOriginal} onChange={setPrecoOriginal} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              ) : (
                <input readOnly value={formatarPreco(precoOriginal)} className="w-full px-3 py-2 text-sm border border-slate-100 rounded-lg bg-slate-50 text-slate-400" />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Preço Fecha Mês</label>
              <CampoPreco value={precoFechaMes} onChange={setPrecoFechaMes} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
            </div>
          </div>
          {!precoOK && <p className="text-xs text-red-600">Preço Fecha Mês precisa ser menor que o preço original.</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Estoque disponível (opcional)</label>
            <input type="number" min="1" value={estoque} onChange={e => setEstoque(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} disabled={salvando} className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="button" onClick={salvar} disabled={!podeSalvar || salvando}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-xl text-white disabled:opacity-50"
            style={{ backgroundColor: ROXO }}
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function BannerUpgrade() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
      <Lock className="w-8 h-8 mx-auto text-slate-300" />
      <h1 className="font-bold text-lg mt-4" style={{ color: PRETO }}>Fecha Mês indisponível pro seu plano</h1>
      <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
        Todo último sexta do mês, seus produtos entram numa vitrine especial com destaque e comunicação pros associados.
      </p>
      <Link
        to="/parceiro/painel/planos"
        className="inline-flex items-center gap-1.5 mt-5 text-sm font-bold px-5 py-2.5 rounded-xl text-white"
        style={{ backgroundColor: ROXO }}
      >
        Ver planos
      </Link>
    </div>
  );
}
