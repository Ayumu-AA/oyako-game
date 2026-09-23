import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { installGuards } from './lib/guards';
import { keepFresh } from './lib/fresh';
import './ui/app.css';

installGuards();
keepFresh();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
