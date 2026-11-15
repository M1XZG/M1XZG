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
const charts = JSON.parse(readFileSync(new URL('./chart-data.json', import.meta.url), 'utf8'));
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
assert.ok(Number.isInteger(charts.contributions.total) && charts.contributions.total >= 0);
assert.ok(Number.isInteger(charts.contributions.lifetime.total) && charts.contributions.lifetime.total >= 0);
const snapshot = {
  capturedAt: charts.capturedAt,
  source: 'Contributions use the structured calendar daily-count sum. Other headline GitHub totals retain the committed Aura card rounding. VRChat hours come from README.md.',
  contributions: charts.contributions.total.toLocaleString('en-GB'),
  lifetimeContributions: charts.contributions.lifetime.total.toLocaleString('en-GB'),
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
const languageTable = (items) => {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return '| Language | Count | Share |\n| --- | ---: | ---: |\n' + items.map(({name, count}) =>
    `| ${name} | ${count.toLocaleString('en-GB')} | ${(count / total * 100).toFixed(1)}% |`).join('\n');
};
const overview = `
<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="./remotion-preview/overview.png" />
    <img src="./remotion-preview/overview.gif" width="100%" alt="GitHub snapshot: ${snapshot.lifetimeContributions} lifetime contributions, ${snapshot.contributions} contributions in the last year, ${snapshot.commits} commits, ${snapshot.pullRequests} pull requests, ${snapshot.stars} stars, ${snapshot.issues} issues and ${snapshot.contributedTo} repositories contributed to. VRChat: ${mainHours[2]} hours, ${progress}% of 20,000." />
  </picture>
</p>

<p align="center"><sub>One short animation, then a still frame. <a href="./remotion-preview/overview.png">View the still image</a>.</sub></p>

<p align="center">
  <img src="./remotion-preview/charts.png" width="100%" alt="Matching contribution history, repository-language bars, commit-language bars and sampled UTC commit activity. Figures and scope are available in the preview notes below." />
</p>

<details>
<summary>Preview figures and build notes</summary>

This is a fixed design snapshot captured on ${snapshot.capturedAt.slice(0, 10)}, not a new live stats service. The new detailed charts use [structured GitHub data](./remotion-preview/chart-data.json), not estimates from the old chart images. Both contribution totals use calendar data; the other GitHub headline totals still come from the existing Aura cards and keep their original rounding.

Contributions / Year means the trailing year, not the current calendar year. That card and the contribution chart use the sum of the calendar's dated entries (${charts.contributions.total.toLocaleString('en-GB')}). GitHub returned ${charts.contributions.reportedTotal.toLocaleString('en-GB')} separately as its calendar summary; both values are preserved in the data file rather than forcing them to agree.

Contributions / Lifetime sums dated entries across every GitHub contribution year, ${charts.contributions.lifetime.years[0].year}-${charts.contributions.lifetime.years.at(-1).year}, without counting adjacent-year calendar padding twice. The lifetime snapshot was captured at ${charts.contributions.lifetime.capturedAt}. Its ${snapshot.lifetimeContributions} dated contributions and GitHub's separate ${charts.contributions.lifetime.reportedTotal.toLocaleString('en-GB')} summary total are both retained in the data file.

Repository-language bars count owned public repositories, excluding forks and missing primary languages. Commit-language bars count public contributions across ${charts.commits.years[0]}-${charts.commits.years.at(-1)}, grouped by the repository's primary language, with a GitHub limit of 100 repositories per year. They do not measure lines of code. The top five languages plus Other retain the full percentage denominator.

Hourly activity is a sample from the last 90 days: up to 50 authored commits on each default branch, across up to 50 contributing repositories, excluding private repositories. It is not a complete productivity record. Hours use UTC, matching the existing profile workflow.

| Metric | Snapshot |
| --- | ---: |
| Contributions over lifetime | ${snapshot.lifetimeContributions} |
| Contributions in the last year | ${snapshot.contributions} |
| Total commits | ${snapshot.commits} |
| Total pull requests | ${snapshot.pullRequests} |
| Total stars | ${snapshot.stars} |
| Total issues | ${snapshot.issues} |
| Repositories contributed to | ${snapshot.contributedTo} |
| VRChat lifetime hours | ${mainHours[2]} |
| Hours to 20,000 | ${remaining} |

**Repositories by primary language**

${languageTable(charts.repositories)}

**Public commit contributions by repository language**

${languageTable(charts.commits.languages)}

**Sampled commits by UTC hour**

| Hour | Commits |
| --- | ---: |
${charts.productiveTime.hours.map((count, hour) => `| ${String(hour).padStart(2, '0')}:00 | ${count} |`).join('\n')}

VRChat was reported at ${snapshot.vrchatReportedAt}. Steam API readings can trail the client by one or two hours.

The [Remotion source](./remotion-preview/src/Root.jsx) and [input snapshot](./remotion-preview/snapshot.json) are kept alongside the rendered images. To rebuild from this checkout, run these commands from the templates/remotion-preview folder:

\`\`\`bash
npm ci
npm run snapshot
npm run render:gif
npm run render:still
npm run render:charts
\`\`\`

Those commands reuse the committed structured chart snapshot. To collect fresh aggregate chart data first, use an authenticated GitHub CLI:

\`\`\`bash
npm run collect:charts
\`\`\`

Then rerun the snapshot and render commands. The collector stores aggregate counts, not repository names or individual commits.

Rebuilding only writes the preview files. No live README, production template or workflow is changed.

</details>
`;
const heading = '## 📊 Stats\n';
assert.equal(readme.split(heading).length, 2, 'Expected exactly one Stats heading');
const start = readme.indexOf(heading);
const end = readme.indexOf('\n---', start);
assert.ok(end > start, 'Missing end of Stats section');
const legacy = readme.slice(start + heading.length, end);
const statsSection = `${heading}\n${overview}
<details>
<summary>Compare with the original profile charts</summary>

${legacy}

</details>
`;
const preview = '> **Design preview:** the Remotion dashboard below is a fixed snapshot. The live profile and its update workflows are unchanged.\n\n'
  + readme.replaceAll('src="/assets/', 'src="../assets/')
    .replace(readme.slice(start, end), statsSection);
for (const name of ['test-readme.me', 'test-readme.md']) {
  writeFileSync(new URL(`../${name}`, import.meta.url), preview);
}
console.log(`Built preview README files and input snapshot in ${here}`);
