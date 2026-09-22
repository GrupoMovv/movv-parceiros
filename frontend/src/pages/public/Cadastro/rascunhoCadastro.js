// Rascunho do cadastro público de associado, guardado no localStorage.
//
// Problema que resolve: o cadastro tem 5 etapas e quem fechava a aba ou
// clicava voltar sem querer perdia tudo e desistia. Com o rascunho, sair
// deixou de ser destrutivo — o formulário volta do jeito que estava.
//
// O que NÃO entra aqui:
//   - foto (é um File; não serializa, e a pessoa refaz em 1 toque)
//   - qualquer coisa de sessão/token — rascunho é formulário, não login
//
// DADO PESSOAL: isto grava CPF, nome, nascimento e WhatsApp no navegador,
// que pode ser compartilhado (lan house, celular da família). Por isso:
//   - `limpar()` é chamado assim que o cadastro conclui
//   - o rascunho expira sozinho em VALIDADE_DIAS
//   - a tela pergunta antes de restaurar, nunca preenche escondido
const CHAVE = 'iub_cadastro_rascunho_v1';
const VALIDADE_DIAS = 7;

// localStorage quebra em aba anônima/armazenamento bloqueado; o cadastro
// tem que funcionar igual nesses casos, só sem a rede de proteção.
function comStorage(fn, padrao = null) {
  try { return fn(window.localStorage); } catch { return padrao; }
}

export function salvarRascunho(dados) {
  comStorage(ls => ls.setItem(CHAVE, JSON.stringify({ ...dados, salvo_em: Date.now() })));
}

export function limparRascunho() {
  comStorage(ls => ls.removeItem(CHAVE));
}

// Devolve o rascunho só se ainda valer a pena oferecer: dentro da validade
// e com algum campo de verdade preenchido (senão a tela perguntaria
// "continuar?" pra um formulário vazio).
export function lerRascunho() {
  const bruto = comStorage(ls => ls.getItem(CHAVE));
  if (!bruto) return null;

  let dados;
  try { dados = JSON.parse(bruto); } catch { limparRascunho(); return null; }

  const idadeMs = Date.now() - (dados?.salvo_em || 0);
  if (!dados?.salvo_em || idadeMs > VALIDADE_DIAS * 864e5) { limparRascunho(); return null; }
  if (contarPreenchidos(dados.form) === 0) return null;

  return dados;
}

// Quantos campos do formulário têm conteúdo — usado no "você preencheu N de
// M campos" do modal de saída e pra decidir se há rascunho que valha a pena.
export function contarPreenchidos(form) {
  if (!form) return 0;
  return Object.values(form).filter(v => String(v ?? '').trim() !== '').length;
}

export function totalCampos(form) {
  return form ? Object.keys(form).length : 0;
}
