import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "export";

export type ModulePermission = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
};

// Mirrors the canonical RLS pattern used across every business table:
// any staff role can view/create/edit, only admin/manager can delete.
// Export has no RLS equivalent (it's a client-side action) so it defaults
// open like view/create/edit. A tenant that never opens Team & Access ->
// Permissions sees exactly this behavior — nothing changes for them.
function roleDefault(role: string | undefined): ModulePermission {
  const canDelete = role === "admin" || role === "manager";
  return { can_view: true, can_create: true, can_edit: true, can_delete: canDelete, can_export: true };
}

// Fetches the current user's staff_permissions overrides once per session
// and exposes a `can(module, action)` check that falls back to the coarse
// role default whenever no override row exists for that module.
export function useStaffPermissions() {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, ModulePermission>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.tenantId || !user.id) { setOverrides({}); setLoaded(true); return; }
    let cancelled = false;
    supabase
      .from("staff_permissions")
      .select("module, can_view, can_create, can_edit, can_delete, can_export")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, ModulePermission> = {};
        for (const row of data ?? []) {
          map[row.module] = {
            can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit,
            can_delete: row.can_delete, can_export: row.can_export,
          };
        }
        setOverrides(map);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [user?.tenantId, user?.id]);

  const can = (module: string, action: PermissionAction) => {
    // Admins always retain full access — permission overrides only ever
    // restrict cashiers/staff/managers, never lock out the account owner.
    if (user?.role === "admin") return true;
    const perm = overrides[module] ?? roleDefault(user?.role);
    return perm[`can_${action}` as const];
  };

  return { can, loaded, overrides };
}
