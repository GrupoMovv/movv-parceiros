import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// registerType: 'autoUpdate' (vite.config.js) já recarrega sozinho quando
// sobe versão nova — não precisa de prompt "atualizar?" pro usuário. Mas o
// browser só checa "tem versão nova?" de vez em quando sozinho, e no
// celular o app fica horas em background sem essa checagem rodar — dá pra
// ficar preso numa build antiga achando que é bug de código quando na
// verdade é só cache (aconteceu de verdade num teste da Roleta: o fix já
// estava publicado, o celular só não tinha buscado a versão nova ainda —
// e de novo no bug dos "produtos favoritos" não aparecendo: o código do
// fix tava certo, o app aberto só não tinha pego a build nova). Duas
// pernas pra isso não se repetir:
// 1) registration.update() força o browser a checar o sw.js de novo no
//    servidor sempre que o app volta pra primeiro plano.
// 2) controllerchange dispara quando um SW novo assume o controle da
//    aba — sem isso, o SW novo já tá ativo mas a aba continua rodando o
//    JS ANTIGO já carregado em memória até alguém fechar/reabrir; com o
//    reload automático (uma vez só, guardado por `recarregando`, senão
//    entra em loop se o navegador disparar o evento mais de uma vez) a
//    aba pega a build nova sozinha, sem esperar o usuário perceber.
if ('serviceWorker' in navigator) {
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a0b2e',
            color: '#f0e8ff',
            border: '1px solid #3d1870',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#d4af37', secondary: '#0d0619' } },
          error:   { iconTheme: { primary: '#f87171', secondary: '#0d0619' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
