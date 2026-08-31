// Avatar de iniciais (sem foto cadastrada) — usado no admin (miniatura de
// dependente) e na carteirinha pública. Cor determinística a partir do nome,
// pra a mesma pessoa sempre cair na mesma cor nos dois lugares.
const AVATAR_CORES = ['#7C3AED', '#0D9488', '#D97706', '#E8604C', '#4F46E5', '#DB2777'];

export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function corAvatar(nome) {
  let hash = 0;
  for (const ch of String(nome || '')) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return AVATAR_CORES[Math.abs(hash) % AVATAR_CORES.length];
}
