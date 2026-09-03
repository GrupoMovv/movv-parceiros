const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');

// .trim() de propósito: copiar/colar uma chave num campo de dashboard é a
// forma nº1 de introduzir espaço ou quebra de linha invisível no valor —
// isso faz a env "existir" (CONFIGURADO fica true) mas autenticar errado
// mesmo com credencial correta, e o sintoma é indistinguível de chave
// errada. Log de baixo mostra o tamanho de cada valor pra flagrar isso.
const CLOUDINARY_CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const CLOUDINARY_API_KEY = (process.env.CLOUDINARY_API_KEY || '').trim();
const CLOUDINARY_API_SECRET = (process.env.CLOUDINARY_API_SECRET || '').trim();

const CONFIGURADO = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

// Log de boot SEMPRE roda (configurado ou não) — precisa dar pra confirmar
// no log do Render que os valores carregados são os esperados, não só que
// "existem". cloud_name não é segredo (aparece na própria URL da imagem),
// então vai completo; key/secret só o tamanho, pra pegar espaço/corte sem
// expor a credencial no log.
console.log('[CLOUDINARY INIT]', {
  cloud_name: CLOUDINARY_CLOUD_NAME || 'FALTANDO',
  api_key: CLOUDINARY_API_KEY ? `presente (${CLOUDINARY_API_KEY.length} chars)` : 'FALTANDO',
  api_secret: CLOUDINARY_API_SECRET ? `presente (${CLOUDINARY_API_SECRET.length} chars)` : 'FALTANDO',
  configurado: CONFIGURADO,
});
if (!CONFIGURADO) {
  console.error(
    '[cloudinary] ATENÇÃO: variável(is) de ambiente ausente(s) — ' +
    ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
      .filter(v => !process.env[v]).join(', ') +
    '. Todo upload de foto (produto, promoção, logo, estabelecimento) vai falhar até isso ser configurado.'
  );
}

// crop 'fill' cortava a foto pra caber exatamente no quadro — problema
// reportado: produto ficando cortado quando a foto original não é quadrada.
// Trocado por 'pad': a foto INTEIRA é redimensionada pra caber dentro do
// quadro e o espaço sobrando é preenchido com fundo, nunca corta conteúdo.
//
// IMPORTANTE: a API do Cloudinary rejeita QUALQUER `gravity` combinado com
// `crop: 'pad'` (erro 400 "Auto gravity can only be used with crop: fill,
// thumb, lfill, fill_pad, auto, auto_pad") — não é específico de
// 'auto:subject', é qualquer valor de gravity. Foi isso que já quebrava todo
// upload de PRODUTO em produção. Como com 'pad' a imagem inteira é sempre
// preservada (nunca há corte pra decidir), gravity não mudaria o resultado
// mesmo se fosse aceito — por isso nenhum preset abaixo usa gravity.
//
// quality/fetch_format 'auto' ficam fora do preset porque sao sempre iguais
// pra qualquer upload, ver uploadFoto().
const PRESETS = {
  // format 'png' força o resultado a manter canal alfa (fundo transparente).
  LOGO: { width: 400, height: 400, crop: 'pad', background: 'transparent', format: 'png' },
  // background 'auto' pega uma cor dominante da própria foto em vez de uma
  // barra branca/preta óbvia nas bordas — fica mais discreto numa foto de
  // fachada/ambiente do que fundo fixo.
  ESTABELECIMENTO: { width: 1200, height: 800, crop: 'pad', background: 'auto' },
  PRODUTO: { width: 1200, height: 1200, crop: 'pad', background: 'white' },
};

function bufferParaStream(buffer) {
  return Readable.from(buffer);
}

/**
 * Envia uma imagem (buffer, ex: vindo do multer memoryStorage) pro Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder - ex: "iubmais/parceiros/12/logo"
 * @param {'LOGO'|'ESTABELECIMENTO'|'PRODUTO'} preset
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadFoto(buffer, folder, preset) {
  const transformacaoBase = PRESETS[preset];
  if (!transformacaoBase) {
    throw new Error(`Preset de imagem inválido: ${preset}`);
  }

  console.log('[CLOUDINARY] Iniciando upload...', {
    folder, preset, tamanhoBuffer: buffer?.length,
    config: {
      cloud_name: CLOUDINARY_CLOUD_NAME || 'FALTANDO',
      api_key: CLOUDINARY_API_KEY ? 'presente' : 'FALTANDO',
      api_secret: CLOUDINARY_API_SECRET ? 'presente' : 'FALTANDO',
    },
  });

  if (!CONFIGURADO) {
    console.error('[cloudinary] Upload abortado antes de tentar — credenciais não configuradas (ver [CLOUDINARY INIT] no boot do servidor).');
    throw montarErroUpload('Credenciais do Cloudinary não configuradas no servidor.', 'CONFIG_AUSENTE');
  }

  try {
    const resultado = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ ...transformacaoBase, quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      bufferParaStream(buffer).pipe(uploadStream);
    });

    console.log('[CLOUDINARY] Upload concluído:', resultado.secure_url);
    return { url: resultado.secure_url, publicId: resultado.public_id };
  } catch (err) {
    // Loga TUDO que a API do Cloudinary devolveu — mensagem, http_code e o
    // objeto de erro inteiro (costuma vir com mais contexto em err.error).
    console.error('[CLOUDINARY ERROR]:', err?.message);
    console.error('[CLOUDINARY ERROR HTTP]:', err?.http_code);
    console.error('[CLOUDINARY ERROR NAME]:', err?.name);
    console.error('[CLOUDINARY ERROR FULL]:', err);
    if (err?.stack) console.error('[CLOUDINARY ERROR STACK]:', err.stack);

    throw montarErroUpload(err?.message || 'Falha desconhecida no upload', err?.http_code);
  }
}

// Guarda os detalhes originais (message/http_code) no próprio objeto de
// erro em vez de só numa string genérica — o controller decide o que
// devolve pro cliente; aqui a gente só garante que a informação não se
// perde no meio do caminho, que era o problema original.
function montarErroUpload(mensagemOriginal, codigo) {
  const erro = new Error('Não foi possível enviar a imagem agora. Tente novamente em instantes.');
  erro.cloudinaryMessage = mensagemOriginal;
  erro.cloudinaryCode = codigo || 'desconhecido';
  return erro;
}

/**
 * Remove uma imagem do Cloudinary pelo public_id. Nunca lança erro — é
 * best-effort, igual ao fs.unlink(..., () => {}) que a versão em disco local
 * usava: se a imagem já não existir lá (ou a API falhar), a operação
 * principal (excluir produto, trocar foto etc.) não pode travar por causa
 * disso.
 * @param {string|null|undefined} publicId
 */
async function deletarFoto(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[cloudinary] Falha ao remover imagem (ignorado):', publicId, err?.message || err);
  }
}

module.exports = { uploadFoto, deletarFoto };
