import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NavBar, Tag, FloatingBubble, Empty, SwipeAction, Dialog, Toast } from 'antd-mobile'
import { AddOutline } from 'antd-mobile-icons'
import { items as itemsApi } from '../api'
import { statusMap as themeStatusMap } from '../styles/theme'

const displayStatusMap = {
  in_use: { text: '使用中', color: 'primary' },
  pending: { text: '待使用', color: 'default' },
  empty: { text: '已用完', color: 'default' },
  discarded: { text: '已丢弃', color: 'warning' },
  donated: { text: '已捐赠', color: 'success' },
  lent: { text: '已借出', color: 'default' },
  expired: { text: '已过期', color: 'danger' },
  damaged: { text: '已损坏', color: 'warning' },
  lost: { text: '已丢失', color: 'danger' },
};

const filterLabels = {
  status: { in_use: '使用中', unused: '未使用' },
};

export default function Items() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [list, setList] = useState([]);

  const filterStatus = searchParams.get('status');
  const filterCategoryId = searchParams.get('category_id');
  const filterStorageType = searchParams.get('storage_type');

  // Build API params from URL
  const buildParams = () => {
    const params = {};
    if (filterCategoryId) params.category_id = filterCategoryId;
    if (filterStorageType) params.storage_type = filterStorageType;
    if (filterStatus === 'in_use') {
      params.status = 'in_use';
    } else if (filterStatus === 'unused') {
      params.status_not = 'in_use';
    }
    return params;
  };

  const fetchItems = () => {
    itemsApi.list(buildParams()).then(res => setList(res.data)).catch(() => {});
  };

  useEffect(() => { fetchItems(); }, [filterStatus, filterCategoryId, filterStorageType]);

  const handleDelete = async (id) => {
    const result = await Dialog.confirm({ content: '确定删除这个物品吗？' });
    if (result) {
      await itemsApi.delete(id);
      Toast.show({ icon: 'success', content: '删除成功' });
      fetchItems();
    }
  };

  // Determine page title
  let pageTitle = '所有物品';
  if (filterStatus && filterLabels.status[filterStatus]) {
    pageTitle = filterLabels.status[filterStatus];
  }

  const hasFilter = filterStatus || filterCategoryId || filterStorageType;

  return (
    <div>
      {hasFilter ? (
        <NavBar onBack={() => navigate(-1)} style={{
          '--height': '48px', '--border-bottom': '1px solid var(--divider)',
        }}>{pageTitle}</NavBar>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>所有物品</h2>
          <Tag color="primary" style={{ cursor: 'pointer' }} onClick={() => navigate('/items/new')}>+ 添加</Tag>
        </div>
      )}

      {/* Filter indicator */}
      {hasFilter && (
        <div style={{
          padding: '8px 16px', fontSize: 12, color: 'var(--text-hint)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>筛选结果</span>
          <span style={{
            background: 'var(--bg-page)', padding: '2px 8px', borderRadius: 6,
            fontSize: 11, fontWeight: 500, border: '1px solid var(--border)',
          }}>{list.length} 件</span>
        </div>
      )}

      {list.length === 0 ? (
        <Empty description="还没有物品" style={{ padding: '40px 0' }} />
      ) : (
        <div style={{ padding: hasFilter ? '0 16px' : 0 }}>
          {list.map(item => (
            <SwipeAction key={item.id} rightActions={[
              { key: 'delete', text: '删除', color: 'danger', onClick: () => handleDelete(item.id) }
            ]}>
              <div style={{
                background: 'var(--bg-card)', borderRadius: 14, padding: '14px 16px',
                marginBottom: 8, cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }} onClick={() => navigate(`/items/${item.id}`)}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>
                    {item.category_name || '未分类'}{item.brand && ` · ${item.brand}`}{item.quantity > 1 && ` x${item.quantity}`}
                  </div>
                </div>
                <Tag color={displayStatusMap[item.status]?.color || 'default'} fill="outline" style={{ fontSize: 11 }}>
                  {displayStatusMap[item.status]?.text || item.status}
                </Tag>
              </div>
            </SwipeAction>
          ))}
        </div>
      )}
    </div>
  );
}
