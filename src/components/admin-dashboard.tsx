import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpDown, Check, Clock3, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";

import { Shell, useSession } from "@/components/bloodconnect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Donor = Database["public"]["Tables"]["profiles"]["Row"];
type HistoryItem = Database["public"]["Tables"]["donation_history"]["Row"];
type AuditItem = Database["public"]["Tables"]["donor_approval_audit"]["Row"];
type ReviewDecision = "approved" | "rejected" | "needs_information";
type Stats = { total: number; pending: number; approved: number; rejected: number; available: number };
type Notice = { tone: "success" | "error"; text: string } | null;
type SortKey = "full_name" | "city" | "created_at" | "approval_status" | "available";

const emptyStats: Stats = { total: 0, pending: 0, approved: 0, rejected: 0, available: 0 };
const statusStyles: Record<string, string> = {
  pending: "bg-warn/15 text-warn",
  needs_information: "bg-warn/15 text-warn",
  approved: "bg-avail/15 text-avail",
  rejected: "bg-brand/10 text-brand-ink",
};

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function timeLabel(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}
function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}
function formatDonorId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function useAdminAccess() {
  const { session, ready } = useSession();
  const isAdmin = (session?.user.app_metadata as Record<string, unknown> | undefined)?.role === "admin";
  return { ready, session, isAdmin };
}

function Feedback({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${notice.tone === "error" ? "border-brand/40 bg-brand/10 text-brand-ink" : "border-avail/40 bg-avail/10 text-ink"}`}>{notice.text}</p>;
}

function AdminAccessMessage({ ready, isAdmin }: { ready: boolean; isAdmin: boolean }) {
  if (!ready) return <div className="mx-auto mt-12 max-w-xl animate-pulse rounded-2xl bg-muted p-12" aria-label="Loading administrator access" />;
  if (!isAdmin) return <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-line bg-card p-8 text-center"><ShieldCheck className="mx-auto size-8 text-brand" /><h1 className="mt-4 font-display text-3xl">Administrator access required</h1><p className="mt-2 text-sm text-ink-soft">Sign in with an authorized administrator account to view donor records.</p><Link to="/profile" className="mt-5 inline-flex rounded-lg bg-trust px-4 py-2 text-sm font-semibold text-primary-foreground">Go to sign in</Link></div>;
  return null;
}

function AdminSidebar() {
  return <aside className="h-fit rounded-2xl border border-line bg-card p-4 lg:sticky lg:top-28"><p className="px-3 pb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">Administrator</p><nav aria-label="Admin navigation" className="flex gap-2 overflow-x-auto lg:flex-col"><Link to={"/admin/dashboard" as never} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-trust-soft hover:text-trust">Dashboard</Link><Link to={"/admin/donor-approvals" as never} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-trust-soft hover:text-trust">Donor approvals</Link></nav></aside>;
}

function AdminLayout({ children }: { children: ReactNode }) {
  return <Shell><main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div className="mb-7 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-trust/15 text-trust"><ShieldCheck className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-trust">BloodConnect administration</p><h1 className="font-display text-3xl font-semibold sm:text-4xl">Donor Approval Panel</h1></div></div><div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"><AdminSidebar /><section className="min-w-0">{children}</section></div></main></Shell>;
}

async function loadStats(): Promise<{ stats: Stats; error: string | null }> {
  const run = () => supabase.from("profiles").select("user_id", { count: "exact", head: true }).not("blood_group", "is", null).not("consent_at", "is", null);
  const [all, pending, approved, rejected, available] = await Promise.all([
    run(),
    run().eq("approval_status", "pending"),
    run().eq("approval_status", "approved"),
    run().eq("approval_status", "rejected"),
    run().eq("approval_status", "approved").eq("available", true),
  ]);
  const error = all.error ?? pending.error ?? approved.error ?? rejected.error ?? available.error;
  return {
    stats: { total: all.count ?? 0, pending: pending.count ?? 0, approved: approved.count ?? 0, rejected: rejected.count ?? 0, available: available.count ?? 0 },
    error: error?.message ?? null,
  };
}

function SummaryCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Total donor requests", value: stats.total, icon: Users, tint: "text-trust bg-trust/10" },
    { label: "Pending approvals", value: stats.pending, icon: Clock3, tint: "text-warn bg-warn/10" },
    { label: "Approved donors", value: stats.approved, icon: Check, tint: "text-avail bg-avail/10" },
    { label: "Rejected requests", value: stats.rejected, icon: X, tint: "text-brand bg-brand/10" },
    { label: "Available donors", value: stats.available, icon: ShieldCheck, tint: "text-trust bg-trust/10" },
  ];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, icon: Icon, tint }) => <article key={label} className="rounded-xl border border-line bg-card p-4 shadow-sm"><span className={`grid size-9 place-items-center rounded-lg ${tint}`}><Icon className="size-4" /></span><p className="mt-4 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p><h2 className="mt-1 text-xs font-medium text-ink-soft">{label}</h2></article>)}</div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status] ?? "bg-muted text-ink"}`}>{statusLabel(status)}</span>;
}

