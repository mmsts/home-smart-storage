// Render 部署启动入口（不修改原始文件）
// 通过 monkey-patch 将监听地址改为 0.0.0.0，使云平台可访问

const path = require('path');

// 切换到 server 目录，确保 require 能找到 server/node_modules
process.chdir(path.join(__dirname, 'server'));

const express = require('express');
const origListen = express.application.listen;
express.application.listen = function(...args) {
  if (args[1] === '127.0.0.1') {
    args[1] = '0.0.0.0';
  }
  return origListen.apply(this, args);
};

// 加载原始服务器
require('./index.js');
