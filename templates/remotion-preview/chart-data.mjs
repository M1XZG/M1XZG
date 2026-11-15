import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {repoLanguages, commitLanguages, hourlyCommits, weeklyContributions, lifetimeContributions} from './chart-utils.mjs';

const sum = (items) => items.reduce((total, item) => total + item.count, 0);

const gh = (args) => JSON.parse(execFileSync('gh', ['api', ...args], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}));
const graphql = (query, variables = {}) => {
  const response = gh([
    'graphql', '-f', `query=${query}`,
    ...Object.entries(variables).flatMap(([key, value]) => ['-f', `${key}=${value}`]),
  ]);
  assert.ok(!response.errors, JSON.stringify(response.errors));
  assert.ok(response.data?.user, 'Missing GitHub user');
  return response.data.user;
};

const collectLifetime = (years) => {
  const calendars = years.map((year) => {
    console.log(`Collecting lifetime contributions for ${year}`);
    const user = graphql(`query($from: DateTime!, $to: DateTime!) {
      user(login: "M1XZG") {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }`, {
      from: `${year}-01-01T00:00:00Z`,
      to: `${year}-12-31T23:59:59Z`,
    });
    return {year, calendar: user.contributionsCollection.contributionCalendar};
  });
  return {...lifetimeContributions(calendars), capturedAt: new Date().toISOString()};
};

const collect = () => {
  const capturedAt = new Date();
  const profile = graphql(`query {
    user(login: "M1XZG") {
      id
      contributionsCollection {
        contributionYears
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`);
  const repos = [];
  for (let page = 1; ; page += 1) {
    const items = gh([`users/M1XZG/repos?type=owner&per_page=100&page=${page}`]);
    assert.ok(Array.isArray(items), 'Expected a repository page');
    repos.push(...items);
    if (items.length < 100) break;
  }
  const years = [...profile.contributionsCollection.contributionYears].sort((a, b) => a - b);
  const commits = [];
  for (const year of years) {
    console.log(`Collecting public commit-language totals for ${year}`);
    const user = graphql(`query($from: DateTime!, $to: DateTime!) {
      user(login: "M1XZG") {
        contributionsCollection(from: $from, to: $to) {
          commitContributionsByRepository(maxRepositories: 100) {
            repository { isPrivate primaryLanguage { name } }
            contributions { totalCount }
          }
        }
      }
    }`, {
      from: `${year}-01-01T00:00:00Z`,
      to: `${year}-12-31T23:59:59Z`,
    });
    commits.push(...user.contributionsCollection.commitContributionsByRepository);
  }
  const until = capturedAt.toISOString();
  const since = new Date(capturedAt.getTime() - 90 * 86400000).toISOString();
  const activity = graphql(`query(
    $from: DateTime!, $to: DateTime!, $since: GitTimestamp!, $until: GitTimestamp!, $author: ID!
  ) {
    user(login: "M1XZG") {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 50) {
          repository {
            isPrivate
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 50, since: $since, until: $until, author: {id: $author}) {
                    nodes { authoredDate }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`, {from: since, to: until, since, until, author: profile.id});
  const calendar = profile.contributionsCollection.contributionCalendar;
  const weeks = weeklyContributions(calendar.weeks);
  const data = {
    capturedAt: capturedAt.toISOString(),
    source: 'GitHub GraphQL contribution calendar and contributionsCollection; public REST repositories.',
    scope: 'Calendar totals follow GitHub profile visibility. Repository and commit-language/hourly aggregates exclude private repositories. No repository names or individual commits are stored.',
    contributions: {
      total: sum(weeks),
      reportedTotal: calendar.totalContributions,
      weeks,
      lifetime: collectLifetime(years),
    },
    repositories: repoLanguages(repos),
    commits: {
      years,
      languages: commitLanguages(commits),
      maxRepositoriesPerYear: 100,
    },
    productiveTime: {
      since,
      until,
      timeZone: 'UTC',
      maxRepositories: 50,
      maxCommitsPerRepository: 50,
      hours: hourlyCommits(activity.contributionsCollection.commitContributionsByRepository),
    },
  };
  writeFileSync(new URL('./chart-data.json', import.meta.url), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Saved chart-data.json: ${weeks.length} weeks, ${data.repositories.length} repository languages, ${data.commits.languages.length} commit languages.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--lifetime-only')) {
    const path = new URL('./chart-data.json', import.meta.url);
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const profile = graphql(`query {
      user(login: "M1XZG") { contributionsCollection { contributionYears } }
    }`);
    data.contributions.lifetime = collectLifetime(profile.contributionsCollection.contributionYears);
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  } else {
    collect();
  }
}
