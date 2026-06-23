const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../middleware/activity-logger');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: 'tp-cxw76msg4pzvv47icdew5lm1ouj76g4betkourqz6zighcf5',
  baseURL: 'https://token-plan-cn.xiaomimimo.com/anthropic',
});

router.use(authMiddleware);

// List reminders for user
router.get('/', (req, res) => {
  try {
    const db = global.db;
    const { family_id } = req.query;
    const reminders = db.prepare(`
      SELECT * FROM reminders
      WHERE is_dismissed = 0 AND (user_id = ? OR (user_id IS NULL AND family_id = ?))
      ORDER BY created_at DESC
    `).all(req.user.id, family_id || null);
    res.json({ code: 0, data: reminders });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Real-time reminders: query items table directly for expired / expiring soon / low stock
router.get('/realtime', (req, res) => {
  try {
    const db = global.db;
    const { family_id } = req.query;
    const field = family_id ? 'family_id' : 'created_by';
    const id = family_id || req.user.id;
    const memberIds = req.query.member_ids ? req.query.member_ids.split(',').map(Number).filter(Boolean) : [];
    const ownerFilter = memberIds.length > 0 ? ` AND i.id IN (SELECT item_id FROM item_owners WHERE user_id IN (${memberIds.map(() => '?').join(',')}))` : '';
    const ownerParams = memberIds.length > 0 ? memberIds : [];

    // 已过期
    const expired = db.prepare(`
      SELECT i.id, i.name, i.expiry_date, i.quantity, i.unit, i.image,
             c.name as category_name, c.storage_type
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? AND i.expiry_date IS NOT NULL
        AND i.expiry_date < date('now', 'localtime')
        AND i.status = 'in_use'${ownerFilter}
      ORDER BY i.expiry_date ASC
    `).all(id, ...ownerParams);

    // 即将过期（30天内）
    const expiringSoon = db.prepare(`
      SELECT i.id, i.name, i.expiry_date, i.quantity, i.unit, i.image,
             c.name as category_name, c.storage_type
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? AND i.expiry_date IS NOT NULL
        AND i.expiry_date >= date('now', 'localtime')
        AND i.expiry_date <= date('now', '+30 days', 'localtime')
        AND i.status = 'in_use'${ownerFilter}
      ORDER BY i.expiry_date ASC
    `).all(id, ...ownerParams);

    // 需补货（使用自定义阈值或默认规则）
    const lowStock = db.prepare(`
      SELECT i.id, i.name, i.expiry_date, i.quantity, i.unit, i.image, i.low_stock_threshold,
             c.name as category_name, c.storage_type
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? AND i.status = 'in_use'${ownerFilter}
        AND (
          (i.low_stock_threshold IS NOT NULL AND i.quantity <= i.low_stock_threshold)
          OR (i.low_stock_threshold IS NULL AND i.unit != '个' AND i.quantity <= 1)
        )
      ORDER BY i.quantity ASC, i.name ASC
    `).all(id, ...ownerParams);

    res.json({
      code: 0,
      data: { expired, expiringSoon, lowStock }
    });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Weekly stock update reminder: all in_use items sorted by usage frequency (activity_logs)
router.get('/weekly-stock', (req, res) => {
  try {
    const db = global.db;
    const { family_id } = req.query;
    const field = family_id ? 'family_id' : 'created_by';
    const id = family_id || req.user.id;
    const memberIds = req.query.member_ids ? req.query.member_ids.split(',').map(Number).filter(Boolean) : [];
    const ownerFilter = memberIds.length > 0 ? ` AND i.id IN (SELECT item_id FROM item_owners WHERE user_id IN (${memberIds.map(() => '?').join(',')}))` : '';
    const ownerParams = memberIds.length > 0 ? memberIds : [];

    // Get all in_use items with their last activity log update count
    const items = db.prepare(`
      SELECT i.id, i.name, i.quantity, i.unit, i.image, i.last_used_at, i.expiry_date,
             c.name as category_name, c.storage_type,
             (SELECT COUNT(*) FROM activity_logs al
              WHERE al.target_type = 'item' AND al.target_id = i.id AND al.action = 'update'
             ) as update_count
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? AND i.status = 'in_use'${ownerFilter}
      ORDER BY update_count DESC, i.last_used_at ASC NULLS FIRST, i.name ASC
    `).all(id, ...ownerParams);

    res.json({ code: 0, data: items });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// ===== 用药提醒 & 日化提醒知识库 =====
const HEALTH_REMINDER_RULES = [
  // =========================================
  //  用药类提醒
  // =========================================

  // ---- 心脑血管类 ----
  {
    tagMatch: ['高血压', '降压'],
    itemMatch: ['降压', '硝苯地平', '氨氯地平', '缬沙坦', '厄贝沙坦', '美托洛尔', '氢氯噻嗪', '卡托普利', '依那普利', '比索洛尔', '替米沙坦', '苯磺酸左氨氯地平', '非洛地平', '拉西地平'],
    type: 'medicine',
    category: '降压药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '降压药不能切开或碾碎服用，需整片吞服，否则会影响药效释放速度。',
      '降压药建议每天固定时间服用，维持血药浓度稳定。',
      '服用降压药期间避免大量食用柚子/西柚，可能增强药物副作用。',
      '降压药不可擅自停用，突然停药可能导致血压反弹升高。',
      '服用降压药期间如出现头晕、乏力，应缓慢起身，避免体位性低血压。',
    ],
  },
  {
    tagMatch: ['高血脂', '血脂'],
    itemMatch: ['他汀', '阿托伐他汀', '瑞舒伐他汀', '辛伐他汀', '非诺贝特', '血脂康', '降脂'],
    type: 'medicine',
    category: '降脂药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '他汀类降脂药建议晚上服用，因为夜间胆固醇合成活跃。',
      '服用他汀期间如出现肌肉酸痛，应及时就医检查肌酸激酶。',
      '服用降脂药期间应定期复查肝功能和血脂水平。',
      '降脂药不能替代健康饮食，仍需控制高脂肪食物摄入。',
    ],
  },
  {
    tagMatch: ['心脏不适', '心脏', '冠心病'],
    itemMatch: ['阿司匹林', '硝酸甘油', '速效救心丸', '丹参滴丸', '复方丹参', '单硝酸异山梨酯', '氯吡格雷', '麝香保心丸', '通心络'],
    type: 'medicine',
    category: '心脏用药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '硝酸甘油应舌下含服，不可吞服，起效更快。',
      '速效救心丸应舌下含服，一次10-15粒。',
      '阿司匹林肠溶片应空腹服用，整片吞服不可掰开。',
      '硝酸甘油开封后有效期缩短至6个月，需注意更换。',
      '服用抗血小板药物期间注意观察有无出血倾向（牙龈出血、皮肤瘀斑等）。',
    ],
  },
  {
    tagMatch: ['心律不齐', '房颤'],
    itemMatch: ['胺碘酮', '美托洛尔', '普罗帕酮', '华法林', '达比加群', '利伐沙班'],
    type: 'medicine',
    category: '抗凝药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '服用华法林需定期监测INR值，保持在2.0-3.0之间。',
      '服用华法林期间应保持维生素K摄入稳定，避免突然大量吃绿叶蔬菜。',
      '抗凝药物期间注意避免磕碰，出现异常出血及时就医。',
    ],
  },

  // ---- 代谢类 ----
  {
    tagMatch: ['糖尿病', '血糖'],
    itemMatch: ['胰岛素', '二甲双胍', '格列齐特', '阿卡波糖', '血糖仪', '血糖试纸', '格列美脲', '西格列汀', '利格列汀', '达格列净', '恩格列净', '吡格列酮'],
    type: 'medicine',
    category: '降糖药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '二甲双胍建议餐中或餐后服用，减少胃肠不适。',
      '血糖试纸开封后一般3个月内用完，注意密封保存。',
      '胰岛素未开封需冷藏（2-8℃），开封后室温保存不超过28天。',
      '服用阿卡波糖应在吃第一口饭时嚼碎服用，效果最佳。',
      'SGLT2类药物（达格列净、恩格列净）服用期间多饮水，注意泌尿系统卫生。',
      '定期监测糖化血红蛋白（HbA1c），目标控制在7%以下。',
    ],
  },
  {
    tagMatch: ['痛风', '尿酸'],
    itemMatch: ['秋水仙碱', '别嘌醇', '非布司他', '苯溴马隆', '碳酸氢钠'],
    type: 'medicine',
    category: '降尿酸药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '痛风急性发作时秋水仙碱应尽早服用，24小时内效果最佳。',
      '别嘌醇应从小剂量开始，逐渐加量，降低过敏风险。',
      '降尿酸药物需长期服用，不可因尿酸正常就擅自停药。',
      '服用降尿酸药期间应多饮水（每日2000ml以上），促进尿酸排泄。',
      '痛风患者应限制高嘌呤食物：动物内脏、海鲜、浓肉汤、啤酒。',
    ],
  },
  {
    tagMatch: ['甲状腺'],
    itemMatch: ['优甲乐', '左甲状腺素', '甲巯咪唑', '丙硫氧嘧啶', '甲状腺'],
    type: 'medicine',
    category: '甲状腺药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '左甲状腺素（优甲乐）应晨起空腹服用，服药后30-60分钟再进食。',
      '左甲状腺素避免与钙片、铁剂同服，需间隔4小时以上。',
      '抗甲状腺药物需定期复查甲状腺功能和血常规。',
      '服用甲巯咪唑期间如出现咽痛、发热，应立即就医检查白细胞。',
    ],
  },

  // ---- 神经精神类 ----
  {
    tagMatch: ['失眠', '睡眠'],
    itemMatch: ['褪黑素', '安眠', '安定', '佐匹克隆', '右佐匹克隆', '唑吡坦', '酸枣仁', '安神'],
    type: 'medicine',
    category: '安眠药',
    priority: 'medium',
    excludeTags: ['儿童'],
    tips: [
      '褪黑素建议睡前30分钟服用，不宜长期大量使用。',
      '处方安眠药不可自行加量或突然停药，需遵医嘱逐渐减量。',
      '服用安眠药后应立即上床，避免起床活动以防跌倒。',
      '安眠药与酒精同服有危险，服药期间禁酒。',
      '中成药安神类（如酸枣仁颗粒）建议睡前1小时服用。',
    ],
  },
  {
    tagMatch: ['头痛', '偏头痛'],
    itemMatch: ['布洛芬', '对乙酰氨基酚', '散利痛', '天麻', '正天丸', '头痛'],
    type: 'medicine',
    category: '止痛药',
    priority: 'medium',
    excludeTags: ['儿童'],
    tips: [
      '止痛药不宜空腹服用，布洛芬建议饭后服用减少胃刺激。',
      '头痛频繁发作（每月超过4次）建议就医，避免过度依赖止痛药。',
      '对乙酰氨基酚每日用量不超过2g，避免肝损伤。',
      '含有对乙酰氨基酚的感冒药不可叠加使用，防止过量。',
    ],
  },
  {
    tagMatch: ['焦虑', '抑郁'],
    itemMatch: ['舍曲林', '氟西汀', '帕罗西汀', '文拉法辛', '度洛西汀', '阿普唑仑', '黛力新'],
    type: 'medicine',
    category: '抗抑郁药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '抗抑郁药起效较慢，一般需连续服用2-4周才能见效，切勿自行停药。',
      '抗抑郁药停药需逐渐减量，突然停药可能出现头晕、恶心等戒断反应。',
      '服用SSRI类药物期间避免饮酒，可能加重嗜睡副作用。',
      '如出现情绪明显恶化或自杀想法，应立即就医。',
    ],
  },

  // ---- 消化系统类 ----
  {
    tagMatch: ['胃肠敏感', '胃肠', '胃病'],
    itemMatch: ['胃药', '奥美拉唑', '雷贝拉唑', '泮托拉唑', '吗丁啉', '健胃', '蒙脱石散', '益生菌', '藿香正气', '铝碳酸镁', '果胶铋'],
    type: 'medicine',
    category: '胃药',
    priority: 'medium',
    excludeTags: ['儿童'],
    tips: [
      '奥美拉唑应晨起空腹服用，效果最佳。',
      '蒙脱石散与其他药物需间隔2小时服用，以免影响吸收。',
      '益生菌建议用温水（≤40℃）冲服，避免高温杀死活性菌。',
      '藿香正气水含酒精，服用后请勿驾车。',
      '铝碳酸镁（达喜）建议嚼碎后服用，饭后1小时效果最佳。',
      '质子泵抑制剂（奥美拉唑等）不宜长期服用，超过8周需医生评估。',
    ],
  },
  {
    tagMatch: ['便秘'],
    itemMatch: ['开塞露', '乳果糖', '麻仁丸', '芦荟', '通便', '聚乙二醇'],
    type: 'medicine',
    category: '通便药',
    priority: 'medium',
    excludeTags: ['儿童'],
    tips: [
      '开塞露为外用制剂，不可口服。',
      '乳果糖建议早餐时一次服用，起效需1-2天。',
      '刺激性泻药（如芦荟胶囊）不宜长期使用，可能导致肠道依赖。',
      '通便药物只是辅助，增加膳食纤维和饮水才是根本。',
    ],
  },

  // ---- 呼吸系统类 ----
  {
    tagMatch: ['哮喘', '呼吸'],
    itemMatch: ['沙丁胺醇', '布地奈德', '沙美特罗', '噻托溴铵', '孟鲁司特', '氨茶碱', '吸入'],
    type: 'medicine',
    category: '呼吸系统药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '吸入性糖皮质激素（布地奈德）使用后应漱口，防止口腔真菌感染。',
      '沙丁胺醇为急救用药，随身携带，发作时立即使用。',
      '吸入装置使用后应清洁吸嘴，避免药物结晶堵塞。',
      '哮喘控制良好也不可自行停用吸入剂，需医生评估后调整。',
    ],
  },
  {
    tagMatch: ['咳嗽', '感冒'],
    itemMatch: ['止咳', '川贝', '枇杷', '氨溴索', '右美沙芬', '复方甘草', '急支糖浆', '感冒灵', '板蓝根', '连花清瘟'],
    type: 'medicine',
    category: '止咳药',
    priority: 'medium',
    tips: [
      '止咳糖浆服用后不宜立即饮水，以免冲淡药效。',
      '含可待因或右美沙芬的止咳药不宜长期使用。',
      '复方感冒药不要叠加使用，注意成分是否重复。',
      '中成药感冒药建议在感冒初期服用效果更佳。',
      '服用感冒药期间避免饮酒，多数感冒药含对乙酰氨基酚。',
    ],
  },

  // ---- 泌尿/肾脏类 ----
  {
    tagMatch: ['前列腺'],
    itemMatch: ['非那雄胺', '坦索罗辛', '特拉唑嗪', '前列康', '保列治'],
    type: 'medicine',
    category: '泌尿系统药',
    priority: 'high',
    excludeTags: ['女性', '儿童'],
    tips: [
      '非那雄胺需连续服用3-6个月才能见效，不可急于求成。',
      '坦索罗辛建议饭后服用，首次服药可能出现体位性低血压。',
      '服用α受体阻滞剂后起身应缓慢，防止头晕跌倒。',
    ],
  },

  // ---- 骨关节类 ----
  {
    tagMatch: ['关节不适', '关节', '骨质疏松', '骨质'],
    itemMatch: ['钙片', '氨糖', '膏药', '止痛贴', '双氯芬酸', '布洛芬', '氨基葡萄糖', '硫酸软骨素', '阿仑膦酸钠', '骨化三醇'],
    type: 'medicine',
    category: '骨关节药',
    priority: 'high',
    excludeTags: ['儿童'],
    tips: [
      '钙片建议随餐服用，吸收效果更好。',
      '氨糖建议饭后服用，减少胃部不适。',
      '外用膏药贴敷时间不宜超过8小时，避免皮肤过敏。',
      '阿仑膦酸钠（福善美）应晨起空腹用200ml白水送服，服后30分钟内保持直立。',
      '补钙同时建议补充维生素D，促进钙吸收。',
    ],
  },

  // ---- 眼科类 ----
  {
    tagMatch: ['用眼过度', '近视', '干眼'],
    itemMatch: ['眼药水', '叶黄素', '眼贴', '隐形眼镜', '玻璃酸钠', '人工泪液', '左氧氟沙星滴眼液'],
    type: 'medicine',
    category: '眼科用药',
    priority: 'high',
    tips: [
      '眼药水开封后一般4周内用完，超过时间应丢弃。',
      '佩戴隐形眼镜前务必洗手，避免眼部感染。',
      '叶黄素建议饭后服用，脂溶性维生素吸收更好。',
      '多种眼药水同时使用需间隔5-10分钟。',
      '人工泪液不含防腐剂的单支装更安全，开封后当天用完。',
    ],
  },

  // ---- 皮肤科类 ----
  {
    tagMatch: ['皮肤瘙痒', '湿疹', '皮炎'],
    itemMatch: ['皮炎平', '氟轻松', '地塞米松乳膏', '炉甘石', '湿疹', '止痒', '卤米松'],
    type: 'medicine',
    category: '皮肤科药',
    priority: 'medium',
    tips: [
      '外用激素药膏不宜长期大面积使用，一般不超过2周。',
      '炉甘石洗剂使用前需摇匀，皮肤破损处不宜使用。',
      '激素药膏面部慎用，可能导致皮肤变薄或色素沉着。',
    ],
  },

  // ---- 儿童特殊用药 ----
  {
    tagMatch: ['儿童'],
    itemMatch: ['美林', '泰诺林', '退热', '退热贴', '小儿', '儿童'],
    type: 'medicine',
    category: '儿童用药',
    priority: 'high',
    requireTags: ['儿童'],
    tips: [
      '儿童退热药首选对乙酰氨基酚（泰诺林）或布洛芬（美林），不可使用阿司匹林。',
      '美林（布洛芬混悬液）使用前摇匀，按体重精确量取。',
      '儿童体温38.5℃以上才建议使用退热药，低热可先物理降温。',
      '退热贴只能辅助降温，不能替代退热药。',
    ],
  },
  {
    tagMatch: ['婴儿', '宝宝'],
    itemMatch: ['退热', '美林', '泰诺林'],
    type: 'medicine',
    category: '儿童用药',
    priority: 'high',
    requireTags: ['婴儿', '宝宝'],
    tips: [
      '3个月以下婴儿发热应立即就医，不要自行用药。',
      '6个月以下婴儿首选对乙酰氨基酚（泰诺林），布洛芬需6个月以上才能使用。',
    ],
  },

  // ---- 老年特殊用药 ----
  {
    tagMatch: ['老年人'],
    itemMatch: ['降压', '降糖', '心脏', '钙片', '维生素'],
    type: 'medicine',
    category: '老年用药',
    priority: 'high',
    requireTags: ['老年人'],
    tips: [
      '老年人用药种类多，建议使用分药盒按早中晚分类，避免漏服或重复服用。',
      '老年人肝肾功能下降，药物剂量可能需要调整，需遵医嘱。',
      '老年人服药后起身应缓慢，防止体位性低血压导致跌倒。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['降压', '降糖', '心脏', '钙片', '维生素'],
    type: 'medicine',
    category: '老年用药',
    priority: 'high',
    excludeTags: ['儿童', '青少年'],
    ageMin: 50,
    tips: [
      '中老年人用药种类多，建议使用分药盒按早中晚分类，避免漏服或重复服用。',
      '中老年人肝肾功能下降，药物剂量可能需要调整，需遵医嘱。',
      '中老年人服药后起身应缓慢，防止体位性低血压导致跌倒。',
    ],
  },

  // ---- 通用药品安全 ----
  {
    tagMatch: ['*'],
    itemMatch: ['阿莫西林', '头孢', '阿奇霉素', '左氧氟沙星', '甲硝唑', '抗生素', '消炎'],
    type: 'medicine',
    category: '用药安全',
    priority: 'high',
    tips: [
      '抗生素必须按疗程服用，症状好转也不可自行停药，防止耐药。',
      '服用头孢类药物期间及停药后7天内禁酒，可能引发双硫仑反应。',
      '阿奇霉素建议饭前1小时或饭后2小时服用。',
      '抗生素与益生菌需间隔2小时服用，避免益生菌被杀死。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['创可贴', '碘伏', '纱布', '棉签', '酒精', '医用'],
    type: 'medicine',
    category: '用药安全',
    priority: 'medium',
    tips: [
      '碘伏和酒精开封后有效期缩短，建议标注开封日期。',
      '创可贴不宜长时间贴用，建议每24小时更换一次。',
      '酒精棉片开封后易挥发，建议小包装分次使用。',
      '伤口较深或出血不止应及时就医，不可仅用创可贴处理。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['体温计', '血压计', '血糖仪'],
    type: 'medicine',
    category: '用药安全',
    priority: 'medium',
    tips: [
      '电子体温计测量腋温需夹紧5分钟以上，口腔测量需3分钟。',
      '电子血压计建议每天固定时间测量，测量前静坐5分钟。',
      '血糖仪试纸注意有效期和保存条件，避免受潮。',
    ],
  },

  // =========================================
  //  日化类提醒
  // =========================================

  // ---- 护肤品类 ----
  {
    tagMatch: ['敏感肌'],
    itemMatch: ['面霜', '防晒', '护肤', '面膜', '精华', '乳液', '化妆水', '卸妆', '洗面奶'],
    type: 'daily',
    category: '护肤品',
    priority: 'medium',
    requireTags: ['敏感肌'],
    tips: [
      '敏感肌应选择无酒精、无香精、无色素的护肤品。',
      '新产品使用前建议先在耳后或手腕内侧试用48小时。',
      '敏感肌洗脸水温不宜过热，建议32-35℃温水。',
      '敏感肌避免频繁更换护肤品，找到合适的产品应坚持使用。',
      '敏感肌防晒优先选择物理防晒（含氧化锌/二氧化钛）。',
    ],
  },
  {
    tagMatch: ['油性皮肤'],
    itemMatch: ['洗面奶', '洁面', '面霜', '防晒', '护肤', '面膜', '乳液', '控油'],
    type: 'daily',
    category: '护肤品',
    priority: 'medium',
    requireTags: ['油性皮肤'],
    tips: [
      '油性皮肤建议选择清爽型/控油型护肤品，避免过于油腻堵塞毛孔。',
      '油性皮肤也需要保湿，可选择水乳质地的保湿产品。',
      '清洁面膜建议每周1-2次，过度清洁反而刺激皮脂分泌。',
      '油性皮肤建议使用氨基酸洁面，皂基洁面可能过度清洁。',
    ],
  },
  {
    tagMatch: ['干性皮肤'],
    itemMatch: ['面霜', '护肤', '乳液', '精华', '保湿', '身体乳'],
    type: 'daily',
    category: '护肤品',
    priority: 'medium',
    requireTags: ['干性皮肤'],
    tips: [
      '干性皮肤建议选择含有神经酰胺、透明质酸等保湿成分的产品。',
      '秋冬季节可将乳液更换为面霜，锁水效果更强。',
      '身体乳建议沐浴后3分钟内涂抹，趁皮肤微湿时吸收更好。',
    ],
  },
  {
    tagMatch: ['痘痘肌', '痤疮'],
    itemMatch: ['祛痘', '水杨酸', '果酸', '维A酸', '洗面奶', '面膜'],
    type: 'daily',
    category: '护肤品',
    priority: 'medium',
    requireTags: ['痘痘肌', '痤疮'],
    tips: [
      '含水杨酸的产品建议从低浓度开始，逐步建立耐受。',
      '使用酸类产品期间必须做好防晒，否则易晒伤和色素沉着。',
      '维A酸类产品建议晚间使用，白天需严格防晒。',
      '痘痘不要用手挤压，容易感染和留疤。',
    ],
  },

  // ---- 母婴类 ----
  {
    tagMatch: ['母婴用品', '婴儿', '孕期', '哺乳期'],
    itemMatch: ['婴儿', '奶粉', '尿不湿', '奶瓶', '辅食', '孕妇', '哺乳', '婴儿油'],
    type: 'daily',
    category: '母婴用品',
    priority: 'medium',
    tips: [
      '婴儿衣物应使用专用洗衣液，温和无刺激。',
      '奶瓶使用后应及时清洗消毒，避免细菌滋生。',
      '婴儿护肤品应选择无泪配方、无香精的产品。',
      '奶粉冲调应先加水再加粉，水温40-50℃为宜。',
      '婴儿辅食添加应从单一到多样，每种新食物观察3天。',
    ],
  },

  // ---- 运动健身类 ----
  {
    tagMatch: ['运动健身'],
    itemMatch: ['蛋白粉', '运动', '健身', '筋膜枪', '肌酸', '支链氨基酸'],
    type: 'daily',
    category: '运动健身',
    priority: 'medium',
    tips: [
      '运动后30分钟内补充蛋白质效果最佳。',
      '蛋白粉开封后应密封保存，避免受潮变质。',
      '筋膜枪不宜在关节、脊柱、头部使用，每个部位使用不超过2分钟。',
      '肌酸补充期间应多饮水，每日建议3-4升。',
    ],
  },

  // ---- 口腔护理类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['牙膏', '牙刷', '电动牙刷', '牙线', '冲牙器'],
    type: 'daily',
    category: '口腔护理',
    priority: 'medium',
    tips: [
      '牙刷建议每3个月更换一次，刷毛变形后清洁效果下降。',
      '电动牙刷头同样需要定期更换，一般3个月。',
      '牙线应在刷牙前使用，先清除牙缝残留再刷牙。',
      '含氟牙膏建议每次用量黄豆大小，漱口时尽量吐净。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['漱口水'],
    type: 'daily',
    category: '口腔护理',
    priority: 'medium',
    tips: [
      '漱口水不能代替刷牙，建议在刷牙后使用。',
      '漱口水每次使用约10-15ml，含漱30秒后吐出。',
      '治疗性漱口水不宜长期使用，一般不超过2周。',
    ],
  },

  // ---- 洗护用品类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['洗发水', '护发素', '发膜', '护发精油'],
    type: 'daily',
    category: '洗护用品',
    priority: 'medium',
    tips: [
      '洗发水应先在手心搓出泡沫再涂抹到头发上。',
      '护发素应涂在发中到发尾，避免接触头皮。',
      '发膜建议每周使用1-2次，替代护发素使用。',
    ],
  },
  {
    tagMatch: ['染烫发质'],
    itemMatch: ['染发', '烫发', '护发', '发膜', '洗发水'],
    type: 'daily',
    category: '洗护用品',
    priority: 'medium',
    tips: [
      '染发后48小时内避免洗发，让色素更稳固。',
      '烫发后应加强护理，使用修复型发膜和护发精油。',
      '染发剂使用前必须做皮肤过敏测试（耳后测试48小时）。',
      '染发间隔建议不少于3个月，减少对头发和头皮的损伤。',
    ],
  },

  // ---- 清洁用品类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['84消毒液', '消毒液', '含氯'],
    type: 'daily',
    category: '清洁用品',
    priority: 'medium',
    tips: [
      '84消毒液不能与洁厕灵混合使用，会产生有毒氯气！',
      '84消毒液需稀释后使用，避免腐蚀皮肤和衣物。',
      '84消毒液消毒后需用清水擦拭，避免残留刺激。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['洁厕灵', '洁厕', '马桶清洁'],
    type: 'daily',
    category: '清洁用品',
    priority: 'medium',
    tips: [
      '洁厕灵不能与84消毒液混用，会产生有毒氯气！',
      '洁厕灵有腐蚀性，使用时戴手套并保持通风。',
      '洁厕灵不宜用于大理石、水泥等碱性材质表面。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['洗衣凝珠', '洗衣球'],
    type: 'daily',
    category: '清洁用品',
    priority: 'low',
    tips: [
      '洗衣凝珠遇水即溶，取用时手部需保持干燥。',
      '洗衣凝珠外观似糖果，应妥善存放避免误食。',
      '洗衣凝珠可直接放入滚筒，不需放入洗涤剂盒。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['洗洁精', '厨房清洁', '去油'],
    type: 'daily',
    category: '清洁用品',
    priority: 'low',
    tips: [
      '洗洁精清洗餐具后务必用流动清水彻底冲洗，避免残留。',
      '洗洁精不宜用于清洗蔬果，建议使用专用蔬果清洗剂。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['柔顺剂', '金纺'],
    type: 'daily',
    category: '清洁用品',
    priority: 'low',
    tips: [
      '柔顺剂不宜过量使用，按说明比例稀释即可。',
      '内衣、毛巾不建议使用柔顺剂，会降低吸水性。',
      '柔顺剂应放在洗衣机柔顺剂槽，不要直接倒在衣物上。',
    ],
  },

  // ---- 防晒/驱蚊类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['防晒霜', '防晒喷雾', '防晒'],
    type: 'daily',
    category: '防晒驱蚊',
    priority: 'medium',
    tips: [
      '防晒霜出门前15-20分钟涂抹，每2小时补涂一次。',
      '防晒霜用量：面部约一元硬币大小，全身约30ml。',
      '防晒霜开封后一般12个月内用完，过期防晒效果下降。',
      '阴天也需要防晒，紫外线可穿透云层。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['驱蚊', '蚊香', '电蚊香', '花露水', '驱蚊液'],
    type: 'daily',
    category: '防晒驱蚊',
    priority: 'low',
    tips: [
      '蚊香片/液应提前30分钟开启，密闭空间效果更好。',
      '含避蚊胺的驱蚊液使用后应清洗皮肤，不宜长时间停留。',
      '花露水含酒精，使用时远离明火，不要在密闭空间大量喷洒。',
      '电蚊香液用完后应拔掉电源，避免干烧。',
    ],
  },

  // ---- 纸品/日用类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['卫生巾', '护垫', '棉条'],
    type: 'daily',
    category: '纸品日用',
    priority: 'medium',
    requireTags: ['女性'],
    tips: [
      '卫生巾建议每2-3小时更换一次，量少时也不超过4小时。',
      '卫生棉条使用不超过8小时，防止中毒性休克综合征。',
      '卫生用品应存放在干燥通风处，避免受潮变质。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['保鲜膜', '保鲜袋', '锡纸'],
    type: 'daily',
    category: '纸品日用',
    priority: 'low',
    tips: [
      '保鲜膜不耐高温，PE材质不可用于微波炉加热。',
      'PVC保鲜膜不建议接触油脂类食物。',
      '锡纸可用于烤箱，但不可放入微波炉。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['垃圾袋'],
    type: 'daily',
    category: '纸品日用',
    priority: 'low',
    tips: [
      '厨余垃圾建议每天清理，避免异味和细菌滋生。',
      '垃圾袋应选择合适尺寸，避免过满破裂。',
    ],
  },

  // ---- 宠物相关 ----
  {
    tagMatch: ['养宠'],
    itemMatch: ['猫粮', '狗粮', '宠物', '猫砂', '驱虫'],
    type: 'daily',
    category: '宠物用品',
    priority: 'low',
    tips: [
      '宠物食品开封后应密封保存，避免受潮变质。',
      '宠物驱虫药需按体重严格用量，内外驱虫分别进行。',
      '猫砂建议每天清理，每1-2周彻底更换一次。',
      '人用药物对宠物可能有毒性，切勿自行给宠物喂食。',
    ],
  },

  // ---- 季节性通用提醒 ----
  {
    tagMatch: ['*'],
    itemMatch: ['面霜', '身体乳', '护手霜', '润唇膏'],
    type: 'daily',
    category: '季节提醒',
    priority: 'low',
    tips: [
      '秋冬季应加强保湿，可选择质地更厚的面霜和身体乳。',
      '护手霜建议每次洗手后涂抹，保护手部皮肤屏障。',
    ],
  },

  // =========================================
  //  扩充：更多用药类
  // =========================================

  // ---- 耳鼻喉科 ----
  {
    tagMatch: ['过敏性鼻炎', '鼻炎'],
    itemMatch: ['鼻炎', '鼻喷', '布地奈德鼻喷', '糠酸莫米松', '氯雷他定', '西替利嗪', '孟鲁司特', '生理性海水'],
    type: 'medicine',
    category: '耳鼻喉药',
    priority: 'medium',
    tips: [
      '鼻喷激素（布地奈德、糠酸莫米松）需连续使用1-2周才能达到最佳效果。',
      '鼻喷剂使用时头部略前倾，喷头朝向鼻腔外侧壁，避免喷向鼻中隔。',
      '生理性海水鼻喷可每日多次使用，帮助清洁鼻腔。',
      '过敏性鼻炎建议在花粉季节来临前2周开始预防性用药。',
    ],
  },
  {
    tagMatch: ['中耳炎', '耳朵'],
    itemMatch: ['氧氟沙星滴耳液', '滴耳液', '碳酸氢钠滴耳液', '耳塞'],
    type: 'medicine',
    category: '耳鼻喉药',
    priority: 'medium',
    tips: [
      '滴耳液使用前应温热至接近体温（握在手心2-3分钟），避免冷液刺激引起眩晕。',
      '滴耳时患耳朝上，滴入后轻拉耳廓帮助药液流入，保持5分钟。',
      '中耳炎治疗期间避免耳朵进水，洗头时可用棉球堵住耳道。',
    ],
  },
  {
    tagMatch: ['咽喉不适', '咽炎'],
    itemMatch: ['西瓜霜', '金嗓子', '草珊瑚', '华素片', '西地碘', '开喉剑', '咽炎片', '慢严舒柠'],
    type: 'medicine',
    category: '耳鼻喉药',
    priority: 'medium',
    tips: [
      '含片应在口腔内缓慢含化，不要嚼碎或吞服。',
      '西瓜霜喷剂使用后30分钟内避免进食饮水。',
      '咽喉不适期间避免辛辣、过烫食物，多喝温水。',
      '慢性咽炎不宜长期使用含碘含片，可能影响甲状腺。',
    ],
  },

  // ---- 口腔科 ----
  {
    tagMatch: ['牙痛', '口腔'],
    itemMatch: ['牙痛', '丁香油', '甲硝唑', '人工牛黄甲硝唑', '芬必得', '牙周'],
    type: 'medicine',
    category: '口腔科药',
    priority: 'medium',
    tips: [
      '牙痛时可临时服用止痛药（布洛芬），但应尽快就医处理根本问题。',
      '甲硝唑服用期间及停药后3天内禁酒，可能引发严重不适。',
      '牙龈出血可能是牙周病信号，建议定期洁牙（每半年至一年）。',
    ],
  },
  {
    tagMatch: ['口腔溃疡'],
    itemMatch: ['口腔溃疡', '溃疡', '意可贴', '西瓜霜', '冰硼散', '康复新液'],
    type: 'medicine',
    category: '口腔科药',
    priority: 'medium',
    tips: [
      '口腔溃疡贴片（意可贴）贴于溃疡面后不要揭下，可缓慢吸收。',
      '西瓜霜喷剂喷于溃疡处，用药后30分钟内避免进食。',
      '反复口腔溃疡（每月超过2次）建议就医排查系统性疾病。',
      '口腔溃疡期间避免酸辣刺激性食物，多吃富含B族维生素的食物。',
    ],
  },

  // ---- 妇科类 ----
  {
    tagMatch: ['痛经', '月经'],
    itemMatch: ['布洛芬', '元胡止痛', '益母草', '当归', '暖宫', '痛经'],
    type: 'medicine',
    category: '妇科用药',
    priority: 'medium',
    requireTags: ['女性'],
    excludeTags: ['儿童'],
    tips: [
      '痛经用布洛芬建议在月经来潮前或刚开始时服用，效果更好。',
      '布洛芬饭后服用减少胃刺激，经期用药一般不超过3天。',
      '益母草颗粒建议经期前3-5天开始服用。',
      '严重痛经影响日常生活者建议就医排查子宫内膜异位症等。',
    ],
  },
  {
    tagMatch: ['妇科炎症'],
    itemMatch: ['甲硝唑栓', '克霉唑', '氟康唑', '妇科', '洗液', '阴道'],
    type: 'medicine',
    category: '妇科用药',
    priority: 'medium',
    requireTags: ['女性'],
    tips: [
      '阴道用药一般建议睡前使用，利于药物吸收且减少流出。',
      '妇科栓剂使用期间避免性生活，疗程结束后复查。',
      '妇科洗液不宜频繁灌洗，会破坏阴道正常菌群平衡。',
      '口服氟康唑治疗霉菌性阴道炎，伴侣可能需同时治疗。',
    ],
  },

  // ---- 肝脏/护肝类 ----
  {
    tagMatch: ['肝脏', '护肝', '乙肝'],
    itemMatch: ['护肝', '水飞蓟', '甘草酸', '双环醇', '熊去氧胆酸', '恩替卡韦', '替诺福韦'],
    type: 'medicine',
    category: '护肝药',
    priority: 'medium',
    tips: [
      '抗病毒药物（恩替卡韦、替诺福韦）需长期服用，不可自行停药。',
      '护肝药不能替代戒酒，肝脏疾病患者必须禁酒。',
      '服用抗病毒药物期间定期复查肝功能和病毒载量。',
      '熊去氧胆酸建议随餐服用，吸收效果更好。',
    ],
  },

  // ---- 贫血/补铁类 ----
  {
    tagMatch: ['贫血', '缺铁'],
    itemMatch: ['铁剂', '硫酸亚铁', '琥珀酸亚铁', '多糖铁', '右旋糖酐铁', '补铁', '阿胶'],
    type: 'medicine',
    category: '补血药',
    priority: 'medium',
    tips: [
      '铁剂建议饭后服用减少胃肠刺激，搭配维生素C可促进吸收。',
      '服用铁剂期间大便会变黑，属正常现象，停药后恢复。',
      '铁剂避免与茶、咖啡、牛奶、钙片同服，间隔至少2小时。',
      '补铁治疗一般需持续3-6个月，血红蛋白正常后仍需继续补铁储备。',
    ],
  },

  // ---- 维生素/保健类（扩充） ----
  {
    tagMatch: ['*'],
    itemMatch: ['维生素', 'VC', 'VB', 'VE', '复合维生素', '善存', '金施尔康'],
    type: 'medicine',
    category: '维生素保健',
    priority: 'medium',
    tips: [
      '脂溶性维生素（A、D、E、K）建议饭后服用，脂肪促进吸收。',
      '维生素C建议分次服用（每次≤500mg），吸收率更高。',
      '维生素E每日摄入量不宜超过400IU，过量可能增加出血风险。',
      '复合维生素不宜与单一维生素叠加使用，防止过量。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['鱼油', 'DHA', 'EPA', '卵磷脂'],
    type: 'medicine',
    category: '维生素保健',
    priority: 'medium',
    tips: [
      '鱼油建议随餐服用，脂肪促进吸收。',
      '鱼油开封后应冷藏保存，避免氧化变质。',
      '服用抗凝药物者使用鱼油前应咨询医生。',
      '鱼油有腥味属正常，如有明显异味可能已变质。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['辅酶Q10', '辅酶'],
    type: 'medicine',
    category: '维生素保健',
    priority: 'medium',
    tips: [
      '辅酶Q10为脂溶性，建议随餐或饭后服用。',
      '辅酶Q10开封后避光保存，避免高温。',
    ],
  },

  // ---- 抗病毒类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['奥司他韦', '利巴韦林', '阿昔洛韦', '伐昔洛韦', '抗病毒'],
    type: 'medicine',
    category: '抗病毒药',
    priority: 'medium',
    tips: [
      '奥司他韦（达菲）在流感症状出现48小时内服用效果最佳。',
      '奥司他韦建议随餐服用减少恶心呕吐。',
      '阿昔洛韦治疗疱疹期间应多饮水，防止药物结晶损伤肾脏。',
      '抗病毒药物不可替代疫苗，建议按计划接种流感疫苗等。',
    ],
  },

  // ---- 抗真菌类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['达克宁', '酮康唑', '特比萘芬', '氟康唑', '克霉唑', '脚气', '灰指甲'],
    type: 'medicine',
    category: '抗真菌药',
    priority: 'medium',
    tips: [
      '外用抗真菌药膏需连续使用2-4周，症状消失后再用1周巩固。',
      '脚气治疗期间保持足部干燥，袜子每日更换。',
      '灰指甲口服特比萘芬疗程较长（手指6周，脚趾12周），需坚持服用。',
      '抗真菌药膏和激素药膏不要混用，真菌感染禁用激素。',
    ],
  },

  // ---- 止痛药通用 ----
  {
    tagMatch: ['*'],
    itemMatch: ['止痛', '止疼', '芬必得', '散利痛', '去痛片', '曲马多'],
    type: 'medicine',
    category: '止痛药',
    priority: 'medium',
    tips: [
      '非甾体止痛药（布洛芬等）不宜空腹服用，饭后可减少胃刺激。',
      '止痛药连续使用不超过5天（非处方），长期疼痛应就医查明原因。',
      '多种止痛药不要同时使用，注意成分是否重复。',
      '止痛药与酒精同服增加胃出血风险，服药期间禁酒。',
    ],
  },

  // ---- 中成药通用 ----
  {
    tagMatch: ['*'],
    itemMatch: ['六味地黄丸', '逍遥丸', '归脾丸', '补中益气', '知柏地黄', '杞菊地黄', '金匮肾气'],
    type: 'medicine',
    category: '中成药',
    priority: 'medium',
    tips: [
      '中成药建议饭前30分钟或饭后1小时服用，避免与食物同服。',
      '服用中成药期间忌辛辣、油腻、生冷食物。',
      '中成药起效较慢，一般需连续服用2-4周评估效果。',
      '中成药与西药同服需间隔30分钟以上。',
    ],
  },

  // ---- 更年期 ----
  {
    tagMatch: ['更年期'],
    itemMatch: ['坤泰', '莉芙敏', '替勃龙', '谷维素', '更年安'],
    type: 'medicine',
    category: '更年期用药',
    priority: 'medium',
    tips: [
      '更年期症状明显者建议就医评估是否需要激素替代治疗。',
      '谷维素可辅助调节植物神经功能，建议饭后服用。',
      '更年期女性建议增加钙和维生素D的摄入，预防骨质疏松。',
    ],
  },

  // ---- 注射/检测用品 ----
  {
    tagMatch: ['*'],
    itemMatch: ['注射器', '针头', '采血针', '棉球', '止血带', '输液贴'],
    type: 'medicine',
    category: '检测用品',
    priority: 'medium',
    tips: [
      '一次性注射器和针头不可重复使用，用后妥善丢弃。',
      '采血针使用后应放入专用利器盒，防止针刺伤。',
      '止血带使用时间不宜超过1分钟，防止组织损伤。',
    ],
  },

  // ---- 助行/康复器具 ----
  {
    tagMatch: ['老年人', '术后'],
    itemMatch: ['轮椅', '拐杖', '助行器', '护膝', '护腰', '颈托'],
    type: 'medicine',
    category: '康复器具',
    priority: 'medium',
    tips: [
      '拐杖高度应调节至手柄与手腕横纹齐平，手臂自然下垂。',
      '护膝不宜24小时佩戴，每天佩戴不超过8小时，防止肌肉萎缩。',
      '轮椅使用前检查刹车是否正常，上下坡时注意安全。',
    ],
  },

  // =========================================
  //  扩充：更多日化类
  // =========================================

  // ---- 洗手/消毒类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['洗手液', '免洗洗手液', '消毒湿巾', '酒精湿巾'],
    type: 'daily',
    category: '清洁消毒',
    priority: 'low',
    tips: [
      '洗手液搓洗时间不少于20秒，冲洗干净。',
      '免洗洗手液含酒精，使用时远离明火。',
      '消毒湿巾开封后尽快用完，避免酒精挥发失效。',
      '免洗洗手液不能替代流水洗手，脏手仍需水洗。',
    ],
  },

  // ---- 衣物护理类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['洗衣液', '洗衣粉', '洗衣皂'],
    type: 'daily',
    category: '衣物护理',
    priority: 'low',
    tips: [
      '洗衣液按说明用量使用，过量不易漂洗干净。',
      '洗衣粉溶解性较差，建议先溶解再倒入洗衣机。',
      '深色衣物首次洗涤可能掉色，建议单独洗。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['防蛀', '樟脑丸', '防虫', '薰衣草'],
    type: 'daily',
    category: '衣物护理',
    priority: 'low',
    tips: [
      '樟脑丸（萘丸）可能刺激皮肤，贴身衣物建议避免使用。',
      '防蛀产品应放在密封衣柜中，不要直接接触衣物。',
      '天然薰衣草香包更安全，适合日常防蛀使用。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['熨烫', '挂烫机', '熨斗'],
    type: 'daily',
    category: '衣物护理',
    priority: 'low',
    tips: [
      '挂烫机使用前确保水箱有水，避免干烧。',
      '熨烫不同面料需调节温度：棉麻高温、化纤低温、丝绸垫布。',
    ],
  },

  // ---- 浴室用品类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['沐浴露', '香皂', '浴盐'],
    type: 'daily',
    category: '浴室用品',
    priority: 'low',
    tips: [
      '沐浴露不宜过度使用，每天一次即可，过度清洁破坏皮肤屏障。',
      '香皂使用后应放在沥水皂盒中，避免泡水变软。',
      '浴盐不宜每天使用，每周1-2次为宜。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['毛巾', '浴巾'],
    type: 'daily',
    category: '浴室用品',
    priority: 'low',
    tips: [
      '毛巾建议每3个月更换一次，长期使用易滋生细菌。',
      '毛巾使用后应挂在通风处晾干，避免潮湿发霉。',
      '浴巾建议每2-3次使用后清洗一次。',
    ],
  },

  // ---- 厨房用品类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['抹布', '百洁布', '海绵', '钢丝球'],
    type: 'daily',
    category: '厨房用品',
    priority: 'low',
    tips: [
      '厨房抹布建议每周更换或高温消毒，是细菌滋生重灾区。',
      '海绵使用后拧干放在通风处，建议2周更换一次。',
      '钢丝球不适用于不粘锅表面，会破坏涂层。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['砧板', '菜板', '筷子'],
    type: 'daily',
    category: '厨房用品',
    priority: 'low',
    tips: [
      '砧板生熟分开使用，防止交叉污染。',
      '木质砧板出现明显刀痕应更换，缝隙易藏细菌。',
      '竹木筷子建议每3-6个月更换，发霉变色立即丢弃。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['滤水壶', '净水器', '滤芯'],
    type: 'daily',
    category: '厨房用品',
    priority: 'low',
    tips: [
      '净水器滤芯需按说明定期更换，过期滤芯可能二次污染。',
      '滤水壶滤芯一般1-2个月更换一次，视使用频率而定。',
    ],
  },

  // ---- 眼镜护理类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['眼镜', '镜片', '眼镜布', '清洗液'],
    type: 'daily',
    category: '眼镜护理',
    priority: 'low',
    tips: [
      '眼镜应用专用眼镜布或清水冲洗，纸巾和衣角会刮花镜片。',
      '超声波清洗机可深度清洁眼镜，建议每周使用一次。',
      '眼镜布应定期清洗，脏布擦拭反而更伤镜片。',
    ],
  },

  // ---- 除湿/防潮类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['除湿', '干燥剂', '防潮', '除湿盒', '樟脑'],
    type: 'daily',
    category: '除湿防潮',
    priority: 'low',
    tips: [
      '除湿盒/干燥剂应放在密闭空间效果更好，定期更换。',
      '干燥剂不可食用，应妥善存放避免误用。',
      '梅雨季节衣柜可放置除湿盒，防止衣物发霉。',
    ],
  },

  // ---- 空气清新/香薰类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['空气清新剂', '香薰', '精油', '香薰机', '扩香'],
    type: 'daily',
    category: '空气清新',
    priority: 'low',
    tips: [
      '精油不可直接涂抹皮肤（薰衣草和茶树除外），需用基础油稀释。',
      '香薰机每次使用30-60分钟即可，不宜长时间连续使用。',
      '空气清新剂只是掩盖异味，应找到异味源头并清除。',
      '精油香薰不宜在密闭空间长时间使用，注意通风。',
    ],
  },

  // ---- 美妆彩妆类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['口红', '唇膏', '唇釉'],
    type: 'daily',
    category: '美妆彩妆',
    priority: 'medium',
    requireTags: ['女性'],
    tips: [
      '口红开封后保质期一般为1-2年，过期可能引起唇部过敏。',
      '口红应存放在阴凉处，高温会导致变质融化。',
      '吃饭前建议擦掉口红，避免误食。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['粉底', 'BB霜', 'CC霜', '遮瑕', '气垫'],
    type: 'daily',
    category: '美妆彩妆',
    priority: 'medium',
    requireTags: ['女性'],
    tips: [
      '粉底液开封后一般6-12个月内用完，过期易滋生细菌。',
      '气垫粉扑建议每周清洗一次，防止细菌滋生。',
      '化妆工具（刷子、海绵）应定期清洗，避免引发痘痘。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['睫毛膏', '眼线', '眼影', '眉笔'],
    type: 'daily',
    category: '美妆彩妆',
    priority: 'medium',
    requireTags: ['女性'],
    tips: [
      '睫毛膏开封后3-6个月内用完，是化妆品中最易变质的品类。',
      '眼部化妆品不可与他人共用，防止交叉感染。',
      '睫毛膏变干不要加水，会加速细菌滋生。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['卸妆', '卸妆油', '卸妆水', '卸妆膏'],
    type: 'daily',
    category: '美妆彩妆',
    priority: 'medium',
    requireTags: ['女性'],
    tips: [
      '卸妆后仍需用洗面奶进行二次清洁。',
      '卸妆油需乳化后冲洗干净，残留可能堵塞毛孔。',
      '防水彩妆建议使用专用眼唇卸妆液。',
    ],
  },

  // ---- 止汗/体香类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['止汗', '体香', '走珠', '香体'],
    type: 'daily',
    category: '止汗体香',
    priority: 'low',
    excludeTags: ['儿童', '婴儿'],
    tips: [
      '止汗露不宜在出汗后直接使用，应先清洁擦干。',
      '止汗露建议晚上使用，效果比白天更好。',
      '皮肤有伤口或剃毛后24小时内避免使用止汗产品。',
    ],
  },

  // ---- 脱毛类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['脱毛', '脱毛膏', '蜜蜡', '剃毛'],
    type: 'daily',
    category: '脱毛用品',
    priority: 'low',
    excludeTags: ['儿童', '婴儿'],
    tips: [
      '脱毛膏使用前必须做皮肤测试，等待24小时无反应再大面积使用。',
      '脱毛膏不宜在面部和私密部位使用，选择专用产品。',
      '蜜蜡脱毛后24小时内避免热水浴和游泳。',
    ],
  },

  // ---- 男性护理类 ----
  {
    tagMatch: ['男性'],
    itemMatch: ['剃须', '剃须刀', '剃须泡沫', '须后水'],
    type: 'daily',
    category: '男性护理',
    priority: 'low',
    requireTags: ['男性'],
    tips: [
      '剃须泡沫可软化胡须，减少刮伤风险。',
      '须后水含酒精，皮肤敏感者可选择无酒精配方。',
      '手动剃须刀片建议每5-7次使用后更换。',
      '电动剃须刀头建议每12-18个月更换一次。',
    ],
  },

  // ---- 老年护理类 ----
  {
    tagMatch: ['老年人'],
    itemMatch: ['成人纸尿裤', '护理垫', '助听器', '老花镜'],
    type: 'daily',
    category: '老年护理',
    priority: 'low',
    requireTags: ['老年人'],
    tips: [
      '成人纸尿裤应及时更换，长时间使用可能导致褥疮。',
      '护理垫应选择透气性好的材质，保持皮肤干爽。',
      '助听器电池一般7-14天更换一次，不用时打开电池仓。',
      '老花镜度数会随年龄变化，建议每2年重新验光。',
    ],
  },

  // ---- 儿童日化类 ----
  {
    tagMatch: ['儿童'],
    itemMatch: ['儿童牙膏', '儿童洗发', '儿童沐浴', '儿童面霜', '爽身粉'],
    type: 'daily',
    category: '儿童日化',
    priority: 'low',
    requireTags: ['儿童', '婴儿'],
    tips: [
      '儿童洗护产品应选择无泪配方，避免刺激眼睛。',
      '儿童牙膏含氟量应低于1000ppm，3岁以下用量为米粒大小。',
      '爽身粉不建议用于女婴，粉末可能进入生殖道。',
      '儿童防晒霜建议选择物理防晒，SPF30即可。',
    ],
  },
  {
    tagMatch: ['儿童', '婴儿'],
    itemMatch: ['牙膏', '牙刷', '漱口水'],
    type: 'daily',
    category: '儿童日化',
    priority: 'low',
    requireTags: ['儿童', '婴儿'],
    tips: [
      '含氟牙膏儿童用量：3岁以下米粒大小，3岁以上豌豆大小。',
      '含酒精漱口水不建议6岁以下儿童使用。',
    ],
  },
  {
    tagMatch: ['儿童', '婴儿'],
    itemMatch: ['驱蚊', '蚊香', '电蚊香', '花露水', '驱蚊液'],
    type: 'daily',
    category: '儿童日化',
    priority: 'low',
    requireTags: ['儿童', '婴儿'],
    tips: [
      '含避蚊胺的驱蚊液不建议2个月以下婴儿使用。',
    ],
  },
  {
    tagMatch: ['儿童', '婴儿'],
    itemMatch: ['防蛀', '樟脑丸', '防虫'],
    type: 'daily',
    category: '儿童日化',
    priority: 'low',
    requireTags: ['儿童', '婴儿'],
    tips: [
      '樟脑丸（萘丸）不可用于婴幼儿衣物，可能引起溶血。',
    ],
  },
  {
    tagMatch: ['儿童', '婴儿'],
    itemMatch: ['空气清新剂', '香薰', '精油', '香薰机'],
    type: 'daily',
    category: '儿童日化',
    priority: 'low',
    requireTags: ['儿童', '婴儿'],
    tips: [
      '有婴幼儿的家庭慎用精油香薰。',
    ],
  },

  // ---- 宠物护理类（扩充） ----
  {
    tagMatch: ['养宠'],
    itemMatch: ['宠物沐浴', '宠物香波', '宠物梳', '指甲剪'],
    type: 'daily',
    category: '宠物护理',
    priority: 'low',
    tips: [
      '宠物应使用专用香波，人用洗发水pH值不适合宠物皮肤。',
      '宠物洗澡频率不宜过高，一般每月1-2次即可。',
      '宠物指甲剪不要剪到血线，透明指甲可看到粉色区域。',
    ],
  },

  // ---- 节日/特殊场景 ----
  {
    tagMatch: ['*'],
    itemMatch: ['暖宝宝', '暖贴', '暖手宝'],
    type: 'daily',
    category: '节日场景',
    priority: 'low',
    tips: [
      '暖宝宝不可直接贴在皮肤上，应隔着衣物使用。',
      '暖宝宝睡觉时不宜使用，低温烫伤风险高。',
      '暖宝宝内含铁粉，应妥善存放避免误拆。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['雨伞', '雨衣', '雨鞋'],
    type: 'daily',
    category: '节日场景',
    priority: 'low',
    tips: [
      '雨伞使用后应晾干再收起，避免发霉和生锈。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['冰袋', '冰贴', '降温'],
    type: 'daily',
    category: '节日场景',
    priority: 'low',
    tips: [
      '冰袋冷敷时间不宜超过20分钟，防止冻伤皮肤。',
      '退热冰贴可辅助降温，但不能替代退热药。',
    ],
  },

  // ---- 收纳/整理类 ----
  {
    tagMatch: ['*'],
    itemMatch: ['收纳箱', '收纳盒', '真空袋', '压缩袋'],
    type: 'daily',
    category: '收纳整理',
    priority: 'low',
    tips: [
      '真空压缩袋不建议长期存放羽绒制品，会损伤蓬松度。',
      '收纳箱应标注内容物，方便查找。',
      '换季衣物收纳前应清洗干净，避免污渍氧化变黄。',
    ],
  },

  // ---- 通用安全提醒（覆盖所有家庭） ----
  {
    tagMatch: ['*'],
    itemMatch: ['药品', '药物', '药'],
    type: 'medicine',
    category: '安全提醒',
    priority: 'medium',
    tips: [
      '药品应妥善存放，避免误取误用。',
      '过期药品不可继续使用，应按垃圾分类妥善处理。',
      '药品存放在阴凉干燥处，避免阳光直射和潮湿。',
      '外用药和内服药应分开存放，避免误用。',
    ],
  },
  {
    tagMatch: ['*'],
    itemMatch: ['清洁', '清洗', '消毒'],
    type: 'daily',
    category: '安全提醒',
    priority: 'medium',
    tips: [
      '使用任何清洁剂时保持通风，避免吸入过多化学物质。',
      '不同清洁剂不要混合使用，可能产生有害气体。',
      '清洁剂应妥善收纳，避免误用。',
    ],
  },
];

// 计算用药/日化提醒
router.get('/health', (req, res) => {
  try {
    const db = global.db;
    const { family_id } = req.query;
    const memberIds = req.query.member_ids ? req.query.member_ids.split(',').map(Number).filter(Boolean) : [];

    // 获取家庭成员及标签
    let members;
    if (family_id) {
      members = db.prepare(`
        SELECT fm.user_id, u.nickname, u.username, u.gender, u.age, u.health_info
        FROM family_members fm
        JOIN users u ON u.id = fm.user_id
        WHERE fm.family_id = ?
      `).all(family_id);
    } else {
      members = db.prepare(`
        SELECT id as user_id, nickname, username, gender, age, health_info
        FROM users WHERE id = ?
      `).all(req.user.id);
    }

    // 按 member_ids 过滤成员
    if (memberIds.length > 0) {
      members = members.filter(m => memberIds.includes(m.user_id));
    }

    // 获取所有成员的标签
    const memberTags = {};
    if (family_id) {
      const tags = db.prepare(`
        SELECT user_id, tag_type, tag_text FROM user_tags WHERE family_id = ?
      `).all(family_id);
      for (const t of tags) {
        if (!memberTags[t.user_id]) memberTags[t.user_id] = [];
        memberTags[t.user_id].push(t.tag_text);
      }
    }

    // 合并 health_info 中的关键词作为隐式标签，并添加年龄/性别标签
    for (const m of members) {
      if (!memberTags[m.user_id]) memberTags[m.user_id] = [];
      if (m.health_info) {
        const infoTags = [];
        if (m.health_info.includes('高血压')) infoTags.push('高血压');
        if (m.health_info.includes('糖尿病') || m.health_info.includes('血糖')) infoTags.push('糖尿病');
        if (m.health_info.includes('心脏')) infoTags.push('心脏不适');
        if (m.health_info.includes('过敏')) infoTags.push('过敏体质');
        if (m.health_info.includes('敏感') || m.health_info.includes('敏感肌')) infoTags.push('敏感肌');
        if (m.health_info.includes('油性')) infoTags.push('油性皮肤');
        if (m.health_info.includes('干性')) infoTags.push('干性皮肤');
        if (m.health_info.includes('痘痘') || m.health_info.includes('痤疮')) infoTags.push('痘痘肌');
        memberTags[m.user_id] = [...new Set([...memberTags[m.user_id], ...infoTags])];
      }

      // 根据年龄添加标签
      if (m.age) {
        if (m.age < 3) memberTags[m.user_id].push('婴儿');
        else if (m.age < 14) memberTags[m.user_id].push('儿童');
        else if (m.age < 18) memberTags[m.user_id].push('青少年');
        else if (m.age >= 60) memberTags[m.user_id].push('老年人');
        else if (m.age >= 50) memberTags[m.user_id].push('中老年');
      }

      // 根据性别添加标签
      if (m.gender === '男') memberTags[m.user_id].push('男性');
      else if (m.gender === '女') memberTags[m.user_id].push('女性');

      memberTags[m.user_id] = [...new Set(memberTags[m.user_id])];
    }

    // 获取家庭物品
    const field = family_id ? 'family_id' : 'created_by';
    const id = family_id || req.user.id;
    const ownerFilter = memberIds.length > 0 ? ` AND i.id IN (SELECT item_id FROM item_owners WHERE user_id IN (${memberIds.map(() => '?').join(',')}))` : '';
    const ownerParams = memberIds.length > 0 ? memberIds : [];
    const items = db.prepare(`
      SELECT i.id, i.name, i.notes, c.name as category_name, c.storage_type
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? AND i.status = 'in_use'${ownerFilter}
    `).all(id, ...ownerParams);

    // 匹配规则并生成提醒
    const medicineReminders = [];
    const dailyReminders = [];
    const seen = new Set(); // 去重

    for (const rule of HEALTH_REMINDER_RULES) {
      // 检查哪些成员匹配此规则的标签
      const matchedMembers = [];
      if (rule.tagMatch.includes('*')) {
        matchedMembers.push(...members);
      } else {
        for (const m of members) {
          const tags = memberTags[m.user_id] || [];
          if (tags.some(t => rule.tagMatch.includes(t))) {
            matchedMembers.push(m);
          }
        }
      }
      if (matchedMembers.length === 0) continue;

      // 检查物品是否匹配
      const matchedItems = items.filter(item => {
        const text = `${item.name} ${item.notes || ''} ${item.category_name || ''}`;
        return rule.itemMatch.some(kw => text.includes(kw));
      });
      if (matchedItems.length === 0) continue;

      // 为每个匹配的成员生成提醒（应用 excludeTags、requireTags、ageMin 过滤）
      for (const m of matchedMembers) {
        const tags = memberTags[m.user_id] || [];

        // 检查 excludeTags：如果成员有排除标签则跳过
        if (rule.excludeTags && rule.excludeTags.some(et => tags.includes(et))) {
          continue;
        }

        // 检查 requireTags：如果规则要求特定标签但成员没有则跳过
        if (rule.requireTags && !rule.requireTags.some(rt => tags.includes(rt))) {
          continue;
        }

        // 检查 ageMin：如果成员年龄小于最小年龄则跳过
        if (rule.ageMin && m.age && m.age < rule.ageMin) {
          continue;
        }

        for (const tip of rule.tips) {
          const key = `${m.user_id}|${tip}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const reminder = {
            user_id: m.user_id,
            member_name: m.nickname || m.username,
            content: tip,
            type: rule.type,
            priority: rule.priority || 'medium',
            matched_items: matchedItems.map(i => i.name),
            category: rule.category,
          };

          if (rule.type === 'medicine') {
            medicineReminders.push(reminder);
          } else {
            dailyReminders.push(reminder);
          }
        }
      }
    }

    res.json({
      code: 0,
      data: { medicine: medicineReminders, daily: dailyReminders },
    });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// Dismiss a reminder
router.put('/:id/dismiss', (req, res) => {
  try {
    const db = global.db;
    const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);

    logActivity(db, {
      userId: req.user.id,
      action: 'dismiss',
      targetType: 'reminder',
      targetId: reminder.id,
      targetName: reminder.title,
      familyId: reminder.family_id
    });

    db.prepare('UPDATE reminders SET is_dismissed = 1 WHERE id = ?').run(req.params.id);
    res.json({ code: 0, message: '已关闭' });
  } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
});

// AI 智能用药/日化提醒
router.get('/health-ai', async (req, res) => {
  try {
    const db = global.db;
    const { family_id } = req.query;
    const memberIds = req.query.member_ids ? req.query.member_ids.split(',').map(Number).filter(Boolean) : [];

    // 获取家庭成员及标签（复用 /health 的逻辑）
    let members;
    if (family_id) {
      members = db.prepare(`
        SELECT fm.user_id, u.nickname, u.username, u.gender, u.age, u.health_info
        FROM family_members fm
        JOIN users u ON u.id = fm.user_id
        WHERE fm.family_id = ?
      `).all(family_id);
    } else {
      members = db.prepare(`
        SELECT id as user_id, nickname, username, gender, age, health_info
        FROM users WHERE id = ?
      `).all(req.user.id);
    }

    if (memberIds.length > 0) {
      members = members.filter(m => memberIds.includes(m.user_id));
    }

    // 获取成员标签
    const memberTags = {};
    if (family_id) {
      const tags = db.prepare(`SELECT user_id, tag_type, tag_text FROM user_tags WHERE family_id = ?`).all(family_id);
      for (const t of tags) {
        if (!memberTags[t.user_id]) memberTags[t.user_id] = [];
        memberTags[t.user_id].push(t.tag_text);
      }
    }
    for (const m of members) {
      if (!memberTags[m.user_id]) memberTags[m.user_id] = [];
      if (m.health_info) {
        const infoTags = [];
        if (m.health_info.includes('高血压')) infoTags.push('高血压');
        if (m.health_info.includes('糖尿病') || m.health_info.includes('血糖')) infoTags.push('糖尿病');
        if (m.health_info.includes('心脏')) infoTags.push('心脏不适');
        if (m.health_info.includes('过敏')) infoTags.push('过敏体质');
        if (m.health_info.includes('敏感') || m.health_info.includes('敏感肌')) infoTags.push('敏感肌');
        if (m.health_info.includes('油性')) infoTags.push('油性皮肤');
        if (m.health_info.includes('干性')) infoTags.push('干性皮肤');
        if (m.health_info.includes('痘痘') || m.health_info.includes('痤疮')) infoTags.push('痘痘肌');
        memberTags[m.user_id] = [...new Set([...memberTags[m.user_id], ...infoTags])];
      }

      // 根据年龄添加标签
      if (m.age) {
        if (m.age < 3) memberTags[m.user_id].push('婴儿');
        else if (m.age < 14) memberTags[m.user_id].push('儿童');
        else if (m.age < 18) memberTags[m.user_id].push('青少年');
        else if (m.age >= 60) memberTags[m.user_id].push('老年人');
        else if (m.age >= 50) memberTags[m.user_id].push('中老年');
      }

      // 根据性别添加标签
      if (m.gender === '男') memberTags[m.user_id].push('男性');
      else if (m.gender === '女') memberTags[m.user_id].push('女性');

      memberTags[m.user_id] = [...new Set(memberTags[m.user_id])];
    }

    // 获取物品
    const field = family_id ? 'family_id' : 'created_by';
    const id = family_id || req.user.id;
    const ownerFilter = memberIds.length > 0 ? ` AND i.id IN (SELECT item_id FROM item_owners WHERE user_id IN (${memberIds.map(() => '?').join(',')}))` : '';
    const ownerParams = memberIds.length > 0 ? memberIds : [];
    const items = db.prepare(`
      SELECT i.id, i.name, i.notes, i.brand, i.model, i.quantity, i.unit, i.expiry_date,
             c.name as category_name, c.storage_type
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.${field} = ? AND i.status = 'in_use'${ownerFilter}
    `).all(id, ...ownerParams);

    // 构建 AI prompt
    const memberInfo = members.map(m => {
      const tags = memberTags[m.user_id] || [];
      return `- ${m.nickname || m.username}（${m.gender || '未知'}，${m.age || '未知'}岁）健康标签：${tags.length > 0 ? tags.join('、') : '无'}${m.health_info ? '，健康备注：' + m.health_info : ''}`;
    }).join('\n');

    const itemInfo = items.map(i =>
      `- ${i.name}${i.brand ? '（' + i.brand + '）' : ''}，数量：${i.quantity}${i.unit}，分类：${i.category_name || '未分类'}${i.expiry_date ? '，有效期至：' + i.expiry_date : ''}${i.notes ? '，备注：' + i.notes : ''}`
    ).join('\n');

    const prompt = `你是一位专业的家庭健康管理顾问。请根据以下信息，为家庭成员生成个性化的用药提醒和日化提醒。

【家庭成员及健康信息】
${memberInfo}

【家庭物品清单（在用）】
${itemInfo}

请分析每位成员的健康状况与家中物品的关联，生成提醒。严格遵守以下规则：

【个性化过滤规则】
1. 根据成员年龄过滤：
   - 儿童（<14岁）：只给儿童相关的提醒，不要给成人用药提醒（如降压药、降糖药等）
   - 青少年（14-17岁）：不要给老年人相关提醒
   - 成年人（18-49岁）：不要给儿童或老年人专属提醒
   - 中老年人（≥50岁）：可以给中老年相关提醒

2. 根据成员肤质标签过滤：
   - 有"敏感肌"标签：只给敏感肌护肤建议，不要给油性皮肤或干性皮肤的建议
   - 有"油性皮肤"标签：只给油性皮肤护肤建议，不要给敏感肌或干性皮肤的建议
   - 有"干性皮肤"标签：只给干性皮肤护肤建议，不要给敏感肌或油性皮肤的建议

3. 根据性别过滤：
   - 男性：不要给妇科相关提醒（如痛经、妇科炎症等）
   - 女性：不要给前列腺相关提醒

4. 根据健康标签过滤：
   - 有"高血压"标签且有降压药：必须给降压药提醒
   - 有"糖尿病"标签且有降糖药：必须给降糖药提醒
   - 有"儿童"标签：只给儿童适用的药物提醒

【提醒类型】
1. 用药提醒：药物服用注意事项、药物与健康状况的关联建议、存储提醒等
2. 日化提醒：护肤品/日用品使用建议、安全注意事项等

【要求】
- 每条提醒需具体、实用，不要泛泛而谈
- 不要给成员不相关的提醒（如给儿童降压药提醒、给油皮干皮建议）
- 如果某成员没有任何匹配的提醒，则不生成该成员的提醒

严格按以下 JSON 格式返回，不要包含任何其他文字：
{
  "medicine": [{"member_name": "姓名", "content": "提醒内容", "matched_items": ["物品名"]}],
  "daily": [{"member_name": "姓名", "content": "提醒内容", "matched_items": ["物品名"]}]
}`;

    const response = await anthropic.messages.create({
      model: 'mimo-v2.5-pro',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.text || '{}';
    // 尝试解析 JSON（兼容 markdown code block）
    let data;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : { medicine: [], daily: [] };
    } catch (parseErr) {
      data = { medicine: [], daily: [] };
    }

    res.json({ code: 0, data });
  } catch (e) { console.error('[health-ai] Error:', e.message, e.stack); res.status(500).json({ code: 500, message: e.message }); }
});

module.exports = router;