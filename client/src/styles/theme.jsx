import React from 'react';

// ===== 家庭智能储物系统 — 设计系统 =====
// 气质：米白 · 黑白线条 · 克制 · 有温度

// ===== 色彩 =====

export const statusMap = {
  in_use:    { color: '#5A9E6F', label: '使用中' },
  pending:   { color: '#4A90E2', label: '待使用' },
  empty:     { color: '#CCCCCC', label: '已用完' },
  discarded: { color: '#D4915A', label: '已丢弃' },
  donated:   { color: '#8A7FB0', label: '已捐赠' },
  lent:      { color: '#6B8DAD', label: '已借出' },
  expired:   { color: '#C4554D', label: '已过期' },
  damaged:   { color: '#D4915A', label: '已损坏' },
  lost:      { color: '#C4554D', label: '已丢失' },
};

export const typeColors = {
  medicine: '#C4554D',
  daily:    '#5A9E6F',
  custom:   '#AAAAAA',
};

export const typeColorsLight = {
  medicine: '#FDF5F3',
  daily:    '#F2F8F4',
  custom:   '#F0F0F0',
};

export const typeLabels = {
  medicine: '药品',
  daily:    '日化',
  custom:   '自定义',
};

export const candyColors = [
  '#C4554D', '#D4915A', '#5A9E6F', '#5B7FA5',
  '#8A7FB0', '#5A9E9E', '#B07070', '#7A8A5A',
];

export const chartColors = candyColors;

export const colorOptions = [
  '#C4554D', '#D4915A', '#5A9E6F', '#5B7FA5',
  '#8A7FB0', '#5A9E9E', '#B07070', '#7A8A5A',
];

export const actionColors = {
  create:  '#5A9E6F',
  update:  '#5B7FA5',
  delete:  '#C4554D',
  add:     '#5A9E6F',
  remove:  '#C4554D',
  dismiss: '#D4915A',
};

export const quickActionBgs = [
  '#F5EEEC', '#ECF3EE', '#F0EDE8', '#EDEAF2',
];

// ===== SVG 线条图标 =====

export const icons = {
  medicine: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="14" y="4" width="20" height="40" rx="6" />
      <line x1="14" y1="18" x2="34" y2="18" />
      <line x1="24" y1="18" x2="24" y2="32" />
      <line x1="18" y1="25" x2="30" y2="25" />
    </svg>
  ),
  daily: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="16" y="20" width="16" height="22" rx="4" />
      <path d="M20 20V14C20 12 22 8 24 8C26 8 28 12 28 14V20" />
      <circle cx="24" cy="32" r="3" />
    </svg>
  ),
  box: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="14" width="36" height="28" rx="4" />
      <path d="M6 14L24 6L42 14" />
      <line x1="24" y1="6" x2="24" y2="42" />
    </svg>
  ),
  chart: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="24" width="8" height="16" rx="2" />
      <rect x="20" y="16" width="8" height="24" rx="2" />
      <rect x="32" y="10" width="8" height="30" rx="2" />
    </svg>
  ),
  home: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22L24 6L42 22" />
      <rect x="10" y="22" width="28" height="20" rx="2" />
      <rect x="20" y="30" width="8" height="12" rx="1" />
    </svg>
  ),
  family: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="14" r="5" />
      <circle cx="32" cy="14" r="5" />
      <path d="M6 38C6 30 10 26 16 26C22 26 24 28 24 28C24 28 26 26 32 26C38 26 42 30 42 38" />
      <circle cx="24" cy="18" r="4" />
    </svg>
  ),
  edit: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 40H42" />
      <path d="M34 8L40 14L16 38L8 40L10 32L34 8Z" />
    </svg>
  ),
  ai: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="10" width="32" height="28" rx="6" />
      <circle cx="18" cy="24" r="2.5" fill="currentColor" />
      <circle cx="30" cy="24" r="2.5" fill="currentColor" />
      <path d="M18 32C20 34 28 34 30 32" />
      <path d="M16 10V6" />
      <path d="M32 10V6" />
    </svg>
  ),
  camera: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="12" width="40" height="28" rx="4" />
      <circle cx="24" cy="26" r="8" />
      <circle cx="24" cy="26" r="3" />
      <path d="M16 12L18 6H30L32 12" />
    </svg>
  ),
  scan: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14V8C6 6.9 6.9 6 8 6H14" />
      <path d="M34 6H40C41.1 6 42 6.9 42 8V14" />
      <path d="M42 34V40C42 41.1 41.1 42 40 42H34" />
      <path d="M14 42H8C6.9 42 6 41.1 6 40V34" />
      <line x1="6" y1="20" x2="42" y2="20" />
      <line x1="6" y1="28" x2="42" y2="28" />
    </svg>
  ),
  user: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="16" r="8" />
      <path d="M8 42C8 32 14 26 24 26C34 26 40 32 40 42" />
    </svg>
  ),
  search: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="22" cy="22" r="12" />
      <line x1="31" y1="31" x2="42" y2="42" />
    </svg>
  ),
  bell: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 36C18 40 20 42 24 42C28 42 30 40 30 36" />
      <path d="M8 30C8 22 12 14 24 10C36 14 40 22 40 30H8Z" />
      <line x1="24" y1="4" x2="24" y2="10" />
    </svg>
  ),
  warning: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="18" />
      <line x1="24" y1="14" x2="24" y2="28" />
      <circle cx="24" cy="34" r="1.5" fill="currentColor" />
    </svg>
  ),
  folder: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14V40C6 41.1 6.9 42 8 42H40C41.1 42 42 41.1 42 40V18C42 16.9 41.1 16 40 16H24L20 10H8C6.9 10 6 10.9 6 12V14Z" />
    </svg>
  ),
  tag: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 28L22 12H42V32L26 42L6 28Z" />
      <circle cx="34" cy="20" r="3" />
    </svg>
  ),
  lock: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="10" y="20" width="28" height="22" rx="4" />
      <path d="M16 20V14C16 10.7 19.6 8 24 8C28.4 8 32 10.7 32 14V20" />
      <circle cx="24" cy="32" r="3" fill="currentColor" />
    </svg>
  ),
  log: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="4" width="32" height="40" rx="4" />
      <line x1="16" y1="14" x2="32" y2="14" />
      <line x1="16" y1="22" x2="32" y2="22" />
      <line x1="16" y1="30" x2="26" y2="30" />
    </svg>
  ),
  plus: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="24" y1="10" x2="24" y2="38" />
      <line x1="10" y1="24" x2="38" y2="24" />
    </svg>
  ),
  pencil: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M34 8L40 14L16 38L8 40L10 32L34 8Z" />
      <line x1="30" y1="12" x2="36" y2="18" />
    </svg>
  ),
  trash: (
    <svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 14H36" />
      <path d="M16 14V10C16 8.9 16.9 8 18 8H30C31.1 8 32 8.9 32 10V14" />
      <path d="M14 14L16 40H32L34 14" />
      <line x1="20" y1="22" x2="20" y2="34" />
      <line x1="28" y1="22" x2="28" y2="34" />
    </svg>
  ),
};

