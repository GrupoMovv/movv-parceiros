import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sparkles, Loader2, X, RotateCcw, Check, ArrowLeft } from 'lucide-react';
import apiParceiro from '../services/apiParceiro';
import ImageCropUpload from './ImageCropUpload';
import { ROXO, DOURADO, PRETO } from '../pages/public/Marketplace/theme';
import { CATEGORIAS_FILTRO } from '../pages/public/Marketplace/parceirosData';

const CATEGORIAS = CATEGORIAS_FILTRO.filter(c => c.label !== 'Todas').map(c => c.label);

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';

// Botão "🤖 Cadastrar com IA" + modal fullscreen com o fluxo inteiro:
// escolher/recortar foto (reusa ImageCropUpload) -> IA analisa
// (POST /parceiro/produtos/analisar-imagem) -> revisão editável dos
// campos sugeridos -> `onConfirmar` devolve pro ProdutoForm os dados +
// o File já recortado, pra pré-preencher o formulário normal (o parceiro
// ainda confere/edita tudo e adiciona preço/estoque por lá — este
// componente nunca salva produto sozinho).
export default function IACadastroProduto({ onConfirmar }) {
  const [fase, setFase] = useState('fechado'); // fechado | escolherFoto | analisando | revisao | erro | limite
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [statusLimite, setStatusLimite] = useState(null);
  const [novaTag, setNovaTag] = useState('');

  function abrir() { setFase('escolherFoto'); }

  function fechar() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFase('fechado'); setFotoFile(null); setFotoPreview(null); setDados(null); setErro(null); setStatusLimite(null); setNovaTag('');
  }

  async function analisar(file) {
    setFotoFile(file);
    setFotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setFase('analisando');
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      const res = await apiParceiro.post('/parceiro/produtos/analisar-imagem', fd);
      setDados(res.data);
      setFase('revisao');
    } catch (err) {
      const status = err.response?.status;
      const d = err.response?.data;
      if (status === 403 && d?.codigo === 'LIMITE_ATINGIDO') {
        setStatusLimite(d);
        setFase('limite');
        return;
      }
      setErro({ mensagem: d?.error || 'Não foi possível analisar a imagem agora.', naoIdentificado: d?.codigo === 'NAO_IDENTIFICADO' });
      setFase('erro');
    }
  }

  function regenerar() {
    if (fotoFile) analisar(fotoFile);
  }

  function setCampoDados(campo, valor) { setDados(d => ({ ...d, [campo]: valor })); }

  function removerTag(i) { setDados(d => ({ ...d, palavras_chave: d.palavras_chave.filter((_, idx) => idx !== i) })); }

  function adicionarTag() {
    const v = novaTag.trim();
    if (!v) return;
    setDados(d => ({ ...d, palavras_chave: [...(d.palavras_chave || []), v].slice(0, 10) }));
    setNovaTag('');
  }

  function confirmar() {
    onConfirmar?.({ ...dados, foto: fotoFile });
    toast.success('Dados da IA aplicados! Confira, adicione o preço e salve.');
    fechar();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="w-full flex items-center justify-center gap-2.5 text-sm font-black uppercase tracking-wide px-6 py-4 rounded-2xl shadow-lg transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl"
        style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
      >
        <Sparkles className="w-5 h-5" /> Cadastrar com IA
      </button>

      {fase !== 'fechado' && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-6 relative">
            <button type="button" onClick={fechar} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <X className="w-4 h-4" />
            </button>

            {fase === 'escolherFoto' && (
              <div className="text-center pt-2">
                <Sparkles className="w-8 h-8 mx-auto" style={{ color: DOURADO }} />
                <h2 className="font-black text-lg mt-2" style={{ color: PRETO }}>Envie a foto do produto</h2>
                <p className="text-slate-500 text-sm mt-1 mb-5">A IA reconhece o produto e preenche nome, descrição, marca e categoria pra você.</p>
                <ImageCropUpload
                  aspectRatio={1}
                  label="Selecionar imagem"
                  onCropComplete={analisar}
                  botaoClassName="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-white"
                />
              </div>
            )}

            {fase === 'analisando' && (
              <div className="text-center py-10">
                {fotoPreview && <img src={fotoPreview} alt="" className="w-28 h-28 rounded-2xl object-cover mx-auto mb-5 border border-slate-100" />}
                <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: ROXO }} />
                <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>🤖 IA analisando...</p>
                <p className="text-slate-400 text-xs mt-1">Isso leva só alguns segundos</p>
              </div>
            )}

            {fase === 'revisao' && dados && (
              <div>
                <div className="text-center mb-4">
                  {fotoPreview && <img src={fotoPreview} alt="" className="w-20 h-20 rounded-2xl object-cover mx-auto border border-slate-100" />}
                  <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide mt-2" style={{ color: '#166534' }}>
                    <Check className="w-3.5 h-3.5" /> Dados prontos — confira e ajuste
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nome ({dados.nome.length}/60)</label>
                    <input className={campoCls} value={dados.nome} maxLength={60} onChange={e => setCampoDados('nome', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Descrição ({dados.descricao.length}/500)</label>
                    <textarea className={`${campoCls} resize-none`} rows={4} maxLength={500} value={dados.descricao} onChange={e => setCampoDados('descricao', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Marca</label>
                      <input className={campoCls} value={dados.marca} onChange={e => setCampoDados('marca', e.target.value)} placeholder="Opcional" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Categoria</label>
                      <select className={campoCls} value={dados.categoria} onChange={e => setCampoDados('categoria', e.target.value)}>
                        <option value="">Selecione</option>
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Palavras-chave</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(dados.palavras_chave || []).map((tag, i) => (
                        <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                          {tag}
                          <button type="button" onClick={() => removerTag(i)} aria-label={`Remover ${tag}`}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={campoCls} value={novaTag} placeholder="Adicionar tag"
                        onChange={e => setNovaTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarTag(); } }}
                      />
                      <button type="button" onClick={adicionarTag} className="px-4 rounded-xl border border-slate-200 text-sm font-semibold flex-shrink-0">+</button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-5">
                  <button type="button" onClick={confirmar} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                    <Check className="w-4 h-4" /> Confirmar e continuar
                  </button>
                  <button type="button" onClick={regenerar} className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl text-slate-500">
                    <RotateCcw className="w-3.5 h-3.5" /> Regenerar
                  </button>
                </div>
              </div>
            )}

            {fase === 'erro' && (
              <div className="text-center py-8">
                <p className="text-4xl">{erro?.naoIdentificado ? '🔍' : '⚠️'}</p>
                <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>
                  {erro?.naoIdentificado ? 'A IA não conseguiu identificar o produto nessa foto.' : erro?.mensagem}
                </p>
                <p className="text-slate-400 text-xs mt-1">Tente outra foto ou cadastre manualmente.</p>
                <div className="flex flex-col gap-2 mt-5">
                  <button type="button" onClick={() => setFase('escolherFoto')} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
                    <ArrowLeft className="w-4 h-4" /> Tentar outra foto
                  </button>
                  <button type="button" onClick={fechar} className="w-full text-sm font-semibold py-2.5 rounded-xl text-slate-500">
                    Cadastrar manualmente
                  </button>
                </div>
              </div>
            )}

            {fase === 'limite' && statusLimite && (
              <div className="text-center py-6">
                <p className="text-4xl">🎯</p>
                <p className="font-bold text-sm mt-3" style={{ color: PRETO }}>
                  Você usou seus {statusLimite.limite} usos de IA este mês
                </p>
                <p className="text-slate-400 text-xs mt-1 mb-5">Faça upgrade pra ter mais análises por mês, ou continue cadastrando manualmente.</p>
                <div className="flex flex-col gap-2">
                  <Link to="/parceiro/painel/planos" onClick={fechar} className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-[#0F0F14]" style={{ backgroundColor: DOURADO }}>
                    Ver planos
                  </Link>
                  <button type="button" onClick={fechar} className="w-full text-sm font-semibold py-2.5 rounded-xl text-slate-500">
                    Continuar manual
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
