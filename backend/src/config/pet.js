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

// Raças em que o parceiro pode se dizer ESPECIALIZADO (opcional — sem
// marcar nenhuma = "atende todas as raças"). Lista fechada pra o filtro do
// marketplace casar certo (texto livre viraria "shitzu", "shih tzu"...).
const RACAS_PET = [
  { codigo: 'shih_tzu', nome: 'Shih-tzu', especie: 'cao' },
  { codigo: 'yorkshire', nome: 'Yorkshire', especie: 'cao' },
  { codigo: 'poodle', nome: 'Poodle', especie: 'cao' },
  { codigo: 'lhasa_apso', nome: 'Lhasa Apso', especie: 'cao' },
  { codigo: 'maltes', nome: 'Maltês', especie: 'cao' },
  { codigo: 'spitz', nome: 'Spitz Alemão (Lulu)', especie: 'cao' },
  { codigo: 'pinscher', nome: 'Pinscher', especie: 'cao' },
  { codigo: 'chihuahua', nome: 'Chihuahua', especie: 'cao' },
  { codigo: 'bichon_frise', nome: 'Bichon Frisé', especie: 'cao' },
  { codigo: 'schnauzer', nome: 'Schnauzer', especie: 'cao' },
  { codigo: 'cocker', nome: 'Cocker Spaniel', especie: 'cao' },
  { codigo: 'dachshund', nome: 'Dachshund (Salsicha)', especie: 'cao' },
  { codigo: 'buldogue_frances', nome: 'Buldogue Francês', especie: 'cao' },
  { codigo: 'buldogue_ingles', nome: 'Buldogue Inglês', especie: 'cao' },
  { codigo: 'pug', nome: 'Pug', especie: 'cao' },
  { codigo: 'beagle', nome: 'Beagle', especie: 'cao' },
  { codigo: 'border_collie', nome: 'Border Collie', especie: 'cao' },
  { codigo: 'golden', nome: 'Golden Retriever', especie: 'cao' },
  { codigo: 'labrador', nome: 'Labrador', especie: 'cao' },
  { codigo: 'pastor_alemao', nome: 'Pastor Alemão', especie: 'cao' },
  { codigo: 'husky', nome: 'Husky Siberiano', especie: 'cao' },
  { codigo: 'chow_chow', nome: 'Chow Chow', especie: 'cao' },
  { codigo: 'rottweiler', nome: 'Rottweiler', especie: 'cao' },
  { codigo: 'pit_bull', nome: 'Pit Bull', especie: 'cao' },
  { codigo: 'persa', nome: 'Persa', especie: 'gato' },
  { codigo: 'siames', nome: 'Siamês', especie: 'gato' },
  { codigo: 'maine_coon', nome: 'Maine Coon', especie: 'gato' },
  { codigo: 'angora', nome: 'Angorá', especie: 'gato' },
];

const PRECO_MIN = 1;
const PRECO_MAX = 10000;

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

const CODIGOS_RACA = new Set(RACAS_PET.map(r => r.codigo));
const normalizarRacas = v => normalizarLista(v ?? [], CODIGOS_RACA, RACAS_PET.map(r => r.codigo));

// Tabela de preços: um preço por (serviço, porte), só pra serviço de
// ATENDIMENTO que o parceiro marcou e porte que ele atende (ração não tem
// "porte"). Linha vazia = sem preço (não aparece no filtro de faixa).
// { erro } | { precos: [{ servico, porte, preco }] }
// "1.234,56" / "80,5" / "80" → número (vírgula = decimal; ponto antes dela = milhar).
function numeroBR(v) {
  const t = String(v).trim();
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}

