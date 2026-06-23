import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, Tag, Button, Dialog, Toast, Input, Tabs } from 'antd-mobile'
import { categories } from '../api'

export default function Categories() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('📦');

  const load = () => { categories.list().then(res => setList(res.data)).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return Toast.show({ content: '请输入分类名称' });
    await categories.create({ name: newName, description: newDesc, icon: newIcon });
    Toast.show({ icon: 'success', content: '创建成功' });
    setNewName(''); setNewDesc(''); setNewIcon('📦'); setShowAdd(false);
    load();
  };

  const handleDelete = async (cat) => {
    if (cat.is_default) return Toast.show({ content: '默认分类不可删除' });
    const result = await Dialog.confirm({ content: `确定删除分类「${cat.name}」？` });
    if (result) {
      await categories.delete(cat.id);
      Toast.show({ icon: 'success', content: '删除成功' });
      load();
    }
  };

  const typeLabels = { medicine: '药箱', daily: '日化', custom: '自定义' };
  const grouped = { medicine: [], daily: [], custom: [] };
  list.forEach(c => { if (grouped[c.storage_type]) grouped[c.storage_type].push(c); });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ cursor: 'pointer', marginRight: 8 }} onClick={() => navigate(-1)}>← 返回</span>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>分类管理</h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        {showAdd ? (
          <div className="card">
            <div style={{ marginBottom: 8 }}><Input placeholder="分类名称" value={newName} onChange={setNewName} /></div>
            <div style={{ marginBottom: 8 }}><Input placeholder="描述（可选）" value={newDesc} onChange={setNewDesc} /></div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 4 }}>选择图标</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['📦', '🏷️', '🧸', '📚', '🔧', '🍳', '👕', '🧹', '🎯', '💡', '🎮', '📎'].map(icon => (
                  <span key={icon} onClick={() => setNewIcon(icon)} style={{
                    fontSize: 24, cursor: 'pointer', padding: 4, borderRadius: 8,
                    border: newIcon === icon ? '2px solid var(--primary)' : '2px solid transparent'
                  }}>{icon}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" color="primary" onClick={handleAdd}>确定</Button>
              <Button size="small" onClick={() => setShowAdd(false)}>取消</Button>
            </div>
          </div>
        ) : (
          <Button block onClick={() => setShowAdd(true)}
            style={{ background: 'var(--text-primary)', color: '#FFFFFF', border: 'none', borderRadius: 12, fontWeight: 600 }}>
            + 添加自定义分类
          </Button>
        )}
      </div>

      <Tabs defaultActiveKey="medicine">
        {['medicine', 'daily', 'custom'].map(type => (
          <Tabs.Tab title={typeLabels[type]} key={type}>
            <List>
              {grouped[type].map(cat => (
                <List.Item key={cat.id} description={cat.description}
                  prefix={<span style={{ fontSize: 20 }}>{cat.icon || '📦'}</span>}
                  extra={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {cat.is_default ? <Tag color="primary" fill="outline" style={{ fontSize: 11 }}>默认</Tag> : (
                        <Tag color="danger" fill="outline" style={{ fontSize: 11, cursor: 'pointer' }}
                          onClick={() => handleDelete(cat)}>删除</Tag>
                      )}
                    </div>
                  }>
                  {cat.name}
                </List.Item>
              ))}
              {grouped[type].length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-hint)' }}>暂无分类</div>
              )}
            </List>
          </Tabs.Tab>
        ))}
      </Tabs>
    </div>
  );
}
