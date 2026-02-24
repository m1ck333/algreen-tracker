import React from 'react';
import ReactDOM from 'react-dom/client';
import { setOnForceLogout } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import './i18n';
import './styles/global.css';
import { App } from './App';

setOnForceLogout(() => useAuthStore.getState().logout());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
