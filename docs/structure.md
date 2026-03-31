Designing an enterprise-grade authorization system in Node.js requires a strict separation of concerns. You need to separate Identity (who are you?), Permissions (what can you do?), Tenant Isolation (where are you doing it?), and Policies (under what conditions?).

Here is how a system supporting multi-tenancy, multiple roles per user, invites, and blocklisting is structured in a Node.js/Express environment.

1. Directory Structure
   A clean architecture keeps routing, middleware, business logic, and policies strictly separated.

Plaintext
/src
├── /middleware
│ ├── auth.js # Verifies JWT / Identity
│ ├── tenant.js # Validates tenant access & blocklists
│ └── rbac.js # Unpacks permissions (Role-Based Access)
├── /policies
│ └── document.policy.js # Dynamic condition checks (e.g., ownership)
├── /services
│ ├── permission.js # Logic for fetching/caching permissions
│ ├── invite.js # Handles tenant invites
│ └── blocklist.js # Manages banned users/emails
├── /controllers
│ └── document.js # Request handlers
└── /models # DB schemas (User, Tenant, Role, etc.)

2. Permission Unpacking & Caching (Service Layer)
   Before middleware can check permissions, the system needs to unpack a user's multiple roles into a flat array of granular permissions (e.g., ['documents.create', 'documents.read']) for a specific tenant.

JavaScript
// src/services/permission.js
const redis = require('../utils/redis');
const db = require('../models');

async function getUserTenantPermissions(userId, tenantId) {
const cacheKey = `perms:${tenantId}:${userId}`;

// 1. Check Cache first (Critical for performance)
const cachedPerms = await redis.get(cacheKey);
if (cachedPerms) return JSON.parse(cachedPerms);

// 2. Database Lookup: Get all roles the user has in THIS tenant
const userRoles = await db.UserTenantRoles.findAll({
where: { userId, tenantId },
include: ['Role']
});

// 3. Unpack and Flatten Permissions
const permissions = new Set();
for (const userRole of userRoles) {
const rolePerms = await db.RolePermissions.findAll({ where: { roleId: userRole.roleId } });
rolePerms.forEach(p => permissions.add(p.permissionName)); // e.g., 'documents.update'
}

// 4. Merge Direct User Permissions (Overrides)
const directPerms = await db.UserDirectPermissions.findAll({ where: { userId, tenantId } });
directPerms.forEach(p => permissions.add(p.permissionName));

const finalPermissions = Array.from(permissions);

// 5. Cache for future requests
await redis.set(cacheKey, JSON.stringify(finalPermissions), 'EX', 3600); // 1 hour TTL

return finalPermissions;
} 3. The Middleware Pipeline (The Gatekeepers)
When a request comes in, it passes through a gauntlet of middleware. If any step fails, the request is rejected before it ever reaches the business logic.

A. Authentication & Tenant/Blocklist Verification

JavaScript
// src/middleware/tenant.js
const BlocklistService = require('../services/blocklist');

async function verifyTenantAccess(req, res, next) {
const tenantId = req.headers['x-tenant-id'];
const user = req.user; // Set by previous auth middleware

if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });

// 1. Check Global or Tenant Blocklist
const isBlocklisted = await BlocklistService.checkIfBlocked(user.id, user.email, tenantId);
if (isBlocklisted) {
return res.status(403).json({ error: 'User is blocklisted from this tenant' });
}

// 2. Verify Membership
const membership = await db.TenantMembers.findOne({ where: { userId: user.id, tenantId } });
if (!membership) {
return res.status(403).json({ error: 'Not a member of this tenant' });
}

// Attach tenant context to the request
req.tenantId = tenantId;
next();
}
B. Permission Checking (RBAC Middleware)

JavaScript
// src/middleware/rbac.js
const PermissionService = require('../services/permission');

function requirePermission(requiredPermission) {
return async (req, res, next) => {
// Fetch unpacked permissions from cache/DB
const userPermissions = await PermissionService.getUserTenantPermissions(req.user.id, req.tenantId);

    // Super Admin Override or Exact Match
    if (userPermissions.includes('*') || userPermissions.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({ error: `Missing required permission: ${requiredPermission}` });

};
} 4. Policy Management (Business Logic Layer)
Middleware handles static rules (e.g., "Does this user have the documents.update permission?"). Policies handle dynamic rules (e.g., "Is this user the owner of this specific document?").

JavaScript
// src/policies/document.policy.js

class DocumentPolicy {
/\*\*

- Evaluates if the user can update a specific document.
  \*/
  static canUpdate(user, userPermissions, document) {
  // Rule 1: Admins can update any document in the tenant
  if (userPermissions.includes('documents.manage_all')) return true;

  // Rule 2: Department match check
  if (document.departmentId !== user.departmentId) return false;

  // Rule 3: Ownership check
  if (document.authorId === user.id) {
  // Rule 4: State check (e.g., cannot edit published documents)
  return document.status === 'draft';
  }

  return false;

}
}

module.exports = DocumentPolicy; 5. Tying it all together in the Controller
The controller acts as the traffic cop. It relies on the middleware to filter out bad requests, calls the policy to validate the specific resource, and then executes the business logic.

JavaScript
// src/routes/document.routes.js
router.patch('/:id',
authMiddleware,
verifyTenantAccess,
requirePermission('documents.update'),
DocumentController.updateDocument
);

// src/controllers/document.js
const DocumentPolicy = require('../policies/document.policy');
const PermissionService = require('../services/permission');

async function updateDocument(req, res) {
const { id } = req.params;
const { tenantId, user } = req;

// 1. Fetch the resource (Scoped strictly to the tenant!)
const document = await db.Documents.findOne({ where: { id, tenantId } });
if (!document) return res.status(404).json({ error: 'Document not found' });

// 2. Fetch permissions again (usually pulled from `req` if attached in middleware)
const permissions = await PermissionService.getUserTenantPermissions(user.id, tenantId);

// 3. Evaluate the Policy
const isAuthorized = DocumentPolicy.canUpdate(user, permissions, document);
if (!isAuthorized) {
return res.status(403).json({ error: 'Policy strictly prohibits updating this document.' });
}

// 4. Execute Business Logic
await document.update(req.body);

// 5. Audit Logging (Crucial for enterprise)
await db.AuditLogs.create({
tenantId,
userId: user.id,
action: 'documents.update',
resourceId: document.id,
ipAddress: req.ip
});

return res.json(document);
} 6. Handling Invites
Invites straddle the line between Identity and Tenant Management. They usually involve creating a pending record that maps an email to a role within a tenant.

JavaScript
// src/services/invite.js
async function sendInvite(inviter, email, roleId, tenantId) {
// 1. Check if the inviter has 'users.invite' permission

// 2. Check blocklist to ensure the email isn't banned from the tenant
const isBlocked = await BlocklistService.checkIfBlocked(null, email, tenantId);
if (isBlocked) throw new Error("Cannot invite a blocklisted user");

// 3. Create the Invite Record with a token
const invite = await db.Invites.create({
tenantId,
email,
roleId, // The role they will get upon accepting
invitedBy: inviter.id,
token: generateSecureToken(),
expiresAt: Date.now() + (7 _ 24 _ 60 _ 60 _ 1000) // 7 days
});

// 4. Send Email (via queue)
await Queue.add('send-invite-email', { email, token: invite.token });

return invite;
}
