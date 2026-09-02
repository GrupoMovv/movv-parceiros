const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// crop 'fill' cortava a foto pra caber exatamente no quadro — problema
// reportado: produto ficando cortado quando a foto original não é quadrada.
// Trocado por 'pad': a foto INTEIRA é redimensionada pra caber dentro do
// quadro e o espaço sobrando é preenchido com fundo, nunca corta conteúdo.
//
// gravity 'auto:subject' (deteccao de assunto por IA) foi cogitado pro
// PRODUTO, mas com crop 'pad' a imagem inteira já é preservada — não há
// corte pra decidir, então gravity não muda o resultado aqui. Como esse
// modo de IA pode não estar disponível em todo plano do Cloudinary e não
// dá pra testar contra a conta real agora, fica de fora: usar um valor não
// suportado quebraria TODO upload de produto com erro da API. 'auto' (sem
// ':subject') é o modo de deteccao de conteúdo padrão, sempre disponível.
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
  PRODUTO: { width: 1200, height: 1200, crop: 'pad', background: 'white', gravity: 'auto' },
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

    return { url: resultado.secure_url, publicId: resultado.public_id };
  } catch (err) {
    console.error('[cloudinary] Falha ao enviar imagem:', err?.message || err);
    throw new Error('Não foi possível enviar a imagem agora. Tente novamente em instantes.');
  }
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
