import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { items } from '../api'
import { statusMap } from '../styles/theme'

export default function ItemCard({ item, color, batchMode, selected, onSelect, onDelete, showSwipeDelete, onQuantityUpdate }) {
  const navigate = useNavigate();
  const [swipeX, setSwipeX] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef(false);

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';

  const handleTouchStart = (e) => {
    if (!showSwipeDelete) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontal.current = false;
  };

  const handleTouchMove = (e) => {
    if (!showSwipeDelete) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isHorizontal.current && Math.abs(dx) > 5) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (isHorizontal.current) {
      const newX = Math.min(0, Math.max(-80, dx));
      setSwipeX(newX);
    }
  };

  const handleTouchEnd = () => {
    if (!showSwipeDelete) return;
    setSwipeX(swipeX < -40 ? -80 : 0);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await items.delete(item.id);
      Toast.show({ icon: 'success', content: '已删除' });
      onDelete?.(item.id);
    } catch {
      Toast.show({ content: '删除失败' });
    } finally {
      setDeleting(false);
    }
  };

  const handleQuantity = async (e, delta) => {
    e.stopPropagation();
    const newQty = Math.max(0, (item.quantity || 0) + delta);
    try {
      await items.updateQuantity(item.id, { quantity: newQty });
      onQuantityUpdate?.();
    } catch {}
  };

  const handleClick = () => {
    if (batchMode) {
      onSelect?.();
    } else {
      navigate(`/items/${item.id}`);
    }
  };

  const status = statusMap[item.status] || { color: '#8E8E93', label: item.status };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', marginBottom: 10 }}>
      {/* Delete button behind */}
      {showSwipeDelete && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
          background: '#FF453A', display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderRadius: '0 16px 16px 0',
        }} onClick={handleDelete}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>删除</span>
        </div>
      )}

      {/* Card */}
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          background: '#FFFFFF', borderRadius: 16,
          boxShadow: appleShadow, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? 'transform 0.2s' : 'none',
          position: 'relative', zIndex: 1,
          border: selected ? `2px solid ${color || '#1C1C1E'}` : '2px solid transparent',
        }}
      >
        {/* Batch mode checkbox */}
        {batchMode && (
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${selected ? (color || '#1C1C1E') : '#E5E5EA'}`,
            background: selected ? (color || '#1C1C1E') : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        )}

        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: (color || '#8E8E93') + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          {item.image ? (
            <img src={item.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 8 }} />
          ) : (
            <span>📦</span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: 15, color: '#1C1C1E',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.name}
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.brand && <span>{item.brand}</span>}
            {item.model && <span>· {item.model}</span>}
            {item.expiry_date && (
              <span style={{ color: new Date(item.expiry_date) < new Date() ? '#C4554D' : '#8E8E93' }}>
                {new Date(item.expiry_date) < new Date() ? '⚠️ 已过期' : `效期 ${item.expiry_date.slice(0, 7)}`}
              </span>
            )}
          </div>
        </div>

        {/* Quantity controls */}
        {!batchMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div onClick={(e) => handleQuantity(e, -1)} style={{
              width: 28, height: 28, borderRadius: 8, background: '#F5F7FA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#8E8E93', cursor: 'pointer',
            }}>−</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', minWidth: 20, textAlign: 'center' }}>
              {item.quantity || 0}
            </span>
            <div onClick={(e) => handleQuantity(e, 1)} style={{
              width: 28, height: 28, borderRadius: 8, background: (color || '#1C1C1E') + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: color || '#1C1C1E', cursor: 'pointer',
            }}>+</div>
          </div>
        )}

        {/* Status indicator */}
        {item.status !== 'in_use' && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: status.color + '15', color: status.color, fontWeight: 500,
            flexShrink: 0,
          }}>
            {status.label}
          </span>
        )}
      </div>
    </div>
  );
}
