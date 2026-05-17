// 解析 vitest 產生的 JUnit XML，輸出 Markdown 測試摘要。
// 在 GitHub Actions 中會把摘要寫入 $GITHUB_STEP_SUMMARY，
// 讓測試結果直接顯示在 Actions 結果頁面（不依賴任何第三方 action）。
import { readFileSync, appendFileSync } from 'node:fs';

const reportPath = process.argv[2] ?? 'reports/vitest-junit.xml';

let xml;
try {
  xml = readFileSync(reportPath, 'utf8');
} catch {
  console.error(`找不到 JUnit 報告：${reportPath}`);
  process.exit(0);
}

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const suiteTag = xml.match(/<testsuites[^>]*>/)?.[0] ?? '';
const num = (attr) => Number(suiteTag.match(new RegExp(`${attr}="([^"]*)"`))?.[1] ?? 0);

const total = num('tests');
const failures = num('failures');
const errors = num('errors');
const time = num('time');

const cases = [
  ...xml.matchAll(/<testcase\b([^>]*?)\/>|<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g)
].map((m) => {
  const attrs = m[1] ?? m[2] ?? '';
  const body = m[3] ?? '';
  // \s 前綴避免誤匹配到 classname="..." 裡的 name=
  const name = decode(attrs.match(/\sname="([^"]*)"/)?.[1] ?? '(unknown)');
  const file = decode(attrs.match(/classname="([^"]*)"/)?.[1] ?? '');
  return {
    name,
    file,
    failed: /<failure\b|<error\b/.test(body),
    skipped: /<skipped\b/.test(body)
  };
});

const skipped = cases.filter((c) => c.skipped).length;
const passed = total - failures - errors - skipped;
const overall = failures + errors > 0 ? 'FAILED' : 'PASSED';

const lines = [
  `## Vitest 測試結果：${overall}`,
  '',
  '| Total | Passed | Failed | Errors | Skipped | Duration |',
  '| ----- | ------ | ------ | ------ | ------- | -------- |',
  `| ${total} | ${passed} | ${failures} | ${errors} | ${skipped} | ${time.toFixed(3)}s |`,
  '',
  '| 結果 | 測試名稱 | 檔案 |',
  '| ---- | -------- | ---- |',
  ...cases.map((c) => {
    const status = c.failed ? 'FAIL' : c.skipped ? 'SKIP' : 'PASS';
    return `| ${status} | ${c.name} | ${c.file} |`;
  }),
  ''
];

const summary = lines.join('\n');
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}
