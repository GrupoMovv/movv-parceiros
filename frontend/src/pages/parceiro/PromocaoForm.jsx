import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Upload, Loader2, Send, TrendingDown } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';
import { CATEGORIAS_FILTRO } from '../public/Marketplace/parceirosData';
import CampoPreco from '../../components/ui/CampoPreco';

const CATEGORIAS = CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').map(c => c.label);
const DURACOES_RAPIDAS = [
  { label: '24h', horas: 24 },
  { label: '3 dias', horas: 72 },
  { label: '7 dias', horas: 168 },
  { label: '15 dias', horas: 360 },
  { label: '30 dias', horas: 720 },
];

const VAZIO = {
  produto_id: '', titulo: '', descricao: '', categoria: '',
  preco_de: '', preco_por: '', preco_associado: '',
  data_inicio: '', data_fim: '', limite_usos: '',
  destaque: false, exclusivo_associado: false,
};

// <input type="datetime-local"> quer "YYYY-MM-DDTHH:mm" em horário local,
// sem timezone — Date#toISOString() sempre devolve UTC, por isso o ajuste
// manual do offset antes de cortar a string.
function paraDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function ParceiroPromocaoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const modoEdicao = id && id !== 'novo';

  const [promocaoId, setPromocaoId] = useState(modoEdicao ? id : null);
  const [form, setForm] = useState(VAZIO);
  const [vinculacao, setVinculacao] = useState('livre'); // 'produto' | 'livre'
  const [produtos, setProdutos] = useState([]);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [fotoPendente, setFotoPendente] = useState(null); // { file, preview }
  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  useEffect(() => {
    apiParceiro.get('/parceiro/produtos', { params: { status: 'ativo' } })
      .then(res => setProdutos(res.data.produtos))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modoEdicao) return;
    apiParceiro.get(`/parceiro/promocoes/${id}`).then(res => {
      const p = res.data;
      setForm({
        produto_id: p.produto_id || '', titulo: p.titulo, descricao: p.descricao || '', categoria: p.categoria || '',
        preco_de: p.preco_de, preco_por: p.preco_por, preco_associado: p.preco_associado || '',
        data_inicio: paraDatetimeLocal(p.data_inicio), data_fim: paraDatetimeLocal(p.data_fim),
        limite_usos: p.limite_usos || '', destaque: p.destaque, exclusivo_associado: p.exclusivo_associado,
      });
      setVinculacao(p.produto_id ? 'produto' : 'livre');
      setFotoUrl(p.foto_url);
    }).catch(() => toast.error('Erro ao carregar promoção')).finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  function setCampo(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

  function escolherProduto(produtoId) {
    setCampo('produto_id', produtoId);
    const produto = produtos.find(p => String(p.id) === String(produtoId));
    if (produto) {
      setForm(f => ({
        ...f, produto_id: produtoId,
        titulo: f.titulo || produto.nome,
        categoria: f.categoria || produto.categoria || '',
        preco_de: f.preco_de || produto.preco,
      }));
    }
  }

  function aplicarDuracaoRapida(horas) {
    const inicio = form.data_inicio ? new Date(form.data_inicio) : new Date();
    if (!form.data_inicio) setCampo('data_inicio', paraDatetimeLocal(inicio.toISOString()));
    const fim = new Date(inicio.getTime() + horas * 3600 * 1000);
    setCampo('data_fim', paraDatetimeLocal(fim.toISOString()));
  }

  function validar() {
    if (form.titulo.trim().length < 3) return 'Título precisa ter pelo menos 3 caracteres';
    const de = parseFloat(form.preco_de);
    const por = parseFloat(form.preco_por);
    if (!Number.isFinite(de) || de <= 0) return 'Preço "De" é obrigatório';
    if (!Number.isFinite(por) || por <= 0) return 'Preço "Por" é obrigatório';
    if (por >= de) return 'Preço "Por" precisa ser menor que o preço "De"';
    if (form.preco_associado) {
      const pa = parseFloat(form.preco_associado);
      if (!Number.isFinite(pa) || pa <= 0) return 'Preço associado inválido';
      if (pa >= por) return 'Preço associado precisa ser menor que o preço promocional';
    }
    if (!form.data_inicio) return 'Informe a data de início';
    if (!form.data_fim) return 'Informe a data de término';
    if (new Date(form.data_fim) <= new Date(form.data_inicio)) return 'A data de término precisa ser depois da data de início';
    return null;
  }

  // O backend valida os campos por completo mesmo pra rascunho (mesmo
  // padrão do produto, ver ProdutoForm.jsx) — "rascunho" só decide se fica
  // visível no marketplace, não dispensa preço/data válidos.
  async function handleSalvar(rascunho) {
    const erro = validar();
    if (erro) return toast.error(erro);

    setSalvando(true);
    const payload = {
      ...form,
      produto_id: vinculacao === 'produto' ? (form.produto_id || null) : null,
      preco_de: parseFloat(form.preco_de),
      preco_por: parseFloat(form.preco_por),
      preco_associado: form.preco_associado ? parseFloat(form.preco_associado) : null,
      limite_usos: form.limite_usos ? parseInt(form.limite_usos, 10) : null,
      data_inicio: new Date(form.data_inicio).toISOString(),
      data_fim: new Date(form.data_fim).toISOString(),
      rascunho,
      ativo: !rascunho,
    };

    try {
      if (promocaoId) {
        await apiParceiro.put(`/parceiro/promocoes/${promocaoId}`, payload);
        toast.success('Promoção atualizada!');
      } else {
        const res = await apiParceiro.post('/parceiro/promocoes', payload);
        setPromocaoId(res.data.id);
        navigate(`/parceiro/painel/promocoes/${res.data.id}`, { replace: true });
        toast.success(rascunho ? 'Rascunho salvo! Agora você já pode adicionar uma foto.' : 'Promoção publicada!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar promoção');
    } finally {
      setSalvando(false);
    }
  }

  function selecionarFoto(files) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('A imagem precisa ter até 5MB');
    setFotoPendente({ file, preview: URL.createObjectURL(file) });
  }

  async function confirmarEnvioFoto() {
    if (!fotoPendente) return;
    setEnviandoFoto(true);
    try {
      const fd = new FormData();
      fd.append('foto', fotoPendente.file);
      const res = await apiParceiro.post(`/parceiro/promocoes/${promocaoId}/foto`, fd);
      setFotoUrl(res.data.foto_url);
      URL.revokeObjectURL(fotoPendente.preview);
      setFotoPendente(null);
      toast.success('Foto enviada!');
    } catch (err) {
      const d = err.response?.data;
      toast.error(d?.detalhes ? `${d.error} (${d.detalhes} — código ${d.codigo})` : (d?.error || 'Erro ao enviar foto'), { duration: 8000 });
    } finally {
      setEnviandoFoto(false);
    }
  }

  if (carregando) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;
  }

  const de = parseFloat(form.preco_de);
  const por = parseFloat(form.preco_por);
  const descontoPct = Number.isFinite(de) && Number.isFinite(por) && de > 0 && por < de ? Math.round(((de - por) / de) * 100) : null;
  const produtoSelecionado = produtos.find(p => String(p.id) === String(form.produto_id));
  const fotoExibida = fotoUrl || fotoPendente?.preview || produtoSelecionado?.fotos?.[0]?.url;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-6">
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>{modoEdicao ? 'Editar promoção' : 'Nova promoção'}</h1>

        <Secao titulo="Vinculação">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: PRETO }}>
              <input type="radio" checked={vinculacao === 'produto'} onChange={() => setVinculacao('produto')} /> Promoção de produto existente
            </label>
            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: PRETO }}>
              <input type="radio" checked={vinculacao === 'livre'} onChange={() => { setVinculacao('livre'); setCampo('produto_id', ''); }} /> Promoção livre
            </label>
          </div>
          {vinculacao === 'produto' && (
            <div className="mt-4">
              <Label>Produto</Label>
              <select value={form.produto_id} onChange={e => escolherProduto(e.target.value)} className={campoCls}>
                <option value="">Selecione um produto</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              {produtos.length === 0 && <p className="text-xs text-slate-400 mt-1.5">Você ainda não tem produtos ativos cadastrados.</p>}
            </div>
          )}
        </Secao>

        <Secao titulo="Detalhes">
          <Campo label={`Título (${form.titulo.length}/100)`} value={form.titulo} onChange={v => setCampo('titulo', v.slice(0, 100))} />
          <div className="mt-4">
            <Label>Descrição ({form.descricao.length}/500)</Label>
            <textarea value={form.descricao} onChange={e => setCampo('descricao', e.target.value.slice(0, 500))} rows={3} className={campoCls} />
          </div>
          <div className="mt-4">
            <Label>Categoria</Label>
            <select value={form.categoria} onChange={e => setCampo('categoria', e.target.value)} className={campoCls}>
              <option value="">Selecione</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="mt-4">
            <Label>Foto {vinculacao === 'produto' && produtoSelecionado?.fotos?.[0]?.url ? '(opcional — já usa a do produto)' : ''}</Label>
            {!promocaoId ? (
              <p className="text-slate-400 text-xs">Salve a promoção primeiro pra poder enviar uma foto própria.</p>
            ) : (
              <>
                <label className="border-2 border-dashed rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-slate-300 transition-colors" style={{ borderColor: '#E2E8F0' }}>
                  <Upload className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-500">Clique pra escolher uma imagem (até 5MB)</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { selecionarFoto(e.target.files); e.target.value = ''; }} />
                </label>
                {fotoPendente && (
                  <button type="button" onClick={confirmarEnvioFoto} disabled={enviandoFoto}
                    className="mt-2 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-60" style={{ backgroundColor: ROXO }}>
                    {enviandoFoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar foto
                  </button>
                )}
              </>
            )}
          </div>
        </Secao>

        <Secao titulo="Preços e vigência">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Preço original — De" value={form.preco_de} onChange={v => setCampo('preco_de', v)} type="money" />
            <Campo label="Preço promocional — Por" value={form.preco_por} onChange={v => setCampo('preco_por', v)} type="money" />
          </div>
          {descontoPct !== null && (
            <p className="flex items-center gap-1.5 text-xs font-semibold mt-2" style={{ color: '#166534' }}>
              <TrendingDown className="w-3.5 h-3.5" /> {descontoPct}% de desconto
            </p>
          )}

          <div className="mt-4">
            <Label>Duração rápida</Label>
            <div className="flex flex-wrap gap-2">
              {DURACOES_RAPIDAS.map(d => (
                <button key={d.label} type="button" onClick={() => aplicarDuracaoRapida(d.horas)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Campo label="Data de início" value={form.data_inicio} onChange={v => setCampo('data_inicio', v)} type="datetime-local" />
            <Campo label="Data de término" value={form.data_fim} onChange={v => setCampo('data_fim', v)} type="datetime-local" />
          </div>

          <Campo label="Preço associado (opcional)" value={form.preco_associado} onChange={v => setCampo('preco_associado', v)} type="money" className="mt-4" />
          <Campo label="Limite de usos (opcional — ex: primeiros 20)" value={form.limite_usos} onChange={v => setCampo('limite_usos', v)} type="number" className="mt-4" />

          <div className="flex flex-col gap-2 mt-4">
            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: PRETO }}>
              <input type="checkbox" checked={form.destaque} onChange={e => setCampo('destaque', e.target.checked)} className="rounded" />
              Colocar em destaque no meu perfil
            </label>
            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: PRETO }}>
              <input type="checkbox" checked={form.exclusivo_associado} onChange={e => setCampo('exclusivo_associado', e.target.checked)} className="rounded" />
              Marcar como exclusivo pra associados SECI
            </label>
          </div>
        </Secao>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => handleSalvar(false)} disabled={salvando}
            className="flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
            style={{ backgroundColor: ROXO }}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Publicar Promoção
          </button>
          <button type="button" onClick={() => handleSalvar(true)} disabled={salvando}
            className="text-sm font-semibold px-6 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60">
            Salvar Rascunho
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Como vai aparecer no marketplace</p>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="relative aspect-square bg-slate-50 flex items-center justify-center">
            {fotoExibida ? <img src={fotoExibida} alt="" className="w-full h-full object-cover" /> : <span className="text-slate-300 text-xs">Sem foto</span>}
            {descontoPct !== null && (
              <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-full" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
                {descontoPct}% OFF
              </span>
            )}
          </div>
          <div className="p-3">
            <p className="font-bold text-sm truncate" style={{ color: PRETO }}>{form.titulo || 'Título da promoção'}</p>
            <div className="flex items-center gap-2 mt-1">
              {form.preco_de && <span className="text-xs text-slate-400 line-through">R$ {parseFloat(form.preco_de || 0).toFixed(2)}</span>}
              <span className="font-bold text-sm" style={{ color: ROXO }}>R$ {parseFloat(form.preco_por || 0).toFixed(2)}</span>
            </div>
            {form.exclusivo_associado && (
              <span className="inline-block mt-1.5 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}>
                💎 Exclusivo SECI
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';

function Label({ children }) {
  return <label className="block text-xs font-semibold text-slate-500 mb-1.5">{children}</label>;
}

function Campo({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {type === 'money' ? (
        <CampoPreco value={value} onChange={onChange} className={campoCls} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className={campoCls} />
      )}
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-bold text-base mb-5" style={{ color: PRETO }}>{titulo}</h2>
      {children}
    </div>
  );
}
