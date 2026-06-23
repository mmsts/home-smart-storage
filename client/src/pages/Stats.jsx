import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, Toast } from 'antd-mobile'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { stats } from '../api'
import { chartColors, typeColors, typeLabels, icons } from '../styles/theme'

const usageStatusConfig = {
  active: { label: '正在使用', color: '#5A9E6F', bg: '#F2F8F4' },
  inactive: { label: '近期未使用', color: '#CCCCCC', bg: '#F0F0F0' },
}

const tabConfig = [
  { key: 'medicine', label: '药箱', icon: '💊', color: typeColors.medicine },
  { key: 'daily', label: '日化', icon: '🧴', color: typeColors.daily },
  { key: 'custom', label: '自定义箱子', icon: '📦', color: typeColors.custom },
]

export default function Stats() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('medicine');

  useEffect(() => { stats.get({}).then(res => setData(res.data)).catch(() => {}); }, []);

  if (!data) return (
    <div>
      <NavBar onBack={() => navigate('/')} style={{ '--height': '48px', '--border-bottom': '1px solid var(--divider)' }}>数据统计</NavBar>
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-hint)', fontSize: 14 }}>加载中...</div>
    </div>
  );

  // Process category data by storage type
  const categoryByType = {};
  (data.categoryByStorageType || []).forEach(c => {
    if (!categoryByType[c.storage_type]) categoryByType[c.storage_type] = [];
    categoryByType[c.storage_type].push(c);
  });

  const currentCategories = categoryByType[activeTab] || [];
  const currentTotal = currentCategories.reduce((s, c) => s + c.count, 0);

  return (
    <div>
      <NavBar onBack={() => navigate('/')} style={{
        '--height': '48px', '--border-bottom': '1px solid var(--divider)',
      }}>数据统计</NavBar>

      {/* ===== SUMMARY ===== */}
      <div style={{ display: 'flex', gap: 10, padding: '16px', marginBottom: 8 }}>
        {[
          { value: data.itemCount || 0, label: '物品种类', color: 'var(--text-primary)' },
          { value: data.totalQuantity || 0, label: '物品总数', color: 'var(--text-primary)' },
          ...((data.expiredCount > 0 || data.expiringSoonCount > 0) ? [{
            value: data.expiredCount + data.expiringSoonCount, label: '需关注', color: '#C4554D'
          }] : []),
        ].map((item, i) => (
          <div key={i} style={{
            flex: 1, background: 'var(--bg-card)', borderRadius: 14, padding: '16px',
            textAlign: 'center', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* ===== CATEGORY BY STORAGE TYPE ===== */}
      <div style={{ padding: '0 16px', marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>物品分类</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {tabConfig.map(tab => (
            <div key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              flex: 1, padding: '10px 0', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
              background: activeTab === tab.key ? tab.color : 'var(--bg-card)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s ease',
            }}>
              <span style={{ marginRight: 4 }}>{tab.icon}</span>{tab.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 14, padding: '16px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {activeTab === 'custom' ? (
            // Custom modules list
            (data.customModules || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-hint)', fontSize: 14 }}>暂无自定义箱子</div>
            ) : (
              (data.customModules || []).map(mod => (
                <div key={mod.id} onClick={() => navigate(`/custom/${mod.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                  borderBottom: '1px solid var(--divider)', cursor: 'pointer',
                }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{mod.icon || '📦'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{mod.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>{mod.item_count || 0} 件物品</div>
                  </div>
                  <span style={{ color: 'var(--text-hint)', fontSize: 14 }}>›</span>
                </div>
              ))
            )
          ) : currentCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-hint)', fontSize: 14 }}>暂无数据</div>
          ) : (
            <>
              {/* Pie chart + legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={currentCategories} dataKey="count" nameKey="name"
                        cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
                        {currentCategories.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1 }}>
                  {currentCategories.map((cat, i) => (
                    <div key={i} onClick={() => navigate(`/items?category_id=${cat.category_id}`)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: chartColors[i % chartColors.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, flex: 1, color: 'var(--text-primary)' }}>{cat.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-hint)', fontWeight: 500 }}>{cat.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress bars */}
              <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
                {currentCategories.map((cat, i) => (
                  <div key={i} onClick={() => navigate(`/items?category_id=${cat.category_id}`)} style={{
                    display: 'flex', alignItems: 'center', marginBottom: 10, cursor: 'pointer',
                  }}>
                    <span style={{ width: 60, fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{cat.name}</span>
                    <div style={{ flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, marginLeft: 8 }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${Math.min(100, (cat.count / (currentTotal || 1)) * 100)}%`,
                        background: chartColors[i % chartColors.length],
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <span style={{ width: 30, textAlign: 'right', fontSize: 13, color: 'var(--text-hint)' }}>{cat.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== USAGE STATUS ===== */}
      <div style={{ padding: '0 16px', marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>物品使用状态</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { key: 'active', count: 0, quantity: 0 },
            { key: 'inactive', count: 0, quantity: 0 },
          ].map(defaultItem => {
            const item = (data.usageStatus || []).find(u => u.usage_key === defaultItem.key) || defaultItem;
            const cfg = usageStatusConfig[defaultItem.key];
            return (
              <div key={defaultItem.key} style={{
                flex: 1, background: cfg.bg, borderRadius: 14, padding: '18px 16px',
                textAlign: 'center', boxShadow: 'var(--shadow-sm)',
                border: `1px solid ${cfg.color}20`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: '0 auto 10px',
                  background: `${cfg.color}15`, color: cfg.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {defaultItem.key === 'active' ? icons.box : icons.warning}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{item.count}</div>
                <div style={{ fontSize: 13, color: 'var(--text-hint)', marginTop: 4, fontWeight: 500 }}>{cfg.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>共 {item.quantity} 件</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8, textAlign: 'center' }}>
          7天内有更新操作视为「正在使用」
        </div>
      </div>

      {/* ===== EXPIRING SOON ===== */}
      {data.expiringSoon?.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>即将过期物品</div>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 14, padding: '4px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            {data.expiringSoon.map(item => (
              <div key={item.id} onClick={() => navigate(`/items/${item.id}`)} style={{
                display: 'flex', alignItems: 'center', padding: '14px 0',
                borderBottom: '1px solid var(--divider)', cursor: 'pointer',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>{item.category_name || '未分类'}</div>
                </div>
                <div style={{ fontSize: 12, color: '#C4554D', fontWeight: 600 }}>{item.expiry_date}</div>
                <span style={{ color: 'var(--text-hint)', marginLeft: 8, fontSize: 14 }}>›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
