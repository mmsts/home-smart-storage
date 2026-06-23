const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: 'tp-cxw76msg4pzvv47icdew5lm1ouj76g4betkourqz6zighcf5',
  baseURL: 'https://token-plan-cn.xiaomimimo.com/anthropic',
});

router.use(authMiddleware);

function getUserContext(db, userId) {
  // 获取用户所有物品及所在箱子
  const items = db.prepare(`
    SELECT i.name, i.quantity, i.unit, i.brand, i.expiry_date, i.status, i.storage_type,
           c.name as category_name, b.name as box_name, b.position
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN box_items bi ON bi.item_id = i.id
    LEFT JOIN boxes b ON bi.box_id = b.id
    WHERE i.created_by = ?
    ORDER BY i.updated_at DESC
  `).all(userId);

  // 获取储物箱列表
  const boxes = db.prepare(`
    SELECT b.name, b.position, COUNT(bi.item_id) as item_count
    FROM boxes b LEFT JOIN box_items bi ON bi.box_id = b.id
    WHERE b.family_id = (SELECT family_id FROM family_members WHERE user_id = ? LIMIT 1)
    GROUP BY b.id
  `).all(userId);

  // 即将过期物品
  const expiring = db.prepare(`
    SELECT name, expiry_date FROM items
    WHERE created_by = ? AND expiry_date IS NOT NULL
    AND expiry_date <= date('now', '+30 days', 'localtime')
    AND expiry_date >= date('now', 'localtime')
    ORDER BY expiry_date LIMIT 10
  `).all(userId);

  // 已过期物品
  const expired = db.prepare(`
    SELECT name, expiry_date FROM items
    WHERE created_by = ? AND expiry_date IS NOT NULL
    AND expiry_date < date('now', 'localtime')
    ORDER BY expiry_date LIMIT 10
  `).all(userId);

  // 低库存物品
  const lowStock = db.prepare(`
    SELECT name, quantity, unit FROM items
    WHERE created_by = ? AND quantity <= 1 AND status = 'in_use' AND unit != '个'
    LIMIT 10
  `).all(userId);

  return { items, boxes, expiring, expired, lowStock };
}

// 获取当前季节和节日信息
function getSeasonContext() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  let season = '', tips = '', festival = '';

  if (month >= 3 && month <= 5) { season = '春季'; tips = '春季潮湿多雨，注意防潮防霉，过敏原增多，过敏药物和除湿用品需求上升'; }
  else if (month >= 6 && month <= 8) { season = '夏季'; tips = '夏季高温，防暑降温用品、驱蚊用品、防晒用品消耗加快，注意药品避光储存'; }
  else if (month >= 9 && month <= 11) { season = '秋季'; tips = '秋季干燥，润肤保湿用品消耗增加，换季时注意整理收纳'; }
  else { season = '冬季'; tips = '冬季寒冷，感冒发烧药品需求增加，注意保暖用品储备，取暖设备检查'; }

  // 购物节检测
  let shoppingEvents = [];
  if (month === 6 && day >= 1 && day <= 20) shoppingEvents.push({ name: '618大促', desc: '年中大促，适合囤货日用品、个护、家庭清洁用品' });
  if (month === 11 && day >= 1 && day <= 20) shoppingEvents.push({ name: '双11', desc: '全年最大促销，适合大量囤货纸巾、洗衣液、洗发水等消耗品' });
  if (month === 12 && day >= 20 || month === 1 && day <= 15) shoppingEvents.push({ name: '年货节', desc: '春节前采购高峰，适合补充零食、调味品、清洁用品' });
  if (month === 3 && day >= 1 && day <= 20) shoppingEvents.push({ name: '38女神节', desc: '美妆个护、女性用品促销力度大' });

  return { season, tips, shoppingEvents };
}

