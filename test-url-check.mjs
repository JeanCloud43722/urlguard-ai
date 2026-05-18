#!/usr/bin/env node

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/trpc/urlChecker.checkURL';
const TEST_URL = 'https://google.com';

console.log('🧪 Testing URL Check API...\n');
console.log(`API URL: ${API_URL}`);
console.log(`Test URL: ${TEST_URL}\n`);

try {
  console.log('📤 Sending request...');
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      json: { url: TEST_URL }
    })
  });

  console.log(`✅ Response Status: ${response.status} ${response.statusText}\n`);

  const contentType = response.headers.get('content-type');
  console.log(`Content-Type: ${contentType}`);

  const text = await response.text();
  console.log(`\n📥 Response Body (first 500 chars):\n`);
  console.log(text.substring(0, 500));

  if (text.length > 500) {
    console.log(`\n... (${text.length - 500} more characters)`);
  }

  try {
    const json = JSON.parse(text);
    console.log(`\n✅ Valid JSON response`);
    console.log(`\nParsed response:`, JSON.stringify(json, null, 2).substring(0, 1000));
  } catch (e) {
    console.log(`\n❌ Invalid JSON response`);
  }
} catch (error) {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
}
