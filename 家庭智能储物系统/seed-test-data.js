/**
 * 家庭智能储物系统 - 测试数据生成脚本
 * 运行方式: node seed-test-data.js
 */

const initSqlJs = require('./server/node_modules/sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'db', 'storage.db');

async function seedData() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // 辅助函数：执行SQL并获取lastInsertRowid
  function run(sql, params = []) {
    db.run(sql, params);
    const result = db.exec("SELECT last_insert_rowid()");
    return result[0]?.values[0]?.[0] || 0;
  }

  // ===== 1. 添加更多用户 =====
  const users = [
    ['wangwu', '123456', '王五', '13600136000', 38, '男', '过敏性鼻炎'],
    ['zhaoliu', '123456', '赵六', '13500135000', 35, '女', ''],
    ['sunqi', '123456', '孙七', '13400134000', 68, '男', '糖尿病，需控制饮食'],
    ['zhouba', '123456', '周八', '13300133000', 65, '女', '骨质疏松，需补钙'],
  ];

  const userIds = [];
  for (const [username, password, nickname, phone, age, gender, health] of users) {
    const id = run(
      'INSERT INTO users (username, password, nickname, phone, age, gender, health_info) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, password, nickname, phone, age, gender, health]
    );
    userIds.push(id);
    console.log(`  创建用户: ${nickname} (ID: ${id})`);
  }

  // ===== 2. 添加更多家庭 =====
  // 王五一家 (user 4)
  const family2 = run(
    'INSERT INTO families (name, owner_id, address, description) VALUES (?, ?, ?, ?)',
    ['王五一家', userIds[0], '上海市浦东新区YY花园', '幸福的四口之家']
  );
  run('INSERT INTO family_members (family_id, user_id, role, tag) VALUES (?, ?, ?, ?)',
    [family2, userIds[0], 'owner', '爸爸']);
  run('INSERT INTO family_members (family_id, user_id, role, tag) VALUES (?, ?, ?, ?)',
    [family2, userIds[1], 'member', '妈妈']);

  // 老年关怀家庭 (user 6, 7 - 孙七和周八)
  const family3 = run(
    'INSERT INTO families (name, owner_id, address, description) VALUES (?, ?, ?, ?)',
    ['孙七老两口', userIds[2], '广州市天河区ZZ社区', '退休老两口，注重健康管理']
  );
  run('INSERT INTO family_members (family_id, user_id, role, tag) VALUES (?, ?, ?, ?)',
    [family3, userIds[2], 'owner', '爷爷']);
  run('INSERT INTO family_members (family_id, user_id, role, tag) VALUES (?, ?, ?, ?)',
    [family3, userIds[3], 'member', '奶奶']);

  console.log(`  创建家庭: 王五一家 (ID: ${family2})`);
  console.log(`  创建家庭: 孙七老两口 (ID: ${family3})`);

  // ===== 3. 添加自定义储物模块 =====
  const modules = [
    ['儿童用品', '🧸', '#ff69b4', 'linear-gradient(135deg, #ff69b4 0%, #ff1493 100%)', userIds[0]],
    ['厨房用品', '🍳', '#ff7a45', 'linear-gradient(135deg, #ff7a45 0%, #ff4d4f 100%)', userIds[0]],
    ['宠物用品', '🐾', '#722ed1', 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)', userIds[0]],
    ['运动器材', '⚽', '#13c2c2', 'linear-gradient(135deg, #13c2c2 0%, #87e8de 100%)', userIds[2]],
    ['园艺工具', '🌱', '#52c41a', 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)', userIds[2]],
  ];

  const moduleIds = [];
  for (const [name, icon, color, gradient, createdBy] of modules) {
    const id = run(
      'INSERT INTO custom_modules (name, icon, color, bg_gradient, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, icon, color, gradient, `${name}管理模块`, createdBy]
    );
    moduleIds.push(id);
    console.log(`  创建模块: ${name} (ID: ${id})`);
  }

  // ===== 4. 为王五一家添加储物箱 =====
  const boxes2 = [
    ['儿童药箱', '儿童房柜子', family2],
    ['厨房收纳柜', '厨房吊柜', family2],
    ['宠物用品箱', '阳台储物架', family2],
  ];
  const boxIds2 = [];
  for (const [name, pos, fid] of boxes2) {
    const id = run('INSERT INTO boxes (name, position, family_id) VALUES (?, ?, ?)', [name, pos, fid]);
    boxIds2.push(id);
    console.log(`  创建储物箱: ${name} (ID: ${id})`);
  }

  // 为孙七老两口添加储物箱
  const boxes3 = [
    ['老年药箱', '卧室床头柜', family3],
    ['保健品收纳', '客厅展示柜', family3],
    ['园艺工具箱', '阳台储物柜', family3],
  ];
  const boxIds3 = [];
  for (const [name, pos, fid] of boxes3) {
    const id = run('INSERT INTO boxes (name, position, family_id) VALUES (?, ?, ?)', [name, pos, fid]);
    boxIds3.push(id);
    console.log(`  创建储物箱: ${name} (ID: ${id})`);
  }

  // ===== 5. 添加物品数据 =====
  // 使用已有的分类ID (1-12是默认分类)
  // 1=感冒药, 2=肠胃药, 3=外伤药, 4=维生素/保健, 5=其他药品
  // 6=洗衣用品, 7=洗护用品, 8=口腔护理, 9=清洁用品, 10=纸品/日用, 11=护肤美妆, 12=其他日化

  // 王五一家的物品
  const family2Items = [
    // 儿童药箱 (box 4)
    ['小儿氨酚黄那敏颗粒', 1, 'medicine', '小快克', '10袋/盒', 3, '盒', '2025-02-01', '2025-02-15', '2027-02-14', '感冒药', boxIds2[0], userIds[0], family2],
    ['美林布洛芬混悬液', 1, 'medicine', '上海强生', '100ml/瓶', 2, '瓶', '2025-01-01', '2025-01-20', '2027-01-19', '感冒药', boxIds2[0], userIds[0], family2],
    ['蒙脱石散(儿童装)', 2, 'medicine', '思密达', '3g*10袋/盒', 2, '盒', '2025-03-01', '2025-03-10', '2027-03-09', '肠胃药', boxIds2[0], userIds[0], family2],
    ['创可贴(卡通)', 3, 'medicine', '云南白药', '20片/盒', 4, '盒', '2025-01-01', '2025-01-15', '2028-12-31', '外伤药', boxIds2[0], userIds[0], family2],
    ['儿童维生素软糖', 4, 'medicine', '汤臣倍健', '60粒/瓶', 1, '瓶', '2025-04-01', '2025-04-15', '2027-04-14', '维生素/保健', boxIds2[0], userIds[0], family2],

    // 厨房收纳柜 (box 5)
    ['保鲜膜', 10, 'daily', '妙洁', '30m/卷', 5, '卷', null, '2025-03-01', null, '纸品/日用', boxIds2[1], userIds[0], family2],
    ['密封袋', 10, 'daily', '妙洁', '中号20只/盒', 3, '盒', null, '2025-02-15', null, '纸品/日用', boxIds2[1], userIds[0], family2],
    ['洗洁精', 9, 'cleaning', '立白', '1kg/瓶', 2, '瓶', '2025-01-01', '2025-01-10', '2027-06-01', '清洁用品', boxIds2[1], userIds[1], family2],
    ['厨房湿巾', 9, 'cleaning', '维达', '40抽/包', 6, '包', null, '2025-04-01', null, '清洁用品', boxIds2[1], userIds[1], family2],

    // 宠物用品箱 (box 6)
    ['猫粮', null, 'custom', '皇家', '2kg/袋', 1, '袋', '2025-03-01', '2025-03-15', '2026-03-14', '宠物食品', boxIds2[2], userIds[0], family2],
    ['猫砂', null, 'custom', 'pidan', '6L/袋', 3, '袋', null, '2025-04-01', null, '宠物清洁', boxIds2[2], userIds[0], family2],
    ['猫罐头', null, 'custom', '希宝', '80g*6罐/组', 2, '组', '2025-02-01', '2025-02-15', '2027-02-14', '宠物食品', boxIds2[2], userIds[1], family2],
  ];

  for (const [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, boxId, createdBy, familyId] of family2Items) {
    const itemId = run(
      `INSERT INTO items (name, category_id, storage_type, brand, model, quantity, unit, production_date, purchase_date, expiry_date, notes, status, created_by, family_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_use', ?, ?)`,
      [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, createdBy, familyId]
    );
    run('INSERT INTO box_items (box_id, item_id, quantity) VALUES (?, ?, ?)', [boxId, itemId, qty]);
    run('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)', [itemId, userIds[0]]);
    if (userIds[1]) run('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)', [itemId, userIds[1]]);
  }
  console.log(`  为王五一家添加了 ${family2Items.length} 件物品`);

  // 孙七老两口的物品
  const family3Items = [
    // 老年药箱 (box 7)
    ['二甲双胍片', 5, 'medicine', '格华止', '0.5g*20片/盒', 6, '盒', '2025-01-01', '2025-01-15', '2027-01-14', '降糖药', boxIds3[0], userIds[2], family3],
    ['阿卡波糖片', 5, 'medicine', '拜耳', '50mg*30片/盒', 4, '盒', '2025-02-01', '2025-02-10', '2027-02-09', '降糖药', boxIds3[0], userIds[2], family3],
    ['硝苯地平缓释片', 5, 'medicine', '拜耳', '30mg*7片/盒', 8, '盒', '2025-01-01', '2025-01-20', '2027-01-19', '降压药', boxIds3[0], userIds[2], family3],
    ['阿司匹林肠溶片', 5, 'medicine', '拜耳', '100mg*30片/盒', 3, '盒', '2025-03-01', '2025-03-15', '2027-03-14', '抗血小板药', boxIds3[0], userIds[2], family3],
    ['碳酸钙D3片', 4, 'medicine', '钙尔奇', '60片/瓶', 2, '瓶', '2025-02-01', '2025-02-15', '2027-02-14', '补钙', boxIds3[0], userIds[3], family3],
    ['电子血压计', 5, 'medicine', '欧姆龙', 'U10L', 1, '台', null, '2024-06-01', null, '医疗器械', boxIds3[0], userIds[2], family3],
    ['血糖仪试纸', 5, 'medicine', '罗氏', '50片/盒', 2, '盒', '2025-04-01', '2025-04-10', '2026-10-09', '检测试纸', boxIds3[0], userIds[2], family3],

    // 保健品收纳 (box 8)
    ['深海鱼油', 4, 'medicine', '汤臣倍健', '100粒/瓶', 2, '瓶', '2025-01-01', '2025-01-20', '2027-01-19', '维生素/保健', boxIds3[1], userIds[2], family3],
    ['辅酶Q10', 4, 'medicine', '汤臣倍健', '60粒/瓶', 1, '瓶', '2025-02-01', '2025-02-15', '2027-02-14', '维生素/保健', boxIds3[1], userIds[2], family3],
    ['氨糖软骨素', 4, 'medicine', '健力多', '100片/瓶', 3, '瓶', '2025-03-01', '2025-03-10', '2027-03-09', '维生素/保健', boxIds3[1], userIds[3], family3],
    ['蛋白粉', 4, 'medicine', '汤臣倍健', '400g/罐', 1, '罐', '2025-01-01', '2025-01-15', '2026-07-14', '维生素/保健', boxIds3[1], userIds[3], family3],

    // 园艺工具箱 (box 9)
    ['园艺剪刀', null, 'custom', '得力', '大号', 2, '把', null, '2024-03-01', null, '园艺工具', boxIds3[2], userIds[2], family3],
    ['浇水壶', null, 'custom', '花彩', '2L', 1, '个', null, '2024-03-01', null, '园艺工具', boxIds3[2], userIds[2], family3],
    ['花土', null, 'custom', '翠筠', '5L/袋', 3, '袋', null, '2025-03-01', null, '园艺材料', boxIds3[2], userIds[2], family3],
    ['花肥', null, 'custom', '美乐棵', '500g/袋', 2, '袋', null, '2025-02-15', '2027-02-14', '园艺材料', boxIds3[2], userIds[2], family3],
  ];

  for (const [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, boxId, createdBy, familyId] of family3Items) {
    const itemId = run(
      `INSERT INTO items (name, category_id, storage_type, brand, model, quantity, unit, production_date, purchase_date, expiry_date, notes, status, created_by, family_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_use', ?, ?)`,
      [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, createdBy, familyId]
    );
    run('INSERT INTO box_items (box_id, item_id, quantity) VALUES (?, ?, ?)', [boxId, itemId, qty]);
    run('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)', [itemId, userIds[2]]);
    if (userIds[3]) run('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)', [itemId, userIds[3]]);
  }
  console.log(`  为孙七老两口添加了 ${family3Items.length} 件物品`);

  // ===== 6. 添加提醒数据 =====
  const reminders = [
    // 王五一家的提醒
    [userIds[0], family2, '用药提醒', '小儿氨酚黄那敏颗粒请按儿童体重计算用量，切勿过量。', 'medicine'],
    [userIds[0], family2, '存储提醒', '猫粮开封后请密封保存，建议1个月内用完。', 'general'],
    [userIds[1], family2, '宠物提醒', '猫咪驱虫药需每3个月使用一次，下次驱虫时间：2025-07-15。', 'general'],

    // 孙七老两口的提醒
    [userIds[2], family3, '用药提醒', '二甲双胍需随餐服用，避免空腹引起胃部不适。', 'medicine'],
    [userIds[2], family3, '用药提醒', '降压药需每天定时服用，不可随意停药或减量。', 'medicine'],
    [userIds[2], family3, '健康提醒', '建议每周测量血压2-3次，记录数据供医生参考。', 'general'],
    [userIds[2], family3, '过期提醒', '蛋白粉即将过期（2026-07-14），请及时食用或处理。', 'expiry'],
    [userIds[3], family3, '用药提醒', '碳酸钙D3片建议饭后服用，吸收效果更好。', 'medicine'],
    [userIds[3], family3, '存储提醒', '花土请存放在干燥通风处，避免受潮发霉。', 'general'],
  ];

  for (const [userId, familyId, title, content, type] of reminders) {
    run('INSERT INTO reminders (user_id, family_id, title, content, type) VALUES (?, ?, ?, ?, ?)',
      [userId, familyId, title, content, type]);
  }
  console.log(`  添加了 ${reminders.length} 条提醒`);

  // ===== 7. 添加更多即将过期的物品（测试提醒功能）=====
  const expiringItems = [
    ['板蓝根颗粒(补充)', 1, 'medicine', '白云山', '10g*20袋/盒', 2, '盒', '2024-07-01', '2024-07-15', '2026-07-14', '感冒药', 1, 1, 1],
    ['藿香正气水(补充)', 2, 'medicine', '太极', '10ml*10支/盒', 1, '盒', '2024-08-01', '2024-08-15', '2026-08-14', '肠胃药', 1, 1, 1],
    ['防晒霜(去年)', 11, 'daily', '安耐晒', '60ml/瓶', 1, '瓶', '2024-06-01', '2024-06-15', '2026-06-14', '护肤美妆', 2, 1, 1],
  ];

  for (const [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, boxId, createdBy, familyId] of expiringItems) {
    const itemId = run(
      `INSERT INTO items (name, category_id, storage_type, brand, model, quantity, unit, production_date, purchase_date, expiry_date, notes, status, created_by, family_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_use', ?, ?)`,
      [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, createdBy, familyId]
    );
    run('INSERT INTO box_items (box_id, item_id, quantity) VALUES (?, ?, ?)', [boxId, itemId, qty]);
    run('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)', [itemId, 1]);
    run('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)', [itemId, 2]);
  }
  console.log(`  添加了 ${expiringItems.length} 件即将过期物品`);

  // ===== 8. 添加一些已用完和已过期的物品（测试状态筛选）=====
  const archivedItems = [
    ['感冒灵颗粒', 1, 'medicine', '999', '10g*9袋/盒', 0, '盒', '2024-01-01', '2024-01-15', '2026-01-14', '感冒药', 1, 1, 1, 'used_up'],
    ['维达抽纸(旧)', 10, 'daily', '维达', '3层120抽*24包', 0, '提', null, '2024-06-01', null, '纸品/日用', 2, 1, 1, 'used_up'],
    ['过期口罩', 5, 'medicine', '稳健', '50只/盒', 1, '盒', '2023-06-01', '2023-06-15', '2025-06-14', '其他药品', 1, 1, 1, 'expired'],
  ];

  for (const [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, boxId, createdBy, familyId, status] of archivedItems) {
    const itemId = run(
      `INSERT INTO items (name, category_id, storage_type, brand, model, quantity, unit, production_date, purchase_date, expiry_date, notes, status, created_by, family_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, catId, storageType, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes, status, createdBy, familyId]
    );
    run('INSERT INTO box_items (box_id, item_id, quantity) VALUES (?, ?, ?)', [boxId, itemId, qty]);
  }
  console.log(`  添加了 ${archivedItems.length} 件已归档物品`);

  // 保存数据库
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('\n✅ 测试数据生成完成！数据库已保存。');

  // 输出统计
  const stats = db.exec(`
    SELECT
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM families) as families,
      (SELECT COUNT(*) FROM items) as items,
      (SELECT COUNT(*) FROM boxes) as boxes,
      (SELECT COUNT(*) FROM reminders) as reminders,
      (SELECT COUNT(*) FROM custom_modules) as modules,
      (SELECT COUNT(*) FROM categories) as categories
  `);
  if (stats.length > 0) {
    const s = stats[0].values[0];
    console.log('\n📊 数据库统计:');
    console.log(`  用户: ${s[0]} | 家庭: ${s[1]} | 物品: ${s[2]} | 储物箱: ${s[3]}`);
    console.log(`  提醒: ${s[4]} | 自定义模块: ${s[5]} | 分类: ${s[6]}`);
  }

  db.close();
}

seedData().catch(err => {
  console.error('❌ 生成测试数据失败:', err);
  process.exit(1);
});
