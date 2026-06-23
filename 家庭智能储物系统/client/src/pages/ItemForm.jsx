import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Picker, Toast, DatePicker, TextArea } from 'antd-mobile'
import { items as itemsApi, categories, modules as modulesApi, families } from '../api'
import { typeColors, icons } from '../styles/theme'

const unitOptions = ['个', '件', '盒', '瓶', '包', '袋', '支', '板', '罐', '条', '卷', '套'];
const statusOptions = [
  { label: '使用中', value: 'in_use' },
  { label: '待使用', value: 'pending' },
];
const typeIcons = { medicine: icons.medicine, daily: icons.daily };

function FormRow({ label, value, placeholder, onClick, right, danger }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid var(--divider)', cursor: onClick ? 'pointer' : 'default'
    }}>
      <span style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500, flexShrink: 0, width: 80 }}>{label}</span>
      <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        {right || (
          <span style={{ fontSize: 15, color: value ? 'var(--text-primary)' : 'var(--text-hint)' }}>
            {value || placeholder || '请选择'}
          </span>
        )}
        {onClick && <span style={{ color: 'var(--text-hint)', fontSize: 12 }}>›</span>}
      </div>
    </div>
  );
}

export default function ItemForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const defaultType = searchParams.get('type') || null;
  const moduleId = searchParams.get('module');

  const [cats, setCats] = useState([]);
  const [catPicker, setCatPicker] = useState(false);
  const [statusPicker, setStatusPicker] = useState(false);
  const [unitPicker, setUnitPicker] = useState(false);
  const [prodDatePicker, setProdDatePicker] = useState(false);
  const [purchaseDatePicker, setPurchaseDatePicker] = useState(false);
  const [expiryDatePicker, setExpiryDatePicker] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [customModule, setCustomModule] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [form, setForm] = useState({
    name: '', category_id: '', storage_type: defaultType, quantity: 1, unit: '个',
    production_date: null, purchase_date: null, expiry_date: null,
    warranty_date: null, status: 'in_use', brand: '', model: '', notes: '', tags: [],
    module_id: moduleId || null, owners: [], image: '', low_stock_threshold: ''
  });

  useEffect(() => {
    categories.list({ storage_type: form.storage_type }).then(res => {
      setCats(res.data.map(c => ({ label: `${c.icon || ''} ${c.name}`, value: String(c.id) })));
    });
    families.list().then(res => {
      if (res.data?.length > 0) {
        families.get(res.data[0].id).then(r => setFamilyMembers(r.data.members || [])).catch(() => {});
      }
    }).catch(() => {});
    if (moduleId) {
      modulesApi.get(moduleId).then(res => setCustomModule(res.data)).catch(() => {});
    }
    if (isEdit) {
      itemsApi.get(id).then(res => {
        const i = res.data;
        setForm({
          name: i.name || '', category_id: i.category_id ? String(i.category_id) : '',
          storage_type: i.storage_type || null, quantity: i.quantity || 1, unit: i.unit || '个',
          production_date: i.production_date ? new Date(i.production_date) : null,
          purchase_date: i.purchase_date ? new Date(i.purchase_date) : null,
          expiry_date: i.expiry_date ? new Date(i.expiry_date) : null,
          warranty_date: i.warranty_date ? new Date(i.warranty_date) : null,
          status: i.status || 'in_use', brand: i.brand || '', model: i.model || '',
          notes: i.notes || '', tags: i.tags || [], module_id: i.module_id || moduleId || null,
          owners: (i.owners || []).map(o => o.id), image: i.image || '',
          low_stock_threshold: i.low_stock_threshold != null ? String(i.low_stock_threshold) : ''
        });
      });
    }
  }, [id, form.storage_type]);

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) { setForm(f => ({ ...f, tags: [...f.tags, tag] })); setTagInput(''); }
  };
  const removeTag = (tag) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  const toggleOwner = (userId) => setForm(f => ({
    ...f, owners: f.owners.includes(userId) ? f.owners.filter(id => id !== userId) : [...f.owners, userId]
  }));
  const formatDate = (d) => d ? (d instanceof Date ? d : new Date(d)).toISOString().split('T')[0] : null;
  const displayDate = (d) => d ? formatDate(d) : null;

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return Toast.show({ content: '请选择图片文件' });
    if (file.size > 10 * 1024 * 1024) return Toast.show({ content: '图片不能超过 10MB' });
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.5);
        setForm(f => ({ ...f, image: compressed }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => setForm(f => ({ ...f, image: '' }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return Toast.show({ content: '请输入物品名称' });
    const payload = { ...form, category_id: form.category_id || null,
      module_id: form.module_id || moduleId || null,
      production_date: formatDate(form.production_date), purchase_date: formatDate(form.purchase_date),
      expiry_date: formatDate(form.expiry_date), warranty_date: formatDate(form.warranty_date),
      image: form.image || null,
      low_stock_threshold: form.low_stock_threshold ? parseInt(form.low_stock_threshold) : null };
    try {
      if (isEdit) { await itemsApi.update(id, payload); Toast.show({ icon: 'success', content: '更新成功' }); }
      else { await itemsApi.create(payload); Toast.show({ icon: 'success', content: '创建成功' }); }
      navigate(-1);
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.response?.data?.message || '操作失败，请重试' });
    }
  };

  const color = customModule?.color || typeColors[form.storage_type] || 'var(--primary)';
  const icon = customModule?.icon || typeIcons[form.storage_type] || '📦';

  return (
    <div>
      {/* Header */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '0 0 24px 24px', margin: '-16px -16px 20px', padding: '20px 16px 28px',
        color: '#222222', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)',
          opacity: 0.15, pointerEvents: 'none', fontSize: 80, lineHeight: 0, color: '#AAAAAA'
        }}>{icons.edit}</div>
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <span style={{ cursor: 'pointer', marginRight: 12, fontSize: 18, opacity: 0.7 }} onClick={() => navigate(-1)}>←</span>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>{isEdit ? '编辑物品' : '添加物品'}</h2>
            <div style={{ marginTop: 3, opacity: 0.5, fontSize: 13 }}>{customModule ? customModule.name : (isEdit ? '修改物品信息' : '记录新的物品')}</div>
          </div>
        </div>
      </div>

      {/* Image Upload */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.5px' }}>物品图片</div>
        {form.image ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={form.image} alt="物品图片" style={{
              width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12,
              display: 'block'
            }} />
            <div onClick={removeImage} style={{
              position: 'absolute', top: 8, right: 8,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, fontWeight: 700
            }}>×</div>
            <label style={{
              position: 'absolute', bottom: 8, right: 8,
              padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer'
            }}>
              更换
              <input type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
            </label>
          </div>
        ) : (
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '24px 0', border: '2px dashed var(--border)', borderRadius: 12,
            cursor: 'pointer', transition: 'border-color 0.2s',
            color: 'var(--text-hint)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span style={{ fontSize: 13 }}>点击上传图片</span>
            <span style={{ fontSize: 11 }}>支持 JPG、PNG，自动压缩</span>
            <input type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* Basic Info Card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 16px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6, fontWeight: 500 }}>物品名称 *</div>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="输入物品名称"
            style={{ border: 'none', outline: 'none', fontSize: 16, fontWeight: 600, width: '100%', color: 'var(--text-primary)', background: 'transparent' }} />
        </div>
        <FormRow label="分类" value={cats.find(c => c.value === form.category_id)?.label} onClick={() => setCatPicker(true)} />
        <FormRow label="数量" right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
              style={{ width: 48, border: 'none', outline: 'none', fontSize: 15, textAlign: 'center', background: 'var(--bg-page)', borderRadius: 6, padding: '4px 0', color: 'var(--text-primary)', fontWeight: 600 }} />
            <span onClick={() => setUnitPicker(true)} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{form.unit} ▾</span>
          </div>
        } />
      </div>

      {/* Detail Info Card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 16px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: '12px 0 4px', fontWeight: 600, letterSpacing: '0.5px' }}>详细信息</div>
        <FormRow label="品牌" right={
          <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
            placeholder="选填" style={{ border: 'none', outline: 'none', fontSize: 15, textAlign: 'right', color: 'var(--text-primary)', background: 'transparent', width: '100%' }} />
        } />
        <FormRow label="型号" right={
          <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
            placeholder="选填" style={{ border: 'none', outline: 'none', fontSize: 15, textAlign: 'right', color: 'var(--text-primary)', background: 'transparent', width: '100%' }} />
        } />
        <FormRow label="状态" value={statusOptions.find(s => s.value === form.status)?.label} onClick={() => setStatusPicker(true)} />
      </div>

      {/* Date Card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 16px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: '12px 0 4px', fontWeight: 600, letterSpacing: '0.5px' }}>日期信息</div>
        {(form.storage_type === 'medicine' || form.storage_type === 'daily') && (
          <>
            <FormRow label="生产日期" value={displayDate(form.production_date)} onClick={() => setProdDatePicker(true)} />
            <FormRow label={form.storage_type === 'medicine' ? '有效期至' : '保质期至'} value={displayDate(form.expiry_date)}
              onClick={() => setExpiryDatePicker(true)}
              danger={form.expiry_date && new Date(form.expiry_date) < new Date()} />
          </>
        )}
        {customModule && (
          <>
            <FormRow label="购买日期" value={displayDate(form.purchase_date)} onClick={() => setPurchaseDatePicker(true)} />
            <FormRow label="保质/保修期" value={displayDate(form.expiry_date)} onClick={() => setExpiryDatePicker(true)} />
          </>
        )}
      </div>

      {/* Tags Card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 16px 12px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: '12px 0 8px', fontWeight: 600, letterSpacing: '0.5px' }}>标签</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()}
            placeholder="输入标签，回车添加"
            style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', color: 'var(--text-primary)', background: 'transparent' }} />
          <button onClick={addTag} style={{
            background: `${color}15`, color: color, border: 'none', borderRadius: 8,
            padding: '0 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>添加</button>
        </div>
        {form.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {form.tags.map((t, i) => (
              <span key={i} onClick={() => removeTag(t)} style={{
                background: `${color}12`, color: color, padding: '5px 12px', borderRadius: 20,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}>{t} <span style={{ fontSize: 11, opacity: 0.6 }}>x</span></span>
            ))}
          </div>
        )}
      </div>

      {/* Owners Card */}
      {familyMembers.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 16px 12px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: '12px 0 8px', fontWeight: 600, letterSpacing: '0.5px' }}>归属人</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {familyMembers.map(m => {
              const selected = form.owners.includes(m.id);
              return (
                <div key={m.id} onClick={() => toggleOwner(m.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: selected ? `${color}15` : 'var(--bg-page)',
                  border: selected ? `1.5px solid ${color}` : '1.5px solid transparent',
                  color: selected ? color : 'var(--text-secondary)'
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                    background: selected ? color : 'var(--border)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{(m.nickname || m.username || '?')[0]}</div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.tag || m.nickname || m.username}</span>
                  {selected && <span style={{ fontSize: 11 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock Reminder Card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 16px 12px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: '12px 0 4px', fontWeight: 600, letterSpacing: '0.5px' }}>库存提醒</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0' }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>物品不足</span>
          <input type="number" min="0" value={form.low_stock_threshold}
            onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
            placeholder=""
            style={{
              width: 56, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px',
              fontSize: 15, textAlign: 'center', outline: 'none', color: 'var(--text-primary)',
              background: 'var(--bg-page)', fontWeight: 600,
            }} />
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{form.unit || '个'} 提醒</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: -4 }}>
          {form.low_stock_threshold
            ? `当前设置：库存 ≤ ${form.low_stock_threshold} ${form.unit || '个'} 时提醒补货`
            : `默认规则：库存 ≤ 1 ${form.unit || '个'} 时提醒`}
        </div>
      </div>

      {/* Notes Card */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px 16px 12px', boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: '12px 0 4px', fontWeight: 600, letterSpacing: '0.5px' }}>备注</div>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="添加备注信息..."
          rows={3} style={{
            width: '100%', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)',
            background: 'var(--bg-page)', borderRadius: 8, padding: '10px 12px', resize: 'none', lineHeight: 1.6
          }} />
      </div>

      {/* Submit Button */}
      <div style={{ padding: '0 0 24px' }}>
        <button onClick={handleSubmit} style={{
          width: '100%', height: 50, borderRadius: 14, border: 'none',
          background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
          color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          boxShadow: `0 4px 14px ${color}40`, letterSpacing: '0.5px'
        }}>
          {isEdit ? '保存修改' : '添加物品'}
        </button>
      </div>

      {/* Pickers */}
      <Picker columns={[cats]} visible={catPicker} onClose={() => setCatPicker(false)}
        onConfirm={v => setForm(f => ({ ...f, category_id: v[0] }))} />
      <Picker columns={[statusOptions]} visible={statusPicker} onClose={() => setStatusPicker(false)}
        onConfirm={v => setForm(f => ({ ...f, status: v[0] }))} />
      <Picker columns={[unitOptions.map(u => ({ label: u, value: u }))]}
        visible={unitPicker} onClose={() => setUnitPicker(false)}
        onConfirm={v => setForm(f => ({ ...f, unit: v[0] }))} />
      <DatePicker visible={prodDatePicker} onClose={() => setProdDatePicker(false)}
        onConfirm={v => setForm(f => ({ ...f, production_date: v }))} />
      <DatePicker visible={purchaseDatePicker} onClose={() => setPurchaseDatePicker(false)}
        onConfirm={v => setForm(f => ({ ...f, purchase_date: v }))} />
      <DatePicker visible={expiryDatePicker} onClose={() => setExpiryDatePicker(false)}
        onConfirm={v => setForm(f => ({ ...f, expiry_date: v }))} />
    </div>
  );
}
