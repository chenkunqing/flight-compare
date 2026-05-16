#!/usr/bin/env node
/**
 * flyai_query.js - 封装 flyai CLI 查询飞猪机票
 * 
 * 用法: node flyai_query.js --from "福州" --to "东京" --depart "2026-06-19" [--return "2026-06-21"]
 * 
 * 输出: JSON 格式的航班列表
 */

const { execSync } = require('child_process');
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
    }
  }
  return parsed;
}

// 城市名到 IATA 代码映射（部分常用城市）
const CITY_TO_IATA = {
  '福州': 'FOC', '福州长乐': 'FOC',
  '上海': 'SHA', '上海浦东': 'PVG', '上海虹桥': 'SHA',
  '北京': 'PEK', '北京大兴': 'PKX',
  '广州': 'CAN', '深圳': 'SZX', '成都': 'CTU', '重庆': 'CKG',
  '杭州': 'HGH', '南京': 'NKG', '武汉': 'WUH', '西安': 'XIY',
  '厦门': 'XMN', '长沙': 'CSX', '昆明': 'KMG', '郑州': 'CGO',
  '海口': 'HAK', '三亚': 'SYX', '大连': 'DLC', '青岛': 'TAO',
  '沈阳': 'SHE', '哈尔滨': 'HRB', '长春': 'CGQ', '济南': 'TNA',
  '乌鲁木齐': 'URC', '呼和浩特': 'HET', '兰州': 'LHW', '银川': 'INC',
  '西宁': 'XNN', '拉萨': 'LXA',
  '东京': 'NRT', '东京成田': 'NRT', '东京羽田': 'HND',
  '大阪': 'KIX', '名古屋': 'NGO', '札幌': 'CTS', '福冈': 'FUK',
  '首尔': 'ICN', '仁川': 'ICN', '釜山': 'PUS',
  '曼谷': 'BKK', '普吉': 'HKT', '清迈': 'CNX',
  '新加坡': 'SIN', '吉隆坡': 'KUL', '槟城': 'PEN',
  '河内': 'HAN', '胡志明': 'SGN', '岘港': 'DAD',
  '金边': 'PNH', '暹粒': 'REP', '仰光': 'RGN',
  '马尼拉': 'MNL', '雅加达': 'CGK', '巴厘岛': 'DPS',
  '香港': 'HKG', '澳门': 'MFM', '台北': 'TPE', '高雄': 'KHH',
  '悉尼': 'SYD', '墨尔本': 'MEL', '奥克兰': 'AKL',
  '伦敦': 'LHR', '巴黎': 'CDG', '法兰克福': 'FRA', '阿姆斯特丹': 'AMS',
  '纽约': 'JFK', '洛杉矶': 'LAX', '旧金山': 'SFO',
  '迪拜': 'DXB', '多哈': 'DOH', '伊斯坦布尔': 'IST',
  '莫斯科': 'SVO', '布达佩斯': 'BUD', '布拉格': 'PRG',
  '尼斯': 'NCE', '罗马': 'FCO', '米兰': 'MXP', '威尼斯': 'VCE',
  '巴塞罗那': 'BCN', '马德里': 'MAD', '里斯本': 'LIS',
  '开罗': 'CAI', '内罗毕': 'NBO', '毛里求斯': 'MRU',
  '南非': 'JNB', '约翰内斯堡': 'JNB', '开普敦': 'CPT',
  '坦桑尼亚': 'JRO', '乞力马扎罗': 'JRO', '达累斯萨拉姆': 'DAR',
  '肯尼亚': 'NBO',
  '巴西': 'GRU', '圣保罗': 'GRU', '里约热内卢': 'GIG',
  '瑞士': 'ZRH', '苏黎世': 'ZRH', '日内瓦': 'GVA',
  '冰岛': 'KEF', '雷克雅未克': 'KEF',
};

function cityToIata(city) {
  const clean = city.replace(/(市|机场|国际机场)$/g, '');
  return CITY_TO_IATA[clean] || CITY_TO_IATA[city] || city.toUpperCase();
}
// 统一别名
const cityToIATA = cityToIata;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.from || !args.to || !args.depart) {
    console.error(JSON.stringify({ error: '缺少必要参数: --from, --to, --depart' }));
    process.exit(1);
  }

  const origin = cityToIata(args.from);
  const destination = cityToIATA(args.to);
  
  // 构建 flyai 命令
  let cmd = `flyai search-flight --origin "${origin}" --destination "${destination}" --dep-date "${args.depart}"`;
  if (args.return) {
    cmd += ` --back-date "${args.return}"`;
  }
  cmd += ' 2>/dev/null';

  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    
    // 解析 flyai 输出
    const flights = parseFlyaiOutput(output, args);
    
    console.log(JSON.stringify({
      source: '飞猪',
      query: `${args.from} → ${args.to}`,
      depart: args.depart,
      return: args.return || null,
      flights: flights
    }));
  } catch (err) {
    console.error(JSON.stringify({ 
      source: '飞猪', 
      error: '查询失败', 
      message: err.message 
    }));
    process.exit(1);
  }
}



function parseFlyaiOutput(output, args) {
  const flights = [];
  const lines = output.split('\n');
  
  let currentFlight = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 匹配航班头部: 1. 🛫 国泰航空 | 福州长乐FOC → 东京成田NRT | 11:30-07:30(+1)
    const headerMatch = trimmed.match(/^\d+\.\s+🛫\s+(.+?)\s*\|\s*(.+?)\s*→\s*(.+?)\s*\|\s*(.+)$/);
    if (headerMatch) {
      if (currentFlight) flights.push(currentFlight);
      currentFlight = {
        airline: headerMatch[1].trim(),
        from: headerMatch[2].trim(),
        to: headerMatch[3].trim(),
        time: headerMatch[4].trim(),
        price: null,
        cabin: null,
        segments: []
      };
      continue;
    }
    
    // 匹配价格: 💰 经济舱 | 价格: ¥2,384 | 航司: 国泰航空 | ...
    const priceMatch = trimmed.match(/💰\s+(.+?)\s*\|\s*价格:\s*¥?([\d,]+)/);
    if (priceMatch && currentFlight) {
      currentFlight.cabin = priceMatch[1].trim();
      currentFlight.price = parseInt(priceMatch[2].replace(/,/g, ''));
      continue;
    }
    
    // 匹配航段: ✈️ 福州长乐FOC(11:30) → 香港HKG(14:00) | 国泰航空 CX991
    const segMatch = trimmed.match(/✈️\s+(.+?)\s*→\s+(.+?)\s*\|\s*(.+?)\s+([A-Z]{2}\d+)/);
    if (segMatch && currentFlight) {
      currentFlight.segments.push({
        from: segMatch[1].trim(),
        to: segMatch[2].trim(),
        airline: segMatch[3].trim(),
        flightNo: segMatch[4].trim()
      });
    }
  }
  
  // 添加最后一个航班
  if (currentFlight) flights.push(currentFlight);
  
  return flights.filter(f => f.price !== null);
}

main();
