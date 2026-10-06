// Quem aparece para o cliente: loja ativa e que NÃO é empresa de teste
// (sindicato_parceiros.empresa_teste, migration 073). No modo QA (admin
// logado no mesmo navegador, req.modoQa — middleware lerAdminOpcional) as
// empresas de teste aparecem também, mesmo pausadas: dá para testar como
// cliente de verdade (listas do Pet, Serviços, categoria, busca e páginas)
// sem deixar a página de loja de teste aberta para quem tiver o link.
// Mesma regra do Disk Bebidas (beerController.estabelecimentoVisivel).
function lojaVisivel(qa = false, alias = 'pa') {
  const a = alias ? `${alias}.` : '';
  return qa
    ? `(${a}status = 'ativo' OR ${a}empresa_teste)`
    : `(${a}status = 'ativo' AND NOT ${a}empresa_teste)`;
}

module.exports = { lojaVisivel };
