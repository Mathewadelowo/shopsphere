const path = require("path");
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const prisma = require("./db");

const app = express();

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
  store: new PgSession({
    pool: pgPool,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "development-only-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cartCount = Object.values(req.session.cart || {}).reduce((sum, qty) => sum + qty, 0);
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function formatNaira(cents) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2
  }).format(cents / 100);
}

app.locals.money = formatNaira;

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "shopsphere-monolith" });
});

app.get("/", async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
    res.render("home", { products });
  } catch (error) {
    next(error);
  }
});

app.get("/products/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).render("error", { message: "Product not found" });
    res.render("product", { product });
  } catch (error) {
    next(error);
  }
});

app.get("/register", (req, res) => res.render("register", { error: null }));

app.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).render("register", {
        error: "Provide a name, valid email and password of at least 8 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.toLowerCase().trim(), passwordHash }
    });

    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect("/");
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).render("register", { error: "An account with that email already exists." });
    }
    next(error);
  }
});

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", async (req, res, next) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user && await bcrypt.compare(req.body.password || "", user.passwordHash);

    if (!valid) return res.status(401).render("login", { error: "Invalid email or password." });

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = { id: user.id, name: user.name, email: user.email };
      res.redirect("/");
    });
  } catch (error) {
    next(error);
  }
});

app.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

app.post("/cart/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).send("Product not found");
    if (product.stock < 1) return res.status(409).send("Product is out of stock");

    req.session.cart = req.session.cart || {};
    req.session.cart[product.id] = Math.min((req.session.cart[product.id] || 0) + 1, product.stock);
    res.redirect("/cart");
  } catch (error) {
    next(error);
  }
});

app.get("/cart", async (req, res, next) => {
  try {
    const cart = req.session.cart || {};
    const ids = Object.keys(cart);
    const products = await prisma.product.findMany({ where: { id: { in: ids } } });
    const items = products.map((product) => ({
      product,
      quantity: cart[product.id],
      lineTotal: product.priceCents * cart[product.id]
    }));
    const totalCents = items.reduce((sum, item) => sum + item.lineTotal, 0);
    res.render("cart", { items, totalCents });
  } catch (error) {
    next(error);
  }
});

app.post("/cart/:id/remove", (req, res) => {
  if (req.session.cart) delete req.session.cart[req.params.id];
  res.redirect("/cart");
});

app.post("/checkout", requireAuth, async (req, res, next) => {
  try {
    const cart = req.session.cart || {};
    const ids = Object.keys(cart);
    if (!ids.length) return res.redirect("/cart");

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      if (products.length !== ids.length) throw new Error("One or more products are no longer available.");

      let totalCents = 0;
      const orderItems = [];

      for (const product of products) {
        const quantity = Number(cart[product.id]);
        if (!Number.isInteger(quantity) || quantity < 1 || product.stock < quantity) {
          throw new Error(`${product.name} does not have enough stock.`);
        }
        const updated = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } }
        });
        if (updated.count !== 1) throw new Error(`Stock changed for ${product.name}. Please retry.`);
        totalCents += product.priceCents * quantity;
        orderItems.push({ productId: product.id, quantity, unitPriceCents: product.priceCents });
      }

      return tx.order.create({
        data: {
          userId: req.session.user.id,
          totalCents,
          items: { create: orderItems }
        }
      });
    });

    req.session.cart = {};
    res.redirect(`/orders/${order.id}`);
  } catch (error) {
    res.status(409).render("error", { message: error.message });
  }
});

app.get("/orders", requireAuth, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.session.user.id },
      orderBy: { createdAt: "desc" }
    });
    res.render("orders", { orders });
  } catch (error) {
    next(error);
  }
});

app.get("/orders/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.session.user.id },
      include: { items: { include: { product: true } } }
    });
    if (!order) return res.status(404).render("error", { message: "Order not found" });
    res.render("order", { order });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => res.status(404).render("error", { message: "Page not found" }));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render("error", {
    message: process.env.NODE_ENV === "production" ? "Something went wrong." : error.message
  });
});

module.exports = app;
