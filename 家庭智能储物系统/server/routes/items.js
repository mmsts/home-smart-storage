const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../middleware/activity-logger');

router.use(authMiddleware);

// List items (filter by storage_type, category_id, status)
router.get('/', (req, res) => {
  try {
    const db = global.db;
    const { storage_type, category_id, status, status_not, family_id, module_id } = req.query;
    const field = family_id ? 'family_id' : 'created_by';
    const id = family_id || req.user.id;

    let sql = `SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
      GROUP_CONCAT(DISTINCT u.nickname || ':' || u.id) as owners_str
      FROM items i LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN item_owners io ON io.item_id = i.id
      LEFT JOIN users u ON io.user_id = u.id
      WHERE i.${field} = ?`;
    const params = [id];

    if (storage_type) { sql += ' AND i.storage_type = ?'; params.push(storage_type); }
    if (category_id) { sql += ' AND i.category_id = ?'; params.push(category_id); }
    if (module_id) { sql += ' AND i.module_id = ?'; params.push(module_id); }
    if (status) { sql += ' AND i.status = ?'; params.push(status); }
    if (status_not) { sql += ' AND i.status != ?'; params.push(status_not); }
    sql += ' GROUP BY i.id ORDER BY i.updated_at DESC';

    const rows = db.prepare(sql).all(...params);
    const tagStmt = db.prepare('SELECT tag FROM item_tags WHERE item_id = ?');
    const items = rows.map(item => {
      const owners = item.owners_str
        ? item.owners_str.split(',').map(s => { const [nickname, id] = s.split(':'); return { id: Number(id), nickname }; })
        : [];
      delete item.owners_str;
      return { ...item, tags: tagStmt.all(item.id).map(t => t.tag), owners };
    });

    res.json({ code: 0, data: items });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Get single item
router.get('/:id', (req, res) => {
  try {
    const db = global.db;
    const item = db.prepare(`
      SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM items i LEFT JOIN categories c ON i.category_id = c.id WHERE i.id = ?
    `).get(req.params.id);
    if (!item) return res.status(404).json({ code: 404, message: '物品不存在' });

    const tags = db.prepare('SELECT tag FROM item_tags WHERE item_id = ?').all(req.params.id).map(t => t.tag);
    const owners = db.prepare(`
      SELECT u.id, u.nickname, u.avatar FROM item_owners io
      JOIN users u ON io.user_id = u.id WHERE io.item_id = ?
    `).all(req.params.id);
    res.json({ code: 0, data: { ...item, tags, owners } });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Quick quantity update
router.patch('/:id/quantity', (req, res) => {
  try {
    const db = global.db;
    const { delta, quantity } = req.body;
    const oldItem = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!oldItem) return res.status(404).json({ code: 404, message: '物品不存在' });

    let newQty;
    if (quantity !== undefined) {
      newQty = Math.max(0, parseInt(quantity) || 0);
    } else if (delta !== undefined) {
      newQty = Math.max(0, (oldItem.quantity || 0) + parseInt(delta));
    } else {
      return res.status(400).json({ code: 400, message: '请提供 delta 或 quantity' });
    }

    db.prepare(`UPDATE items SET quantity=?, last_used_at=datetime('now','localtime'), updated_at=datetime('now','localtime') WHERE id=?`)
      .run(newQty, req.params.id);

    logActivity(db, {
      userId: req.user.id,
      action: 'update',
      targetType: 'item',
      targetId: parseInt(req.params.id),
      targetName: oldItem.name,
      details: { type: 'quantity_update', quantity: { old: oldItem.quantity, new: newQty } },
      oldValue: { quantity: oldItem.quantity },
      newValue: { quantity: newQty },
      familyId: oldItem.family_id
    });

    const item = db.prepare(`
      SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM items i LEFT JOIN categories c ON i.category_id = c.id WHERE i.id = ?
    `).get(req.params.id);

    res.json({ code: 0, data: item, message: '已更新' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Create item
router.post('/', (req, res) => {
  try {
    const db = global.db;
    const { name, category_id, storage_type, module_id, quantity, unit, production_date, purchase_date,
      expiry_date, warranty_date, status, brand, model, notes, family_id, tags, owners, image } = req.body;
    if (!name) return res.status(400).json({ code: 400, message: '物品名称不能为空' });

    let finalType = storage_type;
    if (!finalType && category_id) {
      const cat = db.prepare('SELECT storage_type FROM categories WHERE id = ?').get(category_id);
      if (cat) finalType = cat.storage_type;
    }
    if (!finalType) finalType = 'custom';

    // Auto-assign to user's first family if no family_id provided
    let finalFamilyId = family_id;
    if (!finalFamilyId) {
      const memberRow = db.prepare('SELECT family_id FROM family_members WHERE user_id = ? LIMIT 1').get(req.user.id);
      if (memberRow) finalFamilyId = memberRow.family_id;
    }

    const result = db.prepare(`
      INSERT INTO items (name, category_id, storage_type, module_id, quantity, unit, production_date, purchase_date,
        expiry_date, warranty_date, status, brand, model, notes, family_id, created_by, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, category_id || null, finalType, module_id || null, quantity || 1, unit || '个',
      production_date || null, purchase_date || null, expiry_date || null,
      warranty_date || null, status || 'in_use', brand || null, model || null,
      notes || null, finalFamilyId || null, req.user.id, image || null);

    const itemId = result.lastInsertRowid;

    if (tags && tags.length > 0) {
      const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag) VALUES (?, ?)');
      for (const tag of tags) { insertTag.run(itemId, tag); }
    }

    if (owners && owners.length > 0) {
      const insertOwner = db.prepare('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)');
      for (const userId of owners) { insertOwner.run(itemId, userId); }
    } else {
      // Default: assign to creator
      db.prepare('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)').run(itemId, req.user.id);
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'create',
      targetType: 'item',
      targetId: itemId,
      targetName: name,
      details: { quantity: quantity || 1, unit: unit || '个', brand, model },
      familyId: finalFamilyId
    });
    
    res.json({ code: 0, data: item, message: '创建成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Update item
router.put('/:id', (req, res) => {
  try {
    const db = global.db;
    const { name, category_id, storage_type, module_id, quantity, unit, production_date, purchase_date,
      expiry_date, warranty_date, status, brand, model, notes, tags, owners, image } = req.body;

    const oldItem = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!oldItem) return res.status(404).json({ code: 404, message: '物品不存在' });

    let finalType = storage_type;
    if (!finalType && category_id) {
      const cat = db.prepare('SELECT storage_type FROM categories WHERE id = ?').get(category_id);
      if (cat) finalType = cat.storage_type;
    }
    if (!finalType) finalType = 'custom';

    db.prepare(`
      UPDATE items SET name=?, category_id=?, storage_type=?, module_id=?, quantity=?, unit=?, production_date=?,
        purchase_date=?, expiry_date=?, warranty_date=?, status=?, brand=?, model=?, notes=?, image=?,
        updated_at=datetime('now','localtime') WHERE id=?
    `).run(name, category_id || null, finalType, module_id || null, quantity, unit, production_date || null,
      purchase_date || null, expiry_date || null, warranty_date || null,
      status, brand, model, notes, image !== undefined ? image : oldItem.image, req.params.id);

    if (tags !== undefined) {
      db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(req.params.id);
      if (tags.length > 0) {
        const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag) VALUES (?, ?)');
        for (const tag of tags) { insertTag.run(req.params.id, tag); }
      }
    }

    if (owners !== undefined) {
      db.prepare('DELETE FROM item_owners WHERE item_id = ?').run(req.params.id);
      if (owners.length > 0) {
        const insertOwner = db.prepare('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)');
        for (const userId of owners) { insertOwner.run(req.params.id, userId); }
      }
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    
    const changes = {};
    if (oldItem.quantity !== quantity) changes.quantity = { old: oldItem.quantity, new: quantity };
    if (oldItem.name !== name) changes.name = { old: oldItem.name, new: name };
    if (oldItem.status !== status) changes.status = { old: oldItem.status, new: status };
    
    logActivity(db, {
      userId: req.user.id,
      action: 'update',
      targetType: 'item',
      targetId: req.params.id,
      targetName: name,
      details: changes,
      oldValue: { quantity: oldItem.quantity, name: oldItem.name, status: oldItem.status },
      newValue: { quantity, name, status },
      familyId: oldItem.family_id
    });
    
    res.json({ code: 0, data: item, message: '更新成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Delete item
router.delete('/:id', (req, res) => {
  try {
    const db = global.db;
    const oldItem = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    
    db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(req.params.id);
    db.prepare('DELETE FROM item_owners WHERE item_id = ?').run(req.params.id);
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    
    if (oldItem) {
      logActivity(db, {
        userId: req.user.id,
        action: 'delete',
        targetType: 'item',
        targetId: req.params.id,
        targetName: oldItem.name,
        details: { quantity: oldItem.quantity, brand: oldItem.brand },
        oldValue: oldItem,
        familyId: oldItem.family_id
      });
    }
    
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

module.exports = router;
