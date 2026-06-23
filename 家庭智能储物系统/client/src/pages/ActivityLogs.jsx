import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { activityLogs } from '../api'

const actionIcons = {
  'create': '➕', 'update': '✏️', 'delete': '🗑️',
  'add': '➕', 'remove': '🗑️', 'join': '👤',
  'leave': '🚪', 'dismiss': '📋',
  '创建': '➕', '更新': '✏️', '删除': '🗑️',
  '添加': '➕', '移除': '🗑️',
}

const actionColors = {
  create: '#5A9E6F', update: '#5B7FA5', delete: '#C4554D',
  add: '#5A9E6F', remove: '#C4554D', dismiss: '#D4915A',
  '创建': '#5A9E6F', '更新': '#5B7FA5', '删除': '#C4554D',
  '添加': '#5A9E6F', '移除': '#C4554D',
}

const actionLabels = {
  'create': '创建', 'update': '更新', 'delete': '删除',
  'add': '添加', 'remove': '移除', 'join': '加入',
  'leave': '离开', 'dismiss': '关闭',
}

const typeLabels = {
  'item': '物品', 'category': '分类', 'family': '家庭',
  'member': '成员', 'box': '箱子', 'module': '模块',
  'user': '用户', 'reminder': '提醒',
}

export default function ActivityLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchText, setSearchText] = useState('');

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';
  const cardStyle = {
    background: '#FFFFFF', borderRadius: 24,
    boxShadow: appleShadow, border: 'none', padding: '20px',
  };

  const loadLogs = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const params = { limit: 30 };
      if (reset) params.offset = 0;
      else params.offset = logs.length;
      const res = await activityLogs.list(params);
      if (reset) {
        setLogs(res.data);
        setHasMore(res.data.length === 30);
      } else {
        setLogs(prev => [...prev, ...res.data]);
        setHasMore(res.data.length === 30);
      }
    } catch (e) {
      console.error('加载操作日志失败', e);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await activityLogs.getStats({});
      setStats(res.data);
    } catch (e) {
      console.error('加载日志统计失败', e);
    }
  };

  useEffect(() => {
    loadLogs(true);
    loadStats();
  }, []);

  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return timeStr.slice(5, 16);
  };

  const filteredLogs = useMemo(() => {
    if (!searchText.trim()) return logs;
    const s = searchText.toLowerCase();
    return logs.filter(log => {
      const name = (log.user?.nickname || log.user?.username || '').toLowerCase();
      const action = (actionLabels[log.action] || log.action || '').toLowerCase();
      const type = (typeLabels[log.targetType] || log.targetType || '').toLowerCase();
      const target = (log.targetName || '').toLowerCase();
      return name.includes(s) || action.includes(s) || type.includes(s) || target.includes(s);
    });
  }, [logs, searchText]);

  // Load more on scroll
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loading) {
      loadLogs();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      {/* Hero Header */}
      <div style={{
        margin: '-16px -16px 0',
        padding: '56px 28px 24px',
        background: '#F5F7FA',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10
        }}>
          <div onClick={() => navigate(-1)} style={{
            width: 32, height: 32, borderRadius: 10,
            background: '#FFFFFF', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: appleShadow,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: 12, color: '#8E8E93',
              letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600
            }}>历史</div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
              lineHeight: 1.1, color: '#1C1C1E', margin: 0,
            }}>操作日志</h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#FFFFFF', borderRadius: 14,
          height: 44, padding: '0 16px', marginBottom: 16,
          boxShadow: appleShadow,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="搜索操作、人员、物品..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, marginLeft: 10, color: '#1C1C1E',
              background: 'transparent',
              fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
            }}
          />
          {searchText && (
            <span onClick={() => setSearchText('')} style={{
              fontSize: 14, color: '#C7C7CC', cursor: 'pointer', padding: 4,
            }}>✕</span>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 14,
              letterSpacing: '0.3px', textTransform: 'uppercase',
            }}>概览统计</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                flex: 1, textAlign: 'center', padding: '14px 0',
                background: '#F5F7FA', borderRadius: 20,
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E' }}>{stats.totalCount || 0}</div>
                <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: 500 }}>总操作</div>
              </div>
              {(stats.actionStats || []).slice(0, 2).map((s, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', padding: '14px 0',
                  background: '#F5F7FA', borderRadius: 20,
                }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E' }}>{s.count}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: 500 }}>
                    {actionLabels[s.action] || s.action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log List */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{
            padding: '16px 20px 0',
            fontSize: 13, fontWeight: 600, color: '#8E8E93',
            letterSpacing: '0.3px', textTransform: 'uppercase',
          }}>操作记录</div>

          {filteredLogs.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8E8E93', fontSize: 14 }}>
              {searchText ? '没有找到相关记录' : '暂无操作记录'}
            </div>
          ) : (
            <div onScroll={handleScroll} style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {filteredLogs.map((log, i) => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 20px',
                  borderBottom: i < filteredLogs.length - 1 ? '0.5px solid #F2F2F7' : 'none',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 12,
                    background: actionColors[log.action] || '#8E8E93',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {actionIcons[log.action] || '📋'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#1C1C1E' }}>
                          {actionLabels[log.action] || log.action}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                          background: '#F5F7FA', color: '#8E8E93',
                        }}>
                          {typeLabels[log.targetType] || log.targetType}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: '#C7C7CC', flexShrink: 0 }}>
                        {formatTime(log.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.5 }}>
                      {log.user?.nickname || log.user?.username || '用户'}
                      {actionLabels[log.action] || log.action}了
                      {typeLabels[log.targetType] || log.targetType}
                      {log.targetName && <span style={{ fontWeight: 600, color: '#1C1C1E' }}>「{log.targetName}」</span>}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#8E8E93', fontSize: 13 }}>
                  加载中...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
