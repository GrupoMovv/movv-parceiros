import { createContext, useContext } from 'react';

// Abre o modal de produto de qualquer card do /beer (o modal mora no
// BeerLayout e vive na URL como ?p=ID — dá pra compartilhar o link e o
// "voltar" do celular fecha). Fora do BeerLayout vira no-op.
export const ProdutoModalContext = createContext({ abrirProduto: () => {} });

export function useProdutoModal() {
  return useContext(ProdutoModalContext);
}
