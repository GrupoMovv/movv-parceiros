import { DIAS } from '../../pages/beer/beerConfig';

// Horário de funcionamento do IUB Disk Bebidas, dia a dia (formato da
// migration 025: {"seg": {"aberto": true, "abre": "18:00", "fecha": "02:00"}}).
// Usado no painel (Meu IUB Beer) e no cadastro do /vender com segmento Bebidas.
export default function EditorHorario({ horario, onChange }) {
  function setDia(chave, campo, valor) {
    onChange({ ...horario, [chave]: { aberto: false, abre: '18:00', fecha: '23:00', ...horario[chave], [campo]: valor } });
  }

  return (
    <div className="editor-horario space-y-1.5">
      {/* Ícone de relógio do Chrome desktop come ~24px por campo: abaixo de
          640px some (no celular tocar no campo já abre o seletor nativo). */}
      <style>{`@media (max-width: 639px) { .editor-horario input[type="time"]::-webkit-calendar-picker-indicator { display: none; } }`}</style>
      {DIAS.map(d => {
        const h = horario[d.chave] || {};
        return (
          <div key={d.chave} className="flex items-center gap-2 text-sm min-h-[36px]">
            {/* Celular: nome curto (Sex) pra sobrar largura pros dois horários. */}
            <label className="flex items-center gap-2 w-16 sm:w-28 flex-shrink-0 cursor-pointer">
              <input type="checkbox" checked={Boolean(h.aberto)} onChange={e => setDia(d.chave, 'aberto', e.target.checked)} aria-label={d.label} className="w-4 h-4 accent-violet-700" />
              <span className="text-slate-700 sm:hidden">{d.curto}</span>
              <span className="text-slate-700 hidden sm:inline">{d.label}</span>
            </label>
            {h.aberto ? (
              <>
                <input type="time" value={h.abre || '18:00'} onChange={e => setDia(d.chave, 'abre', e.target.value)} aria-label={`${d.label}: abre`} className="flex-1 sm:flex-none min-w-0 px-2 py-1 border border-slate-200 rounded-md text-sm" />
                <span className="text-slate-400 flex-shrink-0">às</span>
                <input type="time" value={h.fecha || '23:00'} onChange={e => setDia(d.chave, 'fecha', e.target.value)} aria-label={`${d.label}: fecha`} className="flex-1 sm:flex-none min-w-0 px-2 py-1 border border-slate-200 rounded-md text-sm" />
              </>
            ) : <span className="text-slate-400 text-xs">fechado</span>}
          </div>
        );
      })}
    </div>
  );
}
