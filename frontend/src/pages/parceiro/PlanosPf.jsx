import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, DOURADO, PRETO } from '../public/Marketplace/theme';
import ModalPix from '../../components/parceiro/assinatura/ModalPix';
import ModalCartao from '../../components/parceiro/assinatura/ModalCartao';
import { formatarBRL, dataBR } from '../../components/parceiro/assinatura/assinaturaUtils';

// Planos do Vendedor Pessoa Física (Junior, 01/10/2026): Vendedor Casual e
// Empreendedor, preço único (sem Base SECI), mesmo fluxo de PIX/cartão das
// empresas. Preços, limites, trial e desconto vêm TODOS do backend
// (/parceiro/assinatura/opcoes ← config/planos.js) — nada chapado aqui.
// Sem plano pago, nada do vendedor aparece no site (status 'aguardando_plano').

const RESUMO = {
  pf_casual: 'Pra quem vende de vez em quando',
  pf_empreendedor: 'Pra quem vende sempre',
};

export default function PlanosPf({ usuario }) {
  const [opcoes, setOpcoes] = useState(null);
  const [minha, setMinha] = useState(null);
  const [erro, setErro] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: 'pix'|'cartao', plano } | { tipo: 'pix-pendente' }

  useEffect(() => {
    apiParceiro.get('/parceiro/assinatura/opcoes').then(r => setOpcoes(r.data)).catch(() => setErro(true));
    apiParceiro.get('/parceiro/assinatura/minha').then(r => setMinha(r.data)).catch(() => setMinha(null));
  }, []);

  if (erro) return <p className="text-center text-slate-500 py-12">Não foi possível carregar os planos agora. Recarregue a página.</p>;
  if (!opcoes) return <p className="text-center text-slate-400 py-12">Carregando planos…</p>;

  const cortesia = Boolean(opcoes.cortesia_interna || minha?.cortesia_interna);
  const emVerificacao = opcoes.aguardando_verificacao;
  const assinaturaViva = ['trial', 'ativa', 'pausada'].includes(minha?.assinatura?.status) ? minha.assinatura : null;
  const podeAssinar = opcoes.pronto && !cortesia && !emVerificacao && !assinaturaViva;
  const destacarTrial = opcoes.trial_disponivel && !opcoes.credito_troca;
  const precoDe = plano => opcoes.planos.find(p => p.plano === plano);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold" style={{ color: PRETO }}>
          {destacarTrial && podeAssinar ? `Escolha seu plano — ${opcoes.trial_dias_cartao} dias GRÁTIS no cartão` : 'Escolha seu plano de vendedor'}
        </h1>
        <p className="text-slate-500 text-sm mt-2">
          PIX todo mês ou cartão com {opcoes.desconto_cartao_pct}% de desconto. Sem comissão sobre suas vendas. Cancele quando quiser.
        </p>
      </div>

      {/* "em verificação" e "anúncios fora do site" já aparecem no topo do painel (PainelLayout) */}
      {cortesia && (
        <Aviso cor="amber" titulo="🎁 Cortesia interna">Sua conta tem plano oferecido pelo IUB. Não precisa assinar nem pagar nada.</Aviso>
      )}
      {!opcoes.pronto && !cortesia && (
        <Aviso cor="amber" titulo="Pagamento online indisponível agora">Fale com a gente pelo WhatsApp de suporte (no rodapé) pra assinar.</Aviso>
      )}
      {assinaturaViva && (
        <div className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <p className="text-sm text-emerald-800">
            ✅ Você assina o <strong>{assinaturaViva.plano_nome}</strong>
            {assinaturaViva.status === 'trial' ? ` — grátis até ${dataBR(assinaturaViva.trial_ate)}` : assinaturaViva.acesso_ate ? ` — ativo até ${dataBR(assinaturaViva.acesso_ate)}` : ''}.
          </p>
          <Link to="/parceiro/painel/minha-assinatura" className="text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Minha assinatura</Link>
        </div>
      )}
      {!assinaturaViva && minha?.pix_pendente && minha?.assinatura?.status === 'aguardando_pagamento' && (
        <div className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-sm text-amber-800">⏳ Você tem um PIX de <strong>{formatarBRL(minha.pix_pendente.valor)}</strong> ({minha.assinatura.plano_nome}) aguardando pagamento.</p>
          <button type="button" onClick={() => setModal({ tipo: 'pix-pendente' })} className="text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: ROXO }}>Ver QR Code</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {opcoes.planos.map(p => {
          const atual = assinaturaViva?.plano === p.plano;
          return (
            <div key={p.plano} className="rounded-2xl border bg-white p-6 flex flex-col shadow-sm" style={{ borderColor: atual ? '#10B981' : '#E2E8F0' }}>
              <p className="font-bold text-base" style={{ color: PRETO }}>{p.nome}</p>
              <p className="text-xs text-slate-500">{RESUMO[p.plano]}</p>
              <p className="text-3xl font-extrabold mt-3" style={{ color: PRETO }}>
                {formatarBRL(p.pix)} <span className="text-sm font-medium text-slate-400">/mês</span>
              </p>
              <ul className="space-y-2 mt-4 flex-1">
                {[`Até ${p.max_produtos} produtos ativos`, 'Aparece na busca e na sua categoria', 'Sem comissão sobre as vendas'].map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={15} weight="bold" className="flex-shrink-0 mt-0.5" style={{ color: '#16A34A' }} /> {b}
                  </li>
                ))}
              </ul>
              {atual ? (
                <Link to="/parceiro/painel/minha-assinatura" className="mt-5 w-full text-center text-sm font-semibold py-3 rounded-xl bg-emerald-50 text-emerald-700">Seu plano atual</Link>
              ) : podeAssinar ? (
                <div className="mt-5 space-y-2">
                  <div className="rounded-xl border-2 p-3" style={{ borderColor: DOURADO, background: `${DOURADO}0D` }}>
                    <p className="text-sm" style={{ color: PRETO }}>
                      Cartão: <strong>{formatarBRL(p.cartao_recorrente)}</strong><span className="text-slate-400 text-xs">/mês</span>
                      <span className="text-[10px] font-bold text-emerald-700 ml-2">{opcoes.desconto_cartao_pct}% OFF</span>
                    </p>
                    {opcoes.credito_troca
                      ? <p className="text-[11px] font-semibold mt-0.5 text-blue-800">🔁 1ª cobrança só em {dataBR(opcoes.credito_troca.ate)} (dias já pagos)</p>
                      : opcoes.trial_disponivel && <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#7A5E00' }}>🎁 {opcoes.trial_dias_cartao} dias grátis pra testar</p>}
                    <button type="button" onClick={() => setModal({ tipo: 'cartao', plano: p.plano })}
                      className="mt-2 w-full text-sm font-bold py-2.5 rounded-lg text-white" style={{ backgroundColor: ROXO }}>
                      {opcoes.trial_disponivel && !opcoes.credito_troca ? 'Começar grátis no cartão' : 'Assinar com cartão'}
                    </button>
                  </div>
                  <button type="button" onClick={() => setModal({ tipo: 'pix', plano: p.plano })}
                    className="w-full text-sm font-semibold py-2.5 rounded-lg border-2 hover:bg-purple-50" style={{ borderColor: ROXO, color: ROXO }}>
                    Assinar com PIX — {formatarBRL(p.pix)}
                  </button>
                </div>
              ) : (
                <button disabled className="mt-5 w-full text-sm font-semibold py-3 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed">
                  {emVerificacao ? 'Disponível após a verificação' : assinaturaViva ? 'Troque em Minha assinatura' : 'Indisponível agora'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {modal?.tipo === 'pix' && (
        <ModalPix plano={modal.plano} planoNome={precoDe(modal.plano)?.nome} valor={precoDe(modal.plano)?.pix}
          creditoAte={opcoes.credito_troca?.ate} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === 'pix-pendente' && minha?.pix_pendente && (
        <ModalPix plano={minha.assinatura.plano} planoNome={minha.assinatura.plano_nome} valor={minha.pix_pendente.valor}
          pixInicial={minha.pix_pendente} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === 'cartao' && (
        <ModalCartao plano={modal.plano} planoNome={precoDe(modal.plano)?.nome} valor={precoDe(modal.plano)?.cartao_recorrente}
          trial={Boolean(opcoes.trial_disponivel)} trialDias={opcoes.trial_dias_cartao} creditoAte={opcoes.credito_troca?.ate}
          publicKey={opcoes.public_key} emailPadrao={usuario?.email} onFechar={() => setModal(null)} />
      )}
    </div>
  );
}

function Aviso({ cor, titulo, children }) {
  const estilos = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  return (
    <div className={`rounded-2xl px-5 py-4 border ${estilos[cor]}`} role="status">
      <p className="font-bold">{titulo}</p>
      <p className="text-sm mt-1 opacity-90">{children}</p>
    </div>
  );
}
