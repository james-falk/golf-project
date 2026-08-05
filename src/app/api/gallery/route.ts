import { neon } from "@neondatabase/serverless";
import { del } from "@vercel/blob";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, roleFromToken } from "@/lib/access";
import { cleanCaption, cleanUploader, isVercelBlobUrl, type GalleryPhoto } from "@/lib/gallery";

export const dynamic = "force-dynamic";

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

/** Only the photo's address and its caption live in Postgres; the file itself is in blob storage. */
async function ensureTable(sql: NonNullable<ReturnType<typeof database>>) {
  await sql`CREATE TABLE IF NOT EXISTS gallery_photos (
    id text PRIMARY KEY,
    url text NOT NULL,
    pathname text NOT NULL,
    caption text NOT NULL DEFAULT '',
    uploader text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
}

type PhotoRow = { id: string; url: string; pathname: string; caption: string; uploader: string; created_at: string };

const toPhoto = (row: PhotoRow): GalleryPhoto => ({
  id: row.id,
  url: row.url,
  pathname: row.pathname,
  caption: row.caption,
  uploader: row.uploader,
  createdAt: new Date(row.created_at).toISOString(),
});

export async function GET() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = database();
  if (!sql) return NextResponse.json({ photos: [], storage: false });
  await ensureTable(sql);
  const rows = await sql`SELECT id, url, pathname, caption, uploader, created_at FROM gallery_photos ORDER BY created_at DESC` as PhotoRow[];
  return NextResponse.json({ photos: rows.map(toPhoto), storage: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}

/** Records a photo the browser has just uploaded to blob storage. */
export async function POST(request: Request) {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { url?: string; pathname?: string; caption?: unknown; uploader?: unknown };
  if (!isVercelBlobUrl(body.url)) return NextResponse.json({ error: "That is not a photo this gallery issued" }, { status: 400 });

  const sql = database();
  if (!sql) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  await ensureTable(sql);
  const photo: GalleryPhoto = {
    id: crypto.randomUUID(),
    url: body.url,
    pathname: typeof body.pathname === "string" ? body.pathname : new URL(body.url).pathname.replace(/^\//, ""),
    caption: cleanCaption(body.caption),
    uploader: cleanUploader(body.uploader),
    createdAt: new Date().toISOString(),
  };
  await sql`INSERT INTO gallery_photos (id, url, pathname, caption, uploader)
    VALUES (${photo.id}, ${photo.url}, ${photo.pathname}, ${photo.caption}, ${photo.uploader})`;
  return NextResponse.json({ photo });
}

/** Taking a photo down is a commissioner decision, and removes the file as well as the row. */
export async function DELETE(request: Request) {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (role !== "scorekeeper") return NextResponse.json({ error: "Commissioner access required" }, { status: 403 });
  const { id } = await request.json() as { id?: string };
  if (!id) return NextResponse.json({ error: "A photo id is required" }, { status: 400 });

  const sql = database();
  if (!sql) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  await ensureTable(sql);
  const rows = await sql`DELETE FROM gallery_photos WHERE id = ${id} RETURNING url` as Array<{ url: string }>;
  if (!rows[0]) return NextResponse.json({ error: "That photo is already gone" }, { status: 404 });
  try {
    await del(rows[0].url);
  } catch {
    // The row is gone either way; a stranded blob is cleaned up from the dashboard.
  }
  return NextResponse.json({ ok: true });
}
