import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireStaff } from "../_shared/auth.ts";

const TARGETS = [
  "licenses",
  "credit_orders",
  "webhook_events",
  "subscriptions",
  "resellers",
  "lesson_progress",
  "users_keep_admins",
  "credit_packs",
  "pricing_tiers",
] as const;

type Target = (typeof TARGETS)[number];

function isTarget(v: string): v is Target {
  return (TARGETS as readonly string[]).includes(v);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const gate = await requireStaff(req, ["super_admin", "admin"]);
  if ("error" in gate) return gate.error;
  const { user, sb } = gate;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "purge").toLowerCase();
    const confirm = String(body.confirm || "").trim().toUpperCase();
    const rawTargets = Array.isArray(body.targets) ? body.targets.map(String) : [];
    const targets = [...new Set(rawTargets.filter(isTarget))] as Target[];

    if (action === "preview") {
      const [
        licenses,
        batches,
        orders,
        webhooks,
        subscriptions,
        resellers,
        progress,
        packs,
        tiers,
        profiles,
        admins,
      ] = await Promise.all([
        sb.from("licenses").select("key", { count: "exact", head: true }),
        sb.from("license_batches").select("id", { count: "exact", head: true }),
        sb.from("credit_orders").select("id", { count: "exact", head: true }),
        sb.from("webhook_events").select("id", { count: "exact", head: true }),
        sb.from("subscriptions").select("id", { count: "exact", head: true }),
        sb.from("resellers").select("id", { count: "exact", head: true }),
        sb.from("lesson_progress").select("id", { count: "exact", head: true }),
        sb.from("credit_packs").select("id", { count: "exact", head: true }),
        sb.from("credit_pricing_tiers").select("id", { count: "exact", head: true }),
        sb.from("profiles").select("id", { count: "exact", head: true }),
        sb
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("role", ["super_admin", "admin"]),
      ]);

      return jsonResponse({
        ok: true,
        action: "preview",
        counts: {
          licenses: licenses.count || 0,
          license_batches: batches.count || 0,
          credit_orders: orders.count || 0,
          webhook_events: webhooks.count || 0,
          subscriptions: subscriptions.count || 0,
          resellers: resellers.count || 0,
          lesson_progress: progress.count || 0,
          credit_packs: packs.count || 0,
          pricing_tiers: tiers.count || 0,
          profiles_total: profiles.count || 0,
          profiles_admins: admins.count || 0,
          users_to_delete: Math.max(0, (profiles.count || 0) - (admins.count || 0)),
        },
      });
    }

    if (targets.length === 0) {
      return jsonResponse({ ok: false, error: "Selecione ao menos um alvo." }, 400);
    }
    if (confirm !== "APAGAR") {
      return jsonResponse({
        ok: false,
        error: 'Digite APAGAR para confirmar.',
      }, 400);
    }

    const deleted: Record<string, number | string> = {};

    // Order matters when combining targets
    const run = async (t: Target) => {
      if (t === "licenses") {
        const { count: c1, error: e1 } = await sb
          .from("licenses")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        if (e1) throw new Error(e1.message);
        const { count: c2, error: e2 } = await sb
          .from("license_batches")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        if (e2) throw new Error(e2.message);
        deleted.licenses = c1 ?? 0;
        deleted.license_batches = c2 ?? 0;
        return;
      }
      if (t === "credit_orders") {
        const { count } = await sb
          .from("credit_orders")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        deleted.credit_orders = count ?? 0;
        return;
      }
      if (t === "webhook_events") {
        const { count } = await sb
          .from("webhook_events")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        deleted.webhook_events = count ?? 0;
        return;
      }
      if (t === "subscriptions") {
        const { count } = await sb
          .from("subscriptions")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        deleted.subscriptions = count ?? 0;
        return;
      }
      if (t === "resellers") {
        const { count } = await sb
          .from("resellers")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        deleted.resellers = count ?? 0;
        return;
      }
      if (t === "lesson_progress") {
        const { count, error } = await sb
          .from("lesson_progress")
          .delete({ count: "exact" })
          .gte("updated_at", "1970-01-01");
        if (error) throw new Error(error.message);
        deleted.lesson_progress = count ?? 0;
        return;
      }
      if (t === "credit_packs") {
        const { count } = await sb
          .from("credit_packs")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        deleted.credit_packs = count ?? 0;
        return;
      }
      if (t === "pricing_tiers") {
        const { count } = await sb
          .from("credit_pricing_tiers")
          .delete({ count: "exact" })
          .gte("created_at", "1970-01-01");
        deleted.pricing_tiers = count ?? 0;
        return;
      }
      if (t === "users_keep_admins") {
        const { data: keepRows } = await sb
          .from("profiles")
          .select("id, role")
          .in("role", ["super_admin", "admin"]);
        const keep = new Set((keepRows || []).map((r) => r.id));
        keep.add(user.id);

        const { data: all } = await sb.from("profiles").select("id, role, email");
        const toDelete = (all || []).filter((p) => !keep.has(p.id)).map((p) => p.id);
        deleted.users_candidates = toDelete.length;

        if (toDelete.length) {
          // Related rows first
          await sb.from("credit_orders").delete().in("reseller_user_id", toDelete);
          await sb.from("licenses").update({ user_id: null }).in("user_id", toDelete);
          await sb.from("resellers").delete().in("user_id", toDelete);
          await sb.from("subscriptions").delete().in("user_id", toDelete);
          await sb.from("lesson_progress").delete().in("user_id", toDelete);

          let removed = 0;
          const errors: string[] = [];
          for (const id of toDelete) {
            const { error } = await sb.auth.admin.deleteUser(id);
            if (error) errors.push(`${id}: ${error.message}`);
            else removed++;
          }
          deleted.users_deleted = removed;
          if (errors.length) deleted.users_errors = errors.slice(0, 10).join("; ");
        } else {
          deleted.users_deleted = 0;
        }
      }
    };

    // Preferred execution order
    const order: Target[] = [
      "credit_orders",
      "licenses",
      "subscriptions",
      "lesson_progress",
      "webhook_events",
      "resellers",
      "users_keep_admins",
      "credit_packs",
      "pricing_tiers",
    ];
    for (const t of order) {
      if (targets.includes(t)) await run(t);
    }

    return jsonResponse({
      ok: true,
      action: "purge",
      targets,
      deleted,
      kept_admin: user.id,
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
