---
name: flight-compare
description: |
  多源机票价格对比工具。整合携程问道和飞猪(super-flight/flyai)两个数据源，
  并行查询并输出结构化对比表格，帮助用户找到最优机票价格。
  
  触发条件：用户询问机票价格、航班查询、价格对比、出行规划等。
  可与travel-itinerary技能集成，为旅行攻略提供实时价格信息。
---

# Flight Compare - 多源机票价格对比

## 功能

- 并行调用携程问道 API 和飞猪(flyai) CLI 查询机票
- 自动解析、去重、按价格排序
- 输出结构化对比表格（Markdown）
- 支持单程/往返查询

## 使用方法

### 快速查询

```bash
# 查询往返机票（推荐）
node scripts/compare.js --from "福州" --to "东京" --depart "2026-06-19" --return "2026-06-21"

# 查询单程机票
node scripts/compare.js --from "上海" --to "曼谷" --depart "2026-07-01"

# 指定币种（默认 CNY）
node scripts/compare.js --from "北京" --to "巴黎" --depart "2026-08-01" --currency USD
```

### 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `--from` | 出发城市（中文） | ✅ |
| `--to` | 目的城市（中文） | ✅ |
| `--depart` | 出发日期 (YYYY-MM-DD) | ✅ |
| `--return` | 返回日期 (YYYY-MM-DD) | ❌ |
| `--currency` | 币种 (CNY/USD) | ❌ |

### 输出示例

```
## ✈️ 福州 → 东京 机票价格对比

| # | 航空公司 | 航线 | 价格(CNY) | 数据源 | 出发日期 |
|---|---------|------|-----------|--------|----------|
| 1 | 国泰航空 | 福州→香港→东京 | ¥2,380 | 携程 | 06-19 |
| 2 | 国泰航空 | 福州→香港→东京 | ¥2,384 | 飞猪 | 06-19 |
| 3 | 柬埔寨航空 | 福州→金边→东京 | ¥2,427 | 飞猪 | 06-19 |

💡 建议：携程价格最低 ¥2,380（国泰航空，香港转机）
```

## 注意事项

- 携程问道需要有效的 API Key（通过环境变量 `WENDAO_API_KEY` 配置）
- flyai CLI 需要安装（`npm install -g flyai`）
- 两个数据源可能返回略有不同的结果（价格、航司、时间）
- 查询超时默认 10 秒，单个源超时不影响另一个源的结果

## 集成：与 travel-itinerary 技能配合使用

flight-compare 技能可以与 `travel-itinerary` 技能配合使用，为旅行攻略提供实时价格信息。

### 集成场景

当用户需要制作旅行攻略时，travel-itinerary 技能可以调用 flight-compare 来获取：
- 往返机票价格
- 酒店住宿价格
- 火车票价格
- 景点门票信息

### 调用示例

```bash
# 在 travel-itinerary 技能中调用机票查询
node /home/ubuntu/flight-compare/scripts/compare.js --from "福州" --to "东京" --depart "2026-06-19" --return "2026-06-21"

# 查询酒店价格
node /home/ubuntu/flight-compare/scripts/flyai_hotel.js --dest "东京" --check-in "2026-06-19" --check-out "2026-06-21"

# 查询火车票
node /home/ubuntu/flight-compare/scripts/flyai_train.js --from "北京" --to "上海" --depart "2026-06-19"
```

### 在攻略中嵌入价格信息

travel-itinerary 技能会在攻略的费用汇总表中嵌入实时价格：

```markdown
## 💰 费用汇总表

| 项目 | 预估费用 | 实时价格 | 备注 |
|------|----------|----------|------|
| 机票（往返） | ¥4000 | ¥3650 | 携程+飞猪对比最低价 |
| 住宿（5晚） | ¥2500 | ¥2800 | 4星级酒店 |
| 餐饮 | ¥1000 | ¥950 | 每天约¥200 |
| 门票 | ¥500 | ¥480 | 景点门票 |
| 交通 | ¥300 | ¥280 | 当地交通 |
| **总计** | **¥8300** | **¥8160** | |
```

### 相关技能

- **travel-itinerary**：旅行攻略生成技能，可集成 flight-compare 进行价格查询
- **super-flight**：飞猪机票查询技能
- **wendao-partner-qclaw-skill**：携程问道技能