// ===== SVG 线条插画 =====

export const illustrations = {
  emptyBox: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
      <rect x="10" y="28" width="60" height="40" rx="4" />
      <path d="M10 28L40 12L70 28" />
      <line x1="40" y1="12" x2="40" y2="68" />
      <line x1="10" y1="48" x2="70" y2="48" />
      <circle cx="28" cy="38" r="3" strokeDasharray="2 3" />
      <circle cx="52" cy="38" r="3" strokeDasharray="2 3" />
    </svg>
  ),
  homeScene: (
    <svg width="200" height="140" viewBox="0 0 200 140" fill="none" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.12">
      <path d="M30 80L80 40L130 80" />
      <rect x="38" y="80" width="84" height="50" rx="2" />
      <rect x="72" y="98" width="20" height="32" rx="1" />
      <rect x="48" y="90" width="16" height="12" rx="1" />
      <rect x="98" y="90" width="16" height="12" rx="1" />
      <rect x="140" y="95" width="30" height="22" rx="3" />
      <path d="M140 95L155 85L170 95" />
      <line x1="155" y1="85" x2="155" y2="117" />
      <rect x="148" y="120" width="30" height="22" rx="3" />
      <path d="M148 120L163 110L178 120" />
      <line x1="163" y1="110" x2="163" y2="142" />
      <line x1="20" y1="130" x2="20" y2="110" />
      <circle cx="20" cy="105" r="8" />
      <line x1="20" y1="130" x2="20" y2="140" />
    </svg>
  ),
  medicineBottle: (
    <svg width="60" height="72" viewBox="0 0 60 72" fill="none" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2">
      <rect x="14" y="18" width="32" height="48" rx="6" />
      <path d="M22 18V10C22 8 24 4 30 4C36 4 38 8 38 10V18" />
      <line x1="14" y1="32" x2="46" y2="32" />
      <line x1="30" y1="32" x2="30" y2="50" />
      <line x1="22" y1="41" x2="38" y2="41" />
    </svg>
  ),
  storageBox: (
    <svg width="72" height="56" viewBox="0 0 72 56" fill="none" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2">
      <rect x="4" y="16" width="64" height="36" rx="4" />
      <path d="M4 16L36 4L68 16" />
      <line x1="36" y1="4" x2="36" y2="52" />
      <circle cx="22" cy="34" r="4" />
      <circle cx="50" cy="34" r="4" />
    </svg>
  ),
  chartIllustration: (
    <svg width="80" height="64" viewBox="0 0 80 64" fill="none" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15">
      <rect x="8" y="36" width="14" height="22" rx="3" />
      <rect x="27" y="24" width="14" height="34" rx="3" />
      <rect x="46" y="16" width="14" height="42" rx="3" />
      <rect x="65" y="28" width="8" height="30" rx="2" />
    </svg>
  ),
  aiAssistant: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15">
      <rect x="12" y="18" width="56" height="44" rx="10" />
      <circle cx="30" cy="38" r="4" fill="#AAAAAA" />
      <circle cx="50" cy="38" r="4" fill="#AAAAAA" />
      <path d="M30 50C34 54 46 54 50 50" />
      <path d="M28 18V10" />
      <path d="M52 18V10" />
      <circle cx="28" cy="6" r="3" />
      <circle cx="52" cy="6" r="3" />
    </svg>
  ),
};

// ===== 共享 Hero Header 组件 =====

export function HeroHeader({ title, subtitle, onBack, icon, children }) {
  return (
    <div style={{
      background: '#FFFFFF',
      color: '#222222',
      padding: '20px 20px 28px',
      borderRadius: '0 0 24px 24px',
      margin: '-16px -16px 20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '50%', right: 16,
        transform: 'translateY(-50%)', opacity: 0.06, pointerEvents: 'none',
        fontSize: 80, lineHeight: 0, color: '#AAAAAA'
      }}>
        {icon || illustrations.storageBox}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        {onBack && (
          <span onClick={onBack} style={{
            cursor: 'pointer', marginRight: 12, fontSize: 18, opacity: 0.7,
            padding: '4px 0'
          }}>←</span>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ opacity: 0.5, fontSize: 13, margin: '3px 0 0' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {children && (
        <div style={{ position: 'relative', zIndex: 1, marginTop: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}
