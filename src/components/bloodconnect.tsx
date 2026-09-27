import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Droplets,
  HeartPulse,
  Hospital,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { BLOOD_GROUPS, type BloodGroup, type BloodRequest } from "@/lib/bloodconnect";

type Notice = { tone: "error" | "success"; text: string } | null;
type DonorResult = {
  area: string;
  available: boolean;
  blood_group: string;
  city: string;
  distance_km: number;
  donor_initials: string;
};

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="BloodConnect home">
      <span className="grid size-10 place-items-center rounded-md bg-brand text-primary-foreground shadow-sm">
        <Droplets className="size-5" />
      </span>
      <span>
        <strong className="block font-display text-xl font-semibold leading-none text-ink">BloodConnect</strong>
        <span className="font-mono text-[10px] uppercase text-ink-soft">Community response network</span>
      </span>
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-1 rounded-md border border-line bg-background p-1" aria-label="Main navigation">
            <NavLink to="/" active={pathname === "/"}>Find donors</NavLink>
            <NavLink to="/new-request" active={pathname === "/new-request"}>New request</NavLink>
            <NavLink to="/requests" active={pathname === "/requests"}>My requests</NavLink>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

function NavLink({ to, active, children }: { to: "/" | "/new-request" | "/requests"; active: boolean; children: ReactNode }) {
  return <Link to={to} className={`rounded px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-ink-soft hover:text-ink"}`}>{children}</Link>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p role="status" className={`rounded-md border px-3 py-2 text-sm ${notice.tone === "error" ? "border-brand/30 bg-brand/10 text-brand-ink" : "border-avail/30 bg-avail/10 text-ink"}`}>{notice.text}</p>;
}

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

function AuthPanel() {
  const { session, ready } = useSession();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function authenticate(event: FormEvent<HTMLFormElement>, mode: "signin" | "signup") {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const name = String(values.get("name") ?? "").trim();
    if (!email || password.length < 8 || (mode === "signup" && name.length < 2)) {
      setNotice({ tone: "error", text: "Enter a valid email and a password of at least 8 characters." });
      return;
    }
    setBusy(true); setNotice(null);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setBusy(false);
    setNotice(result.error
      ? { tone: "error", text: result.error.message }
      : { tone: "success", text: mode === "signup" && !result.data.session ? "Check your email to confirm your account." : "You’re signed in." });
  }

  if (!ready) return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  if (session) return (
    <div className="rounded-md border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-avail/15 text-avail"><CheckCircle2 className="size-5" /></span>
        <div><p className="font-semibold text-ink">Connected and ready</p><p className="text-sm text-ink-soft">{session.user.email}</p></div>
      </div>
      <Button variant="outline" className="mt-5 w-full" onClick={() => void supabase.auth.signOut()}><LogOut /> Sign out</Button>
    </div>
  );

  return (
    <div className="rounded-md border border-line bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-5 text-brand" /><h2 className="font-display text-xl font-semibold">Member access</h2></div>
      <Tabs defaultValue="signin">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="signin">Sign in</TabsTrigger><TabsTrigger value="signup">Create account</TabsTrigger></TabsList>
        <TabsContent value="signin"><AuthForm mode="signin" busy={busy} notice={notice} onSubmit={(event) => void authenticate(event, "signin")} /></TabsContent>
        <TabsContent value="signup"><AuthForm mode="signup" busy={busy} notice={notice} onSubmit={(event) => void authenticate(event, "signup")} /></TabsContent>
      </Tabs>
    </div>
  );
}

function AuthForm({ mode, busy, notice, onSubmit }: { mode: "signin" | "signup"; busy: boolean; notice: Notice; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="mt-4 space-y-4" onSubmit={onSubmit}>
      {mode === "signup" && <Field label="Full name"><Input name="name" minLength={2} maxLength={80} autoComplete="name" required /></Field>}
      <Field label="Email"><Input name="email" type="email" maxLength={255} autoComplete="email" required /></Field>
      <Field label="Password"><Input name="password" type="password" minLength={8} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} required /></Field>
      <NoticeBox notice={notice} />
      <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}<ArrowRight /></Button>
    </form>
  );
}

const demoDonors: DonorResult[] = [
  { donor_initials: "PN", blood_group: "O-", city: "Indore", area: "Vijay Nagar", distance_km: 2.4, available: true },
  { donor_initials: "AS", blood_group: "O+", city: "Indore", area: "Palasia", distance_km: 4.1, available: true },
  { donor_initials: "SK", blood_group: "A+", city: "Indore", area: "Bhawarkua", distance_km: 7.8, available: true },
];

