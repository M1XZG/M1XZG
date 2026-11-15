import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const textNodes = (svg) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)]
  .map((match) => match[1]);
const required = (value, label) => {
  assert.ok(value, `Missing ${label}; the source format may have changed.`);
  return value;
};
const statsText = textNodes(read('profile-summary-card-output/aura/3-stats.svg'));
const detailsText = textNodes(read('profile-summary-card-output/aura/0-profile-details.svg'));
const labels = ['Total Stars:', 'Total Commits:', 'Total PRs:', 'Total Issues:', 'Contributed to:'];
const labelIndex = statsText.indexOf(labels[0]);
assert.deepEqual(statsText.slice(labelIndex, labelIndex + labels.length), labels);
const values = statsText.slice(labelIndex + labels.length, labelIndex + 2 * labels.length);
assert.equal(values.length, labels.length);
assert.ok(values.every((value) => /^\d[\d,.]*k?$/i.test(value)));
const readme = read('README.md');
const mainHours = required(readme.match(
  /<!-- start myhoursHERE -->\s*As of <strong>([^<]+)<\/strong> - ([\d,.]+)/,
), 'VRChat hours');
const contributions = required(detailsText.find((text) =>
  /^[\d,.]+k? Contributions on GitHub$/i.test(text)), 'contribution total').split(' ')[0];
const snapshot = {
  capturedAt: new Date().toISOString(),
  source: 'Committed public profile SVGs and README.md; figures retain their original rounding.',
  contributions,
  stars: values[0],
  commits: values[1],
  pullRequests: values[2],
  issues: values[3],
  contributedTo: values[4],
  vrchatHours: Number(mainHours[2].replaceAll(',', '')),
  vrchatReportedAt: mainHours[1],
  vrchatMilestone: 20000,
};
assert.ok(Number.isFinite(snapshot.vrchatHours) && snapshot.vrchatHours >= 0);
writeFileSync(`${here}snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`);

const remaining = Math.max(0, snapshot.vrchatMilestone - snapshot.vrchatHours)
  .toLocaleString('en-GB', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const progress = Math.min(100, snapshot.vrchatHours / snapshot.vrchatMilestone * 100).toFixed(2);
const overview = `
<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="./remotion-preview/overview.png" />
    <img src="./remotion-preview/overview.gif" width="100%" alt="GitHub snapshot: ${snapshot.contributions} contributions, ${snapshot.commits} commits, ${snapshot.pullRequests} pull requests and ${snapshot.stars} stars. VRChat: ${mainHours[2]} hours, ${progress}% of 20,000." />
  </picture>
</p>

<p align="center"><sub>One short animation, then a still frame. <a href="./remotion-preview/overview.png">View the still image</a>.</sub></p>

<details>
<summary>Preview figures and build notes</summary>

This is a fixed design snapshot captured on ${snapshot.capturedAt.slice(0, 10)}, not a new live stats service. GitHub totals come from the existing Aura cards and keep their original rounding. The detailed cards below are unchanged.

| Metric | Snapshot |
| --- | ---: |
| Contributions in the last year | ${snapshot.contributions} |
| Total commits | ${snapshot.commits} |
| Total pull requests | ${snapshot.pullRequests} |
| Total stars | ${snapshot.stars} |
| Total issues | ${snapshot.issues} |
| Repositories contributed to | ${snapshot.contributedTo} |
| VRChat lifetime hours | ${mainHours[2]} |
| Hours to 20,000 | ${remaining} |

VRChat was reported at ${snapshot.vrchatReportedAt}. Steam API readings can trail the client by one or two hours.

The [Remotion source](./remotion-preview/src/Root.jsx) and [input snapshot](./remotion-preview/snapshot.json) are kept alongside the rendered images. To rebuild from this checkout, run these commands from the templates/remotion-preview folder:

\`\`\`bash
npm ci
npm run snapshot
npm run render:gif
npm run render:still
\`\`\`

Rebuilding only writes the preview files. No live README, production template or workflow is changed.

</details>
`;
const heading = '## 📊 Stats\n';
assert.equal(readme.split(heading).length, 2, 'Expected exactly one Stats heading');
const preview = '> **Design preview:** the Remotion overview below is a fixed snapshot. The live profile and its update workflows are unchanged.\n\n'
  + readme.replaceAll('src="/assets/', 'src="../assets/')
    .replace(heading, `${heading}\n${overview}`);
for (const name of ['test-readme.me', 'test-readme.md']) {
  writeFileSync(new URL(`../${name}`, import.meta.url), preview);
}
console.log(`Built preview README files and input snapshot in ${here}`);
