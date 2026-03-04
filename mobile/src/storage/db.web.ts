/**
 * In-memory DB for web (no expo-sqlite WASM).
 * Same API as db.native.ts so storage repos work unchanged.
 */

export interface DbLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

const kv = new Map<string, { value: string; updated_at: number }>();
const closetItems: Array<{
  id: string;
  name: string;
  category: string;
  tags: string;
  notes: string | null;
  image_local_uri: string | null;
  image_url: string | null;
  cost_cents: number | null;
  created_at: string;
  updated_at: string;
  convex_id: string | null;
}> = [];
const builds: Array<{
  id: string;
  name: string;
  character: string | null;
  status: string;
  notes: string | null;
  image_url: string | null;
  budget_cents: number | null;
  created_at: string;
  updated_at: string;
  convex_id: string | null;
}> = [];
const buildTasks: Array<{
  id: string;
  build_id: string;
  label: string;
  closet_item_id: string | null;
  sort_order: number;
  checked: number;
  created_at: string;
  updated_at: string;
  convex_id: string | null;
}> = [];
const buildItemLinks: Array<{ build_id: string; closet_item_id: string }> = [];
const outbox: Array<{
  id: number;
  type: string;
  payload_json: string;
  created_at: string;
}> = [];
let outboxSeq = 0;
const conventions: Array<{
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  convex_id: string | null;
}> = [];
const conventionDayPlans: Array<{
  id: string;
  convention_id: string;
  date: string;
  build_id: string | null;
  notes: string | null;
}> = [];
const packingListItems: Array<{
  id: string;
  convention_id: string;
  date: string | null;
  build_id: string | null;
  closet_item_id: string | null;
  label: string;
  checked: number;
  created_at: string;
  updated_at: string;
  convex_id: string | null;
}> = [];

let db: DbLike | null = null;

