// IMPORTANTE: el polyfill debe ir PRIMERO, antes de react-router y App,
// para navegadores antiguos que no tienen URL.parse() (react-router v7 lo usa).
import './lib/url-polyfill';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './loader-alpina.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
