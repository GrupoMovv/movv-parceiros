const OpenAI = require('openai');

// Mesmo padrão de "config presente?" do cloudinaryService.js — loga no
// boot (sem expor a chave) e recusa a chamada cedo, com mensagem clara,
// em vez de deixar o SDK estourar um erro genérico de auth lá na frente.
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const CONFIGURADO = Boolean(OPENAI_API_KEY);
const MODELO = 'gpt-4o';
const TIMEOUT_MS = 30 * 1000;

console.log('[OPENAI INIT]', {
  api_key: OPENAI_API_KEY ? `presente (${OPENAI_API_KEY.length} chars)` : 'FALTANDO',
  configurado: CONFIGURADO,
});
if (!CONFIGURADO) {
  console.error('[openai] ATENÇÃO: OPENAI_API_KEY ausente — a análise de imagem por IA vai falhar até isso ser configurado.');
}

// Só instancia o client se a chave existir -- `new OpenAI({apiKey: ''})`
// não lança na hora, mas não tem por quê criar o client sem chave nenhuma.
const client = CONFIGURADO ? new OpenAI({ apiKey: OPENAI_API_KEY, timeout: TIMEOUT_MS }) : null;

// ESPELHA frontend/src/pages/public/Marketplace/parceirosData.js
// (CATEGORIAS_FILTRO, sem a opção "Todas") — é a mesma lista que alimenta
// o <select> de categoria em ProdutoForm.jsx. Precisa ficar em sincronia
// manualmente (mesmo padrão de config duplicada já usado no projeto pra
// memoriaConfig.js/memoriaNiveis.js e roletaService/RoletaWheel): se a IA
// sugerir uma categoria fora dessa lista, o <select> não teria essa opção
// pra pré-selecionar.
const CATEGORIAS = [
  'Saúde', 'Beleza', 'Alimentação', 'Serviços', 'Fitness', 'Casa', 'Moda',
  'Tecnologia', 'Automotivo', 'Presentes', 'Educação', 'Esportes', 'Hospedagem', 'Bem-estar',
];

// Descrição pedida em CARACTERES (não palavras) porque o campo de
// descrição do produto (parceiroProdutosController.validarCampos) trava
// em 500 caracteres — um alvo em "100-200 palavras" (~700-1400
// caracteres) estouraria isso e o texto sairia cortado no meio de uma
// frase, o oposto de "descrição profissional". 250-450 chars cabe com
// folga e ainda dá pra escrever 2-3 frases completas e vendedoras.
function montarPromptSistema() {
  return `Você é um especialista em criação de descrições de produtos para um marketplace local brasileiro (Itumbiara-GO). Analise a imagem enviada e retorna SOMENTE um JSON válido, sem nenhum texto antes ou depois, no formato:

{
  "nome": "nome do produto claro e objetivo (máx. 60 caracteres)",
  "descricao": "descrição rica e vendedora em português brasileiro, entre 250 e 450 caracteres, 1 a 3 frases completas — NUNCA termine a frase cortada no meio. Destaque características, benefícios, uso e diferenciais. Estilo profissional de vendedor, sem exageros ou promessas irreais (nada de 'o melhor do mundo', 'cura tudo' etc.).",
  "marca": "marca identificada pela embalagem/logo, ou string vazia se não conseguir identificar",
  "categoria": "exatamente uma destas opções, sem inventar outra: ${CATEGORIAS.join(', ')}",
  "palavras_chave": ["5 a 10 tags curtas relevantes pra busca"]
}

Regras:
- Português brasileiro correto, sem erros de gramática ou acentuação.
- Texto 100% original — nunca copie descrições de outras lojas ou fabricantes.
- Se a imagem não mostrar um produto identificável (foto borrada, pessoa, paisagem, tela em branco etc.), responda SOMENTE: {"erro": "motivo curto e amigável em português"}.
- "categoria" tem que ser exatamente uma string da lista acima, nunca uma categoria inventada.`;
}

function extensaoParaMime(mimetype) {
  return mimetype || 'image/jpeg';
}

