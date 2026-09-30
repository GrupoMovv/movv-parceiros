import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Camera } from 'lucide-react';
import api from '../../../services/api';
import { setParceiroToken } from '../../../services/apiParceiro';
import { ROXO, PRETO } from './theme';

// Cadastro do Vendedor Pessoa Física (CPF) — /vender → "Como você vai
// vender?" → Pessoa Física. A conta nasce "em verificação": entra no painel
// e monta anúncios; nada aparece no site até o IUB conferir documento e
// selfie. Backend: vendedorPfController (fotos vão como arquivos privados).

const campo = 'w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-[#4C1D95]';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const soDigitos = v => String(v || '').replace(/\D/g, '');
const mascaraCpf = v => soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const mascaraFone = v => soDigitos(v).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');

const PASSOS = ['Como vende', 'Aceite', 'Seus dados', 'Documento'];

export default function VenderPessoaFisica() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [passo, setPasso] = useState(0);
  const [nivel, setNivel] = useState('');
  const [aceite, setAceite] = useState(false);
  const [dados, setDados] = useState({ nome_completo: '', nome_vitrine: '', cpf: '', data_nascimento: '', whatsapp: '', email: '', senha: '', bairro: '', cidade: 'Itumbiara', segmento: '' });
  const [documento, setDocumento] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [passo]);
  useEffect(() => {
    api.get('/public/vender/pessoa-fisica/config').then(r => setCfg(r.data)).catch(() => toast.error('Não deu para carregar o cadastro. Recarregue a página.'));
  }, []);
  const set = (k, v) => setDados(d => ({ ...d, [k]: v }));

  function erroDados() {
    if (dados.nome_completo.trim().split(/\s+/).length < 2) return 'Informe seu nome completo';
    if (soDigitos(dados.cpf).length !== 11) return 'CPF incompleto';
    if (!dados.data_nascimento) return 'Informe sua data de nascimento';
    if (soDigitos(dados.whatsapp).length < 10) return 'WhatsApp incompleto';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) return 'E-mail inválido';
    if (dados.senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres';
    if (!dados.bairro.trim()) return 'Informe seu bairro';
    if (!dados.segmento) return 'Escolha o que você vende';
    return null;
  }

  async function enviar() {
    if (!documento || !selfie) return toast.error('Envie a foto do documento e a selfie');
    setEnviando(true);
    try {
      const fd = new FormData();
      Object.entries({ ...dados, cpf: soDigitos(dados.cpf), whatsapp: soDigitos(dados.whatsapp) }).forEach(([k, v]) => fd.append(k, v));
      fd.append('nivel', nivel);
      fd.append('aceite_termos', String(aceite));
      fd.append('termos_versao', cfg.termos_versao);
      fd.append('documento', documento);
      fd.append('selfie', selfie);
      const { data } = await api.post('/public/vender/pessoa-fisica', fd, { timeout: 60000 });
      setParceiroToken(data.token);
      toast.success('Cadastro criado! Monte seus anúncios enquanto conferimos seu documento.');
      navigate('/parceiro/painel', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não deu para enviar agora. Tente de novo.', { duration: 7000 });
      const msg = err.response?.data?.error || '';
      if (/CPF|nascimento|anos|e-mail|E-mail|WhatsApp|senha|bairro|nome/i.test(msg)) setPasso(2);
    } finally {
      setEnviando(false);
    }
  }

  if (!cfg) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;
  const niv = cfg.niveis.find(n => n.codigo === nivel);

  return (
    <div className="min-h-screen w-full flex justify-center px-5 py-10" style={{ backgroundColor: '#FAFAFA' }}>
      <div className="w-full max-w-md">
        <button type="button" onClick={() => (passo === 0 ? navigate('/vender') : setPasso(p => p - 1))} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex gap-1.5 mb-4" aria-label={`Passo ${passo + 1} de ${PASSOS.length}`}>
          {PASSOS.map((p, i) => <div key={p} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i <= passo ? ROXO : '#E2E8F0' }} />)}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8">
          {passo === 0 && (
            <>
              <h1 className="text-xl font-extrabold" style={{ color: PRETO }}>👤 Vender com CPF</h1>
              <p className="text-slate-500 text-sm mt-1">Como você vende?</p>
              <div className="space-y-3 mt-5">
                {cfg.niveis.map(n => (
                  <button key={n.codigo} type="button" onClick={() => setNivel(n.codigo)}
                    className="w-full text-left px-5 py-4 rounded-2xl border-2 transition-colors"
                    style={{ borderColor: nivel === n.codigo ? ROXO : '#F1F5F9', backgroundColor: nivel === n.codigo ? '#F5F3FF' : '#fff' }}>
                    <p className="font-bold" style={{ color: PRETO }}>{n.selo}</p>
                    <p className="text-sm text-slate-600">{n.resumo} · até {n.max_produtos_ativos} produtos ativos</p>
                    <p className="text-xs text-slate-500 mt-1">{brl(n.preco_sindicalizada)}/mês para filiado SECI · {brl(n.preco_nao_sindicalizada)}/mês para os demais</p>
                  </button>
                ))}
              </div>
              {nivel === 'empreendedor' && (
                <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5 mt-4">💡 Quem vende sempre pode abrir um MEI: dá nota fiscal e regulariza sua atividade. Dá pra começar com CPF e migrar depois.</p>
              )}
              <p className="text-xs text-slate-500 mt-4">Bebida alcoólica, cigarro e remédio não podem ser vendidos com CPF.</p>
              <button type="button" disabled={!nivel} onClick={() => setPasso(1)} className="w-full mt-6 py-3 rounded-xl text-white font-bold disabled:opacity-40" style={{ backgroundColor: ROXO }}>Continuar</button>
            </>
          )}

          {passo === 1 && (
            <>
              <h1 className="text-xl font-extrabold" style={{ color: PRETO }}>Venda com CPF</h1>
              <p className="text-sm text-slate-700 mt-3">Você pode anunciar no IUB Mais+ usando seu CPF.</p>
              <p className="text-sm text-slate-700 mt-3">Criar a conta não autoriza nenhuma atividade: impostos, notas, licenças e regras sanitárias da sua venda são responsabilidade sua. Alguns produtos não podem ser vendidos com CPF, e o IUB Mais+ pode pedir documentos ou exigir CNPJ.</p>
              <p className="text-sm text-slate-700 mt-3">Seu CPF não aparece nos anúncios.</p>
              <label className="flex items-start gap-3 mt-5 cursor-pointer">
                <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="w-5 h-5 mt-0.5 accent-violet-700 flex-shrink-0" />
                <span className="text-sm text-slate-700">
                  Tenho {cfg.idade_minima} anos ou mais, o CPF informado é meu e li e aceito os{' '}
                  <Link to="/termos/vendedor-pessoa-fisica" target="_blank" className="font-semibold underline" style={{ color: ROXO }}>Termos do Vendedor Pessoa Física</Link>, inclusive como o IUB trata meus dados (item 13).
                </span>
              </label>
              <button type="button" disabled={!aceite} onClick={() => setPasso(2)} className="w-full mt-6 py-3 rounded-xl text-white font-bold disabled:opacity-40" style={{ backgroundColor: ROXO }}>CONTINUAR COM CPF</button>
            </>
          )}

          {passo === 2 && (
            <>
              <h1 className="text-xl font-extrabold" style={{ color: PRETO }}>Seus dados</h1>
              <div className="space-y-3 mt-5">
                <input className={campo} placeholder="Nome completo" value={dados.nome_completo} onChange={e => set('nome_completo', e.target.value)} autoComplete="name" />
                <div>
                  <input className={campo} placeholder="Nome da sua vitrine (opcional) — ex.: Doces da Maria" value={dados.nome_vitrine} onChange={e => set('nome_vitrine', e.target.value)} />
                  <p className="text-[11px] text-slate-400 mt-1">Seu nome completo também aparece para o cliente.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className={campo} placeholder="CPF" inputMode="numeric" value={dados.cpf} onChange={e => set('cpf', mascaraCpf(e.target.value))} />
                  <input className={campo} type="date" aria-label="Data de nascimento" value={dados.data_nascimento} onChange={e => set('data_nascimento', e.target.value)} />
                </div>
                <input className={campo} placeholder="WhatsApp" inputMode="tel" value={dados.whatsapp} onChange={e => set('whatsapp', mascaraFone(e.target.value))} />
                <input className={campo} placeholder="E-mail (para entrar no painel)" type="email" value={dados.email} onChange={e => set('email', e.target.value)} autoComplete="email" />
                <input className={campo} placeholder="Crie uma senha (mínimo 8 caracteres)" type="password" value={dados.senha} onChange={e => set('senha', e.target.value)} autoComplete="new-password" />
                <div className="grid grid-cols-2 gap-3">
                  <input className={campo} placeholder="Bairro" value={dados.bairro} onChange={e => set('bairro', e.target.value)} />
                  <input className={campo} placeholder="Cidade" value={dados.cidade} onChange={e => set('cidade', e.target.value)} />
                </div>
                <select className={campo} value={dados.segmento} onChange={e => set('segmento', e.target.value)}>
                  <option value="">O que você vende?</option>
                  {cfg.segmentos.map(s => <option key={s.codigo} value={s.codigo}>{s.icone} {s.label}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => { const e = erroDados(); if (e) toast.error(e); else setPasso(3); }} className="w-full mt-6 py-3 rounded-xl text-white font-bold" style={{ backgroundColor: ROXO }}>Continuar</button>
            </>
          )}

          {passo === 3 && (
            <>
              <h1 className="text-xl font-extrabold" style={{ color: PRETO }}>Confirme que é você</h1>
              <p className="text-sm text-slate-600 mt-1">Só a equipe do IUB vê essas fotos, para conferir que o CPF é seu. Elas não aparecem no site.</p>
              {/* documento: câmera ou galeria; selfie: câmera (no celular) */}
              <FotoDoc titulo="Foto do documento (RG ou CNH)" dica="Frente do documento, com a foto e o CPF legíveis" arquivo={documento} onArquivo={setDocumento} />
              <FotoDoc titulo="Selfie segurando o documento" dica="Seu rosto e o documento aparecendo juntos" arquivo={selfie} onArquivo={setSelfie} captura="user" />
              <p className="text-xs text-slate-500 mt-4">Plano {niv?.label} · {brl(niv?.preco_sindicalizada)} ou {brl(niv?.preco_nao_sindicalizada)} por mês.</p>
              <button type="button" disabled={enviando || !documento || !selfie} onClick={enviar} className="w-full mt-5 py-3 rounded-xl text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2" style={{ backgroundColor: ROXO }}>
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />} {enviando ? 'Enviando…' : 'Criar meu cadastro'}
              </button>
            </>
          )}
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          Tem CNPJ? <Link to="/vender" className="font-semibold underline" style={{ color: ROXO }}>Cadastrar como MEI / Empresa</Link>
        </p>
      </div>
    </div>
  );
}

function FotoDoc({ titulo, dica, arquivo, onArquivo, captura }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!arquivo) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(arquivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);
  return (
    <label className="block mt-4 cursor-pointer">
      <span className="block text-sm font-semibold" style={{ color: PRETO }}>{titulo}</span>
      <span className="block text-xs text-slate-500">{dica}</span>
      <div className="mt-2 h-40 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
        {preview ? <img src={preview} alt="" className="w-full h-full object-contain" /> : <span className="flex flex-col items-center gap-1 text-slate-400 text-xs"><Camera className="w-6 h-6" /> Tirar foto ou escolher</span>}
      </div>
      <input type="file" accept="image/jpeg,image/png,image/webp" capture={captura} className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) onArquivo(f); }} />
    </label>
  );
}
