function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Fallback pra foto ausente (associado/dependente sem foto_url, ou foto
// perdida num deploy antigo antes do fix pro Cloudinary) — sempre o mesmo
// roxo pastel, não é por-pessoa como o avatar colorido do resto do app,
// de propósito pra ficar visualmente óbvio "essa pessoa não tem foto ainda".
export default function AvatarPlaceholder({ nome, size = 48, className = '', style = {} }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: '#EDE9FE',
        color: '#6D28D9',
        fontSize: Math.max(11, Math.round(size * 0.38)),
        ...style,
      }}
    >
      {iniciais(nome)}
    </span>
  );
}
