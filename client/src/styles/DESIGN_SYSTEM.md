# 家庭智能储物系统 — 设计系统

## 设计气质

**关键词：** 米白 · 黑白线条 · 克制 · 有温度

**灵感来源：** Minna Bank — 用最少的色彩和最克制的视觉语言，创造温暖而有秩序感的体验。

---

## 1. 色彩体系

### 核心原则
- **米白色背景** — 不是纯白，是带暖调的奶油色
- **黑色线条** — 所有图标和插画使用深炭灰 `#2C2824` 单色描边
- **极克制的强调色** — 仅用于可交互元素（按钮、链接），不用于装饰

### 背景色
| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-page` | `#F7F3EE` | 页面底色（米白/奶油） |
| `--bg-card` | `#FEFCF9` | 卡片（比页面稍浅的暖白） |

### 文字色
| Token | 值 | 用途 |
|-------|-----|------|
| `--text-primary` | `#2C2824` | 标题、正文（深炭灰，非纯黑） |
| `--text-secondary` | `#8A8279` | 次要信息（暖灰） |
| `--text-hint` | `#C5BEB5` | 占位符（浅暖灰） |

### 强调色（极克制使用）
| Token | 值 | 用途 |
|-------|-----|------|
| `--primary` | `#C4554D` | 仅按钮、链接、关键数据 |
| `--primary-light` | `#FDF5F3` | 强调色浅背景 |

### 语义色（低饱和度）
| Token | 值 | 用途 |
|-------|-----|------|
| `--success` | `#5A9E6F` | 在用/正常 |
| `--warning` | `#D4915A` | 待处理/补货 |
| `--danger` | `#C4554D` | 过期/丢失 |
| `--info` | `#6B8DAD` | 借出/信息 |

### 储物箱配色（8 色低饱和度）
`#C4554D` `#D4915A` `#5A9E6F` `#5B7FA5` `#8A7FB0` `#5A9E9E` `#B07070` `#7A8A5A`

---

## 2. 图标风格

### 线条图标
- 所有功能图标使用 **SVG 线条图标**（1.5px 描边、round 端点、无填充）
- 颜色通过 `currentColor` 继承父元素
- 定义在 `theme.jsx` 的 `icons` 对象中

### 可用图标
`icons.medicine` `icons.daily` `icons.box` `icons.chart` `icons.home` `icons.family` `icons.edit` `icons.ai` `icons.camera` `icons.scan` `icons.user` `icons.search` `icons.bell`

---

## 3. 插画风格

### 线条插画
- 用于空状态、登录页、装饰性区域
- 1.5px 描边、round 端点、无填充
- 深炭灰 `#2C2824`，极低透明度（0.08-0.2）
- 定义在 `theme.jsx` 的 `illustrations` 对象中

### 可用插画
`illustrations.homeScene` — 家庭场景（房子+储物箱）
`illustrations.emptyBox` — 空箱子（空状态）
`illustrations.medicineBottle` — 药瓶
`illustrations.storageBox` — 收纳盒
`illustrations.chartIllustration` — 统计图表
`illustrations.aiAssistant` — AI 助手

---

## 4. 设计原则

1. **米白底色** — 整体视觉在米白/奶油色上展开，不是纯白
2. **黑色线条为主** — 图标、插画、标题都使用深炭灰
3. **强调色极克制** — 珊瑚红 `#C4554D` 仅用于按钮和关键数据
4. **无渐变装饰** — Hero Header 使用纯深炭灰背景
5. **插画做减法** — 线条插画以极低透明度出现，是氛围不是主角
6. **圆角但不过度** — 卡片 14-16px，按钮 12px
7. **阴影极轻** — 几乎看不见，但能创造微妙的层次感
