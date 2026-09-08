import { useEffect, useMemo, useState } from 'react';
import { Fire } from '@phosphor-icons/react';
import api from '../../../../services/api';
import CardVitrineRotativa from './CardVitrineRotativa';
import VitrinePaginada from './VitrinePaginada';
import { useColunas } from '../useColunas';
import { PRETO, ROXO } from '../theme';

const LINHAS = 2;

// Enquanto o catálogo é pequeno, uma vitrine com só 1-2 produtos não passa
// sensação nenhuma de "rotativo" (nem dá pra paginar). Repete a lista (com
// key própria por cópia) até ter pelo menos 2 páginas cheias, num teto de
// 3 repetições — só um efeito visual de movimento, nunca finge ter mais
// produtos distintos do que realmente existem (mesmo produto, mesmo link).
function comMovimentoGarantido(produtos, itensPorPagina) {
  if (produtos.length === 0) return produtos;
  const minimo = itensPorPagina * 2;
  if (produtos.length >= minimo) return produtos;

  const repeticoes = Math.min(3, Math.ceil(minimo / produtos.length));
  const resultado = [];
  for (let copia = 0; copia < repeticoes; copia++) {
    for (const p of produtos) resultado.push({ ...p, _key: `${p.id}-${copia}` });
  }
  return resultado;
}

// Vitrine única onde TODOS os parceiros aparecem (não é "destaque premium"
// separado de "destaque master") — quem tem plano maior só contribui mais
// produtos pra fila do round-robin do backend. A grade em si (colunas
// responsivas, 2 fileiras, setas, dots, auto-avanço) é a VitrinePaginada
// compartilhada com as outras vitrines da home — ver vitrineRotativaService.js
// pro algoritmo de distribuição dos produtos.
export default function VitrineRotativa() {
  const [produtosBrutos, setProdutosBrutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const colunas = useColunas();
  const itensPorPagina = colunas * LINHAS;

  const produtos = useMemo(() => comMovimentoGarantido(produtosBrutos, itensPorPagina), [produtosBrutos, itensPorPagina]);

  useEffect(() => {
    api.get('/public/marketplace/vitrine-rotativa')
      .then(res => setProdutosBrutos(res.data.produtos))
      .catch(() => setProdutosBrutos([]))
      .finally(() => setCarregando(false));
  }, []);

  if (!carregando && produtos.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-2xl md:text-3xl font-bold tracking-tight" style={{ color: PRETO }}>
            <Fire size={26} weight="duotone" color={ROXO} /> Produtos em Destaque
          </h2>
          <p className="text-sm text-slate-400 mt-1">Produtos dos nossos parceiros aparecendo para você</p>
        </div>
      </div>

      <VitrinePaginada produtos={produtos} carregando={carregando} CardComponent={CardVitrineRotativa} />
    </section>
  );
}
