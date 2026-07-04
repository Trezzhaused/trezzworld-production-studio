async function generateLiveOp(prompt) {
  const brandMatch = prompt.match(/Brand:\s*(.+)/);
  const seasonMatch = prompt.match(/Season:\s*(.+)/);
  const brandName = brandMatch ? brandMatch[1].trim() : 'Global Brand';
  const seasonName = seasonMatch ? seasonMatch[1].trim() : 'Season';

  return {
    id: `${brandName.toLowerCase().replace(/\s+/g, '_')}_${seasonName.toLowerCase().replace(/\s+/g, '_')}`,
    name: `${brandName} ${seasonName}`,
    duration: { start: '2026-07-10', end: '2026-07-31' },
    rewards: {
      daily: { coins: 500 },
      milestone: {
        stage5: 'PremiumTrail',
        stage10: 'LimitedSkin',
      },
    },
    modifiers: {
      speedMultiplier: 1.5,
      incomeMultiplier: 2,
    },
    urgency: 'Ends in 3 days!',
    theme: {
      primaryColor: '#FF4F00',
      logo: 'rbxassetid://123456',
    },
  };
}

module.exports = { generateLiveOp };
