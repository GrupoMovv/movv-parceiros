import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Bell, BellRinging, Sparkle, Diamond, Fire, MagnifyingGlass, SealCheck, WarningCircle, ArrowRight, Storefront, TrendUp, Bank, Buildings } from '@phosphor-icons/react';
import api from '../../services/api';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, ROXO_ESCURO, DOURADO, DOURADO_ESCURO, PRETO } from '../public/Marketplace/theme';
import ModalPix from '../../components/parceiro/assinatura/ModalPix';
import ModalCartao from '../../components/parceiro/assinatura/ModalCartao';
import { formatarBRL, dataBR } from '../../components/parceiro/assinatura/assinaturaUtils';
import { CONTATO_IUBMAIS, SEM_CANAL_AINDA, linkWhatsapp } from '../../config/contato';

// Mesma foto do slide institucional da home do marketplace (comércio local,
// clima parecido) — mantém a identidade visual consistente entre as duas
// telas em vez de escolher uma imagem nova.
const FOTO_FECHA_MES = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=60';

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

// Mesma lista da página pública /vender (Vender.jsx) — Pioneiro é
// reconhecimento, SEM desconto na mensalidade (cobrança automática pelo MP).
const BENEFICIOS_PIONEIRO = [
  'Selo dourado Pioneiro vitalício',
  'Destaque no marketplace',
  'Reconhecimento como parceiro fundador',
];

