// Mock auth and axios BEFORE requiring the app to ensure the router picks up mocks
jest.mock(
  "../src/middlewares/auth.middleware",
  () => () => (req, _res, next) => {
    req.user = { id: "660000000000000000000001", role: "user" };
    next();
  }
);
jest.mock("axios");

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");

const axios = require("axios");

// Use the real order model against an in-memory MongoDB
const orderModel = require("../src/models/order.model");

// Helpers
const authHeader = { Authorization: "Bearer faketoken" };

jest.setTimeout(30000);

describe("Order API", () => {
  let mongoServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      dbName: "test-order-service",
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Clean collections before each test
    const collections = await mongoose.connection.db.collections();
    for (const c of collections) {
      await c.deleteMany({});
    }
  });

  describe("POST /api/orders", () => {
    const validAddress = {
      shippingAddress: {
        street: "123 Main",
        city: "Metropolis",
        state: "NY",
        pincode: "12345",
        country: "USA",
      },
    };

    it("creates an order when cart items are valid and in stock", async () => {
      const P1 = "507f1f77bcf86cd799439011";
      const P2 = "507f1f77bcf86cd799439012";
      // Mock cart service
      axios.get = jest
        .fn()
        // First call: cart
        .mockResolvedValueOnce({
          data: {
            cart: {
              items: [
                { productId: P1, quantity: 2 },
                { productId: P2, quantity: 1 },
              ],
            },
          },
        })
        // Second call: product p1
        .mockResolvedValueOnce({
          data: {
            data: {
              _id: P1,
              title: "A",
              stock: 5,
              price: { amount: 100, currency: "INR" },
            },
          },
        })
        // Third call: product p2
        .mockResolvedValueOnce({
          data: {
            data: {
              _id: P2,
              title: "B",
              stock: 1,
              price: { amount: 200, currency: "INR" },
            },
          },
        });

      const res = await request(app)
        .post("/api/orders")
        .set(authHeader)
        .send(validAddress);

      expect(res.status).toBe(201);
      // verify order persisted
      const orders = await orderModel
        .find({ user: "660000000000000000000001" })
        .lean();
      expect(orders.length).toBe(1);
      expect(orders[0]).toEqual(
        expect.objectContaining({
          status: "PENDING",
          totalPrice: { amount: 400, currency: "INR" },
        })
      );
    });

    it("returns 400 for invalid address", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set(authHeader)
        .send({
          shippingAddress: {
            street: "",
            city: "",
            state: "",
            pincode: "12",
            country: "",
          },
        });

      expect(res.status).toBe(400);
    });

    it("returns 500 if any product is out of stock", async () => {
      const P1 = "507f1f77bcf86cd799439021";
      axios.get = jest
        .fn()
        .mockResolvedValueOnce({
          data: { cart: { items: [{ productId: P1, quantity: 3 }] } },
        })
        .mockResolvedValueOnce({
          data: {
            data: {
              _id: P1,
              title: "A",
              stock: 2,
              price: { amount: 100, currency: "INR" },
            },
          },
        });

      const res = await request(app)
        .post("/api/orders")
        .set(authHeader)
        .send({
          shippingAddress: {
            street: "s",
            city: "c",
            state: "st",
            pincode: "1234",
            country: "ct",
          },
        });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("message", "Internal server error");
    });
  });

  describe("GET /api/orders/me", () => {
    it("returns paginated orders for the user", async () => {
      // Seed two orders
      await orderModel.create([
        {
          user: "660000000000000000000001",
          items: [],
          status: "PENDING",
          totalPrice: { amount: 100, currency: "INR" },
          shippingAddress: {
            street: "s1",
            city: "c1",
            state: "st1",
            zip: "1234",
            country: "ct1",
          },
        },
        {
          user: "660000000000000000000001",
          items: [],
          status: "PENDING",
          totalPrice: { amount: 200, currency: "INR" },
          shippingAddress: {
            street: "s2",
            city: "c2",
            state: "st2",
            zip: "5678",
            country: "ct2",
          },
        },
      ]);

      const res = await request(app)
        .get("/api/orders/me?page=1&limit=2")
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          orders: expect.any(Array),
          meta: expect.objectContaining({ total: 2, page: 1, limit: 2 }),
        })
      );
    });
  });

  describe("GET /api/orders/:id", () => {
    it("returns an order when owned by the user", async () => {
      const created = await orderModel.create({
        user: "660000000000000000000001",
        items: [],
        status: "PENDING",
        totalPrice: { amount: 50, currency: "INR" },
        shippingAddress: {
          street: "s",
          city: "c",
          state: "st",
          zip: "1234",
          country: "ct",
        },
      });

      const res = await request(app)
        .get(`/api/orders/${created._id.toString()}`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("order");
    });

    it("returns 404 when not found", async () => {
      const missingId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/orders/${missingId}`)
        .set(authHeader);

      expect(res.status).toBe(404);
    });

    it("returns 403 when not owned", async () => {
      const other = await orderModel.create({
        user: new mongoose.Types.ObjectId().toString(),
        items: [],
        status: "PENDING",
        totalPrice: { amount: 50, currency: "INR" },
        shippingAddress: {
          street: "s",
          city: "c",
          state: "st",
          zip: "1234",
          country: "ct",
        },
      });

      const res = await request(app)
        .get(`/api/orders/${other._id.toString()}`)
        .set(authHeader);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/orders/:id/cancel", () => {
    it("cancels pending orders", async () => {
      const created = await orderModel.create({
        user: "660000000000000000000001",
        items: [],
        status: "PENDING",
        totalPrice: { amount: 50, currency: "INR" },
        shippingAddress: {
          street: "s",
          city: "c",
          state: "st",
          zip: "1234",
          country: "ct",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${created._id.toString()}/cancel`)
        .set(authHeader);

      expect(res.status).toBe(200);
      const updated = await orderModel.findById(created._id);
      expect(updated.status).toBe("CANCELLED");
    });

    it("rejects cancel for non-pending", async () => {
      const created = await orderModel.create({
        user: "660000000000000000000001",
        items: [],
        status: "CONFIRMED",
        totalPrice: { amount: 50, currency: "INR" },
        shippingAddress: {
          street: "s",
          city: "c",
          state: "st",
          zip: "1234",
          country: "ct",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${created._id.toString()}/cancel`)
        .set(authHeader);

      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /api/orders/:id/address", () => {
    it("updates address for pending orders", async () => {
      const created = await orderModel.create({
        user: "660000000000000000000001",
        items: [],
        status: "PENDING",
        totalPrice: { amount: 50, currency: "INR" },
        shippingAddress: {
          street: "old",
          city: "old",
          state: "old",
          zip: "0000",
          country: "old",
        },
      });

      const res = await request(app)
        .patch(`/api/orders/${created._id.toString()}/address`)
        .set(authHeader)
        .send({
          shippingAddress: {
            street: "s",
            city: "c",
            state: "st",
            pincode: "1234",
            country: "ct",
          },
        });

      expect(res.status).toBe(200);
      const updated = await orderModel.findById(created._id).lean();
      expect(updated.shippingAddress).toEqual(
        expect.objectContaining({
          street: "s",
          city: "c",
          state: "st",
          zip: "1234",
          country: "ct",
        })
      );
    });

    it("validates address input", async () => {
      const res = await request(app)
        .patch("/api/orders/o1/address")
        .set(authHeader)
        .send({
          shippingAddress: {
            street: "",
            city: "",
            state: "",
            pincode: "12",
            country: "",
          },
        });

      expect(res.status).toBe(400);
    });

    it("rejects when order not pending", async () => {
      const created = await orderModel.create({
        user: "660000000000000000000001",
        items: [],
        status: "CONFIRMED",
        totalPrice: { amount: 50, currency: "INR" },
        shippingAddress: {
          street: "old",
          city: "old",
          state: "old",
          zip: "0000",
          country: "old",
        },
      });

      const res = await request(app)
        .patch(`/api/orders/${created._id.toString()}/address`)
        .set(authHeader)
        .send({
          shippingAddress: {
            street: "s",
            city: "c",
            state: "st",
            pincode: "1234",
            country: "ct",
          },
        });

      expect(res.status).toBe(409);
    });
  });
});