// null = a IA não conseguiu identificar (retorna { erro }); lança erro pra
// qualquer falha de rede/timeout/parse — quem chama decide a mensagem
// amigável (ver parceiroIaController.js).
async function analisarProdutoPorImagem(buffer, mimetype) {
  if (!CONFIGURADO) {
    const erro = new Error('IA não configurada no servidor (OPENAI_API_KEY ausente).');
    erro.codigo = 'CONFIG_AUSENTE';
    throw erro;
  }

  const dataUri = `data:${extensaoParaMime(mimetype)};base64,${buffer.toString('base64')}`;

  let resp;
  try {
    resp = await client.chat.completions.create({
      model: MODELO,
      response_format: { type: 'json_object' },
      max_tokens: 700,
      temperature: 0.4,
      messages: [
        { role: 'system', content: montarPromptSistema() },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analise esta foto de produto e retorne o JSON pedido.' },
            { type: 'image_url', image_url: { url: dataUri, detail: 'low' } },
          ],
        },
      ],
    });
  } catch (err) {
    console.error('[OPENAI ERROR]:', err?.status, err?.error || err?.message);
    const erro = new Error('Não foi possível analisar a imagem agora.');
    erro.codigo = err instanceof OpenAI.APIConnectionTimeoutError ? 'TIMEOUT' : (err?.status || 'DESCONHECIDO');
    throw erro;
  }

  const bruto = resp.choices?.[0]?.message?.content;
  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch {
    console.error('[OPENAI] Resposta não é JSON válido:', bruto);
    const erro = new Error('A IA devolveu uma resposta inesperada.');
    erro.codigo = 'JSON_INVALIDO';
    throw erro;
  }

  if (dados.erro) return null;

  return {
    nome: String(dados.nome || '').trim().slice(0, 60),
    descricao: String(dados.descricao || '').trim().slice(0, 500),
    marca: String(dados.marca || '').trim().slice(0, 120),
    // '' (sem categoria) em vez de forçar uma errada — o <select> do
    // ProdutoForm.jsx trata '' como "Selecione", opção sempre válida ali.
    categoria: CATEGORIAS.includes(dados.categoria) ? dados.categoria : '',
    palavras_chave: Array.isArray(dados.palavras_chave) ? dados.palavras_chave.map(t => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 10) : [],
  };
}

// ---------------------------------------------------------------------------
// IUB Disk Bebidas: mesma ideia do analisarProdutoPorImagem, mas a IA escolhe
// a categoria entre as FOLHAS do catálogo do Beer (beer_categorias) e lê o
// rótulo (volume, origem, quantidade no pack). `categorias` =
// [{ codigo, caminho: 'Cervejas › Long neck' }] vindas do banco — a resposta
// só vale se o código estiver nessa lista.
function montarPromptBebida(categorias) {
  return `Você cadastra produtos de uma adega/distribuidora em Itumbiara-GO (bebidas, petiscos, gelo, carvão, itens de festa). Analise a foto e retorne SOMENTE um JSON válido:

{
  "nome": "nome comercial como o cliente procura, com marca e volume/quantidade (máx. 80 caracteres). Ex.: 'Heineken Long Neck 330ml', 'Skol Lata 350ml - Pack com 12'",
  "descricao": "1 ou 2 frases completas em português, até 250 caracteres, objetivas (tipo, sabor, ocasião). Sem exagero.",
  "marca": "marca do rótulo, ou string vazia",
  "categoria_codigo": "EXATAMENTE um código da lista abaixo",
  "volume_ml": número inteiro em ml de UMA unidade (lata 350, long neck 330, garrafa 600, litrão 1000, vinho 750) ou null se não der pra ler/estimar com segurança,
  "quantidade": número de unidades se for pack/caixa/fardo, senão 1,
  "origem": "país de origem se aparecer no rótulo (ex.: 'Chile'), senão string vazia",
  "alcoolica": true se for bebida alcoólica,
  "certeza": "alta" ou "baixa",
  "duvidas": ["campos em que você não tem certeza, entre: nome, marca, categoria_codigo, volume_ml"]
}

Categorias (código — caminho):
${categorias.map(c => `${c.codigo} — ${c.caminho}`).join('\n')}

Regras:
- Se não for um produto identificável (foto borrada, pessoa, paisagem), responda SOMENTE {"erro": "motivo curto em português"}.
- categoria_codigo tem que ser um código da lista; na dúvida entre duas, escolha a mais específica que você tem certeza e marque "categoria_codigo" em duvidas.
- Não invente volume: se o rótulo não mostra e não é um formato padrão reconhecível, use null.`;
}

