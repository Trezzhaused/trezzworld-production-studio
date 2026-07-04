import unittest

from backend.company_vision import (
    get_asset_generation_blueprint,
    get_capability_matrix,
    get_company_vision_summary,
    get_launch_strategy,
    get_legal_framework,
    get_partnership_playbook,
    get_pitch_deck,
)
from backend.platform_vision import (
    BRANDS,
    FRANCHISES,
    build_platform_vision_status,
    get_brand_catalog,
    get_public_api_surface,
    schedule_liveops_event,
)


class PlatformVisionTests(unittest.TestCase):
    def test_brand_catalog_contains_expected_brands(self):
        catalog = get_brand_catalog()
        self.assertIn('nike', catalog['brands'])
        self.assertIn('marvel', catalog['brands'])
        self.assertEqual(BRANDS['nike']['domain'], 'nike.yourplatform.com')

    def test_public_surface_contains_templates_and_franchises(self):
        surface = get_public_api_surface()
        self.assertIn('obby', surface['templates'])
        self.assertIn('aether', surface['franchises'])

    def test_platform_status_reports_supported_modules(self):
        status = build_platform_vision_status()
        self.assertEqual(status['status'], 'ready')
        self.assertIn('visual scripting', status['modules'])
        self.assertIn('public API', status['modules'])

    def test_liveops_scheduling_returns_acknowledgement(self):
        schedule = schedule_liveops_event('nike', {'name': 'Summer Dash'})
        self.assertTrue(schedule['ok'])
        self.assertEqual(schedule['brandId'], 'nike')
        self.assertEqual(schedule['event']['name'], 'Summer Dash')

    def test_company_vision_summary_contains_core_strategy(self):
        summary = get_company_vision_summary()
        self.assertEqual(summary['company'], 'NextGen Studios, Inc.')
        self.assertIn('SDK ecosystem', summary['moats'])

    def test_pitch_deck_and_partnership_playbook_are_structured(self):
        deck = get_pitch_deck()
        playbook = get_partnership_playbook()
        self.assertGreaterEqual(len(deck), 4)
        self.assertEqual(playbook['tiers'][0]['name'], 'Consumer Brands')

    def test_asset_generation_launch_and_legal_blueprints_are_available(self):
        assets = get_asset_generation_blueprint()
        launch = get_launch_strategy()
        legal = get_legal_framework()
        matrix = get_capability_matrix()
        self.assertIn('Upload to Roblox (Open Cloud)', assets['architecture'])
        self.assertEqual(launch['phases'][0]['name'], 'Stealth Beta')
        self.assertIn('GDPR-K', legal['compliance'])
        self.assertEqual(matrix[-1]['system'], 'Exit-Ready Company')


if __name__ == '__main__':
    unittest.main()
