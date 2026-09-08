import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// registerType: 'autoUpdate' (vite.config.js) já recarrega sozinho quando
// sobe versão nova — não precisa de prompt "atualizar?" pro usuário.
registerSW({ immediate: true });

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
