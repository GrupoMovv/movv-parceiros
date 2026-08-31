import { useEffect, useState, useMemo } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { Loader2, Search, ArrowUp, ArrowDown, Send, RefreshCw, CreditCard, QrCode } from 'lucide-react';
import { publicCarteirinhaUrl, enviarCarteirinhaWhatsapp } from '../../../utils/carteirinhaWhatsapp';

const LIMIT = 20;

function fmtData(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

function diasEntre(iso) {
  if (!iso) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const alvo = new Date(y, m - 1, d);
  return Math.round((alvo - hoje) / 86400000);
}

// Config por tipo: quais colunas mostrar e como extrair/ordenar/renderizar
// cada uma, mais quais ações a coluna final oferece.
const CONFIG = {
  emitidas:    { titulo: 'Carteirinhas Emitidas',        entidade: 'associado',  colunas: ['nome', 'categoria', 'emissao', 'validade'], acoes: ['ver', 'enviar'] },
  ativas:      { titulo: 'Carteirinhas Ativas',          entidade: 'associado',  colunas: ['nome', 'categoria', 'emissao', 'validade'], acoes: ['ver', 'enviar'] },
  vencendo:    { titulo: 'Vencendo em 15 dias',          entidade: 'associado',  colunas: ['nome', 'categoria', 'vencimento', 'dias'],  acoes: ['renovar'] },
  vencidas:    { titulo: 'Carteirinhas Vencidas',        entidade: 'associado',  colunas: ['nome', 'categoria', 'vencimento', 'dias'],  acoes: ['renovar'] },
  nao_geradas: { titulo: 'Associados sem Carteirinha',   entidade: 'associado',  colunas: ['nome', 'categoria', 'empresa'],             acoes: ['gerar'] },
  dep_total:   { titulo: 'Dependentes Cadastrados',      entidade: 'dependente', colunas: ['nome', 'titular', 'validade'],              acoes: ['ver_se_tem'] },
  dep_com:     { titulo: 'Dependentes com Carteirinha',  entidade: 'dependente', colunas: ['nome', 'titular', 'validade'],              acoes: ['ver'] },
  dep_sem:     { titulo: 'Dependentes sem Carteirinha',  entidade: 'dependente', colunas: ['nome', 'titular'],                          acoes: ['gerar_dep'] },
};

const COLUNA_LABEL = {
  nome: 'Nome', categoria: 'Categoria', empresa: 'Empresa', titular: 'Titular',
  emissao: 'Data emissão', validade: 'Validade', vencimento: 'Data vencimento', dias: 'Dias',
};

export default function ModalListaCarteirinha({ tipo, onClose, onChanged }) {
  const config = tipo ? CONFIG[tipo] : null;

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [ordenarPor, setOrdenarPor] = useState('nome');
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState(null);

  useEffect(() => {
    if (!tipo) return;
    setBusca(''); setPagina(1);
    setOrdenarPor(config.colunas.includes('vencimento') ? 'vencimento' : 'nome');
    setOrdemAsc(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/sindicato-carteirinha/lista', { params: { tipo } });
      setItens(res.data.data);
    } catch {
      toast.error('Erro ao carregar lista');
    } finally { setLoading(false); }
  }

  function nomeDe(item) { return config.entidade === 'associado' ? item.nome_completo : item.nome; }

  function valorOrdenacao(item, coluna) {
    switch (coluna) {
      case 'nome': return nomeDe(item) || '';
      case 'categoria': return item.categoria_profissional || '';
      case 'empresa': return item.empresa || '';
      case 'titular': return item.titular_nome || '';
      case 'emissao': return item.carteirinha_gerada_em || '';
      case 'validade': case 'vencimento': return item.carteirinha_valida_ate || '';
      case 'dias': return diasEntre(item.carteirinha_valida_ate) ?? 0;
      default: return '';
    }
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = itens;
    if (termo) {
      lista = itens.filter(item => {
        const nome = nomeDe(item)?.toLowerCase() || '';
        const titular = item.titular_nome?.toLowerCase() || '';
        return nome.includes(termo) || titular.includes(termo);
      });
    }
    const ordenados = [...lista].sort((a, b) => {
      const va = valorOrdenacao(a, ordenarPor);
      const vb = valorOrdenacao(b, ordenarPor);
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return ordemAsc ? cmp : -cmp;
    });
    return ordenados;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, busca, ordenarPor, ordemAsc]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / LIMIT));
  const pagAtual = Math.min(pagina, totalPaginas);
  const pagina_itens = filtrados.slice((pagAtual - 1) * LIMIT, pagAtual * LIMIT);

  function toggleOrdenacao(coluna) {
    if (ordenarPor === coluna) setOrdemAsc(a => !a);
    else { setOrdenarPor(coluna); setOrdemAsc(true); }
  }

  async function handleAcaoConcluida() {
    await load();
    onChanged?.();
  }

  async function handleRenovar(item) {
    setAcaoEmAndamentoId(item.id);
    try {
      await api.post(`/sindicato-carteirinha/renovar/${item.id}`);
      toast.success('Carteirinha renovada!');
      await handleAcaoConcluida();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao renovar');
    } finally { setAcaoEmAndamentoId(null); }
  }

  async function handleGerar(item) {
    setAcaoEmAndamentoId(item.id);
    try {
      await api.post(`/sindicato-carteirinha/gerar/${item.id}`);
      toast.success('Carteirinha gerada!');
      await handleAcaoConcluida();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar');
    } finally { setAcaoEmAndamentoId(null); }
  }

  async function handleGerarDependente(item) {
    setAcaoEmAndamentoId(item.id);
    try {
      await api.post(`/sindicato-carteirinha/gerar-dependente/${item.id}`);
      toast.success('Carteirinha do dependente gerada!');
      await handleAcaoConcluida();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao gerar');
    } finally { setAcaoEmAndamentoId(null); }
  }

  async function handleEnviar(item) {
    setAcaoEmAndamentoId(item.id);
    try {
      await enviarCarteirinhaWhatsapp({ id: item.id, nome_completo: item.nome_completo, whatsapp: item.whatsapp, carteirinha_hash: item.carteirinha_hash });
    } catch {
      toast.error('Erro ao montar a mensagem da carteirinha');
    } finally { setAcaoEmAndamentoId(null); }
  }

  function renderCelula(item, coluna) {
    switch (coluna) {
      case 'nome':
        return <span className="text-slate-900 font-medium">{nomeDe(item)}</span>;
      case 'categoria':
        return item.categoria_profissional || '—';
      case 'empresa':
        return item.empresa || '—';
      case 'titular':
        return item.titular_nome || '—';
      case 'emissao':
        return fmtData(item.carteirinha_gerada_em);
      case 'validade':
        return item.carteirinha_hash ? fmtData(item.carteirinha_valida_ate) : '—';
      case 'vencimento':
        return fmtData(item.carteirinha_valida_ate);
      case 'dias': {
        const d = diasEntre(item.carteirinha_valida_ate);
        if (d == null) return '—';
        const vencido = d < 0;
        return (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${vencido ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {vencido ? `${Math.abs(d)}d vencido` : `${d}d restantes`}
          </span>
        );
      }
      default: return null;
    }
  }

  function renderAcoes(item) {
    const emAndamento = acaoEmAndamentoId === item.id;
    return (
      <div className="flex items-center gap-1">
        {config.acoes.includes('ver') && item.carteirinha_hash && (
          <a href={publicCarteirinhaUrl(item.carteirinha_hash)} target="_blank" rel="noreferrer"
             className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Ver carteirinha">
            <QrCode className="w-3.5 h-3.5" />
          </a>
        )}
        {config.acoes.includes('ver_se_tem') && (
          item.carteirinha_hash ? (
            <a href={publicCarteirinhaUrl(item.carteirinha_hash)} target="_blank" rel="noreferrer"
               className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Ver carteirinha">
              <QrCode className="w-3.5 h-3.5" />
            </a>
          ) : <span className="text-xs text-slate-300">sem carteirinha</span>
        )}
        {config.acoes.includes('enviar') && (
          <button
            onClick={() => handleEnviar(item)} disabled={emAndamento || !item.whatsapp}
            className="p-1.5 rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-40"
            title={item.whatsapp ? 'Enviar WhatsApp' : 'Sem WhatsApp cadastrado'}
          >
            {emAndamento ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        )}
        {config.acoes.includes('renovar') && (
          <button
            onClick={() => handleRenovar(item)} disabled={emAndamento}
            className="flex items-center gap-1 text-xs font-semibold text-white bg-[#0C2D48] hover:opacity-90 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {emAndamento ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Renovar
          </button>
        )}
        {config.acoes.includes('gerar') && (
          <button
            onClick={() => handleGerar(item)} disabled={emAndamento}
            className="flex items-center gap-1 text-xs font-semibold text-white bg-[#0C2D48] hover:opacity-90 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {emAndamento ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />} Gerar Carteirinha
          </button>
        )}
        {config.acoes.includes('gerar_dep') && (
          <button
            onClick={() => handleGerarDependente(item)} disabled={emAndamento}
            className="flex items-center gap-1 text-xs font-semibold text-white bg-[#0C2D48] hover:opacity-90 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {emAndamento ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />} Gerar
          </button>
        )}
      </div>
    );
  }

  if (!tipo) return null;

  return (
    <Modal open={!!tipo} onClose={onClose} title={config.titulo} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input pl-9" placeholder="Buscar por nome..."
            value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}
          />
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {config.colunas.map(c => (
                    <th key={c} className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">
                      <button onClick={() => toggleOrdenacao(c)} className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                        {COLUNA_LABEL[c]}
                        {ordenarPor === c && (ordemAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className="text-left text-slate-500 font-medium py-3 px-4 whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={config.colunas.length + 1} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                ) : pagina_itens.length === 0 ? (
                  <tr><td colSpan={config.colunas.length + 1} className="text-center py-10 text-slate-400">Nenhum registro encontrado</td></tr>
                ) : pagina_itens.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {config.colunas.map(c => (
                      <td key={c} className="py-3 px-4 text-slate-600">{renderCelula(item, c)}</td>
                    ))}
                    <td className="py-3 px-4">{renderAcoes(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Mostrando {pagina_itens.length} de {filtrados.length}</span>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={pagAtual <= 1} onClick={() => setPagina(p => p - 1)} className="px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-30">Anterior</button>
              <span>{pagAtual} / {totalPaginas}</span>
              <button disabled={pagAtual >= totalPaginas} onClick={() => setPagina(p => p + 1)} className="px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-30">Próxima</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
