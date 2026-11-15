import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {commitLanguages, hourlyCommits, repoLanguages, topLanguages, weeklyContributions, lifetimeContributions} from './chart-utils.mjs';

test('repository counts exclude forks, private repos and missing languages', () => {
  assert.deepEqual(repoLanguages([
    {private: false, fork: false, language: 'Python'},
    {private: false, fork: false, language: 'Python'},
    {private: false, fork: false, language: 'Shell'},
    {private: false, fork: true, language: 'Python'},
    {private: true, fork: false, language: 'Python'},
    {private: false, fork: false, language: null},
  ]), [{name: 'Python', count: 2}, {name: 'Shell', count: 1}]);
});

test('commit-language counts aggregate years and omit private or unclassified contributions', () => {
  const node = (name, count, isPrivate = false) => ({
    repository: {isPrivate, primaryLanguage: name ? {name} : null},
    contributions: {totalCount: count},
  });
  assert.deepEqual(commitLanguages([
    node('Python', 10), node('Python', 7), node('Shell', 2),
    node('Python', 100, true), node(null, 50),
  ]), [{name: 'Python', count: 17}, {name: 'Shell', count: 2}]);
});

test('Other keeps every language in the percentage denominator', () => {
  const languages = [{name: 'Python', count: 8}, {name: 'Shell', count: 3}, {name: 'HTML', count: 1}];
  assert.deepEqual(topLanguages(languages, 1), [{name: 'Python', count: 8}, {name: 'Other', count: 4}]);
  assert.deepEqual(topLanguages([], 5), []);
});

test('weekly totals retain partial edge weeks without inventing contributions', () => {
  assert.deepEqual(weeklyContributions([
    {contributionDays: [{date: '2026-11-07', contributionCount: 2}]},
    {contributionDays: [
      {date: '2026-11-08', contributionCount: 4},
      {date: '2026-11-09', contributionCount: 3},
    ]},
  ]), [{date: '2026-11-07', count: 2}, {date: '2026-11-08', count: 7}]);
  assert.throws(() => weeklyContributions([{contributionDays: []}]));
});

test('hourly samples use authored UTC hour and skip inaccessible or private histories', () => {
  const repo = (dates, isPrivate = false) => ({
    repository: {
      isPrivate,
      defaultBranchRef: {target: {history: {nodes: dates.map((authoredDate) => ({authoredDate}))}}},
    },
  });
  const hours = hourlyCommits([
    repo(['2026-11-14T23:59:00Z', '2026-11-15T00:01:00Z', '2026-11-15T02:00:00+02:00']),
    repo(['2026-11-15T06:00:00Z'], true),
    {repository: {isPrivate: false, defaultBranchRef: null}},
  ]);
  assert.equal(hours.length, 24);
  assert.equal(hours[0], 2);
  assert.equal(hours[23], 1);
  assert.equal(hours.reduce((total, value) => total + value, 0), 3);
});

test('lifetime sums all years without double-counting adjacent-year calendar padding', () => {
  const calendar = (totalContributions, days) => ({
    totalContributions,
    weeks: [{contributionDays: days.map(([date, contributionCount]) => ({date, contributionCount}))}],
  });
  const years = [
    {year: 2026, calendar: calendar(15, [['2025-12-31', 4], ['2026-01-01', 10]])},
    {year: 2025, calendar: calendar(7, [['2025-12-31', 4], ['2026-01-01', 10]])},
  ];
  assert.deepEqual(lifetimeContributions(years), {
    total: 14,
    reportedTotal: 22,
    years: [
      {year: 2025, count: 4, reportedCount: 7},
      {year: 2026, count: 10, reportedCount: 15},
    ],
  });
  assert.throws(() => lifetimeContributions([years[0], years[0]]));
  assert.throws(() => lifetimeContributions([]));
});

test('preview image URLs change with render inputs, including layout-only edits', () => {
  const root = new URL('../../', import.meta.url);
  const tmp = fileURLToPath(new URL('tmp/', root));
  mkdirSync(tmp, {recursive: true});
  const fixture = mkdtempSync(join(tmp, 'preview-cache-test-'));
  try {
    for (const path of [
      'README.md',
      'profile-summary-card-output/aura/3-stats.svg',
      ...['build-preview.mjs', 'chart-data.json', 'src/Root.jsx', 'src/Charts.jsx', 'chart-utils.mjs', 'package-lock.json']
        .map((path) => `templates/remotion-preview/${path}`),
    ]) {
      const target = join(fixture, path);
      mkdirSync(dirname(target), {recursive: true});
      copyFileSync(new URL(path, root), target);
    }
    const render = () => {
      execFileSync(process.execPath, ['build-preview.mjs'], {
        cwd: join(fixture, 'templates/remotion-preview'),
        stdio: 'pipe',
      });
      const markdown = readFileSync(join(fixture, 'templates/test-readme.md'), 'utf8');
      const versions = [...markdown.matchAll(
        /\.\/remotion-preview\/(?:overview\.(?:gif|png)|charts\.png)(\?v=[a-f0-9]{16})/g,
      )].map((match) => match[1]);
      assert.equal(versions.length, 4);
      assert.equal(new Set(versions).size, 1);
      assert.equal(markdown, readFileSync(join(fixture, 'templates/test-readme.me'), 'utf8'));
      return versions[0];
    };
    const initial = render();
    assert.equal(render(), initial);
    appendFileSync(join(fixture, 'templates/remotion-preview/src/Root.jsx'), '\n// Layout change\n');
    const layoutVersion = render();
    assert.notEqual(layoutVersion, initial);
    const path = join(fixture, 'templates/remotion-preview/chart-data.json');
    const data = JSON.parse(readFileSync(path, 'utf8'));
    data.contributions.total += 1;
    writeFileSync(path, JSON.stringify(data));
    assert.notEqual(render(), layoutVersion);
  } finally {
    rmSync(fixture, {recursive: true});
  }
});
