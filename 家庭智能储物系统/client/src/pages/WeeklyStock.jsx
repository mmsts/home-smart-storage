import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { reminders } from '../api'
import { getReminderParams } from '../utils/reminderParams'

export default function WeeklyStock() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF', borderRadius: 24,
    boxShadow: appleShadow, border: 'none', padding: '20px',
  };

  useEffect(() => {
    const params = getReminderParams();
    reminders.weeklyStock(params).then(res => {
      setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
            }}>报告</div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
              lineHeight: 1.1, color: '#1C1C1E', margin: 0,
            }}>每周库存</h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8E8E93' }}>加载中...</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8E8E93' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>暂无库存数据</div>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div style={{ ...cardStyle, marginBottom: 14 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 14,
                letterSpacing: '0.3px', textTransform: 'uppercase',
              }}>本周概览</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  flex: 1, textAlign: 'center', padding: '14px 0',
                  background: '#F5F7FA', borderRadius: 20,
                }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E' }}>{data.totalItems || 0}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: 500 }}>总物品</div>
                </div>
                <div style={{
                  flex: 1, textAlign: 'center', padding: '14px 0',
                  background: '#FDF5F3', borderRadius: 20,
                }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#C4554D' }}>{data.expiringCount || 0}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: 500 }}>即将过期</div>
                </div>
                <div style={{
                  flex: 1, textAlign: 'center', padding: '14px 0',
                  background: '#F2F8F4', borderRadius: 20,
                }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#5A9E6F' }}>{data.healthyCount || 0}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: 500 }}>状态良好</div>
                </div>
              </div>
            </div>

            {/* Details */}
            {data.categories && data.categories.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 20 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 14,
                  letterSpacing: '0.3px', textTransform: 'uppercase',
                }}>分类统计</div>
                {data.categories.map((cat, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: i < data.categories.length - 1 ? '0.5px solid #F2F2F7' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{cat.icon || '📦'}</span>
                      <span style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>{cat.name}</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#8E8E93' }}>{cat.count}件</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