// 智能提醒接口
router.get('/tips', async (req, res) => {
  try {
    const db = global.db;
    const ctx = getUserContext(db, req.user.id);
    const seasonCtx = getSeasonContext();
    const tips = [];

    // 过期/即将过期提醒（最高优先级）
    if (ctx.expired.length > 0) {
      tips.push({
        icon: '🔴', type: 'expiry',
        title: '有物品已过期',
        content: `${ctx.expired.map(i => i.name).join('、')} 已过期，请及时处理`,
        items: ctx.expired.map(i => i.name)
      });
    }
    if (ctx.expiring.length > 0) {
      tips.push({
        icon: '🟡', type: 'expiry',
        title: '即将过期提醒',
        content: `${ctx.expiring.map(i => i.name).join('、')} 将在30天内过期`,
        items: ctx.expiring.map(i => i.name)
      });
    }

    // 低库存 + 购物节建议
    if (ctx.lowStock.length > 0 && seasonCtx.shoppingEvents.length > 0) {
      const event = seasonCtx.shoppingEvents[0];
      tips.push({
        icon: '🛒', type: 'shopping',
        title: `${event.name}囤货建议`,
        content: `${event.name}即将到来！以下物品库存不足，建议趁活动补充：${ctx.lowStock.map(i => `${i.name}（剩${i.quantity}${i.unit}）`).join('、')}`,
        items: ctx.lowStock.map(i => i.name)
      });
    } else if (ctx.lowStock.length > 0) {
      tips.push({
        icon: '🟠', type: 'stock',
        title: '库存不足提醒',
        content: `以下物品需要补充：${ctx.lowStock.map(i => `${i.name}（剩${i.quantity}${i.unit}）`).join('、')}`,
        items: ctx.lowStock.map(i => i.name)
      });
    }

    // 季节性建议
    const seasonItems = [];
    if (seasonCtx.season === '冬季' || seasonCtx.season === '秋季') {
      const hasColdMedicine = ctx.items.some(i => i.category_name === '感冒药' || i.name.includes('感冒') || i.name.includes('退烧'));
      if (!hasColdMedicine) seasonItems.push('感冒药');
    }
    if (seasonCtx.season === '夏季') {
      const hasMosquito = ctx.items.some(i => i.name.includes('蚊') || i.name.includes('驱蚊'));
      if (!hasMosquito) seasonItems.push('驱蚊用品');
    }
    if (seasonItems.length > 0) {
      tips.push({
        icon: '🌿', type: 'seasonal',
        title: `${seasonCtx.season}储备建议`,
        content: `${seasonCtx.season}来了，${seasonCtx.tips}。建议检查是否需要补充：${seasonItems.join('、')}`,
        items: seasonItems
      });
    }

    // 默认建议
    if (tips.length === 0) {
      tips.push({
        icon: '💡', type: 'general',
        title: '收纳小贴士',
        content: seasonCtx.tips + '。定期检查物品保质期，保持储物空间整洁有序~',
        items: []
      });
    }

    res.json({ code: 0, data: tips });
  } catch (e) {
    console.error('获取提醒失败:', e.message);
    res.json({ code: 0, data: [] });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const db = global.db;
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ code: 400, message: '消息不能为空' });

    const ctx = getUserContext(db, req.user.id);

    // 构建物品清单摘要
    let itemList = '';
    if (ctx.items.length > 0) {
      itemList = ctx.items.map(i => {
        let s = `- ${i.name}`;
        if (i.brand) s += `(${i.brand})`;
        s += ` ${i.quantity}${i.unit || '个'}`;
        if (i.box_name) s += ` → 在「${i.box_name}」${i.position ? '(' + i.position + ')' : ''}`;
        if (i.expiry_date) s += ` 有效期至${i.expiry_date}`;
        if (i.status !== 'in_use') s += ` [${i.status}]`;
        return s;
      }).join('\n');
    }

    let boxList = ctx.boxes.map(b => `- 「${b.name}」位于${b.position || '未标注'}，含${b.item_count}件物品`).join('\n');

    let alertSection = '';
    if (ctx.expired.length > 0) {
      alertSection += '\n已过期物品：\n' + ctx.expired.map(i => `- ${i.name}（过期日：${i.expiry_date}）`).join('\n');
    }
    if (ctx.expiring.length > 0) {
      alertSection += '\n即将过期物品（30天内）：\n' + ctx.expiring.map(i => `- ${i.name}（${i.expiry_date}）`).join('\n');
    }
    if (ctx.lowStock.length > 0) {
      alertSection += '\n低库存物品：\n' + ctx.lowStock.map(i => `- ${i.name}（剩余${i.quantity}${i.unit}）`).join('\n');
    }

    const seasonCtx = getSeasonContext();

    const systemPrompt = `你是一个温柔专业的家庭储物整理专家，名叫"储物助手"。你的职责是帮助用户管理家庭物品、提供收纳建议、查找物品位置、提醒过期和低库存。

你说话的风格：温暖亲切、专业可靠、简洁实用。适当使用emoji让回复更生动。回答要简洁，避免过长。

以下是用户家中的实际储物数据，请基于这些真实数据回答用户的问题：

【储物箱】
${boxList || '暂无储物箱'}

【物品清单】
${itemList || '暂无物品'}
${alertSection ? '\n【需要关注】' + alertSection : ''}

【当前季节】${seasonCtx.season} — ${seasonCtx.tips}
${seasonCtx.shoppingEvents.length > 0 ? '\n【近期购物节】\n' + seasonCtx.shoppingEvents.map(e => `- ${e.name}：${e.desc}`).join('\n') : ''}

你的额外职责：
1. 根据季节变化，主动提醒用户哪些物品可能需要补充（如冬天提醒感冒药、夏天提醒驱蚊用品）
2. 如果当前临近购物节（618、双11等），结合用户的低库存和即将过期物品，生成购买建议清单
3. 根据用户的物品使用情况，给出收纳整理的贴心建议
4. 记住用户在对话中提到的信息，保持连贯的对话体验

请根据用户的实际物品情况给出针对性的建议，不要编造不存在的物品。如果用户问到你不知道的物品，如实告知。`;

    // 构建消息列表：历史 + 当前消息，最多保留最近10条
    let messages = [];
    if (history && Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-10);
      messages = recentHistory.map(h => ({
        role: h.role,
        content: typeof h.content === 'string' ? h.content : ''
      })).filter(m => m.content && (m.role === 'user' || m.role === 'assistant'));
      // 确保最后一条是当前用户消息
      if (messages.length === 0 || messages[messages.length - 1].content !== message) {
        messages.push({ role: 'user', content: message });
      }
    } else {
      messages = [{ role: 'user', content: message }];
    }

    const response = await anthropic.messages.create({
      model: 'mimo-v2.5-pro',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    });

    console.log('\n========== AI响应 ==========');
    console.log('stop_reason:', response.stop_reason);
    console.log('content长度:', response.content?.length);
    console.log('content[0]:', JSON.stringify(response.content?.[0]));
    console.log('============================\n');

    const reply = response.content[0]?.text || '抱歉，暂时无法处理您的请求。';
    res.json({ code: 0, data: { reply } });
  } catch (e) {
    console.error('\n========== AI对话失败 ==========');
    console.error('错误信息:', e.message);
    console.error('错误类型:', e.constructor.name);
    if (e.status) console.error('HTTP状态码:', e.status);
    if (e.error) console.error('API返回:', JSON.stringify(e.error));
    console.error('================================\n');
    res.json({
      code: 0,
      data: { reply: '抱歉，AI服务暂时不可用，请稍后再试～\n\n' + e.message }
    });
  }
});

