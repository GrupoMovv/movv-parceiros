// Texto da apostila e do termo: parágrafos, "## título", "> destaque" e
// **negrito**. Monta elementos React (nada de HTML vindo do banco).
function negrito(linha, chave) {
  return linha.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4
      ? <strong key={`${chave}-${i}`}>{p.slice(2, -2)}</strong>
      : p);
}

export default function TextoSimples({ texto, className = '' }) {
  const blocos = String(texto || '').replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocos.map((b, i) => {
        if (b.startsWith('# ')) return <h2 key={i} className="text-lg font-semibold text-slate-900 mt-2">{negrito(b.slice(2), i)}</h2>;
        if (b.startsWith('## ')) return <h3 key={i} className="font-semibold text-slate-900 mt-4">{negrito(b.slice(3), i)}</h3>;
        if (b.startsWith('> ')) {
          return (
            <p key={i} className="border-l-4 border-gold-500 bg-gold-100 px-3 py-2 rounded-r-lg text-gold-900">
              {negrito(b.replace(/^> ?/gm, ''), i)}
            </p>
          );
        }
        const linhas = b.split('\n');
        return <p key={i}>{linhas.map((l, j) => <span key={j}>{j > 0 && <br />}{negrito(l, `${i}-${j}`)}</span>)}</p>;
      })}
    </div>
  );
}
