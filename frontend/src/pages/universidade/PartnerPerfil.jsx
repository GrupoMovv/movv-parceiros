import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserRound, KeyRound, Award, Wallet, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { NIVEIS, dataBR } from './identidade';
import { PasswordField } from '../AlterarSenha';

// Meu perfil do MOVV Partner: dados do cadastro (quem altera é a Central),
// chave PIX para receber a comissão (o Partner troca, com a senha atual),
// CPF/CNPJ (só leitura e mascarado: quem cadastra é a Central), situação
// da certificação e troca de senha.
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
      <Pagamento />
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

const TIPOS_PIX = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['telefone', 'Celular'], ['aleatoria', 'Chave aleatória']];
const NOME_TIPO_PIX = Object.fromEntries(TIPOS_PIX);
const DICA_PIX = { cpf: 'Só os números do CPF', cnpj: 'Só os números do CNPJ', email: 'nome@exemplo.com', telefone: 'DDD + número, ex.: 64 99999-1234', aleatoria: 'Ex.: 123e4567-e89b-12d3-a456-426614174000' };
const TIPO_PARCEIRO = { mei: 'MEI', pj: 'PJ', autonomo: 'Autônomo' };

// Dados para receber a comissão
function Pagamento() {
  const [perfil, setPerfil] = useState(null);
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ pix_key_type: 'cpf', pix_key: '', senha_atual: '' });
  const [salvando, setSalvando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const carregar = () => api.get('/partner/perfil').then(r => setPerfil(r.data)).catch(() => {});
  useEffect(() => { carregar(); }, []);
  function abrir() {
    setF({ pix_key_type: perfil?.pix_key_type || 'cpf', pix_key: perfil?.pix_key || '', senha_atual: '' });
    setErro('');
    setVerSenha(false);
    setEditando(true);
  }
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.put('/partner/perfil/pix', f);
      toast.success('Chave PIX salva');
      setEditando(false);
      carregar();
    } catch (err) {
      // a mensagem fica no formulário (senha errada, chave inválida) e o que
      // foi digitado continua lá para corrigir
      setErro(err.response?.data?.error || 'Erro ao salvar a chave PIX');
    } finally { setSalvando(false); }
  }
  if (!perfil) return null;
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
        <Wallet className="w-5 h-5 text-movv-900" />
        <h2 className="font-semibold text-slate-900">Para receber a comissão</h2>
      </div>
      {perfil.faltas.length > 0 && (
        <div className="mx-5 mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Falta {perfil.faltas.join(' e ')}. Sem isso a comissão não pode ser paga.{perfil.faltas.includes('CPF/CNPJ') ? ' O CPF/CNPJ é cadastrado pela Central Movv.' : ''}</span>
        </div>
      )}
      <dl className="divide-y divide-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 px-5 py-3">
          <dt className="text-sm text-slate-500 sm:w-40 flex-shrink-0">Chave PIX</dt>
          <dd className="font-medium text-slate-900 break-all flex-1">{perfil.pix_key ? `${perfil.pix_key} (${NOME_TIPO_PIX[perfil.pix_key_type]})` : 'Não cadastrada'}</dd>
          {!editando && <button className="btn-secondary text-sm self-start sm:self-auto mt-2 sm:mt-0" onClick={abrir}>{perfil.pix_key ? 'Trocar' : 'Cadastrar'}</button>}
        </div>
        {editando && (
          <form onSubmit={salvar} className="px-5 py-4 space-y-3 bg-slate-50">
            <div><label className="label">Tipo da chave</label>
              <select className="input" value={f.pix_key_type} onChange={e => setF(x => ({ ...x, pix_key_type: e.target.value }))}>
                {TIPOS_PIX.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </select>
            </div>
            <div><label className="label">Chave</label>
              <input className="input" value={f.pix_key} placeholder={DICA_PIX[f.pix_key_type]} autoComplete="off"
                inputMode={['cpf', 'cnpj', 'telefone'].includes(f.pix_key_type) ? 'numeric' : f.pix_key_type === 'email' ? 'email' : 'text'}
                onChange={e => { setErro(''); setF(x => ({ ...x, pix_key: e.target.value })); }} />
            </div>
            <PasswordField label="Sua senha atual" value={f.senha_atual} show={verSenha} onToggle={() => setVerSenha(v => !v)}
              onChange={v => { setErro(''); setF(x => ({ ...x, senha_atual: v })); }}
              hint="Por segurança, a troca da chave pede a sua senha. A troca fica registrada e a Central é avisada no sistema." />
            {erro && <p role="alert" className="text-sm text-red-600 font-medium">{erro}</p>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditando(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={salvando || !f.pix_key.trim() || !f.senha_atual}>Salvar chave PIX</button>
            </div>
          </form>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 px-5 py-3">
          <dt className="text-sm text-slate-500 sm:w-40 flex-shrink-0">CPF/CNPJ</dt>
          <dd className="font-medium text-slate-900 break-all">
            {perfil.documento ? `${perfil.documento}${perfil.tipo_parceiro ? ` · ${TIPO_PARCEIRO[perfil.tipo_parceiro]}` : ''}` : 'Não cadastrado'}
            <span className="block text-xs font-normal text-slate-500">Preenchido pela Central Movv</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
