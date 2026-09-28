import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, Loader2, Star, Lightbulb, Check, Send, Plus, Trash2 } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';
import { CATEGORIAS_FILTRO } from '../public/Marketplace/parceirosData';
import CampoPreco from '../../components/ui/CampoPreco';
import ImageCropUpload from '../../components/ImageCropUpload';
import IACadastroProduto from '../../components/IACadastroProduto';
import CadastroPorVoz from '../../components/parceiro/CadastroPorVoz';
import CadastroVozGuiada from '../../components/parceiro/CadastroVozGuiada';

const CATEGORIAS = CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').map(c => c.label);
const DICAS = [
  'Formato quadrado (1200x1200) fica melhor',
  'Fundo branco ou neutro',
  'Produto centralizado',
  'Boa iluminação',
  'Não precisa ser foto profissional!',
];
const LIMITE_FOTOS = 3;
const TEXTO_AJUDA_ASSOCIADO = 'Associados SECI podem ter preço diferenciado. Deixe vazio se não quiser oferecer desconto agora.';
const VAZIO = { nome: '', descricao: '', categoria: '', marca: '', preco: '', preco_associado: '', estoque_disponivel: true, destaque: false, tempo_preparo_min: '' };

export default function ParceiroProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { parceiro } = useOutletContext();
  const [searchParams] = useSearchParams();
  const modoEdicao = id && id !== 'novo';
  // Voz e tempo de preparo são do IUB Food — o prompt da IA de voz é
  // pensado pra cardápio (ver openaiService.montarPromptVoz).
  const eRestaurante = Boolean(parceiro?.e_restaurante);

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
  const [statusIA, setStatusIA] = useState(null); // { trial_ativo, trial_dias_restantes, limite, usados, voz_limite_dia, voz_usados_hoje }
  const [transcricaoVoz, setTranscricaoVoz] = useState(null);
  // Título do quadro pós-salvar ("Produto publicado!", "Produto atualizado!",
  // "Fotos enviadas!") com novo / mais fotos / lista; null = fechado.
  const [publicado, setPublicado] = useState(null);
  const [ajudaAssociado, setAjudaAssociado] = useState(false);
  const secaoFotosRef = useRef(null);
  const arrastandoRef = useRef(null); // índice da foto sendo arrastada (desktop)
  const [alvoArraste, setAlvoArraste] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null); // url em tela cheia
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
  function carregarStatusIA() {
    apiParceiro.get('/parceiro/produtos/ia-status').then(res => setStatusIA(res.data)).catch(() => {});
  }
  useEffect(carregarStatusIA, []);

  useEffect(() => {
    if (!modoEdicao) return;
    // cancelado: clicou "+ Novo produto" antes desta busca voltar — não
    // pode encher o formulário novo com o produto que acabou de publicar
    let cancelado = false;
    apiParceiro.get(`/parceiro/produtos/${id}`).then(res => {
      if (cancelado) return;
      const p = res.data;
      setForm({
        nome: p.nome, descricao: p.descricao, categoria: p.categoria || '', marca: p.marca || '',
        preco: p.preco, preco_associado: p.preco_associado || '',
        estoque_disponivel: p.estoque_disponivel, destaque: p.destaque,
        tempo_preparo_min: p.tempo_preparo_min ?? '',
      });
      setFotos(p.fotos || []);
    }).catch(() => toast.error('Erro ao carregar produto')).finally(() => setCarregando(false));
    return () => { cancelado = true; };
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

  // Callback do CadastroPorVoz — mesma ideia do aplicarSugestaoIA, mas a
  // voz traz preço (e às vezes tempo de preparo), e não traz foto/marca.
  function aplicarSugestaoVoz(d) {
    setForm(f => ({
      ...f,
      nome: d.nome || f.nome,
      descricao: d.descricao || f.descricao,
      categoria: d.categoria || f.categoria,
      preco: d.preco != null ? Number(d.preco).toFixed(2) : f.preco,
      tempo_preparo_min: d.tempo_preparo_min ?? f.tempo_preparo_min,
    }));
    setTranscricaoVoz(d.transcricao || null);
    carregarStatusIA();
  }

  // Callback do CadastroVozGuiada. `publicar`: salva na hora pelo mesmo
  // handleSalvar do botão Publicar (mesmas validações/limites — se algo
  // falhar, o toast explica e o form já fica preenchido pra corrigir).
  function aplicarSugestaoGuiada(d, { publicar }) {
    const novoForm = {
      ...form,
      nome: d.nome || form.nome,
      descricao: d.descricao || form.descricao,
      categoria: form.categoria || 'Alimentação',
      preco: d.preco != null ? Number(d.preco).toFixed(2) : form.preco,
    };
    setForm(novoForm);
    setTranscricaoVoz(null);
    if (d.foto) {
      setFotoDaIA(d.foto);
      setFotoDaIAPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(d.foto); });
    }
    carregarStatusIA();
    if (publicar) handleSalvar(false, novoForm, d.foto || fotoDaIA);
    else toast.success('Pronto! Confira os dados e clique em Publicar.');
  }

  // "+ Novo produto" do quadro pós-publicar. /produtos/:id → /produtos/novo
  // reaproveita este mesmo componente (não remonta), então zera na mão.
  function novoProduto() {
    pendentes.forEach(p => URL.revokeObjectURL(p.preview));
    removerFotoDaIA();
    setForm(VAZIO);
    setFotos([]);
    setPendentes([]);
    setProdutoId(null);
    setTranscricaoVoz(null);
    setMostrarBannerIA(true);
    setPublicado(null);
    navigate('/parceiro/painel/produtos/novo', { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function adicionarMaisFotos() {
    setPublicado(null);
    secaoFotosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function removerFotoDaIA() {
    if (fotoDaIAPreview) URL.revokeObjectURL(fotoDaIAPreview);
    setFotoDaIA(null);
    setFotoDaIAPreview(null);
  }

  function validar(f = form) {
    if (f.nome.trim().length < 3) return 'Nome precisa ter pelo menos 3 caracteres';
    if (f.descricao.trim().length < 20) return 'Descrição precisa ter pelo menos 20 caracteres';
    const preco = parseFloat(f.preco);
    if (!Number.isFinite(preco) || preco <= 0) return 'Preço normal é obrigatório e deve ser maior que zero';
    // Opcional: vazio ou igual = sem desconto (o backend guarda NULL).
    if (f.preco_associado) {
      const pa = parseFloat(f.preco_associado);
      if (!Number.isFinite(pa) || pa < 0) return 'Preço associado inválido';
      if (pa > preco) return 'Preço associado não pode ser maior que o normal';
    }
    if (f.tempo_preparo_min !== '') {
      const t = Number(f.tempo_preparo_min);
      if (!Number.isInteger(t) || t < 1 || t > 300) return 'Tempo de preparo deve ser entre 1 e 300 minutos';
    }
    return null;
  }

  // `f`/`foto` explícitos pra voz guiada poder publicar direto da revisão
  // com os dados que acabou de montar (o setForm dela ainda não aplicou
  // nesse mesmo tick). Os botões da tela chamam só handleSalvar(rascunho).
  async function handleSalvar(rascunho, f = form, foto = fotoDaIA) {
    const erro = validar(f);
    if (erro) return toast.error(erro);

    setSalvando(true);
    const payload = {
      ...f,
      preco: parseFloat(f.preco),
      preco_associado: f.preco_associado ? parseFloat(f.preco_associado) : null,
      tempo_preparo_min: f.tempo_preparo_min === '' ? null : Number(f.tempo_preparo_min),
      rascunho,
      ativo: !rascunho,
    };
    try {
      if (produtoId) {
        // Foto escolhida e ainda não enviada vai junto — clicar Publicar
        // sem apertar "Enviar foto" perdia a foto calado.
        if (pendentesRef.current.length) await confirmarEnvio(false);
        await apiParceiro.put(`/parceiro/produtos/${produtoId}`, payload);
        if (rascunho) toast.success('Rascunho salvo!');
        else setPublicado('Produto atualizado!');
      } else {
        const res = await apiParceiro.post('/parceiro/produtos', payload);
        const novoId = res.data.id;
        setProdutoId(novoId);
        navigate(`/parceiro/painel/produtos/${novoId}`, { replace: true });
        if (!rascunho) setPublicado('Produto publicado!');

        // Veio do fluxo de IA: a foto já recortada sobe automaticamente
        // junto com a criação, num único clique em "Publicar"/"Salvar
        // rascunho" — sem isso o parceiro precisaria confirmar o envio de
        // novo depois, o que era exatamente o bug reportado (a seção
        // "Fotos" ficava bloqueada dizendo "salve primeiro" mesmo já tendo
        // uma foto escolhida via IA).
        if (foto) {
          await enviarFotoDaIA(novoId, foto);
        } else {
          // publicado: o aviso é o quadro "🎊 Produto publicado!" (setPublicado acima)
          if (rascunho) toast.success('Rascunho salvo! Agora você já pode adicionar fotos.');
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
      toast.success('Produto criado com a foto! 🎉');
    } catch (err) {
      const d = err.response?.data;
      toast.error(
        d?.detalhes
          ? `Produto criado, mas o envio da foto falhou (${d.error} — ${d.detalhes}). Adicione manualmente ali embaixo.`
          : 'Produto criado! A foto da IA não pôde ser enviada agora — adicione manualmente ali embaixo.',
        { duration: 8000 }
      );
    } finally {
      // Funcional: o preview pode ter sido criado neste mesmo tick (voz
      // guiada publicando direto) e ainda não estar no `fotoDaIAPreview`.
      setFotoDaIAPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
      setFotoDaIA(null);
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

  // mostrarCaixa=false quando é o Publicar/Salvar que está enviando junto
  // (aí a caixa que aparece é a de "Produto atualizado!").
  async function confirmarEnvio(mostrarCaixa = true) {
    const lote = pendentesRef.current;
    if (!lote.length) return;
    setEnviandoFotos(true);
    try {
      const fd = new FormData();
      lote.forEach(p => fd.append('fotos', p.file));
      const res = await apiParceiro.post(`/parceiro/produtos/${produtoId}/fotos`, fd);
      setFotos(res.data.fotos);
      lote.forEach(p => URL.revokeObjectURL(p.preview));
      setPendentes([]);
      if (mostrarCaixa) setPublicado(lote.length === 1 ? 'Foto enviada!' : 'Fotos enviadas!');
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

  // Tira a foto de `de` e põe em `para` (as do meio andam uma casa) —
  // ⭐ Principal é mover(i, 0). Otimista: a grade muda na hora e volta se
  // o servidor recusar. A primeira é a que aparece nas vitrines (fotos[0]).
  async function moverFoto(de, para) {
    if (de === para || de == null) return;
    const anterior = fotos;
    const nova = [...fotos];
    const [foto] = nova.splice(de, 1);
    nova.splice(para, 0, foto);
    setFotos(nova);
    try {
      const res = await apiParceiro.put(`/parceiro/produtos/${produtoId}/fotos/ordem`, { urls: nova.map(f => f.url) });
      setFotos(res.data.fotos);
      if (para === 0) toast.success('Foto principal trocada!');
    } catch (err) {
      setFotos(anterior);
      toast.error(err.response?.data?.error || 'Erro ao reordenar fotos');
    }
  }

  async function removerFoto(index) {
    if (!window.confirm('Excluir esta foto?')) return;
    try {
      const res = await apiParceiro.delete(`/parceiro/produtos/${produtoId}/fotos/${index}`);
      setFotos(res.data.fotos);
    } catch {
      toast.error('Erro ao remover foto');
    }
  }

  // igual ao normal não é desconto (vira NULL no backend) — prévia sem selo
  const temDescontoAssociado = parseFloat(form.preco_associado) > 0 && parseFloat(form.preco_associado) < parseFloat(form.preco);

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
            <p className="text-slate-500 text-xs mt-1 mb-4">
              {eRestaurante
                ? 'Fale o produto e o preço, ou mande uma foto — a IA preenche o cadastro pra você em segundos.'
                : 'Nossa IA reconhece o produto na foto e preenche nome, descrição, marca e categoria pra você — de 3-5 minutos pra 30 segundos.'}
            </p>
            {statusIA?.trial_ativo && (
              <p className="text-center text-xs font-bold px-3 py-1.5 rounded-full mb-3" style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}>
                🎉 Trial ativo! IA ilimitada por mais {statusIA.trial_dias_restantes} {statusIA.trial_dias_restantes === 1 ? 'dia' : 'dias'}
              </p>
            )}
            <div className={eRestaurante ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
              {eRestaurante && <CadastroPorVoz onConfirmar={aplicarSugestaoVoz} autoAbrir={searchParams.get('voz') === '1'} />}
              {eRestaurante && <CadastroVozGuiada onConfirmar={aplicarSugestaoGuiada} />}
              <div className={eRestaurante ? 'sm:col-span-2' : ''}>
                <IACadastroProduto onConfirmar={aplicarSugestaoIA} />
              </div>
            </div>
            {statusIA && (!statusIA.trial_ativo || eRestaurante) && (
              <p className="text-center text-[11px] text-slate-400 mt-2">
                {eRestaurante && `Voz: ${statusIA.voz_usados_hoje}/${statusIA.voz_limite_dia ?? '∞'} hoje`}
                {eRestaurante && !statusIA.trial_ativo && ' · '}
                {!statusIA.trial_ativo && `Foto: ${statusIA.usados}/${statusIA.limite ?? '∞'} usos este mês (${statusIA.plano})`}
              </p>
            )}
            <button type="button" onClick={() => setMostrarBannerIA(false)} className="block mx-auto text-xs text-slate-400 underline mt-3">
              Cadastrar manualmente
            </button>
          </div>
        )}

        {transcricaoVoz && (
          <div className="rounded-2xl border border-purple-100 bg-purple-50/60 px-4 py-3 flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">🎤</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold" style={{ color: ROXO }}>Você disse:</p>
              <p className="text-sm text-slate-600 mt-0.5">“{transcricaoVoz}”</p>
              <p className="text-[11px] text-slate-400 mt-1">Confira os campos abaixo, ajuste se precisar e clique em Publicar.</p>
            </div>
            <button type="button" onClick={() => setTranscricaoVoz(null)} aria-label="Fechar" className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <X className="w-3.5 h-3.5 text-slate-500" />
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

        <Secao titulo="Fotos" secaoRef={secaoFotosRef}>
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
                <>
                <p className="text-[11px] text-slate-400 mt-4 mb-2">
                  {fotos.length > 1 ? 'A primeira é a principal (aparece na vitrine). Arraste pra mudar a ordem ou toque em ⭐ pra tornar principal. Toque na foto pra ver em tela cheia.' : 'Toque na foto pra ver em tela cheia.'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {fotos.map((foto, i) => (
                    <div
                      key={foto.url}
                      draggable={fotos.length > 1}
                      onDragStart={e => { arrastandoRef.current = i; e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={e => { if (arrastandoRef.current == null) return; e.preventDefault(); setAlvoArraste(i); }}
                      onDragLeave={() => setAlvoArraste(a => (a === i ? null : a))}
                      onDrop={e => { e.preventDefault(); const de = arrastandoRef.current; arrastandoRef.current = null; setAlvoArraste(null); moverFoto(de, i); }}
                      onDragEnd={() => { arrastandoRef.current = null; setAlvoArraste(null); }}
                      className={`relative rounded-xl overflow-hidden aspect-square border ${i === 0 ? 'ring-2' : 'border-slate-100'} ${fotos.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''} ${alvoArraste === i ? 'outline outline-2 outline-dashed outline-offset-2 outline-amber-400' : ''}`}
                      style={i === 0 ? { '--tw-ring-color': ROXO } : {}}
                    >
                      {/* img (não <button>): no Firefox arrastar a partir de um botão não inicia o drag */}
                      <img
                        src={foto.url} alt={`Foto ${i + 1} — toque pra ver em tela cheia`} draggable={false}
                        role="button" tabIndex={0}
                        onClick={() => setFotoAmpliada(foto.url)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFotoAmpliada(foto.url); } }}
                        className={`w-full h-full object-cover ${fotos.length > 1 ? '' : 'cursor-zoom-in'}`}
                      />
                      {i === 0
                        ? <span className="absolute top-1 left-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white pointer-events-none" style={{ backgroundColor: ROXO }}>Principal</span>
                        : <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">{i + 1}</span>}
                      <button type="button" onClick={() => removerFoto(i)} aria-label="Excluir foto" title="Excluir foto" className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center">
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                      {i > 0 && (
                        <button type="button" onClick={() => moverFoto(i, 0)} title="Definir como principal"
                          className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1 rounded-lg bg-white/90 shadow" style={{ color: ROXO }}>
                          <Star className="w-3 h-3" fill={DOURADO} color={DOURADO} /> Principal
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                </>
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
                  <button type="button" onClick={() => confirmarEnvio()} disabled={enviandoFotos}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Preço normal" value={form.preco} onChange={v => setCampo('preco', v)} type="money" />
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-xs font-semibold text-slate-500">Preço associado (opcional)</label>
                <button
                  type="button"
                  onClick={() => setAjudaAssociado(a => !a)}
                  aria-expanded={ajudaAssociado}
                  aria-label="O que é preço associado?"
                  title={TEXTO_AJUDA_ASSOCIADO}
                  className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-slate-300"
                >
                  ?
                </button>
              </div>
              <CampoPreco
                value={form.preco_associado}
                onChange={v => setCampo('preco_associado', v)}
                className={campoCls}
                placeholder="Deixe vazio pra usar o mesmo preço (sem desconto)"
              />
            </div>
          </div>
          {ajudaAssociado && (
            <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">{TEXTO_AJUDA_ASSOCIADO}</p>
          )}
          {eRestaurante && (
            <div className="mt-4 max-w-[240px]">
              <Label>Tempo de preparo (min) — opcional</Label>
              <input
                type="number" inputMode="numeric" min={1} max={300}
                value={form.tempo_preparo_min}
                onChange={e => setCampo('tempo_preparo_min', e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Usa o padrão da loja"
                className={campoCls}
              />
            </div>
          )}
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
                {temDescontoAssociado && <span className="text-xs text-slate-400 line-through">R$ {parseFloat(form.preco_associado).toFixed(2)}</span>}
              </div>
              {temDescontoAssociado && (
                <span className="inline-block mt-1.5 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}>
                  💎 Exclusivo associado
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {fotoAmpliada && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90" onClick={() => setFotoAmpliada(null)} role="dialog" aria-modal="true" aria-label="Foto em tela cheia">
          <img src={fotoAmpliada} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          <button type="button" onClick={() => setFotoAmpliada(null)} aria-label="Fechar" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>
      )}

      {publicado && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={() => setPublicado(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-publicado">
            <p className="text-4xl leading-none" aria-hidden="true">🎊</p>
            <h2 id="titulo-publicado" className="text-lg font-black mt-3" style={{ color: PRETO }}>{publicado}</h2>
            <p className="text-sm text-slate-500 mt-1 truncate">{form.nome}</p>
            <div className="flex flex-col gap-2 mt-5">
              <button type="button" onClick={novoProduto} className="flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl" style={{ backgroundColor: ROXO }}>
                <Plus className="w-4 h-4" /> Novo produto
              </button>
              <button type="button" onClick={adicionarMaisFotos} className="flex items-center justify-center gap-2 font-bold py-3 rounded-xl border-2" style={{ borderColor: ROXO, color: ROXO }}>
                <Plus className="w-4 h-4" /> Adicionar mais fotos
              </button>
              <button type="button" onClick={() => navigate('/parceiro/painel/produtos')} className="text-sm font-semibold py-2.5 rounded-xl text-slate-600 hover:bg-slate-50">
                Ver meus produtos
              </button>
            </div>
          </div>
        </div>
      )}
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

function Secao({ titulo, children, secaoRef }) {
  return (
    <div ref={secaoRef} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 scroll-mt-4">
      <h2 className="font-bold text-base mb-5" style={{ color: PRETO }}>{titulo}</h2>
      {children}
    </div>
  );
}
