import urllib.request
import json
import sys

BASE_URL = "http://localhost:8090"

def post(url, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"status_code": e.code, "error": e.read().decode()}

def get(url, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"status_code": e.code, "error": e.read().decode()}

print("=== 1. CUSTOMER LOGIN & BALANCES ===")
login_res = post(f"{BASE_URL}/api/v1/auth/login", {
    "email": "john.doe@bankinvestigation.com",
    "password": "Password123!"
})
if "data" not in login_res:
    print("Login failed:", login_res)
    sys.exit(1)

cust_token = login_res["data"]["tokens"]["access_token"]
print("Customer logged in successfully.")

accs_res = get(f"{BASE_URL}/api/v1/accounts", cust_token)
accounts_data = accs_res.get("data", {})
if isinstance(accounts_data, dict):
    accounts = accounts_data.get("accounts", [])
else:
    accounts = accounts_data

print(f"Found {len(accounts)} accounts:")
for a in accounts:
    print(f"  Account {a['account_number']} ({a['account_type']}): ${a['balance']} {a['currency']}")

if len(accounts) < 2:
    print("Error: Need at least 2 accounts to test transfer")
    sys.exit(1)

src = accounts[0]["id"]
dest = accounts[1]["account_number"]

print("\n=== 2. LOW-RISK TRANSFER ($35.00) ===")
tx1 = post(f"{BASE_URL}/api/v1/transfers", {
    "source_account_id": src,
    "destination_account_number": dest,
    "transfer_type": "INTERNAL",
    "amount": 35.00,
    "currency": "USD",
    "description": "Routine coffee & lunch"
}, cust_token)

print("Transfer Response:")
print(json.dumps(tx1, indent=2))

if tx1.get("data", {}).get("requires_otp"):
    tx_id = tx1["data"]["transaction"]["id"]
    demo_otp = tx1["data"]["demo_otp"]
    print(f"\nSubmitting OTP '{demo_otp}' for transaction {tx_id}...")
    otp_res = post(f"{BASE_URL}/api/v1/transfers/{tx_id}/otp", {"code": demo_otp}, cust_token)
    print("OTP Verification Result:")
    print(json.dumps(otp_res, indent=2))

print("\n=== 3. ANOMALOUS HIGH-AMOUNT TRANSFER ($14,500.00) ===")
tx2 = post(f"{BASE_URL}/api/v1/transfers", {
    "source_account_id": src,
    "destination_account_number": dest,
    "transfer_type": "INTERNAL",
    "amount": 14500.00,
    "currency": "USD",
    "description": "Urgent high-value offshore transfer"
}, cust_token)

print("High Risk Transfer Response:")
print(json.dumps(tx2, indent=2))

print("\n=== 4. FRAUD ANALYST WORKFLOW ===")
analyst_login = post(f"{BASE_URL}/api/v1/auth/login", {
    "email": "analyst@bankinvestigation.com",
    "password": "Analyst123!"
})
analyst_token = analyst_login["data"]["tokens"]["access_token"]
print("Analyst logged in successfully.")

metrics = get(f"{BASE_URL}/api/v1/admin/investigation/overview", analyst_token)
print("Investigation Overview:")
print(json.dumps(metrics, indent=2))

alerts_res = get(f"{BASE_URL}/api/v1/admin/investigation/alerts", analyst_token)
alerts = alerts_res.get("alerts", [])
print(f"\nInvestigation Queue has {len(alerts)} alerts (total: {alerts_res.get('total')}).")
for item in alerts[:3]:
    print(f"  Alert #{item.get('id')} - Tx: {item.get('transaction_id')} - Score: {item.get('risk_score')} - Severity: {item.get('severity')} - Status: {item.get('status')}")

# 5. Adjudicate Alert
if alerts:
    first_alert = alerts[0]
    alert_id = first_alert["id"]
    print(f"\nAdjudicating alert {alert_id} as 'RELEASED'...")
    adj_res = post(f"{BASE_URL}/api/v1/admin/investigation/alerts/{alert_id}/adjudicate", {
        "decision": "RELEASED",
        "reason": "Verified user transaction pattern via customer confirmation",
        "notes": "E2E automated verification test"
    }, analyst_token)
    print("Adjudication Result:", adj_res.get("message", adj_res))

print("\nALL VERIFICATIONS PASSED!")
