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

module.exports = { analisarProdutoPorImagem, CATEGORIAS };
