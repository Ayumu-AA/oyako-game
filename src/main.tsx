import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { installGuards } from './lib/guards';
import { keepFresh } from './lib/fresh';
import { startScaleWatch } from './lib/uiscale';
import './ui/app.css';

installGuards();
keepFresh();
startScaleWatch();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
