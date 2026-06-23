import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FloatingBubble, Empty, SwipeAction, Dialog, Toast } from 'antd-mobile'
import { AddOutline } from 'antd-mobile-icons'
import { items as itemsApi, modules } from '../api'
import { icons } from '../styles/theme'

const statusMap = {
  in_use: { text: '使用中', color: 'primary' },
  pending: { text: '待使用', color: 'default' },
  discarded: { text: '已丢弃', color: 'warning' },
  donated: { text: '已捐赠', color: 'success' },
  lent: { text: '已借出', color: 'default' },
  expired: { text: '已过期', color: 'danger' },
  damaged: { text: '已损坏', color: 'warning' },
};

export default function CustomModule() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [items, setItems] = useState([]);

  const load = () => {
    modules.get(id).then(res => setModule(res.data)).catch(() => {});
    itemsApi.list({ module_id: id }).then(res => setItems(res.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const handleDelete = async (itemId) => {
    const result = await Dialog.confirm({ content: '确定删除这个物品吗？' });
    if (result) { await itemsApi.delete(itemId); Toast.show({ icon: 'success', content: '删除成功' }); load(); }
  };

  if (!module) return null;
  const color = module.color || 'var(--primary)';

  return (
    <div>
      <div style={{
        background: '#FFFFFF',
        color: '#222222', padding: '20px 16px 24px', borderRadius: '0 0 24px 24px',
        margin: '-16px -16px 20px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)',
          opacity: 0.15, pointerEvents: 'none', fontSize: 80, lineHeight: 0, color: '#AAAAAA'
        }}>{icons.box}</div>
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <span style={{ cursor: 'pointer', marginRight: 12, fontSize: 18, opacity: 0.7 }} onClick={() => navigate('/')}>←</span>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>{module.name}</h2>
            <p style={{ opacity: 0.5, fontSize: 13, margin: '2px 0 0' }}>{items.length} 种物品</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{module.icon}</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>还没有物品</h3>
          <p style={{ color: 'var(--text-hint)', fontSize: 14, marginBottom: 20 }}>点击下方按钮添加第一个物品</p>
          <div onClick={() => navigate(`/items/new?module=${id}`)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
            color: '#fff', padding: '10px 24px', borderRadius: 24, fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: `0 4px 14px ${color}40`
          }}>+ 添加物品</div>
        </div>
      ) : (
        items.map(item => (
          <SwipeAction key={item.id} rightActions={[
            { key: 'delete', text: '删除', color: 'danger', onClick: () => handleDelete(item.id) }
          ]}>
            <div className="list-item-card" onClick={() => navigate(`/items/${item.id}`)}>
              <div className="flex-between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                    {item.category_name || '未分类'}{item.brand && ` · ${item.brand}`}{item.quantity > 1 && ` · ${item.quantity}${item.unit}`}
                  </div>
                </div>
                <span className={`status-badge status-${item.status}`} style={{ flexShrink: 0, marginLeft: 8 }}>
                  {statusMap[item.status]?.text || item.status}
                </span>
              </div>
            </div>
          </SwipeAction>
        ))
      )}
    </div>
  );
}
