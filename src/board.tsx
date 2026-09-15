/* ブース掲示用ページ（/oyako-game/board.html?e=T2026-12）。タブレットや ノートPC を 横向きに 置いて 見せる */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Board } from './ui/Board';
import './ui/board.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Board /></StrictMode>);
