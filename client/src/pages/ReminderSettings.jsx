import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { families } from '../api'

const PRIORITY_OPTIONS = [
  { key: 'high', label: '高优先级', desc: '过期、紧急提醒', color: '#C4554D' },
  { key: 'medium', label: '中优先级', desc: '库存不足、季节提醒', color: '#D4915A' },
  { key: 'low', label: '低优先级', desc: '一般建议、收纳提示', color: '#5B7FA5' },
];

export default function ReminderSettings() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('all');
  const [priorityLevels, setPriorityLevels] = useState(['high', 'medium', 'low']);
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF', borderRadius: 24,
    boxShadow: appleShadow, border: 'none', padding: '20px',
  };

  useEffect(() => {
    // Load saved settings
    const raw = localStorage.getItem('reminderSettings');
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.mode) setMode(s.mode);
        if (s.priorityLevels) setPriorityLevels(s.priorityLevels);
        if (s.member_ids) setSelectedMembers(s.member_ids);
      } catch {}
    }
    // Load family members
    families.list().then(res => {
      if (res.data?.length > 0) {
        families.get(res.data[0].id).then(r => {
          setMembers(r.data?.members || []);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const save = () => {
    const settings = { mode, priorityLevels, member_ids: selectedMembers };
    localStorage.setItem('reminderSettings', JSON.stringify(settings));
    Toast.show({ icon: 'success', content: '设置已保存' });
    navigate(-1);
  };

  const togglePriority = (key) => {
    setPriorityLevels(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleMember = (id) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  };

  const modeOptions = [
    { key: 'all', label: '整个家庭', desc: '接收所有家庭成员的提醒' },
    { key: 'self', label: '仅自己', desc: '只接收与自己相关的提醒' },
    { key: 'members', label: '指定成员', desc: '选择接收哪些成员的提醒' },
  ];

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
            }}>设置</div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
              lineHeight: 1.1, color: '#1C1C1E', margin: 0,
            }}>提醒设置</h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Mode selection */}
        <div style={{ ...cardStyle, marginBottom: 14, padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px 0', fontSize: 13, fontWeight: 600, color: '#8E8E93',
            letterSpacing: '0.3px', textTransform: 'uppercase',
          }}>提醒范围</div>
          {modeOptions.map((opt, i) => (
            <div key={opt.key} onClick={() => setMode(opt.key)} style={{
              display: 'flex', alignItems: 'center', padding: '14px 20px',
              borderBottom: i < modeOptions.length - 1 ? '0.5px solid #F2F2F7' : 'none',
              cursor: 'pointer',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', border: '2px solid',
                borderColor: mode === opt.key ? '#1C1C1E' : '#E5E5EA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginRight: 12, flexShrink: 0,
              }}>
                {mode === opt.key && <div style={{
                  width: 12, height: 12, borderRadius: '50%', background: '#1C1C1E',
                }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#1C1C1E' }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{opt.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Member selection (shown when mode=members) */}
        {mode === 'members' && members.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 14,
              letterSpacing: '0.3px', textTransform: 'uppercase',
            }}>选择成员</div>
            {members.map((m, i) => (
              <div key={m.id} onClick={() => toggleMember(m.id)} style={{
                display: 'flex', alignItems: 'center', padding: '12px 0',
                borderBottom: i < members.length - 1 ? '0.5px solid #F2F2F7' : 'none',
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, border: '2px solid',
                  borderColor: selectedMembers.includes(m.id) ? '#1C1C1E' : '#E5E5EA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 12, flexShrink: 0, background: selectedMembers.includes(m.id) ? '#1C1C1E' : 'transparent',
                }}>
                  {selectedMembers.includes(m.id) && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#F5F7FA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 600, color: '#8E8E93', marginRight: 10,
                }}>
                  {(m.nickname || m.username || '?')[0]}
                </div>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>
                  {m.nickname || m.username}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Priority levels */}
        <div style={{ ...cardStyle, marginBottom: 14, padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px 0', fontSize: 13, fontWeight: 600, color: '#8E8E93',
            letterSpacing: '0.3px', textTransform: 'uppercase',
          }}>提醒优先级</div>
          {PRIORITY_OPTIONS.map((opt, i) => (
            <div key={opt.key} onClick={() => togglePriority(opt.key)} style={{
              display: 'flex', alignItems: 'center', padding: '14px 20px',
              borderBottom: i < PRIORITY_OPTIONS.length - 1 ? '0.5px solid #F2F2F7' : 'none',
              cursor: 'pointer',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, border: '2px solid',
                borderColor: priorityLevels.includes(opt.key) ? opt.color : '#E5E5EA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginRight: 12, flexShrink: 0,
                background: priorityLevels.includes(opt.key) ? opt.color : 'transparent',
              }}>
                {priorityLevels.includes(opt.key) && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#1C1C1E' }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{opt.desc}</div>
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: opt.color,
              }} />
            </div>
          ))}
        </div>

        {/* Save button */}
        <div onClick={save} style={{
          background: '#1C1C1E', color: '#fff', padding: '16px',
          borderRadius: 14, textAlign: 'center', fontSize: 16,
          fontWeight: 600, cursor: 'pointer', marginBottom: 40,
        }}>
          保存设置
        </div>
      </div>
    </div>
  );
}
