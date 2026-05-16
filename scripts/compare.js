#!/usr/bin/env node
/**
 * compare.js - 多源机票价格对比工具
 * 
 * 并行调用携程问道和飞猪(flyai)查询机票，输出结构化对比表格。
 * 
 * 用法: node compare.js --from "福州" --to "东京" --depart "2026-06-19" [--return "2026-06-21"]
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

// 解析命令行参数
function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--from': parsed.from = args[++i]; break;
      case '--to': parsed.to = args[++i]; break;
      case '--depart': parsed.depart = args[++i]; break;
      case '--return': parsed.return = args[++i]; break;
      case '--currency': parsed.currency = args[++i]; break;
    }
  }
  return parsed;
}

// 查询携程问道（使用 wendao_search.js 解析脚本）
function queryWendao(args) {
  const scriptPath = path.join(__dirname, 'wendao_search.js');
  const params = [
    scriptPath,
    '--from', args.from,
    '--to', args.to,
    '--depart', args.depart
  ];
  
  if (args.return) {
    params.push('--return', args.return);
  }
  
  try {
    const result = spawnSync('node', params, {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, WENDAO_API_KEY: process.env.WENDAO_API_KEY || '' }
    });
    
    if (result.status !== 0) {
      return { source: '携程', error: result.stderr || '查询失败', flights: [] };
    }
    
    const data = JSON.parse(result.stdout);
    return data;
  } catch (err) {
    return { source: '携程', error: err.message, flights: [] };
  }
}

// 查询飞猪(flyai)
function queryFlyai(args) {
  const scriptPath = path.join(__dirname, 'flyai_query.js');
  const params = [
    scriptPath,
    '--from', args.from,
    '--to', args.to,
    '--depart', args.depart
  ];
  
  if (args.return) {
    params.push('--return', args.return);
  }
  
  try {
    const result = spawnSync('node', params, {
      encoding: 'utf8',
      timeout: 15000
    });
    
    if (result.status !== 0) {
      return { source: '飞猪', error: result.stderr || '查询失败' };
    }
    
    const data = JSON.parse(result.stdout);
    return data;
  } catch (err) {
    return { source: '飞猪', error: err.message };
  }
}

// 格式化价格
function formatPrice(price) {
  return `¥${price.toLocaleString('zh-CN')}`;
}

// 格式化输出表格
function formatTable(flights, args) {
  const header = `## ✈️ ${args.from} → ${args.to} 机票价格对比\n`;
  const dateInfo = `${args.depart}${args.return ? ' ~ ' + args.return : ''}\n\n`;
  
  if (flights.length === 0) {
    return header + dateInfo + '⚠️ 未找到航班信息，请检查城市名称或日期是否正确。';
  }
  
  let table = '| # | 航空公司 | 航线 | 价格(CNY) | 数据源 | 购票链接 |\n';
  table += '|---|---------|------|-----------|--------|----------|\n';
  
  flights.forEach((f, i) => {
    const route = f.segments && f.segments.length > 0 
      ? f.segments.map(s => s.from.split(/[,，]/)[0]).join('→') + '→' + (f.to || args.to).split(/[,，]/)[0]
      : `${f.from || args.from}→${f.to || args.to}`;
    
    // 购票链接
    const bookUrl = f.jumpUrl || f.bookUrl || '';
    let linkCell = '-';
    if (bookUrl) {
      if (bookUrl.startsWith('superlink://')) {
        // 携程 deeplink，显示为"携程App"
        linkCell = '[携程App](#' + encodeURIComponent(bookUrl.substring(0, 50)) + ')';
      } else if (bookUrl.startsWith('http')) {
        // 飞猪网页链接
        linkCell = '[购买](' + bookUrl + ')';
      }
    }
    
    table += `| ${i + 1} | ${f.airline} | ${route} | ${formatPrice(f.price)} | ${f.source} | ${linkCell} |\n`;
  });
  
  // 找出最低价
  const lowest = flights.reduce((min, f) => f.price < min.price ? f : min, flights[0]);
  const tip = `\n💡 建议：${lowest.source}价格最低 ${formatPrice(lowest.price)}（${lowest.airline}）`;
  
  // 添加链接说明
  const linkNote = '\n\n📱 点击「购买」跳转飞猪网页购票。携程航班需在手机上打开携程App。';
  
  return header + dateInfo + table + tip + linkNote;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.from || !args.to || !args.depart) {
    console.error('❌ 缺少必要参数');
    console.error('用法: node compare.js --from "福州" --to "东京" --depart "2026-06-19" [--return "2026-06-21"]');
    process.exit(1);
  }
  
  // 并行查询
  const wendaoPromise = new Promise(resolve => {
    const result = queryWendao(args);
    resolve(result);
  });
  
  const flyaiPromise = new Promise(resolve => {
    const result = queryFlyai(args);
    resolve(result);
  });
  
  const [wendaoResult, flyaiResult] = await Promise.all([wendaoPromise, flyaiPromise]);
  
  // 收集所有航班
  let allFlights = [];
  
  if (wendaoResult.flights && wendaoResult.flights.length > 0) {
    wendaoResult.flights.forEach(f => {
      f.source = '携程';
      allFlights.push(f);
    });
  }
  
  if (flyaiResult.flights && flyaiResult.flights.length > 0) {
    flyaiResult.flights.forEach(f => {
      f.source = '飞猪';
      allFlights.push(f);
    });
  }
  
  // 按价格排序
  allFlights.sort((a, b) => a.price - b.price);
  
  // 输出结果
  const output = {
    query: `${args.from} → ${args.to}`,
    depart: args.depart,
    return: args.return || null,
    sources: {
      wendao: wendaoResult.error ? { error: wendaoResult.error } : { count: wendaoResult.flights.length },
      flyai: flyaiResult.error ? { error: flyaiResult.error } : { count: flyaiResult.flights.length }
    },
    flights: allFlights,
    markdown: formatTable(allFlights, args)
  };
  
  console.log(JSON.stringify(output, null, 2));
}

main();
