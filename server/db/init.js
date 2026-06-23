const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'storage.db');
let db = null;
let saveTimer = null;

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDb, 1000);
}

class DBWrapper {
  constructor(sqlJsDb) { this._db = sqlJsDb; }
  prepare(sql) { return new StmtWrapper(this, sql); }
  exec(sql) { this._db.run(sql); scheduleSave(); }
  export() { return this._db.export(); }
  pragma(str) { try { this._db.run(`PRAGMA ${str}`); } catch (e) {} }
}

class StmtWrapper {
  constructor(wrapper, sql) { this._wrapper = wrapper; this._sql = sql; }
  run(...params) {
    this._wrapper._db.run(this._sql, params);
    scheduleSave();
    return {
      lastInsertRowid: this._wrapper._db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0,
      changes: this._wrapper._db.getRowsModified()
    };
  }
  get(...params) {
    try {
      const stmt = this._wrapper._db.prepare(this._sql);
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames(); const vals = stmt.get(); stmt.free();
        const row = {}; cols.forEach((c, i) => row[c] = vals[i]); return row;
      }
      stmt.free(); return undefined;
    } catch (e) { return undefined; }
  }
  all(...params) {
    try {
      const results = this._wrapper._db.exec(this._sql, params);
      if (results.length === 0) return [];
      const cols = results[0].columns;
      return results[0].values.map(vals => {
        const row = {}; cols.forEach((c, i) => row[c] = vals[i]); return row;
      });
    } catch (e) { return []; }
  }
}

