import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mic, Loader2, X, RotateCcw } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../../pages/public/Marketplace/theme';
import { useGravadorAudio, PainelGravacao, formDataDoAudio } from './gravadorAudio';

const DURACAO_MAX_S = 60;
const EXEMPLOS = [
  'X-Bacon com bacon crocante e batata palha. Vinte e nove reais e noventa.',
  'Marmita executiva de contrafilé com arroz, feijão e salada. Vinte e cinco reais.',
  'Pizza grande de calabresa, borda recheada com catupiry. Sessenta reais.',
];

// Botão "🎤 Falar pra cadastrar" (voz RÁPIDA) + modal: grava tudo de uma
// vez -> envia pro backend (Whisper + GPT-4o, POST
// /parceiro/produtos/cadastrar-por-voz) -> `onConfirmar` devolve
// nome/descrição/preço/categoria/tempo pro ProdutoForm preencher. Igual
// IACadastroProduto: nunca salva produto sozinho, o comerciante confere no
// formulário e clica Publicar. Gravação em si: ver gravadorAudio.jsx.
export default function CadastroPorVoz({ onConfirmar, autoAbrir = false }) {
  const [fase, setFase] = useState('fechado'); // fechado | pronto | gravando | processando | erro | limite
  const [etapa, setEtapa] = useState('Escutando seu produto...');
  const [erro, setErro] = useState(null); // { mensagem, transcricao }
  const [limite, setLimite] = useState(null);
  const gravador = useGravadorAudio();
  const canceladoRef = useRef(false);

  useEffect(() => { if (autoAbrir) setFase('pronto'); }, [autoAbrir]);
  useEffect(() => () => { canceladoRef.current = true; }, []);

  function fechar() {
    canceladoRef.current = true;
    gravador.cancelar();
    setFase('fechado'); setErro(null); setLimite(null);
  }

  async function iniciarGravacao() {
    canceladoRef.current = false;
    setFase('gravando');
    let gravacao;
    try {
      gravacao = await gravador.iniciar({
        maxSegundos: DURACAO_MAX_S,
        mensagemCurta: 'Gravação muito curta. Segure e fale o nome, o que vem no produto e o preço.',
      });
    } catch (err) {
      setErro({ mensagem: err.message });
      setFase('erro');
      return;
    }
    if (gravacao && !canceladoRef.current) enviar(gravacao);
  }

  async function enviar(gravacao) {
    setFase('processando');
    setEtapa('Escutando seu produto...');
    // Uma chamada só faz as duas etapas no backend (Whisper e depois
    // GPT-4o) — o texto troca por tempo, é só pro comerciante saber que
    // não travou.
    const trocaEtapa = setTimeout(() => setEtapa('Estruturando com IA...'), 2500);
    try {
      const res = await apiParceiro.post('/parceiro/produtos/cadastrar-por-voz', formDataDoAudio(gravacao), { timeout: 60000 });
      if (canceladoRef.current) return;
      onConfirmar?.(res.data);
      toast.success(res.data.preco ? 'Pronto! Confira os dados e clique em Publicar.' : 'Pronto! Só faltou o preço — preencha e clique em Publicar.', { duration: 5000 });
      fechar();
    } catch (err) {
      if (canceladoRef.current) return;
      const d = err.response?.data;
      if (err.response?.status === 403 && d?.codigo === 'LIMITE_ATINGIDO') {
        setLimite(d);
        setFase('limite');
        return;
      }
      setErro({ mensagem: d?.error || (err.code === 'ECONNABORTED' ? 'Demorou demais pra responder. Tente de novo.' : 'Não foi possível processar o áudio agora.'), transcricao: d?.transcricao });
      setFase('erro');
    } finally {
      clearTimeout(trocaEtapa);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFase('pronto')}
        className="w-full flex items-center justify-center gap-2.5 text-sm font-black uppercase tracking-wide px-6 py-4 rounded-2xl shadow-lg text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
        style={{ backgroundColor: ROXO }}
      >
        <Mic className="w-5 h-5" /> Falar pra cadastrar
      </button>

      {fase !== 'fechado' && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-6 relative">
            <button type="button" onClick={fechar} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <X className="w-4 h-4" />
            </button>

            {fase === 'pronto' && (
              <div className="text-center pt-2">
                <h2 className="font-black text-lg" style={{ color: PRETO }}>Fale o produto</h2>
                <p className="text-slate-500 text-sm mt-1">Diga o <b>nome</b>, <b>o que vem nele</b> e o <b>preço</b>. A IA preenche o resto.</p>
                <BotaoMicrofone onClick={iniciarGravacao} />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Exemplos</p>
                <ul className="space-y-1.5 text-left">
                  {EXEMPLOS.map(ex => (
                    <li key={ex} className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">“{ex}”</li>
                  ))}
                </ul>
              </div>
            )}

            {fase === 'gravando' && (gravador.gravando
              ? <PainelGravacao gravador={gravador} maxSegundos={DURACAO_MAX_S} />
              : <Carregando texto="Liberando o microfone..." />)}

            {fase === 'processando' && <Carregando texto={etapa} subtexto="Leva só alguns segundos" />}

            {fase === 'erro' && erro && (
              <div className="text-center py-6">
                <p className="text-4xl">🎤</p>
                <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{erro.mensagem}</p>
                {erro.transcricao && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mt-3">Entendi: “{erro.transcricao}”</p>
                )}
                <div className="flex flex-col gap-2 mt-5">
                  <button type="button" onClick={() => setFase('pronto')} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                    <RotateCcw className="w-4 h-4" /> Tentar de novo
                  </button>
                  <button type="button" onClick={fechar} className="w-full text-sm font-semibold py-2.5 rounded-xl text-slate-500">
                    Cadastrar manualmente
                  </button>
                </div>
              </div>
            )}

            {fase === 'limite' && limite && <TelaLimite limite={limite} onFechar={fechar} />}
          </div>
        </div>
      )}
    </>
  );
}

export function BotaoMicrofone({ onClick, tamanho = 'w-28 h-28', icone = 'w-12 h-12' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Começar a gravar"
      className={`${tamanho} rounded-full mx-auto my-7 flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 active:scale-95`}
      style={{ backgroundColor: ROXO }}
    >
      <Mic className={icone} />
    </button>
  );
}

export function Carregando({ texto, subtexto }) {
  return (
    <div className="text-center py-10">
      <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: ROXO }} />
      <p className="font-bold text-sm mt-4" style={{ color: PRETO }}>{texto}</p>
      {subtexto && <p className="text-slate-400 text-xs mt-1">{subtexto}</p>}
    </div>
  );
}

export function TelaLimite({ limite, onFechar }) {
  return (
    <div className="text-center py-6">
      <p className="text-4xl">🎯</p>
      <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>{limite.error}</p>
      <p className="text-slate-400 text-xs mt-1 mb-5">Planos pagos têm mais cadastros por voz por dia.</p>
      <div className="flex flex-col gap-2">
        <Link to="/parceiro/painel/planos" onClick={onFechar} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-[#0F0F14]" style={{ backgroundColor: DOURADO }}>
          Ver planos
        </Link>
        <button type="button" onClick={onFechar} className="w-full text-sm font-semibold py-2.5 rounded-xl text-slate-500">
          Continuar manual
        </button>
      </div>
    </div>
  );
}
