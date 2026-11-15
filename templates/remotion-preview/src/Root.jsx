import React from 'react';
import {AbsoluteFill, Composition, Easing, interpolate, useCurrentFrame} from 'remotion';
import snapshot from '../snapshot.json';

const colors = {
  cyan: '#6be7ff',
  purple: '#bc91ff',
  text: '#f5f2ff',
  muted: '#aaa6c1',
};
const number = (value, decimals = 0) => value.toLocaleString('en-GB', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
});
const count = (value, progress) => {
  const suffix = value.toLowerCase().endsWith('k') ? 'k' : '';
  const numeric = Number(value.replace(/k|,/gi, ''));
  const decimals = value.includes('.') ? value.split('.')[1].replace(/k/i, '').length : 0;
  return `${number(numeric * progress, decimals)}${suffix}`;
};
const mono = {fontFamily: '"DejaVu Sans Mono", monospace'};

const Stat = ({label, value, progress, index}) => (
  <div style={{
    flex: 1,
    minWidth: 0,
    padding: '22px 24px',
    borderRadius: 16,
    border: '1px solid #39304f',
    background: 'linear-gradient(145deg, #211c32, #171827)',
    transform: `translateY(${(1 - progress) * (8 + index * 3)}px)`,
  }}>
    <div style={{...mono, fontSize: 12, color: colors.muted, letterSpacing: 1.4}}>
      {label}
    </div>
    <div style={{
      fontSize: 47,
      fontWeight: 700,
      letterSpacing: -2,
      marginTop: 10,
      fontVariantNumeric: 'tabular-nums',
      color: index === 0 ? colors.cyan : colors.text,
    }}>
      {count(value, progress)}
    </div>
    <div style={{height: 2, marginTop: 14, background: '#332b47', borderRadius: 2}}>
      <div style={{
        height: '100%',
        width: `${progress * 100}%`,
        background: index % 2 ? colors.purple : colors.cyan,
        borderRadius: 2,
      }} />
    </div>
  </div>
);

const ProfileOverview = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 32], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hoursProgress = interpolate(frame, [8, 40], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const milestoneProgress = Math.min(1, snapshot.vrchatHours / snapshot.vrchatMilestone);
  const remaining = Math.max(0, snapshot.vrchatMilestone - snapshot.vrchatHours);
  return (
    <AbsoluteFill style={{
      fontFamily: '"DejaVu Sans", sans-serif',
      color: colors.text,
      padding: 3,
      background: 'linear-gradient(120deg, #70e7ff, #7861ca 45%, #c08bff 75%, #70e7ff)',
      borderRadius: 26,
      overflow: 'hidden',
    }}>
      <AbsoluteFill style={{
        inset: 3,
        width: 'auto',
        height: 'auto',
        borderRadius: 23,
        padding: '30px 34px 20px',
        background: 'radial-gradient(ellipse at 90% 0%, #312048 0%, transparent 52%), #11111d',
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{...mono, fontSize: 14, color: colors.cyan, letterSpacing: 2}}>
            M1XZG <span style={{color: '#5e5878'}}> / </span> ACTIVITY OVERVIEW
          </div>
          <div style={{...mono, fontSize: 12, color: colors.muted}}>
            SNAPSHOT / {snapshot.capturedAt.slice(0, 10)}
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 20}}>
          <div style={{fontSize: 35, fontWeight: 700, letterSpacing: -1}}>
            GitHub, in numbers.
          </div>
          <div style={{fontSize: 13, color: colors.muted}}>
            Code, contributions and a little VR.
          </div>
        </div>
        <div style={{display: 'flex', gap: 12, marginTop: 22}}>
          {[
            ['CONTRIBUTIONS / YEAR', snapshot.contributions],
            ['TOTAL COMMITS', snapshot.commits],
            ['PULL REQUESTS', snapshot.pullRequests],
            ['TOTAL STARS', snapshot.stars],
          ].map(([label, value], index) => (
            <Stat key={label} {...{label, value, progress, index}} />
          ))}
        </div>
        <div style={{
          marginTop: 18,
          border: '1px solid #39304f',
          borderRadius: 16,
          padding: '18px 24px',
          background: 'linear-gradient(110deg, #1d1b32, #162330)',
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <div style={{...mono, fontSize: 12, letterSpacing: 1.4, color: colors.purple}}>
                VRCHAT / ROAD TO {number(snapshot.vrchatMilestone)}
              </div>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 5}}>
                <span style={{fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums'}}>
                  {number(snapshot.vrchatHours * hoursProgress, 1)}
                </span>
                <span style={{fontSize: 13, color: colors.muted}}>lifetime hours</span>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: 27, fontWeight: 700, color: colors.cyan}}>
                {number(milestoneProgress * 100, 2)}%
              </div>
              <div style={{fontSize: 12, color: colors.muted}}>{number(remaining, 1)} hours to go</div>
            </div>
          </div>
          <div style={{height: 7, borderRadius: 4, background: '#302b43', marginTop: 12, overflow: 'hidden'}}>
            <div style={{
              height: '100%',
              width: `${milestoneProgress * hoursProgress * 100}%`,
              borderRadius: 4,
              background: 'linear-gradient(90deg, #ae78ff, #6be7ff)',
            }} />
          </div>
        </div>
        <div style={{
          ...mono,
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 14,
          color: colors.muted,
          fontSize: 10,
        }}>
          <span>GITHUB: EXISTING AURA CARDS / ROUNDED TOTALS</span>
          <span>VRCHAT: {snapshot.vrchatReportedAt}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const RemotionRoot = () => (
  <Composition
    id="ProfileOverview"
    component={ProfileOverview}
    width={1100}
    height={460}
    fps={15}
    durationInFrames={105}
  />
);
