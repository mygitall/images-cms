import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const lang = localStorage.getItem('language') || 'zh';

createRoot(document.getElementById('root')).render(
  <ErrorBoundary language={lang}>
    <App />
  </ErrorBoundary>
);
