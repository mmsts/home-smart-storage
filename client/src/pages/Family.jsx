import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, Tag, Button, Dialog, Toast, Input } from 'antd-mobile'
import { families } from '../api'
import { icons } from '../styles/theme'

export default function Family() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', description: '' });

  const load = () => {
    families.list().then(res => setList(res.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return Toast.show({ content: '请输入家庭名称' });
    await families.create(form);
    Toast.show({ icon: 'success', content: '创建成功' });
    setForm({ name: '', address: '', description: '' });
    setShowCreate(false);
    load();
  };

  const handleDelete = async (id) => {
    const result = await Dialog.confirm({ content: '确定删除此家庭？所有成员关系将被移除。' });
    if (result) {
      await families.delete(id);
      Toast.show({ icon: 'success', content: '已删除' });
      load();
    }
  };

  const roleMap = { owner: '创建者', admin: '管理员', member: '成员' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ cursor: 'pointer', marginRight: 8 }} onClick={() => navigate('/profile')}>← 返回</span>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>家庭管理</h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        {showCreate ? (
          <div className="card">
            <div style={{ marginBottom: 8 }}>
              <Input placeholder="家庭名称" value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <Input placeholder="地址（可选）" value={form.address}
                onChange={v => setForm(f => ({ ...f, address: v }))} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <Input placeholder="描述（可选）" value={form.description}
                onChange={v => setForm(f => ({ ...f, description: v }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" color="primary" onClick={handleCreate}>创建</Button>
              <Button size="small" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </div>
        ) : (
          <Button color="primary" fill="outline" block onClick={() => setShowCreate(true)}>
            + 创建家庭
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="icon" style={{ display: 'flex', justifyContent: 'center' }}>{icons.family}</div>
          <p>还没有加入任何家庭</p>
        </div>
      ) : (
        <List>
          {list.map(f => (
            <List.Item key={f.id}
              description={f.address || '未设置地址'}
              onClick={() => navigate(`/family/${f.id}`)}
              extra={
                <Tag color={f.role === 'owner' ? 'primary' : 'default'} fill="outline" style={{ fontSize: 11 }}>
                  {roleMap[f.role] || f.role}
                </Tag>
              }>
              {f.name}
            </List.Item>
          ))}
        </List>
      )}
    </div>
  );
}
