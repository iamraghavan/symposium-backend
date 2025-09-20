// docs/openapi.js
const openapi = {
  openapi: "3.0.3",
  info: {
    title: "EGSPEC Auth API",
    description:
      "Authentication & Admin endpoints using **x-api-key** (global or per-user). " +
      "Admin creation returns a per-user API key (shown once). Login returns stored admin apiKey if available.",
    version: "1.0.0"
  },
  servers: [
    { url: "http://localhost:8000", description: "Local" },
    // add more servers as needed
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Admin Users" },
    { name: "API Keys" }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description:
          "Required for **all** /api/* endpoints. Use either:\n" +
          "- Global key (env: `API_KEY`)\n" +
          "- Per-user key returned on admin user creation/rotation"
      }
    },
    schemas: {
      // ===== Core =====
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "68ce30aa8ac6618c45bfb533" },
          name: { type: "string", example: "EEE Department Admin" },
          email: { type: "string", example: "eeeadmin@egspec.org" },
          role: { type: "string", enum: ["super_admin", "department_admin", "user"] },
          department: { type: "string", nullable: true, example: "68cd4d6b778a4db47873d869" },
          provider: { type: "string", enum: ["local", "google"], example: "local" },
          picture: { type: "string", nullable: true },
          givenName: { type: "string", nullable: true },
          familyName: { type: "string", nullable: true },
          locale: { type: "string", nullable: true },
          emailVerified: { type: "boolean", example: false },
          address: { type: "string", nullable: true },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Unauthorized" },
          code: { type: "string", nullable: true }
        }
      },
      // ===== Auth payloads =====
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "raghavan@egspec.org" },
          password: { type: "string", example: "232003" }
        }
      },
      LoginResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          token: { type: "string", description: "JWT (12h)" },
          user: { $ref: "#/components/schemas/User" },
          apiKey: {
            type: "string",
            nullable: true,
            description: "Returned for admins if stored or newly minted.",
            example: "uk_193f8fbb2bf99e8c494041e67e0aaf8ad299831e"
          }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "John Doe" },
          email: { type: "string", example: "john@example.com" },
          password: { type: "string", example: "secret123" },
          departmentId: { type: "string", nullable: true, example: "68cd4d6b778a4db47873d869" },
          address: { type: "string", nullable: true }
        }
      },
      RegisterResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          token: { type: "string" },
          user: { $ref: "#/components/schemas/User" }
        }
      },
      // ===== Admin user management =====
      CreateUserRequest: {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", example: "EEE Department Admin" },
          email: { type: "string", example: "eeeadmin@egspec.org" },
          password: { type: "string", example: "EEE@123" },
          role: {
            type: "string",
            enum: ["super_admin", "department_admin", "user"],
            example: "department_admin"
          },
          departmentId: { type: "string", nullable: true, example: "68cd4d6b778a4db47873d869" },
          address: { type: "string", nullable: true },
          picture: { type: "string", nullable: true }
        }
      },
      CreateUserResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { $ref: "#/components/schemas/User" },
          apiKey: {
            type: "string",
            description: "Per-user API key (plaintext) — shown once on creation.",
            example: "uk_193f8fbb2bf99e8c494041e67e0aaf8ad299831e"
          }
        }
      },
      ListUsersResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          meta: {
            type: "object",
            properties: {
              total: { type: "integer", example: 1 },
              page: { type: "integer", example: 1 },
              limit: { type: "integer", example: 20 },
              hasMore: { type: "boolean", example: false }
            }
          },
          data: { type: "array", items: { $ref: "#/components/schemas/User" } }
        }
      },
      UpdateUserRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          password: { type: "string" },
          role: { type: "string", enum: ["super_admin", "department_admin", "user"] },
          departmentId: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          address: { type: "string", nullable: true },
          picture: { type: "string", nullable: true }
        }
      },
      APIKeyRotateResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          apiKey: {
            type: "string",
            description: "New per-user API key (plaintext). Save it now.",
            example: "uk_5f3b1b7aa0c24b76d9f0b8c1088a9e6345e1b2d9"
          }
        }
      },
      SimpleOkResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Logged out" }
        }
      }
    }
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    // ===== Health =====
    "/health": {
      get: {
        tags: ["Health"],
        security: [],
        summary: "Health check (no auth)",
        responses: {
          200: {
            description: "Service is up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number", example: 123.45 },
                    version: { type: "string", example: "v1" }
                  }
                }
              }
            }
          }
        }
      }
    },

    // ===== Auth =====
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login (email/password) — requires x-api-key gate",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
        },
        responses: {
          200: {
            description: "Login success",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } }
          },
          400: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthorized (missing/invalid x-api-key)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          422: { description: "Validation failed", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Self register (role=user)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } }
        },
        responses: {
          201: { description: "Registered", content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterResponse" } } } },
          401: { description: "Unauthorized (x-api-key)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "User already exists" },
          422: { description: "Validation failed" }
        }
      }
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current principal (from x-api-key gate)",
        responses: {
          200: {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" }, user: { $ref: "#/components/schemas/User" } }
                }
              }
            }
          },
          401: { description: "Unauthorized (x-api-key)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout (client clears token)",
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } }
        }
      }
    },

    // ===== Admin Users =====
    "/api/v1/auth/users": {
      post: {
        tags: ["Admin Users"],
        summary: "Create user (super_admin & department_admin). Admin create returns apiKey.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } } }
        },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserResponse" } } } },
          401: { description: "Unauthorized (x-api-key)" },
          403: { description: "Forbidden (role not allowed)" },
          409: { description: "User already exists" },
          422: { description: "Validation failed" }
        }
      },
      get: {
        tags: ["Admin Users"],
        summary: "List users (scoped). super_admin & department_admin",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "sort", in: "query", schema: { type: "string", example: "-createdAt" } },
          { name: "role", in: "query", schema: { type: "string", enum: ["super_admin", "department_admin", "user"] } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "isActive", in: "query", schema: { type: "boolean" } }
        ],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ListUsersResponse" } } } },
          401: { description: "Unauthorized (x-api-key)" },
          403: { description: "Forbidden" }
        }
      }
    },
    "/api/v1/auth/users/{id}": {
      get: {
        tags: ["Admin Users"],
        summary: "Get user by id (scoped)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/User" } } } } } },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
          422: { description: "Invalid id" }
        }
      },
      patch: {
        tags: ["Admin Users"],
        summary: "Update user (scoped)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRequest" } } }
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/User" } } } } } },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
          422: { description: "Invalid id" }
        }
      },
      delete: {
        tags: ["Admin Users"],
        summary: "Soft delete user (isActive=false)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          404: { description: "Not found" }
        }
      }
    },

    // ===== API Keys =====
    "/api/v1/auth/apikey/rotate/{userId}": {
      post: {
        tags: ["API Keys"],
        summary: "Rotate per-user API key (admin can rotate scoped users; user can rotate self)",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/APIKeyRotateResponse" } } } },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          404: { description: "User not found" },
          422: { description: "Invalid user id" }
        }
      }
    },
    "/api/v1/auth/apikey/revoke/{userId}": {
      post: {
        tags: ["API Keys"],
        summary: "Revoke per-user API key (clears plaintext + hash + prefix)",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          404: { description: "User not found" },
          422: { description: "Invalid user id" }
        }
      }
    }
  }
};

module.exports = openapi;
