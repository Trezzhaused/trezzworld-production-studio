const BRANDS = {
  nike: {
    id: 'nike',
    name: 'Nike Park',
    domain: 'nike.yourplatform.com',
    logo: 'rbxassetid://123456',
    primaryColor: '#FF4F00',
    gameTemplates: ['obby', 'tycoon'],
    monetization: {
      revenueShare: 0.3,
      platformFee: 5000,
    },
  },
  marvel: {
    id: 'marvel',
    name: 'Marvel Heroes Simulator',
    domain: 'marvel.yourplatform.com',
    logo: 'rbxassetid://654321',
    primaryColor: '#ED1D24',
    gameTemplates: ['rpg', 'simulator'],
    monetization: {
      revenueShare: 0.25,
      platformFee: 15000,
    },
  },
};

module.exports = { BRANDS };
