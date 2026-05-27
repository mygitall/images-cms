import React, { useEffect, useState } from 'react';
import { LoaderCircle, LogIn, UserCircle, UserPlus, X } from 'lucide-react';
import { copy } from '../i18n';
import { cx, authErrorMessage } from '../utils';
import { useBodyScrollLock } from '../hooks';
import './AuthModal.css';

function AuthModal({ open, language, onClose, onSignIn }) {
  const t = copy[language];
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setStatus('idle');
    setMessage('');
    setUsername('');
    setPassword('');
    setPassword2('');
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedUser = username.trim();
    if (trimmedUser.length < 2) { setMessage(t.authUsernameMin); setStatus('error'); return; }
    if (password.length < 4) { setMessage(t.authPasswordMin); setStatus('error'); return; }
    if (authMode === 'register' && password !== password2) { setMessage(t.authPasswordMismatch); setStatus('error'); return; }

    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch(`/api/auth.php?action=${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'AUTH_FAILED');
      if (onSignIn) onSignIn(payload);
      onClose();
    } catch (err) {
      setStatus('error');
      setMessage(err.message || authErrorMessage(err, language));
    }
  }

  function toggleMode() {
    setAuthMode((m) => (m === 'login' ? 'register' : 'login'));
    setMessage('');
    setStatus('idle');
  }

  return (
    <div
      className="previewOverlay authOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="authDialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="previewClose" type="button" onClick={onClose} aria-label={t.closePreview}>
          <X size={20} />
        </button>
        <div className="authIcon">
          <UserCircle size={28} />
        </div>
        <h2 id="auth-title">{authMode === 'login' ? (language === 'zh' ? '登录' : language === 'ko' ? '로그인' : 'Sign In') : (language === 'zh' ? '注册' : language === 'ko' ? '회원가입' : 'Register')}</h2>
        <p>{authMode === 'login' ? t.signInSubtitle : (language === 'zh' ? '注册账号后即可使用全部功能' : language === 'ko' ? '회원가입 후 모든 기능을 이용할 수 있습니다' : 'Create an account to unlock all features.')}</p>
        <form onSubmit={handleSubmit} className="authForm">
          <input
            className="authInput"
            type="text"
            placeholder={language === 'zh' ? '用户名' : language === 'ko' ? '사용자 이름' : 'Username'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            className="authInput"
            type="password"
            placeholder={language === 'zh' ? '密码' : language === 'ko' ? '비밀번호' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {authMode === 'register' ? (
            <input
              className="authInput"
              type="password"
              placeholder={language === 'zh' ? '确认密码' : language === 'ko' ? '비밀번호 확인' : 'Confirm Password'}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          ) : null}
          <button className="googleButton" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? <LoaderCircle className="spinIcon" size={18} /> : authMode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {authMode === 'login' ? (language === 'zh' ? '登录' : language === 'ko' ? '로그인' : 'Sign In') : (language === 'zh' ? '注册' : language === 'ko' ? '회원가입' : 'Register')}
          </button>
        </form>
        <button className="authSwitch" type="button" onClick={toggleMode}>
          {authMode === 'login'
            ? (language === 'zh' ? '没有账号？去注册' : language === 'ko' ? '계정이 없으신가요? 회원가입' : "Don't have an account? Register")
            : (language === 'zh' ? '已有账号？去登录' : language === 'ko' ? '이미 계정이 있으신가요? 로그인' : 'Already have an account? Sign In')}
        </button>
        {message ? (
          <p className={cx('authMessage', status === 'error' && 'error', status === 'sent' && 'sent')}>
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default AuthModal;
