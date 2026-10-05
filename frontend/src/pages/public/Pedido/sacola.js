// "Sacola" do pedido pelo site (botão Comprar): itens de UMA loja só, no
// localStorage. Separada do carrinho (que é lista de interesses e chama a
// loja no WhatsApp). Preço NÃO fica aqui: quem calcula é o servidor
// (POST /public/pedidos/cotacao) — aqui só tipo, id e quantidade.
//   { loja: { id, nome, slug, catalogo, url }, itens: [{ tipo, id, quantidade, nome, foto_url }] }

const CHAVE = 'iub_pedido_sacola';
const EVENTO = 'iub:sacola-mudou';

export function lerSacola() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    return s && s.loja && Array.isArray(s.itens) ? s : null;
  } catch {
    return null;
  }
}

function gravar(s) {
  if (s && s.itens.length) localStorage.setItem(CHAVE, JSON.stringify(s));
  else localStorage.removeItem(CHAVE);
  window.dispatchEvent(new Event(EVENTO));
}

export function limparSacola() {
  gravar(null);
}

// true se a sacola já tem itens de OUTRA loja (ou outro catálogo).
export function conflitaComSacola(loja) {
  const s = lerSacola();
  return Boolean(s && (s.loja.id !== loja.id || s.loja.catalogo !== loja.catalogo));
}

// Adiciona (ou soma 1). Se for de outra loja, começa uma sacola nova —
// quem chama confirma antes com conflitaComSacola.
export function adicionarNaSacola(loja, item) {
  let s = lerSacola();
  if (!s || s.loja.id !== loja.id || s.loja.catalogo !== loja.catalogo) s = { loja, itens: [] };
  const atual = s.itens.find(i => i.tipo === item.tipo && String(i.id) === String(item.id));
  // promoção: 1 unidade por pedido
  if (atual) atual.quantidade = item.tipo === 'promocao' ? 1 : Math.min(99, atual.quantidade + 1);
  else s.itens.push({ tipo: item.tipo, id: item.id, quantidade: 1, nome: item.nome, foto_url: item.foto_url || null });
  s.loja = { ...s.loja, ...loja };
  gravar(s);
  return s;
}

export function mudarQuantidade(tipo, id, quantidade) {
  const s = lerSacola();
  if (!s) return;
  s.itens = s.itens
    .map(i => (i.tipo === tipo && String(i.id) === String(id) ? { ...i, quantidade } : i))
    .filter(i => i.quantidade > 0);
  gravar(s);
}

export function quantidadeNaSacola() {
  return (lerSacola()?.itens || []).reduce((n, i) => n + i.quantidade, 0);
}

export function aoMudarSacola(fn) {
  window.addEventListener(EVENTO, fn);
  window.addEventListener('storage', fn);
  return () => { window.removeEventListener(EVENTO, fn); window.removeEventListener('storage', fn); };
}
