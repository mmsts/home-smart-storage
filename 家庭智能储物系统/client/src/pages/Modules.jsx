import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Toast } from 'antd-mobile'
import { boxes as boxesApi } from '../api'
import { colorOptions } from '../styles/theme'
const iconOptions = ['📦', '🧸', '📚', '🔧', '🍳', '👕', '🧹', '🎯', '💡', '🎮', '📎', '🎸', '🏕️', '🎨', '🪴', '🐾'];

export default function Modules() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', icon: '📦', color: '#C4554D', description: '' });

  const load = () => { boxesApi.list().then(res => setList(res.data || [])).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm({ name: '', icon: '📦', color: '#C4554D', description: '' }); setEditId(null); setShowCreate(false); };

  const handleSave = async () => {
    if (!form.name.trim()) return Toast.show({ content: '请输入箱子名称' });
    try {
      if (editId) {
        await boxesApi.update(editId, form);
        Toast.show({ icon: 'success', content: '更新成功' });
      } else {
        await boxesApi.create(form);
        Toast.show({ icon: 'success', content: '创建成功' });
      }
      resetForm(); load();
    } catch (e) {
      Toast.show({ icon: 'fail', content: e?.message || '操作失败，请重试' });
    }
  };

  const handleEdit = (box) => {
    setForm({ name: box.name, icon: box.icon, color: box.color, description: box.description || '' });
    setEditId(box.id); setShowCreate(true);
  };

  const handleDelete = async (box) => {
    const result = await Dialog.confirm({ content: `删除箱子「${box.name}」？箱内物品不会被删除。` });
    if (result) { await boxesApi.delete(box.id); Toast.show({ icon: 'success', content: '已删除' }); load(); }
  };

  const handleToggleHome = async (box) => {
    await boxesApi.toggleHome(box.id, !box.show_on_home);
    Toast.show({ icon: 'success', content: box.show_on_home ? '已从首页移除' : '已添加到首页' });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <span className="back-btn" onClick={() => navigate('/')}>← 返回</span>
        <h2>储物箱管理</h2>
      </div>

      {/* Create / Edit Form */}
      {showCreate ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editId ? '编辑箱子' : '新建箱子'}</div>

          {/* Icon picker */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>图标</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {iconOptions.map(ic => (
                <div key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                  style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer',
                    border: form.icon === ic ? `2px solid ${form.color}` : '2px solid var(--divider)', background: form.icon === ic ? `${form.color}10` : 'transparent' }}>
                  {ic}
                </div>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>颜色</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {colorOptions.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 28, height: 28, borderRadius: 14, background: c, cursor: 'pointer',
                    border: form.color === c ? '3px solid var(--text-primary)' : '3px solid transparent',
                    boxShadow: form.color === c ? `0 0 0 2px ${c}40` : 'none' }} />
              ))}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>箱子名称 *</div>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="输入箱子名称"
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 15, outline: 'none', color: 'var(--text-primary)', background: 'transparent' }} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>描述</div>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="简短描述（选填）"
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 15, outline: 'none', color: 'var(--text-primary)', background: 'transparent' }} />
          </div>

          {/* Preview */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>预览</div>
            <div style={{ background: `linear-gradient(145deg, ${form.color}18 0%, ${form.color}08 100%)`, borderRadius: 14, padding: '14px 12px', textAlign: 'center', width: 90 }}>
              <div style={{ fontSize: 30, marginBottom: 4 }}>{form.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: form.color }}>{form.name || '箱子名'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${form.color} 0%, ${form.color}CC 100%)`, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {editId ? '保存' : '创建'}
            </button>
            <button onClick={resetForm} style={{ height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '0 20px' }}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setShowCreate(true); }} style={{
          width: '100%', height: 48, borderRadius: 12, border: '1.5px dashed var(--border)',
          background: 'var(--bg-card)', color: 'var(--primary)', fontSize: 15, fontWeight: 600,
          cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>+ 新建储物箱</button>
      )}

      {/* Boxes List */}
      {list.length === 0 && !showCreate ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>还没有储物箱</h3>
          <p style={{ color: 'var(--text-hint)', fontSize: 14 }}>创建箱子来分类管理物品</p>
        </div>
      ) : (
        list.map(box => (
          <div key={box.id} style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '14px 16px',
            boxShadow: 'var(--shadow-sm)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div onClick={() => navigate(box.is_builtin ? `/storage/${box.id}` : `/boxes/${box.id}`)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(145deg, ${box.color}18 0%, ${box.color}08 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {box.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {box.name}
                  {box.is_builtin && <span style={{ fontSize: 10, background: 'var(--divider)', color: 'var(--text-hint)', padding: '1px 6px', borderRadius: 4 }}>内置</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 1 }}>{box.description || `${box.item_count || 0} 种物品`}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              <span onClick={(e) => { e.stopPropagation(); handleToggleHome(box); }}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 10, cursor: 'pointer',
                  background: box.show_on_home ? 'var(--primary-light)' : 'var(--divider)',
                  color: box.show_on_home ? 'var(--primary)' : 'var(--text-hint)',
                  fontWeight: 500
                }}>
                {box.show_on_home ? '🏠 首页' : '首页'}
              </span>
              {!box.is_builtin && (
                <>
                  <span onClick={(e) => { e.stopPropagation(); handleEdit(box); }} style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer', padding: '4px 8px' }}>编辑</span>
                  <span onClick={(e) => { e.stopPropagation(); handleDelete(box); }} style={{ fontSize: 13, color: 'var(--danger)', cursor: 'pointer', padding: '4px 8px' }}>删除</span>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
