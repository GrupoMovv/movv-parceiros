import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

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
