import React from 'react';
import ReactDOM from 'react-dom/client';
import { setOnForceLogout } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import './i18n';
import { App } from './App';
import './styles/index.css';

setOnForceLogout(() => useAuthStore.getState().logout());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
