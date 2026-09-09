import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Bell, BellRinging, Sparkle, Diamond, Fire, MagnifyingGlass, SealCheck, WarningCircle } from '@phosphor-icons/react';
import api from '../../services/api';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, ROXO_ESCURO, DOURADO, DOURADO_ESCURO, PRETO } from '../public/Marketplace/theme';

// Metadados de exibição por plano — o PREÇO de verdade (sindicalizada ou
// não) vem sempre do endpoint GET /public/planos/precos (config/planos.js
// no backend), nunca hardcoded aqui, pra nunca divergir.
const META_PLANOS = {
  gratis: {
    nome: 'Parceiro IUB — Grátis',
    beneficios: [
      'Perfil completo da empresa',
      'Até 30 produtos',
      'WhatsApp direto',
      'Aparece no marketplace',
      'Selo "Parceiro IUB"',
    ],
  },
  oficial: {
    nome: 'Oficial',
    beneficios: [
      'Tudo do Grátis',
      'Selo dourado "PARCEIRO OFICIAL"',
      '4 produtos em destaque na home',
      'Analytics básico (visitas, cliques)',
      'Suporte prioritário por e-mail',
    ],
  },
  premium: {
    nome: 'Premium',
    maisEscolhido: true,
    beneficios: [
      'Tudo do Oficial',
      '9 produtos em destaque',
      'Push notification pros associados (2/mês)',
      'Aparece em "Parceiros em Destaque" (topo da home)',
      'Analytics completo',
      'Suporte prioritário por WhatsApp',
      'Boost mensal de fim de semana',
      'Integração com Instagram',
    ],
  },
  master: {
    nome: 'Master',
    beneficios: [
      'Tudo do Premium',
      'Produtos ilimitados',
      '15 produtos em destaque',
      'Post no Instagram oficial IUB MAIS (mensal)',
      'Live mensal exclusiva com nossa equipe',
      'Biblioteca de materiais exclusivos (vídeos, PDFs, templates)',
      'Selo VIP dourado exclusivo',
      'Banner personalizado no seu perfil',
      'Convite pra eventos exclusivos',
    ],
  },
};

const ORDEM_PLANOS = ['gratis', 'oficial', 'premium', 'master'];

