# wagr Platform - Comprehensive QA Test Script

## Test Environment Setup

### Prerequisites
- Two test user accounts (regular users)
- One admin account
- Test Paystack account with test cards
- Access to admin panel
- Browser developer tools access

### Test Accounts
- **Regular User 1**: `testuser1@example.com` / `password123`
- **Regular User 2**: `testuser2@example.com` / `password123`
- **Admin User**: `admin@example.com` / `adminpassword123`

### Test Cards (Paystack Test Mode)
- **Success**: `4084084084084081`
- **Decline**: `5060666666666666666`
- **Insufficient Funds**: `5060666666666666667`

---

## Test Suite Overview

### Test Categories
1. **Authentication & Authorization** (15 tests)
2. **User Registration & Profile** (10 tests)
3. **Wager Creation** (20 tests)
4. **Wager Participation** (25 tests)
5. **Payment & Wallet** (20 tests)
6. **Notifications** (15 tests)
7. **Admin Panel** (25 tests)
8. **Automated Systems** (10 tests)
9. **UI/UX & Responsiveness** (15 tests)
10. **Performance & Caching** (10 tests)
11. **Error Handling** (10 tests)
12. **Security** (15 tests)

**Total: 190 Test Cases**

---

## 1. Authentication & Authorization

### Test 1.1: User Registration
**Steps:**
1. Navigate to home page
2. Click "Login" button
3. Click "Don't have an account? Sign up"
4. Enter email: `newuser@test.com`
5. Enter password: `testpass123` (min 6 chars)
6. Click "Sign Up"

**Expected:**
- Toast message: "Account created! Please check your email to confirm your account."
- Email sent to user
- User profile created with balance = 0

---

### Test 1.2: User Login (Regular User)
**Steps:**
1. Click "Login" button
2. Enter valid email and password
3. Click "Login"

**Expected:**
- User successfully logged in
- Redirected to home page
- User menu shows username/email
- Balance visible in navigation

---

### Test 1.3: Admin Login Attempt via Regular Auth
**Steps:**
1. Use admin credentials in regular login modal
2. Click "Login"

**Expected:**
- Login succeeds initially
- User immediately signed out
- Toast: "Admin Access Required - Admins must use the admin login page. Redirecting..."
- Redirected to `/admin/login` after 1.5 seconds

---

### Test 1.4: Admin Login via Admin Page
**Steps:**
1. Navigate to `/admin/login`
2. Enter admin email and password
3. Click "Login"

**Expected:**
- Admin successfully logged in
- Redirected to `/admin` dashboard
- Admin sidebar visible
- Admin can access all admin pages

---

### Test 1.5: Non-Admin Login via Admin Page
**Steps:**
1. Navigate to `/admin/login`
2. Enter regular user credentials
3. Click "Login"

**Expected:**
- Login fails
- Toast: "Access Denied - You don't have admin privileges."
- User signed out
- Remains on login page

---

### Test 1.6: Logout
**Steps:**
1. Log in as any user
2. Click profile icon
3. Click "Logout"
4. Confirm in dialog

**Expected:**
- Confirmation dialog appears
- User logged out after confirmation
- Redirected to home page
- User menu shows "Login" button

---

### Test 1.7: Session Persistence
**Steps:**
1. Log in
2. Close browser tab
3. Reopen application in new tab

**Expected:**
- User still logged in
- Session persisted
- No need to re-authenticate

---

### Test 1.8: Protected Route Access (Unauthenticated)
**Steps:**
1. Log out (if logged in)
2. Navigate to `/wallet`
3. Navigate to `/create`
4. Navigate to `/profile`

**Expected:**
- Auth modal appears
- User must login to access protected pages

---

### Test 1.9: Invalid Credentials
**Steps:**
1. Click "Login"
2. Enter invalid email/password
3. Click "Login"

**Expected:**
- Error message displayed
- User not logged in
- Remains on login modal

---

### Test 1.10: Password Validation (Sign Up)
**Steps:**
1. Click "Sign Up"
2. Enter password with < 6 characters
3. Click "Sign Up"

**Expected:**
- Error: "Password must be at least 6 characters long"
- Account not created

---

### Test 1.11: Email Validation
**Steps:**
1. Click "Sign Up"
2. Enter invalid email format
3. Click "Sign Up"

**Expected:**
- Error: "Please enter a valid email address"
- Account not created

---

### Test 1.12: Admin Route Protection
**Steps:**
1. Log in as regular user
2. Manually navigate to `/admin`
3. Manually navigate to `/admin/users`

**Expected:**
- Redirected to `/admin/login`
- Toast: "Access Denied"
- Cannot access admin routes

---

### Test 1.13: Admin Sidebar Visibility
**Steps:**
1. Log in as admin
2. Navigate to `/admin/login`

**Expected:**
- Admin sidebar NOT visible on login page
- Sidebar visible on all other admin pages

---

### Test 1.14: Regular User Sidebar
**Steps:**
1. Log in as regular user
2. Navigate to home page

**Expected:**
- Regular navigation sidebar visible
- No admin links visible

---

### Test 1.15: Concurrent Sessions
**Steps:**
1. Log in as User 1 in Browser A
2. Log in as User 1 in Browser B
3. Perform action in Browser A
4. Check Browser B

**Expected:**
- Both sessions work independently
- Changes reflect in both (if real-time)

---

## 2. User Registration & Profile

### Test 2.1: Profile Creation on First Login
**Steps:**
1. Register new user
2. Log in for first time

**Expected:**
- Profile automatically created
- Balance = 0
- Username = email prefix (before @)

---

### Test 2.2: View Profile
**Steps:**
1. Log in
2. Click profile icon
3. Navigate to Profile page

**Expected:**
- Profile page displays:
  - Username
  - Email
  - Balance
  - Join date
  - Edit username option

---

### Test 2.3: Update Username
**Steps:**
1. Navigate to Profile page
2. Change username
3. Click "Save"

**Expected:**
- Username updated
- Success message displayed
- New username visible in navigation

---

