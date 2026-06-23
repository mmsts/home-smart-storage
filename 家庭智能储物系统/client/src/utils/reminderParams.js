// 提醒参数工具函数

export function getReminderParams(familyId) {
  const raw = localStorage.getItem('reminderSettings');
  let settings = {};
  if (raw) {
    try { settings = JSON.parse(raw); } catch {}
  }

  const params = {};
  if (familyId) params.family_id = familyId;

  // 提醒范围模式：all / self / members
  if (settings.mode === 'self') {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) params.user_id = user.id;
  } else if (settings.mode === 'members' && Array.isArray(settings.member_ids)) {
    params.member_ids = settings.member_ids.join(',');
  }

  // 优先级过滤
  const levels = settings.priorityLevels || ['high', 'medium', 'low'];
  if (levels.length > 0 && levels.length < 3) {
    params.priority = levels.join(',');
  }

  return params;
}

export function getPriorityLevels() {
  const raw = localStorage.getItem('reminderSettings');
  if (!raw) return ['high', 'medium', 'low'];
  try {
    const s = JSON.parse(raw);
    return s.priorityLevels || ['high', 'medium', 'low'];
  } catch {
    return ['high', 'medium', 'low'];
  }
}

export function getDisplaySettings() {
  const raw = localStorage.getItem('reminderSettings');
  if (!raw) return { mode: 'all', priorityLevels: ['high', 'medium', 'low'] };
  try {
    return JSON.parse(raw);
  } catch {
    return { mode: 'all', priorityLevels: ['high', 'medium', 'low'] };
  }
}
