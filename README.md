# ✈️ flight-compare

多源机票价格对比工具。整合**携程问道**和**飞猪**(super-flight/flyai)两个数据源，并行查询并输出结构化对比表格，帮助用户找到最优机票价格。

## 功能

- 🔄 并行查询携程、飞猪两个数据源
- 📊 自动解析、去重、按价格排序
- 📋 输出结构化 Markdown 对比表格
- ✈️ 支持国内/国际航线、单程/往返查询

## 安装

```bash
git clone https://github.com/chenkunqing/flight-compare.git
cd flight-compare

# 安装依赖
npm install

# 配置携程 API Key（可选，不配置则只查飞猪）
export WENDAO_API_KEY="your_token_here"

# 安装 flyai CLI
npm install -g flyai
```

## 使用

```bash
# 查询往返机票
node scripts/compare.js --from "福州" --to "东京" --depart "2026-06-19" --return "2026-06-21"

# 查询单程机票
node scripts/compare.js --from "上海" --to "曼谷" --depart "2026-07-01"
```

## 作为 Hermes Agent Skill 使用

将此目录复制到 `~/.agents/skills/flight-compare/` 即可作为 Hermes Agent Skill 使用。

## 输出示例

```json
{
  "query": "福州 → 东京",
  "depart": "2026-06-19",
  "return": "2026-06-21",
  "flights": [
    {
      "airline": "国泰航空",
      "from": "福州",
      "to": "东京",
      "price": 2380,
      "source": "携程"
    },
    {
      "airline": "国泰航空",
      "from": "福州",
      "to": "东京",
      "price": 2384,
      "source": "飞猪"
    }
  ],
  "markdown": "## ✈️ 福州 → 东京 机票价格对比\n\n..."
}
```

## 数据源

| 数据源 | 说明 | CLI/API |
|--------|------|---------|
| 飞猪 | 通过 flyai CLI 查询 | `flyai search-flight` |
| 携程 | 通过携程问道 API | `wendao_query.js` |

## 许可

MIT
