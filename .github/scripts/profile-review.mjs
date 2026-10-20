import { chromium } from 'playwright';
import fs from 'node:fs/promises';

await fs.mkdir('assets/previews', { recursive: true });
await fs.mkdir('review', { recursive: true });
const browser = await chromium.launch();
const report = { dashboards: [], profile: [] };
let readme = await fs.readFile('README.md', 'utf8');

for (const item of [
  { id: 'dataco', name: 'DataCo dashboard', url: 'https://moulayid.github.io/DataCo-Global-Supply-Chain-Analytics/', expected: /revenue|supply|profit|sales/i },
  { id: 'realmadrid', name: 'Real Madrid dashboard', url: 'https://moulayid.github.io/real-madrid-analytics/', expected: /madrid|revenue|financial/i },
]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  try {
    const response = await page.goto(item.url, { waitUntil: 'networkidle', timeout: 60000 });
    if (!response?.ok()) throw new Error('HTTP ' + response?.status());
    await page.locator('body').waitFor();
    await page.waitForFunction(() => document.body.innerText.trim().length > 180, { timeout: 20000 });
    const text = await page.locator('body').innerText();
    if (!item.expected.test(text)) throw new Error('Expected dashboard content missing');
    const chartCount = await page.locator('svg, canvas').count();
    if (chartCount < 1) throw new Error('No chart or graphic rendered');
    await page.evaluate(() => document.fonts.ready);
    const filename = 'assets/previews/' + item.id + '.png';
    await page.screenshot({ path: filename, fullPage: false, animations: 'disabled' });
    const marker = '<!-- preview:' + item.id + ' -->';
    const preview = marker + '\n\n<a href="' + item.url + '"><img src="./' + filename + '" alt="Actual browser capture of the ' + item.name + '" width="100%" /></a>\n\n<sub>Actual dashboard capture · <a href="' + item.url + '">Open interactive view ↗</a></sub>';
    if (!readme.includes('./' + filename)) readme = readme.replace(marker, preview);
    report.dashboards.push({ id: item.id, status: 'captured', url: item.url, chartCount });
  } catch (error) {
    report.dashboards.push({ id: item.id, status: 'unavailable', reason: String(error) });
  } finally { await page.close(); }
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  try {
    const response = await page.goto('https://github.com/MOULAYID', { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response?.ok()) throw new Error('Profile HTTP ' + response?.status());
    const heading = page.getByRole('heading', { name: 'Featured projects', exact: true });
    await heading.waitFor({ timeout: 30000 });
    await page.waitForFunction(() => Array.from(document.images).every(img => img.complete), { timeout: 30000 }).catch(() => {});
    const article = page.locator('article').filter({ has: heading }).first();
    const imageInfo = await article.locator('img').evaluateAll(images => images.map(i => ({ alt: i.alt, loaded: i.complete && i.naturalWidth > 0 })));
    const layout = await article.evaluate(el => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
    await page.screenshot({ path: 'review/profile-' + viewport.width + '.png', fullPage: true, animations: 'disabled' });
    report.profile.push({ viewport, status: 'checked', images: imageInfo, layout });
  } catch (error) {
    report.profile.push({ viewport, status: 'unavailable', reason: String(error) });
  } finally { await page.close(); }
}
await browser.close();
await fs.writeFile('README.md', readme);
await fs.writeFile('review/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