function validarPrecos(precos, { servicos, portes }) {
  if (precos == null) return { precos: [] };
  if (!Array.isArray(precos)) return { erro: 'Tabela de preços inválida' };
  const vistos = new Set();
  const saida = [];
  for (const linha of precos) {
    const servico = String(linha?.servico || '');
    const porte = String(linha?.porte || '');
    const def = SERVICOS_PET.find(s => s.codigo === servico);
    if (!def || def.natureza !== 'servico' || !servicos.includes(servico) || !portes.includes(porte)) continue;
    if (linha.preco === '' || linha.preco == null) continue;
    const preco = Math.round(numeroBR(linha.preco) * 100) / 100;
    if (!Number.isFinite(preco) || preco < PRECO_MIN || preco > PRECO_MAX) {
      return { erro: `Preço inválido em ${def.nome} (${PORTES_PET.find(p => p.codigo === porte)?.nome}): use um valor entre R$ ${PRECO_MIN} e R$ ${PRECO_MAX}` };
    }
    const chave = `${servico}:${porte}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push({ servico, porte, preco });
  }
  return { precos: saida };
}

// ─── Parte 3: ficha do pet e pedido de horário ─────────────────────────────

const ESPECIES_PET = [
  { codigo: 'cao', nome: 'Cão', emoji: '🐶' },
  { codigo: 'gato', nome: 'Gato', emoji: '🐱' },
  { codigo: 'outro', nome: 'Outro', emoji: '🐾' },
];
const PERIODOS_PET = [
  { codigo: 'manha', nome: 'Manhã' },
  { codigo: 'tarde', nome: 'Tarde' },
  { codigo: 'noite', nome: 'Noite' },
];
const LIMITE_PETS_POR_CONTA = 20;
const LIMITE_VACINAS_POR_PET = 40;
// Pedido de horário: não aceita data passada nem muito longe (evita lixo)
const DIAS_MAX_ANTECEDENCIA = 90;

function texto(v, max) {
  if (v === undefined || v === null) return null;
  const limpo = String(v).replace(/<[^>]*>/g, '').trim();
  return limpo ? limpo.slice(0, max) : null;
}
// "YYYY-MM-DD" válido ou null
function dataISO(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}
function telefone(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13 ? d : null;
}
// Hoje em Itumbiara (Render roda em UTC)
function hojeSP(deslocDias = 0) {
  const d = new Date(Date.now() + deslocDias * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

const CODIGOS_ESPECIE = new Set(ESPECIES_PET.map(e => e.codigo));
const CODIGOS_PERIODO = new Set(PERIODOS_PET.map(p => p.codigo));

// Ficha inteira vinda do /meu. { erro } | { valores, vacinas }
function validarFichaPet(b) {
  const nome = texto(b.nome, 60);
  if (!nome) return { erro: 'Dê um nome pro seu pet' };
  if (!CODIGOS_ESPECIE.has(b.especie)) return { erro: 'Escolha a espécie (cão, gato ou outro)' };
  const especie = b.especie;

  let raca = null;
  if (b.raca === 'srd') raca = 'srd';
  else if (b.raca) {
    const r = RACAS_PET.find(x => x.codigo === b.raca);
    if (!r) return { erro: 'Raça inválida' };
    if (r.especie !== especie) return { erro: `${r.nome} não é raça de ${especie === 'gato' ? 'gato' : 'cão'}` };
    raca = r.codigo;
  }
  const porte = b.porte ? (CODIGOS_PORTE.has(b.porte) ? b.porte : undefined) : null;
  if (porte === undefined) return { erro: 'Porte inválido' };
  const sexo = b.sexo ? (['macho', 'femea'].includes(b.sexo) ? b.sexo : undefined) : null;
  if (sexo === undefined) return { erro: 'Sexo inválido' };

  let nascimento = null;
  if (b.nascimento) {
    nascimento = dataISO(b.nascimento);
    if (!nascimento) return { erro: 'Data de nascimento inválida' };
    if (nascimento > hojeSP()) return { erro: 'Nascimento não pode ser no futuro' };
    if (nascimento < '1990-01-01') return { erro: 'Data de nascimento inválida' };
  }
  const castrado = b.castrado === true || b.castrado === false ? b.castrado : null;

  const vetTel = b.vet_telefone ? telefone(b.vet_telefone) : null;
  if (b.vet_telefone && !vetTel) return { erro: 'Telefone do veterinário inválido (use DDD + número)' };
  const extraTel = b.contato_extra_telefone ? telefone(b.contato_extra_telefone) : null;
  if (b.contato_extra_telefone && !extraTel) return { erro: 'Telefone extra inválido (use DDD + número)' };

  const vacinasIn = Array.isArray(b.vacinas) ? b.vacinas : [];
  if (vacinasIn.length > LIMITE_VACINAS_POR_PET) return { erro: `Máximo de ${LIMITE_VACINAS_POR_PET} vacinas por pet` };
  const vacinas = [];
  for (const v of vacinasIn) {
    const nomeV = texto(v?.nome, 80);
    if (!nomeV) continue; // linha em branco some
    const dataV = v.data ? dataISO(v.data) : null;
    if (v.data && !dataV) return { erro: `Data inválida na vacina "${nomeV}"` };
    const prox = v.proxima_dose ? dataISO(v.proxima_dose) : null;
    if (v.proxima_dose && !prox) return { erro: `Próxima dose inválida na vacina "${nomeV}"` };
    if (dataV && prox && prox < dataV) return { erro: `Na vacina "${nomeV}", a próxima dose vem antes da aplicação` };
    vacinas.push({ nome: nomeV, data: dataV, proxima_dose: prox });
  }

  return {
    valores: {
      nome, especie, raca, raca_outra: raca ? null : texto(b.raca_outra, 60), porte, sexo,
      nascimento, nascimento_aproximado: Boolean(nascimento && b.nascimento_aproximado),
      castrado, alergias: texto(b.alergias, 500), medicamentos: texto(b.medicamentos, 500), comportamento: texto(b.comportamento, 500),
      vet_nome: texto(b.vet_nome, 100), vet_telefone: vetTel,
      contato_extra_nome: texto(b.contato_extra_nome, 100), contato_extra_telefone: extraTel,
    },
    vacinas,
  };
}

// "Cão · Poodle · Pequeno · Fêmea" — o que o pet shop vê mesmo sem autorização
function resumoPet(p) {
  const racaNome = p.raca === 'srd' ? 'Sem raça definida' : (RACAS_PET.find(r => r.codigo === p.raca)?.nome || p.raca_outra);
  return [
    ESPECIES_PET.find(e => e.codigo === p.especie)?.nome,
    racaNome,
    PORTES_PET.find(x => x.codigo === p.porte)?.nome,
    p.sexo === 'macho' ? 'Macho' : p.sexo === 'femea' ? 'Fêmea' : null,
  ].filter(Boolean).join(' · ').slice(0, 160);
}

// Dia + período do pedido (ou da proposta). { erro } | { data, periodo }
function validarDiaPeriodo(data, periodo) {
  const d = dataISO(data);
  if (!d) return { erro: 'Escolha o dia' };
  if (d < hojeSP()) return { erro: 'Esse dia já passou' };
  if (d > hojeSP(DIAS_MAX_ANTECEDENCIA)) return { erro: `Dá pra pedir até ${DIAS_MAX_ANTECEDENCIA} dias pra frente` };
  if (!CODIGOS_PERIODO.has(periodo)) return { erro: 'Escolha o período (manhã, tarde ou noite)' };
  return { data: d, periodo };
}

module.exports = {
  SERVICOS_PET, PORTES_PET, RACAS_PET, CATEGORIA_PET, PRECO_MIN, PRECO_MAX,
  validarPet, validarPrecos, tipoNegocioPet, normalizarServicos, normalizarPortes, normalizarRacas,
  ESPECIES_PET, PERIODOS_PET, LIMITE_PETS_POR_CONTA, DIAS_MAX_ANTECEDENCIA,
  validarFichaPet, resumoPet, validarDiaPeriodo, hojeSP,
};
