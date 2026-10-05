import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, XCircle, PauseCircle, PlayCircle } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';
import { DIAS, textoTaxaEntrega } from '../../utils/iubFood';

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';

const TIPOS_PIX = [
  { valor: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
  { valor: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
  { valor: 'email', label: 'E-mail', placeholder: 'pix@sualoja.com.br' },
  { valor: 'telefone', label: 'Celular', placeholder: '(64) 99999-9999' },
  { valor: 'aleatoria', label: 'Chave aleatória', placeholder: '123e4567-e89b-12d3-a456-426614174000' },
];

// /parceiro/painel/pedidos-site — "Receber pedidos pelo site" (botão
// Comprar). O cliente paga direto no Pix da loja; o IUB só registra e
// acompanha o pedido. Ligar exige conferir horário, entrega/retirada e taxa.
export default function PedidosSite() {
  const [config, setConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ pix_tipo: 'cnpj', pix_chave: '', pix_nome_recebedor: '', aceite_automatico: false });
  const [confirmo, setConfirmo] = useState(false);
  const [erroCampo, setErroCampo] = useState({});

  function aplicar(c) {
    setConfig(c);
    setForm({
      pix_tipo: c.pix_tipo || 'cnpj', pix_chave: c.pix_chave || '', pix_nome_recebedor: c.pix_nome_recebedor || '',
      aceite_automatico: Boolean(c.aceite_automatico),
    });
    setConfirmo(false);
  }

  useEffect(() => {
    apiParceiro.get('/parceiro/pedidos/config').then(res => aplicar(res.data))
      .catch(() => toast.error('Erro ao carregar a configuração'));
  }, []);

  function campo(nome, valor) {
    setForm(f => ({ ...f, [nome]: valor }));
    setErroCampo(e => ({ ...e, [nome]: null }));
  }

  async function salvar(ativo) {
    setSalvando(true);
    setErroCampo({});
    try {
      const res = await apiParceiro.put('/parceiro/pedidos/config', { ...form, ativo, confirmo_configuracao: confirmo });
      aplicar(res.data);
      toast.success(ativo ? (config.ativo ? 'Configuração salva!' : 'Pronto! Sua loja já recebe pedidos pelo site.') : 'Pedidos pelo site desligados.');
    } catch (err) {
      const r = err.response?.data || {};
      if (r.campo) setErroCampo({ [r.campo]: r.error });
      if (r.requisitos) setConfig(c => ({ ...c, requisitos: r.requisitos }));
      toast.error(r.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPausa() {
    setSalvando(true);
    try {
      const res = await apiParceiro.patch('/parceiro/pedidos/config/pausa', { pausado: !config.pausado });
      aplicar(res.data);
      toast.success(res.data.pausado ? 'Pedidos pausados. Os clientes veem só o WhatsApp.' : 'Pedidos liberados de novo!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao pausar');
    } finally {
      setSalvando(false);
    }
  }

  if (!config) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;
  }

  const tipoPix = TIPOS_PIX.find(t => t.valor === form.pix_tipo) || TIPOS_PIX[0];
  const faltando = config.requisitos.filter(r => !r.ok);
  const r = config.resumo;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>Pedidos pelo site</h1>
        <p className="text-slate-500 text-sm mt-1">
          O cliente monta o pedido no IUB e paga <strong>direto no Pix da sua loja</strong>. O IUB não recebe o dinheiro:
          só registra o pedido e avisa você no WhatsApp. O botão "Chamar no WhatsApp" continua funcionando.
        </p>
      </div>

      {config.ativo && (
        <div className="rounded-2xl border-2 p-5 flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: config.pausado ? '#F59E0B' : '#10B981', backgroundColor: config.pausado ? '#FFFBEB' : '#ECFDF5' }}>
          <div>
            <p className="font-bold" style={{ color: PRETO }}>{config.pausado ? '⏸️ Pedidos pausados' : '🟢 Recebendo pedidos pelo site'}</p>
            <p className="text-xs text-slate-600 mt-1">
              {config.pausado ? 'O botão Comprar está escondido. Pedidos já feitos continuam normalmente.' : 'Muito movimento ou faltou produto? Pause na hora, sem perder a configuração.'}
            </p>
          </div>
          <button type="button" onClick={alternarPausa} disabled={salvando}
            className="flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl text-white disabled:opacity-60"
            style={{ backgroundColor: config.pausado ? '#10B981' : '#F59E0B' }}>
            {config.pausado ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
            {config.pausado ? 'Voltar a receber' : 'Pausar pedidos'}
          </button>
        </div>
      )}

      {faltando.length > 0 && (
        <Secao titulo="Antes de ligar" subtitulo="Complete o que falta abaixo.">
          <ul className="space-y-2">
            {config.requisitos.map(item => (
              <li key={item.chave} className="flex items-start gap-2 text-sm">
                {item.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                <span className={item.ok ? 'text-slate-500' : 'text-slate-800'}>
                  {item.texto}
                  {!item.ok && item.link && <> · <Link to={item.link} className="font-semibold underline" style={{ color: ROXO }}>resolver</Link></>}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Chave Pix da loja" subtitulo="O cliente vê essa chave depois que você aceitar o pedido.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Tipo da chave</Label>
            <select value={form.pix_tipo} onChange={e => campo('pix_tipo', e.target.value)} className={campoCls}>
              {TIPOS_PIX.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Chave</Label>
            <input value={form.pix_chave} onChange={e => campo('pix_chave', e.target.value)} placeholder={tipoPix.placeholder}
              aria-label="Chave Pix" className={campoCls} />
            {erroCampo.pix_chave && <p className="text-xs text-red-600 mt-1">{erroCampo.pix_chave}</p>}
          </div>
        </div>
        <div className="mt-4">
          <Label>Nome de quem recebe (como aparece no banco)</Label>
          <input value={form.pix_nome_recebedor} maxLength={25} onChange={e => campo('pix_nome_recebedor', e.target.value)}
            placeholder="Ex.: MERCADINHO SAO JOSE" aria-label="Nome de quem recebe" className={campoCls} />
          <p className="text-xs text-slate-400 mt-1">Até 25 letras. Ajuda o cliente a conferir antes de pagar.</p>
          {erroCampo.pix_nome_recebedor && <p className="text-xs text-red-600 mt-1">{erroCampo.pix_nome_recebedor}</p>}
        </div>
      </Secao>

      <Secao titulo="Aceite dos pedidos">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.aceite_automatico} onChange={e => campo('aceite_automatico', e.target.checked)} className="rounded mt-1" />
          <span>
            <span className="block text-sm font-semibold" style={{ color: PRETO }}>Aceitar pedidos automaticamente</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Ligado: o cliente já recebe sua chave Pix na hora, e você só confirma quando o Pix cair e o pedido sair.
              Desligado: você tem 10 minutos para aceitar ou recusar cada pedido, senão ele expira.
            </span>
          </span>
        </label>
      </Secao>

      <Secao titulo="Confira antes de ligar" subtitulo="É isso que o cliente vê no pedido. Algo errado? Ajuste e volte aqui.">
        <dl className="text-sm space-y-3">
          <Linha rotulo="Horário">
            {config.catalogos.includes('geral') && <HorarioResumo horario={r.horario_funcionamento} />}
            {config.catalogos.includes('beer') && (
              <div className={config.catalogos.includes('geral') ? 'mt-2' : ''}>
                {config.catalogos.includes('geral') && <span className="text-xs font-semibold text-slate-500">Disk Bebidas:</span>}
                <HorarioResumo horario={r.horario_beer} />
              </div>
            )}
          </Linha>
          <Linha rotulo="Atendimento">
            {r.modos.length ? r.modos.map(m => (m === 'entrega' ? 'Entrega' : 'Retirada na loja')).join(' e ') : <span className="text-red-600">Nenhum marcado</span>}
          </Linha>
          {r.modos.includes('entrega') && (
            <Linha rotulo="Taxa de entrega">
              {textoTaxaEntrega(r)}
              {r.raio_entrega_km && <span className="text-slate-500"> · até {String(r.raio_entrega_km).replace('.', ',')} km</span>}
            </Linha>
          )}
          {config.catalogos.includes('beer') && r.bairros_beer.length > 0 && (
            <Linha rotulo="Bairros (Disk Bebidas)">{r.bairros_beer.join(', ')}</Linha>
          )}
        </dl>
        <div className="flex flex-wrap gap-3 mt-4 text-xs font-semibold">
          <Link to="/parceiro/painel/entrega" className="underline" style={{ color: ROXO }}>Editar entrega, taxa e horários</Link>
          {config.catalogos.includes('beer') && <Link to="/parceiro/painel/beer" className="underline" style={{ color: ROXO }}>Editar horário e bairros do Disk Bebidas</Link>}
        </div>
        <label className="flex items-start gap-3 mt-5 rounded-xl bg-slate-50 p-3 cursor-pointer">
          <input type="checkbox" checked={confirmo} onChange={e => { setConfirmo(e.target.checked); setErroCampo(x => ({ ...x, confirmo_configuracao: null })); }} className="rounded mt-0.5" />
          <span className="text-sm" style={{ color: PRETO }}>Conferi: o horário, a entrega/retirada e a taxa estão certos.</span>
        </label>
        {erroCampo.confirmo_configuracao && <p className="text-xs text-red-600 mt-1">{erroCampo.confirmo_configuracao}</p>}
      </Secao>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => salvar(true)} disabled={salvando || faltando.length > 0}
          className="flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-50"
          style={{ backgroundColor: ROXO }}>
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          {config.ativo ? 'Salvar alterações' : 'Ligar pedidos pelo site'}
        </button>
        {config.ativo && (
          <button type="button" onClick={() => salvar(false)} disabled={salvando}
            className="font-semibold px-6 py-3 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-50">
            Desligar pedidos pelo site
          </button>
        )}
      </div>
    </div>
  );
}

function HorarioResumo({ horario }) {
  const dias = DIAS.filter(d => horario?.[d.chave]?.aberto);
  if (!dias.length) return <span className="text-red-600">Não cadastrado</span>;
  return (
    <ul className="space-y-0.5">
      {dias.map(d => <li key={d.chave}>{d.label}: {horario[d.chave].abre} às {horario[d.chave].fecha}</li>)}
    </ul>
  );
}

function Linha({ rotulo, children }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd style={{ color: PRETO }}>{children}</dd>
    </div>
  );
}

function Label({ children }) {
  return <label className="block text-xs font-semibold text-slate-500 mb-1.5">{children}</label>;
}

function Secao({ titulo, subtitulo, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="font-bold text-base" style={{ color: PRETO }}>{titulo}</h2>
      {subtitulo && <p className="text-xs text-slate-400 mt-1">{subtitulo}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}
