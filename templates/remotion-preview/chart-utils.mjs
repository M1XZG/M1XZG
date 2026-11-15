const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sum = (items) => items.reduce((total, item) => total + item.count, 0);
const ranked = (counts) => [...counts.entries()]
  .map(([name, count]) => ({name, count}))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

export const repoLanguages = (repos) => {
  const counts = new Map();
  for (const repo of repos) {
    if (repo.private !== false || repo.fork || !repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return ranked(counts);
};

export const commitLanguages = (nodes) => {
  const counts = new Map();
  for (const node of nodes) {
    const name = node.repository.primaryLanguage?.name;
    if (node.repository.isPrivate !== false || !name) continue;
    requireValue(Number.isInteger(node.contributions.totalCount) && node.contributions.totalCount >= 0, 'Invalid commit count');
    counts.set(name, (counts.get(name) ?? 0) + node.contributions.totalCount);
  }
  return ranked(counts);
};

export const hourlyCommits = (repositories) => {
  const hours = Array(24).fill(0);
  for (const {repository} of repositories) {
    if (repository.isPrivate !== false) continue;
    for (const node of repository.defaultBranchRef?.target?.history?.nodes ?? []) {
      const date = new Date(node.authoredDate);
      requireValue(Number.isFinite(date.getTime()), 'Invalid authored date');
      hours[date.getUTCHours()] += 1;
    }
  }
  return hours;
};

export const weeklyContributions = (weeks) => weeks.map(({contributionDays}) => {
  requireValue(contributionDays.length > 0 && contributionDays.length <= 7, 'Invalid contribution week');
  for (const day of contributionDays) {
    requireValue(/^\d{4}-\d{2}-\d{2}$/.test(day.date), 'Invalid contribution date');
    requireValue(Number.isInteger(day.contributionCount) && day.contributionCount >= 0, 'Invalid contribution count');
  }
  return {
    date: contributionDays[0].date,
    count: contributionDays.reduce((total, day) => total + day.contributionCount, 0),
  };
});

export const topLanguages = (items, limit = 5) => {
  const top = items.slice(0, limit);
  const other = sum(items.slice(limit));
  return other > 0 ? [...top, {name: 'Other', count: other}] : top;
};
