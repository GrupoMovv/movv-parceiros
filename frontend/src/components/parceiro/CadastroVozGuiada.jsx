import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ListChecks, X, RotateCcw, Check, Pencil, ArrowLeft, ImageOff } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../../pages/public/Marketplace/theme';
import CampoPreco from '../ui/CampoPreco';
import ImageCropUpload from '../ImageCropUpload';
import { useGravadorAudio, PainelGravacao, formDataDoAudio } from './gravadorAudio';
import { BotaoMicrofone, Carregando, TelaLimite } from './CadastroPorVoz';

const PASSOS = ['nome', 'descricao', 'preco', 'foto', 'revisao'];
const PASSOS_VOZ = {
  nome: {
    titulo: '🎤 Diga o NOME do produto',
    tituloEdicao: '✏️ Nome do produto',
    dica: 'Só o nome. Ex.: “X-Bacon”, “Marmita executiva”',
    maxSegundos: 15,
    pergunta: 'Tá certo?',
    confirmar: 'Sim, próximo',
  },
  descricao: {
    titulo: '🎤 Descreva o produto',
    tituloEdicao: '✏️ Descrição',
    dica: 'Ingredientes, tamanho, acompanhamentos. Ex.: “pão brioche, hambúrguer 180g, bacon crocante e cheddar”',
    maxSegundos: 60,
    pergunta: 'Ficou bom?',
    confirmar: 'Tá bom, próximo',
  },
  preco: {
    titulo: '🎤 Qual o PREÇO?',
    tituloEdicao: '✏️ Preço',
    dica: 'Ex.: “vinte e nove e noventa”',
    maxSegundos: 15,
    pergunta: 'Tá certo?',
    confirmar: 'Sim, próximo',
  },
};
const VAZIO = { nome: '', descricao: '', preco: null, foto: null };

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';

