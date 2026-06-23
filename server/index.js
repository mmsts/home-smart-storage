const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, saveDb } = require('./db/init');

async function startServer() {
  const db = await initDB();
  global.db = db;

  const app = express();
  const PORT = 4000;

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  const { generateToken, authMiddleware } = require('./middleware/auth');
  const { logActivity } = require('./middleware/activity-logger');

  app.post('/api/register', (req, res) => {
    try {
      const { username, password, nickname, gender, age, real_name } = req.body;
      if (!username || !password) return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) return res.status(400).json({ code: 400, message: '用户名已存在' });
      const result = db.prepare('INSERT INTO users (username, password, nickname, gender, age, real_name) VALUES (?, ?, ?, ?, ?, ?)')
        .run(username, password, nickname || username, gender || null, age || null, real_name || null);
      const user = db.prepare('SELECT id, username, nickname, avatar, phone, default_address, real_name, gender, age FROM users WHERE id = ?')
        .get(result.lastInsertRowid);
      const token = generateToken(user);
      res.json({ code: 0, data: { user, token }, message: '注册成功' });
    } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
  });

  app.post('/api/login', (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
      const user = db.prepare('SELECT id, username, nickname, avatar, phone, default_address, real_name, gender, age FROM users WHERE username = ? AND password = ?')
        .get(username, password);
      if (!user) return res.status(401).json({ code: 401, message: '用户名或密码错误' });
      const token = generateToken(user);
      res.json({ code: 0, data: { user, token }, message: '登录成功' });
    } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
  });

  app.get('/api/profile', authMiddleware, (req, res) => {
    try {
      const user = db.prepare('SELECT id, username, nickname, avatar, phone, default_address, real_name, gender, age FROM users WHERE id = ?').get(req.user.id);
      res.json({ code: 0, data: user });
    } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
  });

  app.put('/api/profile', authMiddleware, (req, res) => {
    try {
      const { nickname, phone, default_address, avatar, real_name, gender, age } = req.body;
      const oldUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

      db.prepare('UPDATE users SET nickname=?, phone=?, default_address=?, avatar=?, real_name=?, gender=?, age=? WHERE id=?')
        .run(nickname, phone, default_address, avatar, real_name || null, gender || null, age || null, req.user.id);
      const user = db.prepare('SELECT id, username, nickname, avatar, phone, default_address, real_name, gender, age FROM users WHERE id = ?').get(req.user.id);
      
      logActivity(db, {
        userId: req.user.id,
        action: 'update',
        targetType: 'user',
        targetId: user.id,
        targetName: user.nickname || user.username,
        oldValue: oldUser,
        newValue: user
      });
      
      res.json({ code: 0, data: user, message: '更新成功' });
    } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
  });

  // Avatar upload (accepts base64 data URL)
  app.post('/api/avatar', authMiddleware, (req, res) => {
    try {
      const { avatar } = req.body;
      if (!avatar || !avatar.startsWith('data:image/')) {
        return res.status(400).json({ code: 400, message: '请上传有效的图片' });
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const oldAvatar = user.avatar;
      
      db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar, req.user.id);
      
      logActivity(db, {
        userId: req.user.id,
        action: 'update',
        targetType: 'user',
        targetId: user.id,
        targetName: user.nickname || user.username,
        details: { type: 'avatar' }
      });
      
      res.json({ code: 0, data: { avatar }, message: '头像更新成功' });
    } catch (e) { res.status(500).json({ code: 500, message: e.message }); }
  });

  // Routes
  app.use('/api/items', require('./routes/items'));
  app.use('/api/modules', require('./routes/modules'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/families', require('./routes/families'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/search', require('./routes/search'));
  app.use('/api/reminders', require('./routes/reminders'));
  app.use('/api/boxes', require('./routes/boxes'));
  app.use('/api/activity-logs', require('./routes/activity-logs'));

  app.get('/api/health', (req, res) => res.json({ code: 0, message: 'OK' }));

  // Serve static frontend files
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  // SPA fallback: all non-API GET requests return index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });
