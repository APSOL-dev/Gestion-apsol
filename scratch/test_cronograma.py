import os
import json
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\Adrian\.gemini\antigravity\brain\217ceb42-43d5-4d36-aeba-26efd7981533"
os.makedirs(artifact_dir, exist_ok=True)

console_logs = []
page_errors = []

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 1000})
        page = context.new_page()

        def on_console(msg):
            console_logs.append({
                "type": msg.type,
                "text": msg.text,
                "location": msg.location
            })
            print(f"[CONSOLE {msg.type.upper()}] {msg.text}")

        def on_page_error(exc):
            page_errors.append(str(exc))
            print(f"[PAGE ERROR] {exc}")

        page.on("console", on_console)
        page.on("pageerror", on_page_error)

        print("Navigating to http://localhost:5173/login ...")
        page.goto("http://localhost:5173/login")

        # Inject session into localStorage
        mock_session = {
            "access_token": "mock-access-token",
            "refresh_token": "mock-refresh-token",
            "expires_in": 3600,
            "expires_at": 9999999999,
            "token_type": "bearer",
            "user": {
                "id": "00000000-0000-0000-0000-000000000001",
                "aud": "authenticated",
                "role": "authenticated",
                "email": "apatriarca.apsol@gmail.com",
                "app_metadata": {"provider": "email"},
                "user_metadata": {},
                "created_at": "2026-01-01T00:00:00.000Z"
            }
        }
        
        page.evaluate("""(sessionObj) => {
            localStorage.setItem('sb-kursvmadozcqxoaeaccd-auth-token', JSON.stringify(sessionObj));
        }""", mock_session)

        print("Set session in localStorage. Navigating to http://localhost:5173/cronograma ...")
        page.goto("http://localhost:5173/cronograma", wait_until="networkidle")

        page.wait_for_timeout(3000)

        current_url = page.url
        print(f"Current URL after navigating to Cronograma: {current_url}")

        shot_path = os.path.join(artifact_dir, "cronograma_full.png")
        page.screenshot(path=shot_path, full_page=True)
        print(f"Screenshot saved to {shot_path}")

        inspection_res = page.evaluate("""() => {
            const sidebar = document.querySelector('.compliance-panel, .saldo-horas-panel, [class*="compliance"], [class*="saldo"]') || document.body;
            
            const items = Array.from(document.querySelectorAll('.compliance-item, [class*="compliance-item"]')).map(item => {
                const nameEl = item.querySelector('.p-name, [class*="name"]');
                const saldoEl = item.querySelector('.p-balance, [class*="balance"], .p-saldo, [class*="saldo"]');
                const daysEl = item.querySelector('.p-days, [class*="days"]');
                return {
                    full_text: item.innerText.replace(/\\s+/g, ' ').trim(),
                    prospecto: nameEl ? nameEl.innerText.trim() : null,
                    saldo: saldoEl ? saldoEl.innerText.trim() : null,
                    dias: daysEl ? daysEl.innerText.trim() : null
                };
            });

            const allComplianceText = sidebar ? sidebar.innerText : '';

            return {
                sidebar_found: !!document.querySelector('.compliance-panel, .saldo-horas-panel, [class*="compliance"]'),
                items_count: items.length,
                items: items,
                sidebar_text: allComplianceText,
                page_title: document.title,
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5')).map(h => h.innerText.trim())
            };
        }""")

        report = {
            "url": current_url,
            "console_logs": console_logs,
            "page_errors": page_errors,
            "inspection": inspection_res
        }

        report_path = os.path.join(artifact_dir, "cronograma_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"Report saved to {report_path}")
        browser.close()

if __name__ == "__main__":
    run()
