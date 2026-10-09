"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvestmentAsset,
  createInvestmentValuation,
  getDashboard,
  listInvestmentAssets,
  listInvestmentTransactions,
  listInvestmentValuations,
  listMoneyEvents,
  recordInvestmentFee,
  recordInvestmentIncome,
  recordInvestmentTrade,
  recordInvestmentUnitsChange,
  reverseInvestmentTransaction,
  updateInvestmentAsset,
  type InvestmentAsset,
  type InvestmentTransaction,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

type AssetAction = "trade" | "income" | "fee" | "units" | "valuation";

const ASSET_TYPES = ["Stock", "ETF", "Crypto", "Real Estate", "Bond", "Mutual Fund", "Commodity", "Cash Equivalent", "Other"];
const ACTIONS: { value: AssetAction; label: string; description: string }[] = [
  { value: "trade", label: "Buy or sell", description: "Changes units and real money" },
  { value: "income", label: "Add income", description: "Dividend or investment income" },
  { value: "fee", label: "Add fee", description: "Investment-related cost" },
  { value: "units", label: "Correct units", description: "Split or manual unit change" },
  { value: "valuation", label: "Update value", description: "Record today’s portfolio value" },
];

function currentDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function toCents(value: string) {
  return Math.round(Number(value) * 100);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

function formatUnits(value: string) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function transactionLabel(transaction: InvestmentTransaction) {
  return transaction.action === "dividend" ? "Investment income" : transaction.action === "adjustment" && transaction.money_event_id ? "Cancelled transaction" : transaction.action[0].toUpperCase() + transaction.action.slice(1);
}

export default function InvestmentsPage() {
  const token = getToken();
  const queryClient = useQueryClient();
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [createType, setCreateType] = useState("Stock");
  const [createName, setCreateName] = useState("");
  const [createSymbol, setCreateSymbol] = useState("");
  const [createCurrency, setCreateCurrency] = useState("");
  const [assetAction, setAssetAction] = useState<AssetAction>("trade");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const [units, setUnits] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [unitsAction, setUnitsAction] = useState<"split" | "adjustment">("adjustment");
  const [unitsChange, setUnitsChange] = useState("");
  const [valuationMode, setValuationMode] = useState<"price" | "total">("price");
  const [valuationValue, setValuationValue] = useState("");
  const [actionDate, setActionDate] = useState(currentDate());
  const [note, setNote] = useState("");
  const [editType, setEditType] = useState("Stock");
  const [editName, setEditName] = useState("");
  const [editSymbol, setEditSymbol] = useState("");
  const [reversingTransactionId, setReversingTransactionId] = useState<number | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalDate, setReversalDate] = useState(currentDate());
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["investments", "page"],
    queryFn: async () => {
      const [assets, dashboard, moneyEvents] = await Promise.all([listInvestmentAssets(token!, { includeArchived: true }), getDashboard(token!), listMoneyEvents(token!, { limit: 500 })]);
      return { assets, dashboard, moneyEvents };
    },
    enabled: Boolean(token),
    retry: false,
  });

  const history = useQuery({
    queryKey: ["investments", "history", selectedAssetId],
    queryFn: async () => {
      const [transactions, valuations] = await Promise.all([listInvestmentTransactions(token!, selectedAssetId!), listInvestmentValuations(token!, selectedAssetId!)]);
      return { transactions, valuations };
    },
    enabled: Boolean(token && selectedAssetId),
    retry: false,
  });

  async function refreshInvestments() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["investments"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["money"] }),
    ]);
  }

  function resetAction() {
    setUnits("");
    setUnitPrice("");
    setFees("");
    setExchangeRate("");
    setMoneyAmount("");
    setUnitsChange("");
    setValuationValue("");
    setNote("");
  }

  function selectAsset(asset: InvestmentAsset) {
    setSelectedAssetId(asset.id);
    setAssetAction("trade");
    setTradeAction("buy");
    resetAction();
    setEditType(asset.asset_type);
    setEditName(asset.name);
    setEditSymbol(asset.symbol ?? "");
    setMessage(null);
    setActionError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;
    if (!createName.trim()) {
      setActionError("Enter a name for this asset.");
      return;
    }

    setSaving("create");
    setMessage(null);
    setActionError(null);
    try {
      const created = await createInvestmentAsset(token, { asset_type: createType, name: createName.trim(), symbol: createSymbol.trim() || null, currency: (createCurrency.trim() || data?.dashboard.currency || "MAD").toUpperCase() });
      setCreateName("");
      setCreateSymbol("");
      setCreateCurrency("");
      await refreshInvestments();
      selectAsset(created);
      setMessage("Investment asset created. Add a buy transaction when you purchase units.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not create the asset.");
    } finally {
      setSaving(null);
    }
  }

  async function handleAssetAction(event: FormEvent<HTMLFormElement>, asset: InvestmentAsset) {
    event.preventDefault();
    if (!token || saving || !data) return;
    setSaving("action");
    setMessage(null);
    setActionError(null);

    try {
      if (assetAction === "trade") {
        const unitsNumber = Number(units);
        const priceCents = toCents(unitPrice);
        const feesCents = fees.trim() ? toCents(fees) : 0;
        const rate = exchangeRate.trim() ? Number(exchangeRate) : null;
        if (!Number.isFinite(unitsNumber) || unitsNumber <= 0) throw new Error("Enter units greater than zero.");
        if (!Number.isFinite(priceCents) || priceCents <= 0) throw new Error("Enter a valid price per unit.");
        if (!Number.isFinite(feesCents) || feesCents < 0) throw new Error("Enter valid fees.");
        if (asset.currency !== data.dashboard.currency && (!rate || rate <= 0)) throw new Error(`Enter the exchange rate from ${asset.currency} to ${data.dashboard.currency}.`);
        await recordInvestmentTrade(token, asset.id, { action: tradeAction, units, unit_price_cents: priceCents, fees_cents: feesCents, exchange_rate_to_profile: rate, occurred_on: actionDate, note: note.trim() || null });
      }

      if (assetAction === "income" || assetAction === "fee") {
        const amountCents = toCents(moneyAmount);
        if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error("Enter an amount greater than zero.");
        const payload = { amount_cents: amountCents, occurred_on: actionDate, note: note.trim() || null };
        if (assetAction === "income") await recordInvestmentIncome(token, asset.id, payload);
        else await recordInvestmentFee(token, asset.id, payload);
      }

      if (assetAction === "units") {
        const change = Number(unitsChange);
        if (!Number.isFinite(change) || change === 0) throw new Error("Enter a non-zero unit change. Use a minus sign to remove units.");
        await recordInvestmentUnitsChange(token, asset.id, { action: unitsAction, units_change: unitsChange, occurred_on: actionDate });
      }

      if (assetAction === "valuation") {
        const valueCents = toCents(valuationValue);
        if (!valuationValue.trim() || !Number.isFinite(valueCents) || valueCents < 0) throw new Error("Enter a valid valuation.");
        await createInvestmentValuation(token, asset.id, valuationMode === "price" ? { price_per_unit_cents: valueCents, total_value_cents: null, as_of_date: actionDate } : { price_per_unit_cents: null, total_value_cents: valueCents, as_of_date: actionDate });
      }

      resetAction();
      await refreshInvestments();
      setMessage(assetAction === "valuation" ? "Valuation recorded." : "Investment activity recorded.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not record this investment activity.");
    } finally {
      setSaving(null);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>, asset: InvestmentAsset) {
    event.preventDefault();
    if (!token || saving) return;
    if (!editName.trim() || !editType.trim()) {
      setActionError("The asset name and type cannot be empty.");
      return;
    }

    setSaving("edit");
    setMessage(null);
    setActionError(null);
    try {
      await updateInvestmentAsset(token, asset.id, { asset_type: editType, name: editName.trim(), symbol: editSymbol.trim() || null });
      await refreshInvestments();
      setMessage("Asset details updated.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the asset.");
    } finally {
      setSaving(null);
    }
  }

  async function changeStatus(asset: InvestmentAsset, status: "active" | "archived") {
    if (!token || saving) return;
    setSaving("status");
    setMessage(null);
    setActionError(null);
    try {
      await updateInvestmentAsset(token, asset.id, { status });
      if (status === "archived") setSelectedAssetId(null);
      await refreshInvestments();
      setMessage(status === "archived" ? "Empty asset archived." : "Asset restored.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not update the asset status.");
    } finally {
      setSaving(null);
    }
  }

  async function handleReversal(event: FormEvent<HTMLFormElement>, transactionId: number) {
    event.preventDefault();
    if (!token || saving || !reversalReason.trim()) return;
    setSaving("reversal");
    setMessage(null);
    setActionError(null);
    try {
      await reverseInvestmentTransaction(token, transactionId, { occurred_on: reversalDate, reason: reversalReason.trim() });
      setReversingTransactionId(null);
      setReversalReason("");
      await refreshInvestments();
      setMessage("The mistaken investment transaction was cancelled.");
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Could not cancel the transaction.");
    } finally {
      setSaving(null);
    }
  }

  if (isPending) return <div className="mx-auto h-96 w-full max-w-6xl animate-pulse rounded-[22px] bg-surface" />;
  if (error || !data) return <div className="mx-auto max-w-xl rounded-[20px] border border-border bg-surface p-8 text-center"><h1 className="font-serif text-2xl">Could not load investments</h1><p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Try again."}</p><button type="button" onClick={() => refetch()} className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white">Try again</button></div>;

  const { assets, dashboard, moneyEvents } = data;
  const visibleAssets = assets.filter((asset) => asset.status !== "archived");
  const archivedAssets = assets.filter((asset) => asset.status === "archived");
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId && asset.status !== "archived") ?? null;
  const portfolioValue = visibleAssets.reduce((total, asset) => total + (asset.current_value_cents ?? 0), 0);
  const unknownValues = visibleAssets.filter((asset) => asset.current_value_cents === null).length;
  const investmentCash = dashboard.tracks.find((track) => track.track_kind === "investments")?.balance_cents ?? 0;
  const reversedEventIds = new Set(moneyEvents.filter((event) => event.event_type === "reversal" && event.reverses_event_id !== null).map((event) => event.reverses_event_id));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">Investments</p>
      <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="font-serif text-4xl tracking-tight">Build and understand your portfolio</h1><p className="mt-3 max-w-2xl text-muted-foreground">Track what you own, the real money entering or leaving Investments, and manual portfolio values. Nisba does not place broker orders.</p></div>
        <div className="rounded-[16px] bg-brand px-6 py-4 text-white"><p className="text-xs uppercase tracking-[0.16em] text-white/65">Known portfolio value</p><p className="mt-1 font-serif text-3xl">{formatMoney(portfolioValue, dashboard.currency)}</p><p className="mt-1 text-xs text-white/60">{unknownValues ? `${unknownValues} asset value${unknownValues === 1 ? "" : "s"} missing` : "All active assets valued"}</p></div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-[16px] border border-border bg-surface p-5"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Available investment cash</p><p className="mt-2 font-serif text-2xl">{formatMoney(investmentCash, dashboard.currency)}</p><p className="mt-1 text-xs text-muted-foreground">Used for purchases and fees.</p></div><div className="rounded-[16px] border border-border bg-surface p-5"><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Portfolio assets</p><p className="mt-2 font-serif text-2xl">{visibleAssets.length}</p><p className="mt-1 text-xs text-muted-foreground">Active and fully sold assets.</p></div></div>

      {(message || actionError) && <p role={actionError ? "alert" : "status"} className={`mt-6 rounded-[12px] border px-4 py-3 text-sm ${actionError ? "border-danger/20 bg-danger-tint text-danger" : "border-success/20 bg-success-tint text-success"}`}>{actionError ?? message}</p>}

      <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl">Create an asset</h2><p className="mt-2 text-sm text-muted-foreground">Create the asset first, then record its purchases and value.</p><form onSubmit={handleCreate} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Asset type<select value={createType} onChange={(event) => setCreateType(event.target.value)} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand">{ASSET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label className="text-sm font-medium">Name<input value={createName} onChange={(event) => setCreateName(event.target.value)} required maxLength={150} placeholder="Apple" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
        <label className="text-sm font-medium">Symbol (optional)<input value={createSymbol} onChange={(event) => setCreateSymbol(event.target.value)} maxLength={30} placeholder="AAPL" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 uppercase outline-none focus:border-brand" /></label>
        <label className="text-sm font-medium">Trading currency<input value={createCurrency} onChange={(event) => setCreateCurrency(event.target.value.toUpperCase())} maxLength={3} pattern="[A-Za-z]{3}" placeholder={dashboard.currency} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 uppercase outline-none focus:border-brand" /></label>
        <div className="sm:col-span-2 lg:col-span-4"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "create" ? "Creating…" : "Create asset"}</button></div>
      </form></section>

      <section className="mt-6"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Portfolio</p><h2 className="mt-2 font-serif text-2xl">Your assets</h2></div><p className="text-xs text-muted-foreground">Select an asset to manage it.</p></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleAssets.length === 0 ? <p className="rounded-[16px] border border-border bg-surface p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No assets yet. Create your first asset above.</p> : visibleAssets.map((asset) => <button key={asset.id} type="button" onClick={() => selectAsset(asset)} className={`rounded-[18px] border bg-surface p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${selectedAssetId === asset.id ? "border-brand ring-2 ring-brand/10" : "border-border"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{asset.asset_type}{asset.symbol ? ` · ${asset.symbol}` : ""}</p><h3 className="mt-2 font-serif text-2xl">{asset.name}</h3></div><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${asset.status === "sold" ? "bg-gold-tint text-gold" : "bg-success-tint text-success"}`}>{asset.status === "sold" ? "Sold" : "Active"}</span></div><p className="mt-6 font-serif text-3xl text-brand">{asset.current_value_cents === null ? "Not valued" : formatMoney(asset.current_value_cents, dashboard.currency)}</p><div className="mt-4 flex justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><span>{formatUnits(asset.current_units)} units</span><span>{asset.currency}</span></div></button>)}
      </div></section>

      {selectedAsset && <section className="mt-6 rounded-[20px] border border-brand/20 bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Manage asset</p><h2 className="mt-2 font-serif text-3xl">{selectedAsset.name}</h2><p className="mt-2 text-sm text-muted-foreground">{formatUnits(selectedAsset.current_units)} units · Trades in {selectedAsset.currency} · Portfolio totals in {dashboard.currency}</p></div><button type="button" onClick={() => setSelectedAssetId(null)} className="rounded-[9px] border border-border px-3 py-2 text-xs">Close</button></div>
        <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{ACTIONS.map((item) => <button key={item.value} type="button" onClick={() => { setAssetAction(item.value); resetAction(); setActionError(null); setMessage(null); }} className={`rounded-[12px] border p-4 text-left ${assetAction === item.value ? "border-brand bg-brand-tint" : "border-border"}`}><span className="block text-sm font-medium">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></button>)}</div>

        <form onSubmit={(event) => handleAssetAction(event, selectedAsset)} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assetAction === "trade" && <><label className="text-sm font-medium">Action<select value={tradeAction} onChange={(event) => setTradeAction(event.target.value as "buy" | "sell")} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3"><option value="buy">Buy</option><option value="sell">Sell</option></select></label><label className="text-sm font-medium">Units<input value={units} onChange={(event) => setUnits(event.target.value)} type="number" min="0.00000001" step="0.00000001" required className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label><label className="text-sm font-medium">Price per unit<div className="mt-2 flex rounded-[10px] border border-border px-4"><input value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} type="number" min="0.01" step="0.01" required className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{selectedAsset.currency}</span></div></label><label className="text-sm font-medium">Fees<div className="mt-2 flex rounded-[10px] border border-border px-4"><input value={fees} onChange={(event) => setFees(event.target.value)} type="number" min="0" step="0.01" className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>{selectedAsset.currency !== dashboard.currency && <label className="text-sm font-medium">1 {selectedAsset.currency} equals<input value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} type="number" min="0.00000001" step="0.00000001" required placeholder={`In ${dashboard.currency}`} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>}</>}
          {(assetAction === "income" || assetAction === "fee") && <label className="text-sm font-medium">{assetAction === "income" ? "Income amount" : "Fee amount"}<div className="mt-2 flex rounded-[10px] border border-border px-4"><input value={moneyAmount} onChange={(event) => setMoneyAmount(event.target.value)} type="number" min="0.01" step="0.01" required className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label>}
          {assetAction === "units" && <><label className="text-sm font-medium">Reason<select value={unitsAction} onChange={(event) => setUnitsAction(event.target.value as "split" | "adjustment")} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3"><option value="adjustment">Manual correction</option><option value="split">Stock split</option></select></label><label className="text-sm font-medium">Unit change<input value={unitsChange} onChange={(event) => setUnitsChange(event.target.value)} type="number" step="0.00000001" required placeholder="Use - to remove units" className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label></>}
          {assetAction === "valuation" && <><label className="text-sm font-medium">Valuation method<select value={valuationMode} onChange={(event) => setValuationMode(event.target.value as "price" | "total")} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3"><option value="price">Price per unit</option><option value="total">Total asset value</option></select></label><label className="text-sm font-medium">{valuationMode === "price" ? "Price per unit" : "Total value"}<div className="mt-2 flex rounded-[10px] border border-border px-4"><input value={valuationValue} onChange={(event) => setValuationValue(event.target.value)} type="number" min="0" step="0.01" required className="min-w-0 flex-1 bg-transparent py-3 outline-none" /><span className="py-3 text-xs text-muted-foreground">{dashboard.currency}</span></div></label></>}
          <label className="text-sm font-medium">Date<input value={actionDate} onChange={(event) => setActionDate(event.target.value)} type="date" required className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>
          {(assetAction === "trade" || assetAction === "income" || assetAction === "fee") && <label className="text-sm font-medium lg:col-span-4">Note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full resize-none rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label>}
          <div className="sm:col-span-2 lg:col-span-4"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "action" ? "Saving…" : ACTIONS.find((item) => item.value === assetAction)?.label}</button></div>
        </form>

        <div className="mt-8 border-t border-border pt-7"><h3 className="font-serif text-xl">Asset details</h3><form onSubmit={(event) => handleEdit(event, selectedAsset)} className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Type<select value={editType} onChange={(event) => setEditType(event.target.value)} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3">{ASSET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="text-sm font-medium">Name<input value={editName} onChange={(event) => setEditName(event.target.value)} required maxLength={150} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 outline-none focus:border-brand" /></label><label className="text-sm font-medium">Symbol<input value={editSymbol} onChange={(event) => setEditSymbol(event.target.value)} maxLength={30} className="mt-2 w-full rounded-[10px] border border-border bg-transparent px-4 py-3 uppercase outline-none focus:border-brand" /></label><div className="flex flex-wrap gap-3 sm:col-span-3"><button type="submit" disabled={saving !== null} className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{saving === "edit" ? "Saving…" : "Save details"}</button>{Number(selectedAsset.current_units) === 0 && <button type="button" onClick={() => changeStatus(selectedAsset, "archived")} disabled={saving !== null} className="rounded-[10px] border border-danger/30 px-5 py-3 text-sm font-medium text-danger disabled:opacity-60">Archive empty asset</button>}</div></form></div>

        <div className="mt-8 grid gap-6 border-t border-border pt-7 lg:grid-cols-2"><div><h3 className="font-serif text-xl">Transaction history</h3>{history.isPending ? <p className="mt-4 text-sm text-muted-foreground">Loading transactions…</p> : history.error ? <p className="mt-4 text-sm text-danger">{history.error instanceof Error ? history.error.message : "Could not load transactions."}</p> : <div className="mt-4 space-y-2">{history.data?.transactions.length ? history.data.transactions.map((transaction) => {
          const canReverse = transaction.money_event_id !== null && ["buy", "sell", "dividend", "fee"].includes(transaction.action) && !reversedEventIds.has(transaction.money_event_id);
          return <div key={transaction.id} className="rounded-[12px] bg-surface-alt p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium">{transactionLabel(transaction)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(transaction.occurred_on)} · {Number(transaction.units_change) > 0 ? "+" : ""}{formatUnits(transaction.units_change)} units</p></div>{canReverse && <button type="button" onClick={() => { setReversingTransactionId(reversingTransactionId === transaction.id ? null : transaction.id); setReversalReason(""); }} className="text-xs text-danger">Cancel mistake</button>}</div>{transaction.unit_price_cents !== null && <p className="mt-2 text-xs text-muted-foreground">Price {formatMoney(transaction.unit_price_cents, selectedAsset.currency)} · Fees {formatMoney(transaction.fees_cents, dashboard.currency)}</p>}{reversingTransactionId === transaction.id && <form onSubmit={(event) => handleReversal(event, transaction.id)} className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_145px]"><input value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} required maxLength={500} placeholder="Why was this wrong?" className="rounded-[9px] border border-border bg-transparent px-3 py-2 text-xs outline-none" /><input value={reversalDate} onChange={(event) => setReversalDate(event.target.value)} type="date" required className="rounded-[9px] border border-border bg-transparent px-3 py-2 text-xs outline-none" /><button type="submit" disabled={saving !== null} className="rounded-[9px] bg-danger px-3 py-2 text-xs font-medium text-white sm:col-span-2">Confirm cancellation</button></form>}</div>;
        }) : <p className="rounded-[12px] bg-surface-alt p-4 text-sm text-muted-foreground">No transactions yet.</p>}</div>}</div>
        <div><h3 className="font-serif text-xl">Valuation history</h3>{history.isPending ? <p className="mt-4 text-sm text-muted-foreground">Loading valuations…</p> : <div className="mt-4 space-y-2">{history.data?.valuations.length ? history.data.valuations.map((valuation) => <div key={valuation.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-surface-alt p-4"><div><p className="text-sm font-medium">{valuation.total_value_cents !== null ? formatMoney(valuation.total_value_cents, dashboard.currency) : `${formatMoney(valuation.price_per_unit_cents ?? 0, dashboard.currency)} per unit`}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{valuation.source}</p></div><span className="text-xs text-muted-foreground">{formatDate(valuation.as_of_date)}</span></div>) : <p className="rounded-[12px] bg-surface-alt p-4 text-sm text-muted-foreground">No valuations yet.</p>}</div>}</div></div>
      </section>}

      {archivedAssets.length > 0 && <section className="mt-6 rounded-[20px] border border-border bg-surface p-6 sm:p-8"><h2 className="font-serif text-2xl">Archived assets</h2><div className="mt-5 space-y-2">{archivedAssets.map((asset) => <div key={asset.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] bg-surface-alt px-4 py-3"><div><p className="text-sm font-medium">{asset.name}</p><p className="mt-1 text-xs text-muted-foreground">{asset.asset_type} · {asset.currency}</p></div><button type="button" onClick={() => changeStatus(asset, "active")} disabled={saving !== null} className="rounded-[9px] border border-border px-4 py-2 text-xs disabled:opacity-60">Restore</button></div>)}</div></section>}
    </div>
  );
}
