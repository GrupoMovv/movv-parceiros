import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Truck, Store, Clock, Copy } from 'lucide-react';
import apiParceiro from '../../services/apiParceiro';
import { ROXO, PRETO } from '../public/Marketplace/theme';
import CampoPreco from '../../components/ui/CampoPreco';
import { DIAS, statusFuncionamento, textoTaxaEntrega } from '../../utils/iubFood';

const campoCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors';

function vazioSeNulo(v) { return v === null || v === undefined ? '' : String(v); }

// /parceiro/painel/entrega — IUB Food: delivery/retirada, horários, taxa e
// tempo de preparo. Horário é a MESMA coluna horario_funcionamento que Meu
// Perfil edita (migration 025) — mudar aqui muda lá e vice-versa.
export default function ConfiguracaoEntrega() {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [retirada, setRetirada] = useState(true);
  const [horario, setHorario] = useState({});
  const [taxa, setTaxa] = useState('');
  const [temGratisAcima, setTemGratisAcima] = useState(false);
  const [gratisAcima, setGratisAcima] = useState('');
  const [raio, setRaio] = useState('');
  const [tempoPreparo, setTempoPreparo] = useState('');

  useEffect(() => {
    apiParceiro.get('/parceiro/perfil').then(res => {
      const p = res.data;
      setDelivery(Boolean(p.delivery_disponivel));
      setRetirada(p.retirada_disponivel !== false);
      setHorario(p.horario_funcionamento || {});
      setTaxa(vazioSeNulo(p.taxa_entrega));
      setTemGratisAcima(p.entrega_gratis_acima != null);
      setGratisAcima(vazioSeNulo(p.entrega_gratis_acima));
      setRaio(vazioSeNulo(p.raio_entrega_km));
      setTempoPreparo(vazioSeNulo(p.tempo_preparo_min));
    }).catch(() => toast.error('Erro ao carregar configurações')).finally(() => setCarregando(false));
  }, []);

  function setDia(dia, campo, valor) {
    setHorario(h => ({ ...h, [dia]: { ...h[dia], [campo]: valor } }));
  }

  function copiarParaTodos(diaOrigem) {
    const base = horario[diaOrigem];
    if (!base?.abre || !base?.fecha) return toast.error('Preencha o horário desse dia primeiro');
    setHorario(() => Object.fromEntries(DIAS.map(d => [d.chave, { ...base }])));
    toast.success('Horário copiado pra todos os dias');
  }

  function validar() {
    if (!delivery && !retirada) return 'Marque pelo menos delivery ou retirada';
    for (const d of DIAS) {
      const info = horario[d.chave];
      if (info?.aberto && (!info.abre || !info.fecha)) return `Preencha abre/fecha de ${d.label}`;
      if (info?.aberto && info.abre === info.fecha) return `${d.label}: abre e fecha não podem ser iguais`;
    }
    if (tempoPreparo !== '' && (Number(tempoPreparo) < 1 || Number(tempoPreparo) > 300)) return 'Tempo de preparo deve ser entre 1 e 300 minutos';
    if (delivery && raio !== '' && !(parseFloat(raio.replace(',', '.')) >= 0)) return 'Raio de entrega inválido';
    return null;
  }

  async function salvar() {
    const erro = validar();
    if (erro) return toast.error(erro);
    setSalvando(true);
    try {
      await apiParceiro.patch('/parceiro/perfil/entrega', {
        delivery_disponivel: delivery,
        retirada_disponivel: retirada,
        horario_funcionamento: horario,
        taxa_entrega: taxa === '' ? null : taxa,
        entrega_gratis_acima: temGratisAcima && parseFloat(gratisAcima) > 0 ? gratisAcima : null,
        raio_entrega_km: raio === '' ? null : raio.replace(',', '.'),
        tempo_preparo_min: tempoPreparo === '' ? null : Number(tempoPreparo),
      });
      toast.success('Configurações salvas!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: ROXO }} /></div>;
  }

  const status = statusFuncionamento(horario);
  const previa = { taxa_entrega: taxa, entrega_gratis_acima: temGratisAcima ? gratisAcima : null, tempo_preparo_min: tempoPreparo };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: PRETO }}>Entrega e horários</h1>
        <p className="text-slate-500 text-sm mt-0.5">Como o cliente recebe seu pedido no IUB Food.</p>
      </div>

      <Secao titulo="Forma de atendimento" subtitulo="Pode marcar as duas.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <OpcaoAtendimento ativo={delivery} onChange={setDelivery} icone={Truck} titulo="Delivery" descricao="Entrega no endereço do cliente" />
          <OpcaoAtendimento ativo={retirada} onChange={setRetirada} icone={Store} titulo="Retirada" descricao="Cliente busca no local" />
        </div>
      </Secao>

      <Secao titulo="Horários de funcionamento" subtitulo="Fecha depois da meia-noite? Pode colocar, ex.: abre 18:00 e fecha 02:00.">
        <div className="space-y-2">
          {DIAS.map(dia => {
            const info = horario[dia.chave] || {};
            return (
              <div key={dia.chave} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-1.5 border-b border-slate-50 last:border-0">
                <label className="flex items-center gap-2 w-32 text-sm font-medium" style={{ color: PRETO }}>
                  <input type="checkbox" checked={!!info.aberto} onChange={e => setDia(dia.chave, 'aberto', e.target.checked)} className="rounded" />
                  {dia.label}
                </label>
                {info.aberto ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <input type="time" value={info.abre || ''} onChange={e => setDia(dia.chave, 'abre', e.target.value)} aria-label={`${dia.label} abre`} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                      até
                      <input type="time" value={info.fecha || ''} onChange={e => setDia(dia.chave, 'fecha', e.target.value)} aria-label={`${dia.label} fecha`} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <button type="button" onClick={() => copiarParaTodos(dia.chave)} className="flex items-center gap-1 text-xs font-semibold underline" style={{ color: ROXO }}>
                      <Copy className="w-3 h-3" /> Copiar pra todos os dias
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">Fechado</span>
                )}
              </div>
            );
          })}
        </div>
        {status && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: status.aberto ? '#ECFDF5' : '#FEF2F2', color: status.aberto ? '#047857' : '#B91C1C' }}>
            <Clock className="w-3.5 h-3.5" /> Agora: {status.texto}
          </p>
        )}
      </Secao>

      {delivery && (
        <Secao titulo="Taxa de entrega">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Taxa fixa (deixe R$ 0,00 pra entrega grátis)</Label>
              <CampoPreco value={taxa} onChange={setTaxa} className={campoCls} />
            </div>
            <div>
              <Label>Raio de entrega (km)</Label>
              <input type="text" inputMode="decimal" value={raio} onChange={e => setRaio(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} placeholder="Ex.: 5" className={campoCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium mt-4" style={{ color: PRETO }}>
            <input type="checkbox" checked={temGratisAcima} onChange={e => setTemGratisAcima(e.target.checked)} className="rounded" />
            Entrega grátis em pedidos acima de um valor
          </label>
          {temGratisAcima && (
            <div className="mt-2 max-w-[240px]">
              <CampoPreco value={gratisAcima} onChange={setGratisAcima} className={campoCls} />
            </div>
          )}
        </Secao>
      )}

      <Secao titulo="Tempo de preparo" subtitulo="Aparece pro cliente como “Pronto em ~30 min”. Dá pra mudar por produto no cadastro de cada um.">
        <div className="flex items-center gap-2 max-w-[240px]">
          <input type="number" inputMode="numeric" min={1} max={300} value={tempoPreparo}
            onChange={e => setTempoPreparo(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="30" className={campoCls} />
          <span className="text-sm text-slate-500">minutos</span>
        </div>
      </Secao>

      <Secao titulo="Como o cliente vê">
        <div className="flex flex-wrap gap-2">
          {status && (
            <Chip cor={status.aberto ? '#047857' : '#B91C1C'} fundo={status.aberto ? '#ECFDF5' : '#FEF2F2'}>
              {status.aberto ? '🟢 Aberto' : '🔴 Fechado'}
            </Chip>
          )}
          {delivery && <Chip>🚚 {textoTaxaEntrega(previa)}</Chip>}
          {retirada && <Chip>🏪 Retirada disponível</Chip>}
          {tempoPreparo && <Chip>⏱️ ~{tempoPreparo} min</Chip>}
        </div>
      </Secao>

      <button type="button" onClick={salvar} disabled={salvando}
        className="flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
        style={{ backgroundColor: ROXO }}>
        {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar configurações
      </button>
    </div>
  );
}

function OpcaoAtendimento({ ativo, onChange, icone: Icone, titulo, descricao }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border-2 p-4 cursor-pointer transition-colors"
      style={{ borderColor: ativo ? ROXO : '#E2E8F0', backgroundColor: ativo ? '#F5F3FF' : '#FFFFFF' }}>
      <input type="checkbox" checked={ativo} onChange={e => onChange(e.target.checked)} className="rounded" />
      <Icone className="w-6 h-6 flex-shrink-0" style={{ color: ativo ? ROXO : '#94A3B8' }} />
      <span>
        <span className="block font-bold text-sm" style={{ color: PRETO }}>{titulo}</span>
        <span className="block text-xs text-slate-500">{descricao}</span>
      </span>
    </label>
  );
}

function Chip({ children, cor = '#334155', fundo = '#F1F5F9' }) {
  return <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ color: cor, backgroundColor: fundo }}>{children}</span>;
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
