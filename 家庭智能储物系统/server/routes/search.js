const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const db = global.db;
    const { q, family_id } = req.query;
    if (!q) return res.json({ code: 0, data: [] });

    const keyword = `%${q}%`;
    const field = family_id ? 'family_id' : 'created_by';
    const id = family_id || req.user.id;

    const items = db.prepare(`
      SELECT DISTINCT i.*, c.name as category_name, c.icon as category_icon
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN item_tags t ON t.item_id = i.id
      WHERE i.${field} = ?
      AND (i.name LIKE ? OR i.brand LIKE ? OR i.model LIKE ? OR i.notes LIKE ? OR t.tag LIKE ?)
      LIMIT 20
    `).all(id, keyword, keyword, keyword, keyword, keyword);

    const tagStmt = db.prepare('SELECT tag FROM item_tags WHERE item_id = ?');
    const itemsWithTags = items.map(item => ({
      ...item,
      tags: tagStmt.all(item.id).map(t => t.tag)
    }));

    res.json({ code: 0, data: itemsWithTags });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

module.exports = router;