### Test 2.4: Username Uniqueness
**Steps:**
1. User 1 sets username: "testuser"
2. User 2 tries to set username: "testuser"

**Expected:**
- User 2 gets error: "Username already taken"
- Username not updated

---

### Test 2.5: Profile Balance Display
**Steps:**
1. View profile page
2. Check balance displayed

**Expected:**
- Balance matches wallet balance
- Currency formatted correctly (₦ for NGN)
- Balance updates after transactions

---

### Test 2.6: Initial Balance
**Steps:**
1. Register new user
2. Check profile balance

**Expected:**
- Balance = 0 (not 1000)
- No initial credit

---

### Test 2.7: Profile Persistence
**Steps:**
1. Update profile
2. Log out
3. Log back in

**Expected:**
- Profile changes persisted
- All data intact

---

### Test 2.8: Profile Image (if implemented)
**Steps:**
1. Navigate to profile
2. Upload avatar image

**Expected:**
- Image uploaded successfully
- Avatar visible in navigation
- Image persists after logout/login

---

### Test 2.9: Profile Data Caching
**Steps:**
1. View profile page
2. Navigate away
3. Navigate back to profile

**Expected:**
- Profile loads instantly from cache
- Data refreshes in background if stale

---

### Test 2.10: Profile Error Handling
**Steps:**
1. Disconnect internet
2. Try to update profile

**Expected:**
- Error message displayed
- User notified of connection issue

---

## 3. Wager Creation

### Test 3.1: Create Basic Wager
**Steps:**
1. Log in
2. Navigate to "Create Wager"
3. Fill in:
   - Title: "Test Wager"
   - Side A: "Option A"
   - Side B: "Option B"
   - Amount: 100
4. Click "Create Wager"

**Expected:**
- Wager created successfully
- Redirected to wager detail page
- Wager visible on home page
- Balance deducted by entry amount

---

### Test 3.2: Create Wager with Deadline
**Steps:**
1. Navigate to "Create Wager"
2. Fill in all required fields
3. Set deadline (future date)
4. Create wager

**Expected:**
- Wager created with deadline
- Deadline displayed on wager card
- Countdown timer visible (if implemented)

---

### Test 3.3: Create Wager with Category
**Steps:**
1. Navigate to "Create Wager"
2. Select category (e.g., "Sports")
3. Fill in other fields
4. Create wager

**Expected:**
- Wager created with category
- Category badge visible on wager card
- Wager appears in category filter

---

### Test 3.4: Create Wager with Tags
**Steps:**
1. Navigate to "Create Wager"
2. Add tags: "football", "premier-league"
3. Create wager

**Expected:**
- Tags saved with wager
- Tags visible on wager detail page
- Wager filterable by tags

---

### Test 3.5: Create Private Wager
**Steps:**
1. Navigate to "Create Wager"
2. Set visibility to "Private"
3. Create wager

**Expected:**
- Wager created as private
- Only visible to creator
- Not visible on public home page

---

### Test 3.6: Create Wager - Insufficient Balance
**Steps:**
1. Ensure balance < 100
2. Navigate to "Create Wager"
3. Set amount: 100
4. Try to create

**Expected:**
- Error: "Insufficient balance"
- Wager not created
- Balance not deducted

---

### Test 3.7: Create Wager - Missing Required Fields
**Steps:**
1. Navigate to "Create Wager"
2. Leave title empty
3. Try to create

**Expected:**
- Validation error displayed
- Wager not created
- Field highlighted

---

### Test 3.8: Create Wager - Invalid Amount
**Steps:**
1. Navigate to "Create Wager"
2. Enter amount: 0 or negative
3. Try to create

**Expected:**
- Validation error
- Wager not created

---

### Test 3.9: Create Wager - Past Deadline
**Steps:**
1. Navigate to "Create Wager"
2. Set deadline to past date
3. Try to create

**Expected:**
- Validation error
- Wager not created
- Error: "Deadline must be in the future"

---

### Test 3.10: Create Wager - Long Title
**Steps:**
1. Navigate to "Create Wager"
2. Enter very long title (500+ characters)
3. Try to create

**Expected:**
- Either truncated or validation error
- Check database constraints

---

### Test 3.11: Create Wager - Special Characters
**Steps:**
1. Navigate to "Create Wager"
2. Use special characters in title: `!@#$%^&*()`
3. Create wager

**Expected:**
- Wager created successfully
- Special characters displayed correctly
- No XSS vulnerabilities

---

### Test 3.12: Create Wager - Mobile View
**Steps:**
1. Open on mobile device
2. Navigate to "Create Wager"
3. Fill form and create

**Expected:**
- Form is mobile-friendly
- All fields accessible
- Submit button works
- No horizontal scrolling

---

### Test 3.13: Create Wager - Currency Display
**Steps:**
1. Create wager with amount: 1000
2. View wager card

**Expected:**
- Amount displayed with currency symbol
- Format: ₦1,000 or similar

---

### Test 3.14: Create Wager - Description Field
**Steps:**
1. Navigate to "Create Wager"
2. Add description (optional field)
3. Create wager

**Expected:**
- Description saved
- Description visible on detail page
- Description optional (can be empty)

---

### Test 3.15: Create Wager - Duplicate Prevention
**Steps:**
1. Create wager with title: "Test"
2. Try to create another wager with same title

**Expected:**
- Second wager can be created (titles can be duplicate)
- OR if duplicate prevention exists, appropriate error

---

### Test 3.16: Create Wager - Real-time Updates
**Steps:**
1. Create wager
2. Open wager in another browser (as different user)
3. Check if wager appears

**Expected:**
- Wager appears in real-time (if real-time enabled)
- OR appears after refresh

---

### Test 3.17: Create Wager - Creator Auto-Join
**Steps:**
1. Create wager
2. Check if creator automatically joined

**Expected:**
- Creator may or may not auto-join (check requirements)
- If auto-join: Entry created for creator
- Balance deducted

---

### Test 3.18: Create Wager - System Wager Badge
**Steps:**
1. Check system-generated wagers on home page

**Expected:**
- System wagers have "Auto" or system badge
- User-created wagers don't have badge

---

