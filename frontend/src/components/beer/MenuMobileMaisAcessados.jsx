import { Link } from 'react-router-dom';
import { BEER, MAIS_ACESSADOS } from '../../pages/beer/beerConfig';

// Grade "Mais acessados" da home do Disk Bebidas: 2 colunas no celular, 5 no
// desktop. QUERO AGORA sempre em destaque; Comidas Prontas ganha selo aos
// domingos (dia da domingueira goiana).
export default function MenuMobileMaisAcessados({ ehDomingo = false }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
      {MAIS_ACESSADOS.map(item => {
        const destino = item.rota || `/beer/categoria/${item.codigo}`;
        const destaqueDomingo = item.domingo && ehDomingo;
        return (
          <Link
            key={item.id}
            to={destino}
            className="relative flex items-center sm:flex-col sm:justify-center gap-2.5 sm:gap-1.5 rounded-2xl px-4 py-3.5 sm:py-5 transition-transform hover:-translate-y-0.5"
            style={item.destaque
              ? { background: `linear-gradient(135deg, ${BEER.violeta} 0%, ${BEER.roxo} 100%)`, boxShadow: '0 12px 30px rgba(124,58,237,0.45)', border: '1px solid rgba(255,255,255,0.18)' }
              : { backgroundColor: BEER.painel, border: `1px solid ${destaqueDomingo ? 'rgba(255,184,0,0.45)' : BEER.borda}` }}
          >
            <span className="text-2xl sm:text-3xl leading-none" aria-hidden="true">{item.icone}</span>
            <span className={`text-sm font-bold leading-tight sm:text-center ${item.destaque ? 'text-white tracking-wide' : ''}`} style={item.destaque ? {} : { color: '#fff' }}>
              {item.label}
            </span>
            {destaqueDomingo && (
              <span className="absolute -top-2 right-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: BEER.dourado, color: '#0F0F14' }}>
                Hoje
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
