# security_spec.md

## 1. Data Invariants
- **Exhibition Hall Integrity**: A hall size dimensions cannot be negative. Hall dimensions must be within realistic bounds (e.g., width, depth, height > 0).
- **Booth Integrity**: A booth must reside in a valid exhibition hall (referenced via `hallId`). Its dimensions (width, depth, height) must be positive values.
- **Timestamp Integrity**: All modification times (`createdAt`, `updatedAt`) must strictly match `request.time`.
- **Identity Locking**: Booth layout, exhibitor descriptions, and links can only be configured by authenticated exhibition directors, or custom admins.

## 2. The "Dirty Dozen" Payloads
These represent twelve distinct payloads trying to bypass security boundaries that the security rules must reject:

1. **Hall Creation with Negative Dimensions**: Try to create a hall with width `-20m`.
2. **Hall Modification with Extreme Dimensions**: Inject a 10,000,000m depth value to trigger Denial of Wallet resources.
3. **Booth Creation without authenticated session**: Attempting to add a booth with no `auth.uid` credentials.
4. **Booth Creation with orphan `hallId`**: Creating a booth pointing to an invalid/non-existent hall root.
5. **Booth Spoofing**: Registering a booth with a custom company but assigning the `ownerId` to another user's UID.
6. **Immutable field bypass**: Attempting to modify `id` or `hallId` on an existing booth document.
7. **Client timestamp manipulation**: Sending a manual static ISO string format for `createdAt` instead of using the server timestamp primitive.
8. **Null width values**: Creating a booth with `width` or `depth` values specified as `null` or missing while required.
9. **Junk string Injection in ID**: Injecting a 1MB string value into the `{hallId}` parameter to crash rule processing.
10. **Type Mismatch on Color**: Storing an array or number inside the booth `themeColor` field which expects a CSS hex string.
11. **Malicious URL Insertion**: Attempting to set local script tags as `logoUrl`.
12. **Anonymous Admin Escalation**: Trying to invoke an admin-specific edit field without matching privileges.

## 3. Firestore Rules draft
Below we write the Ruleset draft (`DRAFT_firestore.rules`) designed to close these loopholes.
