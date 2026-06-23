import React, { useState, useRef, useEffect } from 'react'
import { Dialog, Toast } from 'antd-mobile'
import { ai } from '../api'
import { Html5Qrcode } from 'html5-qrcode'
import { icons } from '../styles/theme'

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '哈喽！我是你的家庭储物助手。今天需要帮你记录新买的物品，还是查找家里的库存？随时告诉我，让我们一起把家变得井井有条。' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const menuRef = useRef(null);

  const appleShadow = '0 4px 20px rgba(0,0,0,0.04)';

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!showActionMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionMenu]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = messages
        .filter((m, i) => i > 0 || m.role !== 'assistant')
        .map(m => ({ role: m.role, content: m.content || '' }))
        .filter(m => m.content);
      history.push({ role: 'user', content: msg });

      const res = await ai.chat(msg, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) { console.error('AI请求失败:', err); setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，暂时无法处理您的请求。\n\n' + (err.message || '未知错误') }]); }
    setLoading(false);
  };

  // 压缩图片为base64
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 800;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width > height) { height = (height / width) * maxSize; width = maxSize; }
            else { width = (width / height) * maxSize; height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // 拍照识图
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64 = await compressImage(file);
    setMessages(prev => [...prev, { role: 'user', content: '[图片]', image: base64 }]);
    setLoading(true);

    try {
      const res = await ai.analyzeImage(base64);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '图片识别失败，请稍后再试。' }]);
    }
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 打开扫码器
  const startScanner = async () => {
    setShowActionMenu(false);
    setScannerVisible(true);
  };

  // 扫码器 DOM 渲染后初始化摄像头
  useEffect(() => {
    if (!scannerVisible || html5QrCodeRef.current) return;
    const timer = setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(t => t.stop());

        const html5QrCode = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            stopScanner();
            handleScanResult(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error('启动扫码失败:', err);
        setScannerVisible(false);
        html5QrCodeRef.current = null;
        const msg = err.name === 'NotAllowedError'
          ? '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问。'
          : '无法启动摄像头：' + err.message;
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [scannerVisible]);

  // 停止扫码器
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setScannerVisible(false);
  };

  // 打开药品查询网页
  const openDrugQuery = (code) => {
    const firstDigit = code.charAt(0);
    let url;
    if (firstDigit === '8') {
      url = `https://www.mashangfangxin.com/drugQueryResult?code=${code}`;
    } else if (['0', '1', '2', '3', '4'].includes(firstDigit)) {
      url = `https://www.mashangfangxin.com/rqQueryResult?code=${code}`;
    } else {
      url = `https://www.mashangfangxin.com/drugQueryResult?code=${code}`;
    }
    window.open(url, '_blank');
  };

  // 保存药品到物品库
  const saveDrugToInventory = async (code) => {
    const result = await Dialog.confirm({
      title: '保存到物品库',
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>追溯码: {code}</p>
          <p style={{ fontSize: 12, color: '#999' }}>请在平台查询后，输入药品名称保存</p>
        </div>
      ),
      confirmText: '去查询并保存',
      cancelText: '取消'
    });

    if (result) {
      openDrugQuery(code);
      Toast.show({ content: '请在平台查询药品名称后，返回此处输入', position: 'center' });
    }
  };

  // 处理扫码结果
  const handleScanResult = async (content) => {
    setMessages(prev => [...prev, { role: 'user', content: `📱 扫码：${content}` }]);
    setLoading(true);

    try {
      const res = await ai.processScanResult(content);
      const data = res.data;

      if (data.type === 'drug' && data.queryUrl) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          drugQuery: { code: data.code, queryUrl: data.queryUrl }
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '处理扫码结果失败，请稍后再试。' }]);
    }
    setLoading(false);
  };

  // Action menu items
  const actionMenuItems = [
    {
      icon: icons.camera,
      label: '拍照识物',
      desc: 'AI 识别物品',
      action: () => { setShowActionMenu(false); fileInputRef.current?.click(); }
    },
    {
      icon: icons.scan,
      label: '扫码查询',
      desc: '药品 / 条码',
      action: () => startScanner()
    },
    {
      icon: icons.edit,
      label: '手动记录',
      desc: '快速添加物品',
      action: () => { setShowActionMenu(false); sendMessage('我想手动添加一个物品'); }
    },
    {
      icon: icons.chart,
      label: '库存分析',
      desc: '查看家庭库存',
      action: () => { setShowActionMenu(false); sendMessage('帮我分析一下家里目前的库存情况'); }
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 16px)', background: '#F5F7FA', margin: '-16px -16px 0', overscrollBehavior: 'none', overflow: 'hidden' }}>
      {/* Hidden file input */}
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhotoCapture} style={{ display: 'none' }} />

      {/* Apple-style Navigation Bar — Fixed */}
      <div style={{
        padding: '8px 20px 0',
        position: 'relative',
        zIndex: 20,
        flexShrink: 0,
        background: '#F5F7FA',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          paddingBottom: 8
        }}>
          <div>
            <div style={{
              fontSize: 12, color: '#8E8E93', marginBottom: 6,
              letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600
            }}>
              AI 助手
            </div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px',
              lineHeight: 1.1, color: '#1C1C1E', margin: 0
            }}>
              家庭储物助手
            </h1>
          </div>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <div onClick={() => setShowActionMenu(!showActionMenu)} style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: appleShadow,
              transition: 'transform 0.15s ease'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>

            {/* Action Menu Dropdown */}
            {showActionMenu && (
              <div style={{
                position: 'absolute', top: 44, right: 0,
                width: 220,
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 16,
                boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
                padding: '6px 0',
                animation: 'menuFadeIn 0.15s ease',
                zIndex: 100,
              }}>
                {actionMenuItems.map((item, i) => (
                  <div key={i} onClick={item.action} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px',
                    cursor: 'pointer',
                    borderBottom: i < actionMenuItems.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                    transition: 'background 0.1s'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 20, color: '#007AFF', display: 'flex', width: 24, justifyContent: 'center' }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '12px 20px 80px', overscrollBehavior: 'none', background: '#F5F7FA' }}>

        {/* Chat Messages */}
        <div style={{ marginBottom: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 14
            }}>
              {msg.role === 'assistant' && (
                <div style={{
                  width: 34, height: 34, borderRadius: 12,
                  overflow: 'hidden',
                  marginRight: 10, flexShrink: 0
                }}>
                  <img src="/robot.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div style={{
                maxWidth: '82%',
                padding: '12px 16px',
                fontSize: 14,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...(msg.role === 'user' ? {
                  background: '#1C1C1E',
                  color: '#FFFFFF',
                  borderRadius: '20px 20px 6px 20px',
                } : {
                  background: '#FFFFFF',
                  color: '#1C1C1E',
                  borderRadius: '20px 20px 20px 6px',
                  boxShadow: appleShadow,
                })
              }}>
                {msg.image && <img src={msg.image} alt="拍摄的图片" style={{ maxWidth: '100%', borderRadius: 12, marginBottom: 8, display: 'block' }} />}
                {msg.content}
                {msg.drugQuery && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div onClick={() => openDrugQuery(msg.drugQuery.code)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#1C1C1E', color: '#FFFFFF',
                      padding: '10px 16px', borderRadius: 14, cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: 18 }}>💊</span> 查询药品详情
                    </div>
                    <div onClick={() => saveDrugToInventory(msg.drugQuery.code)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#F5F7FA', color: '#1C1C1E',
                      padding: '10px 16px', borderRadius: 14, cursor: 'pointer',
                      fontSize: 13, fontWeight: 500, justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: 16 }}>📦</span> 保存到物品库
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12,
                overflow: 'hidden',
                marginRight: 10, flexShrink: 0
              }}>
                <img src="/robot.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{
                padding: '12px 16px',
                background: '#FFFFFF',
                borderRadius: '20px 20px 20px 6px',
                boxShadow: appleShadow,
                color: '#8E8E93',
                fontSize: 14,
              }}>
                <span style={{ animation: 'pulse 1.2s infinite' }}>思考中...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Capsule Input Bar — Fixed */}
      <div style={{
        position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '10px 20px 0',
        background: '#F5F7FA', zIndex: 50,
        boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            background: '#FFFFFF',
            borderRadius: 24,
            height: 48,
            padding: '0 18px',
            boxShadow: appleShadow,
            border: '1px solid rgba(0,0,0,0.04)',
          }}>
            <input
              type="text"
              placeholder="输入消息..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: 15, color: '#1C1C1E',
                background: 'transparent',
                fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
              }}
            />
          </div>
          <div
            onClick={() => sendMessage()}
            style={{
              width: 48, height: 48, borderRadius: 24,
              background: input.trim() ? '#1C1C1E' : '#E5E5EA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'background 0.2s ease',
              boxShadow: input.trim() ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={input.trim() ? '#FFFFFF' : '#AEAEB2'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Scanner Overlay */}
      {scannerVisible && (
        <div className="scanner-overlay">
          <div className="scanner-header">
            <span style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>扫描二维码/条形码</span>
            <span onClick={stopScanner} style={{ fontSize: 28, color: '#fff', cursor: 'pointer', lineHeight: 1 }}>✕</span>
          </div>
          <div id="qr-reader" ref={scannerRef} className="scanner-container" />
          <p style={{ color: '#fff', textAlign: 'center', marginTop: 16, fontSize: 14, opacity: 0.8 }}>
            将二维码/条形码放入框内自动扫描
          </p>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 } 50% { opacity: 0.4 }
        }
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        input::placeholder {
          color: #C7C7CC;
        }
      `}</style>
    </div>
  );
}
