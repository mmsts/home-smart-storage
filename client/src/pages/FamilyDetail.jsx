import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { List, Tag, Button, Dialog, Toast, Input, Grid } from 'antd-mobile'
import { families } from '../api'
import { icons } from '../styles/theme'

export default function FamilyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState('');

  const load = () => {
    families.get(id).then(res => setFamily(res.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const handleAddMember = async () => {
    if (!username.trim()) return Toast.show({ content: '请输入用户名' });
    try {
      await families.addMember(id, { username });
      Toast.show({ icon: 'success', content: '添加成功' });
      setUsername(''); setShowAdd(false);
      load();
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '添加失败' });
    }
  };

  const handleRemoveMember = async (userId, name) => {
    const result = await Dialog.confirm({ content: `确定移除成员「${name}」？` });
    if (result) {
      await families.removeMember(id, userId);
      Toast.show({ icon: 'success', content: '已移除' });
      load();
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    await families.updateMember(id, userId, { role: newRole });
    Toast.show({ icon: 'success', content: '角色已更新' });
    load();
  };

  const handleEditTag = async (member) => {
    const result = await Dialog.confirm({
      title: '编辑成员标签',
      content: (
        <div>
          <p style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>为 {member.nickname || member.username} 设置标签（如：爸爸、妈妈、孩子）</p>
          <Input id="tag-input" defaultValue={member.tag || ''} placeholder="输入标签" />
        </div>
      ),
      onConfirm: async () => {
        const input = document.getElementById('tag-input');
        const tag = input?.value?.trim();
        await families.updateMember(id, member.id, { role: member.role, tag });
        Toast.show({ icon: 'success', content: '标签已更新' });
        load();
      }
    });
  };

  if (!family) return null;

  const roleMap = { owner: '创建者', admin: '管理员', member: '成员' };
  const roleColor = { owner: 'primary', admin: 'warning', member: 'default' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ cursor: 'pointer', marginRight: 8 }} onClick={() => navigate('/family')}>← 返回</span>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{family.name}</h2>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--text-hint)', opacity: 0.4 }}>{icons.family}</div>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>{family.name}</h3>
        {family.address && <p style={{ color: 'var(--text-hint)', fontSize: 13, marginTop: 4 }}>📍 {family.address}</p>}
        {family.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{family.description}</p>}

        <Grid columns={4} gap={8} style={{ marginTop: 16 }}>
          <Grid.Item>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{family.stats?.member_count || 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>成员</div>
          </Grid.Item>
          <Grid.Item>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{family.stats?.box_count || 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>箱子</div>
          </Grid.Item>
          <Grid.Item>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{family.stats?.item_type_count || 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>种物品</div>
          </Grid.Item>
          <Grid.Item>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#B8A0D6' }}>{family.stats?.item_total_count || 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>件物品</div>
          </Grid.Item>
        </Grid>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--divider)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>📦 {family.stats?.box_count || 0} 个储物箱</span>
        </div>
      </div>

      <div className="flex-between" style={{ margin: '16px 0 12px' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>家庭成员</div>
        <Button size="mini" color="primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '取消' : '+ 邀请成员'}
        </Button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input placeholder="输入用户名" value={username} onChange={setUsername} style={{ flex: 1 }} />
            <Button size="small" color="primary" onClick={handleAddMember}>添加</Button>
          </div>
        </div>
      )}

      <List>
        {family.members?.map(member => (
          <List.Item key={member.id}
            description={<span>{member.username} {member.age && <span style={{ color: 'var(--text-hint)' }}>· {member.age}岁</span>} {member.gender && <span style={{ color: 'var(--text-hint)' }}>· {member.gender}</span>}</span>}
            onClick={() => navigate(`/members/${member.id}/items`)}
            extra={
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {member.tag && <Tag color="success" fill="outline" style={{ fontSize: 11 }}>{member.tag}</Tag>}
                <Tag color={roleColor[member.role] || 'default'} fill="outline" style={{ fontSize: 11 }}>
                  {roleMap[member.role] || member.role}
                </Tag>
                <span onClick={(e) => { e.stopPropagation(); handleEditTag(member); }}
                  style={{ fontSize: 11, color: 'var(--primary)', cursor: 'pointer', padding: '2px 6px' }}>编辑</span>
                {member.role !== 'owner' && (
                  <Tag color="danger" fill="outline" style={{ fontSize: 11, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.id, member.nickname || member.username); }}>
                    移除
                  </Tag>
                )}
              </div>
            }>
            {member.nickname || member.username}
          </List.Item>
        ))}
      </List>

      <div style={{ padding: 16, display: 'flex', gap: 8 }}>
        <Button block color="primary" fill="outline"
          onClick={() => navigate('/modules')}>
          查看储物箱
        </Button>
        <Button block color="danger" fill="outline" onClick={async () => {
          const r = await Dialog.confirm({ content: '确定删除此家庭？' });
          if (r) { await families.delete(id); navigate('/family', { replace: true }); }
        }}>删除家庭</Button>
      </div>
    </div>
  );
}
