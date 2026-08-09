import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { SaleOrder } from "@/lib/dummy-data";
import { supabase } from "@/integrations/supabase/client";
import { sendOrderStatusUpdate } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/sale-order")({
  head: () => ({ meta: [
    { title: "Sale Orders — CN Invoice" },
    { name: "description", content: "Confirmed customer orders awaiting delivery." },
  ]}),
  component: SaleOrderPage,
});

const statusOptions = [
  { value: "booked", label: "Booked", tone: "border-sapphire/40 text-sapphire" },
  { value: "processing", label: "Processing", tone: "border-amber/40 text-amber" },
  { value: "completed", label: "Completed", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function SaleOrderPage() {
  const { saleOrders, customers, addSaleOrder, updateSaleOrder, deleteSaleOrder, addInvoice } = useStore();
  const nav = useNavigate();
  const [waSettings, setWaSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.whatsapp").maybeSingle()
      .then(({ data }) => { if (data?.setting_value) setWaSettings(data.setting_value as Record<string, any>); });
  }, []);

  // Order Management's per-status WhatsApp templates existed in Settings
  // but never actually fired on a real status change — this sends the
  // matching template (if that status's channel is set to WhatsApp) the
  // moment a sale order's status changes, same trigger point regardless of
  // whether the change came from the board's dropdown or Convert-to-Invoice.
  const notifyStatusChange = (order: SaleOrder, newStatus: string) => {
    if (newStatus === order.status) return;
    const customer = customers.find((c) => c.id === order.customerId);
    sendOrderStatusUpdate(newStatus, order.number, [customer?.whatsapp, customer?.whatsapp2], waSettings)
      .then((result) => { if (result && !result.ok) toast.error(`Order status message failed: ${result.error}`); })
      .catch(() => {});
  };

  const rows: DocRow[] = saleOrders.map((s) => ({
    id: s.id, number: s.number, partyId: s.customerId, date: s.date, secondDate: s.deliveryDate,
    items: s.items, taxRate: s.taxRate, status: s.status, notes: s.notes, convertedId: s.invoiceId,
  }));

  // Standard flow: once a sale order is fulfilled, bill it. Recording the
  // resulting invoice's id (not just a status label) is what lets the
  // Convert button disable itself for good — clicking it twice used to
  // create two invoices from the same order.
  const convertToInvoice = async (row: DocRow & { total: number }) => {
    try {
      const inv = await addInvoice({
        customerId: row.partyId,
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        items: row.items,
        taxRate: row.taxRate,
        taxEnabled: row.taxRate > 0,
        taxInclusive: false,
        paid: 0,
        notes: row.notes,
        status: "unpaid",
      });
      await updateSaleOrder(row.id, { status: "completed", invoiceId: inv.id });
      const order = saleOrders.find((s) => s.id === row.id);
      if (order) notifyStatusChange(order, "completed");
      toast.success(`Converted to invoice ${inv.number}`);
      nav({ to: "/invoices/$id", params: { id: inv.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert to invoice");
    }
  };

  return (
    <DocumentBoard
      title="Sale Orders"
      subtitle={`${saleOrders.length} orders on file`}
      partyLabel="Customer"
      secondDateLabel="Delivery date"
      addLabel="New Sale Order"
      rows={rows}
      parties={customers.filter((c) => c.partyType !== "supplier").map((c) => ({ id: c.id, name: c.name, balance: c.balance }))}
      statusOptions={statusOptions}
      convertLabel="To Invoice"
      onConvert={convertToInvoice}
      onCreate={(row) => addSaleOrder({
        customerId: row.partyId, date: row.date, deliveryDate: row.secondDate ?? "",
        items: row.items, taxRate: row.taxRate, status: row.status as SaleOrder["status"], notes: row.notes,
      })}
      onUpdate={(id, patch) => {
        const order = saleOrders.find((s) => s.id === id);
        if (order && patch.status) notifyStatusChange(order, patch.status);
        return updateSaleOrder(id, {
          customerId: patch.partyId, date: patch.date, deliveryDate: patch.secondDate,
          items: patch.items, taxRate: patch.taxRate, status: patch.status as SaleOrder["status"] | undefined, notes: patch.notes,
        });
      }}
      onDelete={(id) => deleteSaleOrder(id)}
    />
  );
}