function maskCNPJ(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function ParceiroPlanos() {
  const { parceiro } = useOutletContext();
  const [interesses, setInteresses] = useState(null);
  const [planoModal, setPlanoModal] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const [vagasPioneiro, setVagasPioneiro] = useState(null);

  const [cnpjInput, setCnpjInput] = useState(parceiro?.cnpj ? maskCNPJ(parceiro.cnpj) : '');
  const [precosData, setPrecosData] = useState(null);
  const [checandoCnpj, setChecandoCnpj] = useState(false);

  const planoAtual = parceiro?.plano || 'gratis';
  const jaEhPioneiro = Boolean(parceiro?.e_pioneiro);

  useEffect(() => {
    apiParceiro.get('/parceiro/interessados')
      .then(res => setInteresses(res.data.planos))
      .catch(() => setInteresses([]));
  }, []);

  useEffect(() => {
    api.get('/public/marketplace/pioneiro-vagas')
      .then(res => setVagasPioneiro(res.data))
      .catch(() => setVagasPioneiro(null));
  }, []);

  const [proximoFechaMes, setProximoFechaMes] = useState(null);
  useEffect(() => {
    api.get('/public/fecha-mes/proximo')
      .then(res => setProximoFechaMes(res.data))
      .catch(() => setProximoFechaMes(null));
  }, []);

  async function verificarPreco(cnpjMascarado) {
    const cnpjDigits = cnpjMascarado.replace(/\D/g, '');
    setChecandoCnpj(true);
    try {
      const res = await api.get('/public/planos/precos', { params: cnpjDigits.length === 14 ? { cnpj: cnpjDigits } : {} });
      setPrecosData(res.data);
    } catch (err) {
      if (err.response?.status === 400) toast.error('CNPJ inválido');
      setPrecosData(null);
    } finally {
      setChecandoCnpj(false);
    }
  }

  // Auto-verifica com o CNPJ da própria empresa assim que carrega — o
  // parceiro não precisa digitar de novo o que a gente já sabe.
  useEffect(() => {
    if (parceiro?.cnpj) verificarPreco(parceiro.cnpj);
    else verificarPreco('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parceiro?.cnpj]);

  async function confirmarInteresse() {
    setEnviando(true);
    try {
      await apiParceiro.post('/parceiro/interessados', { plano_interesse: planoModal });
      setInteresses(atuais => [...(atuais || []), planoModal]);
      toast.success(`Você será notificado quando o ${META_PLANOS[planoModal].nome} lançar!`);
      setPlanoModal(null);
    } catch {
      toast.error('Erro ao registrar interesse. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const eSindicalizada = Boolean(precosData?.e_sindicalizada);

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold" style={{ color: PRETO }}>Escolha o plano ideal pra sua empresa</h1>
        <span
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-4 py-2 rounded-full"
          style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}
        >
          🔥 Todos os planos estão em breve — aproveite o Grátis ilimitado!
        </span>
        <p className="text-slate-500 text-sm mt-4">
          Estamos ativando planos pagos em breve. Enquanto isso, aproveite o Grátis sem limites e garanta seu bônus como Pioneiro do IUB MAIS!
        </p>
      </div>

      <VerifiqueSeuPreco
        cnpjInput={cnpjInput}
        setCnpjInput={setCnpjInput}
        checando={checandoCnpj}
        onVerificar={() => verificarPreco(cnpjInput)}
      />

      {precosData?.cnpj_limpo && (
        <BannerSindicalizacao eSindicalizada={eSindicalizada} razaoSocial={precosData.razao_social} />
      )}

      <div className="rounded-3xl p-8 text-white" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <div className="flex items-start gap-4 max-w-2xl mx-auto">
          <Fire size={32} weight="duotone" color={DOURADO} className="flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-extrabold">No IUB MAIS, sua empresa não fica apenas cadastrada</h2>
            <p className="text-white/70 text-sm mt-2 leading-relaxed">
              Nos planos pagos, seus produtos entram numa <strong className="text-white">vitrine rotativa</strong> que gira todos os dias na home do marketplace pra milhares de consumidores de Itumbiara. Mais produtos na fila = mais oportunidades de aparecer!
            </p>
            <div className="grid grid-cols-3 gap-3 mt-5">
              {ORDEM_PLANOS.filter(p => p !== 'gratis').map(p => (
                <div key={p} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
                  <p className="text-xl font-black" style={{ color: DOURADO }}>{precosData?.planos?.[p]?.produtos_rotativa ?? '—'}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">produto{precosData?.planos?.[p]?.produtos_rotativa > 1 ? 's' : ''} — {META_PLANOS[p].nome}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl p-8 text-white" style={{ background: `linear-gradient(135deg, #7C2D12 0%, #DC2626 55%, ${DOURADO_ESCURO} 100%)` }}>
        <div className="flex items-start gap-4 max-w-2xl mx-auto">
          <Fire size={32} weight="fill" color={DOURADO} className="flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-extrabold">🔥 Seu produto no Fecha Mês!</h2>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              Todo último sexta do mês, o IUB MAIS realiza o <strong className="text-white">Fecha Mês</strong>: vitrine especial com destaque, comunicação direta pros associados e picos de vendas de até 5x.
            </p>
            <p className="text-white/80 text-sm mt-2 font-semibold">Participar é exclusivo pra planos pagos:</p>
            <ul className="space-y-1.5 mt-2">
              {[
                'Oficial: 4 produtos no Fecha Mês',
                'Premium: 9 produtos',
                'Master: 15 produtos + destaque VIP',
              ].map(b => (
                <li key={b} className="flex items-start gap-2 text-sm text-white/85">
                  <Check size={14} weight="bold" className="flex-shrink-0 mt-0.5" style={{ color: DOURADO }} />
                  {b}
                </li>
              ))}
            </ul>
            {proximoFechaMes && (
              <p className="text-xs font-bold mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10">
                📅 Próximo Fecha Mês: {new Date(`${proximoFechaMes.data_evento}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ORDEM_PLANOS.map(planoKey => (
          <CardPlano
            key={planoKey}
            planoKey={planoKey}
            meta={META_PLANOS[planoKey]}
            precoInfo={precosData?.planos?.[planoKey]}
            eSindicalizada={eSindicalizada}
            cnpjVerificado={Boolean(precosData?.cnpj_limpo)}
            ehAtual={planoAtual === planoKey}
            jaInteressado={interesses?.includes(planoKey)}
            onNotificar={() => setPlanoModal(planoKey)}
          />
        ))}
      </div>

      <div className="rounded-3xl p-8 text-white" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <div className="text-center max-w-xl mx-auto">
          <p className="text-2xl">⭐</p>
          <h2 className="text-xl font-extrabold mt-2 flex items-center justify-center gap-2">
            {jaEhPioneiro ? 'Você é um parceiro Pioneiro!' : 'Vire um parceiro Pioneiro'}
          </h2>
          {vagasPioneiro && !jaEhPioneiro && (
            <p className="text-xs font-bold mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ backgroundColor: `${DOURADO}22`, color: DOURADO }}>
              🔥 Só restam {vagasPioneiro.vagas_restantes} de {vagasPioneiro.total} vagas
            </p>
          )}
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-xl mx-auto">
          {[
            'Primeiros 20 parceiros pagantes: 50% OFF nos 3 primeiros meses',
            'Selo dourado "PIONEIRO IUB MAIS" vitalício no perfil',
            '1 post grátis no Instagram @iubmais',
            'Aparece no Mural da Fama do site',
            'Prioridade em novas funcionalidades',
          ].map(b => (
            <li key={b} className="flex items-start gap-2 text-sm text-white/85">
              <Check size={16} weight="bold" className="flex-shrink-0 mt-0.5" style={{ color: DOURADO }} />
              {b}
            </li>
          ))}
        </ul>

        <p className="text-white/60 text-xs text-center mt-6">
          {jaEhPioneiro
            ? 'Seu selo é vitalício — obrigado por confiar no IUB MAIS desde o início!'
            : 'Vaga garantida assim que seu plano pago for ativado (o desconto é combinado com nossa equipe).'}
        </p>
      </div>

      {planoModal && (
        <ModalNotificar
          plano={META_PLANOS[planoModal]}
          enviando={enviando}
          onConfirmar={confirmarInteresse}
          onCancelar={() => setPlanoModal(null)}
        />
      )}
    </div>
  );
}

function VerifiqueSeuPreco({ cnpjInput, setCnpjInput, checando, onVerificar }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-bold text-sm" style={{ color: PRETO }}>Verifique seu preço</p>
      <p className="text-slate-500 text-xs mt-0.5">Empresas sindicalizadas ao SECI pagam menos em todos os planos pagos.</p>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input
          value={cnpjInput}
          onChange={e => setCnpjInput(maskCNPJ(e.target.value))}
          placeholder="00.000.000/0000-00"
          className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
        <button
          type="button"
          onClick={onVerificar}
          disabled={checando || cnpjInput.replace(/\D/g, '').length !== 14}
          className="flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl text-white disabled:opacity-50"
          style={{ backgroundColor: ROXO }}
        >
          <MagnifyingGlass size={16} weight="bold" /> {checando ? 'Verificando...' : 'Ver meu preço'}
        </button>
      </div>
    </div>
  );
}

function BannerSindicalizacao({ eSindicalizada, razaoSocial }) {
  if (eSindicalizada) {
    return (
      <div className="rounded-2xl p-5 flex items-start gap-3" style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
        <SealCheck size={26} weight="fill" color="#16A34A" className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm text-emerald-800">🎉 Parabéns! {razaoSocial ? `${razaoSocial} é` : 'Sua empresa é'} SINDICALIZADA ao SECI!</p>
          <p className="text-emerald-700 text-xs mt-1">Você tem desconto EXCLUSIVO em todos os planos pagos do IUB MAIS — os preços abaixo já são os seus.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl p-5 flex items-start gap-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
      <WarningCircle size={26} weight="fill" color="#D97706" className="flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-bold text-sm text-amber-800">⚠️ {razaoSocial ? `${razaoSocial} não está` : 'Sua empresa não está'} contribuindo com o SECI.</p>
        <p className="text-amber-700 text-xs mt-1">Sindicalize-se e economize até R$ 35/mês nos planos pagos do IUB MAIS. Fale com a gente pelo WhatsApp pra saber como.</p>
      </div>
    </div>
  );
}

function CardPlano({ planoKey, meta, precoInfo, eSindicalizada, cnpjVerificado, ehAtual, jaInteressado, onNotificar }) {
  const emBreve = planoKey !== 'gratis';
  const temDesconto = eSindicalizada && precoInfo && precoInfo.economia > 0;

  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col ${emBreve ? 'opacity-90' : ''} ${meta.maisEscolhido ? 'shadow-lg' : 'shadow-sm'}`}
      style={{
        borderColor: meta.maisEscolhido ? DOURADO : ehAtual ? '#10B981' : '#E2E8F0',
        borderWidth: meta.maisEscolhido ? 2 : 1,
        background: meta.maisEscolhido ? `linear-gradient(160deg, white 0%, ${DOURADO}0D 100%)` : 'white',
      }}
    >
      {ehAtual && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full bg-emerald-500 text-white whitespace-nowrap">
          Seu plano atual
        </span>
      )}
      {emBreve && (
        <span className="absolute -top-3 right-4 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-700 text-white whitespace-nowrap">
          🔜 Em breve
        </span>
      )}
      {meta.maisEscolhido && (
        <span
          className="absolute -top-3 left-4 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1"
          style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
        >
          <Sparkle size={11} weight="fill" /> Mais escolhido
        </span>
      )}

      <p className="font-bold text-base mt-3" style={{ color: PRETO }}>{meta.nome}</p>

      <div className="mt-2 min-h-[84px]">
        {!precoInfo ? (
          <p className="text-3xl font-extrabold text-slate-300">···</p>
        ) : planoKey === 'gratis' ? (
          <p className="text-3xl font-extrabold" style={{ color: PRETO }}>
            R$ 0 <span className="text-sm font-medium text-slate-400">/mês SEMPRE</span>
          </p>
        ) : temDesconto ? (
          <>
            <p className="text-slate-400 text-sm line-through">De {precoInfo.preco_alternativo_formatado}</p>
            <p className="text-3xl font-extrabold" style={{ color: meta.maisEscolhido ? ROXO : PRETO }}>
              {precoInfo.preco_mensal_formatado} <span className="text-sm font-medium text-slate-400">/mês</span>
            </p>
            <p className="text-slate-400 text-xs mt-0.5">Apenas {precoInfo.preco_diario_formatado} por dia</p>
            <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${DOURADO}33`, color: '#92700C' }}>
              Economia {precoInfo.economia_formatada}/mês
            </span>
          </>
        ) : (
          <>
            <p className="text-3xl font-extrabold" style={{ color: meta.maisEscolhido ? ROXO : PRETO }}>
              {precoInfo.preco_mensal_formatado} <span className="text-sm font-medium text-slate-400">/mês</span>
            </p>
            <p className="text-slate-400 text-xs mt-0.5">Apenas {precoInfo.preco_diario_formatado} por dia</p>
            {!cnpjVerificado && (
              <p className="text-[11px] mt-1.5" style={{ color: '#92700C' }}>💡 {precoInfo.preco_alternativo_formatado} pra empresas sindicalizadas</p>
            )}
          </>
        )}
      </div>

      <ul className="space-y-2 mt-5 flex-1">
        {meta.beneficios.map(b => (
          <li key={b} className="flex items-start gap-2 text-xs text-slate-600">
            <Check size={14} weight="bold" className="flex-shrink-0 mt-0.5" style={{ color: '#16A34A' }} />
            {b}
          </li>
        ))}
      </ul>

      {planoKey === 'gratis' ? (
        <button disabled className="mt-6 w-full text-sm font-semibold py-3 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed">
          Plano ativo
        </button>
      ) : jaInteressado ? (
        <button disabled className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl bg-emerald-50 text-emerald-600 cursor-not-allowed">
          <Check size={16} weight="bold" /> Você será notificado
        </button>
      ) : (
        <button
          type="button"
          onClick={onNotificar}
          className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundColor: meta.maisEscolhido ? DOURADO : ROXO, color: meta.maisEscolhido ? '#0F0F14' : 'white' }}
        >
          <Bell size={15} weight="fill" /> Notificar-me quando lançar!
        </button>
      )}
    </div>
  );
}

function ModalNotificar({ plano, enviando, onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={onCancelar}>
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
        <BellRinging size={40} weight="duotone" color={ROXO} className="mx-auto" />
        <h2 className="text-lg font-extrabold mt-3" style={{ color: PRETO }}>Ótimo!</h2>
        <p className="text-slate-600 text-sm mt-2">
          Quando ativarmos o <strong>{plano.nome}</strong>, você será um dos primeiros a saber!
        </p>

        <div className="rounded-2xl p-4 mt-4 text-left" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}55` }}>
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide" style={{ color: '#92700C' }}>
            <Diamond size={14} weight="duotone" /> Bônus Pioneiro
          </p>
          <p className="text-sm mt-1.5" style={{ color: '#7A5E00' }}>
            Como Pioneiro, você ganha <strong>3 meses grátis</strong> do plano quando lançarmos!
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button
            type="button" onClick={onConfirmar} disabled={enviando}
            className="flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            <Check size={16} weight="bold" /> Quero ser Pioneiro
          </button>
          <button type="button" onClick={onCancelar} disabled={enviando} className="text-sm font-semibold py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
