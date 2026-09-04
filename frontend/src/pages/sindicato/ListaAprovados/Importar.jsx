import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import {
  ArrowLeft, Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight,
} from 'lucide-react';

const CAMPOS = [
  { chave: 'cnpj', label: 'CNPJ', obrigatorio: true },
  { chave: 'nome', label: 'Nome', obrigatorio: true },
  { chave: 'cpf', label: 'CPF', obrigatorio: true },
  { chave: 'matricula', label: 'Matrícula', obrigatorio: false },
  { chave: 'valor', label: 'Valor mensal', obrigatorio: false },
];

export default function SindicatoListaAprovadosImportar() {
  const navigate = useNavigate();
  const [arquivo, setArquivo] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [preview, setPreview] = useState(null); // { headers, sugestao, total_linhas, preview, rows }
  const [mapeamento, setMapeamento] = useState({});
  const [razaoSocial, setRazaoSocial] = useState('');
  const [valorDefault, setValorDefault] = useState('10.70');
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);

  async function handleArquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    setLendo(true);
    setRelatorio(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const res = await api.post('/sindicato-lista-aprovada/importar/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
      setMapeamento(res.data.sugestao);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao ler o arquivo');
      setArquivo(null);
      setPreview(null);
    } finally {
      setLendo(false);
    }
  }

  function atualizarMapeamento(campo, valor) {
    setMapeamento(m => ({ ...m, [campo]: valor === '' ? null : parseInt(valor, 10) }));
  }

  const mapeamentoValido = CAMPOS.filter(c => c.obrigatorio).every(c => mapeamento[c.chave] !== null && mapeamento[c.chave] !== undefined);
  const podeImportar = mapeamentoValido && razaoSocial.trim().length > 0 && !importando;

  async function handleImportar() {
    if (!podeImportar || !preview) return;
    setImportando(true);
    try {
      const res = await api.post('/sindicato-lista-aprovada/importar/commit', {
        rows: preview.rows,
        mapeamento,
        razao_social_empresa: razaoSocial.trim(),
        valor_mensal_default: valorDefault,
      });
      setRelatorio(res.data);
      toast.success('Importação concluída!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao importar lista');
    } finally {
      setImportando(false);
    }
  }

  function reiniciar() {
    setArquivo(null);
    setPreview(null);
    setMapeamento({});
    setRazaoSocial('');
    setRelatorio(null);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link to="/sindicato/lista-aprovados" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Lista de Aprovados
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-2">
          <Upload className="w-6 h-6 text-[#0C2D48]" />
          Importar Lista
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Suba a planilha de colaboradores aprovados (CSV ou XLSX) — CNPJ, Nome e CPF são obrigatórios.
        </p>
      </div>

      {relatorio ? (
        <div className="card space-y-5">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Importação concluída</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 py-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{relatorio.importados}</p>
              <p className="text-xs text-emerald-500 mt-0.5">Importados</p>
            </div>
            <div className="rounded-xl bg-amber-50 py-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{relatorio.duplicados}</p>
              <p className="text-xs text-amber-500 mt-0.5">Duplicados</p>
            </div>
            <div className="rounded-xl bg-red-50 py-4 text-center">
              <p className="text-2xl font-bold text-red-500">{relatorio.invalidos}</p>
              <p className="text-xs text-red-400 mt-0.5">Inválidos</p>
            </div>
          </div>

          {relatorio.detalhes_invalidos?.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 max-h-56 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Linhas com problema</p>
              <ul className="space-y-1 text-xs text-red-600">
                {relatorio.detalhes_invalidos.map((d, i) => (
                  <li key={i}>Linha {d.linha}{d.nome ? ` (${d.nome})` : ''}: {d.motivo}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button onClick={reiniciar} className="btn-secondary">Importar outra lista</button>
            <button onClick={() => navigate(`/sindicato/lista-aprovados/empresa/${encodeURIComponent(razaoSocial.trim())}`)} className="btn-primary flex items-center gap-2">
              Ver empresa <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : !preview ? (
        <label className="card flex flex-col items-center justify-center gap-3 py-16 border-2 border-dashed border-slate-200 cursor-pointer hover:border-[#C9A84C]/50 transition-colors">
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleArquivo} className="hidden" />
          {lendo ? (
            <Loader2 className="w-8 h-8 animate-spin text-[#0C2D48]" />
          ) : (
            <FileSpreadsheet className="w-10 h-10 text-slate-300" />
          )}
          <div className="text-center">
            <p className="font-semibold text-slate-700">{lendo ? 'Lendo arquivo...' : 'Clique para escolher o arquivo'}</p>
            <p className="text-xs text-slate-400 mt-1">CSV ou XLSX, até 5MB</p>
          </div>
        </label>
      ) : (
        <div className="space-y-5">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{arquivo?.name}</span> — {preview.total_linhas} linhas encontradas
              </p>
              <button onClick={reiniciar} className="text-xs text-slate-400 hover:text-slate-600 underline">Trocar arquivo</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Nome da empresa (aplica a todos os registros)</label>
                <input className="input" placeholder="Ex.: Reis" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} />
              </div>
              <div>
                <label className="label">Valor mensal padrão (quando a planilha não tiver coluna de valor)</label>
                <input className="input" type="number" step="0.01" value={valorDefault} onChange={e => setValorDefault(e.target.value)} />
              </div>
            </div>

            <div>
              <p className="label mb-2">Mapeamento de colunas</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CAMPOS.map(c => (
                  <div key={c.chave}>
                    <label className="text-xs text-slate-500 flex items-center gap-1">{c.label}{c.obrigatorio && <span className="text-red-400">*</span>}</label>
                    <select
                      className="input mt-1"
                      value={mapeamento[c.chave] ?? ''}
                      onChange={e => atualizarMapeamento(c.chave, e.target.value)}
                    >
                      <option value="">— não usar —</option>
                      {preview.headers.map((h, idx) => (
                        <option key={idx} value={idx}>{h || `Coluna ${idx + 1}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card !p-0 overflow-hidden">
            <p className="px-4 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prévia (10 primeiras linhas)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>{preview.headers.map((h, i) => <th key={i} className="text-left text-slate-500 font-medium py-2 px-3 whitespace-nowrap">{h || `Coluna ${i + 1}`}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.preview.map((linha, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {linha.map((cel, j) => <td key={j} className="py-2 px-3 text-slate-600 whitespace-nowrap">{cel ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!mapeamentoValido && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Mapeie CNPJ, Nome e CPF para continuar.</p>
          )}

          <div className="flex justify-end">
            <button onClick={handleImportar} disabled={!podeImportar} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar {preview.total_linhas} registros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
