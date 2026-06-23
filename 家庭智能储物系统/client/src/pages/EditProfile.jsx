import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { auth } from '../api'

export default function EditProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ nickname: '', phone: '', default_address: '', real_name: '', gender: '', age: '' });
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF', borderRadius: 24,
    boxShadow: appleShadow, border: 'none', padding: '20px',
  };

  useEffect(() => {
    auth.getProfile().then(res => {
      const d = res.data || {};
      setUser({
        nickname: d.nickname || '',
        phone: d.phone || '',
        default_address: d.default_address || '',
        real_name: d.real_name || '',
        gender: d.gender || '',
        age: d.age ? String(d.age) : '',
      });
      setAvatar(d.avatar || '');
    }).catch(() => {});
  }, []);

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        await auth.uploadAvatar(dataUrl);
        setAvatar(dataUrl);
        Toast.show({ icon: 'success', content: '头像已更新' });
      } catch {
        Toast.show({ content: '头像上传失败' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user.nickname.trim()) {
      Toast.show({ content: '昵称不能为空' });
      return;
    }
    setSaving(true);
    try {
      await auth.updateProfile({
        ...user,
        age: user.age ? parseInt(user.age) : null,
      });
      Toast.show({ icon: 'success', content: '保存成功' });
      navigate(-1);
    } catch {
      Toast.show({ content: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', border: 'none', outline: 'none', fontSize: 15,
    color: '#1C1C1E', background: '#F5F7FA', padding: '12px 16px',
    borderRadius: 12, boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
  };

  const labelStyle = {
    fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 8,
    letterSpacing: '0.3px', textTransform: 'uppercase',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* Header */}
      <div style={{
        margin: '-16px -16px 0', padding: '56px 28px 24px', background: '#F5F7FA',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={() => navigate(-1)} style={{
            width: 32, height: 32, borderRadius: 10, background: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: appleShadow,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: 12, color: '#8E8E93', letterSpacing: '1.5px',
              textTransform: 'uppercase', fontWeight: 600,
            }}>编辑</div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
              lineHeight: 1.1, color: '#1C1C1E', margin: 0,
            }}>个人资料</h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Avatar */}
        <div style={{ ...cardStyle, textAlign: 'center', marginBottom: 14 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 12px',
              background: avatar ? `url(${avatar}) center/cover` : 'linear-gradient(135deg, #E0E0E0 0%, #C7C7CC 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              position: 'relative',
            }}
          >
            {!avatar && <span style={{ color: '#fff', fontSize: 30, fontWeight: 700 }}>
              {(user.nickname || '?')[0].toUpperCase()}
            </span>}
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 28, height: 28, borderRadius: '50%',
              background: '#1C1C1E', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              border: '3px solid #FFFFFF',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
          <div style={{ fontSize: 13, color: '#8E8E93' }}>点击更换头像</div>
        </div>

        {/* Form */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>昵称</div>
            <input value={user.nickname} onChange={e => setUser(p => ({ ...p, nickname: e.target.value }))} placeholder="请输入昵称" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>真实姓名</div>
            <input value={user.real_name} onChange={e => setUser(p => ({ ...p, real_name: e.target.value }))} placeholder="请输入真实姓名" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>性别</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['男', '女'].map(g => (
                  <div key={g} onClick={() => setUser(p => ({ ...p, gender: g }))} style={{
                    flex: 1, padding: '12px', borderRadius: 12, textAlign: 'center',
                    background: user.gender === g ? '#1C1C1E' : '#F5F7FA',
                    color: user.gender === g ? '#fff' : '#8E8E93',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>{g}</div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>年龄</div>
              <input type="number" value={user.age} onChange={e => setUser(p => ({ ...p, age: e.target.value }))} placeholder="年龄" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>手机号</div>
            <input value={user.phone} onChange={e => setUser(p => ({ ...p, phone: e.target.value }))} placeholder="请输入手机号" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>默认地址</div>
            <input value={user.default_address} onChange={e => setUser(p => ({ ...p, default_address: e.target.value }))} placeholder="请输入默认地址" style={inputStyle} />
          </div>
        </div>

        {/* Save button */}
        <div onClick={handleSave} style={{
          background: saving ? '#C7C7CC' : '#1C1C1E', color: '#fff',
          padding: '16px', borderRadius: 14, textAlign: 'center',
          fontSize: 16, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          marginBottom: 40,
        }}>
          {saving ? '保存中...' : '保存'}
        </div>
      </div>
    </div>
  );
}
