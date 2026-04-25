import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/auth.css';
import './styles/home.css';
import './styles/profile.css';
import './styles/myplan.css';
import './styles/pantry.css';
import './styles/aigenerate.css';
import './styles/chat.css';
import './styles/settings.css';
import './styles/responsive.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
