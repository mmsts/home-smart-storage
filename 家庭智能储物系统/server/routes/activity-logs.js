
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const db = global.db;
    const { family_id, target_type, action, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT l.*, u.username, u.nickname, u.avatar
      FROM activity_logs l
      JOIN users u ON l.user_id = u.id
      WHERE l.user_id = ?
    `;
    const params = [req.user.id];
    
    if (family_id) {
      sql += ' OR l.family_id = ?';
      params.push(family_id);
    }
    
    if (target_type) {
      sql += ' AND l.target_type = ?';
      params.push(target_type);
    }
    
    if (action) {
      sql += ' AND l.action = ?';
      params.push(action);
    }
    
    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const logs = db.prepare(sql).all(...params);
    
    const formattedLogs = logs.map(log => ({
      id: log.id,
      user: {
        id: log.user_id,
        username: log.username,
        nickname: log.nickname,
        avatar: log.avatar
      },
      action: log.action,
      actionType: log.action,
      targetType: log.target_type,
      targetTypeId: log.target_type,
      targetId: log.target_id,
      targetName: log.target_name,
      details: log.details ? JSON.parse(log.details) : null,
      oldValue: log.old_value ? JSON.parse(log.old_value) : null,
      newValue: log.new_value ? JSON.parse(log.new_value) : null,
      familyId: log.family_id,
      ipAddress: log.ip_address,
      createdAt: log.created_at
    }));
    
    res.json({ code: 0, data: formattedLogs });
  } catch (e) {
    console.error('查询操作日志失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const db = global.db;
    const { family_id } = req.query;
    
    const field = family_id ? 'family_id' : 'user_id';
    const id = family_id || req.user.id;
    
    const totalCount = db.prepare(
      `SELECT COUNT(*) as count FROM activity_logs WHERE ${field} = ?`
    ).get(id).count;
    
    const actionStats = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM activity_logs
      WHERE ${field} = ?
      GROUP BY action
    `).all(id);
    
    const targetTypeStats = db.prepare(`
      SELECT target_type, COUNT(*) as count
      FROM activity_logs
      WHERE ${field} = ?
      GROUP BY target_type
    `).all(id);
    
    const dailyStats = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM activity_logs
      WHERE ${field} = ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 14
    `).all(id);
    
    res.json({
      code: 0,
      data: {
        totalCount,
        actionStats,
        targetTypeStats,
        dailyStats
      }
    });
  } catch (e) {
    console.error('查询操作日志统计失败:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
});

module.exports = router;
