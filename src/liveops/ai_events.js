const { generateLiveOp } = require('../llm/liveops');

async function generateEvent(brand, season) {
  const prompt = `
You are a Roblox LiveOps designer.
Brand: ${brand && brand.name ? brand.name : 'Generic Brand'}
Season: ${season || 'Launch'}
Objective: Maximize retention and Robux revenue.

Generate a JSON LiveOps event with:
- name
- duration (start/end)
- rewards (daily + milestone)
- gameplay modifiers
- urgency messaging
- UI theme hints
`;

  return generateLiveOp(prompt);
}

module.exports = { generateEvent };
