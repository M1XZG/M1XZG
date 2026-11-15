import React from 'react';
import {AbsoluteFill} from 'remotion';
import data from '../chart-data.json';
import {topLanguages} from '../chart-utils.mjs';

const colors = ['#6be7ff', '#bc91ff', '#f3a5db', '#80dec0', '#f7cb8f', '#83839e'];
const text = '#f5f2ff';
const muted = '#aaa6c1';
const mono = {fontFamily: '"DejaVu Sans Mono", monospace'};
const number = (value) => value.toLocaleString('en-GB');
const dateLabel = (date, options = {day: 'numeric', month: 'short', year: 'numeric'}) =>
  new Date(date).toLocaleDateString('en-GB', {...options, timeZone: 'UTC'});
const total = (items) => items.reduce((sum, item) => sum + item.count, 0);

const Panel = ({children, style, neonBorders}) => (
  <div style={{
    borderRadius: 22,
    boxSizing: 'border-box',
    flexShrink: 0,
    border: neonBorders ? '3px solid transparent' : '1px solid #49405f',
    padding: neonBorders ? '23px 26px' : '25px 28px',
    background: neonBorders
      ? 'radial-gradient(ellipse at 100% 0%, #29203d, #151521 70%) padding-box, linear-gradient(120deg, #70e7ff, #7861ca 45%, #c08bff 75%, #70e7ff) border-box'
      : 'radial-gradient(ellipse at 100% 0%, #29203d, transparent 70%), #151521',
    overflow: 'hidden',
    ...style,
  }}>
    {children}
  </div>
);

const Heading = ({eyebrow, title, subtitle, aside}) => (
  <>
    <div style={{...mono, color: colors[0], fontSize: 11, letterSpacing: 1.8}}>{eyebrow}</div>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 7}}>
      <div style={{fontSize: 25, letterSpacing: -0.5, fontWeight: 700}}>{title}</div>
      {aside && <div style={{fontSize: 15, color: colors[1], fontWeight: 700}}>{aside}</div>}
    </div>
    <div style={{fontSize: 12, color: muted, marginTop: 7, lineHeight: 1.6}}>{subtitle}</div>
  </>
);

