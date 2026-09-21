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

module.exports = { analisarProdutoPorImagem, transcreverAudio, estruturarProdutoPorTexto, CATEGORIAS, MIMETYPES_AUDIO, mimetypeBase };
