import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { persistReferralCodeFromLocation } from './lib/referral';

persistReferralCodeFromLocation('index.tsx bootstrap');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
