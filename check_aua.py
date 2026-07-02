import os
import time
import random
import urllib.parse
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Run: pip install playwright && playwright install chromium")
    sys.exit(1)

# --- Configuration ---
INPUT_FILE = "books.txt"
OUTPUT_FILE = "aua_results.txt"
HEADLESS = True
MIN_DELAY = 0.8
MAX_DELAY = 1.5


def load_books():
    if not os.path.exists(INPUT_FILE):
        sample = [
            "Player Piano by Kurt Vonnegut",
            "The Hobbit by J.R.R. Tolkien",
            "Designing Data-Intensive Applications by Martin Kleppmann",
            "Clean Code by Robert C. Martin",
        ]
        with open(INPUT_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(sample) + "\n")
        print(f"[*] Created sample '{INPUT_FILE}'. Add your titles and re-run.")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        return [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]


def build_url(title: str) -> str:
    query = urllib.parse.quote(title)
    return (
        f"https://aualibrary.on.worldcat.org/search"
        f'?queryString=ti:("{query}")'
        f"&databaseList="
        f"&clusterResults=true"
        f"&groupVariantRecords=false"
        f"&stickyFacetsChecked=true"
        f"&baseScope=wz%3A48498"
        f"&scope=wz%3A48498"
        f"&idDetect=true"
        f"&citeDetect=true"
        f"&subformat=Book%3A%3Abook_printbook"
        f"&changedFacet=format"
        f"&bookReviews=off"
        f"&expandSearch=off"
        f"&translateSearch=off"
    )


def main():
    print("=" * 60)
    print(" AUA WorldCat Library Checker ".center(60, "="))
    print("=" * 60)

    books = load_books()
    if not books:
        print(f"No books in {INPUT_FILE}.")
        return

    print(f"Loaded {len(books)} book(s). Launching browser...")

    available, not_found, errors = [], [], []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        # Warm up session
        print("Authorizing session...")
        page.goto("https://aualibrary.on.worldcat.org/search", wait_until="networkidle", timeout=30_000)
        time.sleep(2)
        print("[+] Ready.\n")

        for idx, title in enumerate(books, 1):
            print(f"[{idx}/{len(books)}] '{title}'")
            try:
                # Intercept the /api/search response — grab JSON before React touches it.
                # wait_until="commit" returns as soon as the navigation is committed,
                # so we don't wait for JS to render anything.
                with page.expect_response(
                    lambda r: "/api/search" in r.url,
                    timeout=15_000,
                ) as resp_info:
                    page.goto(build_url(title), wait_until="commit", timeout=15_000)

                data = resp_info.value.json()
                count = data.get("numberOfRecords", 0)

                if count == 0:
                    print("  [-] Not found.")
                    not_found.append(title)
                else:
                    print(f"  [+] FOUND! ({count} record(s))")
                    available.append(title)

            except Exception as e:
                print(f"  [!] Error: {e}")
                errors.append(title)

            if idx < len(books):
                delay = random.uniform(MIN_DELAY, MAX_DELAY)
                time.sleep(delay)

        browser.close()

    print("\n" + "=" * 60)
    print(f"  Checked  : {len(books)}")
    print(f"  Found    : {len(available)}")
    print(f"  Not found: {len(not_found)}")
    if errors:
        print(f"  Errors   : {len(errors)}")
    print("=" * 60)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(f"# AUA WorldCat Results — {len(available)}/{len(books)} found\n\n")
        for b in available:
            f.write(b + "\n")
        if errors:
            f.write("\n# ERRORS (check manually)\n")
            for b in errors:
                f.write(b + "\n")

    print(f"\n[*] Results saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()