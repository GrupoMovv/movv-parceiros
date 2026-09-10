const MASCOTE_URL = 'https://res.cloudinary.com/emv2nb1j/image/upload/v1788983002/ChatGPT_Image_9_de_set._de_2026_16_26_36.png';

const SIZES = {
  small: 'w-16 h-16',
  medium: 'w-32 h-32',
  large: 'w-48 h-48',
  gigante: 'w-64 h-64 md:w-96 md:h-96',
};

const ANIMATIONS = {
  none: '',
  bounce: 'animate-bounce-slow',
  float: 'animate-float',
  pulse: 'animate-pulse-slow',
};

// Mascote 3D oficial IUB MAIS+ — usar nos pontos de destaque da marca
// (empty states, 404, loading, boas-vindas) em vez de ícones genéricos.
export default function MascoteIubMais({
  tamanho = 'medium',
  animacao = 'none',
  className = '',
  onClick = null,
}) {
  return (
    <img
      src={MASCOTE_URL}
      alt="Mascote IUB MAIS+"
      className={`${SIZES[tamanho]} ${ANIMATIONS[animacao]} object-contain ${className}`}
      loading="lazy"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    />
  );
}
