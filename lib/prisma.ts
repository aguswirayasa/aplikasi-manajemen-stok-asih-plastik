import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const PRISMA_CLIENT_SCHEMA_VERSION = "product-archiving-20260508";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
}; 
const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 3306,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma =
  globalForPrisma.prismaSchemaVersion === PRISMA_CLIENT_SCHEMA_VERSION &&
  globalForPrisma.prisma
    ? globalForPrisma.prisma
    : new PrismaClient({
        adapter,
      });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = PRISMA_CLIENT_SCHEMA_VERSION;
}
export default prisma; 