// 图片识别接口
router.post('/analyze-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ code: 400, message: '请上传图片' });

    // 从base64 data URL提取媒体类型和数据
    const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ code: 400, message: '图片格式无效' });

    const mediaType = `image/${match[1]}`;
    const base64Data = match[2];

    const message = await anthropic.messages.create({
      model: 'mimo-v2.5-pro',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data }
          },
          {
            type: 'text',
            text: '你是一个温柔专业的家庭储物整理专家。请分析这张图片：\n1. 识别图片中的物品（名称、大致数量）\n2. 推荐合适的分类\n3. 给出贴心的收纳建议\n\n请用温暖亲切的中文回复，语气柔和专业，适当使用emoji让内容更生动。'
          }
        ]
      }]
    });

    const reply = message.content[0]?.text || '无法识别图片内容';
    res.json({ code: 0, data: { reply } });
  } catch (e) {
    console.error('图片识别失败:', e.message);
    res.json({
      code: 0,
      data: { reply: '🔍 图片识别暂时不可用，请稍后再试。\n\n错误信息：' + e.message }
    });
  }
});

// 药品追溯码检测
function detectDrugCode(content) {
  // 纯20位数字追溯码
  if (/^\d{20}$/.test(content.trim())) {
    return { type: 'drug_code', code: content.trim() };
  }
  // URL中包含药品追溯平台
  const drugPlatformPatterns = [
    { pattern: /mashangfangxin\.com.*[?&]code=(\d{20})/i, platform: '马上放心' },
    { pattern: /mashangfangxin\.com.*\/(\d{20})/i, platform: '马上放心' },
    { pattern: /mashangfangxin\.com/i, platform: '马上放心' },
    { pattern: /drugtrace/i, platform: '药品追溯' },
    { pattern: /ypzh\.org/i, platform: '中国药品追溯' },
  ];
  for (const { pattern, platform } of drugPlatformPatterns) {
    const match = content.match(pattern);
    if (match) {
      return { type: 'drug_url', platform, code: match[1] || null, url: content };
    }
  }
  return null;
}

