const { BRANDS } = require('../whitelabel/brands');
const { FRANCHISES } = require('../franchise/franchise');

function buildPublicApiSurface() {
  return {
    templates: ['obby', 'tycoon', 'rpg', 'simulator'],
    liveopsActive: [
      {
        id: 'nike_summer_dash',
        name: 'Nike Summer Dash',
        brandId: 'nike',
        status: 'active',
      },
    ],
    franchises: FRANCHISES,
    brands: BRANDS,
  };
}

function createPublicApiRoutes() {
  const surface = buildPublicApiSurface();

  return {
    getTemplates: () => surface.templates,
    getActiveEvents: () => surface.liveopsActive,
    getFranchises: () => surface.franchises,
    getBrands: () => surface.brands,
  };
}

module.exports = { buildPublicApiSurface, createPublicApiRoutes };
