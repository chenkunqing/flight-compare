#!/usr/bin/env node
/**
 * wendao_search.js - 携程问道机票查询（解析文本输出为 JSON）
 * 
 * 用法: node wendao_search.js --from "福州" --to "东京" --depart "2026-06-19" [--return "2026-06-21"]
 * 
 * 输出: JSON 格式的航班列表
 */

const { execSync } = require('child_process');
const path = require('path');

const TOKEN = (process.env.WENDAO_API_KEY || "").trim();
const WENDAO_SCRIPT = path.join(__dirname, 'wendao_query.js');

// 航空公司代码映射
const AIRLINE_CODES = {
  'CX': '国泰航空', 'KA': '国泰港龙',
  'MU': '东方航空', 'CA': '中国国航', 'CZ': '南方航空',
  '3U': '四川航空', 'FM': '上海航空', 'HU': '海南航空',
  '9C': '春秋航空', 'AQ': '九元航空', 'HO': '吉祥航空',
  'TW': '泰国亚航', 'VJ': '越捷航空', 'ZG': '柬埔寨航空',
  'K6': '柬埔寨航空', 'VN': '越南航空', 'JL': '日本航空',
  'MM': '乐桃航空', 'MF': '厦门航空', 'AE': '华信航空',
  'GK': '日本捷星', 'NH': '全日空', 'JQ': '捷星',
  '5J': '宿务太平洋', 'AK': '亚洲航空', 'D7': '亚洲航空X',
  'BR': '长荣航空', 'CI': '中华航空', 'TG': '泰国航空',
  'SQ': '新加坡航空', 'QF': '澳洲航空', 'EY': '阿提哈德',
  'QR': '卡塔尔航空', 'EK': '阿联酋航空',
  'LH': '汉莎航空', 'AF': '法国航空', 'BA': '英国航空',
  'KL': '荷兰皇家', 'OS': '奥地利航空', 'SK': '北欧航空',
  'AY': '芬兰航空', 'IB': '伊比利亚', 'AZ': '意大利航空'
};

function getAirlineName(code) {
  const prefix = code.substring(0, 2).toUpperCase();
  return AIRLINE_CODES[prefix] || code;
}

// 解析命令行参数
function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--from': parsed.from = args[++i]; break;
      case '--to': parsed.to = args[++i]; break;
      case '--depart': parsed.depart = args[++i]; break;
      case '--return': parsed.return = args[++i]; break;
    }
  }
  return parsed;
}

// 构建查询字符串
function buildQuery(args) {
  let query = `${args.depart}${args.from}到${args.to}`;
  if (args.return) {
    query += `，${args.return}返回的往返机票`;
  } else {
    query += '的单程机票';
  }
  return query;
}

// 从文本中提取航班信息
function parseFlightsFromText(text, args) {
  const flights = [];
  
  // 按航班块分割（每对 航班1+航班2 构成一个往返方案）
  // 匹配模式：##### [航班 1] ... ##### [航班 2] ...
  const blocks = text.split(/#####\s*\[航班\s*1\]/);
  
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    
    // 提取价格（优先从 **￥2380** 格式中提取）
    const priceMatch = block.match(/\*\*￥([\d,]+)\*\*/);
    if (!priceMatch) continue;
    const price = parseInt(priceMatch[1].replace(/,/g, ''));
    
    // 提取航班号（从 URL 编码中提取，如 flightNO%22%3A%2522CX995）
    const flightNoMatches = [...block.matchAll(/flightNO.*?%2522([A-Z]{2}\d+)/gi)];
    const flightNos = flightNoMatches.map(m => m[1]);
    const primaryFlightNo = flightNos[0] || '';
    
    // 提取起飞时间
    const depTimeMatch = block.match(/起飞[：:].*?(\d{1,2}:\d{2})/);
    const depTime = depTimeMatch ? depTimeMatch[1] : '';
    
    // 提取到达时间
    const arrTimeMatch = block.match(/到达[：:].*?(\d{1,2}:\d{2})/);
    const arrTime = arrTimeMatch ? arrTimeMatch[1] : '';
    
    // 提取飞行时间
    const durationMatch = block.match(/飞行时间[：:]([\dh]+m?)/);
    const duration = durationMatch ? durationMatch[1] : '';
    
    // 提取出发机场
    const depStationMatch = block.match(/起飞[：:]\s*(\S+)\s+(\S+)\s+\d/);
    const depStation = depStationMatch ? `${depStationMatch[1]}${depStationMatch[2]}` : args.from;
    
    // 提取到达机场（从 "到达：6月19日 周五 东京 成田T2 20:50" 中提取）
    const arrStationMatch = block.match(/到达[：:].*?(东京|上海|北京|广州|香港|台北|大阪|曼谷|新加坡|吉隆坡|首尔|河内|胡志明|金边|暹粒|马尼拉|雅加达|巴厘岛|悉尼|墨尔本|奥克兰|伦敦|巴黎|法兰克福|纽约|洛杉矶|迪拜|多哈|莫斯科|布达佩斯|尼斯|罗马|米兰|威尼斯|巴塞罗那|马德里|里斯本|开罗|内罗毕|毛里求斯|南非|开普敦|肯尼亚|巴西|圣保罗|里约|瑞士|苏黎世|日内瓦|冰岛|雷克雅未克)\s*(\S+)/);
    const arrStation = arrStationMatch ? `${arrStationMatch[1]}${arrStationMatch[2]}` : args.to;
    
    // 提取购票链接（superlink deeplink）
    const linkMatch = block.match(/<(superlink:[^>]+)>/);
    let bookUrl = '';
    if (linkMatch) {
      // 解码 URL 编码的链接
      try {
        const decoded = decodeURIComponent(decodeURIComponent(linkMatch[1]));
        bookUrl = decoded;
      } catch (e) {
        bookUrl = linkMatch[1];
      }
    }
    
    // 判断是否为直飞
    const isDirect = !block.includes('转机') && !block.includes('中转');
    
    flights.push({
      airline: getAirlineName(primaryFlightNo),
      from: depStation,
      to: arrStation,
      price,
      cabin: '经济舱',
      time: depTime && arrTime ? `${depTime}-${arrTime}` : '',
      duration,
      flightNo: primaryFlightNo,
      flightNos,
      isDirect,
      route: `${depStation} → ${arrStation}`,
      bookUrl  // 携程 deeplink
    });
  }
  
  // 去重（同一价格同一航线的重复方案）
  const seen = new Set();
  const unique = flights.filter(f => {
    const key = `${f.price}-${f.from}-${f.to}-${f.flightNo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return unique;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.from || !args.to || !args.depart) {
    console.error(JSON.stringify({ error: '缺少必要参数: --from, --to, --depart' }));
    process.exit(1);
  }
  
  if (!TOKEN) {
    console.error(JSON.stringify({ error: '缺少 WENDAO_API_KEY 环境变量' }));
    process.exit(1);
  }
  
  const query = buildQuery(args);
  
  try {
    const output = execSync(`node "${WENDAO_SCRIPT}" "${query}"`, {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, WENDAO_API_KEY: TOKEN }
    });
    
    const flights = parseFlightsFromText(output, args);
    
    console.log(JSON.stringify({
      source: '携程',
      query: `${args.from} → ${args.to}`,
      depart: args.depart,
      return: args.return || null,
      flights
    }));
  } catch (err) {
    console.error(JSON.stringify({
      source: '携程',
      error: '查询失败',
      message: err.message,
      flights: []
    }));
    process.exit(1);
  }
}

main();
