import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Trash2, Truck, Store, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { WhatsappLogo } from '@phosphor-icons/react';
import apiPainel, { getPainelToken } from '../../../services/apiPainel';
import ConfirmarWhatsapp from '../../../components/ConfirmarWhatsapp';
import BotaoVoltar from '../../../components/ui/BotaoVoltar';
import { ROXO, PRETO } from '../Marketplace/theme';
import { lerSacola, mudarQuantidade, limparSacola, aoMudarSacola } from './sacola';

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const campoCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400';
const ENDERECO_VAZIO = { cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '' };
const ROTULO_PIX = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Celular', aleatoria: 'Chave aleatória' };

function textoEndereco(e) {
  return [`${e.endereco}, ${e.numero}`, e.complemento, e.bairro, e.cidade && `${e.cidade}/${e.estado}`].filter(Boolean).join(' — ');
}

// /pedido/finalizar — Finalizar pedido (botão Comprar). Uma loja só; preços,
// taxa e total vêm SEMPRE do servidor (cotação) — o pedido cobra exatamente
// o valor deste resumo. Pagamento: Pix direto pra loja, depois do aceite.
export default function FinalizarPedido() {
  const navigate = useNavigate();
  const [sacola, setSacola] = useState(lerSacola);
  const [me, setMe] = useState(null);
  const [recentes, setRecentes] = useState([]);
  const [modo, setModo] = useState(null);
  const [escolhaEndereco, setEscolhaEndereco] = useState(null); // 'cadastro' | 'recente-N' | 'novo'
  const [novo, setNovo] = useState(ENDERECO_VAZIO);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [maior18, setMaior18] = useState(false);
  const [cotacao, setCotacao] = useState(null);
  const [erroCotacao, setErroCotacao] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
    if (!getPainelToken()) { navigate('/entrar?voltar=/pedido/finalizar', { replace: true }); return; }
    apiPainel.get('/public/painel/me').then(res => setMe(res.data))
      .catch(() => navigate('/entrar?voltar=/pedido/finalizar', { replace: true }));
    apiPainel.get('/public/pedidos/enderecos-recentes').then(res => setRecentes(res.data.enderecos)).catch(() => {});
  }, [navigate]);

  useEffect(() => aoMudarSacola(() => setSacola(lerSacola())), []);

  const temCadastro = Boolean(me?.cep && me?.endereco && me?.numero && me?.bairro);
  useEffect(() => {
    if (escolhaEndereco || !me) return;
    setEscolhaEndereco(recentes.length ? 'recente-0' : temCadastro ? 'cadastro' : 'novo');
  }, [me, recentes, temCadastro, escolhaEndereco]);

  const itensEntrada = useMemo(() => (sacola?.itens || []).map(({ tipo, id, quantidade }) => ({ tipo, id, quantidade })), [sacola]);

  // Cotação no servidor a cada mudança de itens/modo
  useEffect(() => {
    if (!me || !itensEntrada.length) { setCotacao(null); return undefined; }
    let vivo = true;
    apiPainel.post('/public/pedidos/cotacao', { itens: itensEntrada, modo_recebimento: modo })
      .then(res => {
        if (!vivo) return;
        setCotacao(res.data); setErroCotacao(null);
        if (!modo && res.data.loja.modos.length === 1) setModo(res.data.loja.modos[0]);
      })
      .catch(err => { if (vivo) { setErroCotacao(err.response?.data || { error: 'Não conseguimos calcular o pedido agora.' }); } });
    return () => { vivo = false; };
  }, [me, itensEntrada, modo]);

  async function buscarCep(cep) {
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json();
      if (r.erro) { toast.error('CEP não encontrado'); return; }
      setNovo(n => ({ ...n, endereco: r.logradouro || n.endereco, bairro: r.bairro || n.bairro, cidade: r.localidade || n.cidade, estado: r.uf || n.estado }));
    } catch {
      toast.error('Não deu pra buscar o CEP agora');
    } finally {
      setBuscandoCep(false);
    }
  }

  function enderecoEscolhido() {
    if (escolhaEndereco === 'cadastro') return { cep: me.cep, endereco: me.endereco, numero: me.numero, bairro: me.bairro, cidade: me.cidade, estado: me.estado, complemento: novo.complemento, referencia: novo.referencia };
    if (escolhaEndereco?.startsWith('recente-')) return recentes[Number(escolhaEndereco.split('-')[1])];
    return novo;
  }

  async function enviar() {
    if (!modo) return toast.error('Escolha entrega ou retirada.');
    setEnviando(true);
    try {
      const res = await apiPainel.post('/public/pedidos', {
        itens: itensEntrada, modo_recebimento: modo, endereco: modo === 'entrega' ? enderecoEscolhido() : undefined,
        observacao: observacao || undefined, confirmo_maior_18: maior18 || undefined,
      });
      limparSacola();
      setEnviado(res.data);
      window.scrollTo(0, 0);
    } catch (err) {
      const r = err.response?.data || {};
      toast.error(r.error || 'Não conseguimos enviar o pedido. Tente de novo.');
      if (r.code === 'WHATSAPP_NAO_CONFIRMADO') setMe(m => ({ ...m, whatsapp_confirmado: false }));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) return <PedidoEnviado pedido={enviado} />;
  if (!me) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;

  if (!sacola?.itens.length) {
    return (
      <Casca>
        <p className="text-center text-slate-500 py-12">Seu pedido está vazio.</p>
        <Link to="/marketplace" className="block text-center font-semibold underline" style={{ color: ROXO }}>Ver produtos</Link>
      </Casca>
    );
  }

  const loja = cotacao?.loja;
  const itemComErro = erroCotacao?.item;
  const precisaIdade = cotacao?.aviso_idade && !me.data_nascimento;
  const end = modo === 'entrega' ? enderecoEscolhido() : null;
  const enderecoOk = modo !== 'entrega' || Boolean(end?.cep && end?.endereco && end?.numero && end?.bairro);
  const podeEnviar = cotacao && !erroCotacao && modo && enderecoOk && me.whatsapp_confirmado && (!precisaIdade || maior18);

  return (
    <Casca>
      <h1 className="text-2xl font-extrabold" style={{ color: PRETO }}>Finalizar pedido</h1>
      <p className="text-sm text-slate-500 mt-1">{sacola.loja.nome}</p>

      <Bloco titulo="Itens">
        <ul className="space-y-3">
          {sacola.itens.map((i, k) => {
            const s = cotacao?.itens?.[k];
            const comErro = itemComErro && itemComErro.tipo === i.tipo && String(itemComErro.id) === String(i.id);
            return (
              <li key={`${i.tipo}-${i.id}`} className="flex gap-3 items-center">
                {i.foto_url ? <img src={i.foto_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100" /> : <div className="w-12 h-12 rounded-lg bg-slate-100" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: PRETO }}>{i.nome}</p>
                  {comErro ? <p className="text-xs text-red-600">{erroCotacao.error}</p> : s && (
                    <p className="text-xs text-slate-500">
                      {brl(s.preco_unitario)} cada
                      {s.tipo_preco === 'associado' && ' · preço Clube'}
                      {s.tipo_preco === 'fecha_mes' && ' · Fecha Mês'}
                      {s.tipo_preco === 'promocao' && ' · promoção'}
                      {s.tipo_preco === 'oferta' && ' · oferta'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="Diminuir" onClick={() => mudarQuantidade(i.tipo, i.id, i.quantidade - 1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center">
                    {i.quantidade === 1 ? <Trash2 className="w-4 h-4 text-slate-500" /> : <Minus className="w-4 h-4" />}
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{i.quantidade}</span>
                  <button type="button" aria-label="Aumentar" disabled={i.tipo === 'promocao' || i.quantidade >= 99} onClick={() => mudarQuantidade(i.tipo, i.id, i.quantidade + 1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {sacola.itens.some(i => i.tipo === 'promocao') && <p className="text-xs text-slate-400 mt-3">Promoção: 1 unidade por pedido.</p>}
        {sacola.loja.url && (
          <Link to={sacola.loja.url} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: ROXO }}>
            <Plus className="w-4 h-4" /> Adicionar mais desta loja
          </Link>
        )}
        {erroCotacao && !itemComErro && <p className="mt-3 text-sm text-red-600">{erroCotacao.error}</p>}
      </Bloco>

      {loja && (
        <Bloco titulo="Como quer receber">
          <div className="grid grid-cols-2 gap-3">
            {loja.modos.includes('entrega') && (
              <Opcao ativo={modo === 'entrega'} onClick={() => setModo('entrega')} icone={Truck} titulo="Entrega"
                sub={cotacao.taxa_se_entrega ? `Taxa ${brl(cotacao.taxa_se_entrega)}` : 'Entrega grátis'} />
            )}
            {loja.modos.includes('retirada') && (
              <Opcao ativo={modo === 'retirada'} onClick={() => setModo('retirada')} icone={Store} titulo="Retirar na loja" sub="Sem taxa" />
            )}
          </div>
          {modo === 'entrega' && (loja.bairros_entrega.length > 0 || loja.raio_entrega_km) && (
            <p className="text-xs text-slate-500 mt-3">
              A loja entrega {loja.bairros_entrega.length ? `nos bairros: ${loja.bairros_entrega.join(', ')}` : `até ${String(loja.raio_entrega_km).replace('.', ',')} km`}.
              Fora disso, ela pode recusar o pedido.
            </p>
          )}
        </Bloco>
      )}

      {modo === 'entrega' && (
        <Bloco titulo="Endereço de entrega">
          <div className="space-y-2">
            {recentes.map((e, k) => (
              <Radio key={k} ativo={escolhaEndereco === `recente-${k}`} onClick={() => setEscolhaEndereco(`recente-${k}`)}>
                {textoEndereco(e)}{e.referencia ? <span className="block text-xs text-slate-400">Ref.: {e.referencia}</span> : null}
              </Radio>
            ))}
            {temCadastro && (
              <Radio ativo={escolhaEndereco === 'cadastro'} onClick={() => setEscolhaEndereco('cadastro')}>
                <span className="block text-xs text-slate-400">Endereço do cadastro</span>{textoEndereco(me)}
              </Radio>
            )}
            <Radio ativo={escolhaEndereco === 'novo'} onClick={() => setEscolhaEndereco('novo')}>Outro endereço</Radio>
          </div>
          {(escolhaEndereco === 'novo' || escolhaEndereco === 'cadastro') && (
            <div className="mt-4 space-y-3">
              {escolhaEndereco === 'novo' && (
                <>
                  <div className="flex gap-2 items-center">
                    <input className={campoCls} inputMode="numeric" placeholder="CEP" aria-label="CEP" value={novo.cep}
                      onChange={ev => setNovo(n => ({ ...n, cep: ev.target.value.replace(/\D/g, '').slice(0, 8) }))} onBlur={ev => buscarCep(ev.target.value)} />
                    {buscandoCep && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                  <input className={campoCls} placeholder="Rua" aria-label="Rua" value={novo.endereco} onChange={ev => setNovo(n => ({ ...n, endereco: ev.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={campoCls} placeholder="Número" aria-label="Número" value={novo.numero} onChange={ev => setNovo(n => ({ ...n, numero: ev.target.value }))} />
                    <input className={campoCls} placeholder="Bairro" aria-label="Bairro" value={novo.bairro} onChange={ev => setNovo(n => ({ ...n, bairro: ev.target.value }))} />
                  </div>
                </>
              )}
              <input className={campoCls} placeholder="Complemento (opcional)" aria-label="Complemento" value={novo.complemento} onChange={ev => setNovo(n => ({ ...n, complemento: ev.target.value }))} />
              <input className={campoCls} placeholder="Ponto de referência (opcional)" aria-label="Ponto de referência" value={novo.referencia} onChange={ev => setNovo(n => ({ ...n, referencia: ev.target.value }))} />
              <p className="text-xs text-slate-400">Fica só neste pedido; não muda seu cadastro.</p>
            </div>
          )}
        </Bloco>
      )}

      {cotacao?.aviso_idade && (
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <p className="flex gap-2 font-semibold"><AlertTriangle className="w-5 h-5 flex-shrink-0" /> Bebida alcoólica: venda só para maiores de 18 anos.</p>
          <p className="mt-1">A idade é conferida com documento na {modo === 'retirada' ? 'retirada' : 'entrega'}.</p>
          {precisaIdade && (
            <label className="flex items-center gap-2 mt-3 font-semibold cursor-pointer">
              <input type="checkbox" checked={maior18} onChange={ev => setMaior18(ev.target.checked)} /> Tenho 18 anos ou mais
            </label>
          )}
        </div>
      )}

      <Bloco titulo="Recado para a loja (opcional)">
        <textarea className={campoCls} rows={2} maxLength={500} value={observacao} onChange={ev => setObservacao(ev.target.value)} placeholder="Ex.: sem cebola, troco não precisa…" />
      </Bloco>

      <Bloco titulo="Pagamento">
        <p className="text-sm font-semibold" style={{ color: PRETO }}>Pix direto para a loja</p>
        <p className="text-xs text-slate-500 mt-1">
          {loja?.aceite_automatico ? 'A chave Pix aparece assim que você enviar o pedido.' : 'Você recebe a chave Pix no WhatsApp quando a loja aceitar o pedido (até 10 minutos).'}
          {' '}O IUB MAIS+ não recebe esse valor.
        </p>
      </Bloco>

      {cotacao && (
        <Bloco titulo="Resumo">
          <div className="space-y-1.5 text-sm">
            {cotacao.itens.map((s, k) => (
              <p key={k} className="flex justify-between gap-3"><span className="text-slate-600">{s.quantidade}x {s.nome}</span><span>{brl(s.subtotal)}</span></p>
            ))}
            {modo === 'entrega' && <p className="flex justify-between"><span className="text-slate-600">Entrega</span><span>{cotacao.valor_entrega > 0 ? brl(cotacao.valor_entrega) : 'Grátis'}</span></p>}
            <p className="flex justify-between font-extrabold text-lg pt-2 border-t border-slate-100" style={{ color: PRETO }}><span>Total</span><span>{brl(cotacao.total)}</span></p>
          </div>
        </Bloco>
      )}

      {!me.whatsapp_confirmado && (
        <Bloco titulo="Confirme seu WhatsApp">
          <p className="text-sm text-slate-600 mb-3">É por ele que chegam a chave Pix e os avisos do pedido.</p>
          {me.whatsapp ? <ConfirmarWhatsapp onConfirmado={() => setMe(m => ({ ...m, whatsapp_confirmado: true }))} />
            : <Link to="/meu/dados" className="text-sm font-semibold underline" style={{ color: ROXO }}>Cadastre seu WhatsApp em Meus Dados</Link>}
        </Bloco>
      )}

      <button type="button" onClick={enviar} disabled={!podeEnviar || enviando}
        className="mt-6 w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ backgroundColor: ROXO }}>
        {enviando && <Loader2 className="w-5 h-5 animate-spin" />} Enviar pedido{cotacao ? ` · ${brl(cotacao.total)}` : ''}
      </button>
      {!modo && cotacao && <p className="text-xs text-center text-slate-500 mt-2">Escolha entrega ou retirada.</p>}
    </Casca>
  );
}

function PedidoEnviado({ pedido }) {
  const aceito = pedido.status === 'aceito';
  async function copiar() {
    try { await navigator.clipboard.writeText(pedido.pix_chave); toast.success('Chave Pix copiada!'); } catch { /* sem clipboard */ }
  }
  return (
    <Casca>
      <div className="text-center pt-4">
        <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" />
        <h1 className="text-2xl font-extrabold mt-3" style={{ color: PRETO }}>Pedido #{pedido.id} enviado!</h1>
        <p className="text-sm text-slate-600 mt-2">
          {aceito ? `${pedido.loja.nome} já aceitou. Pague o Pix abaixo.` : `${pedido.loja.nome} tem 10 minutos para aceitar. A chave Pix chega no seu WhatsApp.`}
        </p>
      </div>
      {aceito && pedido.pix_chave && (
        <Bloco titulo="Pague no Pix da loja">
          <p className="text-2xl font-extrabold" style={{ color: PRETO }}>{brl(pedido.total)}</p>
          <p className="text-sm text-slate-600 mt-2">{ROTULO_PIX[pedido.pix_tipo] || 'Chave'}: <strong className="break-all">{pedido.pix_chave}</strong></p>
          {pedido.pix_nome_recebedor && <p className="text-sm text-slate-600">Nome: {pedido.pix_nome_recebedor}</p>}
          <button type="button" onClick={copiar} className="mt-3 flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border-2" style={{ borderColor: ROXO, color: ROXO }}>
            <Copy className="w-4 h-4" /> Copiar chave Pix
          </button>
          <p className="text-xs text-slate-500 mt-3">Confira o nome antes de pagar. A loja só prepara o pedido depois de confirmar o Pix. Prazo: 2 horas.</p>
        </Bloco>
      )}
      {pedido.link_manual_loja && (
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-900">Não conseguimos avisar a loja pelo WhatsApp. Avise você, com um toque:</p>
          <a href={pedido.link_manual_loja} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white bg-emerald-600">
            <WhatsappLogo size={20} weight="fill" /> Avisar a loja no WhatsApp
          </a>
        </div>
      )}
      <Link to={`/meu/pedidos/${pedido.id}`} className="mt-6 block text-center text-sm font-semibold underline" style={{ color: ROXO }}>Acompanhar meu pedido</Link>
    </Casca>
  );
}

function Casca({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-xl mx-auto px-4 pt-3">
        <BotaoVoltar fallback="/marketplace" />
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <div className="mt-4 bg-white rounded-2xl border border-slate-100 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{titulo}</h2>
      {children}
    </div>
  );
}

function Opcao({ ativo, onClick, icone: Icone, titulo, sub }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border-2 p-3 text-left"
      style={{ borderColor: ativo ? ROXO : '#E2E8F0', backgroundColor: ativo ? '#F5F3FF' : '#FFF' }}>
      <Icone className="w-5 h-5" style={{ color: ativo ? ROXO : '#94A3B8' }} />
      <span className="block text-sm font-bold mt-1" style={{ color: PRETO }}>{titulo}</span>
      <span className="block text-xs text-slate-500">{sub}</span>
    </button>
  );
}

function Radio({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-xl border-2 px-3 py-2.5 text-sm"
      style={{ borderColor: ativo ? ROXO : '#E2E8F0', backgroundColor: ativo ? '#F5F3FF' : '#FFF', color: PRETO }}>
      {children}
    </button>
  );
}
