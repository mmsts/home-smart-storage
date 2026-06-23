import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { reminders } from '../api'
import { getReminderParams } from '../utils/reminderParams'
import { icons } from '../styles/theme'

const typeIcons = {
  expiry: '⏰', medicine: '💊', daily: '🧴', general: '📋',
  shopping: '🛒', stock: '📦', health: '❤️',
}

const typeColors = {
  expiry: '#C4554D', medicine: '#C4554D', daily: '#5A9E6F',
  general: '#5B7FA5', shopping: '#D4915A', stock: '#D4915A', health: '#C4554D',
}

export default function Reminders() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF', borderRadius: 24,
    boxShadow: appleShadow, border: 'none',
  };

  useEffect(() => {
    const params = getReminderParams();
    reminders.list(params).then(res => {
      setList(res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDismiss = async (id) => {
    try {
      await reminders.dismiss(id);
      setList(prev => prev.map(r => r.id === id ? { ...r, is_dismissed: 1 } : r));
      Toast.show({ icon: 'success', content: '已忽略' });
    } catch {
      Toast.show({ content: '操作失败' });
    }
  };

  const filteredList = filter === 'all'
    ? list.filter(r => !r.is_dismissed)
    : list.filter(r => !r.is_dismissed && r.type === filter);

  const types = ['all', ...new Set(list.map(r => r.type).filter(Boolean))];

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* Header */}
      <div style={{
        margin: '-16px -16px 0', padding: '56px 28px 24px', background: '#F5F7FA',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
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
            }}>提醒</div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
              lineHeight: 1.1, color: '#1C1C1E', margin: 0,
            }}>提醒中心</h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto',
          scrollbarWidth: 'none', paddingBottom: 4,
        }}>
          {types.map(t => (
            <div key={t} onClick={() => setFilter(t)} style={{
              flexShrink: 0, padding: '8px 16px', borderRadius: 20,
              background: filter === t ? '#1C1C1E' : '#FFFFFF',
              color: filter === t ? '#FFFFFF' : '#8E8E93',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: filter === t ? 'none' : appleShadow,
              transition: 'all 0.2s',
            }}>
              {t === 'all' ? '全部' : (typeIcons[t] || '📋') + ' ' + t}
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8E8E93' }}>加载中...</div>
        ) : filteredList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8E8E93' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>暂无提醒</div>
          </div>
        ) : (
          <div style={{ ...cardStyle, overflow: 'hidden', marginBottom: 20 }}>
            {filteredList.map((item, i) => (
              <div key={item.id} style={{
                padding: '16px 20px',
                borderBottom: i < filteredList.length - 1 ? '0.5px solid #F2F2F7' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: (typeColors[item.type] || '#8E8E93') + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {typeIcons[item.type] || '📋'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#1C1C1E', marginBottom: 4 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
                      {item.content}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#C7C7CC' }}>
                        {item.created_at?.slice(0, 16)}
                      </span>
                      <span onClick={() => handleDismiss(item.id)} style={{
                        fontSize: 12, color: '#8E8E93', cursor: 'pointer',
                        padding: '4px 12px', borderRadius: 12, background: '#F5F7FA',
                      }}>忽略</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