function maskCNPJ(v) {
  return String(v || '').replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// O endpoint /public/planos/precos devolve `preco_mensal` = preço da situação
// que o backend DETECTOU pelo CNPJ, e `preco_alternativo` = o outro. Qual dos
// dois é o de sindicalizada depende de `e_sindicalizada`, nunca da ordem dos
// campos — por isso o toggle de visualização desempacota os dois aqui em vez
// de assumir que "alternativo" é o mais barato.
function precosDoPlano(precoInfo, eSindicalizada) {
  if (!precoInfo) return null;
  const sind = eSindicalizada ? precoInfo.preco_mensal : precoInfo.preco_alternativo;
  const normal = eSindicalizada ? precoInfo.preco_alternativo : precoInfo.preco_mensal;
  return {
    sind,
    normal,
    sindFmt: eSindicalizada ? precoInfo.preco_mensal_formatado : precoInfo.preco_alternativo_formatado,
    normalFmt: eSindicalizada ? precoInfo.preco_alternativo_formatado : precoInfo.preco_mensal_formatado,
    // % real de desconto DESTE plano. Não é fixo: Oficial 69,90→34,90 dá 50%,
    // mas Premium dá 38% e Master 23% — badge com número chapado mentiria.
    offPct: normal > 0 ? Math.round(((normal - sind) / normal) * 100) : 0,
  };
}

// Mesma conta de utils/planos.js (formatarValorDiario) no backend — precisa
// existir aqui porque o `preco_diario_formatado` pronto só vem pro preço
// detectado, e o toggle também mostra o outro.
function diarioFmt(precoMensal) {
  return `R$ ${(precoMensal / 30).toFixed(2).replace('.', ',')}`;
}

// Mesmo arredondamento em CENTAVOS de precoAssinatura() no backend: em float,
// 34.90 * 0.95 = 33.1549... e cairia pra 33,15 em vez de 33,16.
function comDescontoCartao(precoMensal, descontoPct) {
  return Math.round(Math.round(precoMensal * 100) * (1 - descontoPct / 100)) / 100;
}

// Também em centavos: 69.90 - 34.90 dá 35.00000000000001 em float, e esse
// resto vaza pra conta do ano (x12).
function economiaMensal({ normal, sind }) {
  return (Math.round(normal * 100) - Math.round(sind * 100)) / 100;
}

// Modal de sindicalização: 1x por SESSÃO (fecha a aba, vê de novo).
const CHAVE_MODAL_SINDICALIZACAO = 'iub_mais_planos_sindicalizacao_visto';

// sessionStorage quebra em aba anônima/storage bloqueado. Na dúvida trata
// como "já viu": não mostrar é melhor do que estourar a tela ou repetir o
// modal a cada render.
function jaViuModal(chave) {
  try { return sessionStorage.getItem(chave) === '1'; } catch { return true; }
}
function marcarModalVisto(chave) {
  try { sessionStorage.setItem(chave, '1'); } catch { /* sem storage: só não persiste */ }
}

export default function ParceiroPlanos() {
  const { parceiro, usuario } = useOutletContext();
  // Assinatura online (Mercado Pago). Sem credenciais configuradas no
  // servidor (opcoes.pronto = false) a tela continua no modo antigo de
  // "Notificar-me quando lançar".
  const [opcoes, setOpcoes] = useState(null);
  const [minha, setMinha] = useState(null);
  const [modalAssinar, setModalAssinar] = useState(null); // { tipo: 'pix'|'cartao', plano } | { tipo: 'pix-pendente' }
  useEffect(() => {
    apiParceiro.get('/parceiro/assinatura/opcoes').then(r => setOpcoes(r.data)).catch(() => setOpcoes(null));
    apiParceiro.get('/parceiro/assinatura/minha').then(r => setMinha(r.data)).catch(() => setMinha(null));
  }, []);
  const cortesia = Boolean(opcoes?.cortesia_interna || minha?.cortesia_interna);
  const modoAssinatura = Boolean(opcoes?.pronto) && !cortesia;
  const assinaturaViva = ['trial', 'ativa', 'pausada'].includes(minha?.assinatura?.status) ? minha.assinatura : null;
  const precoOnline = plano => opcoes?.planos?.find(p => p.plano === plano);
  // Trocando de plano (crédito de dias já pagos): o cabeçalho não promete
  // o trial — quem aparece nos cards é a data da 1ª cobrança.
  const destacarTrial = modoAssinatura && opcoes.trial_disponivel && !opcoes.credito_troca;
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

  // Toggle de VISUALIZAÇÃO de preço (sindicalizada x não). Só muda o que a
  // tela mostra — quem decide o preço cobrado continua sendo o backend, pelo
  // CNPJ (sindicalizacaoService.verificarSindicalizacao). Começa no que foi
  // detectado; o parceiro alterna só pra comparar os dois.
  const [verSindicalizada, setVerSindicalizada] = useState(false);
  useEffect(() => { setVerSindicalizada(eSindicalizada); }, [eSindicalizada]);

  // Preço exibido nos botões de assinar: na situação detectada usa os valores
  // que o backend já calculou (/opcoes); na outra, recalcula com a mesma conta
  // só pra comparação.
  function precosExibidos(planoKey) {
    const reais = precoOnline(planoKey);
    if (!reais || verSindicalizada === eSindicalizada) return reais;
    const p = precosDoPlano(precosData?.planos?.[planoKey], eSindicalizada);
    if (!p) return reais;
    const base = verSindicalizada ? p.sind : p.normal;
    return { ...reais, pix: base, cartao_recorrente: comDescontoCartao(base, opcoes.desconto_cartao_pct) };
  }

  // Toggle em "Sou sindicalizada" com CNPJ fora do SECI: o backend vai cobrar
  // o preço cheio (ele olha o CNPJ, não o toggle). Avisa ANTES, em vez de o
  // parceiro descobrir o valor só no QR do PIX / checkout do cartão.
  const [avisoPreco, setAvisoPreco] = useState(null); // { tipo, plano }
  function pedirAssinatura(tipo, plano) {
    if (verSindicalizada && !eSindicalizada) setAvisoPreco({ tipo, plano });
    else setModalAssinar({ tipo, plano });
  }
  function confirmarPrecoNormal() {
    const alvo = avisoPreco;
    setAvisoPreco(null);
    setVerSindicalizada(false); // alinha a tela com o valor que será cobrado
    setModalAssinar({ tipo: alvo.tipo, plano: alvo.plano });
  }

  // Modal de boas-vindas da sindicalização. É INFORMATIVO: mostra o que o
  // backend já detectou pelo CNPJ, não pergunta nada. Perguntar "você é
  // sindicalizada?" faria a tela prometer um preço que a cobrança não
  // honraria — quem decide o valor é o CNPJ, em assinaturaService.
  const [modalSindicalizacao, setModalSindicalizacao] = useState(null); // null | 'principal' | 'como'
  useEffect(() => {
    if (!precosData || cortesia) return;
    if (jaViuModal(CHAVE_MODAL_SINDICALIZACAO)) return;
    marcarModalVisto(CHAVE_MODAL_SINDICALIZACAO);
    setModalSindicalizacao('principal');
  }, [precosData, cortesia]);

  // Preços dos planos pagos já desempacotados (sind x normal) pro modal —
  // todos os números que ele mostra saem daqui, nunca de texto chapado.
  const resumoPlanos = ORDEM_PLANOS
    .filter(p => p !== 'gratis')
    .map(p => {
      const pr = precosDoPlano(precosData?.planos?.[p], eSindicalizada);
      return pr && { chave: p, nome: META_PLANOS[p].nome, ...pr };
    })
    .filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold" style={{ color: PRETO }}>
          {destacarTrial ? `Escolha seu plano — ${opcoes.trial_dias_cartao} dias GRÁTIS` : 'Escolha o plano ideal pra sua empresa'}
        </h1>
        {modoAssinatura ? (
          <p className="text-slate-500 text-sm mt-3">
            Pague com <strong>PIX</strong> todo mês ou assine no <strong>cartão</strong> com {opcoes.desconto_cartao_pct}% de desconto
            {destacarTrial ? ` e ${opcoes.trial_dias_cartao} dias grátis pra testar` : ''}. Cancele quando quiser.
          </p>
        ) : !cortesia && (
          <>
            <span
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-4 py-2 rounded-full"
              style={{ backgroundColor: `${DOURADO}22`, color: '#92700C' }}
            >
              🔥 Todos os planos estão em breve — aproveite o Grátis ilimitado!
            </span>
            <p className="text-slate-500 text-sm mt-4">
              Estamos ativando planos pagos em breve. Enquanto isso, aproveite o Grátis sem limites e garanta seu bônus como Pioneiro do IUB MAIS!
            </p>
          </>
        )}
      </div>

      {cortesia && (
        <div className="rounded-2xl p-5 flex items-start gap-3" style={{ backgroundColor: `${DOURADO}15`, border: `1px solid ${DOURADO}66` }}>
          <span className="text-2xl">🎁</span>
          <div>
            <p className="font-bold text-sm" style={{ color: '#7A5E00' }}>Cortesia interna — plano {minha?.plano_atual_nome || 'Premium'} sem cobrança</p>
            <p className="text-xs mt-1" style={{ color: '#92700C' }}>Sua loja tem o plano oferecido pelo IUB MAIS. Não precisa assinar nem pagar nada.</p>
          </div>
        </div>
      )}

      {modoAssinatura && assinaturaViva && (
        <div className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <p className="text-sm text-emerald-800">
            ✅ Você assina o <strong>{assinaturaViva.plano_nome}</strong>
            {assinaturaViva.status === 'trial' ? ` — trial grátis até ${dataBR(assinaturaViva.trial_ate)}` : assinaturaViva.acesso_ate ? ` — ativo até ${dataBR(assinaturaViva.acesso_ate)}` : ''}.
          </p>
          <Link to="/parceiro/painel/minha-assinatura" className="text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
            Minha assinatura
          </Link>
        </div>
      )}

      {modoAssinatura && !assinaturaViva && minha?.pix_pendente && minha?.assinatura?.status === 'aguardando_pagamento' && (
        <div className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-sm text-amber-800">⏳ Você tem um PIX de <strong>{formatarBRL(minha.pix_pendente.valor)}</strong> ({minha.assinatura.plano_nome}) aguardando pagamento.</p>
          <button type="button" onClick={() => setModalAssinar({ tipo: 'pix-pendente' })} className="text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO }}>
            Ver QR Code
          </button>
        </div>
      )}

      {modoAssinatura && !assinaturaViva && opcoes.credito_troca && (
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <p className="font-bold text-sm text-blue-900">🔁 Trocando de plano?</p>
          <p className="text-xs text-blue-800 mt-1">
            Você ainda tem o <strong>{opcoes.credito_troca.plano_anterior_nome}</strong> pago até <strong>{dataBR(opcoes.credito_troca.ate)}</strong>.
            Assinando outro plano até {new Date(opcoes.credito_troca.janela_ate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })},
            a gente aproveita esses dias — <strong>nada é cobrado em dobro</strong>.
          </p>
        </div>
      )}

      {/* Com assinatura online o preço já vem calculado pro CNPJ da própria
          loja — a caixa de "verificar outro CNPJ" só faz sentido no modo antigo. */}
      {!modoAssinatura && !cortesia && (
        <VerifiqueSeuPreco
          cnpjInput={cnpjInput}
          setCnpjInput={setCnpjInput}
          checando={checandoCnpj}
          onVerificar={() => verificarPreco(cnpjInput)}
        />
      )}

      {precosData?.cnpj_limpo && (
        <BannerSindicalizacao
          eSindicalizada={eSindicalizada}
          razaoSocial={precosData.razao_social}
          economiaMax={Math.max(0, ...resumoPlanos.map(economiaMensal))}
        />
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

      <BannerFechaMes proximoFechaMes={proximoFechaMes} />

      {!cortesia && precosData && (
        <TogglePrecoSindicalizada
          valor={verSindicalizada}
          onChange={setVerSindicalizada}
          eSindicalizada={eSindicalizada}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ORDEM_PLANOS.map(planoKey => (
          <CardPlano
            key={planoKey}
            planoKey={planoKey}
            meta={META_PLANOS[planoKey]}
            precoInfo={precosData?.planos?.[planoKey]}
            eSindicalizada={eSindicalizada}
            verSindicalizada={verSindicalizada}
            ehAtual={planoAtual === planoKey}
            jaInteressado={interesses?.includes(planoKey)}
            onNotificar={() => setPlanoModal(planoKey)}
            cortesia={cortesia}
            assinatura={modoAssinatura ? {
              precos: precosExibidos(planoKey),
              trial: Boolean(opcoes.trial_disponivel),
              trialDias: opcoes.trial_dias_cartao,
              creditoAte: opcoes.credito_troca?.ate,
              descontoPct: opcoes.desconto_cartao_pct,
              bloqueado: Boolean(assinaturaViva),
              onPix: () => pedirAssinatura('pix', planoKey),
              onCartao: () => pedirAssinatura('cartao', planoKey),
            } : null}
          />
        ))}
      </div>

      <div className="rounded-3xl p-8 text-white" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 100%)` }}>
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-xl font-extrabold flex items-center justify-center gap-2">
            {jaEhPioneiro ? '🏆 Você é um PIONEIRO!' : '🏆 SEJA UM PIONEIRO'}
          </h2>
          {vagasPioneiro && !jaEhPioneiro && (
            <p className="text-xs font-bold mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ backgroundColor: `${DOURADO}22`, color: DOURADO }}>
              🔥 Só restam {vagasPioneiro.vagas_restantes} de {vagasPioneiro.total} vagas
            </p>
          )}
          <p className="text-white/80 text-sm mt-3">{jaEhPioneiro ? 'Seus benefícios de parceiro fundador:' : 'Primeiros 20 parceiros ganham:'}</p>
        </div>

        {/* Sem desconto na mensalidade de propósito: a cobrança é automática
            (Mercado Pago) e cobra o preço do plano. Pioneiro = reconhecimento. */}
        <ul className="flex flex-col gap-2.5 mt-4 max-w-sm mx-auto">
          {BENEFICIOS_PIONEIRO.map(b => (
            <li key={b} className="flex items-start gap-2 text-sm text-white/90">
              <span className="flex-shrink-0">✅</span> {b}
            </li>
          ))}
        </ul>

        <p className="text-white/80 text-sm font-semibold text-center mt-6">
          {jaEhPioneiro
            ? 'Seu selo é vitalício — obrigado por fazer parte da história do IUB MAIS+!'
            : 'Assine agora e faça parte da história do IUB MAIS+!'}
        </p>
      </div>

      {modalAssinar?.tipo === 'pix' && (
        <ModalPix
          plano={modalAssinar.plano}
          planoNome={opcoes.planos.find(p => p.plano === modalAssinar.plano)?.nome}
          valor={precoOnline(modalAssinar.plano)?.pix}
          creditoAte={opcoes.credito_troca?.ate}
          onFechar={() => setModalAssinar(null)}
        />
      )}
      {modalAssinar?.tipo === 'pix-pendente' && minha?.pix_pendente && (
        <ModalPix
          plano={minha.assinatura.plano}
          planoNome={minha.assinatura.plano_nome}
          valor={minha.pix_pendente.valor}
          pixInicial={minha.pix_pendente}
          onFechar={() => setModalAssinar(null)}
        />
      )}
      {modalAssinar?.tipo === 'cartao' && (
        <ModalCartao
          plano={modalAssinar.plano}
          planoNome={opcoes.planos.find(p => p.plano === modalAssinar.plano)?.nome}
          valor={precoOnline(modalAssinar.plano)?.cartao_recorrente}
          trial={Boolean(opcoes.trial_disponivel)}
          trialDias={opcoes.trial_dias_cartao}
          creditoAte={opcoes.credito_troca?.ate}
          publicKey={opcoes.public_key}
          emailPadrao={usuario?.email}
          onFechar={() => setModalAssinar(null)}
        />
      )}

      {modalSindicalizacao === 'principal' && resumoPlanos.length > 0 && (
        <ModalSindicalizacao
          eSindicalizada={eSindicalizada}
          razaoSocial={precosData?.razao_social}
          planos={resumoPlanos}
          onVerPlanos={() => setModalSindicalizacao(null)}
          onComoSindicalizar={() => setModalSindicalizacao('como')}
        />
      )}
      {modalSindicalizacao === 'como' && (
        <ModalComoSindicalizar
          economiaAnual={Math.max(...resumoPlanos.map(economiaMensal)) * 12}
          onVoltar={() => setModalSindicalizacao('principal')}
          onFechar={() => setModalSindicalizacao(null)}
        />
      )}

      {avisoPreco && (
        <ModalPrecoNormal
          planoNome={opcoes?.planos?.find(p => p.plano === avisoPreco.plano)?.nome}
          metodo={avisoPreco.tipo}
          valorCobrado={avisoPreco.tipo === 'pix' ? precoOnline(avisoPreco.plano)?.pix : precoOnline(avisoPreco.plano)?.cartao_recorrente}
          onContinuar={confirmarPrecoNormal}
          onCancelar={() => setAvisoPreco(null)}
        />
      )}

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

// Alterna só a VISUALIZAÇÃO dos preços (sindicalizada x não) pro parceiro
// comparar quanto economizaria sindicalizando. Não muda nada do que é
// cobrado — ver `pedirAssinatura` em ParceiroPlanos.
function TogglePrecoSindicalizada({ valor, onChange, eSindicalizada }) {
  const opcoes = [
    { id: true, rotulo: 'Sou sindicalizada SECI', Icone: Bank },
    { id: false, rotulo: 'Não sou', Icone: Buildings },
  ];
  const simulando = valor !== eSindicalizada;
  return (
    <div className="text-center">
      <div className="inline-flex flex-wrap justify-center gap-2">
        {opcoes.map(({ id, rotulo, Icone }) => {
          const ativo = valor === id;
          return (
            <button
              key={String(id)}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={ativo}
              className="inline-flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-bold px-5 py-3 rounded-full transition-all duration-300 hover:-translate-y-0.5"
              // Inativo continua com cara de BOTÃO (cinza visível + borda),
              // não de campo desabilitado — era a queixa do toggle antigo.
              style={ativo
                ? { backgroundColor: ROXO, color: 'white', border: `2px solid ${ROXO_ESCURO}`, boxShadow: `0 8px 20px ${ROXO}40` }
                : { backgroundColor: '#E5E7EB', color: '#6B7280', border: '2px solid #D1D5DB' }}
            >
              <Icone size={17} weight={ativo ? 'fill' : 'regular'} color={ativo ? DOURADO : '#64748B'} />
              {rotulo}
            </button>
          );
        })}
      </div>
      <p className="text-xs mt-2.5 animate-fade-in" key={`${valor}-${eSindicalizada}`} style={{ color: simulando ? '#92700C' : '#64748B' }}>
        {simulando
          ? (valor
            ? '👀 Simulação — seu CNPJ ainda não consta no SECI, então a cobrança sai pelo preço normal.'
            : '👀 Simulação — sua empresa é sindicalizada, você paga os preços com desconto.')
          : (valor
            ? '✅ Estes já são os seus preços de empresa sindicalizada.'
            : 'Estes são os seus preços. Toque em "Sou sindicalizada SECI" pra ver quanto dá pra economizar.')}
      </p>
    </div>
  );
}

function BannerSindicalizacao({ eSindicalizada, razaoSocial, economiaMax }) {
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
        <p className="text-amber-700 text-xs mt-1">
          Sindicalize-se e economize até {formatarBRL(economiaMax)}/mês nos planos pagos do IUB MAIS.{' '}
          {CONTATO_IUBMAIS.whatsapp
            ? <a href={linkWhatsapp(CONTATO_IUBMAIS.whatsapp, 'Olá! Quero saber como sindicalizar minha empresa ao SECI e pagar menos no IUB MAIS+')} target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: '#92700C' }}>Fale com o IUB MAIS+ pra saber como.</a>
            : SEM_CANAL_AINDA}
        </p>
      </div>
    </div>
  );
}

// Gradient roxo/dourado com foto de fundo desfocada — troca o vermelho
// "alerta" antigo por algo premium, alinhado com a identidade IUB MAIS.
function BannerFechaMes({ proximoFechaMes }) {
  return (
    <div className="relative rounded-3xl overflow-hidden text-white">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO} 0%, ${ROXO} 55%, ${DOURADO_ESCURO} 130%)` }}
      />
      <img
        src={FOTO_FECHA_MES} alt="" loading="lazy"
        className="absolute inset-0 w-full h-full object-cover opacity-25 scale-110"
        style={{ filter: 'blur(2px)' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${ROXO_ESCURO}E6 0%, ${ROXO}CC 60%, ${DOURADO_ESCURO}B3 100%)` }} />

      <Storefront size={110} weight="fill" className="hidden sm:block absolute -bottom-4 -right-4 opacity-[0.08]" />
      <Sparkle size={28} weight="fill" color={DOURADO} className="absolute top-6 right-10 opacity-70 animate-hero-float-planos" style={{ animationDelay: '0.4s' }} />
      <TrendUp size={26} weight="fill" color="#fff" className="hidden sm:block absolute bottom-10 right-32 opacity-60 animate-hero-float-planos" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 p-8">
        <div className="flex items-start gap-4 max-w-2xl mx-auto">
          <span className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center mt-1" style={{ backgroundColor: `${DOURADO}26` }}>
            <Fire size={26} weight="fill" color={DOURADO} />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-black tracking-tight">🔥 Seu produto no Fecha Mês</h2>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              Toda última sexta do mês, o IUB MAIS realiza o <strong className="text-white">Fecha Mês</strong>: vitrine especial com destaque, comunicação direta pros associados e picos de vendas de <strong className="text-white">até 5x</strong> em 24h.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-5 max-w-md">
              {[['Oficial', 4], ['Premium', 9], ['Master', 15]].map(([nome, n]) => (
                <div key={nome} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-center backdrop-blur-sm">
                  <p className="text-xl font-black" style={{ color: DOURADO }}>{n}</p>
                  <p className="text-[11px] text-white/70 mt-0.5">{nome}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-5">
              {proximoFechaMes && (
                <span className="text-xs font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10">
                  📅 Próximo: {new Date(`${proximoFechaMes.data_evento}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                </span>
              )}
              <Link
                to="/parceiro/painel/fecha-mes"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-transform hover:scale-[1.03]"
                style={{ backgroundColor: DOURADO, color: '#0F0F14' }}
              >
                Saiba mais <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hero-float-planos { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-hero-float-planos { animation: hero-float-planos 3.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function CardPlano({ planoKey, meta, precoInfo, eSindicalizada, verSindicalizada, ehAtual, jaInteressado, onNotificar, cortesia, assinatura }) {
  const emBreve = planoKey !== 'gratis' && !assinatura && !cortesia;
  const p = planoKey === 'gratis' ? null : precosDoPlano(precoInfo, eSindicalizada);
  const valor = p && (verSindicalizada ? p.sind : p.normal);
  const valorFmt = p && (verSindicalizada ? p.sindFmt : p.normalFmt);
  // "De R$ X" + badge só aparecem na visão sindicalizada e só se esse plano
  // realmente tiver desconto.
  const mostrarDesconto = Boolean(p && verSindicalizada && p.offPct > 0);

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
        ) : (
          // key força o remount a cada troca de toggle — é o que dispara o fade.
          <div key={verSindicalizada ? 'sind' : 'normal'} className="animate-fade-in">
            {mostrarDesconto && <p className="text-slate-400 text-sm line-through">De {p.normalFmt}</p>}
            <p className="text-3xl font-extrabold" style={{ color: meta.maisEscolhido ? ROXO : PRETO }}>
              {valorFmt} <span className="text-sm font-medium text-slate-400">/mês</span>
            </p>
            <p className="text-slate-400 text-xs mt-0.5">Apenas {diarioFmt(valor)} por dia</p>
            {mostrarDesconto && (
              <span className="inline-block mt-1.5 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: `${DOURADO}33`, color: '#92700C' }}>
                🏆 {p.offPct}% OFF SINDICALIZADA
              </span>
            )}
          </div>
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
        ehAtual ? (
          <button disabled className="mt-6 w-full text-sm font-semibold py-3 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed">
            Plano ativo
          </button>
        ) : assinatura ? (
          <Link to="/parceiro/painel/minha-assinatura" className="mt-6 w-full text-center text-sm font-semibold py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
            Voltar pro Grátis
          </Link>
        ) : null
      ) : cortesia ? (
        <button disabled className="mt-6 w-full text-sm font-semibold py-3 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed">
          {ehAtual ? 'Seu plano (cortesia)' : 'Cortesia interna'}
        </button>
      ) : assinatura ? (
        <OpcoesAssinatura key={verSindicalizada ? 'sind' : 'normal'} planoKey={planoKey} destaque={meta.maisEscolhido} ehAtual={ehAtual} {...assinatura} />
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

// PIX (preço cheio, paga na hora, sem trial) x Cartão recorrente (5% OFF,
// trial, recomendado). Preços já calculados pro CNPJ da loja (/opcoes).
function OpcoesAssinatura({ ehAtual, precos, trial, trialDias, creditoAte, descontoPct, bloqueado, onPix, onCartao }) {
  if (!precos) return null;
  // Troca de plano: se os dias já pagos passam do trial, é isso que o
  // cartão oferece (mesma regra do ModalCartao/backend).
  const porCredito = Boolean(creditoAte) && new Date(creditoAte).getTime() >= (trial ? Date.now() + trialDias * 864e5 : 0);
  if (bloqueado) {
    return (
      <Link to="/parceiro/painel/minha-assinatura"
        className={`mt-6 w-full text-center text-sm font-semibold py-3 rounded-xl ${ehAtual ? 'bg-emerald-50 text-emerald-700' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
        {ehAtual ? 'Seu plano atual' : 'Ver minha assinatura'}
      </Link>
    );
  }
  return (
    <div className="mt-6 space-y-2 animate-fade-in">
      <div className="rounded-xl border-2 p-3" style={{ borderColor: DOURADO, background: `${DOURADO}0D` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ backgroundColor: DOURADO, color: '#0F0F14' }}>⭐ Recomendado</span>
          <span className="text-[10px] font-bold text-emerald-700">{descontoPct}% OFF</span>
        </div>
        <p className="text-sm mt-1.5" style={{ color: PRETO }}>
          Cartão: <strong>{formatarBRL(precos.cartao_recorrente)}</strong><span className="text-slate-400 text-xs">/mês</span>
        </p>
        {porCredito
          ? <p className="text-[11px] font-semibold mt-0.5 text-blue-800">🔁 1ª cobrança só em {dataBR(creditoAte)} (dias já pagos)</p>
          : trial && <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#7A5E00' }}>🎁 {trialDias} dias grátis pra testar</p>}
        <button type="button" onClick={onCartao}
          className="mt-2 w-full text-sm font-bold py-2.5 rounded-lg text-white transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ backgroundColor: ROXO }}>
          {porCredito ? 'Trocar pro cartão' : trial ? 'Começar grátis no cartão' : 'Assinar com cartão'}
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-sm" style={{ color: PRETO }}>
          PIX: <strong>{formatarBRL(precos.pix)}</strong><span className="text-slate-400 text-xs">/mês</span>
        </p>
        <button type="button" onClick={onPix}
          className="mt-2 w-full text-sm font-semibold py-2.5 rounded-lg border-2 transition-colors hover:bg-purple-50" style={{ borderColor: ROXO, color: ROXO }}>
          Assinar com PIX
        </button>
      </div>
    </div>
  );
}

// Casca comum dos modais da sindicalização: backdrop escuro, centralizado,
// 500px no desktop e tela cheia no celular.
//
// Vai num portal pro <body> de propósito. Renderizado dentro do <main>, o
// `position: fixed` não colava no topo da viewport (medido: rect.top = 32 num
// viewport de 844, sem ancestral com transform aparente) e o header do painel
// aparecia por cima do modal full-screen no celular. No body não há ancestral
// nenhum pra criar bloco contentor, então `inset-0` é a tela inteira de novo.
function CascaModal({ children, onFechar }) {
  // Sem isso a página (4000+px) rola atrás do modal de tela cheia.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15,15,20,0.72)' }} onClick={onFechar}>
      <div
        className="relative bg-white w-full h-full overflow-y-auto sm:h-auto sm:max-h-[92vh] sm:max-w-[500px] sm:rounded-3xl shadow-2xl p-6 sm:p-7 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function BotaoGrande({ children, onClick, variante = 'roxo' }) {
  const estilos = {
    roxo: { backgroundColor: ROXO, color: 'white', border: `2px solid ${ROXO_ESCURO}` },
    claro: { backgroundColor: '#F1F5F9', color: '#334155', border: '2px solid #E2E8F0' },
  };
  return (
    <button
      type="button" onClick={onClick}
      className="w-full min-h-[60px] flex items-center justify-center gap-2 text-sm font-bold rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg px-4"
      style={estilos[variante]}
    >
      {children}
    </button>
  );
}

// Primeira visita da tela de Planos (1x por sessão). INFORMATIVO: conta o que
// o backend já sabe pelo CNPJ. Todos os valores vêm de `planos`, inclusive os
// percentuais — "50% OFF" só vale pro Oficial, então a copy fala "até X%".
function ModalSindicalizacao({ eSindicalizada, razaoSocial, planos, onVerPlanos, onComoSindicalizar }) {
  const economias = planos.map(economiaMensal);
  const economiaMax = Math.max(...economias);
  const economiaMin = Math.min(...economias);
  const pctMax = Math.max(...planos.map(p => p.offPct));
  const anual = economiaMax * 12;

  if (eSindicalizada) {
    return (
      <CascaModal onFechar={onVerPlanos}>
        <div className="text-center">
          <span className="inline-flex w-20 h-20 rounded-full items-center justify-center text-4xl" style={{ backgroundColor: '#DCFCE7' }}>🎊</span>
          <h2 className="text-xl font-black mt-4 leading-tight" style={{ color: '#166534' }}>PARABÉNS! VOCÊ É SÓCIA SECI!</h2>
          <p className="text-slate-600 text-sm mt-2">
            {razaoSocial ? <strong>{razaoSocial}</strong> : 'Sua empresa'} está em dia com o SECI, então seus preços já saem com até <strong>{pctMax}% OFF</strong> aplicado:
          </p>
        </div>

        <div className="rounded-2xl mt-5 divide-y" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', border: '1px solid #BBF7D0' }}>
          {planos.map(p => (
            <div key={p.chave} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: '#BBF7D0' }}>
              <span className="text-sm font-bold" style={{ color: '#166534' }}>{p.nome}</span>
              <span className="text-sm">
                <span className="text-slate-400 line-through mr-2">{p.normalFmt}</span>
                <strong className="text-base" style={{ color: '#15803D' }}>{p.sindFmt}</strong>
                <span className="text-slate-400 text-xs">/mês</span>
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-sm font-bold mt-4" style={{ color: '#166534' }}>
          💰 Economia de {formatarBRL(economiaMin)} a {formatarBRL(economiaMax)} por mês
        </p>

        <div className="mt-6">
          <BotaoGrande onClick={onVerPlanos}>Ver planos</BotaoGrande>
        </div>
      </CascaModal>
    );
  }

  return (
    <CascaModal onFechar={onVerPlanos}>
      <div className="text-center">
        <span className="inline-flex w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
          <Bank size={40} weight="duotone" color="#B45309" />
        </span>
        <h2 className="text-xl font-black mt-4 leading-tight" style={{ color: '#92400E' }}>SUA EMPRESA PODE PAGAR MENOS!</h2>
        <p className="text-slate-600 text-sm mt-2">
          Empresas sindicalizadas ao SECI pagam até <strong>{pctMax}% a menos</strong> em todos os planos:
        </p>
      </div>

      <div className="rounded-2xl mt-5" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
        {planos.map((p, i) => (
          <div key={p.chave} className="flex items-center justify-between gap-3 px-4 py-3" style={i ? { borderTop: '1px solid #FDE68A' } : undefined}>
            <span className="text-sm font-bold" style={{ color: '#92400E' }}>{p.nome}</span>
            <span className="text-sm">
              <strong className="text-base" style={{ color: '#B45309' }}>{p.sindFmt}</strong>
              <span className="text-slate-400 text-xs"> (era {p.normalFmt})</span>
            </span>
          </div>
        ))}
      </div>

      <p className="text-center text-sm font-bold mt-4" style={{ color: '#92400E' }}>
        💰 Economia de até {formatarBRL(anual)} por ano!
      </p>

      <div className="flex flex-col gap-2.5 mt-6">
        <BotaoGrande onClick={onVerPlanos}>Ver planos</BotaoGrande>
        <BotaoGrande onClick={onComoSindicalizar} variante="claro">
          <Bank size={18} weight="bold" /> Como virar sindicalizada SECI
        </BotaoGrande>
      </div>
    </CascaModal>
  );
}

// Segundo modal. A regra de "em dia" é a do backend
// (contribuintesImportService.classificarStatus): pagou pelo menos 1 das 3
// guias mensais recentes.
function ModalComoSindicalizar({ economiaAnual, onVoltar, onFechar }) {
  const passos = [
    'Sua empresa precisa estar contribuindo com o SECI através da guia mensal do sindicato.',
    'Vale como "em dia" quem pagou pelo menos 1 das 3 guias mais recentes.',
    'O IUB MAIS confere seu CNPJ na base de contribuintes do SECI e aplica o desconto sozinho — você não precisa avisar nem pedir.',
  ];
  return (
    <CascaModal onFechar={onFechar}>
      <div className="text-center">
        <span className="inline-flex w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: `${ROXO}15` }}>
          <Bank size={40} weight="duotone" color={ROXO} />
        </span>
        <h2 className="text-xl font-black mt-4 leading-tight" style={{ color: PRETO }}>Como virar sindicalizada SECI</h2>
        <p className="text-slate-500 text-sm mt-2">Sindicalizando, você economiza até <strong>{formatarBRL(economiaAnual)}/ano</strong> só no IUB MAIS+.</p>
      </div>

      <ol className="flex flex-col gap-3 mt-5">
        {passos.map((passo, i) => (
          <li key={passo} className="flex items-start gap-3 text-sm text-slate-600">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: ROXO }}>{i + 1}</span>
            {passo}
          </li>
        ))}
      </ol>

      {CONTATO_IUBMAIS.whatsapp ? (
        <div className="rounded-2xl p-4 mt-5" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ficou com dúvida?</p>
          <div className="flex flex-col gap-2 mt-2">
            <a href={linkWhatsapp(CONTATO_IUBMAIS.whatsapp)} target="_blank" rel="noreferrer" className="text-sm font-bold" style={{ color: ROXO }}>
              💬 Falar com IUB MAIS+
            </a>
            {CONTATO_IUBMAIS.site && (
              <a href={CONTATO_IUBMAIS.site} target="_blank" rel="noreferrer" className="text-sm font-bold" style={{ color: ROXO }}>
                🔗 {CONTATO_IUBMAIS.site.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-400 text-xs mt-5">{SEM_CANAL_AINDA}</p>
      )}

      <div className="rounded-2xl p-4 mt-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <p className="text-xs" style={{ color: '#92700C' }}>
          <strong>Já é sindicalizada e aparece que não?</strong> Pode ser que seu CNPJ ainda não esteja na base que o IUB MAIS recebe do SECI
          {CONTATO_IUBMAIS.whatsapp ? ' — fale com a gente que regularizamos.' : '. Assim que o nosso canal de atendimento abrir, a gente regulariza pra você.'}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 mt-6">
        <BotaoGrande onClick={onVoltar} variante="claro">Voltar</BotaoGrande>
      </div>
    </CascaModal>
  );
}

// O parceiro estava vendo os preços de sindicalizada, mas o CNPJ dele não
// está no SECI. O fluxo NÃO é bloqueado: explica e segue pelo preço cheio,
// que é o que o backend cobra de qualquer jeito.
function ModalPrecoNormal({ planoNome, metodo, valorCobrado, onContinuar, onCancelar }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15,15,20,0.6)' }} onClick={onCancelar}>
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
        <WarningCircle size={40} weight="duotone" color="#D97706" className="mx-auto" />
        <h2 className="text-lg font-extrabold mt-3" style={{ color: PRETO }}>Preço sindicalizada precisa do SECI</h2>
        <p className="text-slate-600 text-sm mt-2">
          Pra pagar o preço de empresa sindicalizada, seu CNPJ precisa estar cadastrado e em dia no SECI.
          Por enquanto, será cobrado o <strong>preço normal</strong>.
        </p>

        {valorCobrado != null && (
          <div className="rounded-2xl p-4 mt-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#92700C' }}>Valor que será cobrado</p>
            <p className="text-2xl font-black mt-1" style={{ color: '#7A5E00' }}>{formatarBRL(valorCobrado)}<span className="text-sm font-medium">/mês</span></p>
            <p className="text-[11px] mt-0.5" style={{ color: '#92700C' }}>{planoNome} — {metodo === 'pix' ? 'PIX' : 'cartão'}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-6">
          <button type="button" onClick={onContinuar} className="text-sm font-bold py-3 rounded-xl text-white transition-colors" style={{ backgroundColor: ROXO }}>
            Continuar pelo preço normal
          </button>
          <button type="button" onClick={onCancelar} className="text-sm font-semibold py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
        </div>

        <p className="text-slate-400 text-[11px] mt-4">
          Já é sindicalizada?{' '}
          {CONTATO_IUBMAIS.whatsapp ? (
            <a
              href={linkWhatsapp(CONTATO_IUBMAIS.whatsapp, 'Olá! Minha empresa é sindicalizada ao SECI, mas o IUB MAIS+ não está reconhecendo meu CNPJ.')}
              target="_blank" rel="noreferrer" className="font-bold" style={{ color: ROXO }}
            >
              Fale com o IUB MAIS+
            </a>
          ) : 'Assim que o nosso canal de atendimento abrir, a gente regulariza'} o cadastro do seu CNPJ.
        </p>
      </div>
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
            Como Pioneiro, você ganha <strong>selo dourado vitalício</strong>, destaque no marketplace e reconhecimento como parceiro fundador!
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