function ReviewButtons({ donor, onSuccess }: { donor: Donor; onSuccess: (message: string) => void }) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitReview() {
    if (!decision) return;
    if (decision !== "approved" && reason.trim().length < 3) {
      setError("Enter at least 3 characters.");
      return;
    }
    setBusy(true); setError("");
    const { error: reviewError } = await supabase.rpc("review_donor", {
      target_donor_id: donor.user_id,
      decision,
      decision_reason: decision === "approved" ? null : reason.trim(),
    });
    setBusy(false);
    if (reviewError) { setError(reviewError.message); return; }
    const message = decision === "approved" ? "Donor approved. They can now appear in eligible donor searches." : decision === "rejected" ? "Donor request rejected and the reason was saved." : "Information request saved. The donor can update their profile and resubmit.";
    setDecision(null); setReason(""); onSuccess(message);
  }

  return <>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={donor.approval_status === "approved"} onClick={() => { setError(""); setDecision("approved"); }}>Approve Donor</Button>
      <Button size="sm" variant="destructive" disabled={donor.approval_status === "rejected"} onClick={() => { setError(""); setDecision("rejected"); }}>Reject</Button>
      <Button size="sm" variant="secondary" disabled={donor.approval_status === "needs_information"} onClick={() => { setError(""); setDecision("needs_information"); }}>Request information</Button>
    </div>
    <Dialog open={decision !== null} onOpenChange={(open) => { if (!open && !busy) { setDecision(null); setReason(""); setError(""); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{decision === "approved" ? "Approve donor?" : decision === "rejected" ? "Reject donor request?" : "Request more information?"}</DialogTitle>
          <DialogDescription>{donor.full_name} · donor {formatDonorId(donor.user_id)} · {donor.blood_group ?? "Blood group missing"}</DialogDescription>
        </DialogHeader>
        {decision === "approved" ? <div className="rounded-lg border border-avail/30 bg-avail/10 p-4 text-sm text-ink"><p>Approval confirms the submitted profile details have been reviewed. It does not certify medical eligibility.</p><p className="mt-2">The database will verify required profile fields and recorded consent before approving.</p></div> : <label className="grid gap-2 text-sm font-medium" htmlFor={`review-reason-${donor.user_id}`}>{decision === "rejected" ? "Rejection reason" : "Information needed"}<Textarea id={`review-reason-${donor.user_id}`} value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} rows={4} required placeholder={decision === "rejected" ? "Explain why this request is rejected" : "List the missing details the donor should provide"} /></label>}
        <Feedback notice={error ? { tone: "error", text: error } : null} />
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDecision(null)}>Cancel</Button><Button variant={decision === "rejected" ? "destructive" : decision === "needs_information" ? "secondary" : "default"} disabled={busy} onClick={() => void submitReview()}>{busy ? "Saving…" : decision === "approved" ? "Confirm approval" : decision === "rejected" ? "Confirm rejection" : "Send request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function useAdminStats(enabled: boolean) {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError("");
    try {
      const result = await loadStats();
      if (result.error) setError(result.error);
      else setStats(result.stats);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load dashboard statistics."); }
    finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { stats, loading, error, refresh };
}

export function AdminDashboardPage() {
  const access = useAdminAccess();
  const { stats, loading, error, refresh } = useAdminStats(access.isAdmin);
  const message = <AdminAccessMessage ready={access.ready} isAdmin={access.isAdmin} />;
  if (!access.ready || !access.isAdmin) return <Shell><main className="mx-auto max-w-4xl px-5">{message}</main></Shell>;
  return <AdminLayout><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-2xl font-semibold">Dashboard overview</h2><p className="mt-1 text-sm text-ink-soft">Live counts from donor profile records.</p></div><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div><div className="mt-5"><Feedback notice={error ? { tone: "error", text: error } : null} /></div><div className="mt-5"><SummaryCards stats={stats} /></div><div className="mt-6 rounded-2xl border border-trust/25 bg-trust-soft/50 p-5"><h2 className="font-semibold">Review queue</h2><p className="mt-1 text-sm text-ink-soft">{stats.pending} donor profiles are waiting for an administrator decision.</p><Link to={"/admin/donor-approvals" as never} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-trust px-4 py-2 text-sm font-semibold text-primary-foreground">Open donor approvals <ArrowUpDown className="size-4" /></Link></div><p className="mt-5 text-xs text-ink-soft">Medical eligibility remains separate from profile approval and follows the existing 90-day donation interval rule.</p></AdminLayout>;
}

export function DonorApprovalsPage() {
  const access = useAdminAccess();
  const { stats, loading: statsLoading, error: statsError, refresh: refreshStats } = useAdminStats(access.isAdmin);
  const [rows, setRows] = useState<Donor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [bloodGroup, setBloodGroup] = useState("all");
  const [city, setCity] = useState("");
  const [availability, setAvailability] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [ascending, setAscending] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [error, setError] = useState("");

  const sanitizedSearch = useMemo(() => search.trim().replace(/[^a-zA-Z0-9@.+ -]/g, " ").replace(/\s+/g, " ").slice(0, 80), [search]);
  const loadRows = useCallback(async () => {
    if (!access.isAdmin) return;
    setLoading(true); setError("");
    try {
      let query = supabase.from("profiles").select("*", { count: "exact" }).order(sort, { ascending }).range(page * pageSize, page * pageSize + pageSize - 1);
      query = query.not("blood_group", "is", null).not("consent_at", "is", null);
      if (bloodGroup !== "all") query = query.eq("blood_group", bloodGroup);
      if (city.trim()) query = query.ilike("city", `%${city.trim().replace(/[%_,()]/g, " ")}%`);
      if (availability !== "all") query = query.eq("available", availability === "available");
      if (status !== "all") query = query.eq("approval_status", status);
      if (sanitizedSearch) {
        const filters = [
          `full_name.ilike.%${sanitizedSearch}%`,
          `city.ilike.%${sanitizedSearch}%`,
          `area.ilike.%${sanitizedSearch}%`,
          `phone.ilike.%${sanitizedSearch}%`,
        ];
        if (/^[0-9a-f-]{36}$/i.test(sanitizedSearch)) filters.push(`user_id.eq.${sanitizedSearch}`);
        query = query.or(filters.join(","));
      }
      const result = await query;
      if (result.error) setError(result.error.message);
      else { setRows((result.data ?? []) as Donor[]); setTotal(result.count ?? 0); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load donor requests."); }
    finally { setLoading(false); }
  }, [access.isAdmin, page, pageSize, sort, ascending, bloodGroup, city, availability, status, sanitizedSearch, refreshToken]);

  useEffect(() => { void loadRows(); }, [loadRows]);
  useEffect(() => { setPage(0); }, [bloodGroup, city, availability, status, sanitizedSearch, pageSize]);

  function handleReview(message: string) {
    setNotice({ tone: "success", text: message });
    void loadRows();
    void refreshStats();
  }
  function sortBy(key: SortKey) {
    if (sort === key) setAscending((value) => !value);
    else { setSort(key); setAscending(true); }
  }
  const accessMessage = <AdminAccessMessage ready={access.ready} isAdmin={access.isAdmin} />;
  if (!access.ready || !access.isAdmin) return <Shell><main className="mx-auto max-w-4xl px-5">{accessMessage}</main></Shell>;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return <AdminLayout>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-2xl font-semibold">Donor requests</h2><p className="mt-1 text-sm text-ink-soft">Search, filter, and review donor registrations. Contact details are shown only to administrators.</p></div><Button variant="outline" onClick={() => { setNotice(null); setRefreshToken((v) => v + 1); void refreshStats(); }} disabled={loading || statsLoading}><RefreshCw className={`size-4 ${loading || statsLoading ? "animate-spin" : ""}`} />Refresh</Button></div>
    <div className="mt-5"><SummaryCards stats={stats} /></div>
    <Feedback notice={notice} />
    <Feedback notice={error || statsError ? { tone: "error", text: error || statsError } : null} />
    <div className="mt-5 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="relative xl:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, donor ID, city, phone" aria-label="Search donor requests" className="pl-9" /></label>
        <Select value={bloodGroup} onValueChange={setBloodGroup}><SelectTrigger aria-label="Filter by blood group"><SelectValue placeholder="Blood group" /></SelectTrigger><SelectContent><SelectItem value="all">All blood groups</SelectItem>{["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}</SelectContent></Select>
        <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Filter by city" aria-label="Filter by city" />
        <div className="grid grid-cols-2 gap-3"><Select value={availability} onValueChange={setAvailability}><SelectTrigger aria-label="Filter by availability"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any availability</SelectItem><SelectItem value="available">Available</SelectItem><SelectItem value="unavailable">Unavailable</SelectItem></SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filter by approval status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="needs_information">Needs info</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft"><span>{loading ? "Loading donor records…" : `${total.toLocaleString()} donor records`}</span><label className="flex items-center gap-2">Rows per page <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></label></div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-ink-soft"><tr>
            <th className="px-3 py-3">Donor ID</th><th className="px-3 py-3"><SortButton label="Donor name" onClick={() => sortBy("full_name")} /></th><th className="px-3 py-3">Blood group</th><th className="px-3 py-3"><SortButton label="City / location" onClick={() => sortBy("city")} /></th><th className="px-3 py-3">Contact</th><th className="px-3 py-3"><SortButton label="Registered" onClick={() => sortBy("created_at")} /></th><th className="px-3 py-3">Last donation</th><th className="px-3 py-3"><SortButton label="Availability" onClick={() => sortBy("available")} /></th><th className="px-3 py-3"><SortButton label="Approval status" onClick={() => sortBy("approval_status")} /></th><th className="px-3 py-3">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((donor) => <tr key={donor.user_id} className="align-top hover:bg-trust-soft/30">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{formatDonorId(donor.user_id)}</td>
              <td className="px-3 py-3"><a className="font-semibold text-trust underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/admin/donors/${encodeURIComponent(donor.user_id)}`}>{donor.full_name || "Incomplete profile"}</a><a className="mt-1 block text-xs text-trust hover:underline" href={`/admin/donors/${encodeURIComponent(donor.user_id)}`}>View details</a></td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold">{donor.blood_group ?? "—"}</td>
              <td className="px-3 py-3">{donor.city}<span className="block text-xs text-ink-soft">{donor.area}</span></td>
              <td className="whitespace-nowrap px-3 py-3">{donor.phone || "Not supplied"}</td>
              <td className="whitespace-nowrap px-3 py-3">{dateLabel(donor.created_at)}</td>
              <td className="whitespace-nowrap px-3 py-3">{dateLabel(donor.last_donation_date)}</td>
              <td className="whitespace-nowrap px-3 py-3"><span className={donor.available ? "text-avail" : "text-ink-soft"}>{donor.available ? "Available" : "Unavailable"}</span></td>
              <td className="whitespace-nowrap px-3 py-3"><StatusBadge status={donor.approval_status} /></td>
              <td className="px-3 py-3"><ReviewButtons donor={donor} onSuccess={handleReview} /></td>
            </tr>)}
            {!loading && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-ink-soft">{error ? "Donor records could not be loaded." : "No donor requests match these filters."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((n) => Math.max(0, n - 1))}>Previous</Button><span className="text-xs text-ink-soft">Page {page + 1} of {pages}</span><Button variant="outline" size="sm" disabled={page + 1 >= pages || loading} onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}>Next</Button></div>
    </div>
  </AdminLayout>;
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 font-semibold hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}<ArrowUpDown className="size-3" /></button>;
}

function eligibilityLabel(donor: Donor) {
  if (!donor.last_donation_date) return "No self-reported donation date";
  const last = new Date(`${donor.last_donation_date}T00:00:00`);
  const days = Math.floor((Date.now() - last.getTime()) / 86_400_000);
  return days >= 90 ? "90-day interval met (self-reported)" : `Wait ${Math.max(0, 90 - days)} more days (self-reported)`;
}

export function AdminDonorDetailsPage({ donorId }: { donorId: string }) {
  const access = useAdminAccess();
  const [donor, setDonor] = useState<Donor | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const loadDetails = useCallback(async () => {
    if (!access.isAdmin || !donorId) return;
    setLoading(true); setError(""); setDonor(null);
    const [profileResult, historyResult, auditResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", donorId).maybeSingle(),
      supabase.from("donation_history").select("*").eq("donor_id", donorId).order("donation_date", { ascending: false }),
      supabase.from("donor_approval_audit").select("*").eq("donor_id", donorId).order("created_at", { ascending: false }),
    ]);
    if (profileResult.error) setError(profileResult.error.message);
    else if (!profileResult.data) setError("Donor record not found or you are not authorized to view it.");
    else setDonor(profileResult.data as Donor);
    if (historyResult.error) setError((current) => current || historyResult.error.message);
    else setHistory((historyResult.data ?? []) as HistoryItem[]);
    if (auditResult.error) setError((current) => current || auditResult.error.message);
    else setAudit((auditResult.data ?? []) as AuditItem[]);
    setLoading(false);
  }, [access.isAdmin, donorId, refreshToken]);

  useEffect(() => { void loadDetails(); }, [loadDetails]);
  function handleReview(message: string) {
    setNotice({ tone: "success", text: message });
    void loadDetails();
  }

  const accessMessage = <AdminAccessMessage ready={access.ready} isAdmin={access.isAdmin} />;
  if (!access.ready || !access.isAdmin) return <Shell><main className="mx-auto max-w-4xl px-5">{accessMessage}</main></Shell>;

  return <AdminLayout>
    <div className="flex flex-wrap items-center justify-between gap-3"><a href="/admin/donor-approvals" className="inline-flex items-center gap-2 text-sm font-semibold text-trust hover:underline"><ArrowLeft className="size-4" />Back to Requests</a><Button variant="outline" disabled={loading} onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
    <div className="mt-4"><Feedback notice={notice} /><Feedback notice={error ? { tone: "error", text: error } : null} /></div>
    {loading && !donor ? <div className="mt-5 h-72 animate-pulse rounded-2xl bg-muted" aria-label="Loading donor details" /> : donor && <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-widest text-trust">Donor ID {donor.user_id}</p><h2 className="mt-2 font-display text-3xl font-semibold">{donor.full_name || "Incomplete profile"}</h2><p className="mt-1 text-sm text-ink-soft">Registered {dateLabel(donor.created_at)} · reviewed {timeLabel(donor.reviewed_at)}</p></div><StatusBadge status={donor.approval_status} /></div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Detail label="Blood group" value={donor.blood_group ?? "Not supplied"} /><Detail label="City and location" value={`${donor.city}, ${donor.area}`} /><Detail label="Contact phone (admin only)" value={donor.phone || "Not supplied"} /><Detail label="Current availability" value={donor.available ? "Available to donate" : "Unavailable"} /><Detail label="Last donation (self-reported)" value={dateLabel(donor.last_donation_date)} /><Detail label="90-day interval check" value={eligibilityLabel(donor)} /><Detail label="Consent recorded" value={donor.consent_at ? `${timeLabel(donor.consent_at)} · ${donor.consent_text_version ?? "version not recorded"}` : "No consent recorded"} /><Detail label="Coordinates (restricted)" value={`${donor.latitude}, ${donor.longitude}`} /><Detail label="Current approval status" value={statusLabel(donor.approval_status)} />
        </dl>
        <p className="mt-5 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-ink">Donation dates are donor-reported. The 90-day interval check is not medical eligibility verification; approval is an administrative profile review only.</p>
      </section>
      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm"><h3 className="font-semibold">Donation history</h3><p className="mt-1 text-xs text-ink-soft">Recorded donor-reported dates from profile updates.</p>{history.length ? <ul className="mt-4 divide-y divide-line">{history.map((item) => <li key={item.id} className="flex justify-between gap-4 py-3 text-sm"><span>{dateLabel(item.donation_date)}</span><span className="text-xs text-ink-soft">Recorded {dateLabel(item.recorded_at)}</span></li>)}</ul> : <p className="mt-4 rounded-lg bg-muted p-4 text-sm text-ink-soft">No donation history has been reported.</p>}</section>
      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm"><h3 className="font-semibold">Administrator actions</h3><p className="mt-1 text-sm text-ink-soft">Every decision is persisted and recorded in the audit trail.</p><div className="mt-4"><ReviewButtons donor={donor} onSuccess={handleReview} /></div></section>
      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm"><h3 className="font-semibold">Approval audit trail</h3>{audit.length ? <ol className="mt-4 space-y-3">{audit.map((item) => <li key={item.id} className="rounded-lg border border-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold capitalize">{statusLabel(item.from_status)} → {statusLabel(item.to_status)}</p><time className="text-xs text-ink-soft">{timeLabel(item.created_at)}</time></div>{item.reason && <p className="mt-2 text-sm text-ink-soft">{item.reason}</p>}<p className="mt-1 text-xs text-ink-soft">Administrator {item.admin_id ?? "account unavailable"}</p></li>)}</ol> : <p className="mt-3 text-sm text-ink-soft">No review decisions recorded yet.</p>}</section>
    </div>}
  </AdminLayout>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-muted/60 p-3"><dt className="text-xs font-medium text-ink-soft">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-ink">{value}</dd></div>;
}
