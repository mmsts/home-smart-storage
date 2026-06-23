const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../middleware/activity-logger');

router.use(authMiddleware);

// List user's custom modules
router.get('/', (req, res) => {
  try {
    const db = global.db;
    const rows = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM items i WHERE i.module_id = m.id) as item_count
      FROM custom_modules m WHERE m.created_by = ? ORDER BY m.created_at DESC
    `).all(req.user.id);
    res.json({ code: 0, data: rows });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Get single module with items
router.get('/:id', (req, res) => {
  try {
    const db = global.db;
    const module = db.prepare('SELECT * FROM custom_modules WHERE id = ? AND created_by = ?')
      .get(req.params.id, req.user.id);
    if (!module) return res.status(404).json({ code: 404, message: '模块不存在' });
    res.json({ code: 0, data: module });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Create module
router.post('/', (req, res) => {
  try {
    const db = global.db;
    const { name, icon, color, description } = req.body;
    if (!name) return res.status(400).json({ code: 400, message: '模块名称不能为空' });
    const result = db.prepare(
      'INSERT INTO custom_modules (name, icon, color, description, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(name, icon || '📦', color || '#4F6EF7', description || '', req.user.id);
    const module = db.prepare('SELECT * FROM custom_modules WHERE id = ?').get(result.lastInsertRowid);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'create',
      targetType: 'module',
      targetId: module.id,
      targetName: module.name,
      details: { icon, color, description }
    });
    
    res.json({ code: 0, data: module, message: '创建成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Update module
router.put('/:id', (req, res) => {
  try {
    const db = global.db;
    const { name, icon, color, description } = req.body;
    const oldModule = db.prepare('SELECT * FROM custom_modules WHERE id = ? AND created_by = ?')
      .get(req.params.id, req.user.id);
    
    db.prepare('UPDATE custom_modules SET name=?, icon=?, color=?, description=? WHERE id=? AND created_by=?')
      .run(name, icon, color, description, req.params.id, req.user.id);
    const module = db.prepare('SELECT * FROM custom_modules WHERE id = ?').get(req.params.id);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'update',
      targetType: 'module',
      targetId: module.id,
      targetName: module.name,
      oldValue: oldModule,
      newValue: module
    });
    
    res.json({ code: 0, data: module, message: '更新成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Delete module
router.delete('/:id', (req, res) => {
  try {
    const db = global.db;
    const module = db.prepare('SELECT * FROM custom_modules WHERE id = ? AND created_by = ?')
      .get(req.params.id, req.user.id);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'delete',
      targetType: 'module',
      targetId: module.id,
      targetName: module.name,
      oldValue: module
    });
    
    // Unlink items from this module, ensure they keep family_id
    const memberRow = db.prepare('SELECT family_id FROM family_members WHERE user_id = ? LIMIT 1').get(req.user.id);
    const familyId = memberRow?.family_id;
    if (familyId) {
      db.prepare('UPDATE items SET module_id = NULL, family_id = COALESCE(family_id, ?) WHERE module_id = ?')
        .run(familyId, req.params.id);
    } else {
      db.prepare('UPDATE items SET module_id = NULL WHERE module_id = ?').run(req.params.id);
    }
    db.prepare('DELETE FROM custom_modules WHERE id = ? AND created_by = ?').run(req.params.id, req.user.id);
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

module.exports = router;
