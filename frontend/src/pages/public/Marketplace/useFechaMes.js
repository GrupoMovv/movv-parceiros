import { useEffect, useState } from 'react';
import api from '../../../services/api';

// Buscado uma vez só na home (Marketplace.jsx) e repassado por prop pro
// banner e pra vitrine especial — os dois nunca precisam de dado
// diferente, então não faz sentido cada um chamar a API sozinho.
export function useFechaMesProximo() {
  const [info, setInfo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/public/fecha-mes/proximo')
      .then(res => setInfo(res.data))
      .catch(() => setInfo(null))
      .finally(() => setCarregando(false));
  }, []);

  return { info, carregando };
}
