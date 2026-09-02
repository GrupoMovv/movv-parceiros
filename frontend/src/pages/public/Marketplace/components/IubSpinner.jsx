import { DOURADO } from '../theme';

export default function IubSpinner({ size = 40 }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full animate-spin"
        style={{ border: `3px solid ${DOURADO}33`, borderTopColor: DOURADO }}
      />
      <img src="/iub-favicon.png" alt="" className="rounded-full" style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}
