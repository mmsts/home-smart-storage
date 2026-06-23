const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Built-in boxes definition
const BUILTIN_BOXES = [
  { id: 'medicine', name: '药箱', icon: '💊', color: '#EF4444', description: '药品与医疗用品', is_builtin: true },
  { id: 'daily', name: '日化', icon: '🧴', color: '#10B981', description: '洗护日化用品', is_builtin: true },
];

// GET /api/boxes — list all boxes (builtin + custom)
router.get('/', (req, res) => {
  try {
    const db = global.db;
    const homeOnly = req.query.home === '1';

    // Get user's builtin box display settings
    const userSettings = {};
    db.prepare('SELECT box_id, show_on_home FROM user_box_settings WHERE user_id = ?')
      .all(req.user.id)
      .forEach(s => { userSettings[s.box_id] = s.show_on_home; });

    // Get item counts for builtin boxes
    let builtinWithCount = BUILTIN_BOXES.map(box => {
      const row = db.prepare(
        'SELECT COUNT(*) as cnt FROM items WHERE storage_type = ? AND created_by = ?'
      ).get(box.id, req.user.id);
      const showOnHome = box.id in userSettings ? userSettings[box.id] !== 0 : true;
      return { ...box, item_count: row.cnt || 0, type: 'builtin', show_on_home: showOnHome };
    });

    // Get custom modules as boxes
    const customRows = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM items i WHERE i.module_id = m.id) as item_count
      FROM custom_modules m WHERE m.created_by = ? ORDER BY m.created_at DESC
    `).all(req.user.id);
    const customBoxes = customRows.map(m => ({
      id: `custom_${m.id}`, real_id: m.id, name: m.name, icon: m.icon, color: m.color,
      description: m.description, item_count: m.item_count || 0, is_builtin: false, type: 'custom',
      show_on_home: m.show_on_home !== 0
    }));

    let allBoxes = [...builtinWithCount, ...customBoxes];
    if (homeOnly) {
      allBoxes = allBoxes.filter(b => b.show_on_home);
    }

    res.json({ code: 0, data: allBoxes });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// GET /api/boxes/:id — get single box with items
router.get('/:id', (req, res) => {
  try {
    const db = global.db;
    const boxId = req.params.id;

    // Check if builtin
    const builtin = BUILTIN_BOXES.find(b => b.id === boxId);
    if (builtin) {
      const items = db.prepare(`
        SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM items i LEFT JOIN categories c ON i.category_id = c.id
        WHERE i.storage_type = ? AND i.created_by = ?
        ORDER BY i.updated_at DESC
      `).all(boxId, req.user.id);
      const tagStmt = db.prepare('SELECT tag FROM item_tags WHERE item_id = ?');
      const itemsWithTags = items.map(item => ({ ...item, tags: tagStmt.all(item.id).map(t => t.tag) }));
      return res.json({ code: 0, data: { ...builtin, items: itemsWithTags, type: 'builtin' } });
    }

    // Custom module box: id format is "custom_N"
    const realId = boxId.replace('custom_', '');
    const module = db.prepare('SELECT * FROM custom_modules WHERE id = ? AND created_by = ?')
      .get(realId, req.user.id);
    if (!module) return res.status(404).json({ code: 404, message: '箱子不存在' });

    const items = db.prepare(`
      SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM items i LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.module_id = ?
      ORDER BY i.updated_at DESC
    `).all(realId);
    const tagStmt = db.prepare('SELECT tag FROM item_tags WHERE item_id = ?');
    const itemsWithTags = items.map(item => ({ ...item, tags: tagStmt.all(item.id).map(t => t.tag) }));

    res.json({ code: 0, data: { id: boxId, real_id: module.id, name: module.name, icon: module.icon, color: module.color, description: module.description, items: itemsWithTags, is_builtin: false, type: 'custom' } });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// POST /api/boxes — create custom box
router.post('/', (req, res) => {
  try {
    const db = global.db;
    const { name, icon, color, description } = req.body;
    if (!name) return res.status(400).json({ code: 400, message: '箱子名称不能为空' });
    const result = db.prepare(
      'INSERT INTO custom_modules (name, icon, color, description, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(name, icon || '📦', color || '#4F6EF7', description || '', req.user.id);
    const module = db.prepare('SELECT * FROM custom_modules WHERE id = ?').get(result.lastInsertRowid);
    res.json({ code: 0, data: { id: `custom_${module.id}`, real_id: module.id, ...module, is_builtin: false, type: 'custom' }, message: '创建成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// PUT /api/boxes/:id — update box (custom only)
router.put('/:id', (req, res) => {
  try {
    const db = global.db;
    const boxId = req.params.id;
    const builtin = BUILTIN_BOXES.find(b => b.id === boxId);
    if (builtin) return res.status(400).json({ code: 400, message: '内置箱子不可修改' });

    const realId = boxId.replace('custom_', '');
    const { name, icon, color, description } = req.body;
    db.prepare('UPDATE custom_modules SET name=?, icon=?, color=?, description=? WHERE id=? AND created_by=?')
      .run(name, icon, color, description, realId, req.user.id);
    const module = db.prepare('SELECT * FROM custom_modules WHERE id = ?').get(realId);
    res.json({ code: 0, data: { id: boxId, real_id: module.id, ...module, is_builtin: false, type: 'custom' }, message: '更新成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// DELETE /api/boxes/:id — delete box (custom only)
router.delete('/:id', (req, res) => {
  try {
    const db = global.db;
    const boxId = req.params.id;
    const builtin = BUILTIN_BOXES.find(b => b.id === boxId);
    if (builtin) return res.status(400).json({ code: 400, message: '内置箱子不可删除' });

    const realId = boxId.replace('custom_', '');
    // Unlink items: clear module_id and reset storage_type
    const memberRow = db.prepare('SELECT family_id FROM family_members WHERE user_id = ? LIMIT 1').get(req.user.id);
    const familyId = memberRow?.family_id;
    if (familyId) {
      db.prepare('UPDATE items SET module_id = NULL, storage_type = NULL, family_id = COALESCE(family_id, ?) WHERE module_id = ?')
        .run(familyId, realId);
    } else {
      db.prepare('UPDATE items SET module_id = NULL, storage_type = NULL WHERE module_id = ?').run(realId);
    }
    db.prepare('DELETE FROM custom_modules WHERE id = ? AND created_by = ?').run(realId, req.user.id);
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// PATCH /api/boxes/:id/home — toggle show_on_home
router.patch('/:id/home', (req, res) => {
  try {
    const db = global.db;
    const boxId = req.params.id;
    const { show_on_home } = req.body;
    const val = show_on_home ? 1 : 0;

    const builtin = BUILTIN_BOXES.find(b => b.id === boxId);
    if (builtin) {
      db.prepare(`INSERT INTO user_box_settings (user_id, box_id, show_on_home)
        VALUES (?, ?, ?) ON CONFLICT(user_id, box_id) DO UPDATE SET show_on_home = ?`)
        .run(req.user.id, boxId, val, val);
    } else {
      const realId = boxId.replace('custom_', '');
      db.prepare('UPDATE custom_modules SET show_on_home = ? WHERE id = ? AND created_by = ?')
        .run(val, realId, req.user.id);
    }
    res.json({ code: 0, message: '更新成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

module.exports = router;