async function analisarBebidaPorImagem(buffer, mimetype, categorias) {
  if (!CONFIGURADO) {
    const erro = new Error('IA não configurada no servidor (OPENAI_API_KEY ausente).');
    erro.codigo = 'CONFIG_AUSENTE';
    throw erro;
  }
  const dataUri = `data:${extensaoParaMime(mimetype)};base64,${buffer.toString('base64')}`;
  let resp;
  try {
    resp = await client.chat.completions.create({
      model: MODELO,
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: montarPromptBebida(categorias) },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analise esta foto e retorne o JSON pedido.' },
            // 'auto' e não 'low': precisa ler rótulo (volume, marca, origem)
            { type: 'image_url', image_url: { url: dataUri, detail: 'auto' } },
          ],
        },
      ],
    });
  } catch (err) {
    console.error('[OPENAI ERROR bebida]:', err?.status, err?.error || err?.message);
    const erro = new Error('Não foi possível analisar a imagem agora.');
    erro.codigo = err instanceof OpenAI.APIConnectionTimeoutError ? 'TIMEOUT' : (err?.status || 'DESCONHECIDO');
    throw erro;
  }
  let dados;
  try {
    dados = JSON.parse(resp.choices?.[0]?.message?.content);
  } catch {
    const erro = new Error('A IA devolveu uma resposta inesperada.');
    erro.codigo = 'JSON_INVALIDO';
    throw erro;
  }
  return normalizarRespostaBebida(dados, categorias);
}

// Separado pra dar pra testar sem chamar a OpenAI.
function normalizarRespostaBebida(dados, categorias) {
  if (!dados || dados.erro) return null;
  const codigos = new Set(categorias.map(c => c.codigo));
  const volume = Number.isInteger(Number(dados.volume_ml)) && Number(dados.volume_ml) > 0 && Number(dados.volume_ml) <= 20000 ? Number(dados.volume_ml) : null;
  const duvidas = Array.isArray(dados.duvidas) ? dados.duvidas.filter(d => ['nome', 'marca', 'categoria_codigo', 'volume_ml'].includes(d)) : [];
  const categoria = codigos.has(dados.categoria_codigo) ? dados.categoria_codigo : '';
  if (!categoria && !duvidas.includes('categoria_codigo')) duvidas.push('categoria_codigo');
  return {
    nome: String(dados.nome || '').trim().slice(0, 80),
    descricao: String(dados.descricao || '').trim().slice(0, 300),
    marca: String(dados.marca || '').trim().slice(0, 80),
    categoria_codigo: categoria,
    volume_ml: volume,
    quantidade: Math.max(1, Math.min(200, parseInt(dados.quantidade, 10) || 1)),
    origem: String(dados.origem || '').trim().slice(0, 60),
    alcoolica: dados.alcoolica === true,
    certeza: dados.certeza === 'alta' && !duvidas.length ? 'alta' : 'baixa',
    duvidas,
  };
}

// ---------------------------------------------------------------------------
// Moderação inteligente do Disk Bebidas (Junior, 29/09/2026).

// Foto imprópria (nudez, violência...) pela API de moderação da OpenAI
// (aceita imagem; sem custo por token). → { flagged, categorias[] }
// Lança erro se não deu pra checar — quem chama trata como "não verificado".
async function moderarImagem(buffer, mimetype) {
  if (!CONFIGURADO) { const e = new Error('IA não configurada'); e.codigo = 'CONFIG_AUSENTE'; throw e; }
  const r = await client.moderations.create({
    model: 'omni-moderation-latest',
    input: [{ type: 'image_url', image_url: { url: `data:${extensaoParaMime(mimetype)};base64,${buffer.toString('base64')}` } }],
  });
  const res = r.results?.[0] || {};
  return { flagged: Boolean(res.flagged), categorias: Object.entries(res.categories || {}).filter(([, v]) => v).map(([k]) => k) };
}

