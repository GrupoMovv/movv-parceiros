import { useCallback, useEffect, useRef, useState } from 'react';

// Campainha do pedido que espera resposta (A1). O som é um arquivo comum:
// para trocar (ex.: o "iubii"), substitua frontend/public/sons/campainha.mp3
// por outro mp3 curto, de até uns 3 s, com o mesmo nome.
export const SOM_CAMPAINHA = '/sons/campainha.mp3';
export const INTERVALO_CAMPAINHA_MS = 30000;
// Quem muda um pedido (aceitar, recusar...) avisa por este evento; o painel
// reconta na hora em vez de esperar os 30 s (e a campainha para).
export const EVENTO_PEDIDOS_MUDOU = 'iub:pedidos-mudou';

export function avisarPedidosMudou() {
  window.dispatchEvent(new Event(EVENTO_PEDIDOS_MUDOU));
}

// Dois bipes gerados no navegador: só se o arquivo não tocar (sumiu, formato).
function bipes() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return Promise.resolve(false);
  const ctx = new Ctx();
  if (ctx.state === 'suspended') { ctx.close(); return Promise.resolve(false); }
  [0, 0.25].forEach(inicio => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
    ganho.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + inicio + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.18);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(ctx.currentTime + inicio);
    osc.stop(ctx.currentTime + inicio + 0.2);
  });
  setTimeout(() => ctx.close(), 800);
  return Promise.resolve(true);
}

// true = tocou; false = o navegador bloqueou (ninguém tocou na página ainda).
export async function tocarCampainha() {
  try {
    const audio = new Audio(SOM_CAMPAINHA);
    await audio.play();
    return true;
  } catch (err) {
    if (err?.name === 'NotAllowedError') return false;
    try { return await bipes(); } catch { return false; }
  }
}

// Toca já e a cada 30 s enquanto `tocando` for true (há pedido esperando a
// loja aceitar ou recusar). O navegador só deixa tocar som depois de um toque
// na página: aí `bloqueada` fica true e a tela mostra "Ativar campainha".
// `gatilho` (B1): quando muda (o cliente mudou os itens), toca na hora.
export function useCampainha(tocando, gatilho = null) {
  const [bloqueada, setBloqueada] = useState(false);
  const tocandoRef = useRef(tocando);
  tocandoRef.current = tocando;

  const tocar = useCallback(async () => {
    const ok = await tocarCampainha();
    setBloqueada(!ok && tocandoRef.current);
  }, []);

  useEffect(() => {
    if (!tocando) { setBloqueada(false); return undefined; }
    tocar();
    const t = setInterval(tocar, INTERVALO_CAMPAINHA_MS);
    return () => clearInterval(t);
  }, [tocando, tocar, gatilho]);

  // o toque no botão já libera o som; toca uma vez para a loja ouvir
  const ativar = useCallback(() => { tocar(); }, [tocar]);
  return { bloqueada, ativar };
}
