import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FloatingBubble, SwipeAction, Dialog, Toast, Checkbox, Button, Popup } from 'antd-mobile'
import { AddOutline } from 'antd-mobile-icons'
import { items as itemsApi, modules as modulesApi, boxes as boxesApi } from '../api'
import { statusMap, typeColors, typeColorsLight, icons } from '../styles/theme'
import ItemCard from '../components/ItemCard'

const defaultModules = [
  { key: 'medicine', name: '药箱', icon: '💊', color: typeColors.medicine, bg: `linear-gradient(145deg, ${typeColorsLight.medicine} 0%, ${typeColors.medicine}20 100%)`, type: 'builtin' },
  { key: 'daily', name: '日化', icon: '🧴', color: typeColors.daily, bg: `linear-gradient(145deg, ${typeColorsLight.daily} 0%, ${typeColors.daily}20 100%)`, type: 'builtin' },
];

export default function ItemsManagement() {
  const navigate = useNavigate();

  // Restore saved module from localStorage
  const savedModule = (() => {
    try {
      const saved = localStorage.getItem('lastModule');
      if (!saved) return null;
      const mod = JSON.parse(saved);
      // Fix old data: modules with 'key' but no 'type' are builtin
      if (mod && mod.key && !mod.type) mod.type = 'builtin';
      return mod;
    } catch { return null; }
  })();

  const [currentModule, setCurrentModule] = useState(savedModule);
  const [showPicker, setShowPicker] = useState(!savedModule);
  const [customModules, setCustomModules] = useState([]);
  const [items, setItems] = useState([]);
  const [allBoxes, setAllBoxes] = useState([]);

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showMovePopup, setShowMovePopup] = useState(false);
  const [overviewCollapsed, setOverviewCollapsed] = useState(() => {
    try { return localStorage.getItem('overviewCollapsed') === 'true'; } catch { return false; }
  });
  const [detailFilter, setDetailFilter] = useState(null); // { type, label, items }

  // 概览数据计算
  const overview = useMemo(() => {
    if (!items || items.length === 0) return null;
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    const statusCounts = {};
    items.forEach(i => {
      const s = i.status || 'in_use';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const catMap = {};
    items.forEach(i => {
      const name = i.category_name || '未分类';
      catMap[name] = (catMap[name] || 0) + (i.quantity || 1);
    });
    const topCategories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxCatQty = topCategories.length > 0 ? topCategories[0][1] : 1;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const expiringItems = items.filter(i => {
      if (!i.expiry_date || i.status !== 'in_use') return false;
      const d = new Date(i.expiry_date);
      return d >= now && d <= in30;
    });
    const expiredItems = items.filter(i => {
      if (!i.expiry_date) return false;
      return new Date(i.expiry_date) < now && i.status === 'in_use';
    });
    const lowStockItems = items.filter(i =>
      i.quantity <= 1 && i.status === 'in_use' && i.unit && i.unit !== '个'
    );
    return { totalQty, statusCounts, topCategories, maxCatQty, expiringItems, expiredItems, lowStockItems };
  }, [items]);

  const toggleOverview = () => {
    setOverviewCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('overviewCollapsed', String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    modulesApi.list().then(res => setCustomModules(res.data)).catch(() => {});
    boxesApi.list().then(res => setAllBoxes(res.data || [])).catch(() => {});
  }, []);

  // Save module selection to localStorage
  const selectModule = (mod) => {
    setCurrentModule(mod);
    setShowPicker(false);
    localStorage.setItem('lastModule', JSON.stringify(mod));
  };

  const getBoxId = (mod) => {
    if (!mod) return null;
    return mod.type === 'builtin' ? mod.key : `custom_${mod.id}`;
  };

  useEffect(() => {
    if (!currentModule) return;
    boxesApi.get(getBoxId(currentModule)).then(res => setItems(res.data?.items || [])).catch(() => {
      // 箱子不存在（404），清除旧数据，重新选择
      setCurrentModule(null);
      setShowPicker(true);
      localStorage.removeItem('lastModule');
      setItems([]);
    });
  }, [currentModule]);

  const refreshItems = () => {
    if (!currentModule) return;
    boxesApi.get(getBoxId(currentModule)).then(res => setItems(res.data?.items || [])).catch(() => {});
  };

  const handleDelete = async (id) => {
    const result = await Dialog.confirm({ content: '确定删除这个物品吗？' });
    if (result) {
      await itemsApi.delete(id);
      Toast.show({ icon: 'success', content: '删除成功' });
      refreshItems();
    }
  };

  // Batch operations
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
    setShowBatchActions(false);
  };

  const handleBatchDelete = async () => {
    const count = selectedIds.size;
    const result = await Dialog.confirm({ content: `确定删除选中的 ${count} 个物品？` });
    if (result) {
      await Promise.all([...selectedIds].map(id => itemsApi.delete(id)));
      Toast.show({ icon: 'success', content: `已删除 ${count} 个物品` });
      exitBatchMode();
      refreshItems();
    }
  };

  const handleBatchStatus = async (status) => {
    const count = selectedIds.size;
    const statusName = statusMap[status]?.text || status;
    const result = await Dialog.confirm({ content: `确定将选中的 ${count} 个物品状态改为「${statusName}」？` });
    if (result) {
      await Promise.all([...selectedIds].map(id => {
        const item = items.find(i => i.id === id);
        return itemsApi.update(id, { ...item, status });
      }));
      Toast.show({ icon: 'success', content: `已更新 ${count} 个物品` });
      exitBatchMode();
      refreshItems();
    }
  };

  const handleBatchMove = async (targetBoxId) => {
    const count = selectedIds.size;
    const targetBox = allBoxes.find(b => b.id === targetBoxId);
    const result = await Dialog.confirm({ content: `确定将选中的 ${count} 个物品移到「${targetBox?.name}」？` });
    if (result) {
      const isCustom = targetBoxId.startsWith('custom_');
      const moduleId = isCustom ? targetBox?.real_id : null;
      const storageType = isCustom ? 'custom' : targetBoxId;
      await Promise.all([...selectedIds].map(id => {
        const item = items.find(i => i.id === id);
        return itemsApi.update(id, { ...item, storage_type: storageType, module_id: moduleId });
      }));
      Toast.show({ icon: 'success', content: `已移动 ${count} 个物品` });
      setShowMovePopup(false);
      exitBatchMode();
      refreshItems();
    }
  };

  const allModules = [
    ...defaultModules.map(m => ({ ...m, type: 'builtin' })),
    ...customModules.map(m => ({ ...m, type: 'custom' })),
  ];

  const color = currentModule?.color || '#C4554D';
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: 24,
    boxShadow: appleShadow,
    border: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* Mode Picker Overlay */}
      {showPicker && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease'
        }} onClick={() => { if (currentModule) setShowPicker(false); }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '28px 20px 24px',
            width: '85%', maxWidth: 340, position: 'relative',
            animation: 'slideUp 0.3s ease',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E' }}>选择仓库</div>
              <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 4, fontWeight: 400 }}>进入对应仓库管理物品</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {defaultModules.map(m => (
                <div key={m.key} onClick={() => selectModule(m)}
                  style={{
                    background: m.bg, borderRadius: 20, padding: '16px 8px 12px',
                    textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s',
                    border: currentModule?.key === m.key ? `2px solid ${m.color}` : '2px solid transparent',
                    boxShadow: appleShadow
                  }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>{m.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.name}</div>
                </div>
              ))}
            </div>

            {customModules.length > 0 && (
              <>
                <div style={{
                  fontSize: 12, color: '#8E8E93', fontWeight: 600,
                  margin: '18px 0 10px', letterSpacing: '0.3px', textTransform: 'uppercase'
                }}>自定义仓库</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {customModules.map(m => (
                    <div key={m.id} onClick={() => selectModule({ ...m, type: 'custom' })}
                      style={{
                        background: `linear-gradient(145deg, ${m.color}18 0%, ${m.color}08 100%)`,
                        borderRadius: 20, padding: '16px 8px 12px',
                        textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s',
                        border: currentModule?.id === m.id ? `2px solid ${m.color}` : '2px solid transparent',
                        boxShadow: appleShadow
                      }}>
                      <div style={{ fontSize: 32, marginBottom: 6 }}>{m.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.name}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div onClick={() => setShowPicker(false)}
              style={{ textAlign: 'center', marginTop: 16, color: '#8E8E93', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              暂不选择，稍后查看
            </div>
          </div>
        </div>
      )}

      {/* Header — Hero style matching Home */}
      <div style={{
        margin: '-16px -16px 0',
        padding: '56px 28px 28px',
        background: '#F5F7FA',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end'
      }}>
        {/* Decorative illustration */}
        <svg style={{ position: 'absolute', top: 16, right: -10, opacity: 0.06, zIndex: 0 }} width="200" height="160" viewBox="0 0 200 160" fill="none" stroke="#1C1C1E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Stacked boxes */}
          <rect x="20" y="70" width="60" height="45" rx="4" />
          <path d="M20 70L50 55L80 70" />
          <line x1="50" y1="55" x2="50" y2="115" />
          <line x1="20" y1="90" x2="80" y2="90" />
          <circle cx="38" cy="80" r="3" />
          <circle cx="62" cy="80" r="3" />
          {/* Second box */}
          <rect x="85" y="85" width="55" height="40" rx="4" />
          <path d="M85 85L112 72L140 85" />
          <line x1="112" y1="72" x2="112" y2="125" />
          <line x1="85" y1="103" x2="140" y2="103" />
          {/* Small box on top */}
          <rect x="130" y="55" width="40" height="30" rx="3" />
          <path d="M130 55L150 42L170 55" />
          <line x1="150" y1="42" x2="150" y2="85" />
          {/* Tag/label */}
          <rect x="30" y="95" width="24" height="12" rx="2" />
          <line x1="36" y1="95" x2="36" y2="107" />
          {/* Items floating */}
          <circle cx="165" cy="120" r="8" strokeDasharray="3 3" />
          <rect x="10" y="120" width="15" height="15" rx="2" strokeDasharray="3 3" />
          {/* Checklist */}
          <rect x="150" y="105" width="35" height="30" rx="3" />
          <line x1="156" y1="114" x2="170" y2="114" />
          <line x1="156" y1="121" x2="167" y2="121" />
          <line x1="156" y1="128" x2="175" y2="128" />
        </svg>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 12, color: '#8E8E93', marginBottom: 10,
            letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600
          }}>
            物品管理
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{
                fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
                lineHeight: 1.15, marginBottom: 10, color: '#1C1C1E'
              }}>
                {currentModule?.name || '请选择仓库'}
              </h1>
              <p style={{
                fontSize: 15, color: '#8E8E93', lineHeight: 1.6, fontWeight: 400
              }}>
                {currentModule ? `${items.length} 种物品` : '选择一个仓库开始管理'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {currentModule && (
                <div onClick={() => { setBatchMode(!batchMode); if (batchMode) exitBatchMode(); }} style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: batchMode ? '#E8E9ED' : '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: appleShadow
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
              )}
              <div onClick={() => setShowPicker(true)} style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: appleShadow
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch mode toolbar */}
      {currentModule && batchMode && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', marginTop: 16, marginBottom: 14, ...cardStyle
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Checkbox checked={allSelected} onChange={toggleSelectAll} style={{ '--icon-size': '20px' }}>
              <span style={{ fontSize: 13 }}>全选</span>
            </Checkbox>
            <span style={{ fontSize: 13, color: '#8E8E93' }}>
              已选 {selectedIds.size} 项
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="mini" color="danger" fill="outline" onClick={handleBatchDelete}>删除</Button>
              <Button size="mini" color="warning" fill="outline" onClick={() => setShowBatchActions(!showBatchActions)}>状态</Button>
              <Button size="mini" color="primary" fill="outline" onClick={() => setShowMovePopup(true)}>移动</Button>
            </div>
          )}
        </div>
      )}

      {/* Batch status actions */}
      {currentModule && batchMode && showBatchActions && selectedIds.size > 0 && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, padding: '12px 16px',
          ...cardStyle
        }}>
          {Object.entries(statusMap).map(([key, val]) => (
            <span key={key} onClick={() => handleBatchStatus(key)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', background: '#fff', border: '1px solid #EEEEEE'
            }}>{val.text}</span>
          ))}
        </div>
      )}

      {/* Move popup */}
      <Popup visible={showMovePopup} onMaskClick={() => setShowMovePopup(false)} bodyStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 16px' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#1C1C1E' }}>移动到箱子</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {allBoxes.filter(b => currentModule?.type === 'builtin' ? b.id !== currentModule.key : b.id !== `custom_${currentModule?.id}`).map(b => (
            <div key={b.id} onClick={() => handleBatchMove(b.id)} style={{
              textAlign: 'center', padding: '16px 14px', borderRadius: 20, cursor: 'pointer',
              background: '#F5F7FA', border: '2px solid transparent', minWidth: 80,
              boxShadow: appleShadow
            }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{b.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93' }}>{b.name}</div>
            </div>
          ))}
        </div>
      </Popup>

      {/* Items Overview */}
      {currentModule && overview && (
        <div style={{
          ...cardStyle, marginTop: 16, marginBottom: 14, overflow: 'hidden', padding: 0
        }}>
          {/* Overview Header */}
          <div onClick={toggleOverview} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', cursor: 'pointer', userSelect: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, display: 'flex', color: '#8E8E93' }}>{icons.chart}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.3px', textTransform: 'uppercase' }}>物品概览</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"
              style={{
                transition: 'transform 0.3s ease',
                transform: overviewCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
              }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Overview Body */}
          <div style={{
            maxHeight: overviewCollapsed ? '0px' : '1200px',
            overflow: 'hidden',
            transition: 'max-height 0.35s ease',
          }}>
            <div style={{ padding: '0 16px 16px' }}>
              {/* Stat Row */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[
                  { label: '物品总数', value: overview.totalQty, unit: '件', text: '#1C1C1E' },
                  { label: '物品种类', value: items.length, unit: '种', text: '#1C1C1E' },
                  { label: '即将过期', value: overview.expiringItems.length + overview.expiredItems.length, unit: '件', text: overview.expiringItems.length + overview.expiredItems.length > 0 ? '#D63031' : '#1C1C1E' },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '14px 0',
                    background: '#F5F7FA', borderRadius: 20,
                  }}>
                    <div style={{
                      fontSize: 28, fontWeight: 700, lineHeight: 1, color: s.text
                    }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: 500 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Distribution */}
              {Object.keys(overview.statusCounts).length > 1 && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  {Object.entries(overview.statusCounts).map(([key, count]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: statusMap[key]?.color || '#8E8E93'
                      }} />
                      <span style={{ fontSize: 12, color: '#8E8E93' }}>
                        {statusMap[key]?.text || key} {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Category Distribution */}
              {overview.topCategories.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93', marginBottom: 8, letterSpacing: '0.3px', textTransform: 'uppercase' }}>分类分布</div>
                  {overview.topCategories.map(([name, qty], i) => {
                    const catItems = items.filter(it => (it.category_name || '未分类') === name);
                    return (
                      <div key={i} onClick={() => setDetailFilter({ type: 'category', label: name, items: catItems })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                          padding: '4px 6px', borderRadius: 8, cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#E8E9ED'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: 12, color: '#8E8E93', width: 56, flexShrink: 0, textAlign: 'right',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <div style={{ flex: 1, height: 6, background: '#F2F2F7', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(qty / overview.maxCatQty) * 100}%`, height: '100%',
                            background: '#C7C7CC',
                            borderRadius: 3, transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#8E8E93', width: 24, flexShrink: 0 }}>{qty}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="9 6 15 12 9 18" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alerts — matching Home's reminder card style */}
              {(overview.expiredItems.length > 0 || overview.expiringItems.length > 0 || overview.lowStockItems.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {overview.expiredItems.length > 0 && (
                    <div onClick={() => setDetailFilter({ type: 'expired', label: '已过期物品', items: overview.expiredItems })} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                      background: '#FFF1F0', borderRadius: 20, cursor: 'pointer',
                      boxShadow: appleShadow
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(255,255,255,0.8)', color: '#D63031',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0
                      }}>{icons.warning}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>已过期</div>
                        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3 }}>
                          {overview.expiredItems.length} 件物品已过期，请及时处理
                        </div>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.85)', color: '#D63031',
                        padding: '5px 12px', borderRadius: 20,
                        fontSize: 14, fontWeight: 700, flexShrink: 0,
                        minWidth: 28, textAlign: 'center'
                      }}>
                        {overview.expiredItems.length}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </div>
                  )}
                  {overview.expiringItems.length > 0 && (
                    <div onClick={() => setDetailFilter({ type: 'expiring', label: '即将过期物品', items: overview.expiringItems })} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                      background: '#FFF1F0', borderRadius: 20, cursor: 'pointer',
                      boxShadow: appleShadow
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(255,255,255,0.8)', color: '#E17A2D',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0
                      }}>{icons.bell}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>即将过期</div>
                        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3 }}>
                          {overview.expiringItems.length} 件物品将在 30 天内过期
                        </div>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.85)', color: '#E17A2D',
                        padding: '5px 12px', borderRadius: 20,
                        fontSize: 14, fontWeight: 700, flexShrink: 0,
                        minWidth: 28, textAlign: 'center'
                      }}>
                        {overview.expiringItems.length}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </div>
                  )}
                  {overview.lowStockItems.length > 0 && (
                    <div onClick={() => setDetailFilter({ type: 'lowStock', label: '库存不足物品', items: overview.lowStockItems })} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                      background: '#FFF1F0', borderRadius: 20, cursor: 'pointer',
                      boxShadow: appleShadow
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(255,255,255,0.8)', color: '#4A90E2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0
                      }}>{icons.box}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>需补货</div>
                        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3 }}>
                          {overview.lowStockItems.length} 件物品库存不足
                        </div>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.85)', color: '#4A90E2',
                        padding: '5px 12px', borderRadius: 20,
                        fontSize: 14, fontWeight: 700, flexShrink: 0,
                        minWidth: 28, textAlign: 'center'
                      }}>
                        {overview.lowStockItems.length}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Popup */}
      <Popup visible={!!detailFilter} onMaskClick={() => setDetailFilter(null)}
        bodyStyle={{
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: '0', maxHeight: '70vh', overflow: 'auto'
        }}>
        {detailFilter && (
          <div>
            {/* Popup Header */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 10, background: '#fff',
              padding: '18px 16px 12px', borderBottom: '1px solid #F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#fff', background: color,
                  padding: '2px 10px', borderRadius: 10
                }}>{detailFilter.items.length}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>{detailFilter.label}</span>
              </div>
              <div onClick={() => setDetailFilter(null)} style={{
                width: 30, height: 30, borderRadius: '50%', background: '#F2F2F7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>

            {/* Item List */}
            <div style={{ padding: '8px 16px 20px' }}>
              {detailFilter.items.map(item => (
                <div key={item.id} onClick={() => { setDetailFilter(null); navigate(`/items/${item.id}`); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 0', borderBottom: '1px solid #F9FAFB',
                    cursor: 'pointer', transition: 'opacity 0.15s'
                  }}>
                  {/* Status dot or thumbnail */}
                  {item.image ? (
                    <img src={item.image} alt="" style={{
                      width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0
                    }} />
                  ) : (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: statusMap[item.status]?.color || '#8E8E93'
                    }} />
                  )}
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1C1C1E', marginBottom: 2 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#8E8E93' }}>
                      {item.category_name || '未分类'}
                      {item.brand && ` · ${item.brand}`}
                      {item.quantity > 1 && ` · ${item.quantity}${item.unit || '个'}`}
                    </div>
                    {/* Expiry info for expired/expiring items */}
                    {detailFilter.type === 'expired' && item.expiry_date && (
                      <div style={{ fontSize: 11, color: '#D63031', marginTop: 2 }}>
                        过期于 {item.expiry_date}
                      </div>
                    )}
                    {detailFilter.type === 'expiring' && item.expiry_date && (
                      <div style={{ fontSize: 11, color: '#E17A2D', marginTop: 2 }}>
                        {item.expiry_date} 到期
                      </div>
                    )}
                    {/* Stock info for low stock items */}
                    {detailFilter.type === 'lowStock' && (
                      <div style={{ fontSize: 11, color: '#E17A2D', marginTop: 2 }}>
                        剩余 {item.quantity} {item.unit}
                      </div>
                    )}
                  </div>
                  {/* Right arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </div>
              ))}
              {detailFilter.items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#8E8E93', fontSize: 14 }}>
                  暂无相关物品
                </div>
              )}
            </div>
          </div>
        )}
      </Popup>

      {/* Items List */}
      {!currentModule ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px', marginTop: 16, ...cardStyle
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📦</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: '#1C1C1E' }}>请选择仓库</h3>
          <p style={{ color: '#8E8E93', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            点击右上角按钮选择要管理的仓库
          </p>
          <div onClick={() => setShowPicker(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1C1C1E',
            color: '#FFFFFF', padding: '10px 24px', borderRadius: 24, fontWeight: 600,
            fontSize: 14, cursor: 'pointer'
          }}>选择仓库</div>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px', ...cardStyle
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{currentModule.icon}</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: '#1C1C1E' }}>仓库是空的</h3>
          <p style={{ color: '#8E8E93', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            点击下方按钮添加第一个物品
          </p>
          <div onClick={() => {
            const params = currentModule.type === 'builtin' ? `type=${currentModule.key}` : `module=${currentModule.id}`;
            navigate(`/items/new?${params}`);
          }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1C1C1E',
            color: '#FFFFFF', padding: '10px 24px', borderRadius: 24, fontWeight: 600,
            fontSize: 14, cursor: 'pointer'
          }}>+ 添加物品</div>
        </div>
      ) : (
        <div style={{ padding: '0 0 14px', marginTop: 16 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 14,
            letterSpacing: '0.3px', textTransform: 'uppercase', padding: '0 20px'
          }}>
            物品列表
          </div>
          {/* Add item button */}
          <div style={{ padding: '0 20px', marginBottom: 14 }}>
            <div onClick={() => {
              const params = currentModule.type === 'builtin' ? `type=${currentModule.key}` : `module=${currentModule.id}`;
              navigate(`/items/new?${params}`);
            }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '14px 20px', borderRadius: 20, cursor: 'pointer',
              background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}>
              <span style={{ fontSize: 18, color: '#8E8E93', lineHeight: 1, fontWeight: 300 }}>+</span>
              <span style={{ fontSize: 14, color: '#8E8E93', fontWeight: 500 }}>添加物品</span>
            </div>
          </div>
          <div style={{ padding: '0 20px' }}>
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              color={color}
              batchMode={batchMode}
              selected={selectedIds.has(item.id)}
              onSelect={() => toggleSelect(item.id)}
              onDelete={handleDelete}
              showSwipeDelete={!batchMode}
              onQuantityUpdate={() => refreshItems()}
            />
          ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