const ContributionHistory = ({neonBorders}) => {
  const weeks = data.contributions.weeks;
  const ceiling = Math.max(100, Math.ceil(Math.max(...weeks.map((week) => week.count), 1) / 500) * 500);
  const left = 62;
  const right = 1015;
  const top = 14;
  const bottom = 164;
  const x = (index) => left + index / Math.max(1, weeks.length - 1) * (right - left);
  const y = (value) => bottom - value / ceiling * (bottom - top);
  const line = weeks.map((week, index) => `${index ? 'L' : 'M'}${x(index)},${y(week.count)}`).join(' ');
  const area = `${line} L${right},${bottom} L${left},${bottom} Z`;
  const peak = weeks.reduce((best, week) => week.count > best.count ? week : best, weeks[0]);
  const ticks = [...new Set([0, ...weeks.map((_, i) => i).filter((i) => i % 9 === 0), weeks.length - 1])]
    .filter((i, index, list) => index === list.length - 1 || list[index + 1] - i >= 4);
  return (
    <Panel neonBorders={neonBorders} style={{height: 342}}>
      <Heading
        eyebrow="01 / CONTRIBUTION HISTORY"
        title="Contributions over time"
        subtitle={`${dateLabel(weeks[0].date)} to ${dateLabel(weeks.at(-1).date)} / weekly totals, partial edge weeks`}
        aside={`${number(data.contributions.total)} plotted contributions`}
      />
      <svg width="100%" height="205" viewBox="0 0 1042 205" style={{marginTop: 15}}>
        <defs>
          <linearGradient id="contribution-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[0]} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colors[1]} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="contribution-line">
            <stop offset="0%" stopColor={colors[1]} />
            <stop offset="100%" stopColor={colors[0]} />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((tick) => {
          const value = ceiling * tick / 3;
          return (
            <g key={tick}>
              <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#393246" strokeDasharray="3 6" />
              <text x={left - 15} y={y(value) + 4} textAnchor="end" fill={muted} fontSize="11">
                {number(Math.round(value))}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#contribution-fill)" />
        <path d={line} fill="none" stroke="url(#contribution-line)" strokeWidth="3" strokeLinejoin="round" />
        {ticks.map((index) => (
          <text key={index} x={x(index)} y="191" textAnchor={index === 0 ? 'start' : index === weeks.length - 1 ? 'end' : 'middle'} fill={muted} fontSize="11">
            {dateLabel(weeks[index].date, {month: 'short', year: '2-digit'})}
          </text>
        ))}
        <circle cx={x(weeks.indexOf(peak))} cy={y(peak.count)} r="4" fill={colors[0]} stroke="#151521" strokeWidth="2" />
      </svg>
    </Panel>
  );
};

const LanguageBars = ({items, eyebrow, title, subtitle, unit, footer, neonBorders}) => {
  const sum = total(items);
  const displayed = topLanguages(items);
  return (
    <Panel neonBorders={neonBorders} style={{width: 'calc(50% - 9px)', height: 470}}>
      <Heading {...{eyebrow, title, subtitle}} aside={`${number(sum)} ${unit}`} />
      <div style={{marginTop: 23, display: 'flex', flexDirection: 'column', gap: 16}}>
        {displayed.length === 0 && <div style={{color: muted}}>No classified public contributions to show.</div>}
        {displayed.map(({name, count}, index) => (
          <div key={name}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 9, fontSize: 14}}>
                <span style={{width: 7, height: 7, borderRadius: 7, background: colors[index]}} />
                {name}
              </div>
              <div style={{...mono, fontSize: 12, color: muted}}>
                <span style={{color: text, fontWeight: 700}}>{number(count)}</span>
                {' / '}{(count / sum * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{height: 6, background: '#302b43', borderRadius: 4, overflow: 'hidden'}}>
              <div style={{height: '100%', width: `${count / sum * 100}%`, background: colors[index], borderRadius: 4}} />
            </div>
          </div>
        ))}
      </div>
      <div style={{fontSize: 10, color: muted, marginTop: 20, lineHeight: 1.5}}>{footer}</div>
    </Panel>
  );
};

const ProductiveTime = ({neonBorders}) => {
  const {hours} = data.productiveTime;
  const sum = hours.reduce((value, count) => value + count, 0);
  const maximum = Math.max(...hours);
  const peakHours = hours.map((count, hour) => ({count, hour})).filter(({count}) => count === maximum && count > 0);
  const ceiling = Math.max(10, Math.ceil(maximum / 10) * 10);
  const left = 58;
  const bottom = 155;
  const top = 12;
  const width = 961;
  const band = width / 24;
  const y = (value) => bottom - value / ceiling * (bottom - top);
  return (
    <Panel neonBorders={neonBorders} style={{height: 359}}>
      <Heading
        eyebrow="04 / PRODUCTIVE TIME"
        title="Commits by hour"
        subtitle={`${number(sum)} sampled public commits / ${dateLabel(data.productiveTime.since)} to ${dateLabel(data.productiveTime.until)} / UTC`}
        aside={peakHours.length === 1 ? `Peak ${String(peakHours[0].hour).padStart(2, '0')}:00 UTC` : 'Peak hours highlighted'}
      />
      <svg width="100%" height="199" viewBox="0 0 1042 199" style={{marginTop: 15}}>
        {[0, 1, 2, 3].map((tick) => {
          const value = ceiling * tick / 3;
          return (
            <g key={tick}>
              <line x1={left} x2={left + width} y1={y(value)} y2={y(value)} stroke="#393246" strokeDasharray="3 6" />
              <text x={left - 15} y={y(value) + 4} textAnchor="end" fill={muted} fontSize="11">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        {hours.map((count, hour) => (
          <g key={hour}>
            <rect
              x={left + band * hour + 6}
              y={y(count)}
              width={band - 12}
              height={bottom - y(count)}
              rx="4"
              fill={count === maximum ? colors[0] : colors[1]}
              opacity={count === maximum ? 1 : 0.6}
            />
            {hour % 3 === 0 || hour === 23 ? (
              <text x={left + band * (hour + 0.5)} y="180" textAnchor="middle" fill={muted} fontSize="11">
                {String(hour).padStart(2, '0')}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <div style={{fontSize: 10, color: muted}}>
        Authored timestamps / up to 50 commits per repository, across up to 50 repositories / not a complete activity log
      </div>
    </Panel>
  );
};

export const DetailedCharts = ({neonBorders = false}) => (
  <AbsoluteFill style={{
    fontFamily: '"DejaVu Sans", sans-serif',
    color: text,
    background: '#0e0e19',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  }}>
    <ContributionHistory neonBorders={neonBorders} />
    <div style={{display: 'flex', gap: 18}}>
      <LanguageBars
        neonBorders={neonBorders}
        items={data.repositories}
        eyebrow="02 / REPOSITORIES BY LANGUAGE"
        title="Repository languages"
        subtitle="Owned public repositories, grouped by primary language."
        unit="repos"
        footer="Forks and repositories without a primary language are excluded."
      />
      <LanguageBars
        neonBorders={neonBorders}
        items={data.commits.languages}
        eyebrow="03 / COMMITS BY LANGUAGE"
        title="Commit languages"
        subtitle="Public commit contributions, grouped by repository language."
        unit="commits"
        footer={`${data.commits.years[0]}-${data.commits.years.at(-1)} / up to 100 repositories per year / top five + Other`}
      />
    </div>
    <ProductiveTime neonBorders={neonBorders} />
    <div style={{...mono, color: muted, fontSize: 10, padding: '0 4px'}}>
      FIXED DESIGN SNAPSHOT / {data.capturedAt.slice(0, 10)} / STRUCTURED GITHUB DATA
    </div>
  </AbsoluteFill>
);
