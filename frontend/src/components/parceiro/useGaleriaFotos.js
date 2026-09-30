import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import apiParceiro from '../../services/apiParceiro';

// Galeria de fotos de produto do painel do parceiro — usada no formulário
// comum (ProdutoForm) e no Disk Bebidas (Beer.jsx). A tela é o <GradeFotos>.
//
// Fotos numa lista só, JÁ na ordem final (a primeira é a principal):
// enviadas ({ url, publicId, ordem }) e escolhidas ainda não enviadas
// ({ pendente: true, file, preview, daIA? }). Com pendente na lista, a
// ordem fica só aqui e vai junto no envio (enviarPendentes) — dá pra
// arrumar tudo antes do primeiro Publicar.
//
// `urlFotos(id)` = base das rotas de foto do produto, que seguem o mesmo
// contrato nos dois lugares: POST (multipart "fotos"), PUT /ordem { urls },
// DELETE /:index — todas devolvem { fotos }.
export default function useGaleriaFotos({ produtoId, urlFotos, limite }) {
  const [galeria, setGaleria] = useState([]);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const galeriaRef = useRef(galeria);
  galeriaRef.current = galeria;
  // Ordem (urls) que o servidor tem agora — o DELETE é por índice do
  // servidor, e a galeria local pode estar noutra ordem ainda não salva.
  const ordemServidorRef = useRef([]);

  // Libera a memória dos previews locais só ao desmontar — usa ref (não
  // `galeria` direto na dependência) pra não revogar os URLs ainda em uso
  // toda vez que o usuário adiciona/remove uma foto da seleção.
  useEffect(() => () => {
    galeriaRef.current.forEach(g => { if (g.pendente) URL.revokeObjectURL(g.preview); });
  }, []);

  function fotosDoServidor(lista) {
    ordemServidorRef.current = lista.map(f => f.url);
    setGaleria(lista);
  }

  // Sobe as fotos pendentes de `lista` e deixa o servidor na MESMA ordem da
  // lista (o upload sempre põe as novas no fim; se a ordem montada aqui for
  // outra, acerta com o PUT .../ordem). Falha no envio não desfaz o
  // produto — as prévias ficam na tela pra tentar de novo pelo "Enviar".
  // Devolve a resposta do POST (truthy) ou false.
  async function enviarPendentes(idAlvo, lista, { recemCriado = false } = {}) {
    const novas = lista.filter(g => g.pendente);
    if (!novas.length) return true;
    setEnviandoFotos(true);
    let resposta;
    let enviadas;
    try {
      const fd = new FormData();
      novas.forEach(p => fd.append('fotos', p.file));
      resposta = (await apiParceiro.post(urlFotos(idAlvo), fd)).data;
      enviadas = resposta.fotos;
    } catch (err) {
      const d = err.response?.data;
      // "detalhes"/"codigo" só vêm quando o erro é do Cloudinary (ver
      // cloudinaryService.js) — mostrar isso no toast é temporário, pra
      // debugar o bug de upload sem precisar abrir log do Render.
      const motivo = d?.detalhes ? `${d.error} (${d.detalhes} — código ${d.codigo})` : (d?.error || 'Erro ao enviar fotos');
      toast.error(recemCriado ? `Produto criado, mas as fotos não subiram: ${motivo}. Toque em "Enviar" nas fotos pra tentar de novo.` : motivo, { duration: 8000 });
      setEnviandoFotos(false);
      return false;
    }
    novas.forEach(p => URL.revokeObjectURL(p.preview));
    const jaTinha = enviadas.length - novas.length;
    let k = 0;
    const urls = lista.map(g => (g.pendente ? enviadas[jaTinha + k++]?.url : g.url));
    try {
      // lista fora de sincronia com o servidor (ex.: outra aba mexeu): não
      // arrisca reordenar, fica a ordem que o servidor devolveu
      if (jaTinha >= 0 && urls.every(Boolean) && urls.some((u, i) => u !== enviadas[i]?.url)) {
        enviadas = (await apiParceiro.put(`${urlFotos(idAlvo)}/ordem`, { urls })).data.fotos;
      }
    } catch {
      toast.error('Fotos enviadas, mas a ordem não salvou — arraste de novo pra arrumar.', { duration: 6000 });
    } finally {
      fotosDoServidor(enviadas);
      setEnviandoFotos(false);
    }
    return resposta || true;
  }

  // Chamado pelo ImageCropUpload uma vez pra cada foto já recortada
  // (quadrada) e comprimida — só entra na galeria como prévia; o upload de
  // verdade é no salvar ou no botão "Enviar".
  function aoRecortarFoto(file) {
    if (galeriaRef.current.length >= limite) {
      toast.error(`Máximo de ${limite} fotos por produto`);
      return;
    }
    const item = { pendente: true, file, preview: URL.createObjectURL(file) };
    galeriaRef.current = [...galeriaRef.current, item]; // várias fotos no mesmo tick
    setGaleria(galeriaRef.current);
  }

  function cancelarPendente(item) {
    URL.revokeObjectURL(item.preview);
    const nova = galeria.filter(g => g !== item);
    setGaleria(nova);
    // Sobraram só enviadas: a ordem que ficou esperando o envio salva agora.
    if (!nova.some(g => g.pendente)) salvarOrdem(nova, galeria);
  }

  // Salva a ordem das enviadas se ela mudou; volta pra `anterior` se falhar.
  async function salvarOrdem(nova, anterior, avisoPrincipal = false) {
    const urls = nova.map(f => f.url);
    if (!produtoId || urls.join('|') === ordemServidorRef.current.join('|')) {
      if (avisoPrincipal) toast.success('Foto principal trocada!');
      return;
    }
    try {
      const res = await apiParceiro.put(`${urlFotos(produtoId)}/ordem`, { urls });
      fotosDoServidor(res.data.fotos);
      if (avisoPrincipal) toast.success('Foto principal trocada!');
    } catch (err) {
      setGaleria(anterior);
      toast.error(err.response?.data?.error || 'Erro ao reordenar fotos');
    }
  }

  // Tira a foto de `de` e põe em `para` (as do meio andam uma casa) —
  // ⭐ Principal é mover(i, 0). Só enviadas: salva na hora (otimista, volta
  // se o servidor recusar). Com prévia no meio: fica local e vai no envio.
  function moverFoto(de, para) {
    if (de == null || de === para) return;
    const anterior = galeria;
    const nova = [...galeria];
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item);
    setGaleria(nova);
    if (nova.some(g => g.pendente)) {
      if (para === 0) toast.success('Foto principal trocada!');
      return;
    }
    salvarOrdem(nova, anterior, para === 0);
  }

  async function removerFoto(item) {
    if (!window.confirm('Excluir esta foto?')) return;
    // DELETE é pelo índice no SERVIDOR (a ordem local pode estar diferente)
    const index = ordemServidorRef.current.indexOf(item.url);
    if (index < 0) return;
    try {
      const res = await apiParceiro.delete(`${urlFotos(produtoId)}/${index}`);
      ordemServidorRef.current = res.data.fotos.map(f => f.url);
      setGaleria(g => g.filter(x => x.url !== item.url));
    } catch {
      toast.error('Erro ao remover foto');
    }
  }

  return {
    galeria, setGaleria, galeriaRef, enviandoFotos,
    fotos: galeria.filter(g => !g.pendente),
    pendentes: galeria.filter(g => g.pendente),
    fotosDoServidor, enviarPendentes, aoRecortarFoto, cancelarPendente, moverFoto, removerFoto,
  };
}
