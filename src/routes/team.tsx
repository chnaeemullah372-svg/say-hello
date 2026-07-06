import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, ShieldCheck } from "lucide-react";
import { teamSeed, ROLE_PERMISSIONS } from "@/lib/modules-data";
import { toast } from "sonner";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [
    { title: "Team & Access — Prestige Invoice" },
    { name: "description", content: "Manage team members, roles and permissions." },
  ]}),
  component: TeamPage,
});

function TeamPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Access"
        subtitle="Invite teammates, assign roles and control what they can do"
        action={<Button onClick={() => toast.info("Demo only — backend pending")}><UserPlus className="mr-1.5 h-4 w-4" />Invite Member</Button>}
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Member</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">Role</th>
                <th className="px-6 py-3 text-left">Last active</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {teamSeed.map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {m.name.split(" ").map(w => w[0]).slice(0,2).join("")}
                      </div>
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-6 py-3"><Badge variant="outline" className="bg-primary/5">{m.role}</Badge></td>
                  <td className="px-6 py-3 text-muted-foreground">{m.lastActive}</td>
                  <td className="px-6 py-3 text-center">
                    <Badge variant="outline" className={m.status === "active" ? "bg-accent/15 text-accent border-accent/30 capitalize" : "bg-gold/15 text-gold-foreground border-gold/40 capitalize"}>{m.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Role permissions</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
            <Card key={role}>
              <CardContent className="p-5">
                <div className="font-display text-base font-semibold text-primary">{role}</div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {perms.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
