import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchBar, Empty, Tag } from 'antd-mobile'
import { search } from '../api'

const typeLabels = { medicine: '药箱', daily: '日化', custom: '自定义' };

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try { setResults((await search.query({ q })).data); } catch (e) { setResults(null); }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.3px' }}>搜索</h2>
      <SearchBar placeholder="搜索物品名称、品牌、标签..." value={query}
        onChange={setQuery} onSearch={doSearch} onClear={() => setResults(null)}
        style={{ marginBottom: 16 }} />

      {results ? (
        results.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ color: 'var(--text-hint)', fontSize: 15 }}>没有找到相关物品</p>
          </div>
        ) : (
          results.map(item => (
            <div key={item.id} className="list-item-card" onClick={() => navigate(`/items/${item.id}`)}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
                {item.category_icon && <span style={{ marginRight: 4 }}>{item.category_icon}</span>}
                {item.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4 }}>
                {typeLabels[item.storage_type]} · {item.category_name || '未分类'}
                {item.brand && ` · ${item.brand}`}
              </div>
              {item.tags?.length > 0 && (
                <div className="tag-list">{item.tags.map((t, i) => <span key={i} className="tag-item">{t}</span>)}</div>
              )}
            </div>
          ))
        )
      ) : (
        <div style={{
          textAlign: 'center', padding: '80px 24px',
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>搜索物品</h3>
          <p style={{ color: 'var(--text-hint)', fontSize: 14 }}>输入关键词搜索物品名称、品牌、标签</p>
        </div>
      )}
    </div>
  );
}
