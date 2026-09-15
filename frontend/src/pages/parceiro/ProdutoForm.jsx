import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, Loader2, Star, Lightbulb, Check, Send } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';
import { CATEGORIAS_FILTRO } from '../public/Marketplace/parceirosData';
import CampoPreco from '../../components/ui/CampoPreco';
import ImageCropUpload from '../../components/ImageCropUpload';
import IACadastroProduto from '../../components/IACadastroProduto';

const CATEGORIAS = CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').map(c => c.label);
const DICAS = [
  'Formato quadrado (1200x1200) fica melhor',
  'Fundo branco ou neutro',
  'Produto centralizado',
  'Boa iluminação',
  'Não precisa ser foto profissional!',
];
const LIMITE_FOTOS = 3;
const VAZIO = { nome: '', descricao: '', categoria: '', marca: '', preco: '', preco_associado: '', estoque_disponivel: true, destaque: false };

export default function ParceiroProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const modoEdicao = id && id !== 'novo';

  const [produtoId, setProdutoId] = useState(modoEdicao ? id : null);
  const [form, setForm] = useState(VAZIO);
  const [fotos, setFotos] = useState([]);
  const [pendentes, setPendentes] = useState([]); // fotos escolhidas, com preview local, antes de confirmar o envio
  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [fotoDaIA, setFotoDaIA] = useState(null); // File já recortado, guardado em memória até o produto ser criado
  const [fotoDaIAPreview, setFotoDaIAPreview] = useState(null);
  const [mostrarBannerIA, setMostrarBannerIA] = useState(true);
  const [statusIA, setStatusIA] = useState(null); // { trial_ativo, trial_dias_restantes, limite, usados }
  const pendentesRef = useRef(pendentes);
  pendentesRef.current = pendentes;
  const fotoDaIAPreviewRef = useRef(fotoDaIAPreview);
  fotoDaIAPreviewRef.current = fotoDaIAPreview;

  // Libera a memória dos previews locais só ao desmontar a página — usa ref
  // (não `pendentes` direto na dependência) pra não revogar os URLs ainda em
  // uso toda vez que o usuário adiciona/remove uma foto da seleção.
  useEffect(() => {
    return () => {
      pendentesRef.current.forEach(p => URL.revokeObjectURL(p.preview));
      if (fotoDaIAPreviewRef.current) URL.revokeObjectURL(fotoDaIAPreviewRef.current);
    };
  }, []);

  // Contador "IA: X/Y usos este mês" / banner de trial — só usado na tela
  // de produto novo (banner de IA), não custa buscar sempre.
  useEffect(() => {
    apiParceiro.get('/parceiro/produtos/ia-status').then(res => setStatusIA(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modoEdicao) return;
    apiParceiro.get(`/parceiro/produtos/${id}`).then(res => {
      const p = res.data;
      setForm({
        nome: p.nome, descricao: p.descricao, categoria: p.categoria || '', marca: p.marca || '',
        preco: p.preco, preco_associado: p.preco_associado || '',
        estoque_disponivel: p.estoque_disponivel, destaque: p.destaque,
      });
      setFotos(p.fotos || []);
    }).catch(() => toast.error('Erro ao carregar produto')).finally(() => setCarregando(false));
  }, [id, modoEdicao]);

  function setCampo(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

  // Callback do IACadastroProduto — pré-preenche o formulário normal com o
  // que a IA sugeriu (o parceiro ainda confere/edita tudo aqui) e guarda a
  // foto já recortada EM MEMÓRIA (nunca sobe nada ainda: não existe
  // produtoId nesse momento). A foto só é enviada de verdade dentro de
  // handleSalvar, junto com a criação do produto — ver enviarFotoDaIA().
  function aplicarSugestaoIA(dadosIA) {
    setForm(f => ({
      ...f,
      nome: dadosIA.nome || f.nome,
      descricao: dadosIA.descricao || f.descricao,
      categoria: dadosIA.categoria || f.categoria,
      marca: dadosIA.marca || f.marca,
    }));
    if (dadosIA.foto) {
      setFotoDaIA(dadosIA.foto);
      setFotoDaIAPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(dadosIA.foto); });
    }
  }

  function removerFotoDaIA() {
    if (fotoDaIAPreview) URL.revokeObjectURL(fotoDaIAPreview);
    setFotoDaIA(null);
    setFotoDaIAPreview(null);
  }

  function validar() {
    if (form.nome.trim().length < 3) return 'Nome precisa ter pelo menos 3 caracteres';
    if (form.descricao.trim().length < 20) return 'Descrição precisa ter pelo menos 20 caracteres';
    const preco = parseFloat(form.preco);
    if (!Number.isFinite(preco) || preco <= 0) return 'Preço normal é obrigatório e deve ser maior que zero';
    if (form.preco_associado) {
      const pa = parseFloat(form.preco_associado);
      if (!Number.isFinite(pa) || pa <= 0) return 'Preço associado inválido';
      if (pa >= preco) return 'Preço associado deve ser menor que o preço normal';
    }
    return null;
  }

  async function handleSalvar(rascunho) {
    const erro = validar();
    if (erro) return toast.error(erro);

    setSalvando(true);
    const payload = {
      ...form,
      preco: parseFloat(form.preco),
      preco_associado: form.preco_associado ? parseFloat(form.preco_associado) : null,
      rascunho,
      ativo: !rascunho,
    };
    try {
      if (produtoId) {
        await apiParceiro.put(`/parceiro/produtos/${produtoId}`, payload);
        toast.success('Produto atualizado!');
      } else {
        const res = await apiParceiro.post('/parceiro/produtos', payload);
        const novoId = res.data.id;
        setProdutoId(novoId);
        navigate(`/parceiro/painel/produtos/${novoId}`, { replace: true });

        // Veio do fluxo de IA: a foto já recortada sobe automaticamente
        // junto com a criação, num único clique em "Publicar"/"Salvar
        // rascunho" — sem isso o parceiro precisaria confirmar o envio de
        // novo depois, o que era exatamente o bug reportado (a seção
        // "Fotos" ficava bloqueada dizendo "salve primeiro" mesmo já tendo
        // uma foto escolhida via IA).
        if (fotoDaIA) {
          await enviarFotoDaIA(novoId, fotoDaIA);
        } else {
          toast.success(rascunho ? 'Rascunho salvo! Agora você já pode adicionar fotos.' : 'Produto publicado!');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar produto');
    } finally {
      setSalvando(false);
    }
  }

  // Sobe a foto que veio do fluxo de IA assim que o produto acaba de ser
  // criado — reusa o mesmo endpoint do upload manual (POST .../fotos), só
  // que disparado automaticamente em vez de esperar o parceiro clicar
  // "Enviar foto". Falha aqui não desfaz a criação do produto (que já
  // aconteceu) — só avisa que a foto precisa ser adicionada manualmente.
  async function enviarFotoDaIA(produtoIdAlvo, file) {
    try {
      const fd = new FormData();
      fd.append('fotos', file);
      const res = await apiParceiro.post(`/parceiro/produtos/${produtoIdAlvo}/fotos`, fd);
      setFotos(res.data.fotos);
      toast.success('Produto criado com a foto da IA! 🎉');
    } catch (err) {
      const d = err.response?.data;
      toast.error(
        d?.detalhes
          ? `Produto criado, mas o envio da foto falhou (${d.error} — ${d.detalhes}). Adicione manualmente ali embaixo.`
          : 'Produto criado! A foto da IA não pôde ser enviada agora — adicione manualmente ali embaixo.',
        { duration: 8000 }
      );
    } finally {
      if (fotoDaIAPreview) URL.revokeObjectURL(fotoDaIAPreview);
      setFotoDaIA(null);
      setFotoDaIAPreview(null);
    }
  }

  // Chamado pelo ImageCropUpload uma vez pra cada foto já recortada
  // (quadrada) e comprimida — só monta o preview local, o upload de
  // verdade só acontece quando o parceiro confirma em confirmarEnvio().
  function aoRecortarFoto(file) {
    if (fotos.length + pendentesRef.current.length >= LIMITE_FOTOS) {
      toast.error(`Máximo de ${LIMITE_FOTOS} fotos por produto`);
      return;
    }
    setPendentes(p => [...p, { file, preview: URL.createObjectURL(file) }]);
  }

  function cancelarPendente(index) {
    setPendentes(p => {
      URL.revokeObjectURL(p[index].preview);
      return p.filter((_, i) => i !== index);
    });
  }

  async function confirmarEnvio() {
    if (!pendentes.length) return;
    setEnviandoFotos(true);
    try {
      const fd = new FormData();
      pendentes.forEach(p => fd.append('fotos', p.file));
      const res = await apiParceiro.post(`/parceiro/produtos/${produtoId}/fotos`, fd);
      setFotos(res.data.fotos);
      pendentes.forEach(p => URL.revokeObjectURL(p.preview));
      setPendentes([]);
      toast.success('Fotos enviadas!');
    } catch (err) {
      const d = err.response?.data;
      // "detalhes"/"codigo" só vêm quando o erro é do Cloudinary (ver
      // cloudinaryService.js) — mostrar isso no toast é temporário, pra
      // debugar o bug de upload sem precisar abrir log do Render.
      toast.error(d?.detalhes ? `${d.error} (${d.detalhes} — código ${d.codigo})` : (d?.error || 'Erro ao enviar fotos'), { duration: 8000 });
    } finally {
      setEnviandoFotos(false);
    }
  }

  async function removerFoto(index) {
    try {
      const res = await apiParceiro.delete(`/parceiro/produtos/${produtoId}/fotos/${index}`);
      setFotos(res.data.fotos);
    } catch {
      toast.error('Erro ao remover foto');
    }
  }

  if (carregando) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-6">
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>{modoEdicao ? 'Editar produto' : 'Novo produto'}</h1>

        {!produtoId && mostrarBannerIA && (
          <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #FFF7E0 0%, #FFFFFF 100%)', border: '1px solid #FDE9B8' }}>
            <p className="font-black text-sm" style={{ color: PRETO }}>🎊 NOVO! Cadastro com IA</p>
            <p className="text-slate-500 text-xs mt-1 mb-4">Nossa IA reconhece o produto na foto e preenche nome, descrição, marca e categoria pra você — de 3-5 minutos pra 30 segundos.</p>
            {statusIA?.trial_ativo && (
              <p className="text-center text-xs font-bold px-3 py-1.5 rounded-full mb-3" style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}>
                🎉 Trial ativo! IA ilimitada por mais {statusIA.trial_dias_restantes} {statusIA.trial_dias_restantes === 1 ? 'dia' : 'dias'}
              </p>
            )}
            <IACadastroProduto onConfirmar={aplicarSugestaoIA} />
            {statusIA && !statusIA.trial_ativo && (
              <p className="text-center text-[11px] text-slate-400 mt-2">
                IA: {statusIA.usados}/{statusIA.limite ?? '∞'} usos este mês ({statusIA.plano})
              </p>
            )}
            <button type="button" onClick={() => setMostrarBannerIA(false)} className="block mx-auto text-xs text-slate-400 underline mt-3">
              Cadastrar manualmente
            </button>
          </div>
        )}

        <Secao titulo="Informações">
          <Campo label={`Nome do produto (${form.nome.length}/100)`} value={form.nome} onChange={v => setCampo('nome', v.slice(0, 100))} />
          <div className="mt-4">
            <Label>Descrição ({form.descricao.length}/500) — bem descritas ganham selo de qualidade IUB MAIS</Label>
            <textarea value={form.descricao} onChange={e => setCampo('descricao', e.target.value.slice(0, 500))} rows={4} className={campoCls} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Categoria</Label>
              <select value={form.categoria} onChange={e => setCampo('categoria', e.target.value)} className={campoCls}>
                <option value="">Selecione</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Campo label="Marca (opcional)" value={form.marca} onChange={v => setCampo('marca', v)} />
          </div>
        </Secao>

        <Secao titulo="Fotos">
          {!produtoId && fotoDaIA && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
              <img src={fotoDaIAPreview} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-100" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: PRETO }}>✅ Foto da IA pronta</p>
                <p className="text-xs text-slate-400">Vai junto automaticamente quando você salvar o produto</p>
              </div>
              <button type="button" onClick={removerFotoDaIA} aria-label="Remover foto" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          )}
          {!produtoId && !fotoDaIA && (
            <p className="text-slate-400 text-sm text-center py-6">Salve as informações do produto primeiro pra poder adicionar fotos — ou use o "Cadastrar com IA" ali em cima, que já deixa a foto pronta pra ir junto.</p>
          )}
          {produtoId && (
            <>
              <ImageCropUpload
                aspectRatio={1}
                multiple
                disabled={fotos.length + pendentes.length >= LIMITE_FOTOS}
                label={`Adicionar fotos — até ${LIMITE_FOTOS} fotos`}
                hint="📸 Ajuste o enquadramento quadrado na tela — ideal fundo branco ou neutro"
                onCropComplete={aoRecortarFoto}
                botaoClassName="w-full border-2 border-dashed border-slate-200 hover:border-[#4C1D95] rounded-2xl p-6 text-center transition-colors flex flex-col items-center gap-2 disabled:opacity-60 disabled:cursor-default"
              />

              {/* fotos ja enviadas de verdade */}
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {fotos.map((foto, i) => (
                    <div key={foto.url} className={`relative rounded-xl overflow-hidden aspect-square border group ${i === 0 ? 'ring-2' : 'border-slate-100'}`} style={i === 0 ? { '--tw-ring-color': ROXO } : {}}>
                      <img src={foto.url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: ROXO }}>Principal</span>}
                      <button type="button" onClick={() => removerFoto(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* pendentes: preview local antes de confirmar o envio */}
              {pendentes.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Prévia — assim é a foto que você escolheu:</p>
                  <div className="grid grid-cols-3 gap-3">
                    {pendentes.map((p, i) => (
                      <div key={p.preview} className="relative rounded-xl overflow-hidden aspect-square border border-dashed border-slate-300 group">
                        <img src={p.preview} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => cancelarPendente(i)} disabled={enviandoFotos}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                          <X className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={confirmarEnvio} disabled={enviandoFotos}
                    className="mt-3 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white transition-colors disabled:opacity-60"
                    style={{ backgroundColor: ROXO }}>
                    {enviandoFotos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar {pendentes.length} {pendentes.length === 1 ? 'foto' : 'fotos'}
                  </button>
                </div>
              )}
            </>
          )}
        </Secao>

        <Secao titulo="Preços e status">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Preço normal" value={form.preco} onChange={v => setCampo('preco', v)} type="money" />
            <Campo label="Preço associado (opcional)" value={form.preco_associado} onChange={v => setCampo('preco_associado', v)} type="money" />
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: PRETO }}>
              <input type="checkbox" checked={form.estoque_disponivel} onChange={e => setCampo('estoque_disponivel', e.target.checked)} className="rounded" />
              Estoque disponível
            </label>
            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: PRETO }}>
              <input type="checkbox" checked={form.destaque} onChange={e => setCampo('destaque', e.target.checked)} className="rounded" />
              Destaque no meu perfil (até 3 produtos)
            </label>
          </div>
        </Secao>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => handleSalvar(false)} disabled={salvando}
            className="flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
            style={{ backgroundColor: ROXO }}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Publicar
          </button>
          <button type="button" onClick={() => handleSalvar(true)} disabled={salvando}
            className="text-sm font-semibold px-6 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60">
            Salvar rascunho
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-amber-700 mb-2.5">
            📸 Dicas pra foto do produto
          </p>
          <ul className="space-y-1.5">
            {DICAS.map(d => (
              <li key={d} className="flex items-start gap-1.5 text-xs text-amber-800">
                <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#166534' }} /> {d}
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-1.5 text-xs text-amber-700 mt-3 pt-3 border-t border-amber-200">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Não tem foto ideal? Nosso sistema ajusta automaticamente pra ficar boa.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Como vai aparecer no marketplace</p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center">
              {fotos[0]?.url || pendentes[0]?.preview || fotoDaIAPreview ? (
                <img src={fotos[0]?.url || pendentes[0]?.preview || fotoDaIAPreview} alt="" className="w-full h-full object-cover" />
              ) : <span className="text-slate-300 text-xs">Sem foto</span>}
              {form.destaque && (
                <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>
                  <Star className="w-2.5 h-2.5" fill="#0F0F14" /> Destaque
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="font-bold text-sm truncate" style={{ color: PRETO }}>{form.nome || 'Nome do produto'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-bold text-sm" style={{ color: ROXO }}>R$ {form.preco ? parseFloat(form.preco).toFixed(2) : '0,00'}</span>
                {form.preco_associado && <span className="text-xs text-slate-400 line-through">R$ {parseFloat(form.preco_associado).toFixed(2)}</span>}
              </div>
              {form.preco_associado && (
                <span className="inline-block mt-1.5 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}>
                  💎 Exclusivo associado
                </span>
              )}
            </div>
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

function Campo({ label, value, onChange, type = 'text' }) {
  return (
    <div>
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
