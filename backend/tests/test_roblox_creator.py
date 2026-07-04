import unittest

from backend.roblox_creator import _build_hardened_messages, _normalize_script_payload, _parse_json


class RobloxCreatorTests(unittest.TestCase):
    def test_parse_json_handles_markdown_fences(self) -> None:
        payload = """```json
{"scripts": [{"path": "src/ServerScriptService/Main.server.lua", "content": "print('hello')"}]}
```"""

        parsed = _parse_json(payload)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["scripts"][0]["path"], "src/ServerScriptService/Main.server.lua")

    def test_normalize_script_payload_accepts_lumi_style_files(self) -> None:
        payload = {
            "files": [
                {
                    "path": "src/ServerScriptService/Main.server.lua",
                    "source": "print('live preview')",
                    "className": "Script",
                    "description": "Live preview entrypoint",
                }
            ]
        }

        normalized = _normalize_script_payload(payload)

        self.assertEqual(len(normalized), 1)
        self.assertEqual(normalized[0]["path"], "src/ServerScriptService/Main.server.lua")
        self.assertEqual(normalized[0]["content"], "print('live preview')")
        self.assertEqual(normalized[0]["type"], "server")

    def test_build_hardened_messages_includes_retry_guidance(self) -> None:
        messages = _build_hardened_messages("Create a Roblox game loop", "Response was not valid JSON")

        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("high-performance Luau", messages[0]["content"])
        self.assertIn("PREVIOUS ATTEMPT FAILED", messages[1]["content"])
        self.assertIn("Response was not valid JSON", messages[1]["content"])


if __name__ == "__main__":
    unittest.main()
