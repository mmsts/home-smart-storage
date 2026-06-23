import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Dialog, Toast } from 'antd-mobile'
import { stats, boxes as boxesApi, families, reminders } from '../api'
import { getReminderParams, getPriorityLevels, getDisplaySettings } from '../utils/reminderParams'
import { icons, illustrations } from '../styles/theme'

const DEFAULT_MODULE_ORDER = ['actions', 'boxes', 'reminders', 'summary', 'family'];

export default function Home() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [allBoxes, setAllBoxes] = useState([]);
  const [familyInfo, setFamilyInfo] = useState(null);
  const [familyCollapsed, setFamilyCollapsed] = useState(false);
  const [realtimeReminders, setRealtimeReminders] = useState(null);
  const [healthReminders, setHealthReminders] = useState(null);
  const [showHealthDetail, setShowHealthDetail] = useState(null);
  const [aiHealthReminders, setAiHealthReminders] = useState(null);
  const [aiHealthLoading, setAiHealthLoading] = useState(false);
  const [showAiDetail, setShowAiDetail] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  // 拖拽状态
  const [draggingKey, setDraggingKey] = useState(null);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const longPressTimer = useRef(null);
  const moduleRefs = useRef({});
  const containerRef = useRef(null);
  const [moduleOrder, setModuleOrder] = useState(() => {
    const raw = localStorage.getItem('homeModuleOrder');
    if (raw) { try { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length > 0) return arr; } catch {} }
    return DEFAULT_MODULE_ORDER;
  });

  const [currentFamilyId, setCurrentFamilyId] = useState(null);

  useEffect(() => {
    stats.get({}).then(res => setData(res.data)).catch(() => {});
    boxesApi.listHome().then(res => setAllBoxes(res.data || [])).catch(() => {});
    families.list().then(res => {
      if (res.data?.length > 0) {
        const fid = res.data[0].id;
        setCurrentFamilyId(fid);
        families.get(fid).then(r => setFamilyInfo(r.data)).catch(() => {});
        const params = getReminderParams(fid);
        reminders.realtime(params).then(res => setRealtimeReminders(res.data)).catch(() => {});
        reminders.health(params).then(res => setHealthReminders(res.data)).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const fetchAiHealthReminders = async () => {
    if (aiHealthLoading) return;
    setAiHealthLoading(true);
    try {
      const params = currentFamilyId ? getReminderParams(currentFamilyId) : {};
      const res = await reminders.healthAI(params);
      setAiHealthReminders(res.data);
    } catch (e) {
      Toast.show({ icon: 'fail', content: 'AI 分析失败，请稍后重试' });
    } finally {
      setAiHealthLoading(false);
    }
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // 全局鼠标/触摸事件监听 - 移到所有 handler 定义之后
  const handlersRef = useRef({});


  const handleDeleteBox = async (box) => {
    const result = await Dialog.confirm({ content: `删除箱子「${box.name}」？箱内物品不会被删除。` });
    if (result) {
      await boxesApi.delete(box.id);
      Toast.show({ icon: 'success', content: '已删除' });
      boxesApi.listHome().then(res => setAllBoxes(res.data || [])).catch(() => {});
    }
  };

  const saveModuleOrder = useCallback((order) => {
    setModuleOrder(order);
    localStorage.setItem('homeModuleOrder', JSON.stringify(order));
  }, []);

  const resetModuleOrder = () => {
    saveModuleOrder(DEFAULT_MODULE_ORDER);
    setEditMode(false);
    setDraggingKey(null);
  };

  // 获取所有模块的 DOM 位置
  const getModulePositions = useCallback(() => {
    const positions = [];
    for (const key of moduleOrder) {
      const el = moduleRefs.current[key];
      if (el) {
        const rect = el.getBoundingClientRect();
        positions.push({ key, top: rect.top, height: rect.height, centerY: rect.top + rect.height / 2 });
      }
    }
    return positions;
  }, [moduleOrder]);

  // 根据 Y 坐标找到目标模块索引
  const findTargetIndex = useCallback((y) => {
    const positions = getModulePositions();
    for (let i = 0; i < positions.length; i++) {
      if (y < positions[i].centerY) return i;
    }
    return positions.length - 1;
  }, [getModulePositions]);

  // 长按开始
  const handleTouchStart = useCallback((key, e) => {
    if (!editMode) return;
    const touch = e.touches[0];
    const el = moduleRefs.current[key];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetY = touch.clientY - rect.top;

    // 清除之前的定时器
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      setDraggingKey(key);
      setDragOffsetY(offsetY);
      setDragCurrentY(touch.clientY);
      // 震动反馈（如果支持）
      if (navigator.vibrate) navigator.vibrate(30);
    }, 300);
  }, [editMode]);

  // 拖拽移动
  const handleTouchMove = useCallback((e) => {
    if (!draggingKey) {
      // 如果还没触发拖拽但手指移动了，取消长按
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    setDragCurrentY(touch.clientY);

    // 计算目标位置并交换
    const targetIdx = findTargetIndex(touch.clientY - dragOffsetY + 50);
    const currentIdx = moduleOrder.indexOf(draggingKey);
    if (targetIdx !== currentIdx && targetIdx >= 0 && targetIdx < moduleOrder.length) {
      const next = [...moduleOrder];
      const [removed] = next.splice(currentIdx, 1);
      next.splice(targetIdx, 0, removed);
      saveModuleOrder(next);
    }
  }, [draggingKey, dragOffsetY, moduleOrder, findTargetIndex, saveModuleOrder]);

  // 拖拽结束
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setDraggingKey(null);
    setDragCurrentY(0);
    setDragOffsetY(0);
  }, []);

  // 鼠标版本（桌面端支持）
  const handleMouseDown = useCallback((key, e) => {
    if (!editMode) return;
    const el = moduleRefs.current[key];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;

    longPressTimer.current = setTimeout(() => {
      setDraggingKey(key);
      setDragOffsetY(offsetY);
      setDragCurrentY(e.clientY);
    }, 300);
  }, [editMode]);

  const handleMouseMove = useCallback((e) => {
    if (!draggingKey) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }
    e.preventDefault();
    setDragCurrentY(e.clientY);

    const targetIdx = findTargetIndex(e.clientY - dragOffsetY + 50);
    const currentIdx = moduleOrder.indexOf(draggingKey);
    if (targetIdx !== currentIdx && targetIdx >= 0 && targetIdx < moduleOrder.length) {
      const next = [...moduleOrder];
      const [removed] = next.splice(currentIdx, 1);
      next.splice(targetIdx, 0, removed);
      saveModuleOrder(next);
    }
  }, [draggingKey, dragOffsetY, moduleOrder, findTargetIndex, saveModuleOrder]);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setDraggingKey(null);
    setDragCurrentY(0);
    setDragOffsetY(0);
  }, []);

  // 更新 ref 并注册全局事件监听
  handlersRef.current = { handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd };
  useEffect(() => {
    if (!draggingKey) return;
    const moveHandler = (e) => handlersRef.current.handleMouseMove(e);
    const upHandler = () => handlersRef.current.handleMouseUp();
    const touchMoveHandler = (e) => handlersRef.current.handleTouchMove(e);
    const touchEndHandler = () => handlersRef.current.handleTouchEnd();
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler);
    return () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('touchend', touchEndHandler);
    };
  }, [draggingKey]);

  const quickActions = [
    { icon: icons.medicine, label: '药品', action: () => navigate('/items/new?type=medicine') },
    { icon: icons.daily, label: '日化', action: () => navigate('/items/new?type=daily') },
    { icon: icons.box, label: '物品', action: () => navigate('/items/new') },
  ];

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: 24,
    boxShadow: appleShadow,
    border: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', userSelect: editMode ? 'none' : 'auto', WebkitUserSelect: editMode ? 'none' : 'auto', touchAction: editMode ? 'none' : 'auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* ===== HERO ===== */}
      <div style={{
        margin: '-16px -16px 0',
        padding: '56px 28px 44px',
        background: '#F5F7FA',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '30vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end'
      }}>
        <svg style={{ position: 'absolute', top: 20, right: -10, opacity: 0.06, zIndex: 0 }} width="220" height="180" viewBox="0 0 220 180" fill="none" stroke="#1C1C1E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M30 100L100 45L170 100" />
          <rect x="40" y="100" width="120" height="60" rx="2" />
          <rect x="85" y="115" width="30" height="45" rx="1" />
          <circle cx="100" cy="138" r="2" fill="#1C1C1E" />
          <rect x="52" y="110" width="20" height="16" rx="2" />
          <line x1="62" y1="110" x2="62" y2="126" />
          <line x1="52" y1="118" x2="72" y2="118" />
          <rect x="140" y="110" width="20" height="16" rx="2" />
          <line x1="150" y1="110" x2="150" y2="126" />
          <line x1="140" y1="118" x2="160" y2="126" />
          <rect x="15" y="130" width="22" height="18" rx="3" />
          <line x1="15" y1="136" x2="37" y2="136" />
          <rect x="175" y="135" width="22" height="18" rx="3" />
          <line x1="175" y1="141" x2="197" y2="141" />
          <circle cx="185" cy="30" r="10" />
          <line x1="185" y1="14" x2="185" y2="19" />
          <line x1="185" y1="41" x2="185" y2="46" />
          <line x1="169" y1="30" x2="174" y2="30" />
          <line x1="196" y1="30" x2="201" y2="30" />
          <path d="M20 35C23 28 30 28 33 35" />
          <path d="M40 28C43 21 50 21 53 28" />
        </svg>
        <div onClick={() => setEditMode(!editMode)} style={{
          position: 'absolute', top: 16, right: 16, zIndex: 2,
          width: 36, height: 36, borderRadius: 12,
          background: editMode ? '#4A90E2' : 'rgba(142,142,147,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease',
        }}>
          {editMode ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          )}
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 12, color: '#8E8E93', marginBottom: 10,
            letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600
          }}>
            {new Date().getHours() < 12 ? 'GOOD MORNING' : new Date().getHours() < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'}
          </div>
          <h1 style={{
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
            lineHeight: 1.15, marginBottom: 10, color: '#1C1C1E'
          }}>
            {user.nickname || user.username || '你好'}
          </h1>
          <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.6, fontWeight: 400 }}>
            家有归处，心有余裕
          </p>
        </div>
      </div>

      {/* ===== MODULES (reorderable) ===== */}
      {(() => {
        // 拖拽手柄 SVG
        const dragHandle = (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="9" cy="6" r="1.5" fill="#C7C7CC" stroke="none" />
            <circle cx="15" cy="6" r="1.5" fill="#C7C7CC" stroke="none" />
            <circle cx="9" cy="12" r="1.5" fill="#C7C7CC" stroke="none" />
            <circle cx="15" cy="12" r="1.5" fill="#C7C7CC" stroke="none" />
            <circle cx="9" cy="18" r="1.5" fill="#C7C7CC" stroke="none" />
            <circle cx="15" cy="18" r="1.5" fill="#C7C7CC" stroke="none" />
          </svg>
        );

        const Wrap = ({ moduleKey, children }) => {
          const isDragging = draggingKey === moduleKey;
          return (
            <div
              ref={el => { moduleRefs.current[moduleKey] = el; }}
              style={{
                position: 'relative',
                transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                opacity: isDragging ? 0.3 : 1,
                ...(isDragging ? { border: '2px dashed #4A90E2', borderRadius: 24, margin: '0 0 8px' } : {}),
              }}
              onTouchStart={(e) => handleTouchStart(moduleKey, e)}
              onMouseDown={(e) => handleMouseDown(moduleKey, e)}
              onClick={(e) => { if (editMode) e.stopPropagation(); }}
            >
              {children}
              {editMode && !isDragging && (
                <div style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 10,
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(142,142,147,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'grab',
                }}>
                  {dragHandle}
                </div>
              )}
            </div>
          );
        };

        const modules = {
          actions: (
            <Wrap key="actions" moduleKey="actions">
              <div style={{ padding: '0 20px', marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 12, letterSpacing: '0.3px', textTransform: 'uppercase' }}>添加物品</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { ...quickActions[0], color: '#4A90E2' },
                    { ...quickActions[1], color: '#E8943A' },
                    { ...quickActions[2], color: '#E25D6A' },
                  ].map((a, i) => (
                    <div key={i} onClick={a.action} style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                      padding: '20px 0 14px', background: '#FFFFFF', borderRadius: 20,
                      cursor: 'pointer', boxShadow: appleShadow,
                      transition: 'transform 0.2s ease',
                      position: 'relative',
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                        <span style={{ fontSize: 18, color: a.color, display: 'flex' }}>{a.icon}</span>
                        <span style={{ fontSize: 15, color: a.color, fontWeight: 500 }}>{a.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Wrap>
          ),

          boxes: (
            <Wrap key="boxes" moduleKey="boxes">
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0 20px', marginBottom: 14
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.3px', textTransform: 'uppercase' }}>储物箱</div>
                  <span onClick={() => navigate('/modules')}
                    style={{ fontSize: 14, color: '#4A90E2', cursor: 'pointer', fontWeight: 500 }}>
                    全部 ›
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 20, paddingRight: 20 }}>
                  <div style={{ ...cardStyle, overflow: 'hidden' }}>
                    {allBoxes.slice(0, 6).map((box, idx) => {
                      const navigateTo = box.is_builtin ? `/storage/${box.id}` : `/boxes/${box.id}`;
                      return (
                        <div key={box.id} onClick={() => navigate(navigateTo)} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '16px 20px', cursor: 'pointer',
                          position: 'relative',
                          borderBottom: idx < Math.min(allBoxes.length, 6) - 1 ? '0.5px solid #F2F2F7' : 'none'
                        }}>
                          {!box.is_builtin && (
                            <span onClick={(e) => { e.stopPropagation(); handleDeleteBox(box); }}
                              style={{
                                position: 'absolute', top: 10, right: 14, width: 20, height: 20,
                                borderRadius: '50%', background: '#F2F2F7',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: 10, color: '#8E8E93', lineHeight: 1
                              }}>✕</span>
                          )}
                          <div style={{
                            fontSize: 26, flexShrink: 0, width: 44, height: 44,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#F5F7FA', borderRadius: 14
                          }}>{box.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 17, fontWeight: 600, color: '#1C1C1E' }}>{box.name}</div>
                            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3 }}>{box.item_count || 0} 种物品</div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="9 6 15 12 9 18" />
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                  <div onClick={() => navigate('/modules')} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '14px 20px', borderRadius: 20, cursor: 'pointer',
                    ...cardStyle, marginTop: 10
                  }}>
                    <span style={{ fontSize: 18, color: '#8E8E93', lineHeight: 1, fontWeight: 300 }}>+</span>
                    <span style={{ fontSize: 14, color: '#8E8E93', fontWeight: 500 }}>添加储物箱</span>
                  </div>
                </div>
              </div>
            </Wrap>
          ),

          reminders: (
            <Wrap key="reminders" moduleKey="reminders">
              {(realtimeReminders || healthReminders || aiHealthReminders) && (() => {
                const allowedPriorities = getPriorityLevels();
                const filteredMedicine = (healthReminders?.medicine || []).filter(r => allowedPriorities.includes(r.priority));
                const filteredDaily = (healthReminders?.daily || []).filter(r => allowedPriorities.includes(r.priority));
                const expiredCount = realtimeReminders?.expired?.length || 0;
                const expiringSoonCount = realtimeReminders?.expiringSoon?.length || 0;
                const lowStockCount = realtimeReminders?.lowStock?.length || 0;
                const medicineCount = filteredMedicine.length;
                const dailyCount = filteredDaily.length;
                const aiMedicineCount = aiHealthReminders?.medicine?.length || 0;
                const aiDailyCount = aiHealthReminders?.daily?.length || 0;
                const total = expiredCount + expiringSoonCount + lowStockCount + medicineCount + dailyCount + aiMedicineCount + aiDailyCount;
                if (total === 0) return null;

                const displaySettings = getDisplaySettings();
                const reminderItems = [
                  { key: 'expired', settingKey: 'showExpired', label: '已过期', count: expiredCount, color: '#D63031', bg: '#FFFFFF', icon: icons.warning, desc: `${expiredCount} 件物品已过期，请及时处理`, action: () => navigate('/reminders?type=expired') },
                  { key: 'expiringSoon', settingKey: 'showExpiringSoon', label: '即将过期', count: expiringSoonCount, color: '#E17A2D', bg: '#FFFFFF', icon: icons.bell, desc: `${expiringSoonCount} 件物品即将过期`, action: () => navigate('/reminders?type=expiringSoon') },
                  { key: 'lowStock', settingKey: 'showLowStock', label: '需补货', count: lowStockCount, color: '#4A90E2', bg: '#FFFFFF', icon: icons.box, desc: `${lowStockCount} 件物品库存不足`, action: () => navigate('/reminders?type=lowStock') },
                ].filter(i => i.count > 0 && displaySettings[i.settingKey]);

                if (medicineCount > 0) {
                  const firstTip = filteredMedicine[0];
                  reminderItems.push({ key: 'medicine', label: '用药提醒', count: medicineCount, color: '#E25D6A', bg: '#FFFFFF', icon: <span style={{ fontSize: 20 }}>💊</span>, desc: firstTip.content.length > 20 ? firstTip.content.slice(0, 20) + '...' : firstTip.content, action: () => setShowHealthDetail('medicine') });
                }
                if (dailyCount > 0) {
                  const firstTip = filteredDaily[0];
                  reminderItems.push({ key: 'daily', label: '日化提醒', count: dailyCount, color: '#52c41a', bg: '#FFFFFF', icon: <span style={{ fontSize: 20 }}>🧴</span>, desc: firstTip.content.length > 20 ? firstTip.content.slice(0, 20) + '...' : firstTip.content, action: () => setShowHealthDetail('daily') });
                }

                return (
                  <div style={{ padding: '0 20px', marginBottom: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.3px', textTransform: 'uppercase' }}>提醒</div>
                      <div style={{ fontSize: 13, color: '#8E8E93', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                        <span style={{ fontSize: 14, display: 'flex' }}>{icons.bell}</span>
                        <span>{total} 项待处理</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {reminderItems.map(item => (
                        <div key={item.key} onClick={item.action} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '16px 20px', background: item.bg, borderRadius: 20,
                          cursor: 'pointer', boxShadow: appleShadow
                        }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F5F7FA', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>{item.label}</div>
                            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.desc}</div>
                          </div>
                          <div style={{ background: '#F5F7FA', color: item.color, padding: '5px 12px', borderRadius: 20, fontSize: 14, fontWeight: 700, flexShrink: 0, minWidth: 28, textAlign: 'center' }}>{item.count}</div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
                        </div>
                      ))}
                      {/* AI 生成的提醒卡片 */}
                      {aiHealthReminders?.medicine?.length > 0 && (
                        <div onClick={() => setShowAiDetail('medicine')} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '16px 20px', background: '#FFFFFF', borderRadius: 20,
                          cursor: 'pointer', boxShadow: appleShadow, border: '1px solid #F0F4FF'
                        }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✨</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>AI 用药提醒</span>
                              <span style={{ background: '#F0F4FF', color: '#4A90E2', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>AI</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {aiHealthReminders.medicine[0].content.length > 20 ? aiHealthReminders.medicine[0].content.slice(0, 20) + '...' : aiHealthReminders.medicine[0].content}
                            </div>
                          </div>
                          <div style={{ background: '#F0F4FF', color: '#4A90E2', padding: '5px 12px', borderRadius: 20, fontSize: 14, fontWeight: 700, flexShrink: 0, minWidth: 28, textAlign: 'center' }}>{aiHealthReminders.medicine.length}</div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
                        </div>
                      )}
                      {aiHealthReminders?.daily?.length > 0 && (
                        <div onClick={() => setShowAiDetail('daily')} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '16px 20px', background: '#FFFFFF', borderRadius: 20,
                          cursor: 'pointer', boxShadow: appleShadow, border: '1px solid #F0F4FF'
                        }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✨</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>AI 日化提醒</span>
                              <span style={{ background: '#F0F4FF', color: '#4A90E2', padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>AI</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {aiHealthReminders.daily[0].content.length > 20 ? aiHealthReminders.daily[0].content.slice(0, 20) + '...' : aiHealthReminders.daily[0].content}
                            </div>
                          </div>
                          <div style={{ background: '#F0F4FF', color: '#4A90E2', padding: '5px 12px', borderRadius: 20, fontSize: 14, fontWeight: 700, flexShrink: 0, minWidth: 28, textAlign: 'center' }}>{aiHealthReminders.daily.length}</div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
                        </div>
                      )}
                    </div>
                    {/* AI 智能提醒按钮 */}
                    <div onClick={fetchAiHealthReminders} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '14px 20px', borderRadius: 20, cursor: 'pointer',
                      background: aiHealthLoading ? '#F0F4FF' : '#FFFFFF',
                      boxShadow: appleShadow, marginTop: 10,
                      border: aiHealthLoading ? '1px solid #4A90E2' : 'none',
                    }}>
                      {aiHealthLoading ? (
                        <div style={{ width: 18, height: 18, border: '2px solid #C7C7CC', borderTopColor: '#4A90E2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <span style={{ fontSize: 18, display: 'flex' }}>✨</span>
                      )}
                      <span style={{ fontSize: 14, color: '#4A90E2', fontWeight: 600 }}>{aiHealthLoading ? 'AI 正在分析，请稍候...' : 'AI 智能提醒'}</span>
                    </div>
                  </div>
                );
              })()}
            </Wrap>
          ),

          summary: (
            <Wrap key="summary" moduleKey="summary">
              <div style={{ padding: '0 20px', marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 14, letterSpacing: '0.3px', textTransform: 'uppercase' }}>物品汇总</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div onClick={() => navigate('/weekly-stock')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 12px', ...cardStyle, cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: '#F5F7FA', color: '#4A90E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icons.chart}</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', textAlign: 'center' }}>每周盘点</div>
                  </div>
                  {data && (
                    <div onClick={() => navigate('/stats')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 12px', ...cardStyle, cursor: 'pointer' }}>
                      <div style={{ fontSize: 36, fontWeight: 700, color: '#1C1C1E', lineHeight: 1 }}>{data.itemCount || 0}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#8E8E93' }}>种物品</div>
                      <div style={{ fontSize: 13, color: '#8E8E93' }}>
                        共 {data.totalQuantity || 0} 件
                        {(data.expiredCount > 0 || data.expiringSoonCount > 0) && (
                          <span style={{ color: '#D63031', marginLeft: 6 }}>{data.expiredCount + data.expiringSoonCount} 需关注</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Wrap>
          ),

          family: (
            <Wrap key="family" moduleKey="family">
              {familyInfo && (() => {
                const memberColorSets = [
                  { bg: '#FFFFFF', avatar: '#DCE4FF', text: '#3A5BA0', accent: '#4A6FD8', light: '#8B9FCC' },
                  { bg: '#FFFFFF', avatar: '#FFE8D6', text: '#A06B3A', accent: '#D8894A', light: '#CCAB8B' },
                  { bg: '#FFFFFF', avatar: '#FFD6E5', text: '#A03A5E', accent: '#D84A7E', light: '#CC8BA3' },
                ];
                const getMemberColor = (index) => memberColorSets[index % memberColorSets.length];

                return (
                  <div style={{ ...cardStyle, padding: '20px', margin: '0 20px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                      <div onClick={() => navigate(`/families/${familyInfo.id}`)} style={{ cursor: 'pointer', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 22, color: '#8E8E93', display: 'flex' }}>{icons.family}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 17, color: '#1C1C1E' }}>{familyInfo.name}</div>
                            {familyInfo.address && <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3 }}>{familyInfo.address}</div>}
                          </div>
                        </div>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); setFamilyCollapsed(!familyCollapsed); }} style={{ width: 32, height: 32, borderRadius: 10, background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'transform 0.2s ease', transform: familyCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                      </div>
                    </div>

                    {!familyCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                        {(familyInfo.members || []).map((m, idx) => {
                          const mc = getMemberColor(idx);
                          return (
                            <div key={m.id} onClick={() => navigate(`/members/${m.id}/items`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: mc.bg, borderRadius: 20, cursor: 'pointer', boxShadow: appleShadow }}>
                              <div style={{ width: 44, height: 44, borderRadius: '50%', background: mc.avatar, color: mc.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 600, flexShrink: 0 }}>{(m.nickname || m.username || '?')[0]}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, fontSize: 16, color: mc.text }}>{m.nickname || m.username}</span>
                                  {m.tag && <span style={{ background: '#F5F7FA', color: mc.accent, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{m.tag}</span>}
                                  {(m.tags || []).filter(t => t.tag_type === 'health').map(t => (<span key={t.id} style={{ background: '#F5F7FA', color: mc.accent, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{t.tag_text}</span>))}
                                  {(m.tags || []).filter(t => t.tag_type === 'lifestyle').map(t => (<span key={t.id} style={{ background: '#F5F7FA', color: mc.accent, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{t.tag_text}</span>))}
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: mc.light }}>
                                  {m.age && <span>{m.age}岁</span>}
                                  {m.gender && <span>{m.gender}</span>}
                                  <span>{m.item_count || 0} 件物品</span>
                                </div>
                                {m.health_info && <div style={{ fontSize: 12, color: mc.light, marginTop: 4 }}>{m.health_info}</div>}
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mc.light} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#8E8E93', paddingTop: 12, borderTop: '0.5px solid #F2F2F7', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{familyInfo.stats?.member_count || 0} 位成员</span>
                      <span>{allBoxes.length || 0} 个储物箱</span>
                      <span>{familyInfo.stats?.item_type_count || 0} 种 · {familyInfo.stats?.item_total_count || 0} 件</span>
                      <span onClick={async () => { const fid = familyInfo.id; Toast.show({ icon: 'loading', content: '正在分析...' }); const res = await families.autoTags(fid); Toast.show({ icon: res.data?.added > 0 ? 'success' : 'info', content: res.message }); if (res.data?.added > 0) { families.get(fid).then(r => setFamilyInfo(r.data)); } }} style={{ marginLeft: 'auto', color: '#4A90E2', fontWeight: 500, cursor: 'pointer', fontSize: 13 }}>智能识别</span>
                    </div>
                  </div>
                );
              })()}
            </Wrap>
          ),
        };

        return moduleOrder.map(key => modules[key]).filter(Boolean);
      })()}

      {/* ===== DRAG FLOATING LAYER ===== */}
      {draggingKey && (() => {
        const el = moduleRefs.current[draggingKey];
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const top = dragCurrentY - dragOffsetY;
        const labels = { actions: '添加物品', boxes: '储物箱', reminders: '提醒', summary: '物品汇总', family: '家庭' };
        return (
          <div style={{
            position: 'fixed',
            top: top,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'scale(1.03)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            borderRadius: 24,
            opacity: 0.95,
            background: '#fff',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2.5">
              <circle cx="9" cy="6" r="1.5" fill="#4A90E2" stroke="none" />
              <circle cx="15" cy="6" r="1.5" fill="#4A90E2" stroke="none" />
              <circle cx="9" cy="12" r="1.5" fill="#4A90E2" stroke="none" />
              <circle cx="15" cy="12" r="1.5" fill="#4A90E2" stroke="none" />
              <circle cx="9" cy="18" r="1.5" fill="#4A90E2" stroke="none" />
              <circle cx="15" cy="18" r="1.5" fill="#4A90E2" stroke="none" />
            </svg>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>{labels[draggingKey] || draggingKey}</span>
          </div>
        );
      })()}

      {/* ===== HEALTH REMINDER DETAIL ===== */}
      {showHealthDetail && (() => {
        const isMedicine = showHealthDetail === 'medicine';
        const allowedPriorities = getPriorityLevels();
        const items = isMedicine
          ? (healthReminders?.medicine || []).filter(r => allowedPriorities.includes(r.priority))
          : (healthReminders?.daily || []).filter(r => allowedPriorities.includes(r.priority));
        if (!items?.length) return null;
        const color = isMedicine ? '#E25D6A' : '#52c41a';
        const title = isMedicine ? '用药提醒' : '日化提醒';

        // 按 category 分组
        const grouped = {};
        items.forEach(item => {
          const cat = item.category || '其他';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        });
        const categories = Object.keys(grouped);

        const toggleCat = (cat) => {
          setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat); else next.add(cat);
            return next;
          });
        };

        return createPortal(
          <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 500, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} onClick={() => { setShowHealthDetail(null); setExpandedCategories(new Set()); }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '24px 20px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{isMedicine ? '💊' : '🧴'}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E' }}>{title}</span>
                    <span style={{ background: '#F5F7FA', color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{categories.length} 类</span>
                  </div>
                  <div onClick={() => { setShowHealthDetail(null); setExpandedCategories(new Set()); }} style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: '#8E8E93' }}>✕</div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {categories.map(cat => {
                    const expanded = expandedCategories.has(cat);
                    const catItems = grouped[cat];
                    return (
                      <div key={cat} style={{ background: '#F9FAFB', borderRadius: 16, overflow: 'hidden', border: `1px solid ${color}12` }}>
                        <div onClick={() => toggleCat(cat)} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 16px', cursor: 'pointer',
                          background: expanded ? `${color}08` : 'transparent',
                          transition: 'background 0.2s ease',
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: `${color}15`, color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 700,
                          }}>{cat[0]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>{cat}</div>
                            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{catItems.length} 条提醒</div>
                          </div>
                          <div style={{
                            background: `${color}15`, color, padding: '4px 10px', borderRadius: 12,
                            fontSize: 13, fontWeight: 700, flexShrink: 0,
                          }}>{catItems.length}</div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"
                            style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                        {expanded && (
                          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {catItems.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', gap: 10, padding: '12px', background: '#fff', borderRadius: 12 }}>
                                <div style={{ width: 4, borderRadius: 2, background: color, flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 14, color: '#1C1C1E', lineHeight: 1.6, fontWeight: 500 }}>{item.content}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 11, color: '#8E8E93', background: '#F2F2F7', padding: '2px 7px', borderRadius: 6 }}>{item.member_name}</span>
                                    {item.priority && (
                                      <span style={{
                                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                                        background: item.priority === 'high' ? '#FFF0F0' : item.priority === 'medium' ? '#FFF8F0' : '#F5F5F5',
                                        color: item.priority === 'high' ? '#FF453A' : item.priority === 'medium' ? '#E17A2D' : '#8E8E93',
                                      }}>{item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}</span>
                                    )}
                                    {item.matched_items?.map((mi, i) => (
                                      <span key={i} style={{ fontSize: 11, color, background: `${color}10`, padding: '2px 7px', borderRadius: 6 }}>{mi}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ===== AI HEALTH REMINDER DETAIL ===== */}
      {showAiDetail && (() => {
        const isMedicine = showAiDetail === 'medicine';
        const items = isMedicine ? aiHealthReminders?.medicine : aiHealthReminders?.daily;
        if (!items?.length) return null;
        const color = isMedicine ? '#E25D6A' : '#52c41a';
        const title = isMedicine ? 'AI 用药提醒' : 'AI 日化提醒';
        return createPortal(
          <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 500, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} onClick={() => setShowAiDetail(null)}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '24px 20px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>✨</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E' }}>{title}</span>
                    <span style={{ background: '#F0F4FF', color: '#4A90E2', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>AI 生成</span>
                    <span style={{ background: '#F5F7FA', color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{items.length} 条</span>
                  </div>
                  <div onClick={() => setShowAiDetail(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: '#8E8E93' }}>✕</div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 14, padding: '16px', background: '#F9FAFB', borderRadius: 16, border: `1px solid ${color}15` }}>
                      <div style={{ width: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, color: '#1C1C1E', lineHeight: 1.6, fontWeight: 500 }}>{item.content}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {item.member_name && <span style={{ fontSize: 12, color: '#8E8E93', background: '#F2F2F7', padding: '2px 8px', borderRadius: 8 }}>{item.member_name}</span>}
                          {item.matched_items?.map((mi, i) => (
                            <span key={i} style={{ fontSize: 12, color, background: `${color}12`, padding: '2px 8px', borderRadius: 8 }}>{mi}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ===== EMPTY STATE ===== */}
      {!data && (
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          {illustrations.emptyBox}
          <p style={{ color: '#8E8E93', fontSize: 15, lineHeight: 1.6, marginTop: 16, fontWeight: 400 }}>
            开始添加你的第一个储物箱
          </p>
        </div>
      )}

      {/* ===== EDIT MODE TOOLBAR ===== */}
      {editMode && (
        <div style={{
          position: 'fixed', bottom: 'var(--tab-bar-height)', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 500, zIndex: 100,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
          borderTop: '0.5px solid #E5E5EA',
          padding: '12px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 13, color: '#8E8E93', fontWeight: 500 }}>长按模块拖动排序</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div onClick={resetModuleOrder} style={{
              padding: '10px 24px', borderRadius: 14,
              background: '#F2F2F7', color: '#8E8E93',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>恢复默认</div>
            <div onClick={() => { setEditMode(false); setDraggingKey(null); }} style={{
              padding: '10px 24px', borderRadius: 14,
              background: '#4A90E2', color: '#FFFFFF',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>完成</div>
          </div>
        </div>
      )}

      <div style={{ height: editMode ? 70 : 20 }} />
    </div>
  );
}
