import os
import json
from playwright.sync_api import sync_playwright, expect

def main():
    print("Starting e2e test with Mock Auth (Bypass Login)...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        page = browser.new_page()
        
        # Intercept POST requests to the backend (Apps Script / Supabase)
        # This prevents the app from hitting the real database, 
        # ensuring we ONLY do UI testing and DO NOT alter any real data.
        def handle_route(route):
            request = route.request
            if request.method == "POST":
                post_data = request.post_data or ""
                if "whoami" in post_data:
                    route.fulfill(status=200, json={
                        "ok": True, "email": "mock@sikanda.local", "role": "admin", 
                        "nip": "198001012000011001", "nama": "Administrator Testing", "foto": ""
                    })
                elif "notification_feed" in post_data:
                    route.fulfill(status=200, json={
                        "ok": True, "generated_at": "", "birthdays": [], "overdue": [], "kgb": [], "pangkat": [], "bup": []
                    })
                elif "dashboard_snapshot" in post_data:
                    route.fulfill(status=200, json={"ok": True, "generated_at": "", "data": {}})
                elif "get_config" in post_data:
                    route.fulfill(status=200, json={"ok": True, "config": {}})
                else:
                    # Provide a generic success for anything else to prevent crashes
                    route.fulfill(status=200, json={"ok": True})
            else:
                route.continue_()

        # Terapkan interception pada semua request (termasuk fetch ke Apps Script)
        page.route("**/*", handle_route)

        # 1. Navigasi awal ke halaman agar domain localhost terbuka
        print("Injecting mock session...")
        page.goto('http://localhost:3000', wait_until='commit', timeout=60000)
        
        # 2. Inject sesi login buatan (dummy) ke dalam sessionStorage
        page.evaluate('''() => {
            sessionStorage.setItem("sikanda_supabase_session_v1", JSON.stringify({
                accessToken: "mock-access-token",
                refreshToken: "mock-refresh-token",
                expiresAt: Math.floor(Date.now() / 1000) + 3600
            }));
        }''')
        
        # 3. Reload halaman agar AppShell React membaca sesi buatan kita
        print("Reloading page to bypass login...")
        page.reload(timeout=60000)
        
        # Tunggu sampai React selesai me-render dan network diam
        page.wait_for_load_state('networkidle', timeout=60000)
        
        # Ambil screenshot dari halaman yang terbuka (seharusnya Dashboard)
        os.makedirs('tests/results', exist_ok=True)
        screenshot_path = 'tests/results/dashboard_mock.png'
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Saved mock dashboard screenshot to {screenshot_path}")
        
        title = page.title()
        print(f"Page title is: '{title}'")
        
        browser.close()
        print("e2e bypass-login test completed successfully.")

if __name__ == '__main__':
    main()
