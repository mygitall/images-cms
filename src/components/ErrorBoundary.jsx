import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main>
          <div style={{
            display: 'grid',
            placeItems: 'center',
            gap: '16px',
            minHeight: '100vh',
            padding: '24px',
            textAlign: 'center',
            color: '#eef5ff',
            background: '#060914'
          }}>
            <AlertTriangle size={40} style={{ color: '#ff6b6b' }} />
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
              {this.props.language === 'zh' ? '页面出现了错误' : this.props.language === 'ko' ? '페이지에 오류가 발생했습니다' : 'Something went wrong'}
            </h1>
            <p style={{ margin: 0, color: '#8899aa', maxWidth: '420px', lineHeight: 1.6 }}>
              {this.props.language === 'zh'
                ? '请刷新页面重试。如果问题持续存在，请联系管理员。'
                : this.props.language === 'ko'
                ? '페이지를 새로고침하여 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의하세요.'
                : 'Please refresh the page to try again. If the problem persists, contact the administrator.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '42px',
                padding: '0 18px',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '8px',
                background: 'rgba(103,232,249,0.12)',
                color: '#eef5ff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
              {this.props.language === 'zh' ? '刷新页面' : this.props.language === 'ko' ? '새로고침' : 'Refresh page'}
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
