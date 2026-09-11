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
// estava publicado, o celular só não tinha buscado a versão nova ainda).
// registration.update() força o browser a checar o sw.js de novo no
// servidor sempre que o app volta pra primeiro plano.
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
