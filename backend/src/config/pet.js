// Catálogo FECHADO do segmento 🐾 Pet Shop e Serviços — fonte única: o
// cadastro (/vender), o painel do parceiro e o marketplace leem daqui (via
// GET /api/public/pet/catalogo). O parceiro marca quais atende (vários).
//
// `natureza` decide o tipo_negocio do parceiro (ver tipoNegocioPet):
//   servico  -> aparece em /marketplace/servicos
//   produto  -> vende item (ração, remédio...) -> vitrine de produtos
// Pet shop que faz banho E vende ração = 'hibrido' (as duas listagens).
const SERVICOS_PET = [
  {
    codigo: 'banho_tosa', nome: 'Banho e Tosa', emoji: '🛁', natureza: 'servico',
    exemplos: ['Banho simples', 'Banho + tosa higiênica', 'Tosa completa', 'Tosa da raça', 'Hidratação', 'Escovação de dentes', 'Corte de unhas'],
  },
  {
    codigo: 'veterinaria', nome: 'Veterinária', emoji: '🩺', natureza: 'servico',
    exemplos: ['Consultas', 'Vacinas', 'Vermífugos', 'Exames', 'Cirurgias'],
  },
  {
    codigo: 'adestramento', nome: 'Adestramento', emoji: '🎓', natureza: 'servico',
    exemplos: ['Básico', 'Avançado', 'Comportamento'],
  },
  {
    codigo: 'hospedagem', nome: 'Hospedagem pet', emoji: '🏡', natureza: 'servico',
    exemplos: ['Hotelzinho', 'Creche pet'],
  },
  {
    codigo: 'passeio', nome: 'Passeio', emoji: '🦮', natureza: 'servico',
    exemplos: ['Dog walker'],
  },
  {
    codigo: 'farmacia', nome: 'Farmácia pet', emoji: '💊', natureza: 'produto',
    exemplos: ['Medicamentos', 'Suplementos', 'Antipulgas'],
  },
  {
    codigo: 'loja', nome: 'Loja pet / Petshop', emoji: '🦴', natureza: 'produto',
    exemplos: ['Ração', 'Brinquedos', 'Roupinhas', 'Acessórios', 'Caminhas'],
  },
];

// Porte do pet atendido (filtro do marketplace na parte 2).
const PORTES_PET = [
  { codigo: 'mini', nome: 'Mini', faixa: 'até 5 kg' },
  { codigo: 'pequeno', nome: 'Pequeno', faixa: '5 a 10 kg' },
  { codigo: 'medio', nome: 'Médio', faixa: '10 a 25 kg' },
  { codigo: 'grande', nome: 'Grande', faixa: 'acima de 25 kg' },
];

// Rótulo da categoria no marketplace (categorias[] do parceiro).
const CATEGORIA_PET = 'Pet';

const CODIGOS_SERVICO = new Set(SERVICOS_PET.map(s => s.codigo));
const CODIGOS_PORTE = new Set(PORTES_PET.map(p => p.codigo));

// Lista vinda do front -> só códigos conhecidos, sem repetir, na ordem do
// catálogo. null = veio algo que não é lista.
function normalizarLista(valor, validos, ordem) {
  if (!Array.isArray(valor)) return null;
  const set = new Set(valor.map(v => String(v)));
  return ordem.filter(c => set.has(c) && validos.has(c));
}
const normalizarServicos = v => normalizarLista(v, CODIGOS_SERVICO, SERVICOS_PET.map(s => s.codigo));
const normalizarPortes = v => normalizarLista(v, CODIGOS_PORTE, PORTES_PET.map(p => p.codigo));

// Porte só faz sentido quando o pet é ATENDIDO (banho, veterinária...), não
// pra quem só vende ração.
function exigePorte(servicos) {
  return servicos.some(c => SERVICOS_PET.find(s => s.codigo === c)?.natureza === 'servico');
}

function tipoNegocioPet(servicos) {
  const naturezas = new Set(servicos.map(c => SERVICOS_PET.find(s => s.codigo === c)?.natureza).filter(Boolean));
  if (naturezas.has('servico') && naturezas.has('produto')) return 'hibrido';
  if (naturezas.has('servico')) return 'servico';
  return 'produto';
}

// Valida o bloco pet do cadastro/painel. { erro } | { servicos, portes }
function validarPet({ servicos, portes }) {
  const s = normalizarServicos(servicos);
  if (!s || s.length === 0) return { erro: 'Marque pelo menos um serviço ou produto pet que você oferece' };
  const p = normalizarPortes(portes ?? []);
  if (!p) return { erro: 'Portes inválidos' };
  if (exigePorte(s) && p.length === 0) return { erro: 'Marque os portes de pet que você atende' };
  return { servicos: s, portes: p };
}

module.exports = { SERVICOS_PET, PORTES_PET, CATEGORIA_PET, validarPet, tipoNegocioPet, normalizarServicos, normalizarPortes };
