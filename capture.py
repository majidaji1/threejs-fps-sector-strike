#!/usr/bin/env python3
"""Screenshot capture via Playwright: load each shot URL, wait for __shotReady, save PNG."""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = [
    {"name": "01-start", "url": "http://localhost:8123/?shot=start&seed=1"},
    {"name": "02-play", "url": "http://localhost:8123/?shot=play&seed=2"},
    {"name": "03-plant", "url": "http://localhost:8123/?shot=plant&seed=3"},
    {"name": "04-end", "url": "http://localhost:8123/?shot=end&seed=4"},
]

OUTPUT_DIR = Path(__file__).parent / "screenshots"
OUTPUT_DIR.mkdir(exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()

        for shot in SHOTS:
            print(f"Capturing {shot['name']}...")
            await page.goto(shot["url"], wait_until="load")
            try:
                await page.wait_for_function("window.__shotReady === true", timeout=15000)
                await page.screenshot(path=str(OUTPUT_DIR / f"{shot['name']}.png"))
                print(f"  ✓ {shot['name']}.png")
            except Exception as e:
                print(f"  ✗ {shot['name']} failed: {e}")
                await page.screenshot(path=str(OUTPUT_DIR / f"{shot['name']}.png"))

        await browser.close()
        print("All screenshots captured.")

if __name__ == "__main__":
    asyncio.run(main())