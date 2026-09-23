import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

// GET de produtos do Disk Bebidas com estado de carregando/erro e
// "tentar de novo". `params` entra no efeito serializado (objeto novo a
// cada render não refaz a busca à toa).
export function useProdutosBeer(url, params = {}) {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const chave = JSON.stringify(params);

  useEffect(() => {
    if (!url) return;
    let vivo = true;
    setCarregando(true);
    setErro(false);
    api.get(url, { params: JSON.parse(chave) })
      .then(res => { if (vivo) setProdutos(res.data.produtos); })
      .catch(() => { if (vivo) setErro(true); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [url, chave, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa(t => t + 1), []);
  return { produtos, carregando, erro, tentarDeNovo };
}
