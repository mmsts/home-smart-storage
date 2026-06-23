const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const db = global.db;
    const { family_id } = req.query;
    const field = family_id ? 'family_id' : 'created_by';
    const id = family_id || req.user.id;

    const itemCount = db.prepare(`SELECT COUNT(*) as cnt FROM items WHERE ${field} = ?`).get(id).cnt;
    const totalQty = db.prepare(`SELECT COALESCE(SUM(quantity), 0) as total FROM items WHERE ${field} = ?`).get(id).total;

    // Storage type distribution (药箱/日化/自定义)
    const storageTypeDist = db.prepare(`
      SELECT storage_type, COUNT(*) as count FROM items WHERE ${field} = ? GROUP BY storage_type
    `).all(id);

    // Category distribution (overall, top 10)
    const categoryDist = db.prepare(`
      SELECT c.name, c.storage_type, COUNT(i.id) as count FROM items i
      JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? GROUP BY c.name ORDER BY count DESC LIMIT 10
    `).all(id);

    // Category distribution grouped by storage_type
    const categoryByStorageType = db.prepare(`
      SELECT c.name, c.storage_type, c.id as category_id, COUNT(i.id) as count
      FROM items i JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ?
      GROUP BY c.storage_type, c.id ORDER BY c.storage_type, count DESC
    `).all(id);

    // Status grouped: in_use vs unused
    const statusGrouped = db.prepare(`
      SELECT
        CASE WHEN status = 'in_use' THEN 'in_use' ELSE 'unused' END as group_key,
        COUNT(*) as count
      FROM items WHERE ${field} = ?
      GROUP BY group_key
    `).all(id);

    // Usage status: based on last_used_at (7 days threshold)
    const usageStatus = db.prepare(`
      SELECT
        CASE
          WHEN last_used_at IS NOT NULL AND last_used_at >= datetime('now', '-7 days', 'localtime')
            THEN 'active'
          ELSE 'inactive'
        END as usage_key,
        COUNT(*) as count,
        COALESCE(SUM(quantity), 0) as total_quantity
      FROM items WHERE ${field} = ? AND status = 'in_use'
      GROUP BY usage_key
    `).all(id);

    // Custom modules with item counts
    const customModules = db.prepare(`
      SELECT m.id, m.name, m.icon, m.color,
        (SELECT COUNT(*) FROM items i WHERE i.module_id = m.id AND i.${field} = ?) as item_count
      FROM custom_modules m WHERE m.created_by = ?
      ORDER BY m.name
    `).all(id, req.user.id);

    // Status distribution
    const statusDist = db.prepare(`
      SELECT status, COUNT(*) as count FROM items WHERE ${field} = ? GROUP BY status
    `).all(id);

    // Recent activity
    const recentItems = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count FROM items
      WHERE ${field} = ? AND created_at >= datetime('now', '-7 days', 'localtime')
      GROUP BY DATE(created_at) ORDER BY date
    `).all(id);

    // Expiring soon
    const expiringSoon = db.prepare(`
      SELECT i.*, c.name as category_name FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? AND i.expiry_date IS NOT NULL
      AND i.expiry_date <= date('now', '+30 days', 'localtime')
      AND i.expiry_date >= date('now', 'localtime')
      ORDER BY i.expiry_date LIMIT 10
    `).all(id);

    // Expired items count
    const expiredCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM items WHERE ${field} = ?
      AND expiry_date IS NOT NULL AND expiry_date < date('now', 'localtime')
    `).get(id).cnt;

    // Expiring soon count (within 30 days)
    const expiringSoonCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM items WHERE ${field} = ?
      AND expiry_date IS NOT NULL
      AND expiry_date <= date('now', '+30 days', 'localtime')
      AND expiry_date >= date('now', 'localtime')
    `).get(id).cnt;

    // Low stock count — only items genuinely running out
    // All types: quantity = 0 (completely used up) or quantity <= 1 (running low)
    // Exclude non-consumables (unit = '个')
    const lowStockCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM items WHERE ${field} = ?
      AND status = 'in_use' AND unit != '个'
      AND quantity <= 1
    `).get(id).cnt;

    // Box count — includes both physical boxes and custom modules (unified concept)
    const physicalBoxCount = family_id
      ? db.prepare('SELECT COUNT(*) as cnt FROM boxes WHERE family_id = ?').get(family_id).cnt
      : 0;
    const customModuleCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM custom_modules WHERE created_by = ?'
    ).get(req.user.id).cnt;
    const boxCount = physicalBoxCount + customModuleCount;

    res.json({
      code: 0,
      data: { itemCount, totalQuantity: totalQty, storageTypeDistribution: storageTypeDist,
        categoryDistribution: categoryDist, categoryByStorageType, statusDistribution: statusDist,
        statusGrouped, usageStatus, customModules,
        recentActivity: recentItems, expiringSoon, expiredCount, expiringSoonCount, lowStockCount,
        boxCount }
    });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

module.exports = router;
