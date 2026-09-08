const cloudinaryService = require('./cloudinaryService');

// Fininho de propósito: cada controller já tem sua própria query de UPDATE
// (às vezes junto com outros campos, ex: gerar carteirinha no mesmo
// statement) — aqui só faz o upload e devolve url/publicId, quem chama
// decide como persiste. Apagar a foto antiga é sempre best-effort (nunca
// lança), então nunca bloqueia a resposta principal.
async function uploadFotoAssociado(buffer, associadoId) {
  return cloudinaryService.uploadFoto(buffer, `iubmais/associados/${associadoId}/foto`, 'FOTO_ASSOCIADO');
}

async function uploadFotoDependente(buffer, dependenteId) {
  return cloudinaryService.uploadFoto(buffer, `iubmais/associados/dependentes/${dependenteId}/foto`, 'FOTO_ASSOCIADO');
}

module.exports = {
  uploadFotoAssociado,
  uploadFotoDependente,
  deletarFotoAntiga: cloudinaryService.deletarFoto,
};
