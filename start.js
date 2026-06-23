// Render 部署启动入口（不修改原始文件）
// 通过 monkey-patch 将监听地址改为 0.0.0.0，使云平台可访问

const express = require('express');
const origListen = express.application.listen;
express.application.listen = function(...args) {
  // 将 127.0.0.1 替换为 0.0.0.0
  if (args[1] === '127.0.0.1') {
    args[1] = '0.0.0.0';
  }
  return origListen.apply(this, args);
};

// 加载原始服务器（__dirname 自动指向正确的 server 目录）
require('./家庭智能储物系统/server/index.js');
