import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Package, FileText, PlusCircle, FileSpreadsheet,
  Warehouse, Wallet, BarChart3, Settings, Sparkles, Truck, PackageMinus, PackageX,
  ShoppingCart, ClipboardList, Receipt, Landmark, Repeat, Trophy, ShieldCheck,
  UserCircle2, Factory, MessageCircle,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Create Invoice", url: "/invoices/new", icon: PlusCircle, highlight: true },
];

const salesItems = [
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Estimates", url: "/estimates", icon: FileSpreadsheet },
  { title: "Sale Orders", url: "/sale-order", icon: ClipboardList },
  { title: "Delivery Notes", url: "/delivery-note", icon: Truck },
  { title: "Sale Returns", url: "/sale-return", icon: PackageMinus },
  { title: "Client / Supplier", url: "/customers", icon: Users },
  { title: "Subscriptions", url: "/subscriptions", icon: Repeat },
];

const stockItems = [
  { title: "Product / Service", url: "/products", icon: Package },
  { title: "Inventory", url: "/inventory", icon: Warehouse },
  { title: "Purchases", url: "/purchases", icon: ShoppingCart },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ClipboardList },
  { title: "Purchase Returns", url: "/purchase-return", icon: PackageX },
  { title: "Production Entry", url: "/production-entry", icon: Factory },
  { title: "Import", url: "/import", icon: FileSpreadsheet },
];

const financeItems = [
  { title: "Payments", url: "/payments", icon: Wallet },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Fund Management", url: "/funds", icon: Landmark },
  { title: "Commissions", url: "/commissions", icon: Trophy },
  { title: "Agents", url: "/agent", icon: UserCircle2 },
  { title: "WhatsApp Monitoring", url: "/whatsapp-logs", icon: MessageCircle },
];

const insightItems = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Team & Access", url: "/team", icon: ShieldCheck },
  { title: "Settings", url: "/settings", icon: Settings },
];

function Group({ label, items, isActive }: { label: string; items: { title: string; url: string; icon: any; highlight?: boolean }[]; isActive: (u: string) => boolean }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url} className={item.highlight ? "font-semibold" : ""}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                  {item.highlight && (
                    <span className="ml-auto rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-foreground group-data-[collapsible=icon]:hidden">
                      New
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  const initials = user ? user.name.split(" ").map(w => w[0]).slice(0, 2).join("") : "GU";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold text-gold-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-display text-base font-bold leading-tight text-sidebar-foreground">Prestige</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Invoice Suite</div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <Group label="Overview" items={mainItems} isActive={isActive} />
        <Group label="Sales" items={salesItems} isActive={isActive} />
        <Group label="Stock & Suppliers" items={stockItems} isActive={isActive} />
        <Group label="Finance" items={financeItems} isActive={isActive} />
        <Group label="Insights" items={insightItems} isActive={isActive} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sidebar-foreground">{user?.name || "Guest"}</div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">{user?.role || "Not signed in"} · Prestige Store</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
