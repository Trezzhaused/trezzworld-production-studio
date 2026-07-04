from __future__ import annotations

from typing import Any

from .roblox_creator import RobloxJob


_GENRE_PRODUCT_MAP: dict[str, list[dict[str, Any]]] = {
    "Simulator": [
        {"key": "CoinPack", "name": "Coin Pack", "kind": "developer-product", "price": 99, "description": "Instant coin boost for early progression."},
        {"key": "AutoClicker", "name": "Auto Clicker", "kind": "game-pass", "price": 199, "description": "Automates idle progress for your shop."},
        {"key": "TripleBoost", "name": "Triple Boost", "kind": "developer-product", "price": 299, "description": "A short-lived boost for faster progression."},
        {"key": "VIP", "name": "VIP", "kind": "game-pass", "price": 499, "description": "Premium access and bonus rewards."},
    ],
    "RPG": [
        {"key": "SwordSkin", "name": "Sword Skin", "kind": "developer-product", "price": 199, "description": "A cosmetic weapon skin for the hero."},
        {"key": "BattlePass", "name": "Battle Pass", "kind": "game-pass", "price": 499, "description": "Seasonal progression and bonus loot."},
        {"key": "Mount", "name": "Mount", "kind": "developer-product", "price": 399, "description": "A rare mount that speeds travel."},
    ],
    "Obby": [
        {"key": "SkipStage", "name": "Skip Stage", "kind": "developer-product", "price": 99, "description": "Skip one difficult stage with a single purchase."},
        {"key": "DoubleJump", "name": "Double Jump", "kind": "game-pass", "price": 149, "description": "Adds a double-jump perk to the obby."},
        {"key": "CosmeticTrail", "name": "Cosmetic Trail", "kind": "developer-product", "price": 79, "description": "A flashy trail for style."},
    ],
    "Tycoon": [
        {"key": "AutoCollect", "name": "Auto Collect", "kind": "developer-product", "price": 249, "description": "Automatically collects earnings while the player is away."},
        {"key": "PremiumPlot", "name": "Premium Plot", "kind": "game-pass", "price": 399, "description": "Unlocks a premium plot for faster growth."},
        {"key": "IncomeBoost", "name": "Income Boost", "kind": "developer-product", "price": 199, "description": "Boosts income for a short run."},
    ],
}


def build_monetization_plan(job: RobloxJob, cohort: str = "control") -> dict[str, Any]:
    base_products = _GENRE_PRODUCT_MAP.get(job.genre, _GENRE_PRODUCT_MAP["Simulator"])
    plan: list[dict[str, Any]] = []
    for item in base_products:
        price = item["price"]
        if cohort == "discount":
            price = max(79, int(price * 0.9))
        elif cohort == "premium":
            price = int(price * 1.15)
        plan.append(
            {
                "key": item["key"],
                "name": item["name"],
                "kind": item["kind"],
                "price": price,
                "description": item["description"],
            }
        )
    return {"jobId": job.job_id, "genre": job.genre, "cohort": cohort, "products": plan}


def create_monetization_assets(
    job: RobloxJob,
    *,
    api_key: str | None = None,
    universe_id: str | None = None,
    place_id: str | None = None,
    cohort: str = "control",
) -> dict[str, Any]:
    from .roblox_publisher import RobloxPublishError, create_developer_product, create_game_pass  # noqa: PLC0415

    plan = build_monetization_plan(job, cohort=cohort)
    universe = universe_id or job.universe_id or ""
    if not universe:
        return {"jobId": job.job_id, "created": [], "errors": [], "plan": plan, "dryRun": True}

    created: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for product in plan["products"]:
        try:
            if product["kind"] == "game-pass":
                result = create_game_pass(universe, product["name"], product["price"], product["description"], api_key=api_key)
            else:
                result = create_developer_product(universe, product["name"], product["price"], product["description"], api_key=api_key)
            created.append({**product, **result})
        except RobloxPublishError as exc:
            errors.append({"key": product["key"], "error": str(exc)})

    job.monetization_assets = created
    try:
        from .roblox_creator import _persist_roblox_job  # noqa: PLC0415
        _persist_roblox_job(job)
    except Exception:
        pass

    return {"jobId": job.job_id, "universeId": universe, "created": created, "errors": errors, "plan": plan, "dryRun": False}