function getWebDb(): DbLike {
  if (db) return db;
  db = {
    async execAsync() {
      // Tables already exist in memory
    },

    async runAsync(sql: string, params: unknown[] = []) {
      // KV
      if (sql.includes("INSERT OR REPLACE INTO kv")) {
        const [key, value] = params as [string, string];
        kv.set(key, { value, updated_at: Math.floor(Date.now() / 1000) });
        return;
      }
      if (sql.includes("DELETE FROM kv WHERE key")) {
        kv.delete(params[0] as string);
        return;
      }
      // closet_items
      if (sql.includes("INSERT INTO closet_items") || sql.includes("ON CONFLICT(id) DO UPDATE")) {
        const p = params as unknown[];
        const id = p[0] as string;
        const name = p[1] as string;
        const category = p[2] as string;
        const tags = p[3] as string;
        const notes = p[4] as string | null;
        const image_local_uri = p[5] as string | null;
        const image_url = p[6] as string | null;
        const cost_cents = (p.length > 7 ? p[7] : null) as number | null;
        const created_at = (p.length > 8 ? p[8] : new Date().toISOString()) as string;
        const updated_at = (p.length > 9 ? p[9] : created_at) as string;
        const idx = closetItems.findIndex((r) => r.id === id);
        const convex_id = (p.length > 10 ? p[10] : null) as string | null;
        const row = {
          id,
          name,
          category,
          tags,
          notes,
          image_local_uri,
          image_url,
          cost_cents: cost_cents ?? null,
          created_at,
          updated_at,
          convex_id: convex_id ?? null,
        };
        if (idx >= 0) closetItems[idx] = row;
        else closetItems.push(row);
        return;
      }
      if (sql.includes("DELETE FROM closet_items WHERE id")) {
        const idx = closetItems.findIndex((r) => r.id === params[0]);
        if (idx >= 0) closetItems.splice(idx, 1);
        return;
      }
      if (sql.includes("UPDATE closet_items SET convex_id")) {
        const [convexId, localId] = params as [string, string];
        const idx = closetItems.findIndex((r) => r.id === localId);
        if (idx >= 0) closetItems[idx] = { ...closetItems[idx], convex_id: convexId };
        return;
      }
      // outbox
      if (sql.includes("INSERT INTO outbox")) {
        outboxSeq += 1;
        outbox.push({
          id: outboxSeq,
          type: params[0] as string,
          payload_json: params[1] as string,
          created_at: (params[2] as string) ?? new Date().toISOString(),
        });
        return;
      }
      if (sql.includes("DELETE FROM outbox WHERE id")) {
        const idx = outbox.findIndex((r) => r.id === (params[0] as number));
        if (idx >= 0) outbox.splice(idx, 1);
        return;
      }
      // builds
      if (sql.includes("INSERT INTO builds (")) {
        const [
          id,
          name,
          character,
          status,
          notes,
          image_url,
          budget_cents,
          created_at,
          updated_at,
        ] = params as [
          string,
          string,
          string | null,
          string,
          string | null,
          string | null,
          number | null,
          string,
          string,
        ];
        const convex_id =
          (params as unknown[]).length > 9 ? ((params as unknown[])[9] as string | null) : null;
        builds.push({
          id,
          name,
          character,
          status,
          notes,
          image_url: image_url ?? null,
          budget_cents: budget_cents ?? null,
          created_at,
          updated_at,
          convex_id: convex_id ?? null,
        });
        return;
      }
      if (sql.includes("UPDATE builds SET")) {
        const [name, character, status, notes, image_url, budget_cents, updated_at, id] =
          params as [
            string,
            string | null,
            string,
            string | null,
            string | null,
            number | null,
            string,
            string,
          ];
        const idx = builds.findIndex((r) => r.id === id);
        if (idx >= 0) {
          builds[idx] = {
            ...builds[idx],
            name,
            character,
            status,
            notes,
            image_url: image_url ?? null,
            budget_cents: budget_cents ?? null,
            updated_at,
          };
        }
        return;
      }
      if (sql.includes("DELETE FROM builds WHERE id")) {
        const idx = builds.findIndex((r) => r.id === params[0]);
        if (idx >= 0) builds.splice(idx, 1);
        return;
      }
      if (sql.includes("UPDATE builds SET convex_id")) {
        const [convexId, localId] = params as [string, string];
        const idx = builds.findIndex((r) => r.id === localId);
        if (idx >= 0) builds[idx] = { ...builds[idx], convex_id: convexId };
        return;
      }
      // build_tasks (params: id, build_id, label, closet_item_id, sort_order, created_at, updated_at; checked=0 in SQL)
      if (sql.includes("INSERT INTO build_tasks (")) {
        const p = params as unknown[];
        const [id, build_id, label, closet_item_id, sort_order, created_at, updated_at] = p as [
          string,
          string,
          string,
          string | null,
          number,
          string,
          string,
        ];
        const convex_id = p.length > 7 ? (p[7] as string | null) : null;
        buildTasks.push({
          id,
          build_id,
          label,
          closet_item_id,
          sort_order,
          checked: 0,
          created_at,
          updated_at,
          convex_id: convex_id ?? null,
        });
        return;
      }
      if (sql.includes("UPDATE build_tasks SET")) {
        const [label, closet_item_id, sort_order, checked, updated_at, id, build_id] = params as [
          string,
          string | null,
          number,
          number,
          string,
          string,
          string,
        ];
        const idx = buildTasks.findIndex((r) => r.id === id && r.build_id === build_id);
        if (idx >= 0) {
          buildTasks[idx] = {
            ...buildTasks[idx],
            label,
            closet_item_id,
            sort_order,
            checked,
            updated_at,
          };
        }
        return;
      }
      if (sql.includes("DELETE FROM build_tasks WHERE id")) {
        if (params.length === 2) {
          const [taskId, buildId] = params as [string, string];
          for (let i = buildTasks.length - 1; i >= 0; i--) {
            if (buildTasks[i].id === taskId && buildTasks[i].build_id === buildId) {
              buildTasks.splice(i, 1);
              break;
            }
          }
        } else {
          const taskId = params[0] as string;
          for (let i = buildTasks.length - 1; i >= 0; i--) {
            if (buildTasks[i].id === taskId) {
              buildTasks.splice(i, 1);
              break;
            }
          }
        }
        return;
      }
      if (sql.includes("UPDATE build_tasks SET convex_id")) {
        const [convexId, localId] = params as [string, string];
        const idx = buildTasks.findIndex((r) => r.id === localId);
        if (idx >= 0) buildTasks[idx] = { ...buildTasks[idx], convex_id: convexId };
        return;
      }
      // build_item_links
      if (sql.includes("DELETE FROM build_item_links WHERE build_id")) {
        const buildId = params[0] as string;
        for (let i = buildItemLinks.length - 1; i >= 0; i--) {
          if (buildItemLinks[i].build_id === buildId) buildItemLinks.splice(i, 1);
        }
        return;
      }
      if (sql.includes("INSERT INTO build_item_links (")) {
        const [build_id, closet_item_id] = params as [string, string];
        buildItemLinks.push({ build_id, closet_item_id });
        return;
      }
      // conventions
      if (sql.includes("INSERT INTO conventions (")) {
        const p = params as unknown[];
        const [id, name, location, start_date, end_date, created_at, updated_at] = p as [
          string,
          string,
          string | null,
          string,
          string,
          string,
          string,
        ];
        const convex_id = p.length > 7 ? (p[7] as string | null) : null;
        conventions.push({
          id,
          name,
          location,
          start_date,
          end_date,
          created_at,
          updated_at,
          convex_id: convex_id ?? null,
        });
        return;
      }
      if (sql.includes("UPDATE conventions SET")) {
        const [name, location, start_date, end_date, updated_at, id] = params as [
          string,
          string | null,
          string,
          string,
          string,
          string,
        ];
        const idx = conventions.findIndex((r) => r.id === id);
        if (idx >= 0) {
          conventions[idx] = {
            ...conventions[idx],
            name,
            location,
            start_date,
            end_date,
            updated_at,
          };
        }
        return;
      }
      if (sql.includes("DELETE FROM conventions WHERE id")) {
        const idx = conventions.findIndex((r) => r.id === params[0]);
        if (idx >= 0) conventions.splice(idx, 1);
        return;
      }
      if (sql.includes("UPDATE conventions SET convex_id")) {
        const [convexId, localId] = params as [string, string];
        const idx = conventions.findIndex((r) => r.id === localId);
        if (idx >= 0) conventions[idx] = { ...conventions[idx], convex_id: convexId };
        return;
      }
      // convention_day_plans
      if (sql.includes("DELETE FROM convention_day_plans WHERE convention_id")) {
        const cid = params[0] as string;
        for (let i = conventionDayPlans.length - 1; i >= 0; i--) {
          if (conventionDayPlans[i].convention_id === cid) conventionDayPlans.splice(i, 1);
        }
        return;
      }
      if (sql.includes("INSERT INTO convention_day_plans (")) {
        const [id, convention_id, date, build_id, notes] = params as [
          string,
          string,
          string,
          string | null,
          string | null,
        ];
        conventionDayPlans.push({ id, convention_id, date, build_id, notes });
        return;
      }
      // packing_list_items
      if (
        sql.includes("DELETE FROM packing_list_items WHERE convention_id") &&
        sql.includes("closet_item_id IS NOT NULL")
      ) {
        const cid = params[0] as string;
        for (let i = packingListItems.length - 1; i >= 0; i--) {
          if (
            packingListItems[i].convention_id === cid &&
            packingListItems[i].closet_item_id != null
          ) {
            packingListItems.splice(i, 1);
          }
        }
        return;
      }
      if (sql.includes("UPDATE packing_list_items SET checked")) {
        const [checked, updated_at, id] = params as [number, string, string];
        const idx = packingListItems.findIndex((r) => r.id === id);
        if (idx >= 0) {
          packingListItems[idx] = {
            ...packingListItems[idx],
            checked,
            updated_at,
          };
        }
        return;
      }
      if (sql.includes("UPDATE packing_list_items SET convex_id")) {
        const [convexId, localId] = params as [string, string];
        const idx = packingListItems.findIndex((r) => r.id === localId);
        if (idx >= 0) packingListItems[idx] = { ...packingListItems[idx], convex_id: convexId };
        return;
      }
      if (sql.includes("INSERT INTO packing_list_items (")) {
        const p = params as unknown[];
        if (p.length >= 10) {
          // Full insert with convex_id (from pull): id, convention_id, date, build_id, closet_item_id, label, checked, created_at, updated_at, convex_id
          const [
            id,
            convention_id,
            date,
            build_id,
            closet_item_id,
            label,
            ,
            created_at,
            updated_at,
            convex_id,
          ] = p as [
            string,
            string,
            string | null,
            string | null,
            string | null,
            string,
            number,
            string,
            string,
            string | null,
          ];
          packingListItems.push({
            id,
            convention_id,
            date,
            build_id,
            closet_item_id,
            label,
            checked: 0,
            created_at,
            updated_at,
            convex_id: convex_id ?? null,
          });
        } else if (p.length === 8) {
          const [id, convention_id, date, build_id, closet_item_id, label, created_at, updated_at] =
            p as [string, string, string, string | null, string, string, string, string];
          packingListItems.push({
            id,
            convention_id,
            date,
            build_id,
            closet_item_id,
            label,
            checked: 0,
            created_at,
            updated_at,
            convex_id: null,
          });
        } else if (p.length === 7) {
          const [id, convention_id, date, build_id, label, created_at, updated_at] = p as [
            string,
            string,
            string | null,
            string | null,
            string,
            string,
            string,
          ];
          packingListItems.push({
            id,
            convention_id,
            date,
            build_id,
            closet_item_id: null,
            label,
            checked: 0,
            created_at,
            updated_at,
            convex_id: null,
          });
        } else if (p.length === 5) {
          const [id, convention_id, label, created_at, updated_at] = p as [
            string,
            string,
            string,
            string,
            string,
          ];
          packingListItems.push({
            id,
            convention_id,
            date: null,
            build_id: null,
            closet_item_id: null,
            label,
            checked: 0,
            created_at,
            updated_at,
            convex_id: null,
          });
        }
        return;
      }
    },

    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const rows = await this.getAllAsync<T>(sql, params);
      return rows[0] ?? null;
    },

    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (sql.includes("FROM kv") && sql.includes("WHERE key")) {
        const key = params[0] as string;
        const row = kv.get(key);
        return (row ? [{ value: row.value }] : []) as T[];
      }
      if (sql.includes("FROM kv ORDER BY")) {
        return Array.from(kv.entries()).map(([key, row]) => ({
          key,
          value: row.value,
          updated_at: row.updated_at,
        })) as T[];
      }
      if (sql.includes("FROM kv WHERE key LIKE")) {
        const prefix = (params[0] as string).replace(/%/g, "") || "";
        return Array.from(kv.entries())
          .filter(([k]) => !prefix || k.startsWith(prefix))
          .map(([key, row]) => ({
            key,
            value: row.value,
            updated_at: row.updated_at,
          })) as T[];
      }
      if (sql.includes("FROM outbox ORDER BY")) {
        return outbox.map((r) => ({ ...r })) as T[];
      }
      if (sql.includes("COUNT(*) as c FROM outbox")) {
        return [{ c: outbox.length }] as T[];
      }
      if (sql.includes("FROM closet_items ORDER BY")) {
        return [...closetItems].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ) as T[];
      }
      if (sql.includes("FROM closet_items WHERE convex_id IS NULL")) {
        return closetItems.filter((r) => r.convex_id == null) as T[];
      }
      if (sql.includes("FROM closet_items WHERE convex_id =")) {
        const cid = params[0] as string;
        return closetItems.filter((r) => r.convex_id === cid) as T[];
      }
      if (sql.includes("FROM closet_items WHERE id =")) {
        const id = params[0] as string;
        const row = closetItems.find((r) => r.id === id);
        return (row ? [row] : []) as T[];
      }
      // builds
      if (sql.includes("FROM builds WHERE id")) {
        const id = params[0] as string;
        const row = builds.find((r) => r.id === id);
        return (row ? [row] : []) as T[];
      }
      if (sql.includes("FROM builds WHERE convex_id IS NULL")) {
        return builds.filter((r) => r.convex_id == null) as T[];
      }
      if (sql.includes("FROM builds WHERE convex_id =")) {
        const cid = params[0] as string;
        return builds.filter((r) => r.convex_id === cid) as T[];
      }
      if (sql.includes("FROM builds ORDER BY")) {
        return [...builds].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ) as T[];
      }
      // build_item_links
      if (sql.includes("FROM build_item_links WHERE build_id")) {
        const buildId = params[0] as string;
        return buildItemLinks
          .filter((r) => r.build_id === buildId)
          .map((r) => ({ closet_item_id: r.closet_item_id })) as T[];
      }
      // build_tasks
      if (sql.includes("FROM build_tasks WHERE id")) {
        const taskId = params[0] as string;
        const buildId = params[1] as string | undefined;
        const row = buildId
          ? buildTasks.find((r) => r.id === taskId && r.build_id === buildId)
          : buildTasks.find((r) => r.id === taskId);
        return (row ? [row] : []) as T[];
      }
      if (sql.includes("FROM build_tasks WHERE build_id")) {
        const buildId = params[0] as string;
        return buildTasks
          .filter((r) => r.build_id === buildId)
          .sort(
            (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
          ) as T[];
      }
      if (sql.includes("FROM build_tasks WHERE convex_id IS NULL")) {
        return buildTasks.filter((r) => r.convex_id == null) as T[];
      }
      // conventions
      if (sql.includes("FROM conventions WHERE id")) {
        const id = params[0] as string;
        const row = conventions.find((r) => r.id === id);
        return (row ? [row] : []) as T[];
      }
      if (sql.includes("FROM conventions WHERE convex_id IS NULL")) {
        return conventions.filter((r) => r.convex_id == null) as T[];
      }
      if (sql.includes("FROM conventions WHERE convex_id =")) {
        const cid = params[0] as string;
        return conventions.filter((r) => r.convex_id === cid) as T[];
      }
      if (sql.includes("FROM conventions ORDER BY")) {
        return [...conventions].sort(
          (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        ) as T[];
      }
      // convention_day_plans
      if (sql.includes("FROM convention_day_plans WHERE convention_id")) {
        const cid = params[0] as string;
        return conventionDayPlans
          .filter((r) => r.convention_id === cid)
          .sort((a, b) => a.date.localeCompare(b.date)) as T[];
      }
      // packing_list_items
      if (sql.includes("COUNT(*) as c FROM packing_list_items")) {
        const cid = params[0] as string;
        const count = packingListItems.filter(
          (r) => r.convention_id === cid && r.date == null && r.build_id == null
        ).length;
        return [{ c: count }] as T[];
      }
      if (sql.includes("FROM packing_list_items WHERE id")) {
        const id = params[0] as string;
        const row = packingListItems.find((r) => r.id === id);
        return (row ? [row] : []) as T[];
      }
      if (sql.includes("FROM packing_list_items WHERE convex_id =")) {
        const cid = params[0] as string;
        const row = packingListItems.find((r) => r.convex_id === cid);
        return (row ? [row] : []) as T[];
      }
      if (sql.includes("FROM packing_list_items WHERE convention_id")) {
        const cid = params[0] as string;
        return packingListItems
          .filter((r) => r.convention_id === cid)
          .sort((a, b) => {
            const dA = a.date ?? "";
            const dB = b.date ?? "";
            if (dA !== dB) return dA.localeCompare(dB);
            return a.label.localeCompare(b.label);
          }) as T[];
      }
      return [];
    },
  };
  return db;
}

export async function initClosetDb(): Promise<DbLike> {
  return getWebDb();
}

export function getDb(): DbLike | null {
  return db;
}

export async function getValue(key: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM kv WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export async function setValue(key: string, value: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [key, value]);
}
