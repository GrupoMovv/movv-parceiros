import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import api from '../../../services/api';
import InputDataBR from '../Cadastro/InputDataBR';
import { entrarNoPainelSeguro } from '../../../utils/entrarNoPainelSeguro';
import {
  soDigitos, validCPF, validCNPJ, maskDocumento, maskCpf, maskTelefone, telefoneValido,
} from '../../../utils/documentos';
import {
  CascaAcesso, Cartao, Campo, InputSenha, BotaoPrimario, BotaoSecundario, BotaoWhatsapp, Aviso,
} from './AcessoUi';

const SENHA_MIN = 6;

// Fluxo 1 do /acesso — associado SECI, no máximo 2 telas:
//   1) localizar a empresa (CNPJ) ou o filiado pessoa física (CPF) na Base SECI
//   2) dados da pessoa + senha -> conta criada e já logada -> /marketplace
export default function AcessoSeci() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [etapa, setEtapa] = useState(1);

  const [documento, setDocumento] = useState(() => maskDocumento(params.get('documento') || ''));
  const [consulta, setConsulta] = useState({ status: 'idle' }); // idle | carregando | em_dia | pendente | nao_encontrado | erro

  const [form, setForm] = useState({ nome_completo: '', cpf: '', data_nascimento: null, whatsapp: '', senha: '', confirmar: '' });
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState(null); // { code, error } vinda do servidor que não é de campo
  const [enviando, setEnviando] = useState(false);

  const digitos = soDigitos(documento);
  const ehCnpj = digitos.length === 14;
  const docCompleto = digitos.length === 11 || digitos.length === 14;
  const empresa = consulta.dados;
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social;

  async function localizar(e) {
    e?.preventDefault();
    if (!docCompleto) return;
    if (ehCnpj ? !validCNPJ(digitos) : !validCPF(digitos)) {
      setConsulta({ status: 'erro', mensagem: ehCnpj ? 'Esse CNPJ não é válido — confira os números.' : 'Esse CPF não é válido — confira os números.' });
      return;
    }
    setConsulta({ status: 'carregando' });
    try {
      const res = await api.get('/public/verificar-cnpj-seci', { params: { documento: digitos } });
      const d = res.data;
      if (!d.encontrado) setConsulta({ status: 'nao_encontrado', dados: d });
      else setConsulta({ status: d.em_dia ? 'em_dia' : 'pendente', dados: d });
    } catch (err) {
      const mensagem = err.response?.status === 429
        ? 'Muitas consultas seguidas. Espere alguns minutos e tente de novo.'
        : err.response?.data?.error || 'Não conseguimos consultar agora. Verifique sua internet e tente de novo.';
      setConsulta({ status: 'erro', mensagem });
    }
  }

  // Link vindo do Fluxo 2 (CNPJ que já está na base) chega com ?documento= — já consulta.
  useEffect(() => {
    if (params.get('documento') && docCompleto) localizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mudarDocumento(v) {
    setDocumento(maskDocumento(v));
    if (consulta.status !== 'idle') setConsulta({ status: 'idle' });
  }

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: null }));
  }

  function validar() {
    const e = {};
    const nome = form.nome_completo.trim();
    if (nome.length < 3 || !nome.includes(' ')) e.nome_completo = 'Digite seu nome e sobrenome.';
    if (ehCnpj && !validCPF(form.cpf)) e.cpf = 'CPF inválido — confira os números.';
    if (!form.data_nascimento) e.data_nascimento = 'Preencha sua data de nascimento.';
    if (!telefoneValido(form.whatsapp)) e.whatsapp = 'Digite o WhatsApp com DDD. Ex.: (64) 99999-9999';
    if (form.senha.length < SENHA_MIN) e.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
    else if (form.senha !== form.confirmar) e.confirmar = 'As senhas não são iguais.';
    if (!aceite) e.aceite = 'Marque para continuar.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function criarConta(e) {
    e.preventDefault();
    setFalha(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const cpfDigits = ehCnpj ? soDigitos(form.cpf) : digitos;
      const res = await api.post('/public/acesso/seci', {
        documento: digitos,
        cpf: cpfDigits,
        nome_completo: form.nome_completo,
        data_nascimento: form.data_nascimento,
        whatsapp: soDigitos(form.whatsapp),
        senha: form.senha,
        aceite_comunicacao: aceite,
      });
      const ok = await entrarNoPainelSeguro(res.data.token, cpfDigits);
      if (!ok) {
        setFalha({ error: 'Sua conta foi criada, mas não conseguimos entrar agora. Faça login com seu CPF e senha.', code: 'JA_TEM_CONTA' });
        return;
      }
      toast.success(`Bem-vindo(a), ${res.data.nome_curto}! 🎉`);
      navigate('/marketplace', { replace: true });
    } catch (err) {
      const d = err.response?.data || {};
      if (d.code === 'PENDENTE' || d.code === 'NAO_ENCONTRADO') {
        setEtapa(1);
        setConsulta({ status: d.code === 'PENDENTE' ? 'pendente' : 'nao_encontrado', dados: consulta.dados });
      } else if (d.campo) {
        setErros(x => ({ ...x, [d.campo]: d.tentativas_restantes ? `${d.error} Restam ${d.tentativas_restantes} tentativa(s).` : d.error }));
      } else {
        setFalha({ error: d.error || 'Não conseguimos concluir agora. Verifique sua internet e tente de novo.', code: d.code || (d.bloqueado ? 'BLOQUEADO' : null) });
      }
    } finally {
      setEnviando(false);
    }
  }

  const msgWhatsapp = nomeEmpresa
    ? `Olá! Preciso de ajuda pra acessar o IUB MAIS+ como associado SECI (${nomeEmpresa}).`
    : 'Olá! Preciso de ajuda pra acessar o IUB MAIS+ como associado SECI.';

  if (etapa === 2) {
    return (
      <CascaAcesso
        titulo="Falta pouco! 🎉"
        subtitulo={nomeEmpresa ? `Associado(a) pela ${nomeEmpresa}. Agora é só você.` : 'Seu CPF está ativo no SECI. Agora é só você.'}
        onVoltar={() => { setEtapa(1); setFalha(null); }}
        mensagemWhatsapp={msgWhatsapp}
      >
        <Cartao>
          <form onSubmit={criarConta} className="space-y-4" noValidate>
            <h2 className="font-black text-lg text-slate-900">Seus dados</h2>

            <Campo label="Nome completo" erro={erros.nome_completo}>
              <input className="input" autoComplete="name" value={form.nome_completo} onChange={e => set('nome_completo', e.target.value)} placeholder="Como está no seu documento" />
            </Campo>

            {ehCnpj && (
              <Campo label="Seu CPF" erro={erros.cpf}>
                <input className="input" inputMode="numeric" value={form.cpf} onChange={e => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" />
              </Campo>
            )}

            <Campo label="Data de nascimento" erro={erros.data_nascimento} dica="Já é associado? Use a mesma data do seu cadastro no Sindicato.">
              <InputDataBR className="input" valueISO={form.data_nascimento} onChangeISO={iso => set('data_nascimento', iso)} idadeMinima={14} />
            </Campo>

            <Campo label="WhatsApp" erro={erros.whatsapp} dica="É por ele que você recupera a senha.">
              <input className="input" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={e => set('whatsapp', maskTelefone(e.target.value))} placeholder="(64) 99999-9999" />
            </Campo>

            <Campo label="Crie uma senha" erro={erros.senha} dica={`Mínimo de ${SENHA_MIN} caracteres.`}>
              <InputSenha value={form.senha} onChange={e => set('senha', e.target.value)} />
            </Campo>

            <Campo label="Confirme a senha" erro={erros.confirmar}>
              <InputSenha value={form.confirmar} onChange={e => set('confirmar', e.target.value)} />
            </Campo>

            <div>
              <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={aceite} onChange={e => { setAceite(e.target.checked); setErros(x => ({ ...x, aceite: null })); }} className="mt-0.5 w-5 h-5 accent-violet-700 flex-shrink-0" />
                Aceito receber pelo WhatsApp comunicados do SECI e benefícios do IUB MAIS+.
              </label>
              {erros.aceite && <p className="text-red-600 text-xs mt-1 ml-8">{erros.aceite}</p>}
            </div>

            {falha && <FalhaCadastro falha={falha} mensagemWhatsapp={msgWhatsapp} />}

            <BotaoPrimario carregando={enviando}>CRIAR MINHA CONTA</BotaoPrimario>
          </form>
        </Cartao>
      </CascaAcesso>
    );
  }

  return (
    <CascaAcesso
      titulo="Vamos localizar sua empresa"
      subtitulo="Digite o CNPJ da empresa onde você trabalha — ou o seu CPF, se você é filiado(a) pessoa física."
      voltarPara="/acesso"
      mensagemWhatsapp={msgWhatsapp}
    >
      <Cartao>
        <form onSubmit={localizar} className="space-y-4">
          <Campo label="CNPJ ou CPF">
            <input
              className="input text-lg tracking-wide"
              inputMode="numeric"
              autoFocus
              value={documento}
              onChange={e => mudarDocumento(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </Campo>

          {consulta.status !== 'em_dia' && (
            <BotaoPrimario carregando={consulta.status === 'carregando'} disabled={!docCompleto}>
              <MagnifyingGlass size={20} weight="bold" /> LOCALIZAR
            </BotaoPrimario>
          )}
        </form>

        {consulta.status === 'erro' && <div className="mt-4"><Aviso tipo="erro" titulo={consulta.mensagem} /></div>}

        {consulta.status === 'em_dia' && (
          <div className="mt-4 space-y-4">
            {empresa?.tipo === 'cnpj' ? (
              <Aviso tipo="ok" titulo={`✅ Bem-vindo(a), ${empresa.razao_social}!`}>
                Sua empresa está <strong>ATIVA</strong> no SECI.
                {empresa.nome_fantasia && empresa.nome_fantasia !== empresa.razao_social && (
                  <span className="block mt-1 text-emerald-800">{empresa.nome_fantasia}</span>
                )}
              </Aviso>
            ) : (
              <Aviso tipo="ok" titulo="✅ Encontramos seu cadastro!">
                Seu CPF está <strong>ATIVO</strong> no SECI.
              </Aviso>
            )}
            <BotaoPrimario type="button" onClick={() => setEtapa(2)}>
              CONTINUAR <ArrowRight size={18} weight="bold" />
            </BotaoPrimario>
            <p className="text-center text-sm font-semibold text-violet-800">Falta pouco! Só mais uma tela.</p>
          </div>
        )}

        {consulta.status === 'pendente' && (
          <div className="mt-4 space-y-4">
            <Aviso tipo="alerta" titulo={`⚠️ Detectamos uma pendência${empresa?.razao_social ? ` com ${empresa.razao_social}` : ' com este cadastro'}.`}>
              Fale com o sindicato para regularizar — é rapidinho, e depois é só voltar aqui.
            </Aviso>
            <BotaoWhatsapp mensagem={`Olá! Quero regularizar a situação ${empresa?.razao_social ? `da ${empresa.razao_social} (${documento})` : `do CPF ${documento}`} no SECI pra acessar o IUB MAIS+.`} />
          </div>
        )}

        {consulta.status === 'nao_encontrado' && (
          <div className="mt-4 space-y-3">
            <Aviso tipo="info" titulo="Não encontramos sua empresa na base SECI.">
              Sem problema! Você trabalha no comércio?
            </Aviso>
            <BotaoPrimario type="button" onClick={() => navigate(ehCnpj ? `/acesso/comercio?cnpj=${digitos}` : '/acesso/comercio')}>
              Sim, quero me associar
            </BotaoPrimario>
            <BotaoSecundario onClick={() => navigate('/acesso/basico')}>
              Não, sou de outro segmento
            </BotaoSecundario>
          </div>
        )}
      </Cartao>

      <p className="text-center text-white/80 text-sm mt-6">
        Já tem conta? <Link to="/entrar" className="font-bold text-white underline underline-offset-4">Fazer login</Link>
      </p>
    </CascaAcesso>
  );
}

function FalhaCadastro({ falha, mensagemWhatsapp }) {
  if (falha.code === 'JA_TEM_CONTA') {
    return (
      <div className="space-y-3">
        <Aviso tipo="info" titulo={falha.error} />
        <Link to="/entrar" className="w-full min-h-[52px] flex items-center justify-center rounded-2xl font-black text-base text-white" style={{ backgroundColor: '#4C1D95' }}>
          FAZER LOGIN
        </Link>
      </div>
    );
  }
  const falarComSindicato = ['SEM_NASCIMENTO', 'INATIVO', 'BLOQUEADO'].includes(falha.code);
  return (
    <div className="space-y-3">
      <Aviso tipo={falarComSindicato ? 'alerta' : 'erro'} titulo={falha.error} />
      {falarComSindicato && <BotaoWhatsapp mensagem={mensagemWhatsapp} />}
    </div>
  );
}