async function initDB() {
  const SQL = await initSqlJs();
  let sqlJsDb;

  let isNew = !fs.existsSync(dbPath);
  if (isNew) {
    sqlJsDb = new SQL.Database();
  } else {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlJsDb = new SQL.Database(fileBuffer);
  }
  db = new DBWrapper(sqlJsDb);

  // Migration: add show_on_home to custom_modules if missing
  try {
    const cols = db._db.exec("PRAGMA table_info(custom_modules)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(r => r[1]);
      if (!colNames.includes('show_on_home')) {
        db.exec('ALTER TABLE custom_modules ADD COLUMN show_on_home INTEGER DEFAULT 1');
      }
    }
  } catch (e) {}

  // Migration: add image to items if missing
  try {
    const cols = db._db.exec("PRAGMA table_info(items)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(r => r[1]);
      if (!colNames.includes('image')) {
        db.exec('ALTER TABLE items ADD COLUMN image TEXT');
      }
    }
  } catch (e) {}

  // Migration: update medicine category icons
  try {
    db.exec("UPDATE categories SET icon = '🤧' WHERE name = '感冒药' AND icon = '💊'");
    db.exec("UPDATE categories SET icon = '🤢' WHERE name = '肠胃药' AND icon = '💊'");
  } catch (e) {}

  // Migration: add real_name to users if missing
  try {
    const cols = db._db.exec("PRAGMA table_info(users)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(r => r[1]);
      if (!colNames.includes('real_name')) {
        db.exec('ALTER TABLE users ADD COLUMN real_name TEXT');
      }
    }
  } catch (e) {}

  // Migration: add low_stock_threshold to items if missing
  try {
    const cols = db._db.exec("PRAGMA table_info(items)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(r => r[1]);
      if (!colNames.includes('low_stock_threshold')) {
        db.exec('ALTER TABLE items ADD COLUMN low_stock_threshold INTEGER');
      }
      if (!colNames.includes('last_used_at')) {
        db.exec('ALTER TABLE items ADD COLUMN last_used_at TEXT');
      }
    }
  } catch (e) {}

  // User tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      tag_type TEXT NOT NULL DEFAULT 'custom',
      tag_text TEXT NOT NULL,
      is_auto INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(family_id, user_id, tag_type, tag_text)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_box_settings (
      user_id INTEGER NOT NULL,
      box_id TEXT NOT NULL,
      show_on_home INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, box_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      phone TEXT,
      default_address TEXT,
      age INTEGER,
      gender TEXT,
      health_info TEXT,
      real_name TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      family_id INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'general',
      is_dismissed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      address TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS family_members (
      family_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      tag TEXT,
      joined_at TEXT DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (family_id, user_id),
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS item_owners (
      item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (item_id, user_id),
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      storage_type TEXT NOT NULL DEFAULT 'custom',
      description TEXT,
      icon TEXT DEFAULT '📦',
      color TEXT DEFAULT '#1677ff',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      storage_type TEXT NOT NULL DEFAULT 'custom',
      module_id INTEGER,
      quantity INTEGER DEFAULT 1,
      unit TEXT DEFAULT '个',
      production_date TEXT,
      purchase_date TEXT,
      expiry_date TEXT,
      warranty_date TEXT,
      status TEXT DEFAULT 'in_use',
      brand TEXT,
      model TEXT,
      notes TEXT,
      family_id INTEGER,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (module_id) REFERENCES custom_modules(id),
      FOREIGN KEY (family_id) REFERENCES families(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custom_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📦',
      color TEXT DEFAULT '#4F6EF7',
      bg_gradient TEXT,
      description TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS boxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT,
      family_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS box_items (
      box_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      PRIMARY KEY (box_id, item_id),
      FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      target_name TEXT,
      details TEXT,
      old_value TEXT,
      new_value TEXT,
      family_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    );
  `);

  // Only seed data for new databases
  if (!isNew) { saveDb(); return db; }

  // Seed default categories
  const defaultCategories = [
    // 药箱 (medicine)
    ['感冒药', 'medicine', '感冒、发烧、咳嗽类药品', '🤧', '#ff4d4f', 1],
    ['肠胃药', 'medicine', '胃药、止泻药、助消化类', '🤢', '#ff4d4f', 1],
    ['外伤药', 'medicine', '创可贴、碘伏、纱布等', '🩹', '#ff4d4f', 1],
    ['维生素/保健', 'medicine', '维生素、钙片、保健品', '💛', '#ff4d4f', 1],
    ['其他药品', 'medicine', '其他医疗用品', '💊', '#ff4d4f', 1],
    // 日化 (daily)
    ['洗衣用品', 'daily', '洗衣液、柔顺剂、洗衣粉', '🧴', '#52c41a', 1],
    ['洗护用品', 'daily', '洗发水、沐浴露、护发素', '🧴', '#52c41a', 1],
    ['口腔护理', 'daily', '牙膏、牙刷、漱口水', '🪥', '#52c41a', 1],
    ['清洁用品', 'daily', '洗洁精、消毒液、清洁剂', '🧹', '#52c41a', 1],
    ['纸品/日用', 'daily', '纸巾、垃圾袋、保鲜膜', '🧻', '#52c41a', 1],
    ['护肤美妆', 'daily', '面霜、防晒、化妆品', '✨', '#52c41a', 1],
    ['其他日化', 'daily', '其他日化用品', '🧴', '#52c41a', 1],
  ];

  const insertCat = db.prepare('INSERT INTO categories (name, storage_type, description, icon, color, is_default) VALUES (?, ?, ?, ?, ?, 1)');
  for (const [name, type, desc, icon, color] of defaultCategories) {
    insertCat.run(name, type, desc, icon, color);
  }

  // ======== 测试数据 ========
  // 创建测试用户
  db.prepare('INSERT INTO users (id, username, password, nickname, phone, age, gender, health_info) VALUES (1, ?, ?, ?, ?, ?, ?, ?)')
    .run('test', '123456', '张三', '13800138000', 45, '男', '高血压，需要定期服用降压药');
  db.prepare('INSERT INTO users (id, username, password, nickname, phone, age, gender, health_info) VALUES (2, ?, ?, ?, ?, ?, ?, ?)')
    .run('test2', '123456', '李四', '13900139000', 42, '女', '油性皮肤，敏感肌');
  db.prepare('INSERT INTO users (id, username, password, nickname, phone, age, gender, health_info) VALUES (3, ?, ?, ?, ?, ?, ?, ?)')
    .run('test3', '123456', '小明', '13700137000', 15, '男', '');

  // 创建测试家庭
  db.prepare('INSERT INTO families (id, name, owner_id, address, description) VALUES (1, ?, ?, ?, ?)')
    .run('张三一家', 1, '北京市朝阳区XX小区', '温馨的三口之家');
  db.prepare('INSERT INTO family_members (family_id, user_id, role, tag) VALUES (1, 1, ?, ?)').run('owner', '爸爸');
  db.prepare('INSERT INTO family_members (family_id, user_id, role, tag) VALUES (1, 2, ?, ?)').run('member', '妈妈');
  db.prepare('INSERT INTO family_members (family_id, user_id, role, tag) VALUES (1, 3, ?, ?)').run('member', '孩子');

  // 创建储物箱
  const boxes = [
    ['家庭药箱', '客厅柜子第二层'],
    ['日化收纳箱', '卫生间储物柜'],
    ['自定义收纳箱', '书房储物架'],
  ];
  const insertBox = db.prepare('INSERT INTO boxes (name, position, family_id) VALUES (?, ?, 1)');
  for (const [name, pos] of boxes) insertBox.run(name, pos);

  // ======== 药箱类物品 ========
  const medicineItems = [
    ['布洛芬缓释胶囊', 1, '芬必得', '0.3g*20粒/盒', 5, '盒', '2025-01-15', '2025-06-01', '2027-01-14', '感冒药'],
    ['复方氨酚烷胺片', 1, '快克', '12片/盒', 3, '盒', '2025-03-10', '2025-03-10', '2027-03-09', '感冒药'],
    ['连花清瘟胶囊', 1, '以岭', '0.35g*48粒/盒', 1, '盒', '2024-12-01', '2024-12-15', '2026-11-30', '感冒药'],
    ['蒙脱石散', 2, '思密达', '3g*10袋/盒', 4, '盒', '2025-02-20', '2025-02-20', '2027-02-19', '肠胃药'],
    ['藿香正气水', 2, '太极', '10ml*10支/盒', 0, '盒', '2024-08-01', '2024-08-15', '2026-07-31', '肠胃药'],
    ['健胃消食片', 2, '江中', '0.8g*32片/盒', 1, '盒', '2025-04-01', '2025-04-01', '2027-03-31', '肠胃药'],
    ['创可贴', 3, '云南白药', '100片/盒', 1, '盒', '2025-01-01', '2025-01-15', '2028-12-31', '外伤药'],
    ['碘伏消毒液', 3, '利尔康', '100ml/瓶', 3, '瓶', '2025-03-01', '2025-03-01', '2027-02-28', '外伤药'],
    ['医用纱布', 3, '稳健', '10卷/包', 2, '包', '2025-01-01', '2025-01-15', '2028-12-31', '外伤药'],
    ['红霉素软膏', 3, '马应龙', '10g/支', 2, '支', '2025-02-01', '2025-02-01', '2027-01-31', '外伤药'],
    ['维生素C片', 4, '养生堂', '100片/瓶', 4, '瓶', '2025-01-01', '2025-01-20', '2027-01-19', '维生素/保健'],
    ['钙尔奇D3', 4, '惠氏', '60片/瓶', 2, '瓶', '2025-02-15', '2025-02-15', '2027-02-14', '维生素/保健'],
    ['鱼油软胶囊', 4, '汤臣倍健', '100粒/瓶', 1, '瓶', '2024-11-01', '2024-11-15', '2026-10-31', '维生素/保健'],
    ['体温计', 5, '欧姆龙', '电子体温计', 1, '个', null, '2024-06-01', null, '其他药品'],
    ['医用口罩', 5, '稳健', '50只/盒', 0, '盒', '2024-12-01', '2024-12-15', '2026-11-30', '其他药品'],
    ['退热贴', 5, '小林制药', '6片/盒', 2, '盒', '2025-04-01', '2025-04-01', '2027-03-31', '感冒药'],
    ['硝苯地平缓释片', 5, '拜耳', '30mg*7片/盒', 3, '盒', '2025-03-01', '2025-03-15', '2027-03-14', '降压药'],
    ['氨氯地平片', 5, '辉瑞', '5mg*7片/盒', 2, '盒', '2025-04-01', '2025-04-10', '2027-04-09', '降压药'],
  ];

  const insertItem = db.prepare(`INSERT INTO items (name, category_id, storage_type, brand, model, quantity, unit, production_date, purchase_date, expiry_date, notes, status, created_by, family_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_use', 1, 1)`);
  const insertBoxItem = db.prepare('INSERT INTO box_items (box_id, item_id, quantity) VALUES (?, ?, ?)');

  // All medicine items → box 1 (家庭药箱)
  for (const [name, catId, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes] of medicineItems) {
    const result = insertItem.run(name, catId, 'medicine', brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes);
    const itemId = result.lastInsertRowid;
    insertBoxItem.run(1, itemId, qty);
  }

  // ======== 日化类物品 ========
  // All daily items → box 2 (日化收纳箱)
  const dailyItems = [
    ['蓝月亮洗衣液', 6, '蓝月亮', '3kg/瓶', 1, '瓶', '2025-01-01', '2025-01-15', '2027-12-31', '洗衣用品'],
    ['金纺柔顺剂', 6, '金纺', '2L/瓶', 3, '瓶', '2025-02-01', '2025-02-10', '2027-08-01', '洗衣用品'],
    ['奥妙洗衣凝珠', 6, '奥妙', '52颗/盒', 2, '盒', '2025-03-01', '2025-03-15', '2027-09-01', '洗衣用品'],
    ['海飞丝洗发水', 7, '海飞丝', '750ml/瓶', 4, '瓶', '2025-01-01', '2025-01-20', '2028-01-01', '洗护用品'],
    ['力士沐浴露', 7, '力士', '750ml/瓶', 2, '瓶', '2025-02-01', '2025-02-15', '2028-02-01', '洗护用品'],
    ['潘婷护发素', 7, '潘婷', '500ml/瓶', 1, '瓶', '2025-03-01', '2025-03-10', '2028-03-01', '洗护用品'],
    ['高露洁牙膏', 8, '高露洁', '200g/支', 5, '支', '2025-01-01', '2025-01-10', '2027-07-01', '口腔护理'],
    ['电动牙刷头', 8, '飞利浦', 'HX6062/2只装', 2, '盒', null, '2025-02-01', null, '口腔护理'],
    ['李施德林漱口水', 8, '李施德林', '500ml/瓶', 1, '瓶', '2025-01-01', '2025-01-15', '2027-01-01', '口腔护理'],
    ['立白洗洁精', 9, '立白', '1.5kg/瓶', 1, '瓶', '2025-01-01', '2025-01-05', '2027-06-01', '清洁用品'],
    ['84消毒液', 9, '蓝月亮', '2L/瓶', 0, '瓶', '2025-02-01', '2025-02-10', '2026-08-01', '清洁用品'],
    ['威猛先生厨房清洁剂', 9, '威猛先生', '500ml/瓶', 3, '瓶', '2025-03-01', '2025-03-15', '2027-09-01', '清洁用品'],
    ['维达抽纸', 10, '维达', '3层120抽*24包', 6, '提', null, '2025-04-01', null, '纸品/日用'],
    ['垃圾袋', 10, '妙洁', '50只/卷', 8, '卷', null, '2025-03-01', null, '纸品/日用'],
    ['保鲜膜', 10, '妙洁', '30m/卷', 3, '卷', null, '2025-02-15', null, '纸品/日用'],
    ['欧莱雅面霜', 11, '欧莱雅', '50ml/瓶', 2, '瓶', '2025-01-01', '2025-01-20', '2027-01-20', '护肤美妆'],
    ['安耐晒防晒霜', 11, '安耐晒', '60ml/瓶', 1, '瓶', '2025-03-01', '2025-03-15', '2027-03-15', '护肤美妆'],
  ];

  for (const [name, catId, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes] of dailyItems) {
    const result = insertItem.run(name, catId, 'daily', brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes);
    const itemId = result.lastInsertRowid;
    insertBoxItem.run(2, itemId, qty);
  }

  // 插入部分即将过期的物品（用于测试提醒功能）
  const expiringItems = [
    ['板蓝根颗粒', 1, '白云山', '10g*20袋/盒', 1, '盒', '2024-06-01', '2024-06-15', '2026-06-14', '感冒药'],
    ['开塞露', 2, '恒健', '20ml*2支/盒', 1, '盒', '2024-07-01', '2024-07-10', '2026-07-09', '肠胃药'],
  ];
  for (const [name, catId, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes] of expiringItems) {
    const result = insertItem.run(name, catId, 'medicine', brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes);
    const itemId = result.lastInsertRowid;
    insertBoxItem.run(1, itemId, qty);
  }

  // ======== 自定义类物品 ========
  // All custom items → box 3 (自定义收纳箱)
  const customItems = [
    ['螺丝刀套装', null, '世达', '十字+一字 10件套', 1, '套', null, '2025-01-10', null, '工具'],
    ['收纳盒', null, '天马', '透明带盖 3个装', 3, '个', null, '2025-03-01', null, '收纳'],
  ];
  for (const [name, catId, brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes] of customItems) {
    const result = insertItem.run(name, catId, 'custom', brand, model, qty, unit, prodDate, purchaseDate, expiryDate, notes);
    const itemId = result.lastInsertRowid;
    insertBoxItem.run(3, itemId, qty);
  }

  // ======== 物品归属数据 ========
  const insertOwner = db.prepare('INSERT INTO item_owners (item_id, user_id) VALUES (?, ?)');
  // 药箱物品 - 全家共用 (item_id 1-18 are medicine items, including 2 hypertension drugs)
  for (let i = 1; i <= 18; i++) {
    insertOwner.run(i, 1); // 爸爸
    insertOwner.run(i, 2); // 妈妈
  }
  // 日化物品 - 全家共用 (item_id 19-35 are daily items)
  for (let i = 19; i <= 35; i++) {
    insertOwner.run(i, 1); // 爸爸
    insertOwner.run(i, 2); // 妈妈
  }
  // 即将过期物品 - 全家共用 (item_id 36-37)
  insertOwner.run(36, 1); insertOwner.run(36, 2); insertOwner.run(36, 3);
  insertOwner.run(37, 1); insertOwner.run(37, 2); insertOwner.run(37, 3);
  // 自定义物品 - 全家共用 (item_id 38-39)
  insertOwner.run(38, 1); insertOwner.run(38, 2);
  insertOwner.run(39, 1); insertOwner.run(39, 2);

  // ======== 用户标签数据 ========
  const insertUserTag = db.prepare('INSERT INTO user_tags (family_id, user_id, tag_type, tag_text, is_auto) VALUES (?, ?, ?, ?, 0)');
  insertUserTag.run(1, 1, 'health', '高血压');
  insertUserTag.run(1, 2, 'lifestyle', '敏感肌');
  insertUserTag.run(1, 2, 'lifestyle', '油性皮肤');

  // ======== 提醒数据 ========
  const reminders = [
    [1, 1, '用药提醒', '降压药不能切开或碾碎服用，需整片吞服，否则会影响药效释放速度。', 'medicine'],
    [1, 1, '用药提醒', '布洛芬缓释胶囊应饭后服用，减少胃部刺激。', 'medicine'],
    [1, 1, '存储提醒', '藿香正气水含酒精，服用后请勿驾车。', 'medicine'],
    [2, 1, '护肤提醒', '油性皮肤建议使用清爽型护肤品，避免过于油腻的产品堵塞毛孔。', 'daily'],
    [2, 1, '存储提醒', '化妆品开封后请注意保质期，一般建议6-12个月内用完。', 'daily'],
    [3, 1, '用药提醒', '连花清瘟胶囊不宜长期服用，症状缓解后应及时停药。', 'medicine'],
    [null, 1, '过期提醒', '板蓝根颗粒即将过期（2026-06-14），请及时处理。', 'expiry'],
    [null, 1, '过期提醒', '开塞露即将过期（2026-07-09），请及时处理。', 'expiry'],
  ];
  const insertReminder = db.prepare('INSERT INTO reminders (user_id, family_id, title, content, type) VALUES (?, ?, ?, ?, ?)');
  for (const [userId, familyId, title, content, type] of reminders) {
    insertReminder.run(userId, familyId, title, content, type);
  }

  saveDb();
  return db;
}

module.exports = { initDB, saveDb };
