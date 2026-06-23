
function logActivity(db, {
  userId,
  action,
  targetType,
  targetId = null,
  targetName = null,
  details = null,
  oldValue = null,
  newValue = null,
  familyId = null
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO activity_logs (
        user_id, action, target_type, target_id, target_name,
        details, old_value, new_value, family_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    stmt.run(
      userId,
      action,
      targetType,
      targetId,
      targetName,
      details ? JSON.stringify(details) : null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      familyId
    );
  } catch (e) {
    console.error('记录操作日志失败:', e);
  }
}

module.exports = { logActivity };
