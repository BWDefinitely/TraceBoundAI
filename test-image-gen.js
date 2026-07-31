/**
 * 生图模型测试脚本
 * 用法: node test-image-gen.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  provider: 'custom', // 'dall-e-3' | 'custom'
  apiKey: 'YOUR_API_KEY_HERE',
  baseUrl: 'YOUR_BASE_URL_HERE', // 例如: https://api.example.com
  model: 'gemini-2.0-flash-lite-image',
  prompt: '一个温暖的儿童绘本插画，阳光下的小花园',
};

async function testDallE3() {
  console.log('🎨 测试 DALL-E 3 生图...');
  const url = `${CONFIG.baseUrl}/images/generations`;
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      prompt: CONFIG.prompt,
      n: 1,
      size: '1024x1024',
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const json = await resp.json();
  const imageUrl = json.data?.[0]?.url;
  if (!imageUrl) throw new Error('未返回图片 URL');

  console.log('✅ DALL-E 3 返回图片 URL:', imageUrl);

  // 下载图片
  const imgResp = await fetch(imageUrl);
  const buffer = Buffer.from(await imgResp.arrayBuffer());
  const filename = `test-dalle-${Date.now()}.png`;
  fs.writeFileSync(filename, buffer);
  console.log(`💾 图片已保存: ${filename}`);
}

async function testCustom() {
  console.log('🎨 测试自定义生图 API...');
  const url = `${CONFIG.baseUrl}/generate`;
  
  const body = {
    prompt: CONFIG.prompt,
    model: CONFIG.model,
    size: '1:1',
  };
  if (CONFIG.apiKey) body.api_key = CONFIG.apiKey;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }

  const contentType = resp.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    // 返回 JSON（可能包含 image_url 或 base64）
    const json = await resp.json();
    console.log('📦 返回 JSON:', json);
    
    if (json.image_url) {
      const imgResp = await fetch(json.image_url);
      const buffer = Buffer.from(await imgResp.arrayBuffer());
      const filename = `test-custom-${Date.now()}.png`;
      fs.writeFileSync(filename, buffer);
      console.log(`💾 图片已保存: ${filename}`);
    } else if (json.image_base64) {
      const buffer = Buffer.from(json.image_base64, 'base64');
      const filename = `test-custom-${Date.now()}.png`;
      fs.writeFileSync(filename, buffer);
      console.log(`💾 图片已保存: ${filename}`);
    } else {
      console.log('⚠️  JSON 中未找到 image_url 或 image_base64');
    }
  } else if (contentType?.startsWith('image/')) {
    // 直接返回图片二进制
    const buffer = Buffer.from(await resp.arrayBuffer());
    const filename = `test-custom-${Date.now()}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`💾 图片已保存: ${filename}`);
  } else {
    throw new Error(`未知 Content-Type: ${contentType}`);
  }
}

async function main() {
  console.log('🚀 生图模型测试\n');
  console.log('配置:');
  console.log(`  Provider: ${CONFIG.provider}`);
  console.log(`  Model: ${CONFIG.model}`);
  console.log(`  Base URL: ${CONFIG.baseUrl}`);
  console.log(`  API Key: ${CONFIG.apiKey.slice(0, 10)}...`);
  console.log(`  Prompt: ${CONFIG.prompt}\n`);

  try {
    if (CONFIG.provider === 'dall-e-3') {
      await testDallE3();
    } else {
      await testCustom();
    }
    console.log('\n✅ 测试成功！');
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    process.exit(1);
  }
}

main();