// A foto combina com a categoria escolhida? (cadastro MANUAL; no cadastro
// pela IA a própria IA já escolheu a categoria). → { compativel, motivo }
async function conferirCategoriaFoto(buffer, mimetype, { nome, caminhoCategoria }) {
  if (!CONFIGURADO) { const e = new Error('IA não configurada'); e.codigo = 'CONFIG_AUSENTE'; throw e; }
  const resp = await client.chat.completions.create({
    model: MODELO,
    response_format: { type: 'json_object' },
    max_tokens: 120,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: 'Você confere cadastros de uma adega. Responda SOMENTE JSON {"compativel": true|false, "motivo": "frase curta em português"}. '
          + 'compativel=true se a foto mostra um produto que razoavelmente pertence à categoria informada (e ao nome). '
          + 'false só quando claramente não combina (ex.: foto de pessoa, de outro tipo de produto, de documento).',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Categoria: ${caminhoCategoria}\nNome: ${nome}` },
          { type: 'image_url', image_url: { url: `data:${extensaoParaMime(mimetype)};base64,${buffer.toString('base64')}`, detail: 'low' } },
        ],
      },
    ],
  });
  const d = JSON.parse(resp.choices?.[0]?.message?.content || '{}');
  return { compativel: d.compativel === true, motivo: String(d.motivo || '').slice(0, 200) };
}

// ---------------------------------------------------------------------------
// Cadastro por VOZ (IUB Food fase 1): áudio -> Whisper (texto) -> GPT-4o
// (JSON estruturado). Duas chamadas separadas de propósito: o Whisper só
// transcreve, e quem entende "vinte e nove e noventa" = 29.90 é o GPT.
// ---------------------------------------------------------------------------

// Whisper decide o formato pela EXTENSÃO do nome do arquivo, não pelo
// mimetype — e cada navegador grava num container diferente (Chrome/
// Firefox: webm/ogg; Safari/iOS: mp4). Mimetype chega tipo
// "audio/webm;codecs=opus", por isso o split no ';'.
const EXTENSAO_AUDIO = {
  'audio/webm': 'webm', 'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a', 'audio/aac': 'm4a',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
};
const MIMETYPES_AUDIO = Object.keys(EXTENSAO_AUDIO);

function mimetypeBase(mimetype) {
  return String(mimetype || '').split(';')[0].trim().toLowerCase();
}

// Vocabulário de contexto pro Whisper — melhora bastante a grafia de nome
// de prato ("X-Bacon", "catupiry", "contrafilé") e faz ele preferir
// escrever preço como "R$ 29,90". Não é instrução, é só texto de exemplo
// no estilo esperado (é assim que o parâmetro `prompt` do Whisper funciona).
const PROMPT_WHISPER = 'Cardápio de restaurante em Itumbiara. X-Bacon com bacon crocante e batata palha, R$ 29,90. Marmita executiva de contrafilé com arroz, feijão e salada, R$ 25,00. Pizza grande de calabresa com borda recheada de catupiry, R$ 60,00. Açaí, espetinho, pastel, self-service, refrigerante lata.';

function erroIA(err, mensagem) {
  console.error('[OPENAI ERROR]:', err?.status, err?.error || err?.message);
  const erro = new Error(mensagem);
  erro.codigo = err instanceof OpenAI.APIConnectionTimeoutError ? 'TIMEOUT' : (err?.status || 'DESCONHECIDO');
  return erro;
}

function exigirConfigurado() {
  if (CONFIGURADO) return;
  const erro = new Error('IA não configurada no servidor (OPENAI_API_KEY ausente).');
  erro.codigo = 'CONFIG_AUSENTE';
  throw erro;
}

async function transcreverAudio(buffer, mimetype) {
  exigirConfigurado();
  const ext = EXTENSAO_AUDIO[mimetypeBase(mimetype)] || 'webm';
  try {
    const resp = await client.audio.transcriptions.create({
      file: await OpenAI.toFile(buffer, `produto.${ext}`),
      model: 'whisper-1',
      language: 'pt',
      prompt: PROMPT_WHISPER,
    });
    return String(resp.text || '').trim();
  } catch (err) {
    throw erroIA(err, 'Não foi possível transcrever o áudio agora.');
  }
}

function montarPromptVoz() {
  return `Você recebe a TRANSCRIÇÃO de um comerciante de restaurante/lanchonete de Itumbiara-GO falando em voz alta um item do cardápio pra cadastrar num app de delivery. Extraia os dados e retorne SOMENTE um JSON válido, sem texto antes ou depois:

{
  "nome": "nome curto do item como apareceria num cardápio (máx. 60 caracteres), com as iniciais em maiúscula. Ex.: 'X-Bacon', 'Marmita Executiva de Contrafilé', 'Pizza Grande de Calabresa'",
  "descricao": "descrição apetitosa em português brasileiro, entre 60 e 300 caracteres, usando SOMENTE o que foi dito (ingredientes, tamanho, acompanhamentos, borda, etc.). NUNCA invente ingredientes, porções ou características que não foram falados. Se falou poucos detalhes, escreva uma frase curta e convidativa com o que tiver.",
  "preco": número decimal em reais (ponto como separador) ou null se nenhum preço foi dito,
  "categoria": "exatamente uma destas opções: ${CATEGORIAS.join(', ')} — comida e bebida é sempre 'Alimentação'",
  "tempo_preparo_min": número inteiro de minutos SE o comerciante falou quanto tempo leva pra ficar pronto, senão null,
  "tags": ["3 a 8 palavras-chave curtas pra busca, ex.: 'hambúrguer', 'bacon', 'lanche'"]
}

Regras de preço (muito importante):
- "vinte e nove reais e noventa", "vinte e nove e noventa", "29,90", "R$ 29,90" => 29.90
- "vinte e cinco reais", "25 conto", "vinte e cinco" => 25.00
- "sessenta" => 60.00 ; "doze e cinquenta" => 12.50 ; "um e cinquenta" => 1.50
- Se falou mais de um preço (ex.: tamanhos diferentes), use o do item principal descrito e cite os outros tamanhos/preços na descrição.
- Nunca chute preço que não foi dito: use null.

Se a transcrição não descreve nenhum item de cardápio/produto (silêncio, ruído, conversa aleatória), responda SOMENTE: {"erro": "motivo curto e amigável em português"}.`;
}

function normalizarPreco(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

async function estruturarProdutoPorTexto(transcricao) {
  exigirConfigurado();
  let resp;
  try {
    resp = await client.chat.completions.create({
      model: MODELO,
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: montarPromptVoz() },
        { role: 'user', content: `Transcrição: """${transcricao.slice(0, 2000)}"""` },
      ],
    });
  } catch (err) {
    throw erroIA(err, 'Não foi possível estruturar o produto agora.');
  }

  const bruto = resp.choices?.[0]?.message?.content;
  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch {
    console.error('[OPENAI] Resposta (voz) não é JSON válido:', bruto);
    const erro = new Error('A IA devolveu uma resposta inesperada.');
    erro.codigo = 'JSON_INVALIDO';
    throw erro;
  }
  if (dados.erro) return null;

  const tempo = parseInt(dados.tempo_preparo_min, 10);
  return {
    nome: String(dados.nome || '').trim().slice(0, 60),
    descricao: String(dados.descricao || '').trim().slice(0, 500),
    preco: normalizarPreco(dados.preco),
    categoria: CATEGORIAS.includes(dados.categoria) ? dados.categoria : 'Alimentação',
    tempo_preparo_min: Number.isInteger(tempo) && tempo > 0 && tempo <= 300 ? tempo : null,
    // `palavras_chave` — mesmo nome de campo da análise por foto, pro
    // front tratar as duas sugestões do mesmo jeito.
    palavras_chave: Array.isArray(dados.tags) ? dados.tags.map(t => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 10) : [],
  };
}

// ---------------------------------------------------------------------------
// Voz GUIADA: uma pergunta por vez (nome -> descrição -> preço). Cada etapa
// recebe só a fala daquela resposta e devolve um valor só.
// ---------------------------------------------------------------------------

const PROMPTS_ETAPA = {
  nome: () => `O comerciante de um restaurante/lanchonete respondeu, falando, à pergunta "Qual o NOME do produto?". Transforme a fala no nome do item como apareceria num cardápio: curto (máx. 60 caracteres), iniciais maiúsculas, sem artigo nem frase ("é o", "o nome é", "é um"), sem preço. Grafias usuais de cardápio: "xis bacon" -> "X-Bacon", "x salada" -> "X-Salada".
Responda SOMENTE JSON: {"valor": "nome"}. Se a fala não contém nome de produto nenhum, responda {"erro": "motivo curto"}.`,

  // Limite em CARACTERES (não palavras): o campo descrição do produto trava
  // em 500 caracteres (parceiroProdutosController.validarCampos) — "100-200
  // palavras" sairia cortado no meio da frase.
  descricao: ({ nome }) => `O comerciante de um restaurante/lanchonete descreveu, falando, o produto${nome ? ` "${nome}"` : ''} (ingredientes, tamanho, acompanhamentos). Reescreva como descrição de cardápio apetitosa em português brasileiro, entre 150 e 450 caracteres, 1 a 3 frases completas — NUNCA termine cortada. Use SOMENTE o que foi dito: não invente ingredientes, porções, tamanhos nem características. Não inclua preço.
Responda SOMENTE JSON: {"valor": "descrição"}. Se a fala não descreve produto nenhum, responda {"erro": "motivo curto"}.`,

  preco: () => `O comerciante respondeu, falando, à pergunta "Qual o PREÇO?". Extraia o valor em reais como número decimal com ponto.
Exemplos: "vinte e nove e noventa" => 29.90 ; "vinte e nove reais e noventa centavos" => 29.90 ; "R$ 29,90" => 29.90 ; "vinte e cinco" / "25 conto" => 25.00 ; "doze e cinquenta" => 12.50 ; "um e cinquenta" => 1.50 ; "sessenta" => 60.00.
Responda SOMENTE JSON: {"valor": número}. Se não houver valor claro, responda {"erro": "motivo curto"} — nunca chute.`,
};

// null = a IA não achou o valor na fala (quem chama devolve 422 pedindo
// pra regravar); lança erro pra falha de rede/timeout/JSON.
async function extrairEtapaVoz(etapa, transcricao, contexto = {}) {
  exigirConfigurado();
  const montarPrompt = PROMPTS_ETAPA[etapa];
  if (!montarPrompt) throw new Error(`Etapa desconhecida: ${etapa}`);

  let resp;
  try {
    resp = await client.chat.completions.create({
      model: MODELO,
      response_format: { type: 'json_object' },
      max_tokens: etapa === 'descricao' ? 400 : 100,
      temperature: etapa === 'descricao' ? 0.5 : 0.1,
      messages: [
        { role: 'system', content: montarPrompt(contexto) },
        { role: 'user', content: `Fala transcrita: """${transcricao.slice(0, 2000)}"""` },
      ],
    });
  } catch (err) {
    throw erroIA(err, 'Não foi possível entender o áudio agora.');
  }

  let dados;
  try {
    dados = JSON.parse(resp.choices?.[0]?.message?.content);
  } catch {
    const erro = new Error('A IA devolveu uma resposta inesperada.');
    erro.codigo = 'JSON_INVALIDO';
    throw erro;
  }
  if (dados.erro || dados.valor === undefined || dados.valor === null) return null;

  if (etapa === 'preco') return normalizarPreco(dados.valor);
  const texto = String(dados.valor).trim().slice(0, etapa === 'nome' ? 60 : 500);
  return texto || null;
}

module.exports = { analisarProdutoPorImagem, analisarBebidaPorImagem, normalizarRespostaBebida, moderarImagem, conferirCategoriaFoto, transcreverAudio, estruturarProdutoPorTexto, extrairEtapaVoz, CATEGORIAS, MIMETYPES_AUDIO, mimetypeBase };
