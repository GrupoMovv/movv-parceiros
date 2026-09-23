// Liga f_auto,q_auto numa URL de upload do Cloudinary: o próprio
// Cloudinary escolhe o formato (AVIF/WebP pra quem aceita, PNG/JPG pra
// quem não) e a qualidade. As peças de banner saem do gerador como PNG de
// ~2MB; com isso chegam por volta de 140-170KB, sem mudar nada visível.
// URL que não é do Cloudinary (ou que já tem transformação) volta igual.
export function otimizarCloudinary(url) {
  if (!url || !url.includes('res.cloudinary.com') || url.includes('/upload/f_auto')) return url;
  return url.replace('/upload/', '/upload/f_auto,q_auto/');
}