### Test 3.19: Create Wager - Form Validation
**Steps:**
1. Navigate to "Create Wager"
2. Test each field validation:
   - Empty title
   - Empty side A
   - Empty side B
   - Zero amount
   - Negative amount

**Expected:**
- Appropriate validation errors for each
- Form doesn't submit with errors

---

### Test 3.20: Create Wager - Cancel/Back
**Steps:**
1. Navigate to "Create Wager"
2. Fill some fields
2. Click back or cancel

**Expected:**
- Navigate away without saving
- No data persisted
- No balance deducted

---

## 4. Wager Participation

### Test 4.1: Join Wager - Side A
**Steps:**
1. View wager detail page
2. Click "Join" button
3. Select "Side A"
4. Confirm

**Expected:**
- Entry created
- Balance deducted
- Participant count updated
- Potential returns updated
- Notification sent to creator

---

### Test 4.2: Join Wager - Side B
**Steps:**
1. View wager detail page
2. Click "Join" button
3. Select "Side B"
4. Confirm

**Expected:**
- Entry created for Side B
- Balance deducted
- Side B count/total updated

---

### Test 4.3: Join Wager - Insufficient Balance
**Steps:**
1. Ensure balance < wager amount
2. Try to join wager

**Expected:**
- Error: "Insufficient balance"
- Entry not created
- Balance not deducted

---

### Test 4.4: Join Wager - Already Joined
**Steps:**
1. Join a wager
2. Try to join same wager again

**Expected:**
- Error: "You have already joined this wager"
- OR button disabled
- No duplicate entry

---

### Test 4.5: Join Wager - After Deadline
**Steps:**
1. Find wager with past deadline
2. Try to join

**Expected:**
- Error: "Wager deadline has passed"
- Join button disabled
- Entry not created

---

### Test 4.6: Join Wager - Resolved Wager
**Steps:**
1. Find resolved wager
2. Try to join

**Expected:**
- Join button disabled
- Error message if clicked
- Entry not created

---

### Test 4.7: Join Wager - Unauthenticated
**Steps:**
1. Log out
2. Try to join wager

**Expected:**
- Auth modal appears
- Must login first
- After login, can join

---

### Test 4.8: Join Wager - Multiple Users
**Steps:**
1. User 1 joins Side A
2. User 2 joins Side A
3. User 3 joins Side B

**Expected:**
- All entries created
- Counts updated correctly
- Totals calculated correctly
- Potential returns updated for all

---

### Test 4.9: Join Wager - Potential Returns Calculation
**Steps:**
1. Create wager with amount: 100
2. User 1 joins Side A with 100
3. User 2 joins Side B with 200
4. Check potential returns for User 1

**Expected:**
- Side A total: 100
- Side B total: 200
- User 1 potential return calculated correctly
- Platform fee (1%) deducted from calculation
- Multiplier and percentage displayed

---

### Test 4.10: Join Wager - Real-time Updates
**Steps:**
1. User 1 views wager detail
2. User 2 joins wager (in another browser)
3. Check User 1's view

**Expected:**
- Participant count updates in real-time
- Potential returns update
- New entry visible (if entries list shown)

---

### Test 4.11: Join Wager - Transaction Record
**Steps:**
1. Join a wager
2. Check wallet transactions

**Expected:**
- Transaction created with type: "wager_join"
- Amount: negative (deducted)
- Description: "Joined wager: [wager title]"
- Reference: wager entry ID

---

### Test 4.12: Join Wager - Notification to Creator
**Steps:**
1. User 1 creates wager
2. User 2 joins wager
3. Check User 1's notifications

**Expected:**
- Notification created for User 1
- Type: "wager_joined"
- Link to wager detail page
- Unread count increased

---

### Test 4.13: Join Wager - Balance Update
**Steps:**
1. Note current balance
2. Join wager with amount: 50
3. Check balance

**Expected:**
- Balance decreased by 50
- Balance updated immediately
- Transaction reflected

---

### Test 4.14: Join Wager - Wager Status Check
**Steps:**
1. Find OPEN wager
2. Join it
3. Check wager status remains OPEN

**Expected:**
- Status remains "OPEN"
- Can still join (if not already joined)

---

### Test 4.15: Join Wager - Entry Amount Validation
**Steps:**
1. Try to join with amount less than wager amount
2. Try to join with amount more than wager amount

**Expected:**
- Entry amount must equal wager amount
- OR if variable amounts allowed, validate appropriately

---

### Test 4.16: View Wager Detail - All Information
**Steps:**
1. Navigate to wager detail page

**Expected:**
- Title and description visible
- Both sides displayed
- Entry amount shown
- Deadline displayed
- Participant counts for both sides
- Total amounts for both sides
- Potential returns for both sides
- Platform fee information
- Creator information
- Join button (if eligible)

---

### Test 4.17: View Wager Detail - Participants List
**Steps:**
1. Navigate to wager with multiple participants
2. Check participants section

**Expected:**
- List of participants visible
- Side A and Side B participants shown
- Amounts displayed
- User information displayed

---

### Test 4.18: View Wager Detail - Potential Returns Display
**Steps:**
1. View wager with participants
2. Check potential returns section

**Expected:**
- Side A potential return:
  - Multiplier (e.g., 2.5x)
  - Percentage (e.g., +150%)
  - Exact winning amount
- Side B potential return:
  - Multiplier
  - Percentage
  - Exact winning amount
- Calculations based on actual bet amounts

---

### Test 4.19: View Wager Detail - Expired Wager
**Steps:**
1. Navigate to expired wager
2. Check detail page

**Expected:**
- Deadline passed message
- Join button disabled
- Status visible
- If resolved: Winning side highlighted

---

### Test 4.20: View Wager Detail - Resolved Wager
**Steps:**
1. Navigate to resolved wager
2. Check detail page

**Expected:**
- Status: "RESOLVED"
- Winning side highlighted
- Winners displayed
- Winnings distributed (check balances)

---

### Test 4.21: Delete Wager - Creator Only
**Steps:**
1. User 1 creates wager
2. User 2 tries to delete wager