export function DonorDesk() {
  const { session } = useSession();
  const [group, setGroup] = useState<BloodGroup>("O+");
  const [radius, setRadius] = useState("10");
  const [donors, setDonors] = useState<DonorResult[]>(demoDonors);
  const [notice, setNotice] = useState<Notice>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!session) { setNotice({ tone: "error", text: "Sign in to search the live donor network." }); return; }
    const { data: profile } = await supabase.from("profiles").select("city,latitude,longitude").eq("user_id", session.user.id).maybeSingle();
    if (!profile) { setNotice({ tone: "error", text: "Complete your member profile before searching." }); return; }
    const { data, error } = await supabase.rpc("search_donors", { search_blood_group: group, search_city: profile.city, search_latitude: profile.latitude, search_longitude: profile.longitude, search_radius_km: Number(radius) });
    if (error) setNotice({ tone: "error", text: error.message });
    else { setDonors(data ?? []); setNotice({ tone: "success", text: `${data?.length ?? 0} compatible donors found.` }); }
  }

  return (
    <Shell>
      <main>
        <section className="border-b border-line bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1fr_360px] lg:px-8 lg:py-16">
            <div className="animate-rise">
              <div className="mb-5 inline-flex items-center gap-2 rounded border border-brand/20 bg-brand/10 px-3 py-1 font-mono text-xs uppercase text-brand-ink"><Activity className="size-3" /> Live community network</div>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-ink md:text-7xl">Find the right donor, when every minute matters.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">Search compatible, eligible blood donors nearby. Personal details stay private until a donor accepts a request.</p>
              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                <Stat icon={<Users />} value="Local" label="verified members" />
                <Stat icon={<Clock3 />} value="90 days" label="eligibility check" />
                <Stat icon={<ShieldCheck />} value="Private" label="contact sharing" />
              </div>
            </div>
            <AuthPanel />
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <form onSubmit={(event) => void search(event)} className="h-fit rounded-md border border-line bg-card p-5 shadow-sm">
              <div className="mb-5"><p className="font-mono text-xs uppercase text-brand">Donor search</p><h2 className="mt-1 font-display text-2xl font-semibold">Match criteria</h2></div>
              <div className="space-y-4">
                <Field label="Blood group"><Select value={group} onValueChange={(value) => setGroup(value as BloodGroup)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BLOOD_GROUPS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Search radius"><Select value={radius} onValueChange={setRadius}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[5,10,20,50].map((item) => <SelectItem key={item} value={String(item)}>{item} km</SelectItem>)}</SelectContent></Select></Field>
                <NoticeBox notice={notice} />
                <Button className="w-full"><Search /> Search donors</Button>
              </div>
            </form>
            <div>
              <div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-xs uppercase text-ink-soft">Nearest first</p><h2 className="font-display text-3xl font-semibold">Available donors</h2></div><span className="text-sm text-ink-soft">{donors.length} matches</span></div>
              <div className="grid gap-3">{donors.map((donor, index) => <DonorCard key={`${donor.donor_initials}-${index}`} donor={donor} />)}</div>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return <div className="border-l-2 border-brand pl-3"><span className="mb-2 block text-brand [&_svg]:size-4">{icon}</span><strong className="block text-sm text-ink">{value}</strong><span className="text-xs text-ink-soft">{label}</span></div>;
}

function DonorCard({ donor }: { donor: DonorResult }) {
  return <article className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-md border border-line bg-card p-4 shadow-sm transition-transform hover:-translate-y-0.5"><span className="grid size-12 place-items-center rounded-md bg-blood-o/15 font-display text-lg font-semibold text-blood-o">{donor.donor_initials}</span><div><div className="flex items-center gap-2"><strong className="text-lg text-ink">Blood group {donor.blood_group}</strong><span className="rounded bg-avail/15 px-2 py-0.5 text-xs font-medium text-avail">Available</span></div><p className="mt-1 flex items-center gap-1 text-sm text-ink-soft"><MapPin className="size-3.5" /> {donor.area}, {donor.city}</p></div><div className="text-right"><strong className="font-mono text-sm text-ink">{donor.distance_km.toFixed(1)} km</strong><p className="text-xs text-ink-soft">away</p></div></article>;
}

export function NewRequestPage() {
  const { session } = useSession();
  const [group, setGroup] = useState<BloodGroup>("O+");
  const [urgency, setUrgency] = useState("urgent");
  const [radius, setRadius] = useState("10");
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) { setNotice({ tone: "error", text: "Sign in before creating an emergency request." }); return; }
    const values = new FormData(event.currentTarget);
    const hospital = String(values.get("hospital") ?? "").trim();
    const note = String(values.get("note") ?? "").trim();
    const units = Number(values.get("units"));
    if (hospital.length < 2 || units < 1 || units > 20 || note.length > 500) { setNotice({ tone: "error", text: "Check the hospital, units, and note before submitting." }); return; }
    const { data: profile } = await supabase.from("profiles").select("city,area,latitude,longitude").eq("user_id", session.user.id).maybeSingle();
    if (!profile) { setNotice({ tone: "error", text: "Complete your member profile before creating a request." }); return; }
    const { error } = await supabase.from("blood_requests").insert({ requester_id: session.user.id, blood_group: group, units, hospital, urgency, radius_km: Number(radius), note, ...profile });
    setNotice(error ? { tone: "error", text: error.message } : { tone: "success", text: "Request created. Compatible donors can now respond." });
    if (!error) event.currentTarget.reset();
  }

  return <Shell><main className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_340px] lg:px-8"><section><p className="font-mono text-xs uppercase text-brand">Emergency coordination</p><h1 className="mt-2 font-display text-5xl font-semibold">Create a blood request</h1><p className="mt-3 max-w-xl text-ink-soft">Share only the essential clinical details. Nearby compatible donors will see the request.</p><form onSubmit={(event) => void submit(event)} className="mt-8 grid gap-5 rounded-md border border-line bg-card p-6 shadow-sm sm:grid-cols-2"><Field label="Blood group needed"><Select value={group} onValueChange={(v) => setGroup(v as BloodGroup)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BLOOD_GROUPS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="Units"><Input name="units" type="number" min={1} max={20} defaultValue={1} required /></Field><div className="sm:col-span-2"><Field label="Hospital"><Input name="hospital" minLength={2} maxLength={120} placeholder="Hospital name" required /></Field></div><Field label="Urgency"><Select value={urgency} onValueChange={setUrgency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></Field><Field label="Notify within"><Select value={radius} onValueChange={setRadius}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[5,10,20,50].map((v) => <SelectItem key={v} value={String(v)}>{v} km</SelectItem>)}</SelectContent></Select></Field><div className="sm:col-span-2"><Field label="Note (optional)"><Textarea name="note" maxLength={500} placeholder="Add timing, ward, or other useful details" /></Field></div><div className="sm:col-span-2"><NoticeBox notice={notice} /><Button className="mt-4 w-full"><HeartPulse /> Send emergency request</Button></div></form></section><aside className="space-y-4"><AuthPanel /><div className="rounded-md border border-line bg-primary p-5 text-primary-foreground"><Hospital className="size-6" /><h2 className="mt-4 font-display text-2xl font-semibold">Privacy by default</h2><p className="mt-2 text-sm opacity-75">Phone details are shared only after a donor accepts your request.</p></div></aside></main></Shell>;
}

