#!/usr/bin/env node
/**
 * flyai_query.js - 封装 flyai CLI 查询飞猪机票（直接解析 JSON 输出）
 * 
 * 用法: node flyai_query.js --from "福州" --to "东京" --depart "2026-06-19" [--return "2026-06-21"]
 * 
 * 输出: JSON 格式的航班列表
 */

const { execSync } = require('child_process');

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.from || !args.to || !args.depart) {
    console.error(JSON.stringify({ error: '缺少必要参数: --from, --to, --depart' }));
    process.exit(1);
  }
  
  // 构建 flyai 命令
  let cmd = `flyai search-flight --origin "${args.from}" --destination "${args.to}" --dep-date "${args.depart}"`;
  if (args.return) {
    cmd += ` --back-date "${args.return}"`;
  }
  cmd += ' 2>/dev/null';

  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    const response = JSON.parse(output);
    
    if (response.status !== 0 || !response.data || !response.data.itemList) {
      console.error(JSON.stringify({ source: '飞猪', error: '查询返回异常', flights: [] }));
      process.exit(1);
    }
    
    // 解析航班列表
    const flights = response.data.itemList.map(item => {
      const outbound = item.journeys[0];
      const firstSegment = outbound.segments[0];
      const lastSegment = outbound.segments[outbound.segments.length - 1];
      
      // 构建航段信息
      const segments = outbound.segments.map(seg => ({
        from: `${seg.depCityName}${seg.depStationShortName || ''}`,
        to: `${seg.arrCityName}${seg.arrStationShortName || ''}`,
        airline: getAirlineName(seg.marketingTransportNo),
        flightNo: seg.marketingTransportNo
      }));
      
      // 航线描述
      const route = segments.length > 1 
        ? `${segments[0].from} → ${segments[segments.length-1].to} (${segments.length-1}次中转)`
        : `${segments[0].from} → ${segments[0].to} (直飞)`;
      
      return {
        airline: getAirlineName(firstSegment.marketingTransportNo),
        from: args.from,
        to: args.to,
        price: parseInt(parseFloat(item.ticketPrice)),
        cabin: firstSegment.seatClassName || '经济舱',
        time: `${firstSegment.depDateTime.split(' ')[1]} - ${lastSegment.arrDateTime.split(' ')[1]}`,
        route,
        duration: outbound.totalDuration ? `${Math.floor(outbound.totalDuration / 60)}h${outbound.totalDuration % 60}m` : '',
        segments,
        journeyType: outbound.journeyType,
        jumpUrl: item.jumpUrl || ''
      };
    });
    
    // 按价格排序
    flights.sort((a, b) => a.price - b.price);
    
    console.log(JSON.stringify({
      source: '飞猪',
      query: `${args.from} → ${args.to}`,
      depart: args.depart,
      return: args.return || null,
      flights
    }));
  } catch (err) {
    console.error(JSON.stringify({ 
      source: '飞猪', 
      error: '查询失败', 
      message: err.message,
      flights: []
    }));
    process.exit(1);
  }
}

main();
