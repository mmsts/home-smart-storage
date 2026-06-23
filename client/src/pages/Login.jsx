import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { auth } from '../api'

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', nickname: '' });

  const updateField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const onLogin = async () => {
    if (!form.username || !form.password) {
      Toast.show({ content: '请填写用户名和密码' });
      return;
    }
    setLoading(true);
    try {
      const res = await auth.login({ username: form.username, password: form.password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      Toast.show({ icon: 'success', content: '登录成功' });
      navigate('/', { replace: true });
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '登录失败' });
    }
    setLoading(false);
  };

  const onRegister = async () => {
    if (!form.username || !form.password) {
      Toast.show({ content: '请填写用户名和密码' });
      return;
    }
    setLoading(true);
    try {
      const res = await auth.register({
        username: form.username,
        password: form.password,
        nickname: form.nickname || form.username,
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      Toast.show({ icon: 'success', content: '注册成功' });
      navigate('/', { replace: true });
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '注册失败' });
    }
    setLoading(false);
  };

  const isLogin = tab === 'login';

  return (
    <div style={{
      minHeight: '100vh', background: '#F5F7FA',
      display: 'flex', flexDirection: 'column',
      padding: '0 24px',
      justifyContent: 'center',
    }}>
      {/* Logo & Title */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(69,130,226,0.2)',
          margin: '0 auto 20px',
        }}>
          <img src="/logo.png" alt="归处" style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }} />
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px',
          color: '#1C1C1E', marginBottom: 6,
        }}>
          归处
        </h1>
        <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.5 }}>
          家里的每样东西，都有归处
        </p>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex', background: '#FFFFFF', borderRadius: 14,
        padding: 4, marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}>
        {['login', 'register'].map(key => (
          <div key={key} onClick={() => setTab(key)} style={{
            flex: 1, textAlign: 'center', padding: '10px 0',
            borderRadius: 10, cursor: 'pointer',
            fontSize: 15, fontWeight: tab === key ? 600 : 400,
            background: tab === key ? '#1C1C1E' : 'transparent',
            color: tab === key ? '#FFFFFF' : '#8E8E93',
            transition: 'all 0.2s ease',
          }}>
            {key === 'login' ? '登录' : '注册'}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div style={{
        background: '#FFFFFF', borderRadius: 24,
        padding: '24px 20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}>
        {/* Username */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 8, letterSpacing: '0.3px' }}>
            用户名
          </div>
          <input
            type="text"
            placeholder="请输入用户名"
            value={form.username}
            onChange={e => updateField('username', e.target.value)}
            style={{
              width: '100%', height: 48, border: '1px solid #E5E5EA',
              borderRadius: 12, padding: '0 16px', fontSize: 15,
              outline: 'none', background: '#F5F7FA', color: '#1C1C1E',
              fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Nickname - register only */}
        {!isLogin && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 8, letterSpacing: '0.3px' }}>
              昵称
            </div>
            <input
              type="text"
              placeholder="请输入昵称（选填）"
              value={form.nickname}
              onChange={e => updateField('nickname', e.target.value)}
              style={{
                width: '100%', height: 48, border: '1px solid #E5E5EA',
                borderRadius: 12, padding: '0 16px', fontSize: 15,
                outline: 'none', background: '#F5F7FA', color: '#1C1C1E',
                fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Password */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 8, letterSpacing: '0.3px' }}>
            密码
          </div>
          <input
            type="password"
            placeholder="请输入密码"
            value={form.password}
            onChange={e => updateField('password', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (isLogin ? onLogin() : onRegister())}
            style={{
              width: '100%', height: 48, border: '1px solid #E5E5EA',
              borderRadius: 12, padding: '0 16px', fontSize: 15,
              outline: 'none', background: '#F5F7FA', color: '#1C1C1E',
              fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Submit Button */}
        <div
          onClick={() => !loading && (isLogin ? onLogin() : onRegister())}
          style={{
            width: '100%', height: 50, borderRadius: 14,
            background: loading ? '#C7C7CC' : '#1C1C1E',
            color: '#FFFFFF', fontSize: 16, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.2s ease',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 0 8px', color: '#C7C7CC', fontSize: 12 }}>
        归处 v1.0
      </div>
    </div>
  );
}
