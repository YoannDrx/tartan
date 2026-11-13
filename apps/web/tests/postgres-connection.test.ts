import { expect, it } from "vitest";
import { Client } from "pg";
import { postgresConnectionString } from "@/lib/postgres-connection";

it.each(["require", "prefer", "verify-ca"])("conserve la validation TLS complète pour %s", (mode) => {
  const connectionString = postgresConnectionString(
    `postgres://test:p%40ss@example.test/db?sslmode=${mode}&application_name=tartan`,
  );
  const url = new URL(connectionString!);
  expect(url.password).toBe("p%40ss");
  expect(url.searchParams.get("application_name")).toBe("tartan");
  expect(url.searchParams.get("sslmode")).toBe("verify-full");
  const client = new Client({ connectionString });
  expect(client.ssl).toEqual({});
  // L'absence de rejectUnauthorized=false et de checkServerIdentity personnalisé garde les contrôles TLS de Node.
});

it.each([
  undefined,
  "postgresql://tartan@localhost:54329/tartan_test",
  "postgres://test@example.test/db?sslmode=verify-full",
  "postgres://test@localhost/db?sslmode=disable",
  "socket:/var/run/postgresql",
  "postgres://test@example.test/db?sslmode=require&uselibpqcompat=true",
])("préserve les réglages explicites ou locaux : %s", (value) => {
  expect(postgresConnectionString(value)).toBe(value);
});
