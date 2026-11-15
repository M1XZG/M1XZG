import assert from 'node:assert/strict';
import {test} from 'node:test';
import {commitLanguages, hourlyCommits, repoLanguages, topLanguages, weeklyContributions} from './chart-utils.mjs';

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
