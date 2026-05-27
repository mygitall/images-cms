import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const lang = localStorage.getItem('lang') || 'zh';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary language={lang}>
      <App />
    </ErrorBoundary>
  );
}