function formatarBRL(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Botão "Voz guiada" + modal em passos: o assistente pergunta uma coisa por
// vez (nome -> descrição -> preço -> foto opcional -> revisão) e o
// comerciante responde falando. Cada resposta vai sozinha pro backend
// (POST /parceiro/produtos/cadastrar-por-voz-guiada, campo "etapa") e volta
// pra ele confirmar, regravar ou editar antes de seguir.
//
// Na revisão, `onConfirmar(dados, { publicar })`:
//   publicar: true  -> ProdutoForm preenche E já salva (mesmo caminho do
//                      botão Publicar, com as mesmas validações)
//   publicar: false -> só preenche o formulário ("Editar antes")
// dados = { nome, descricao, preco, foto (File recortado | null) }
export default function CadastroVozGuiada({ onConfirmar }) {
  const [passo, setPasso] = useState(null); // null = fechado | nome | descricao | preco | foto | revisao | limite
  const [fase, setFase] = useState('pronto'); // (passos de voz) pronto | gravando | processando | confirmar | editar | erro
  const [dados, setDados] = useState(VAZIO);
  const [resultado, setResultado] = useState(null); // { valor, transcricao } da etapa atual, antes de confirmar
  const [edicao, setEdicao] = useState('');
  const [erro, setErro] = useState(null);
  const [limite, setLimite] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const gravador = useGravadorAudio();
  const canceladoRef = useRef(false);
  const fotoPreviewRef = useRef(null);
  fotoPreviewRef.current = fotoPreview;

  useEffect(() => () => {
    canceladoRef.current = true;
    if (fotoPreviewRef.current) URL.revokeObjectURL(fotoPreviewRef.current);
  }, []);

  function abrir() {
    canceladoRef.current = false;
    setDados(VAZIO); setResultado(null); setErro(null); setLimite(null);
    setFotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    // Não usa irPara(): ele leria o `dados` do cadastro ANTERIOR (o reset
    // acima só vale no próximo render) e mostraria o nome velho pra confirmar.
    setPasso('nome');
    setFase('pronto');
  }

  function fechar() {
    canceladoRef.current = true;
    gravador.cancelar();
    setPasso(null);
  }

  function irPara(novoPasso) {
    gravador.cancelar();
    setPasso(novoPasso);
    setResultado(null);
    setErro(null);
    // Voltando pra um passo já respondido: mostra a resposta de antes pra
    // confirmar (em vez de obrigar a gravar de novo).
    const valorAtual = PASSOS_VOZ[novoPasso] ? dados[novoPasso] : null;
    if (valorAtual !== null && valorAtual !== '' && valorAtual !== undefined) {
      setResultado({ valor: valorAtual });
      setFase('confirmar');
    } else {
      setFase('pronto');
    }
  }

  function voltar() {
    const i = PASSOS.indexOf(passo);
    if (i <= 0) return;
    // Já gravou e viu o resultado deste passo mas voltou sem confirmar:
    // guarda a resposta, pra não ter que gravar de novo ao avançar.
    if (PASSOS_VOZ[passo] && fase === 'confirmar' && resultado) {
      setDados(d => ({ ...d, [passo]: resultado.valor }));
    }
    irPara(PASSOS[i - 1]);
  }

  async function gravar() {
    const cfg = PASSOS_VOZ[passo];
    canceladoRef.current = false;
    setFase('gravando');
    let gravacao;
    try {
      gravacao = await gravador.iniciar({ maxSegundos: cfg.maxSegundos, minSegundos: 0.8 });
    } catch (err) {
      setErro({ mensagem: err.message });
      setFase('erro');
      return;
    }
    if (!gravacao || canceladoRef.current) return;

    setFase('processando');
    const etapaEnviada = passo;
    try {
      const fd = formDataDoAudio(gravacao, { etapa: etapaEnviada, nome: etapaEnviada === 'descricao' ? dados.nome : undefined });
      const res = await apiParceiro.post('/parceiro/produtos/cadastrar-por-voz-guiada', fd, { timeout: 60000 });
      if (canceladoRef.current) return;
      setResultado({ valor: res.data.valor, transcricao: res.data.transcricao });
      setFase('confirmar');
    } catch (err) {
      if (canceladoRef.current) return;
      const d = err.response?.data;
      if (err.response?.status === 403 && d?.codigo === 'LIMITE_ATINGIDO') {
        setLimite(d);
        setPasso('limite');
        return;
      }
      setErro({ mensagem: d?.error || (err.code === 'ECONNABORTED' ? 'Demorou demais pra responder. Tente de novo.' : 'Não foi possível processar o áudio agora.'), transcricao: d?.transcricao });
      setFase('erro');
    }
  }

  function confirmarValor(valor) {
    setDados(d => ({ ...d, [passo]: valor }));
    irParaProximo();
  }

  // irPara lê `dados` do render atual (sem o valor recém-confirmado) — só
  // olha o valor do PRÓXIMO passo, que não é o que acabou de mudar.
  function irParaProximo() {
    irPara(PASSOS[PASSOS.indexOf(passo) + 1]);
  }

  function abrirEdicao() {
    const atual = resultado?.valor ?? dados[passo];
    setEdicao(passo === 'preco' ? (atual != null ? Number(atual).toFixed(2) : '') : (atual || ''));
    setFase('editar');
  }

  function salvarEdicao() {
    if (passo === 'preco') {
      const n = parseFloat(edicao);
      if (!Number.isFinite(n) || n <= 0) return toast.error('Informe um preço maior que zero');
      return confirmarValor(Math.round(n * 100) / 100);
    }
    const texto = edicao.trim();
    if (passo === 'nome' && texto.length < 3) return toast.error('Nome precisa ter pelo menos 3 caracteres');
    if (passo === 'descricao' && texto.length < 20) return toast.error('Descrição precisa ter pelo menos 20 caracteres');
    return confirmarValor(texto);
  }

  function aoEscolherFoto(file) {
    setDados(d => ({ ...d, foto: file }));
    setFotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  }

  function removerFoto() {
    setDados(d => ({ ...d, foto: null }));
    setFotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }

  function finalizar(publicar) {
    // O File da foto vai pro ProdutoForm, que cuida do preview/upload dali
    // em diante — não revoga o preview aqui (o form cria o próprio).
    onConfirmar?.({ nome: dados.nome, descricao: dados.descricao, preco: dados.preco, foto: dados.foto }, { publicar });
    setPasso(null);
  }

  const indice = PASSOS.indexOf(passo);
  const cfg = PASSOS_VOZ[passo];

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="w-full flex items-center justify-center gap-2.5 text-sm font-black uppercase tracking-wide px-6 py-4 rounded-2xl shadow-lg border-2 bg-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
        style={{ borderColor: ROXO, color: ROXO }}
      >
        <ListChecks className="w-5 h-5" /> Voz guiada
      </button>

      {passo && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-6 relative">
            <button type="button" onClick={fechar} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <X className="w-4 h-4" />
            </button>

            {indice >= 0 && (
              <div className="flex items-center gap-3 mb-5 pr-10">
                {indice > 0 && fase !== 'gravando' && fase !== 'processando' ? (
                  <button type="button" onClick={voltar} aria-label="Voltar" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : <span className="w-9 h-9 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Passo {indice + 1} de {PASSOS.length}</p>
                  <div className="flex gap-1 mt-1.5">
                    {PASSOS.map((p, i) => (
                      <span key={p} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i <= indice ? ROXO : '#E2E8F0' }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {cfg && (
              <PassoVoz
                cfg={cfg} passo={passo} fase={fase} gravador={gravador} resultado={resultado} erro={erro}
                edicao={edicao} setEdicao={setEdicao}
                onGravar={gravar} onConfirmar={() => confirmarValor(resultado.valor)}
                onRegravar={gravar} onEditar={abrirEdicao} onSalvarEdicao={salvarEdicao}
                onCancelarEdicao={() => setFase(resultado ? 'confirmar' : 'pronto')}
              />
            )}

            {passo === 'foto' && (
              <div className="text-center">
                <h2 className="font-black text-lg" style={{ color: PRETO }}>📸 Foto do produto?</h2>
                <p className="text-slate-500 text-sm mt-1 mb-5">Opcional — produto com foto vende mais.</p>
                {fotoPreview ? (
                  <div>
                    <img src={fotoPreview} alt="" className="w-40 h-40 rounded-2xl object-cover mx-auto border border-slate-100" />
                    <button type="button" onClick={removerFoto} className="text-xs text-slate-400 underline mt-2">Remover foto</button>
                  </div>
                ) : (
                  <ImageCropUpload
                    aspectRatio={1}
                    label="Tirar ou escolher foto"
                    hint="JPG, PNG ou HEIC até 10MB"
                    tamanhoIcone="w-10 h-10"
                    onCropComplete={aoEscolherFoto}
                    botaoClassName="w-full flex flex-col items-center gap-3 py-8 px-6 rounded-2xl border-2 border-dashed border-[#7C3AED] text-[#7C3AED] text-sm font-bold hover:bg-purple-50 transition-colors"
                  />
                )}
                <div className="flex flex-col gap-2 mt-5">
                  <button type="button" onClick={irParaProximo} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                    {fotoPreview ? <><Check className="w-4 h-4" /> Próximo</> : 'Pular'}
                  </button>
                </div>
              </div>
            )}

            {passo === 'revisao' && (
              <div>
                <h2 className="font-black text-lg text-center" style={{ color: PRETO }}>Confira o produto</h2>
                <div className="mt-4 rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center">
                    {fotoPreview ? <img src={fotoPreview} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-8 h-8 text-slate-200" />}
                  </div>
                  <div className="p-4">
                    <p className="font-bold" style={{ color: PRETO }}>{dados.nome}</p>
                    <p className="font-black mt-0.5" style={{ color: ROXO }}>{dados.preco != null ? formatarBRL(dados.preco) : '—'}</p>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">{dados.descricao}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-5">
                  <button type="button" onClick={() => finalizar(true)} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                    <Check className="w-4 h-4" /> Publicar
                  </button>
                  <button type="button" onClick={() => finalizar(false)} className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl border border-slate-200 text-slate-600">
                    <Pencil className="w-4 h-4" /> Editar antes de publicar
                  </button>
                </div>
              </div>
            )}

            {passo === 'limite' && limite && <TelaLimite limite={limite} onFechar={fechar} />}
          </div>
        </div>
      )}
    </>
  );
}

function PassoVoz({ cfg, passo, fase, gravador, resultado, erro, edicao, setEdicao, onGravar, onConfirmar, onRegravar, onEditar, onSalvarEdicao, onCancelarEdicao }) {
  if (fase === 'gravando') {
    return gravador.gravando
      ? <PainelGravacao gravador={gravador} maxSegundos={cfg.maxSegundos} />
      : <Carregando texto="Liberando o microfone..." />;
  }
  if (fase === 'processando') {
    return <Carregando texto={passo === 'descricao' ? 'Escrevendo a descrição...' : 'Entendendo o que você falou...'} subtexto="Leva só alguns segundos" />;
  }

  if (fase === 'editar') {
    return (
      <div>
        <h2 className="font-black text-lg" style={{ color: PRETO }}>{cfg.tituloEdicao}</h2>
        <div className="mt-4">
          {passo === 'preco' && <CampoPreco value={edicao} onChange={setEdicao} className={campoCls} />}
          {passo === 'nome' && <input autoFocus value={edicao} maxLength={100} onChange={e => setEdicao(e.target.value)} className={campoCls} />}
          {passo === 'descricao' && (
            <>
              <textarea autoFocus rows={5} maxLength={500} value={edicao} onChange={e => setEdicao(e.target.value)} className={`${campoCls} resize-none`} />
              <p className="text-[11px] text-slate-400 text-right">{edicao.length}/500</p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <button type="button" onClick={onSalvarEdicao} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
            <Check className="w-4 h-4" /> Salvar e continuar
          </button>
          <button type="button" onClick={onCancelarEdicao} className="w-full text-sm font-semibold py-2.5 rounded-xl text-slate-500">Cancelar</button>
        </div>
      </div>
    );
  }

  if (fase === 'confirmar' && resultado) {
    return (
      <div className="text-center">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{passo === 'nome' ? 'Nome' : passo === 'preco' ? 'Preço' : 'Descrição'}</p>
        {passo === 'descricao' ? (
          <p className="text-sm text-slate-700 leading-relaxed text-left bg-slate-50 rounded-2xl p-4 mt-2">{resultado.valor}</p>
        ) : (
          <p className="font-black text-2xl mt-2" style={{ color: passo === 'preco' ? ROXO : PRETO }}>
            {passo === 'preco' ? formatarBRL(resultado.valor) : `“${resultado.valor}”`}
          </p>
        )}
        {resultado.transcricao && passo !== 'nome' && (
          <p className="text-[11px] text-slate-400 mt-2">Você disse: “{resultado.transcricao}”</p>
        )}
        <p className="font-bold text-sm mt-4" style={{ color: PRETO }}>{cfg.pergunta}</p>
        <div className="flex flex-col gap-2 mt-3">
          <button type="button" onClick={onConfirmar} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
            <Check className="w-4 h-4" /> {cfg.confirmar}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onRegravar} className="flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl border border-slate-200 text-slate-600">
              <RotateCcw className="w-4 h-4" /> Regravar
            </button>
            <button type="button" onClick={onEditar} className="flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl border border-slate-200 text-slate-600">
              <Pencil className="w-4 h-4" /> Editar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // pronto | erro
  return (
    <div className="text-center">
      <h2 className="font-black text-lg" style={{ color: PRETO }}>{cfg.titulo}</h2>
      <p className="text-slate-500 text-sm mt-1">{cfg.dica}</p>
      {fase === 'erro' && erro && (
        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-left">
          <p className="text-sm font-semibold text-red-700">{erro.mensagem}</p>
          {erro.transcricao && <p className="text-xs text-red-500 mt-1">Entendi: “{erro.transcricao}”</p>}
        </div>
      )}
      <BotaoMicrofone onClick={onGravar} tamanho="w-24 h-24" icone="w-10 h-10" />
      <p className="text-xs text-slate-400 -mt-3">Toque, fale e toque em “Parar” · até {cfg.maxSegundos}s</p>
      <button type="button" onClick={onEditar} className="text-xs text-slate-500 underline mt-4">Prefiro digitar</button>
    </div>
  );
}
