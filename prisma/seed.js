const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const products = [
  {
    name: "Wireless Headphones",
    description: "Over-ear headphones with noise isolation and long battery life.",
    priceCents: 1850000,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=640&auto=format&fit=crop&q=80",
    stock: 18
  },
  {
    name: "Mechanical Keyboard",
    description: "A compact mechanical keyboard for work and gaming.",
    priceCents: 950000,
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=640&auto=format&fit=crop&q=80",
    stock: 25
  },
  {
    name: "USB-C Hub",
    description: "Multiport USB-C hub with HDMI and USB 3.0 ports.",
    priceCents: 420000,
    imageUrl: "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=640&auto=format&fit=crop&q=80",
    stock: 30
  },
  {
    name: "27-inch Monitor",
    description: "QHD monitor suitable for development and productivity.",
    priceCents: 3250000,
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=640&auto=format&fit=crop&q=80",
    stock: 8
  }
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: `seed-${product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` },
      update: product,
      create: { id: `seed-${product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, ...product }
    });
  }
  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
