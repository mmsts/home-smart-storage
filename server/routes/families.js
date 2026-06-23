const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../middleware/activity-logger');

router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const db = global.db;
    const rows = db.prepare(`
      SELECT f.*, fm.role, u.nickname as owner_name
      FROM family_members fm
      JOIN families f ON fm.family_id = f.id
      JOIN users u ON f.owner_id = u.id
      WHERE fm.user_id = ?
      ORDER BY fm.joined_at DESC
    `).all(req.user.id);
    res.json({ code: 0, data: rows });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

router.get('/:id', (req, res) => {
  try {
    const db = global.db;
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
    if (!family) return res.status(404).json({ code: 404, message: '家庭不存在' });

    const members = db.prepare(`
      SELECT u.id, u.username, u.nickname, u.avatar, u.age, u.gender, u.health_info,
             fm.role, fm.tag, fm.joined_at
      FROM family_members fm JOIN users u ON fm.user_id = u.id
      WHERE fm.family_id = ?
    `).all(req.params.id);

    // Get user tags
    const userTags = db.prepare('SELECT * FROM user_tags WHERE family_id = ?').all(req.params.id);
    members.forEach(m => {
      m.tags = userTags.filter(t => t.user_id === m.id);
    });

    // Get item quantity per member
    const itemOwnerStmt = db.prepare(`
      SELECT COALESCE(SUM(i.quantity), 0) as cnt FROM item_owners io
      JOIN items i ON io.item_id = i.id WHERE io.user_id = ? AND i.family_id = ?
    `);
    members.forEach(m => {
      m.item_count = itemOwnerStmt.get(m.id, req.params.id)?.cnt || 0;
    });

    // Count builtin boxes (medicine, daily) from items
    const builtinBoxCount = db.prepare(`
      SELECT COUNT(DISTINCT storage_type) as cnt FROM items
      WHERE family_id = ? AND storage_type IN ('medicine', 'daily')
    `).get(req.params.id).cnt;
    // Count custom modules created by family members
    const customModuleCount = db.prepare(`
      SELECT COUNT(DISTINCT cm.id) as cnt FROM custom_modules cm
      JOIN family_members fm ON cm.created_by = fm.user_id WHERE fm.family_id = ?
    `).get(req.params.id).cnt;
    const stats = {
      box_count: builtinBoxCount + customModuleCount,
      item_type_count: db.prepare('SELECT COUNT(*) as cnt FROM items WHERE family_id = ?').get(req.params.id).cnt,
      item_total_count: db.prepare('SELECT COALESCE(SUM(quantity), 0) as cnt FROM items WHERE family_id = ?').get(req.params.id).cnt,
      member_count: members.length
    };

    res.json({ code: 0, data: { ...family, members, stats } });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = global.db;
    const { name, address, description } = req.body;
    if (!name) return res.status(400).json({ code: 400, message: '家庭名称不能为空' });

    const result = db.prepare('INSERT INTO families (name, owner_id, address, description) VALUES (?, ?, ?, ?)')
      .run(name, req.user.id, address || null, description || null);

    db.prepare('INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, ?)')
      .run(result.lastInsertRowid, req.user.id, 'owner');

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(result.lastInsertRowid);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'create',
      targetType: 'family',
      targetId: family.id,
      targetName: family.name,
      details: { address, description },
      familyId: family.id
    });
    
    res.json({ code: 0, data: family, message: '创建成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const db = global.db;
    const { name, address, description } = req.body;
    const oldFamily = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
    
    db.prepare('UPDATE families SET name=?, address=?, description=? WHERE id=?')
      .run(name, address, description, req.params.id);
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'update',
      targetType: 'family',
      targetId: family.id,
      targetName: family.name,
      oldValue: oldFamily,
      newValue: family,
      familyId: family.id
    });
    
    res.json({ code: 0, data: family, message: '更新成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const db = global.db;
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'delete',
      targetType: 'family',
      targetId: family.id,
      targetName: family.name,
      oldValue: family,
      familyId: family.id
    });
    
    db.prepare('DELETE FROM family_members WHERE family_id = ?').run(req.params.id);
    db.prepare('DELETE FROM families WHERE id = ?').run(req.params.id);
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

router.post('/:id/members', (req, res) => {
  try {
    const db = global.db;
    const { username, role } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

    const existing = db.prepare('SELECT * FROM family_members WHERE family_id = ? AND user_id = ?')
      .get(req.params.id, user.id);
    if (existing) return res.status(400).json({ code: 400, message: '用户已在家庭中' });

    db.prepare('INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, ?)')
      .run(req.params.id, user.id, role || 'member');
    
    logActivity(db, {
      userId: req.user.id,
      action: 'add',
      targetType: 'member',
      targetId: user.id,
      targetName: user.nickname || user.username,
      details: { role: role || 'member' },
      familyId: req.params.id
    });
    
    res.json({ code: 0, message: '添加成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

router.put('/:id/members/:userId', (req, res) => {
  try {
    const db = global.db;
    const { role, tag } = req.body;
    const oldMember = db.prepare('SELECT * FROM family_members WHERE family_id = ? AND user_id = ?')
      .get(req.params.id, req.params.userId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
    
    db.prepare('UPDATE family_members SET role = ?, tag = ? WHERE family_id = ? AND user_id = ?')
      .run(role, tag || null, req.params.id, req.params.userId);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'update',
      targetType: 'member',
      targetId: user.id,
      targetName: user.nickname || user.username,
      details: { role, tag },
      oldValue: oldMember,
      newValue: { ...oldMember, role, tag },
      familyId: req.params.id
    });
    
    res.json({ code: 0, message: '更新成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

router.delete('/:id/members/:userId', (req, res) => {
  try {
    const db = global.db;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
    
    logActivity(db, {
      userId: req.user.id,
      action: 'remove',
      targetType: 'member',
      targetId: user.id,
      targetName: user.nickname || user.username,
      familyId: req.params.id
    });
    
    db.prepare('DELETE FROM family_members WHERE family_id = ? AND user_id = ?')
      .run(req.params.id, req.params.userId);
    res.json({ code: 0, message: '移除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ===== 用户标签功能 =====

// 自动打标签规则
const AUTO_TAG_RULES = [
  // 高血压
  { keywords: ['降压', '血压', '高血压', '硝苯地平', '氨氯地平', '缬沙坦', '厄贝沙坦', '美托洛尔', '氢氯噻嗪', '卡托普利', '依那普利'],
    tag: '高血压', desc: '需要定期服用降压药', type: 'health' },
  // 糖尿病
  { keywords: ['血糖', '糖尿病', '胰岛素', '二甲双胍', '格列齐特', '阿卡波糖', '血糖仪', '血糖试纸'],
    tag: '糖尿病', desc: '需要定期监测血糖', type: 'health' },
  // 心脏病
  { keywords: ['心脏', '心绞痛', '阿司匹林', '硝酸甘油', '速效救心丸', '丹参滴丸', '复方丹参'],
    tag: '心脏不适', desc: '注意心脏健康', type: 'health' },
  // 过敏体质
  { keywords: ['过敏', '抗过敏', '氯雷他定', '西替利嗪', '扑尔敏', '鼻炎', '哮喘'],
    tag: '过敏体质', desc: '注意过敏原', type: 'health' },
  // 敏感肌
  { keywords: ['敏感肌', '敏感肌肤', '温和', '无刺激', '舒缓', '修复霜', '屏障修复'],
    tag: '敏感肌', desc: '使用温和护肤品', type: 'lifestyle' },
  // 关节/骨骼
  { keywords: ['关节', '骨质', '钙片', '氨糖', '风湿', '腰椎', '颈椎', '膏药', '止痛贴'],
    tag: '关节不适', desc: '注意关节保养', type: 'health' },
  // 胃肠
  { keywords: ['胃药', '胃痛', '健胃', '奥美拉唑', '吗丁啉', '胃炎', '肠炎', '益生菌', '便秘', '腹泻'],
    tag: '胃肠敏感', desc: '注意饮食调理', type: 'health' },
  // 眼睛
  { keywords: ['眼药水', '近视', '隐形眼镜', '护眼', '叶黄素', '眼贴'],
    tag: '用眼过度', desc: '注意保护视力', type: 'health' },
  // 母婴
  { keywords: ['婴儿', '奶粉', '尿不湿', '奶瓶', '辅食', '孕妇', '哺乳'],
    tag: '母婴用品', desc: '宝宝/孕妈专用', type: 'lifestyle' },
  // 宠物
  { keywords: ['猫粮', '狗粮', '宠物', '猫砂', '驱虫', '狗链'],
    tag: '养宠家庭', desc: '有宠物的家庭', type: 'lifestyle' },
  // 运动健身
  { keywords: ['蛋白粉', '运动', '健身', '瑜伽', '弹力带', '哑铃', '筋膜枪'],
    tag: '运动健身', desc: '热爱运动', type: 'lifestyle' },
];

// 分析用户物品并生成标签
function analyzeUserTags(db, familyId, userId) {
  const items = db.prepare(`
    SELECT i.name, i.notes, c.name as category_name, c.storage_type
    FROM items i
    JOIN item_owners io ON io.item_id = i.id
    LEFT JOIN categories c ON i.category_id = c.id
    WHERE io.user_id = ? AND i.family_id = ? AND i.status = 'in_use'
  `).all(userId, familyId);

  const detected = [];
  for (const rule of AUTO_TAG_RULES) {
    const matchCount = items.filter(item => {
      const text = `${item.name} ${item.notes || ''} ${item.category_name || ''}`.toLowerCase();
      return rule.keywords.some(kw => text.includes(kw));
    }).length;
    if (matchCount >= 1) {
      detected.push({ tag_text: rule.tag, tag_type: rule.type, desc: rule.desc, matchCount });
    }
  }
  return detected;
}

// GET /:id/tags — 获取家庭所有成员的标签
router.get('/:id/tags', (req, res) => {
  try {
    const db = global.db;
    const tags = db.prepare(`
      SELECT ut.*, u.nickname, u.username
      FROM user_tags ut
      JOIN users u ON ut.user_id = u.id
      WHERE ut.family_id = ?
      ORDER BY ut.user_id, ut.tag_type, ut.created_at
    `).all(req.params.id);
    res.json({ code: 0, data: tags });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// POST /:id/auto-tags — 自动分析并打标签
router.post('/:id/auto-tags', (req, res) => {
  try {
    const db = global.db;
    const members = db.prepare('SELECT user_id FROM family_members WHERE family_id = ?')
      .all(req.params.id);

    const insertTag = db.prepare(`
      INSERT OR IGNORE INTO user_tags (family_id, user_id, tag_type, tag_text, is_auto)
      VALUES (?, ?, ?, ?, 1)
    `);

    let totalAdded = 0;
    for (const member of members) {
      const detected = analyzeUserTags(db, req.params.id, member.user_id);
      for (const tag of detected) {
        const result = insertTag.run(req.params.id, member.user_id, tag.tag_type, tag.tag_text);
        if (result.changes > 0) totalAdded++;
      }
    }

    res.json({ code: 0, data: { added: totalAdded }, message: totalAdded > 0 ? `已自动生成 ${totalAdded} 个标签` : '暂无新的标签可以生成' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// POST /:id/members/:userId/tags — 手动添加标签
router.post('/:id/members/:userId/tags', (req, res) => {
  try {
    const db = global.db;
    const { tag_text, tag_type } = req.body;
    if (!tag_text) return res.status(400).json({ code: 400, message: '标签内容不能为空' });

    db.prepare(`INSERT OR IGNORE INTO user_tags (family_id, user_id, tag_type, tag_text, is_auto)
      VALUES (?, ?, ?, ?, 0)`)
      .run(req.params.id, req.params.userId, tag_type || 'custom', tag_text);

    const tags = db.prepare('SELECT * FROM user_tags WHERE family_id = ? AND user_id = ?')
      .all(req.params.id, req.params.userId);
    res.json({ code: 0, data: tags, message: '添加成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// DELETE /:id/members/:userId/tags/:tagId — 删除标签
router.delete('/:id/members/:userId/tags/:tagId', (req, res) => {
  try {
    const db = global.db;
    db.prepare('DELETE FROM user_tags WHERE id = ? AND family_id = ? AND user_id = ?')
      .run(req.params.tagId, req.params.id, req.params.userId);
    res.json({ code: 0, message: '删除成功' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

module.exports = router;