export function RequestsPage() {
  const { session, ready } = useSession();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  useEffect(() => {
    if (!session) return;
    void supabase.from("blood_requests").select("id,requester_id,blood_group,units,hospital,city,area,latitude,longitude,radius_km,urgency,note,status,created_at").order("created_at", { ascending: false }).then(({ data }) => setRequests((data ?? []) as BloodRequest[]));
  }, [session]);
  const outgoing = useMemo(() => requests.filter((item) => item.requester_id === session?.user.id), [requests, session]);
  const incoming = useMemo(() => requests.filter((item) => item.requester_id !== session?.user.id), [requests, session]);
  return <Shell><main className="mx-auto max-w-6xl px-5 py-12 lg:px-8"><p className="font-mono text-xs uppercase text-brand">Response desk</p><h1 className="mt-2 font-display text-5xl font-semibold">My requests</h1><p className="mt-3 text-ink-soft">Track requests you created and nearby requests where you can help.</p>{!ready ? <div className="mt-8 h-48 animate-pulse rounded-md bg-muted" /> : !session ? <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]"><Empty title="Sign in to view your request desk" text="Your outgoing and incoming requests will appear here." /><AuthPanel /></div> : <Tabs defaultValue="outgoing" className="mt-8"><TabsList><TabsTrigger value="outgoing">Outgoing ({outgoing.length})</TabsTrigger><TabsTrigger value="incoming">Can help ({incoming.length})</TabsTrigger></TabsList><TabsContent value="outgoing" className="mt-5"><RequestList items={outgoing} empty="You haven’t created a request yet." /></TabsContent><TabsContent value="incoming" className="mt-5"><RequestList items={incoming} empty="No compatible requests are nearby right now." /></TabsContent></Tabs>}</main></Shell>;
}

function RequestList({ items, empty }: { items: BloodRequest[]; empty: string }) {
  if (!items.length) return <Empty title={empty} text="The network updates as new requests arrive." />;
  return <div className="grid gap-3">{items.map((item) => <article key={item.id} className="grid gap-4 rounded-md border border-line bg-card p-5 shadow-sm sm:grid-cols-[80px_1fr_auto]"><span className="grid h-16 place-items-center rounded-md bg-brand/10 font-display text-2xl font-semibold text-brand">{item.blood_group}</span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-ink">{item.hospital}</h2><span className="rounded bg-warn/15 px-2 py-0.5 text-xs font-medium uppercase text-ink">{item.urgency}</span></div><p className="mt-2 text-sm text-ink-soft"><MapPin className="mr-1 inline size-3.5" />{item.area}, {item.city} · {item.units} unit{item.units === 1 ? "" : "s"}</p></div><span className="font-mono text-xs uppercase text-ink-soft">{item.status}</span></article>)}</div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-md border border-dashed border-line bg-card px-6 py-14 text-center"><Droplets className="mx-auto size-8 text-brand" /><h2 className="mt-4 font-display text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm text-ink-soft">{text}</p></div>;
}