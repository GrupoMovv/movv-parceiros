import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRound, KeyRound, Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { NIVEIS, dataBR } from './identidade';

// Meu perfil do MOVV Partner: dados do cadastro (quem altera é a Central),
// situação da certificação e troca de senha.
export default function PartnerPerfil() {
  const { user } = useAuth();
  const [univ, setUniv] = useState(null);
  useEffect(() => { api.get('/universidade').then(r => setUniv(r.data)).catch(() => {}); }, []);
  const cert = univ?.certificado;
  const linhas = [
    ['Nome', user?.name], ['Código de login', user?.code], ['E-mail', user?.email],
    ['WhatsApp', user?.whatsapp || '—'], ['Nível', NIVEIS[user?.nivel_partner] || 'A definir pela Central'],
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-movv-900 flex items-center justify-center"><UserRound className="w-6 h-6 text-gold-300" /></div>
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900">Meu perfil</h1>
          <p className="text-sm text-slate-500">MOVV Partner</p>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <dl className="divide-y divide-slate-100">
          {linhas.map(([r, v]) => (
            <div key={r} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 px-5 py-3">
              <dt className="text-sm text-slate-500 sm:w-40 flex-shrink-0">{r}</dt>
              <dd className="font-medium text-slate-900 break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-sm text-slate-500">Para corrigir nome, e-mail, WhatsApp ou nível, fale com a Central Movv.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/universidade/certificado" className="card p-4 flex items-center gap-3 hover:border-gold-500/60">
          <Award className="w-6 h-6 text-gold-700" />
          <span className="text-sm">
            <span className="block font-semibold text-slate-900">Certificação</span>
            <span className="text-slate-500">{cert ? `${cert.codigo} · até ${dataBR(cert.valido_ate)}` : 'Ainda não certificado'}</span>
          </span>
        </Link>
        <Link to="/alterar-senha" className="card p-4 flex items-center gap-3 hover:border-gold-500/60">
          <KeyRound className="w-6 h-6 text-movv-900" />
          <span className="text-sm"><span className="block font-semibold text-slate-900">Alterar senha</span><span className="text-slate-500">Troque a sua senha de acesso</span></span>
        </Link>
      </div>
    </div>
  );
}
