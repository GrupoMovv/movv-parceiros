import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../services/api';

const DIA_MS = 86400000;
const ITUMBIARA_MS = -3 * 3600000; // UTC-3, sem horário de verão
const MAX_ESPERA_MS = 6 * 3600000;

// Hora "do servidor" para quem já tem a resposta de /fecha-mes/proximo:
// corrige o relógio do aparelho pelo desvio medido na última consulta.
export function agoraDoServidor(info) {
  return Date.now() + (info?.desvio || 0);
}

// Próximo momento em que a resposta muda sozinha: começo do evento,
// fim do evento (23:59:59) ou a meia-noite de Itumbiara (dias restantes).
function proximaVirada(info, agora) {
  const meiaNoite = (Math.floor((agora + ITUMBIARA_MS) / DIA_MS) + 1) * DIA_MS - ITUMBIARA_MS;
  const alvos = [meiaNoite, Date.parse(info.comeca_em), Date.parse(info.termina_em) + 1000]
    .filter(t => Number.isFinite(t) && t > agora);
  return Math.min(...alvos);
}

// Buscado uma vez só na home (Marketplace.jsx) e repassado por prop pro
// banner e pra vitrine especial — os dois nunca precisam de dado
// diferente, então não faz sentido cada um chamar a API sozinho.
// A página vira sozinha: pergunta de novo ao servidor na hora em que o
// evento começa e termina (e à meia-noite), e ao voltar para a aba.
export function useFechaMesProximo() {
  const [info, setInfo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const ultimaBusca = useRef(0);

  const buscar = useCallback(() => {
    ultimaBusca.current = Date.now();
    return api.get('/public/fecha-mes/proximo')
      .then(res => {
        const servidor = Date.parse(res.data?.agora);
        setInfo({ ...res.data, desvio: Number.isFinite(servidor) ? servidor - Date.now() : 0 });
      })
      .catch(() => setInfo(null))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  useEffect(() => {
    if (!info) return undefined;
    const espera = proximaVirada(info, agoraDoServidor(info)) - agoraDoServidor(info) + 1000;
    const id = setTimeout(buscar, Math.max(1000, Math.min(espera, MAX_ESPERA_MS)));
    return () => clearTimeout(id);
  }, [info, buscar]);

  // celular com a tela apagada congela os timers: ao voltar, confere de novo
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimaBusca.current > 60000) buscar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [buscar]);

  return { info, carregando };
}
