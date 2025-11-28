#!/bin/bash

# Security Penetration Testing Script
# Tests common security vulnerabilities

BASE_URL="${1:-http://localhost:3000}"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m' # No Color

echo "=========================================="
echo "Security Penetration Testing"
echo "Target: $BASE_URL"
echo "=========================================="
echo ""

# Test 1: SQL Injection
echo -e "${COLOR_YELLOW}Test 1: SQL Injection${COLOR_NC}"
echo "Testing search endpoint with SQL injection payloads..."

PAYLOADS=(
  "' OR '1'='1"
  "'; DROP TABLE profiles; --"
  "' UNION SELECT * FROM profiles --"
  "1' OR '1'='1"
)

for payload in "${PAYLOADS[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/wagers?search=$(echo -n "$payload" | jq -sRr @uri)")
  if [ "$response" = "200" ]; then
    echo -e "  ${COLOR_RED}⚠️  Potential vulnerability: Payload '$payload' returned 200${COLOR_NC}"
  else
    echo -e "  ${COLOR_GREEN}✓ Payload '$payload' rejected (HTTP $response)${COLOR_NC}"
  fi
done

echo ""

# Test 2: XSS
echo -e "${COLOR_YELLOW}Test 2: XSS (Cross-Site Scripting)${COLOR_NC}"
echo "Testing XSS payloads..."

XSS_PAYLOADS=(
  "<script>alert('XSS')</script>"
  "<img src=x onerror=alert('XSS')>"
  "javascript:alert('XSS')"
  "<svg onload=alert('XSS')>"
)

for payload in "${XSS_PAYLOADS[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/wagers?search=$(echo -n "$payload" | jq -sRr @uri)")
  if [ "$response" = "200" ]; then
    echo -e "  ${COLOR_YELLOW}⚠️  XSS payload accepted (may be sanitized server-side)${COLOR_NC}"
  else
    echo -e "  ${COLOR_GREEN}✓ XSS payload rejected (HTTP $response)${COLOR_NC}"
  fi
done

echo ""

# Test 3: Authentication Bypass
echo -e "${COLOR_YELLOW}Test 3: Authentication Bypass${COLOR_NC}"
echo "Testing protected endpoints without authentication..."

PROTECTED_ENDPOINTS=(
  "/api/profile"
  "/api/wallet/balance"
  "/api/wallet/transactions"
  "/api/admin/users"
)

for endpoint in "${PROTECTED_ENDPOINTS[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
  if [ "$response" = "401" ] || [ "$response" = "403" ]; then
    echo -e "  ${COLOR_GREEN}✓ $endpoint properly protected (HTTP $response)${COLOR_NC}"
  else
    echo -e "  ${COLOR_RED}⚠️  $endpoint may be vulnerable (HTTP $response)${COLOR_NC}"
  fi
done

echo ""

# Test 4: IDOR (Insecure Direct Object Reference)
echo -e "${COLOR_YELLOW}Test 4: IDOR Vulnerability${COLOR_NC}"
echo "Testing access to other users' data..."
echo -e "  ${COLOR_YELLOW}⚠️  Manual testing required - need authenticated session${COLOR_NC}"
echo "  Test: Try accessing /api/profile with different user IDs"
echo "  Test: Try accessing /api/wallet/transactions with different user IDs"

echo ""

# Test 5: Rate Limiting
echo -e "${COLOR_YELLOW}Test 5: Rate Limiting${COLOR_NC}"
echo "Testing rate limiting on auth endpoints..."

for i in {1..20}; do
  response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}')
  
  if [ "$response" = "429" ]; then
    echo -e "  ${COLOR_GREEN}✓ Rate limiting triggered after $i requests${COLOR_NC}"
    break
  fi
done

echo ""

# Test 6: Security Headers
echo -e "${COLOR_YELLOW}Test 6: Security Headers${COLOR_NC}"
headers=$(curl -s -I "$BASE_URL" | grep -iE "(x-content-type-options|x-frame-options|x-xss-protection|strict-transport-security|content-security-policy)")

if echo "$headers" | grep -qi "x-content-type-options"; then
  echo -e "  ${COLOR_GREEN}✓ X-Content-Type-Options present${COLOR_NC}"
else
  echo -e "  ${COLOR_RED}⚠️  X-Content-Type-Options missing${COLOR_NC}"
fi

if echo "$headers" | grep -qi "x-frame-options"; then
  echo -e "  ${COLOR_GREEN}✓ X-Frame-Options present${COLOR_NC}"
else
  echo -e "  ${COLOR_RED}⚠️  X-Frame-Options missing${COLOR_NC}"
fi

if echo "$headers" | grep -qi "x-xss-protection"; then
  echo -e "  ${COLOR_GREEN}✓ X-XSS-Protection present${COLOR_NC}"
else
  echo -e "  ${COLOR_RED}⚠️  X-XSS-Protection missing${COLOR_NC}"
fi

if echo "$headers" | grep -qi "strict-transport-security"; then
  echo -e "  ${COLOR_GREEN}✓ Strict-Transport-Security present${COLOR_NC}"
else
  echo -e "  ${COLOR_YELLOW}⚠️  Strict-Transport-Security missing (expected in production)${COLOR_NC}"
fi

if echo "$headers" | grep -qi "content-security-policy"; then
  echo -e "  ${COLOR_GREEN}✓ Content-Security-Policy present${COLOR_NC}"
else
  echo -e "  ${COLOR_YELLOW}⚠️  Content-Security-Policy missing${COLOR_NC}"
fi

echo ""

# Test 7: Information Disclosure
echo -e "${COLOR_YELLOW}Test 7: Information Disclosure${COLOR_NC}"
echo "Testing error messages for sensitive information..."

# Test invalid endpoint
response=$(curl -s "$BASE_URL/api/nonexistent")
if echo "$response" | grep -qiE "(stack trace|database|sql|password|secret|key)"; then
  echo -e "  ${COLOR_RED}⚠️  Error response may contain sensitive information${COLOR_NC}"
else
  echo -e "  ${COLOR_GREEN}✓ Error messages appear sanitized${COLOR_NC}"
fi

echo ""

# Test 8: CORS
echo -e "${COLOR_YELLOW}Test 8: CORS Configuration${COLOR_NC}"
cors_headers=$(curl -s -I -X OPTIONS "$BASE_URL/api/wagers" -H "Origin: https://evil.com" | grep -i "access-control")

if [ -z "$cors_headers" ]; then
  echo -e "  ${COLOR_GREEN}✓ No CORS headers (likely same-origin only)${COLOR_NC}"
else
  echo -e "  ${COLOR_YELLOW}⚠️  CORS headers present: $cors_headers${COLOR_NC}"
fi

echo ""
echo "=========================================="
echo "Security Testing Complete"
echo "=========================================="
echo ""
echo "Note: This is a basic automated test."
echo "For comprehensive security testing, consider:"
echo "  - OWASP ZAP"
echo "  - Burp Suite"
echo "  - Manual penetration testing"
echo "  - Code review"
echo "  - Dependency scanning (npm audit)"

