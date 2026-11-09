const request = require("supertest");

jest.mock("../src/db", () => ({
  product: { findMany: jest.fn().mockResolvedValue([]) }
}));

const app = require("../src/app");

describe("ShopSphere HTTP smoke tests", () => {
  test("GET /health returns service health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "shopsphere-monolith"
    });
  });

  test("GET / renders the storefront", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("ShopSphere");
  });
});
