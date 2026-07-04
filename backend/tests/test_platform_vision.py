import unittest

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


if __name__ == '__main__':
    unittest.main()
