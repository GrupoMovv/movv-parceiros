import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, Printer } from 'lucide-react';
import api from '../../services/api';
import { NIVEIS, dataBR } from './identidade';

// Certificado da Universidade MOVV Partner, no modelo do Word
// (Universidade_MOVV_Partner_Template_Certificado). Folha A4 paisagem de
// 1123 × 794 px, reduzida para caber na tela; "Imprimir" usa o próprio
// navegador (dá para salvar em PDF), sem biblioteca.
const LARGURA = 1123;
const ALTURA = 794;

export default function UniversidadeCertificado() {
  const [c, setC] = useState(null);
  const [erro, setErro] = useState('');
  const caixa = useRef(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    api.get('/universidade/certificado')
      .then(r => setC(r.data))
      .catch(err => setErro(err.response?.data?.error || 'Não foi possível carregar o certificado.'));
  }, []);

  useLayoutEffect(() => {
    if (!caixa.current) return undefined;
    const ajustar = () => setEscala(Math.min(1, caixa.current.clientWidth / LARGURA));
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(caixa.current);
    return () => ro.disconnect();
  }, [c]);

  if (erro) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-slate-700">{erro}</p>
        <Link to="/universidade" className="btn-primary inline-flex mt-4">Voltar à Universidade</Link>
      </div>
    );
  }
  if (!c) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  const aviso = c.status === 'vencida' ? 'Este certificado venceu. Refaça os quizzes dos módulos para receber um certificado novo.'
    : c.suspenso ? 'Certificado suspenso: há módulo atualizado com prazo vencido. Refaça o quiz dele para voltar a valer.'
      : c.status === 'revogada' ? 'Este certificado foi revogado.' : '';

  return (
    <div className="max-w-6xl mx-auto">
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #certificado-folha, #certificado-folha * { visibility: visible !important; }
          #certificado-folha { position: fixed !important; left: 0; top: 0; transform: none !important; width: 297mm !important; height: 210mm !important; box-shadow: none !important; }
          #certificado-folha { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Link to="/universidade" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-movv-900">
          <ChevronLeft className="w-4 h-4" /> Universidade
        </Link>
        <button onClick={() => { try { window.print(); } catch { toast.error('Use o menu do navegador para imprimir.'); } }}
          className="btn-primary inline-flex items-center gap-2"><Printer className="w-4 h-4" /> Imprimir ou salvar em PDF</button>
      </div>
      {aviso && <p className="mb-4 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">{aviso}</p>}

      <div ref={caixa} className="w-full" style={{ height: ALTURA * escala }}>
        <div id="certificado-folha" style={{ width: LARGURA, height: ALTURA, transform: `scale(${escala})`, transformOrigin: 'top left' }}
          className="relative bg-white shadow-card overflow-hidden">
          <Folha c={c} />
        </div>
      </div>
    </div>
  );
}

function Folha({ c }) {
  const ouro = '#B8860B';
  const marinho = '#0B1E3C';
  return (
    <div className="absolute inset-0 p-[34px]" style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: marinho, fontVariantNumeric: 'lining-nums' }}>
      <div className="absolute inset-[18px] border-[3px]" style={{ borderColor: marinho }} />
      <div className="absolute inset-[26px] border" style={{ borderColor: ouro }} />
      <div className="relative h-full flex flex-col items-center text-center px-20 pt-12">
        <p className="tracking-[0.35em] text-[15px] font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>GRUPO MOVV</p>
        <p className="mt-6 tracking-[0.18em] text-[34px] font-bold">CERTIFICADO DE CONCLUSÃO</p>
        <p className="mt-1 tracking-[0.3em] text-[15px]" style={{ color: ouro, fontFamily: 'Poppins, sans-serif' }}>UNIVERSIDADE MOVV PARTNER</p>
        <p className="mt-9 text-[17px] italic">Certificamos que</p>
        <p className="mt-2 text-[40px] leading-tight font-bold px-6 pb-1 border-b-2" style={{ borderColor: ouro }}>{c.nome}</p>
        <p className="mt-5 max-w-[820px] text-[16.5px] leading-[1.6]">
          concluiu com aproveitamento a formação completa da Universidade MOVV Partner, do Módulo 0 (Contratualização)
          aos módulos da trilha comercial e técnica, cumprindo os critérios de conclusão de cada etapa, e está
          certificado(a) para atuar como
        </p>
        <p className="mt-3 tracking-[0.3em] text-[26px] font-bold" style={{ color: ouro }}>MOVV PARTNER</p>

        <div className="mt-8 grid grid-cols-3 gap-10 w-full max-w-[860px] text-[14px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
          <Campo rotulo="Data de conclusão" valor={dataBR(c.emitido_em)} />
          <Campo rotulo="Nível de certificação" valor={NIVEIS[c.nivel] || '—'} />
          <Campo rotulo="Código de certificação" valor={c.codigo} mono />
        </div>

        <div className="mt-auto mb-10 grid grid-cols-2 gap-28 w-full max-w-[720px] text-[14px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
          <Assinatura linha1="Grupo Movv" linha2="Direção" />
          <Assinatura linha1="Central Movv" linha2="Academia MOVV Partner" />
        </div>
        <p className="absolute bottom-4 left-0 right-0 text-[11.5px] text-slate-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Certificação válida por 12 meses a partir da data de conclusão (até {dataBR(c.valido_ate)}), sujeita a recertificação conforme critérios vigentes do programa MOVV Partner.
        </p>
      </div>
    </div>
  );
}

function Campo({ rotulo, valor, mono }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-slate-500">{rotulo}</p>
      <p className={`mt-1 text-[17px] font-semibold ${mono ? 'font-mono tracking-wider' : ''}`}>{valor}</p>
    </div>
  );
}

function Assinatura({ linha1, linha2 }) {
  return (
    <div>
      <div className="border-t border-slate-400 pt-2">
        <p className="font-semibold">{linha1}</p>
        <p className="text-slate-500 text-[12.5px]">{linha2}</p>
      </div>
    </div>
  );
}
