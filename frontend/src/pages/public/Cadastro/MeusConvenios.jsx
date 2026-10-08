import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, FileText } from 'lucide-react';
import { WhatsappLogo } from '@phosphor-icons/react';
import apiPainel from '../../../services/apiPainel';
import { linkWhatsappComTexto } from '../../../utils/carteirinhaWhatsapp';

const NAVY = '#0B1F3A';
const ROXO = '#5B21B6';

// /meu/convenios — convênios exclusivos do SECI (parte "e" do Clube, 08/10).
// Só o associado logado vê: a lista (tabela seci_convenios) e o PDF, servido
// com login. Nada disso aparece no marketplace público.
export default function MeusConvenios() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [abrindoPdf, setAbrindoPdf] = useState(false);

  useEffect(() => {
    apiPainel.get('/public/painel/convenios')
      .then(r => setDados(r.data))
      .catch(err => setErro(err.response?.data?.error || 'Não deu para carregar os convênios agora.'));
  }, []);

  async function abrirPdf() {
    // Abre a aba antes do download: navegador de celular bloqueia aba aberta
    // depois de uma espera.
    const aba = window.open('', '_blank');
    setAbrindoPdf(true);
    try {
      const r = await apiPainel.get('/public/painel/convenios/pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      if (aba) aba.location.href = url; else window.location.href = url;
    } catch {
      if (aba) aba.close();
      toast.error('Não deu para abrir o PDF agora.');
    } finally {
      setAbrindoPdf(false);
    }
  }

  if (erro) return <p className="text-sm text-slate-500 py-12 text-center">{erro}</p>;
  if (!dados) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const ativo = dados.situacao === 'ativo';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Meus convênios</h1>
        <p className="text-slate-500 text-sm mt-1">Convênios exclusivos para associados do SECI. Mostre a sua carteirinha na hora de usar.</p>
      </div>

      {!ativo && (
        <div className="rounded-2xl px-4 py-3 text-sm bg-amber-50 text-amber-900 border border-amber-200">
          Sua carteirinha não está ativa agora. Os convênios valem com a carteirinha em dia.{' '}
          <Link to="/meu" className="font-bold underline">Ver como resolver</Link>
        </div>
      )}

      {dados.tem_pdf && (
        <button type="button" onClick={abrirPdf} disabled={abrindoPdf}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl text-white disabled:opacity-60" style={{ backgroundColor: ROXO }}>
          {abrindoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Ver o catálogo completo (PDF)
        </button>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {dados.convenios.map(c => (
          <div key={c.slug} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">{c.icone || '🤝'}</span>
              <div className="min-w-0">
                <p className="font-bold text-sm" style={{ color: NAVY }}>{c.nome}</p>
                <p className="text-xs text-slate-400">{[c.categoria, c.endereco].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <p className="text-sm font-bold rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF3C7', color: '#92700C' }}>🏷️ {c.beneficio}</p>
            {c.descricao && <p className="text-xs text-slate-500">{c.descricao}</p>}
            {c.whatsapp && (
              <a href={linkWhatsappComTexto(c.whatsapp, `Olá! Sou associado do SECI e gostaria de usar o convênio com ${c.nome}.`)}
                target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <WhatsappLogo size={16} weight="fill" /> Chamar no WhatsApp
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