**Expected:**
- Delete button not visible to User 2
- OR error if attempted

---

### Test 4.22: Delete Wager - With Participants
**Steps:**
1. Create wager
2. Another user joins
3. Try to delete as creator

**Expected:**
- Delete button disabled
- OR error: "Cannot delete wager with participants"

---

### Test 4.23: Delete Wager - No Participants
**Steps:**
1. Create wager
2. Ensure no other participants
3. Click delete
4. Confirm in dialog

**Expected:**
- Confirmation dialog appears
- Wager deleted after confirmation
- Redirected to home page
- Wager no longer visible

---

### Test 4.24: Delete Wager - Confirmation Dialog
**Steps:**
1. Click delete button
2. Click "Cancel" in dialog

**Expected:**
- Dialog closes
- Wager not deleted
- Remains on detail page

---

### Test 4.25: Join Wager - Mobile Experience
**Steps:**
1. Open wager detail on mobile
2. Join wager

**Expected:**
- Mobile-friendly layout
- Join button accessible
- All information visible
- Smooth experience

---

## 5. Payment & Wallet

### Test 5.1: View Wallet Page
**Steps:**
1. Log in
2. Navigate to Wallet page

**Expected:**
- Current balance displayed
- Deposit section visible
- Transaction history visible
- All transactions listed

---

### Test 5.2: Deposit - Minimum Amount
**Steps:**
1. Navigate to Wallet
2. Enter amount: 50 (less than minimum)
3. Click "Deposit"

**Expected:**
- Error: "Minimum deposit is ₦100"
- Payment not initialized

---

### Test 5.3: Deposit - Valid Amount
**Steps:**
1. Navigate to Wallet
2. Enter amount: 1000
3. Click "Deposit"

**Expected:**
- Paystack checkout opens
- Payment initialized
- Redirected to Paystack

---

### Test 5.4: Deposit - Successful Payment
**Steps:**
1. Initiate deposit: 1000
2. Use test card: 4084084084084081
3. Complete payment on Paystack

**Expected:**
- Payment successful
- Redirected back to wallet
- Balance increased by 1000
- Transaction recorded
- Success message displayed

---

### Test 5.5: Deposit - Failed Payment
**Steps:**
1. Initiate deposit
2. Use declined card: 5060666666666666666
3. Complete payment

**Expected:**
- Payment failed
- Error message displayed
- Balance not updated
- Transaction may or may not be recorded (check requirements)

---

### Test 5.6: Deposit - Webhook Verification
**Steps:**
1. Complete successful deposit
2. Check server logs/webhook handler

**Expected:**
- Webhook received from Paystack
- Payment verified
- Balance updated (if not already)
- Transaction recorded

---

### Test 5.7: Transaction History - Display
**Steps:**
1. Navigate to Wallet
2. Check transaction history

**Expected:**
- All transactions listed
- Sorted by date (newest first)
- Type displayed
- Amount displayed (with +/-)
- Description displayed
- Date/time displayed

---

### Test 5.8: Transaction History - Types
**Steps:**
1. Perform various actions:
   - Deposit
   - Join wager
   - Win wager
   - Get refund
2. Check transaction history

**Expected:**
- Deposit: type "deposit", positive amount
- Join: type "wager_join", negative amount
- Win: type "wager_win", positive amount
- Refund: type "wager_refund", positive amount
- All have descriptions

---

### Test 5.9: Transaction History - Filtering
**Steps:**
1. Navigate to Wallet
2. Check if filtering options exist

**Expected:**
- If filters exist: Test each filter
- Transactions filtered correctly

---

### Test 5.10: Balance Update - Real-time
**Steps:**
1. Note current balance
2. Complete deposit
3. Check balance immediately

**Expected:**
- Balance updated immediately
- No refresh needed
- Accurate balance displayed

---

### Test 5.11: Balance Update - After Wager Join
**Steps:**
1. Note balance
2. Join wager (amount: 100)
3. Check balance

**Expected:**
- Balance decreased by 100
- Updated immediately

---

### Test 5.12: Balance Update - After Wager Win
**Steps:**
1. Join wager
2. Win wager (after settlement)
3. Check balance

**Expected:**
- Balance increased by winnings
- Transaction recorded
- Description shows wager details

---

### Test 5.13: Deposit - Payment Verification
**Steps:**
1. Complete deposit
2. Check payment verification endpoint called

**Expected:**
- Payment verified with Paystack API
- Verification happens automatically
- Balance updated after verification

---

### Test 5.14: Deposit - Payment Reference
**Steps:**
1. Complete deposit
2. Check transaction record

**Expected:**
- Transaction has reference field
- Reference matches Paystack transaction reference
- Reference can be used for tracking

---

### Test 5.15: Wallet - Caching
**Steps:**
1. View wallet page
2. Navigate away
3. Navigate back

**Expected:**
- Wallet loads from cache (instant)
- Data refreshes in background if stale
- Balance accurate

---

### Test 5.16: Deposit - Invalid Amount
**Steps:**
1. Try to deposit: 0
2. Try to deposit: negative amount
3. Try to deposit: non-numeric

**Expected:**
- Validation errors
- Payment not initialized

---

### Test 5.17: Deposit - Large Amount
**Steps:**
1. Try to deposit: 1,000,000

**Expected:**
- Payment initialized (if valid)
- OR validation error if limit exists

---

### Test 5.18: Transaction History - Pagination
**Steps:**
1. Create many transactions
2. Check transaction history

**Expected:**
- If pagination exists: Test pagination
- All transactions accessible
- Performance acceptable

---

### Test 5.19: Wallet - Currency Display
**Steps:**
1. View wallet page
2. Check currency formatting

**Expected:**
- Amounts formatted with currency symbol
- Thousands separators
- Decimal places if applicable

---

### Test 5.20: Deposit - Payment Cancellation
**Steps:**
1. Initiate deposit
2. Cancel on Paystack page

**Expected:**
- Redirected back to wallet
- Balance not updated
- No transaction recorded
- Error message (if applicable)

---

## 6. Notifications

