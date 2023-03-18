// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm/expressions";

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// table definition, this is where the types come from! This should be added to a file somewhere for running migrations
// https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/sqlite-core/README.md#-migrations
const Persons = sqliteTable("Persons", {
  id: integer("PersonID").primaryKey(),
  fullName: text("FirstName"),
  lastName: text("LastName"),
  address: text("Address"),
  city: text("City"),
});

// Custom Proxy HTTP driver for connecting to remote SQLite DB, this hands off the data to Turso which does the DB propogation
const db = drizzle(async (sql, params, method) => {
  console.log({ sql, params, method });

  try {
    if (!process.env.TURSO_URL || !process.env.TURSO_JWT) {
      throw new Error("Missing TURSO_URL or TURSO_TOKEN env variables");
    }

    const result = await fetch(process.env.TURSO_URL, {
      method: "POST",
      body: JSON.stringify({
        statements: [
          {
            // this needs to replace each ? in order with the corresponding param
            q: sql.replace(/\?/g, params[0]),
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.TURSO_JWT,
      },
    });

    const data = await result.json();
    console.log(JSON.stringify({ data }));

    return { rows: data[0].results.rows };
  } catch (e: any) {
    console.log(e);
    console.error("Error from sqlite proxy server: ", e);
    return { rows: [] };
  }
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const users = await db.select().from(Persons).where(eq(Persons.id, 1)).all();
  console.log(users);

  res.status(200).json(users);
}
