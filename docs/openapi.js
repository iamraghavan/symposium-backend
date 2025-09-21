// docs/openapi.js
const openapi = {
  openapi: "3.0.3",
  info: {
    title: "EGSPEC API",
    description:
      "All /api/* endpoints are secured with **x-api-key** (global or per-user).\n" +
      "- Google sign-in issues a **per-user API key** (plaintext shown once).\n" +
      "- Email/password still returns a JWT for legacy clients.\n" +
      "- **Symposium fee** (₹250/head) is paid once per person and then all event registrations are FREE.\n" +
      "- **Registrations are free** but require the symposium fee to be paid for leader + team.",
    version: "1.4.0"
  },
  servers: [{ url: "http://localhost:8000", description: "Local" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Admin Users" },
    { name: "API Keys" },
    { name: "Departments" },
    { name: "Events" },
    { name: "Registrations" },
    { name: "Symposium Payments" }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description:
          "Required for **all** /api/* endpoints.\n" +
          "- Use a **per-user** key (Google sign-in) for user-scoped endpoints like /auth/me or /registrations.\n" +
          "- A global/server key may be used where configured."
      }
    },
    schemas: {
      /* ===== Core ===== */
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Unauthorized" },
          details: { type: "array", items: { type: "object" }, nullable: true }
        }
      },
      SimpleOkResponse: {
        type: "object",
        properties: { success: { type: "boolean", example: true }, message: { type: "string", example: "OK" } }
      },
      PaymentRequiredResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Symposium entry fee unpaid" },
          payment: {
            type: "object",
            nullable: true,
            properties: {
              neededFor: { type: "array", items: { type: "string", example: "student@example.com" } },
              feeInInr: { type: "integer", example: 250 }
            }
          },
          unpaidEmails: {
            type: "array",
            nullable: true,
            items: { type: "string", example: "teammate@example.com" }
          }
        }
      },

      /* ===== Users/Auth ===== */
      User: {
        type: "object",
        properties: {
          _id: { type: "string", example: "68ce30aa8ac6618c45bfb533" },
          name: { type: "string", example: "EEE Department Admin" },
          email: { type: "string", example: "eeeadmin@egspec.org" },
          role: { type: "string", enum: ["super_admin", "department_admin", "user"], example: "user" },
          department: { type: "string", nullable: true, example: "68cd4d6b778a4db47873d869" },
          provider: { type: "string", enum: ["local", "google"], example: "google" },
          picture: { type: "string", nullable: true },
          givenName: { type: "string", nullable: true },
          familyName: { type: "string", nullable: true },
          locale: { type: "string", nullable: true },
          emailVerified: { type: "boolean", example: true },
          address: { type: "string", nullable: true },
          hasPaidSymposium: { type: "boolean", example: true },
          symposiumPaidAt: { type: "string", format: "date-time", nullable: true },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
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
          token: { type: "string", description: "JWT (12h). Present for email/password flow." },
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
          token: { type: "string", description: "JWT (12h) for email/password flow" },
          user: { $ref: "#/components/schemas/User" }
        }
      },
      GoogleIdTokenRequest: {
        type: "object",
        required: ["idToken"],
        properties: {
          idToken: { type: "string", description: "Google ID token from GSI" },
          departmentId: { type: "string", nullable: true },
          address: { type: "string", nullable: true }
        }
      },
      GoogleCodeVerifyRequest: {
        type: "object",
        required: ["code"],
        properties: {
          code: { type: "string", description: "Google OAuth authorization code (PKCE/OneTap Code flow)" },
          redirectUri: { type: "string", nullable: true, description: "Optional override; defaults to server GOOGLE_REDIRECT_URI" }
        }
      },
      GoogleAuthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          apiKey: {
            type: "string",
            description: "Per-user API key (plaintext). Save it now; shown only once.",
            example: "uk_5f3b1b7aa0c24b76d9f0b8c1088a9e6345e1b2d9"
          },
          user: { $ref: "#/components/schemas/User" }
        }
      },
      CreateUserRequest: {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", example: "EEE Department Admin" },
          email: { type: "string", example: "eeeadmin@egspec.org" },
          password: { type: "string", example: "EEE@123" },
          role: { type: "string", enum: ["super_admin", "department_admin", "user"], example: "department_admin" },
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
            description: "Per-user API key (plaintext). Save it now.",
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
            example: "uk_a1b2c3d4e5f6a7b8c9d0e1f22334455667788990"
          }
        }
      },

      /* ===== Departments / Events ===== */
      Department: {
        type: "object",
        properties: {
          _id: { type: "string", example: "68cd4d6b778a4db47873d869" },
          code: { type: "string", example: "EGSPEC/EEE" },
          name: { type: "string", example: "Electrical and Electronics Engineering" },
          shortcode: { type: "string", example: "EEE" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      CreateDepartmentRequest: {
        type: "object",
        required: ["code", "name", "shortcode"],
        properties: {
          code: { type: "string", example: "EGSPEC/EEE" },
          name: { type: "string", example: "Electrical and Electronics Engineering" },
          shortcode: { type: "string", example: "EEE" },
          isActive: { type: "boolean", example: true }
        }
      },
      UpdateDepartmentRequest: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          shortcode: { type: "string" },
          isActive: { type: "boolean" }
        }
      },
      ListDepartmentsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          meta: {
            type: "object",
            properties: {
              total: { type: "integer" },
              page: { type: "integer" },
              limit: { type: "integer" },
              hasMore: { type: "boolean" }
            }
          },
          data: { type: "array", items: { $ref: "#/components/schemas/Department" } }
        }
      },
      Event: {
        type: "object",
        properties: {
          _id: { type: "string", example: "68cf10d3b9b9d2a86f7a1a23" },
          name: { type: "string", example: "EEE Symposium 2025" },
          slug: { type: "string", example: "eee-symposium-2025" },
          description: { type: "string" },
          thumbnailUrl: { type: "string", nullable: true },
          mode: { type: "string", enum: ["online", "offline"], example: "offline" },
          online: {
            type: "object",
            nullable: true,
            properties: { provider: { type: "string" }, url: { type: "string" } }
          },
          offline: {
            type: "object",
            nullable: true,
            properties: {
              venueName: { type: "string", example: "Main Auditorium" },
              address: { type: "string", example: "EGSPEC Campus" },
              mapLink: { type: "string", example: "https://maps.example.com/venue" }
            }
          },
          startAt: { type: "string", format: "date-time" },
          endAt: { type: "string", format: "date-time" },
          department: { type: "string", example: "68cd4d6b778a4db47873d869" },
          createdBy: { type: "string", example: "68ce30aa8ac6618c45bfb533" },
          payment: {
            type: "object",
            properties: {
              method: { type: "string", example: "none" },
              currency: { type: "string", example: "INR" },
              price: { type: "number", example: 0 }
            }
          },
          contacts: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" } } }
          },
          departmentSite: { type: "string", nullable: true },
          contactEmail: { type: "string", nullable: true },
          extra: { type: "object", additionalProperties: true },
          status: { type: "string", enum: ["draft", "published", "cancelled"], example: "published" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      CreateEventRequest: {
        type: "object",
        required: ["name", "mode", "startAt", "endAt", "departmentId"],
        properties: {
          name: { type: "string", example: "EEE Symposium 2025" },
          description: { type: "string" },
          thumbnailUrl: { type: "string" },
          mode: { type: "string", enum: ["online", "offline"], example: "offline" },
          online: { $ref: "#/components/schemas/Event/properties/online" },
          offline: { $ref: "#/components/schemas/Event/properties/offline" },
          startAt: { type: "string", format: "date-time", example: "2025-10-05T04:30:00.000Z" },
          endAt: { type: "string", format: "date-time", example: "2025-10-05T10:30:00.000Z" },
          departmentId: { type: "string", example: "68cd4d6b778a4db47873d869" },
          payment: { $ref: "#/components/schemas/Event/properties/payment" },
          contacts: { $ref: "#/components/schemas/Event/properties/contacts" },
          departmentSite: { type: "string" },
          contactEmail: { type: "string" },
          extra: { type: "object", additionalProperties: true },
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
          online: { $ref: "#/components/schemas/Event/properties/online" },
          offline: { $ref: "#/components/schemas/Event/properties/offline" },
          startAt: { type: "string", format: "date-time" },
          endAt: { type: "string", format: "date-time" },
          payment: { $ref: "#/components/schemas/Event/properties/payment" },
          contacts: { $ref: "#/components/schemas/Event/properties/contacts" },
          departmentSite: { type: "string" },
          contactEmail: { type: "string" },
          extra: { type: "object", additionalProperties: true },
          status: { type: "string", enum: ["draft", "published", "cancelled"] }
        }
      },
      ListEventsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          meta: {
            type: "object",
            properties: {
              total: { type: "integer" },
              page: { type: "integer" },
              limit: { type: "integer" },
              hasMore: { type: "boolean" }
            }
          },
          data: { type: "array", items: { $ref: "#/components/schemas/Event" } }
        }
      },

      /* ===== Registrations ===== */
      Registration: {
        type: "object",
        properties: {
          _id: { type: "string", example: "68d0123a7aa1c0f93a1b2c3d" },
          event: { type: "string", example: "68cf10d3b9b9d2a86f7a1a23" },
          user: { type: "string", example: "68ce30aa8ac6618c45bfb533" },
          type: { type: "string", enum: ["individual", "team"], example: "individual" },
          team: {
            type: "object",
            nullable: true,
            properties: {
              name: { type: "string", nullable: true, example: "Ohm's Avengers" },
              size: { type: "integer", example: 3 },
              members: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", example: "Priya" },
                    email: { type: "string", example: "priya@example.com" }
                  }
                }
              }
            }
          },
          status: { type: "string", enum: ["pending", "confirmed", "cancelled"], example: "confirmed" },
          payment: {
            type: "object",
            properties: {
              method: { type: "string", enum: ["none", "gateway"], example: "gateway" },
              currency: { type: "string", example: "INR" },
              amount: { type: "number", example: 0 },
              status: { type: "string", enum: ["none", "pending", "paid", "failed"], example: "paid" },
              gatewayProvider: { type: "string", nullable: true, example: "razorpay" },
              gatewayOrderId: { type: "string", nullable: true },
              gatewayPaymentId: { type: "string", nullable: true },
              verifiedAt: { type: "string", format: "date-time", nullable: true }
            }
          },
          notes: { type: "string", nullable: true },
          eventName: { type: "string", example: "EEE Symposium 2025" },
          userEmail: { type: "string", example: "student@example.com" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      CreateRegistrationRequest: {
        type: "object",
        required: ["eventId", "type"],
        properties: {
          eventId: { type: "string", example: "68ce8ee515adf4cdbc226fb9" },
          type: { type: "string", enum: ["individual", "team"], example: "individual" },
          team: {
            type: "object",
            nullable: true,
            properties: {
              name: { type: "string", nullable: true },
              members: {
                type: "array",
                items: {
                  type: "object",
                  required: ["name", "email"],
                  properties: { name: { type: "string" }, email: { type: "string" } }
                }
              }
            }
          },
          notes: { type: "string", nullable: true }
        }
      },
      CreateRegistrationResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          registration: { $ref: "#/components/schemas/Registration" },
          payment: {
            type: "object",
            properties: {
              needsPayment: { type: "boolean", example: false },
              feeInInr: { type: "integer", example: 250 },
              unpaidCount: { type: "integer", example: 0 }
            }
          }
        }
      },
      ListMyRegistrationsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          items: { type: "array", items: { $ref: "#/components/schemas/Registration" } }
        }
      },
      SingleRegistrationResponse: {
        type: "object",
        properties: { success: { type: "boolean", example: true }, registration: { $ref: "#/components/schemas/Registration" } }
      },

      /* ===== Symposium Payments ===== */
      SymposiumStatusEntry: {
        type: "object",
        properties: { email: { type: "string", example: "alice@example.com" }, hasPaid: { type: "boolean", example: true } }
      },
      SymposiumStatusResponse: {
        type: "object",
        properties: { success: { type: "boolean", example: true }, entries: { type: "array", items: { $ref: "#/components/schemas/SymposiumStatusEntry" } } }
      },
      SymposiumOrderRequest: {
        type: "object",
        properties: {
          emails: {
            type: "array",
            description: "Optional extra emails besides the caller to pay for now",
            items: { type: "string", example: "bob@example.com" }
          }
        }
      },
      SymposiumOrderResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          payment: {
            type: "object",
            properties: {
              needsPayment: { type: "boolean", example: true },
              keyId: { type: "string", example: "rzp_test_xxx" },
              order: {
                type: "object",
                properties: {
                  id: { type: "string", example: "order_9A33XWu170gUtm" },
                  amount: { type: "integer", example: 25000 },
                  currency: { type: "string", example: "INR" }
                }
              }
            }
          },
          message: { type: "string", nullable: true }
        }
      },
      SymposiumVerifyRequest: {
        type: "object",
        required: ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"],
        properties: {
          razorpay_order_id: { type: "string", example: "order_9A33XWu170gUtm" },
          razorpay_payment_id: { type: "string", example: "pay_29QQoUBi66xm2f" },
          razorpay_signature: { type: "string", example: "generated_signature_here" }
        }
      },
      SymposiumVerifyResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          covered: {
            type: "array",
            items: { type: "object", properties: { email: { type: "string" }, hasPaidSymposium: { type: "boolean" } } }
          },
          message: { type: "string", nullable: true }
        }
      }
    }
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    /* ===== Health ===== */
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

    /* ===== Auth (email/password) ===== */
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login (email/password) — gated by x-api-key",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
        responses: {
          200: { description: "Login success", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
          400: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthorized (missing/invalid x-api-key)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Self register (role=user) — gated by x-api-key",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } } },
        responses: {
          201: { description: "Registered", content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterResponse" } } } },
          401: { description: "Unauthorized (x-api-key)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "User already exists" }
        }
      }
    },

    /* ===== Auth (Google → API key) ===== */
    "/api/v1/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Google sign-in via ID token → returns per-user API key (no JWT)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/GoogleIdTokenRequest" } } } },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/GoogleAuthResponse" } } } },
          401: { description: "Unauthorized (x-api-key or Google verify failed)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/auth/oauth/google/verify": {
      post: {
        tags: ["Auth"],
        summary: "Google OAuth code exchange → id_token → per-user API key",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/GoogleCodeVerifyRequest" } } } },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/GoogleAuthResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    /* ===== Session ===== */
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current principal (from x-api-key)",
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, user: { $ref: "#/components/schemas/User" } } } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/auth/logout": {
      post: { tags: ["Auth"], summary: "Logout (client forgets credential; stateless)", responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } } } }
    },

    /* ===== Admin Users ===== */
    "/api/v1/auth/users": {
      post: {
        tags: ["Admin Users"],
        summary: "Create user (super_admin & department_admin). Returns API key (plaintext).",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } } } },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserResponse" } } } },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          409: { description: "User already exists" }
        }
      },
      get: {
        tags: ["Admin Users"],
        summary: "List users (scoped)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "sort", in: "query", schema: { type: "string", example: "-createdAt" } },
          { name: "role", in: "query", schema: { type: "string", enum: ["super_admin", "department_admin", "user"] } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "isActive", in: "query", schema: { type: "boolean" } }
        ],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ListUsersResponse" } } } }, 401: { description: "Unauthorized" }, 403: { description: "Forbidden" } }
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
          404: { description: "Not found" }
        }
      },
      patch: {
        tags: ["Admin Users"],
        summary: "Update user (scoped)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRequest" } } } },
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/User" } } } } } }, 404: { description: "Not found" } }
      },
      delete: {
        tags: ["Admin Users"],
        summary: "Soft delete (isActive=false)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } }, 404: { description: "Not found" } }
      }
    },

    /* ===== API Keys ===== */
    "/api/v1/auth/apikey/rotate/{userId}": {
      post: {
        tags: ["API Keys"],
        summary: "Rotate per-user API key",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/APIKeyRotateResponse" } } } }, 404: { description: "User not found" } }
      }
    },
    "/api/v1/auth/apikey/revoke/{userId}": {
      post: {
        tags: ["API Keys"],
        summary: "Revoke per-user API key",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } }, 404: { description: "User not found" } }
      }
    },

    /* ===== Departments ===== */
    "/api/v1/departments": {
      get: {
        tags: ["Departments"],
        summary: "List departments",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "sort", in: "query", schema: { type: "string", example: "name" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "includeInactive", in: "query", schema: { type: "boolean" } }
        ],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ListDepartmentsResponse" } } } } }
      },
      post: {
        tags: ["Departments"],
        summary: "Create department (super_admin)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateDepartmentRequest" } } } },
        responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Department" } } } } } } }
      }
    },
    "/api/v1/departments/{id}": {
      get: {
        tags: ["Departments"],
        summary: "Get department by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "includeInactive", in: "query", schema: { type: "boolean" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Department" } } } } } }, 404: { description: "Not found" } }
      },
      patch: {
        tags: ["Departments"],
        summary: "Update department (super_admin)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateDepartmentRequest" } } } },
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Department" } } } } } } }
      },
      delete: {
        tags: ["Departments"],
        summary: "Soft delete (isActive=false)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } }, 404: { description: "Not found" } }
      }
    },

    /* ===== Events ===== */
    "/api/v1/events": {
      get: {
        tags: ["Events"],
        summary: "Public: list published events",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "sort", in: "query", schema: { type: "string", example: "-startAt" } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "upcoming", in: "query", schema: { type: "boolean" } }
        ],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ListEventsResponse" } } } } }
      },
      post: {
        tags: ["Events"],
        summary: "Create event (super_admin or department_admin; scoped)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateEventRequest" } } } },
        responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Event" } } } } } } }
      }
    },
    "/api/v1/events/{id}": {
      get: {
        tags: ["Events"],
        summary: "Public: get event by id (published-only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Event" } } } } } }, 404: { description: "Not found" } }
      },
      patch: {
        tags: ["Events"],
        summary: "Update event (scoped admins)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateEventRequest" } } } },
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Event" } } } } } } }
      },
      delete: {
        tags: ["Events"],
        summary: "Soft delete event (scoped admins)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SimpleOkResponse" } } } }, 404: { description: "Not found" } }
      }
    },
    "/api/v1/events/admin": {
      get: {
        tags: ["Events"],
        summary: "Admin: list events (all statuses)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "sort", in: "query", schema: { type: "string", example: "-startAt" } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "cancelled"] } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "upcoming", in: "query", schema: { type: "boolean" } }
        ],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ListEventsResponse" } } } } }
      }
    },
    "/api/v1/events/admin/{id}": {
      get: {
        tags: ["Events"],
        summary: "Admin: get one event (all statuses)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { $ref: "#/components/schemas/Event" } } } } } }, 404: { description: "Not found" } }
      }
    },

    /* ===== Registrations (FREE; blocked until symposium paid) ===== */
    "/api/v1/registrations": {
      post: {
        tags: ["Registrations"],
        summary: "Create registration (individual or team) — idempotent",
        description:
          "Registration itself is **free**. However, it is **blocked** until the symposium entry fee (₹250/head) is paid for the leader + all team members in the request.\n" +
          "If unpaid, returns **402 Payment Required** with the list of emails that must pay first.\n" +
          "Once paid, call this again; returns 201/200 with a confirmed registration.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateRegistrationRequest" } } } },
        responses: {
          201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/CreateRegistrationResponse" } } } },
          200: { description: "Idempotent hit (existing active registration)", content: { "application/json": { schema: { $ref: "#/components/schemas/CreateRegistrationResponse" } } } },
          401: { description: "Unauthorized (x-api-key)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          402: { description: "Symposium entry fee unpaid", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentRequiredResponse" } } } },
          409: { description: "Duplicate active registration", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/registrations/my": {
      get: {
        tags: ["Registrations"],
        summary: "List my registrations",
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ListMyRegistrationsResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/registrations/{id}": {
      get: {
        tags: ["Registrations"],
        summary: "Get registration by id (owner or admins)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SingleRegistrationResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },

    /* ===== Symposium Payments ===== */
    "/api/v1/symposium-payments/symposium/status": {
      get: {
        tags: ["Symposium Payments"],
        summary: "Check symposium fee status for the caller + optional emails",
        description: "Query param `emails` is a comma-separated list. Caller is always included.",
        parameters: [{ name: "emails", in: "query", schema: { type: "string", example: "alice@example.com,bob@example.com" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SymposiumStatusResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/symposium-payments/symposium/order": {
      post: {
        tags: ["Symposium Payments"],
        summary: "Create Razorpay order for symposium entry fee (₹250/head)",
        description:
          "Body may include extra emails to pay for along with the caller. Only **unpaid** emails are charged. Returns `{ keyId, order }`.",
        requestBody: { required: false, content: { "application/json": { schema: { $ref: "#/components/schemas/SymposiumOrderRequest" } } } },
        responses: {
          201: { description: "Order created", content: { "application/json": { schema: { $ref: "#/components/schemas/SymposiumOrderResponse" } } } },
          200: { description: "Everyone already paid", content: { "application/json": { schema: { $ref: "#/components/schemas/SymposiumOrderResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    },
    "/api/v1/symposium-payments/symposium/verify": {
      post: {
        tags: ["Symposium Payments"],
        summary: "Verify Razorpay signature and mark users as paid",
        description: "Server-side verification of `order_id|payment_id` using `RAZORPAY_KEY_SECRET`.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SymposiumVerifyRequest" } } } },
        responses: {
          200: { description: "Payment verified; users flagged as hasPaidSymposium", content: { "application/json": { schema: { $ref: "#/components/schemas/SymposiumVerifyResponse" } } } },
          400: { description: "Invalid signature / bad input", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Order not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        }
      }
    }
  }
};

module.exports = openapi;
