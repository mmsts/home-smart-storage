import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Toast } from 'antd-mobile'
import { auth, families as familiesApi } from '../api'
import { icons } from '../styles/theme'

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [familyInfo, setFamilyInfo] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberTagInput, setMemberTagInput] = useState('');
  const [showQR, setShowQR] = useState(false);

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: 24,
    boxShadow: appleShadow,
    border: 'none',
  };

  const loadProfile = () => {
    const cached = localStorage.getItem('user');
    if (cached) { try { setUser(JSON.parse(cached)); } catch(e) {} }
    auth.getProfile().then(res => {
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    }).catch(() => {
      if (!cached) { localStorage.clear(); navigate('/login', { replace: true }); }
    });
  };

  useEffect(() => {
    loadProfile();
    familiesApi.list().then(res => {
      if (res.data?.length > 0) {
        const fid = res.data[0].id;
        setFamilyId(fid);
        familiesApi.get(fid).then(r => {
          setFamilyInfo(r.data);
          const uid = JSON.parse(localStorage.getItem('user') || '{}').id;
          const me = (r.data.members || []).find(m => m.id === uid);
          if (me) setSelectedMember(me);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Refresh profile when page is focused (back from edit page)
  useEffect(() => {
    const handler = () => loadProfile();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const reloadFamily = () => {
    if (!familyId) return;
    familiesApi.get(familyId).then(r => {
      setFamilyInfo(r.data);
      if (selectedMember) {
        const updated = (r.data.members || []).find(m => m.id === selectedMember.id);
        if (updated) setSelectedMember(updated);
      }
    }).catch(() => {});
  };

  const addMemberTag = async () => {
    const text = memberTagInput.trim();
    if (!text || !familyId || !selectedMember) return;
    await familiesApi.addMemberTag(familyId, selectedMember.id, { tag_text: text, tag_type: 'custom' });
    setMemberTagInput('');
    Toast.show({ icon: 'success', content: '标签已添加' });
    reloadFamily();
  };

  const deleteMemberTag = async (tagId) => {
    if (!familyId || !selectedMember) return;
    await familiesApi.deleteMemberTag(familyId, selectedMember.id, tagId);
    reloadFamily();
  };

  const handleLogout = async () => {
    const result = await Dialog.confirm({ content: '确定退出登录？' });
    if (result) { localStorage.clear(); navigate('/login', { replace: true }); }
  };

  if (!user) return (
    <div style={{ textAlign: 'center', paddingTop: 120, background: '#F5F7FA', minHeight: '100vh' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
      <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: '#1C1C1E' }}>需要重新登录</h3>
      <p style={{ color: '#8E8E93', fontSize: 14, marginBottom: 24 }}>登录状态已过期</p>
      <div onClick={() => { localStorage.clear(); navigate('/login', { replace: true }); }} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#1C1C1E', color: '#FFFFFF', padding: '12px 32px',
        borderRadius: 14, fontWeight: 600, fontSize: 15, cursor: 'pointer'
      }}>去登录</div>
    </div>
  );

  const getReminderDesc = () => {
    const raw = localStorage.getItem('reminderSettings');
    if (!raw) return '整个家庭 · 全部提醒';
    try {
      const s = JSON.parse(raw);
      let modeDesc = '整个家庭';
      if (s.mode === 'self') modeDesc = '仅自己';
      else if (s.mode === 'members') modeDesc = `指定${s.member_ids?.length || 0}位成员`;
      const levels = s.priorityLevels || ['high', 'medium', 'low'];
      let priorityDesc = '全部提醒';
      if (levels.length === 1 && levels[0] === 'high') priorityDesc = '仅高优先级';
      else if (levels.length === 0) priorityDesc = '无提醒';
      else if (levels.length < 3) priorityDesc = `${levels.length}级提醒`;
      return `${modeDesc} · ${priorityDesc}`;
    } catch { return '整个家庭 · 全部提醒'; }
  };

  const menuItems = [
    { icon: icons.family, label: '家庭管理', desc: '家庭成员与权限', action: () => navigate('/family') },
    { icon: icons.chart, label: '数据统计', desc: '查看存储数据', action: () => navigate('/stats') },
    { icon: icons.log, label: '操作日志', desc: '查看操作历史记录', action: () => navigate('/activity-logs') },
    { icon: icons.bell, label: '提醒设置', desc: getReminderDesc(), action: () => navigate('/reminder-settings') },
    {
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
      label: '分享访问', desc: '生成二维码供他人扫码使用',
      action: () => setShowQR(true)
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* Hero Header */}
      <div style={{
        margin: '-16px -16px 0',
        padding: '56px 28px 28px',
        background: '#F5F7FA',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative illustration */}
        <svg style={{ position: 'absolute', top: 20, right: 0, opacity: 0.06, zIndex: 0 }} width="180" height="150" viewBox="0 0 180 150" fill="none" stroke="#1C1C1E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Person silhouette */}
          <circle cx="90" cy="35" r="18" />
          <path d="M55 120C55 88 70 72 90 72C110 72 125 88 125 120" />
          {/* Settings gear around person */}
          <circle cx="90" cy="35" r="28" strokeDasharray="4 4" />
          {/* Small gear elements */}
          <circle cx="145" cy="30" r="8" />
          <line x1="145" y1="18" x2="145" y2="22" />
          <line x1="145" y1="38" x2="145" y2="42" />
          <line x1="133" y1="30" x2="137" y2="30" />
          <line x1="153" y1="30" x2="157" y2="30" />
          {/* Shield / security */}
          <path d="M30 55L30 80C30 95 45 105 55 110" />
          <path d="M55 55L55 80C55 95 45 105 35 110" />
          {/* Decorative dots */}
          <circle cx="15" cy="70" r="2" fill="#1C1C1E" />
          <circle cx="165" cy="85" r="2" fill="#1C1C1E" />
          <circle cx="160" cy="120" r="3" />
          <circle cx="20" cy="110" r="3" />
          {/* Chart bars */}
          <rect x="140" y="90" width="8" height="25" rx="2" />
          <rect x="152" y="80" width="8" height="35" rx="2" />
          <rect x="164" y="95" width="8" height="20" rx="2" />
        </svg>
        <div style={{
          fontSize: 12, color: '#8E8E93', marginBottom: 10,
          letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600
        }}>
          个人中心
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
          lineHeight: 1.1, color: '#1C1C1E', margin: 0
        }}>
          我的
        </h1>
      </div>

      {/* ===== PERSONAL INFO — Apple ID Card Style ===== */}
      <div style={{
        ...cardStyle, padding: '24px 20px', marginTop: 16,
        margin: '16px 20px 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar — 72px round */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: user.avatar ? `url(${user.avatar}) center/cover` : 'linear-gradient(135deg, #E0E0E0 0%, #C7C7CC 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            {!user.avatar && <span style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 700 }}>
              {(user.nickname || user.username || '?')[0].toUpperCase()}
            </span>}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 28, lineHeight: 1.2, color: '#1C1C1E',
              letterSpacing: '-0.3px'
            }}>
              {user.nickname || user.username}
            </div>
            <div style={{ color: '#8E8E93', fontSize: 15, marginTop: 4 }}>
              @{user.username}
            </div>
          </div>

          {/* Edit button */}
          <div onClick={() => navigate('/profile/edit')} style={{
            width: 32, height: 32, borderRadius: 10,
            background: '#F5F7FA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </div>
        </div>

        {/* Info capsule tags */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 16,
          borderTop: '0.5px solid #F2F2F7',
        }}>
          {user.real_name && <CapsuleTag label={user.real_name} />}
          {user.gender && <CapsuleTag label={user.gender} />}
          {user.age && <CapsuleTag label={`${user.age}岁`} />}
          {!user.real_name && !user.gender && !user.age && (
            <span style={{ fontSize: 13, color: '#8E8E93' }}>点击右上角完善个人信息</span>
          )}
        </div>
      </div>

      {/* ===== FAMILY TAG MANAGEMENT ===== */}
      {familyInfo && familyInfo.members && (
        <div style={{
          ...cardStyle, padding: '20px',
          margin: '14px 20px 0'
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 14,
            letterSpacing: '0.3px', textTransform: 'uppercase'
          }}>家庭标签管理</div>

          {/* Member selector — Apple Home style */}
          <div style={{
            display: 'flex', gap: 10, marginBottom: 16, overflowX: 'auto',
            paddingBottom: 4, scrollbarWidth: 'none',
          }}>
            {familyInfo.members.map(m => {
              const isSelected = selectedMember?.id === m.id;
              const memberColors = ['#5B7FA5', '#D4915A', '#C4554D', '#5A9E6F', '#8A7FB0'];
              const colorIdx = familyInfo.members.indexOf(m) % memberColors.length;
              const avatarColor = memberColors[colorIdx];
              return (
                <div key={m.id} onClick={() => setSelectedMember(m)} style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 6, cursor: 'pointer', padding: '10px 14px', borderRadius: 16,
                  background: isSelected ? '#F5F7FA' : 'transparent',
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: isSelected ? avatarColor : '#E5E5EA',
                    color: isSelected ? '#fff' : '#8E8E93',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17, fontWeight: 600,
                    boxShadow: isSelected ? `0 4px 12px ${avatarColor}40` : 'none',
                    transition: 'all 0.2s',
                  }}>
                    {(m.nickname || m.username || '?')[0]}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: isSelected ? 600 : 400, maxWidth: 56,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: isSelected ? '#1C1C1E' : '#8E8E93',
                  }}>
                    {m.nickname || m.username}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Selected member's tags */}
          {selectedMember && (
            <div>
              <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 10 }}>
                {selectedMember.nickname || selectedMember.username} 的标签
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {(selectedMember.tags || []).map(t => (
                  <span key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: '#F5F7FA', color: '#1C1C1E',
                    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    {t.tag_text}
                    <span onClick={() => deleteMemberTag(t.id)} style={{
                      fontSize: 11, color: '#C7C7CC', cursor: 'pointer', marginLeft: 4, fontWeight: 600,
                    }}>×</span>
                  </span>
                ))}
                {(selectedMember.tags || []).length === 0 && (
                  <span style={{ fontSize: 13, color: '#8E8E93' }}>暂无标签</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={memberTagInput} onChange={e => setMemberTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMemberTag()}
                  placeholder="添加标签，如：高血压，需定期服药"
                  style={{
                    flex: 1, border: '1px solid #E5E5EA', borderRadius: 12,
                    padding: '10px 14px', fontSize: 14, outline: 'none',
                    background: '#F5F7FA',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
                  }} />
                <div onClick={addMemberTag} style={{
                  background: '#1C1C1E', color: '#fff', border: 'none', borderRadius: 12,
                  padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 44,
                }}>添加</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MENU LIST — iOS Settings Style ===== */}
      <div style={{
        ...cardStyle, overflow: 'hidden',
        margin: '14px 20px 0',
        padding: 0,
      }}>
        {menuItems.map((item, i) => (
          <div key={i} onClick={item.action} style={{
            display: 'flex', alignItems: 'center', padding: '16px 20px',
            borderBottom: i < menuItems.length - 1 ? '0.5px solid #F2F2F7' : 'none',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#F9F9FB'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, marginRight: 14, flexShrink: 0,
            }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#1C1C1E' }}>{item.label}</div>
              <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{item.desc}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </div>
        ))}
      </div>

      {/* ===== LOGOUT — Apple Danger Button ===== */}
      <div style={{ margin: '20px 20px 0' }}>
        <div onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#FFF1F0', color: '#FF453A',
          padding: '14px 24px', borderRadius: 14,
          fontSize: 16, fontWeight: 600, cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          退出登录
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#C7C7CC', fontSize: 12, padding: '20px 0 40px' }}>
        家庭智能储物系统 v1.0
      </div>

      {/* QR Code Dialog */}
      {showQR && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowQR(false)}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '32px 24px 24px',
            width: 300, textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>扫码访问</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20 }}>用微信或浏览器扫描二维码</div>
            <div style={{
              background: '#F5F7FA', borderRadius: 16, padding: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(window.location.origin)}`}
                alt="访问二维码"
                style={{ width: 220, height: 220, display: 'block' }}
              />
            </div>
            <div style={{
              marginTop: 16, fontSize: 12, color: '#8E8E93',
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {window.location.origin}
            </div>
            <div onClick={() => {
              navigator.clipboard?.writeText(window.location.origin);
              Toast.show({ content: '链接已复制', position: 'center' });
            }} style={{
              marginTop: 16, background: '#1C1C1E', color: '#fff',
              padding: '12px 24px', borderRadius: 14, fontSize: 15,
              fontWeight: 600, cursor: 'pointer',
            }}>
              复制链接
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CapsuleTag({ label }) {
  return (
    <span style={{
      background: '#F2F2F7', padding: '6px 14px', borderRadius: 20,
      fontSize: 13, color: '#1C1C1E', fontWeight: 500,
    }}>
      {label}
    </span>
  );
}
