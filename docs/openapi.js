// docs/openapi.js
const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Symposium API",
    version: "1.0.0",
    description: [
      "REST API for the Symposium app with Google OAuth, role-based access control (RBAC), API key gating, pagination, and versioned routes.",
      "",
      "## Content Type & Headers",
      "- All endpoints **accept and return JSON** only.",
      "- Always send:",
      "  - `Content-Type: application/json` (for requests with a body)",
      "  - `Accept: application/json`",
      "  - `x-api-key: <your_api_key>` for all `/api/*` endpoints (required).",
      "",
      "## Authorization",
      "- **API Key** (required for all `/api/*`):",
      "  - Header: `x-api-key: rjfqrur9L0v2XNzx574DI1Djejii70JP5S` (example).",
      "- **JWT Bearer Token** (required for protected routes):",
      "  - Header: `Authorization: Bearer <JWT_FROM_/auth/login_OR_/auth/google>`",
      "  - Token expires in 12h.",
      "",
      "## Roles",
      "- `super_admin`: full system access.",
      "- `department_admin`: access scoped to own department; can create **users** and **events** for their department.",
      "- `user`: access to own resources; can read published events.",
      "",
      "## Versioning",
      "- All endpoints are under `/api/v1/...`.",
    ].join("\n"),
    contact: { name: "EGSPEC", url: "https://www.egspec.org" }
  },
  servers: [{ url: "http://localhost:8000", description: "Local" }],
  tags: [
    { name: "Auth", description: "Authentication & Session (requires x-api-key; some also require JWT)" },
    { name: "Users", description: "User CRUD (admin-only). Requires x-api-key + Bearer JWT." },
    { name: "Events", description: "Event CRUD & public listing. Read requires x-api-key; write requires JWT + role." },
    { name: "Health", description: "Service health (no API key/JWT required by default)." }
  ],
  components: {
    securitySchemes: {
      ApiKeyHeader: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Static API key required for all /api/* endpoints."
      },
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT from /api/v1/auth/login or /api/v1/auth/google, sent as `Authorization: Bearer <token>`."
      }
    },
    schemas: {
      /* ===== Common / Existing ===== */
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Validation failed" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string", example: "email" },
                msg: { type: "string", example: "Valid email is required" }
              }
            }
          }
        }
      },
      PaginationMeta: {
        type: "object",
        properties: {
          total: { type: "integer", example: 125 },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          hasMore: { type: "boolean", example: true }
        }
      },
      Department: {
        type: "object",
        properties: {
          _id: { type: "string", example: "64fdc3f1a2b4c5d6e7f89012" },
          id: { type: "string", example: "f2bb5f5e-4c9d-49af-9253-4f9c23e7a731" },
          code: { type: "string", example: "EGSPEC/EEE" },
          name: { type: "string", example: "B.E — Electrical & Electronics Engineering" },
          shortcode: { type: "string", example: "EEE" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "65015a71b05c3495bc6e5b5c" },
          name: { type: "string", example: "Root Admin" },
          email: { type: "string", example: "rootadmin@example.com" },
          role: {
            type: "string",
            enum: ["super_admin", "department_admin", "user"],
            example: "super_admin"
          },
          department: {
            oneOf: [
              { type: "string", nullable: true, example: "64fdc3f1a2b4c5d6e7f89012" },
              { $ref: "#/components/schemas/Department" }
            ]
          },
          provider: { type: "string", enum: ["local", "google"], example: "local" },
          isActive: { type: "boolean", example: true },
          lastLoginAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Student User" },
          email: { type: "string", example: "student@example.com" },
          password: { type: "string", example: "secret123" },
          departmentId: { type: "string", nullable: true, example: "64fdc3f1a2b4c5d6e7f89012" }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "rootadmin@example.com" },
          password: { type: "string", example: "Admin@123" }
        }
      },
      GoogleAuthRequest: {
        type: "object",
        required: ["idToken"],
        properties: {
          idToken: { type: "string", example: "eyJhbGciOiJSUzI1NiIsImtpZCI6..." },
          departmentId: { type: "string", nullable: true, example: "64fdc3f1a2b4c5d6e7f89012" }
        }
      },
      TokenResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
          user: { $ref: "#/components/schemas/User" }
        }
      },
      AdminCreateUserRequest: {
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
          departmentId: { type: "string", example: "64fdc3f1a2b4c5d6e7f89012" }
        }
      },
      UpdateUserRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          password: { type: "string" },
          role: { type: "string", enum: ["super_admin", "department_admin", "user"] },
          departmentId: { type: "string", nullable: true },
          isActive: { type: "boolean" }
        }
      },

      /* ====== EVENTS ====== */
      EventContact: {
        type: "object",
        properties: {
          name: { type: "string", example: "Raghavan" },
          phone: { type: "string", example: "+91-9000000000" },
          email: { type: "string", example: "raghavan@egspec.org" }
        }
      },
      EventOnline: {
        type: "object",
        properties: {
          provider: { type: "string", enum: ["google_meet", "zoom", "other"], example: "google_meet" },
          url: { type: "string", example: "https://meet.google.com/abc-defg-hij" }
        }
      },
      EventOffline: {
        type: "object",
        properties: {
          venueName: { type: "string", example: "Main Auditorium" },
          address: { type: "string", example: "EGSPEC Campus, Nagapattinam" },
          mapLink: { type: "string", example: "https://maps.google.com/?q=EGSPEC" }
        }
      },
      EventPayment: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["none", "gateway", "qr"], example: "gateway" },
          gatewayProvider: { type: "string", example: "razorpay" },
          gatewayLink: { type: "string", example: "https://rzp.io/i/xyz123" },
          price: { type: "number", example: 199 },
          currency: { type: "string", example: "INR" },
          qrImageUrl: { type: "string", example: "https://cdn.egspec.org/pay/qr.jpg" },
          qrInstructions: { type: "string", example: "Pay and upload screenshot in registration form" },
          allowScreenshot: { type: "boolean", example: true }
        }
      },
      Event: {
        type: "object",
        properties: {
          _id: { type: "string", example: "66f5a81e3f65bb57b8c84e91" },
          name: { type: "string", example: "AI Symposium 2025" },
          slug: { type: "string", example: "ai-symposium-2025-abcd" },
          description: { type: "string", example: "Deep dive into AI & Data Science." },
          thumbnailUrl: { type: "string", example: "https://cdn.egspec.org/events/ai-thumb.jpg" },
          mode: { type: "string", enum: ["online", "offline"], example: "online" },
          online: { $ref: "#/components/schemas/EventOnline" },
          offline: { $ref: "#/components/schemas/EventOffline" },
          startAt: { type: "string", format: "date-time", example: "2025-11-21T09:30:00.000Z" },
          endAt: { type: "string", format: "date-time", example: "2025-11-21T12:30:00.000Z" },
          department: {
            oneOf: [
              { type: "string", example: "64fdc3f1a2b4c5d6e7f89012" },
              { $ref: "#/components/schemas/Department" }
            ]
          },
          createdBy: {
            oneOf: [
              { type: "string", example: "65015a71b05c3495bc6e5b5c" },
              { $ref: "#/components/schemas/User" }
            ]
          },
          payment: { $ref: "#/components/schemas/EventPayment" },
          contacts: { type: "array", items: { $ref: "#/components/schemas/EventContact" } },
          departmentSite: { type: "string", example: "https://cse.egspec.org/sympo" },
          contactEmail: { type: "string", example: "sympo@egspec.org" },
          extra: { type: "object", additionalProperties: true, example: { tracks: ["Vision", "NLP"] } },
          status: { type: "string", enum: ["draft", "published", "cancelled"], example: "draft" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      CreateEventRequest: {
        type: "object",
        required: ["name", "mode", "startAt", "endAt", "departmentId"],
        properties: {
          name: { type: "string", example: "AI Symposium 2025" },
          description: { type: "string", example: "Deep dive into AI & Data Science." },
          thumbnailUrl: { type: "string", example: "https://cdn.egspec.org/events/ai-thumb.jpg" },
          mode: { type: "string", enum: ["online", "offline"], example: "online" },
          online: { $ref: "#/components/schemas/EventOnline" },
          offline: { $ref: "#/components/schemas/EventOffline" },
          startAt: { type: "string", format: "date-time", example: "2025-11-21T09:30:00.000Z" },
          endAt: { type: "string", format: "date-time", example: "2025-11-21T12:30:00.000Z" },
          departmentId: { type: "string", example: "64fdc3f1a2b4c5d6e7f89012" },
          payment: { $ref: "#/components/schemas/EventPayment" },
          contacts: { type: "array", items: { $ref: "#/components/schemas/EventContact" } },
          departmentSite: { type: "string", example: "https://cse.egspec.org/sympo" },
          contactEmail: { type: "string", example: "sympo@egspec.org" },
          extra: { type: "object", example: { tracks: ["Vision", "NLP"] } },
          status: { type: "string", enum: ["draft", "published", "cancelled"], example: "draft" }
        }
      },
      UpdateEventRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          thumbnailUrl: { type: "string" },
          mode: { type: "string", enum: ["online", "offline"] },
          online: { $ref: "#/components/schemas/EventOnline" },
          offline: { $ref: "#/components/schemas/EventOffline" },
          startAt: { type: "string", format: "date-time" },
          endAt: { type: "string", format: "date-time" },
          payment: { $ref: "#/components/schemas/EventPayment" },
          contacts: { type: "array", items: { $ref: "#/components/schemas/EventContact" } },
          departmentSite: { type: "string" },
          contactEmail: { type: "string" },
          extra: { type: "object" },
          status: { type: "string", enum: ["draft", "published", "cancelled"] }
        }
      }
    },
    parameters: {
      Page: { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
      Limit: { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
      Sort: { name: "sort", in: "query", schema: { type: "string", example: "-createdAt,name" } },
      Q: { name: "q", in: "query", schema: { type: "string", example: "john" } },
      Role: { name: "role", in: "query", schema: { type: "string", enum: ["super_admin", "department_admin", "user"] } },
      DepartmentId: { name: "departmentId", in: "query", schema: { type: "string", example: "64fdc3f1a2b4c5d6e7f89012" } },
      IsActive: { name: "isActive", in: "query", schema: { type: "boolean" } },
      UserId: { name: "id", in: "path", required: true, schema: { type: "string" }, example: "65015a71b05c3495bc6e5b5c" },

      /* Events */
      EventId: { name: "id", in: "path", required: true, schema: { type: "string" }, example: "66f5a81e3f65bb57b8c84e91" },
      EventStatus: { name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "cancelled"] } },
      EventUpcoming: { name: "upcoming", in: "query", schema: { type: "string", enum: ["true", "false"], example: "true" } }
    }
  },

  // Global: API key required for all /api/* routes (Swagger UI will show an Authorize button)
  security: [{ ApiKeyHeader: [] }],

  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Service health",
        description: "No headers required. Returns API health info.",
        security: [],
        responses: {
          "200": {
            description: "OK",
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

    /* =================== AUTH =================== */
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a normal user (role = user)",
        description:
          "Headers required: `x-api-key`, `Content-Type: application/json`, `Accept: application/json`.\nNo Bearer token required.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
              examples: {
                default: {
                  value: {
                    name: "Student User",
                    email: "student@example.com",
                    password: "secret123",
                    departmentId: "64fdc3f1a2b4c5d6e7f89012"
                  }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email/password",
        description:
          "Headers required: `x-api-key`, `Content-Type: application/json`, `Accept: application/json`.\nNo Bearer token required. Returns a JWT token to be sent as `Authorization: Bearer <token>` in subsequent requests.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
              examples: { default: { value: { email: "rootadmin@example.com", password: "Admin@123" } } }
            }
          }
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          "400": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    "/api/v1/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Login/Register with Google ID Token",
        description:
          "Headers required: `x-api-key`, `Content-Type: application/json`, `Accept: application/json`.\nNo Bearer token required. Send `idToken` from Google Identity Services; backend verifies it and returns a JWT.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GoogleAuthRequest" },
              examples: { default: { value: { idToken: "eyJhbGciOi...", departmentId: "64fdc3f1a2b4c5d6e7f89012" } } }
            }
          }
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } },
          "401": { description: "Invalid Google token", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        description: "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Accept: application/json`.",
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" }, user: { $ref: "#/components/schemas/User" } }
                }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout (client clears token)",
        description: "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Accept: application/json`.",
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        responses: { "200": { description: "OK" } }
      }
    },

    /* =================== USERS (ADMIN) =================== */
    "/api/v1/auth/users": {
      post: {
        tags: ["Users"],
        summary: "Create a user (admin only).",
        description: [
          "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Content-Type: application/json`, `Accept: application/json`.",
          "- **super_admin**: can create any role. If creating `department_admin`, `departmentId` is **required**.",
          "- **department_admin**: can create **role = user** only; department is forced to creator’s department."
        ].join("\n"),
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminCreateUserRequest" },
              examples: {
                createDeptAdmin: {
                  summary: "Create Department Admin (super_admin)",
                  value: {
                    name: "EEE Department Admin",
                    email: "eeeadmin@egspec.org",
                    password: "EEE@123",
                    role: "department_admin",
                    departmentId: "64fdc3f1a2b4c5d6e7f89012"
                  }
                },
                createUserByDeptAdmin: {
                  summary: "Create User (department_admin)",
                  value: {
                    name: "Student User",
                    email: "student1@egspec.org",
                    password: "secret123",
                    role: "user"
                  }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/User" } } }
              }
            }
          },
          "403": { description: "Forbidden (role constraints)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      },
      get: {
        tags: ["Users"],
        summary: "List users (admin only) with pagination & filtering",
        description:
          "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Accept: application/json`.\nSupports `page`, `limit`, `sort`, `role`, `departmentId`, `q`, `isActive`.",
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/Page" },
          { $ref: "#/components/parameters/Limit" },
          { $ref: "#/components/parameters/Sort" },
          { $ref: "#/components/parameters/Role" },
          { $ref: "#/components/parameters/DepartmentId" },
          { $ref: "#/components/parameters/Q" },
          { $ref: "#/components/parameters/IsActive" }
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                    data: { type: "array", items: { $ref: "#/components/schemas/User" } }
                  }
                }
              }
            }
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    "/api/v1/auth/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user by id (scoped by role)",
        description: "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Accept: application/json`.",
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/UserId" }],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/User" } } } } }
          },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      },
      patch: {
        tags: ["Users"],
        summary: "Update user (partial)",
        description: [
          "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Content-Type: application/json`, `Accept: application/json`.",
          "- **super_admin**: can change role/department/isActive.",
          "- **department_admin**: cannot change roles or move users across departments.",
          "- **user**: can update own name/password."
        ].join("\n"),
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/UserId" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRequest" } } }
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/User" } } } } } },
          "403": { description: "Forbidden (scope constraints)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      },
      delete: {
        tags: ["Users"],
        summary: "Soft delete user (isActive=false)",
        description: "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Accept: application/json`.",
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/UserId" }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    /* =================== EVENTS =================== */
    "/api/v1/events": {
      get: {
        tags: ["Events"],
        summary: "List events (public read with API key; JWT optional)",
        description: [
          "- Headers required: `x-api-key`, `Accept: application/json`.",
          "- If **no JWT**, only `published` events are returned.",
          "- If **department_admin** (JWT), listing is scoped to own department by default (or pass `departmentId` matching own dept).",
          "- If **super_admin** (JWT), can list all or filter by `departmentId`.",
          "- Filters: `page`, `limit`, `sort` (e.g. `-startAt`), `departmentId`, `status`, `q`, `upcoming=true`."
        ].join("\n"),
        parameters: [
          { $ref: "#/components/parameters/Page" },
          { $ref: "#/components/parameters/Limit" },
          { name: "sort", in: "query", schema: { type: "string", example: "-startAt" } },
          { $ref: "#/components/parameters/DepartmentId" },
          { $ref: "#/components/parameters/EventStatus" },
          { name: "q", in: "query", schema: { type: "string", example: "AI" } },
          { $ref: "#/components/parameters/EventUpcoming" }
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    meta: { $ref: "#/components/schemas/PaginationMeta" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Event" } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ["Events"],
        summary: "Create event (department_admin or super_admin)",
        description: [
          "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Content-Type: application/json`, `Accept: application/json`.",
          "- **department_admin**: can create only for **own** department (`departmentId` must match).",
          "- **super_admin**: can create for any department."
        ].join("\n"),
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateEventRequest" } } }
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Event" } } } } }
          },
          "403": { description: "Forbidden (scope/role)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    "/api/v1/events/{id}": {
      get: {
        tags: ["Events"],
        summary: "Get event by id",
        description: [
          "Headers required: `x-api-key`, `Accept: application/json`.",
          "- Public readers (no JWT) can only access `published` events.",
          "- **department_admin** can only access events of their own department.",
          "- **super_admin** can access any."
        ].join("\n"),
        parameters: [{ $ref: "#/components/parameters/EventId" }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Event" } } } } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      },
      patch: {
        tags: ["Events"],
        summary: "Update event (partial) — department_admin (own) or super_admin",
        description:
          "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Content-Type: application/json`, `Accept: application/json`.",
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/EventId" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateEventRequest" } } }
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Event" } } } } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      },
      delete: {
        tags: ["Events"],
        summary: "Delete event (soft delete) — department_admin (own) or super_admin",
        description: "Headers required: `x-api-key`, `Authorization: Bearer <token>`, `Accept: application/json`.",
        security: [{ ApiKeyHeader: [], BearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/EventId" }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "403": { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    }
  }
};

module.exports = openapi;