### Test 6.1: Notification - Wager Joined
**Steps:**
1. User 1 creates wager
2. User 2 joins wager
3. Check User 1's notifications

**Expected:**
- Notification created for User 1
- Type: "wager_joined"
- Title and message appropriate
- Link to wager detail page
- Unread count increased

---

### Test 6.2: Notification - Wager Resolved (Win)
**Steps:**
1. User joins wager on winning side
2. Admin resolves wager (winning side = user's side)
3. Check user's notifications

**Expected:**
- Notification created
- Type: "wager_resolved"
- Indicates win
- Link to wager detail
- Unread count increased

---

### Test 6.3: Notification - Wager Resolved (Loss)
**Steps:**
1. User joins wager on losing side
2. Admin resolves wager
3. Check user's notifications

**Expected:**
- Notification created
- Indicates loss
- Appropriate message

---

### Test 6.4: Notification - Wager Refunded
**Steps:**
1. User joins wager
2. Wager refunded (single participant)
3. Check notifications

**Expected:**
- Notification created
- Type: "wager_refund"
- Refund amount mentioned

---

### Test 6.5: View Notifications Page
**Steps:**
1. Navigate to Notifications page

**Expected:**
- All notifications listed
- Sorted by date (newest first)
- Unread notifications highlighted
- Read/unread status visible

---

### Test 6.6: Mark Notification as Read
**Steps:**
1. Navigate to Notifications
2. Click on unread notification

**Expected:**
- Notification marked as read
- Unread count decreased
- Notification no longer highlighted

---

### Test 6.7: Mark All as Read
**Steps:**
1. Navigate to Notifications
2. Click "Mark All as Read"

**Expected:**
- All notifications marked as read
- Unread count = 0
- All notifications no longer highlighted

---

### Test 6.8: Delete Notification
**Steps:**
1. Navigate to Notifications
2. Delete a notification

**Expected:**
- Notification removed
- No longer visible in list
- Count updated

---

### Test 6.9: Notification - Click Link
**Steps:**
1. Click on notification with link
2. Check navigation

**Expected:**
- Navigated to linked page (e.g., wager detail)
- Notification marked as read (if applicable)

---

### Test 6.10: Notification - Real-time Updates
**Steps:**
1. User 1 has notifications page open
2. User 2 performs action that creates notification for User 1
3. Check User 1's notifications page

**Expected:**
- New notification appears in real-time
- Unread count updates
- No refresh needed

---

### Test 6.11: Notification Bell - Unread Count
**Steps:**
1. Check notification bell in navigation
2. Create notification for user
3. Check bell again

**Expected:**
- Unread count badge visible
- Count accurate
- Updates in real-time

---

### Test 6.12: Notification - Empty State
**Steps:**
1. Delete all notifications
2. View notifications page

**Expected:**
- Empty state message
- "No notifications" or similar
- UI looks good

---

### Test 6.13: Notification - Pagination
**Steps:**
1. Create many notifications
2. Check notifications page

**Expected:**
- If pagination exists: Test pagination
- All notifications accessible

---

### Test 6.14: Notification - Filtering
**Steps:**
1. Check if notification filtering exists
2. Test filters (if available)

**Expected:**
- Filters work correctly
- Notifications filtered appropriately

---

### Test 6.15: Notification - Performance
**Steps:**
1. Create 100+ notifications
2. Load notifications page

**Expected:**
- Page loads in reasonable time
- Performance acceptable
- No lag or freezing

---

## 7. Admin Panel

### Test 7.1: Admin Dashboard - Access
**Steps:**
1. Log in as admin
2. Navigate to `/admin`

**Expected:**
- Dashboard loads
- Statistics displayed:
  - Total users
  - Total wagers
  - Open wagers
  - Resolved wagers
  - Total transactions
  - Total volume
- Recent wagers table
- Recent transactions table

---

### Test 7.2: Admin Dashboard - Statistics Accuracy
**Steps:**
1. View admin dashboard
2. Manually count users, wagers, etc.
3. Compare with displayed stats

**Expected:**
- Statistics accurate
- Match actual counts

---

### Test 7.3: Admin Users Page - Display
**Steps:**
1. Navigate to `/admin/users`

**Expected:**
- Table of all users displayed
- Columns:
  - Email
  - Balance
  - Role (Admin/User)
  - Join Date
- Data accurate

---

### Test 7.4: Admin Users Page - Email Display
**Steps:**
1. View admin users page
2. Check email column

**Expected:**
- All emails displayed (not "N/A")
- Emails fetched from auth.users
- Accurate data

---

### Test 7.5: Admin Users Page - Sorting
**Steps:**
1. Check if sorting available
2. Test sorting by each column

**Expected:**
- Sorting works correctly
- Data sorted appropriately

---

### Test 7.6: Admin Wagers Page - Display
**Steps:**
1. Navigate to `/admin/wagers`

**Expected:**
- Table of all wagers
- Columns:
  - Title
  - Status
  - Amount
  - Category
  - Deadline
  - Actions
- All wagers visible

---

### Test 7.7: Admin Wagers - Resolve Wager
**Steps:**
1. Navigate to `/admin/wagers`
2. Find OPEN wager
3. Click "Resolve"
4. Select winning side (A or B)
5. Confirm

**Expected:**
- Wager resolved
- Status updated to RESOLVED
- Winnings distributed
- Notifications sent
- Success message displayed

---

### Test 7.8: Admin Wagers - Resolve Wager (No Participants)
**Steps:**
1. Find wager with no participants
2. Try to resolve

**Expected:**
- Wager resolved
- Status updated
- Refund handled appropriately

---

### Test 7.9: Admin Transactions Page - Display
**Steps:**
1. Navigate to `/admin/transactions`

**Expected:**
- Table of all transactions
- Columns:
  - Type
  - Amount
  - Description
  - User ID
  - Date
- All transactions visible

---

### Test 7.10: Admin Transactions - Filtering
**Steps:**
1. Check if filtering available
2. Test filters (if available)

**Expected:**
- Filters work correctly
- Transactions filtered appropriately

---

### Test 7.11: Admin Sidebar - Navigation
**Steps:**
1. Log in as admin
2. Test all sidebar links:
   - Dashboard
   - Users
   - Wagers
   - Transactions
   - Logout

**Expected:**
- All links work
- Navigation smooth
- Active page highlighted

---

### Test 7.12: Admin Sidebar - Mobile
**Steps:**
1. Open admin panel on mobile
2. Test sidebar

**Expected:**
- Mobile-friendly sidebar
- Hamburger menu (if applicable)
- All links accessible

---

### Test 7.13: Admin - Cache Invalidation
**Steps:**
1. View admin dashboard
2. Resolve a wager
3. Check dashboard updates

**Expected:**
- Cache invalidated
- Dashboard refreshes
- Updated data displayed

---

### Test 7.14: Admin - Unauthorized Access
**Steps:**
1. Log in as regular user
2. Try to access `/admin`
3. Try to access `/admin/users`

**Expected:**
- Redirected to `/admin/login`
- Access denied message
- Cannot access admin routes

---

### Test 7.15: Admin - Data Tables
**Steps:**
1. Check each admin data table:
   - Users
   - Wagers
   - Transactions

**Expected:**
- Tables display correctly
- Data accurate
- Pagination works (if applicable)
- Sorting works (if applicable)

---

### Test 7.16: Admin - Recent Wagers Link
**Steps:**
1. View admin dashboard
2. Click on recent wager

**Expected:**
- Navigated to wager detail page
- OR navigated to admin wagers page with filter

---

### Test 7.17: Admin - Recent Transactions Link
**Steps:**
1. View admin dashboard
2. Click on recent transaction

**Expected:**
- Navigated to transactions page
- OR transaction details shown

---

### Test 7.18: Admin - Logout
**Steps:**
1. Log in as admin
2. Click logout in sidebar
3. Confirm

**Expected:**
- Logged out
- Redirected to home page
- Cannot access admin routes

---

### Test 7.19: Admin - Wager Deletion
**Steps:**
1. Navigate to admin wagers
2. Delete a wager (if allowed)

**Expected:**
- Wager deleted
- Removed from list
- Related entries handled appropriately

---

### Test 7.20: Admin - User Search
**Steps:**
1. Check if user search exists
2. Test search functionality

**Expected:**
- Search works (if implemented)
- Results accurate

---

### Test 7.21: Admin - Wager Search
**Steps:**
1. Check if wager search exists
2. Test search functionality

**Expected:**
- Search works (if implemented)
- Results accurate

---

### Test 7.22: Admin - Statistics Refresh
**Steps:**
1. View admin dashboard
2. Perform action that changes stats (e.g., create user)
3. Refresh dashboard

**Expected:**
- Statistics updated
- Accurate counts

---

### Test 7.23: Admin - Bulk Actions
**Steps:**
1. Check if bulk actions exist
2. Test bulk actions (if available)

**Expected:**
- Bulk actions work (if implemented)
- Appropriate feedback

---

### Test 7.24: Admin - Export Data
**Steps:**
1. Check if export functionality exists
2. Test export (if available)

**Expected:**
- Export works (if implemented)
- Data exported correctly

---

### Test 7.25: Admin - Performance
**Steps:**
1. Create many users, wagers, transactions
2. Load admin pages

**Expected:**
- Pages load in reasonable time
- Performance acceptable
- No lag with large datasets

---

## 8. Automated Systems

### Test 8.1: Automatic Settlement - Expired Wager
**Steps:**
1. Create wager with deadline in past
2. Set winning side
3. Wait for cron job (or trigger manually)
4. Check wager status

**Expected:**
- Wager settled automatically
- Status = RESOLVED
- Winnings distributed
- Notifications sent

---

### Test 8.2: Automatic Settlement - No Winning Side
**Steps:**
1. Create wager with past deadline
2. Don't set winning side
3. Wait for cron job

**Expected:**
- Wager remains OPEN
- Not settled (requires winning side)

---

### Test 8.3: Automatic Settlement - Single Participant
**Steps:**
1. Create wager
2. One user joins
3. Set deadline in past
4. Wait for cron job

**Expected:**
- Wager refunded automatically
- Status = REFUNDED
- Participant refunded
- Notification sent

---

### Test 8.4: System Wager Generation
**Steps:**
1. Trigger system wager generation cron
2. Check home page

**Expected:**
- New system wagers created
- Wagers have "Auto" badge
- Categories appropriate
- Source data stored

---

### Test 8.5: System Wager - Duplicate Prevention
**Steps:**
1. Generate system wagers
2. Generate again immediately

**Expected:**
- Duplicate wagers not created
- Error handled gracefully
- OR wagers created if different enough

---

### Test 8.6: Cron Job - Authentication
**Steps:**
1. Try to call cron endpoint without auth header

**Expected:**
- 401 Unauthorized
- Error message

---

### Test 8.7: Cron Job - Valid Auth
**Steps:**
1. Call cron endpoint with valid CRON_SECRET

**Expected:**
- 200 OK
- Job executed
- Success response

---

### Test 8.8: Settlement - Platform Fee
**Steps:**
1. Create wager with participants
2. Settle wager
3. Check total pool vs. winnings distributed

**Expected:**
- Platform fee (1%) deducted
- Winnings = (Total Pool - Fee) distributed
- Fee calculation accurate

---

### Test 8.9: Settlement - Proportional Distribution
**Steps:**
1. Create wager
2. User 1 joins Side A with 100
3. User 2 joins Side A with 200
4. User 3 joins Side B with 300
5. Settle with Side A winning

**Expected:**
- Total Side A: 300
- Total Side B: 300
- Pool: 600
- Fee: 6 (1%)
- Winnings: 594
- User 1 gets: 198 (1/3 of 594)
- User 2 gets: 396 (2/3 of 594)
- User 3 gets: 0

---

### Test 8.10: Automated Systems - Error Handling
**Steps:**
1. Simulate error in settlement
2. Check error handling

**Expected:**
- Error logged
- System continues
- Wager status appropriate
- No data corruption

---

## 9. UI/UX & Responsiveness

### Test 9.1: Home Page - Layout
**Steps:**
1. Navigate to home page

**Expected:**
- Clean, organized layout
- Wager cards displayed
- Navigation visible
- Footer visible (if applicable)

---

### Test 9.2: Home Page - Mobile View
**Steps:**
1. Open home page on mobile device

**Expected:**
- Mobile-friendly layout
- Wager cards stack vertically
- Navigation accessible
- No horizontal scrolling
- Touch-friendly buttons

---

### Test 9.3: Home Page - Desktop View
**Steps:**
1. Open home page on desktop

**Expected:**
- Desktop-optimized layout
- Wager cards in grid
- Sidebar visible
- Good use of space

---

### Test 9.4: Wager Card - Information Display
**Steps:**
1. View wager card on home page

**Expected:**
- Title visible
- Category badge
- Entry amount
- Participant count
- Deadline/time remaining
- Potential return (if applicable)
- Status indicator

---

### Test 9.5: Navigation - All Links
**Steps:**
1. Test all navigation links:
   - Home
   - Create
   - Wallet
   - Notifications
   - Profile

**Expected:**
- All links work
- Navigation smooth
- Active page highlighted

---

### Test 9.6: Loading States
**Steps:**
1. Navigate between pages
2. Check loading indicators

**Expected:**
- Loading skeletons/spinners shown
- No blank screens
- Smooth transitions

---

### Test 9.7: Error Messages
**Steps:**
1. Trigger various errors
2. Check error messages

**Expected:**
- Error messages clear and helpful
- User-friendly language
- Actionable (if applicable)

---

### Test 9.8: Success Messages
**Steps:**
1. Perform successful actions
2. Check success messages

**Expected:**
- Success toasts/messages displayed
- Clear confirmation
- Appropriate timing

---

### Test 9.9: Form Validation - Visual
**Steps:**
1. Fill forms with invalid data
2. Check validation display

**Expected:**
- Fields highlighted in red
- Error messages near fields
- Clear indication of issues

---

### Test 9.10: Confirmation Dialogs
**Steps:**
1. Perform actions requiring confirmation:
   - Delete wager
   - Logout

**Expected:**
- Confirmation dialog appears
- Clear message
- Cancel and Confirm buttons
- Cancel works
- Confirm works

---

### Test 9.11: Responsive Design - Breakpoints
**Steps:**
1. Test on various screen sizes:
   - Mobile (375px)
   - Tablet (768px)
   - Desktop (1024px, 1920px)

**Expected:**
- Layout adapts appropriately
- No overflow issues
- All content accessible

---

### Test 9.12: Dark Mode (if implemented)
**Steps:**
1. Toggle dark mode
2. Check all pages

**Expected:**
- Dark mode works
- All pages themed
- Contrast acceptable
- Text readable

---

### Test 9.13: Accessibility - Keyboard Navigation
**Steps:**
1. Navigate using only keyboard
2. Test tab order
3. Test form inputs

**Expected:**
- All interactive elements accessible
- Logical tab order
- Focus indicators visible

---

### Test 9.14: Accessibility - Screen Reader
**Steps:**
1. Use screen reader
2. Navigate pages

**Expected:**
- All content announced
- Buttons/links labeled
- Forms accessible

---

### Test 9.15: PWA - Install Prompt
**Steps:**
1. Visit site on mobile
2. Check for install prompt

**Expected:**
- Install prompt appears (if PWA enabled)
- Can install as app
- App icon on home screen

---

## 10. Performance & Caching

### Test 10.1: Page Load - First Visit
**Steps:**
1. Clear cache
2. Load home page
3. Measure load time

**Expected:**
- Page loads in < 3 seconds
- Acceptable performance

---

### Test 10.2: Page Load - Cached
**Steps:**
1. Visit page
2. Navigate away
3. Navigate back

**Expected:**
- Page loads instantly from cache
- Data appears immediately
- Background refresh if stale

---

### Test 10.3: Cache - Stale Data Refresh
**Steps:**
1. View page (cached)
2. Wait for cache to become stale
3. Check background refresh

**Expected:**
- Cached data shown immediately
- Fresh data fetched in background
- UI updates when fresh data arrives

---

### Test 10.4: API Calls - Reduction
**Steps:**
1. Navigate between pages multiple times
2. Check network tab

**Expected:**
- Fewer API calls due to caching
- No unnecessary refetches
- Efficient data usage

---

### Test 10.5: Service Worker - Offline
**Steps:**
1. Load site
2. Go offline
3. Try to navigate

**Expected:**
- Cached pages work offline
- Offline message shown (if applicable)
- Graceful degradation

---

### Test 10.6: Service Worker - Update
**Steps:**
1. Load site
2. Update service worker
3. Check update behavior

**Expected:**
- Service worker updates
- New version activated
- No breaking changes

---

### Test 10.7: Image Loading
**Steps:**
1. Check image loading on pages

**Expected:**
- Images lazy-loaded
- Placeholders shown
- Smooth loading

---

### Test 10.8: Bundle Size
**Steps:**
1. Check bundle size in build output

**Expected:**
- Bundle size reasonable
- Code splitting working
- No unnecessary large dependencies

---

### Test 10.9: Memory Usage
**Steps:**
1. Use application for extended period
2. Check memory usage

**Expected:**
- No memory leaks
- Memory usage stable
- Performance doesn't degrade

---

### Test 10.10: Cache Invalidation
**Steps:**
1. Perform action that changes data
2. Check if cache invalidated
3. Verify fresh data loaded

**Expected:**
- Cache invalidated appropriately
- Fresh data fetched
- UI updated correctly

---

## 11. Error Handling

### Test 11.1: Network Error
**Steps:**
1. Disconnect internet
2. Try to perform action

**Expected:**
- Error message displayed
- User notified
- Graceful handling

---

### Test 11.2: API Error - 500
**Steps:**
1. Simulate server error
2. Try to perform action

**Expected:**
- Error message displayed
- User-friendly message
- No technical details exposed

---

### Test 11.3: API Error - 404
**Steps:**
1. Navigate to non-existent wager
2. Check error page

**Expected:**
- 404 page displayed
- Helpful message
- Link back to home

---

### Test 11.4: Validation Error
**Steps:**
1. Submit form with invalid data
2. Check error handling

**Expected:**
- Validation errors displayed
- Form not submitted
- User can correct

---

### Test 11.5: Payment Error
**Steps:**
1. Initiate payment
2. Simulate payment failure

**Expected:**
- Error message displayed
- User notified
- No balance deducted
- Can retry

---

### Test 11.6: Database Error
**Steps:**
1. Simulate database error
2. Try to perform action

**Expected:**
- Error handled gracefully
- User notified
- System doesn't crash

---

### Test 11.7: Timeout Error
**Steps:**
1. Simulate slow network
2. Trigger timeout

**Expected:**
- Timeout handled
- User notified
- Can retry

---

### Test 11.8: Concurrent Modification
**Steps:**
1. Two users modify same data simultaneously
2. Check conflict handling

**Expected:**
- Conflict detected
- Appropriate error
- User can retry

---

### Test 11.9: Invalid Input - XSS
**Steps:**
1. Enter script tags in forms
2. Submit

**Expected:**
- Input sanitized
- No XSS vulnerabilities
- Scripts not executed

---

### Test 11.10: Error Recovery
**Steps:**
1. Trigger error
2. Try to recover

**Expected:**
- Can retry action
- System recovers
- No data corruption

---

## 12. Security

### Test 12.1: SQL Injection
**Steps:**
1. Try SQL injection in forms
2. Check database

**Expected:**
- Input sanitized
- No SQL injection possible
- Parameterized queries used

---

### Test 12.2: XSS Prevention
**Steps:**
1. Enter malicious scripts in inputs
2. Check output

**Expected:**
- Scripts escaped
- No execution
- Safe rendering

---

### Test 12.3: CSRF Protection
**Steps:**
1. Check CSRF protection

**Expected:**
- CSRF tokens used (if applicable)
- Protection in place

---

### Test 12.4: Authentication Bypass
**Steps:**
1. Try to access protected routes without auth
2. Try to manipulate session

**Expected:**
- Protected routes inaccessible
- Session secure
- Cannot bypass auth

---

### Test 12.5: Authorization Bypass
**Steps:**
1. Try to access admin routes as regular user
2. Try to modify other users' data

**Expected:**
- Access denied
- RLS policies enforced
- Cannot access unauthorized data

---

### Test 12.6: Payment Security
**Steps:**
1. Check payment endpoints
2. Verify webhook signatures

**Expected:**
- Webhooks verified
- Secret keys secure
- No payment manipulation possible

---

### Test 12.7: API Key Security
**Steps:**
1. Check environment variables
2. Check client-side code

**Expected:**
- API keys not exposed in client
- Service role key server-side only
- Secure key management

---

### Test 12.8: Data Validation - Server-side
**Steps:**
1. Try to submit invalid data
2. Check server validation

**Expected:**
- Server validates all inputs
- Invalid data rejected
- No client-side only validation

---

### Test 12.9: Rate Limiting
**Steps:**
1. Make many rapid requests
2. Check rate limiting

**Expected:**
- Rate limiting in place (if implemented)
- Abuse prevented

---

### Test 12.10: Session Security
**Steps:**
1. Check session management
2. Test session expiration

**Expected:**
- Sessions secure
- Expiration works
- Cannot hijack sessions

---

### Test 12.11: Password Security
**Steps:**
1. Check password requirements
2. Check password storage

**Expected:**
- Passwords hashed
- Not stored in plain text
- Strong requirements (if applicable)

---

### Test 12.12: HTTPS Enforcement
**Steps:**
1. Check HTTPS usage

**Expected:**
- HTTPS enforced in production
- No HTTP allowed
- Secure connections

---

### Test 12.13: Input Sanitization
**Steps:**
1. Enter various malicious inputs
2. Check sanitization

**Expected:**
- All inputs sanitized
- No code injection
- Safe data storage

---

### Test 12.14: File Upload Security (if applicable)
**Steps:**
1. Try to upload malicious files
2. Check validation

**Expected:**
- File types validated
- Size limits enforced
- Malicious files rejected

---

### Test 12.15: Admin Access Control
**Steps:**
1. Try various admin actions as regular user
2. Check access control

**Expected:**
- All admin actions protected
- Cannot perform admin operations
- Proper authorization checks

---

## Test Execution Checklist

### Pre-Testing
- [ ] Test environment set up
- [ ] Test accounts created
- [ ] Paystack test account configured
- [ ] Database migrations run
- [ ] Cron jobs configured
- [ ] Environment variables set

### Testing
- [ ] Execute all test cases
- [ ] Document all failures
- [ ] Document all edge cases found
- [ ] Take screenshots of issues
- [ ] Note browser/device used

### Post-Testing
- [ ] Compile test results
- [ ] Create bug reports
- [ ] Prioritize issues
- [ ] Retest fixed issues
- [ ] Sign off on testing

---

## Test Results Template

For each test case, document:
- **Test ID**: (e.g., 1.1)
- **Status**: Pass / Fail / Blocked / Skipped
- **Browser**: Chrome / Firefox / Safari / Mobile
- **Notes**: Any observations
- **Screenshots**: If failed
- **Severity**: Critical / High / Medium / Low

---

## Priority Test Cases (Must Pass)

### Critical
- Authentication (1.1 - 1.6)
- Payment processing (5.1 - 5.5)
- Wager creation (3.1 - 3.3)
- Wager participation (4.1 - 4.3)
- Automatic settlement (8.1 - 8.3)
- Security (12.1 - 12.5)

### High
- Admin panel (7.1 - 7.7)
- Notifications (6.1 - 6.5)
- Wallet management (5.6 - 5.10)
- Error handling (11.1 - 11.5)

### Medium
- UI/UX (9.1 - 9.8)
- Performance (10.1 - 10.5)
- Preferences (if applicable)

### Low
- Edge cases
- Nice-to-have features
- Advanced functionality

---

**Last Updated**: 2024
**Version**: 1.0

