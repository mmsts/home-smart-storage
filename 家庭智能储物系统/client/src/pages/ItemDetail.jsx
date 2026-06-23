import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tag, Button, Toast, Dialog, List, Picker } from 'antd-mobile'
import { items as itemsApi, modules as modulesApi } from '../api'
import { typeColors, typeLabels, statusMap, icons } from '../styles/theme'

const statusOptions = [
  { label: '使用中', value: 'in_use' },
  { label: '待使用', value: 'pending' },
];

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [moduleName, setModuleName] = useState(null);
  const [statusPicker, setStatusPicker] = useState(false);

  const load = () => {
    itemsApi.get(id).then(res => {
      setItem(res.data);
      if (res.data?.module_id) {
        modulesApi.get(res.data.module_id).then(r => setModuleName(r.data?.name)).catch(() => {});
      }
    }).catch(() => {});
  };
  useEffect(() => { load(); }, [id]);

  const handleDelete = async () => {
    const result = await Dialog.confirm({ content: '确定删除这个物品吗？' });
    if (result) { await itemsApi.delete(id); Toast.show({ icon: 'success', content: '已删除' }); navigate(-1); }
  };

  const handleStatusChange = async (val) => {
    await itemsApi.update(id, { ...item, status: val[0], tags: item.tags || [] });
    Toast.show({ icon: 'success', content: '状态已更新' });
    load();
  };

  if (!item) return null;
  const color = typeColors[item.storage_type] || 'var(--primary)';

  return (
    <div>
      <div className="page-header">
        <span className="back-btn" onClick={() => navigate(-1)}>← 返回</span>
        <h2>物品详情</h2>
      </div>

      {/* Hero Card */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 20, padding: '24px 20px', color: '#222222',
        marginBottom: 16, position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)',
          opacity: 0.15, pointerEvents: 'none', fontSize: 80, lineHeight: 0, color: '#AAAAAA'
        }}>{icons.box}</div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {item.image ? (
            <img src={item.image} alt={item.name} style={{
              width: '100%', height: 160, objectFit: 'cover', borderRadius: 12,
              marginBottom: 12
            }} />
          ) : (
            <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>{item.category_icon || '📦'}</div>
          )}
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.3px' }}>{item.name}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span onClick={() => setStatusPicker(true)} style={{ cursor: 'pointer', background: statusMap[item.status]?.color || 'rgba(0,0,0,0.15)', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#fff' }}>
              {statusMap[item.status]?.label} ▾
            </span>
            <span style={{ background: 'rgba(0,0,0,0.1)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>
              {moduleName || typeLabels[item.storage_type]}
            </span>
            {item.category_name && <span style={{ background: 'rgba(0,0,0,0.1)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>{item.category_name}</span>}
            {item.quantity > 1 && <span style={{ background: 'rgba(0,0,0,0.1)', padding: '3px 12px', borderRadius: 20, fontSize: 12 }}>x{item.quantity} {item.unit}</span>}
          </div>
        </div>
      </div>

      {/* Info List */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 12 }}>
        {moduleName && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--divider)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>所属模块</span><span style={{ fontWeight: 500, fontSize: 14 }}>{moduleName}</span>
        </div>}
        {item.brand && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--divider)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>品牌</span><span style={{ fontWeight: 500, fontSize: 14 }}>{item.brand}</span>
        </div>}
        {item.model && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--divider)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>型号</span><span style={{ fontWeight: 500, fontSize: 14 }}>{item.model}</span>
        </div>}
        {item.quantity > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--divider)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>数量</span><span style={{ fontWeight: 500, fontSize: 14 }}>{item.quantity} {item.unit}</span>
        </div>}
        {item.production_date && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--divider)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>生产日期</span><span style={{ fontWeight: 500, fontSize: 14 }}>{item.production_date}</span>
        </div>}
        {item.purchase_date && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--divider)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>购买日期</span><span style={{ fontWeight: 500, fontSize: 14 }}>{item.purchase_date}</span>
        </div>}
        {item.expiry_date && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item.storage_type === 'medicine' ? '有效期至' : '保质期'}</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: new Date(item.expiry_date) < new Date() ? 'var(--danger)' : 'inherit' }}>{item.expiry_date}</span>
        </div>}
      </div>

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
          <div className="section-title" style={{ fontSize: 14 }}>标签</div>
          <div className="tag-list">{item.tags.map((t, i) => <span key={i} className="tag-item">{t}</span>)}</div>
        </div>
      )}

      {/* Owners */}
      {item.owners?.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
          <div className="section-title" style={{ fontSize: 14 }}>归属人</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {item.owners.map(o => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--primary-light)', padding: '6px 12px', borderRadius: 20
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--primary-gradient)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700
                }}>{(o.nickname || '?')[0]}</div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)' }}>{o.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
          <div className="section-title" style={{ fontSize: 14 }}>备注</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>{item.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, padding: '0 0 16px' }}>
        <Button block style={{ height: 44, borderRadius: 12, fontWeight: 600 }}
          color="primary" fill="outline" onClick={() => navigate(`/items/${id}/edit`)}>编辑</Button>
        <Button block style={{ height: 44, borderRadius: 12, fontWeight: 600 }}
          color="danger" fill="outline" onClick={handleDelete}>删除</Button>
      </div>

      <Picker columns={[statusOptions]} visible={statusPicker}
        onClose={() => setStatusPicker(false)} onConfirm={handleStatusChange} value={[item.status]} />
    </div>
  );
}