// 药品追溯码对应的查询URL
function getDrugQueryUrl(code) {
  if (!code || code.length !== 20) return null;
  const firstDigit = code.charAt(0);
  // 8开头走drugQueryResult，0-4开头走rqQueryResult
  if (firstDigit === '8') {
    return `https://www.mashangfangxin.com/drugQueryResult?code=${code}`;
  } else if (['0', '1', '2', '3', '4'].includes(firstDigit)) {
    return `https://www.mashangfangxin.com/rqQueryResult?code=${code}`;
  }
  return `https://www.mashangfangxin.com/drugQueryResult?code=${code}`;
}

// 扫码结果处理接口
router.post('/scan-result', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ code: 400, message: '扫码内容不能为空' });

    // 检测是否为药品追溯码
    const drugInfo = detectDrugCode(content);
    if (drugInfo) {
      const code = drugInfo.code || content;
      const queryUrl = getDrugQueryUrl(code);

      // 先查库是否已保存过该药品
      const db = global.db;
      const existingItem = db.prepare(`
        SELECT i.name, i.brand, i.model, i.quantity, i.unit, i.expiry_date, i.notes,
               b.name as box_name, b.position
        FROM items i
        LEFT JOIN box_items bi ON bi.item_id = i.id
        LEFT JOIN boxes b ON bi.box_id = b.id
        WHERE i.notes LIKE ?
        LIMIT 1
      `).get(`%${code}%`);

      if (existingItem) {
        return res.json({
          code: 0,
          data: {
            reply: `💊 已找到药品记录：\n\n• 名称：${existingItem.name}\n• 品牌：${existingItem.brand || '未知'}\n• 规格：${existingItem.model || '未知'}\n• 数量：${existingItem.quantity}${existingItem.unit || '个'}\n• 有效期至：${existingItem.expiry_date || '未设置'}\n• 存放位置：${existingItem.box_name ? `「${existingItem.box_name}」${existingItem.position ? '(' + existingItem.position + ')' : ''}` : '未分配'}`,
            type: 'drug_saved',
            code,
            queryUrl,
            item: existingItem
          }
        });
      }

      // 返回查询链接
      return res.json({
        code: 0,
        data: {
          reply: `💊 检测到药品追溯码：${code}\n\n该药品尚未录入物品库，点击下方按钮查询详情或保存。`,
          type: 'drug',
          code,
          queryUrl
        }
      });
    }

    // 检查是否为URL
    const urlPattern = /^https?:\/\/.+/i;
    if (urlPattern.test(content)) {
      // 是URL，尝试抓取网页内容
      try {
        const response = await fetch(content, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml'
          },
          signal: AbortSignal.timeout(8000)
        });
        const html = await response.text();

        // 提取纯文本内容（去掉HTML标签）
        const textContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 1500);

        // 用AI总结网页内容
        const summary = await anthropic.messages.create({
          model: 'mimo-v2.5-pro',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `你是一个温柔专业的家庭储物整理专家。用户扫描了一个二维码/条形码，链接内容如下：\n\n${textContent}\n\n请用温暖亲切的中文总结这个链接的主要内容，如果与商品或物品相关，可以贴心地给出收纳建议。语气柔和专业，适当使用emoji。`
          }]
        });
        const reply = summary.content[0]?.text || '无法总结网页内容';
        res.json({ code: 0, data: { reply, url: content, type: 'url' } });
      } catch (fetchErr) {
        res.json({
          code: 0,
          data: {
            reply: `🔗 扫码结果：${content}\n\n⚠️ 无法访问该链接：${fetchErr.message}`,
            url: content,
            type: 'url'
          }
        });
      }
    } else {
      // 不是URL，直接返回文本内容
      // 尝试在数据库中搜索匹配物品
      const db = global.db;
      const items = db.prepare(`
        SELECT i.name, b.name as box_name, b.position
        FROM items i
        LEFT JOIN box_items bi ON bi.item_id = i.id
        LEFT JOIN boxes b ON bi.box_id = b.id
        WHERE i.created_by = ? AND i.name LIKE ?
        LIMIT 5
      `).all(req.user.id, `%${content}%`);

      let reply = `📱 扫码内容：${content}`;
      if (items.length > 0) {
        reply += '\n\n📦 找到相关物品：\n';
        items.forEach(item => {
          reply += `\n• ${item.name}`;
          if (item.box_name) reply += ` → 在「${item.box_name}」`;
          if (item.position) reply += `（${item.position}）`;
        });
      } else {
        reply += '\n\n未在您的物品库中找到匹配项。';
      }
      res.json({ code: 0, data: { reply, type: 'text' } });
    }
  } catch (e) {
    console.error('扫码处理失败:', e.message);
    res.status(500).json({ code: 500, message: e.message });
  }
});

module.exports = router;
