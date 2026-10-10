import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Droplets,
  HeartPulse,
  Hospital,
  House,
  LogOut,
  MapPin,
  PencilLine,
  Search,
  ShieldCheck,
  UserRound,
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
      <span className="grid size-10 place-items-center rounded-xl bg-brand text-primary-foreground shadow-md shadow-brand/20">
        <Droplets className="size-5" />
      </span>
      <span>
        <strong className="block font-display text-2xl font-normal leading-none text-ink">BloodConnect</strong>
        <span className="text-[9px] font-semibold uppercase text-ink-soft">Community response network</span>
      </span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8 lg:py-5">
          <Brand />
          <nav className="grid w-full grid-cols-5 gap-1 rounded-xl border border-line bg-card/80 p-1 shadow-sm sm:w-auto" aria-label="Main navigation">
            <NavLink to="/" active={pathname === "/"}><House />Home</NavLink>
            <NavLink to="/donors" active={pathname === "/donors"}><Search />Donors</NavLink>
            <NavLink to="/new-request" active={pathname === "/new-request"}>New request</NavLink>
            <NavLink to="/requests" active={pathname === "/requests"}>My requests</NavLink>
            <NavLink to="/profile" active={pathname === "/profile"}><UserRound />Profile</NavLink>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="text-sm text-ink-soft">BloodConnect · Care starts with community.</p>
          <nav aria-label="Donation guidance and legal" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link to="/eligibility" className="text-ink-soft underline-offset-4 hover:text-brand hover:underline">Donation eligibility</Link>
            <Link to="/terms" className="text-ink-soft underline-offset-4 hover:text-brand hover:underline">Terms & Conditions</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, active, children }: { to: "/" | "/donors" | "/new-request" | "/requests" | "/profile"; active: boolean; children: ReactNode }) {
  return <Link to={to} className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-all sm:px-3 sm:text-sm [&_svg]:hidden [&_svg]:size-3.5 lg:[&_svg]:block ${active ? "bg-ink text-primary-foreground shadow-sm" : "text-ink-soft hover:bg-secondary hover:text-ink"}`}>{children}</Link>;
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

  if (!ready) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (session) return (
    <div className="rounded-2xl border border-line bg-card/85 p-6 shadow-xl shadow-ink/5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-avail/15 text-avail"><CheckCircle2 className="size-5" /></span>
        <div><p className="font-semibold text-ink">Connected and ready</p><p className="text-sm text-ink-soft">{session.user.email}</p></div>
      </div>
      <Button variant="outline" className="mt-5 w-full" onClick={() => void supabase.auth.signOut()}><LogOut /> Sign out</Button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-line bg-card/85 p-6 shadow-xl shadow-ink/5 backdrop-blur-xl lg:p-8">
      <div className="mb-6 text-center"><span className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-brand/10 text-brand"><ShieldCheck className="size-5" /></span><h2 className="font-display text-3xl font-normal">Welcome back</h2><p className="mt-1 text-sm text-ink-soft">Sign in to coordinate your response.</p></div>
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

export function HomePage() {
  return (
    <Shell>
      <main>
        <section className="relative overflow-hidden border-b border-line/70 bg-card">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-secondary/60 lg:block" />
          <div className="absolute -left-32 -top-40 size-96 rounded-full bg-brand/5 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
            <div className="animate-rise self-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase text-brand-ink"><Activity className="size-3" /> 400 verified donor records connected</div>
              <h1 className="max-w-3xl font-display text-6xl font-normal leading-[0.98] text-ink md:text-7xl lg:text-8xl">Connecting <span className="italic text-brand">donors</span>,<br />saving lives.</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">A private, dependable bridge between people who can help and families facing an urgent blood need.</p>
              <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
                <Button asChild size="lg" variant="outline" className="h-auto justify-start rounded-xl px-5 py-4 shadow-sm"><Link to="/profile"><HeartPulse className="text-brand" /><span className="text-left"><strong className="block">Become a donor</strong><span className="text-xs font-normal text-ink-soft">Keep your availability ready</span></span></Link></Button>
                <Button asChild size="lg" className="h-auto justify-start rounded-xl bg-brand px-5 py-4 text-primary-foreground shadow-lg shadow-brand/20 hover:bg-brand-ink"><Link to="/donors"><Search /><span className="text-left"><strong className="block">Find blood</strong><span className="text-xs font-normal opacity-80">Search nearby matches</span></span></Link></Button>
              </div>
              <Button asChild variant="link" className="mt-3 h-auto whitespace-normal px-0 text-brand"><Link to="/eligibility">Can I donate blood? View eligibility criteria <ArrowRight /></Link></Button>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-line pt-6">
                <Stat icon={<Users />} value="400" label="demo donors" />
                <Stat icon={<Clock3 />} value="90 days" label="eligibility check" />
                <Stat icon={<ShieldCheck />} value="Private" label="contact sharing" />
              </div>
            </div>
            <AuthPanel />
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase text-brand">A coordinated response</p><h2 className="mt-2 font-display text-4xl font-normal text-ink">Everything needed to move quickly.</h2></div><p className="max-w-md text-sm leading-relaxed text-ink-soft">From a safe first search to a confirmed response, every step keeps sensitive details protected.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Feature icon={<Search />} title="Search safely" text="Filter nearby compatible donors without exposing names or phone numbers." to="/donors" />
            <Feature icon={<HeartPulse />} title="Raise an alert" text="Send essential request details to eligible donors around your location." to="/new-request" />
            <Feature icon={<Activity />} title="Track responses" text="Follow outgoing requests and see where your help is needed." to="/requests" />
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Feature({ icon, title, text, to }: { icon: ReactNode; title: string; text: string; to: "/donors" | "/new-request" | "/requests" }) {
  return <article className="group rounded-xl border border-line bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5"><span className="grid size-11 place-items-center rounded-xl bg-brand/10 text-brand transition-transform group-hover:scale-105 [&_svg]:size-5">{icon}</span><h2 className="mt-6 font-display text-3xl font-normal">{title}</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p><Button asChild variant="link" className="mt-4 px-0 text-brand"><Link to={to}>Open page <ArrowRight /></Link></Button></article>;
}

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
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[1fr_360px] lg:px-8 lg:py-12">
            <div className="animate-rise">
              <div className="mb-5 inline-flex items-center gap-2 rounded border border-brand/20 bg-brand/10 px-3 py-1 font-mono text-xs uppercase text-brand-ink"><Activity className="size-3" /> Live community network</div>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-ink md:text-6xl">Find compatible donors nearby.</h1>
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
  return <div className="min-w-0"><span className="mb-2 block text-brand [&_svg]:size-4">{icon}</span><strong className="block text-lg text-ink">{value}</strong><span className="block text-xs text-ink-soft">{label}</span></div>;
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

export function ProfilePage() {
  const { session, ready } = useSession();
  const [profile, setProfile] = useState<{ full_name: string; blood_group: BloodGroup | null; city: string; area: string; latitude: number; longitude: number; available: boolean; last_donation_date: string | null; phone: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    void supabase.from("profiles").select("full_name,blood_group,city,area,latitude,longitude,available,last_donation_date,phone").eq("user_id", session.user.id).maybeSingle().then(({ data, error }) => {
      if (error) setNotice({ tone: "error", text: error.message });
      else setProfile(data as typeof profile);
    });
  }, [session]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const values = new FormData(event.currentTarget);
    const full_name = String(values.get("full_name") ?? "").trim();
    const city = String(values.get("city") ?? "").trim();
    const area = String(values.get("area") ?? "").trim();
    const phone = String(values.get("phone") ?? "").trim();
    const latitude = Number(values.get("latitude"));
    const longitude = Number(values.get("longitude"));
    const blood_group = String(values.get("blood_group") ?? "") as BloodGroup;
    const last_donation_date = String(values.get("last_donation_date") ?? "") || null;
    const available = values.get("available") === "on";
    if (full_name.length < 2 || full_name.length > 80 || city.length < 2 || city.length > 80 || area.length < 1 || area.length > 120 || !BLOOD_GROUPS.includes(blood_group) || !/^\+?[0-9 ()-]{7,20}$/.test(phone) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setNotice({ tone: "error", text: "Check your name, blood group, phone, location, and coordinates." }); return;
    }
    setBusy(true); setNotice(null);
    const { error } = await supabase.from("profiles").update({ full_name, blood_group, city, area, phone, latitude, longitude, available, last_donation_date }).eq("user_id", session.user.id);
    setBusy(false);
    setNotice(error ? { tone: "error", text: error.message } : { tone: "success", text: "Profile saved. Your donor availability is up to date." });
    if (!error && profile) setProfile({ ...profile, full_name, blood_group, city, area, phone, latitude, longitude, available, last_donation_date });
  }

  return <Shell><main className="mx-auto max-w-6xl px-5 py-12 lg:px-8"><p className="font-mono text-xs uppercase text-brand">Member record</p><h1 className="mt-2 font-display text-5xl font-semibold">My profile</h1><p className="mt-3 max-w-xl text-ink-soft">Keep your donor details accurate so the network can find the right match.</p>{!ready ? <div className="mt-8 h-64 animate-pulse rounded-md bg-muted" /> : !session ? <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]"><Empty title="Sign in to manage your profile" text="Your private contact and donor details are stored securely." /><AuthPanel /></div> : !profile ? <div className="mt-8 h-64 animate-pulse rounded-md bg-muted" /> : <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]"><form onSubmit={(event) => void save(event)} className="grid gap-5 rounded-md border border-line bg-card p-6 shadow-sm sm:grid-cols-2"><Field label="Full name"><Input name="full_name" defaultValue={profile.full_name} minLength={2} maxLength={80} required /></Field><Field label="Blood group"><Select name="blood_group" defaultValue={profile.blood_group ?? "O+"}><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger><SelectContent>{BLOOD_GROUPS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="Phone"><Input name="phone" type="tel" defaultValue={profile.phone} maxLength={20} required /></Field><Field label="Last donation"><Input name="last_donation_date" type="date" defaultValue={profile.last_donation_date ?? ""} /></Field><Field label="City"><Input name="city" defaultValue={profile.city} minLength={2} maxLength={80} required /></Field><Field label="Area"><Input name="area" defaultValue={profile.area} minLength={1} maxLength={120} required /></Field><Field label="Latitude"><Input name="latitude" type="number" step="any" min={-90} max={90} defaultValue={profile.latitude} required /></Field><Field label="Longitude"><Input name="longitude" type="number" step="any" min={-180} max={180} defaultValue={profile.longitude} required /></Field><label className="flex items-center gap-3 rounded-md border border-line bg-background p-4 sm:col-span-2"><input name="available" type="checkbox" defaultChecked={profile.available} className="size-4 accent-current" /><span><strong className="block text-sm text-ink">Available to donate</strong><span className="text-xs text-ink-soft">Include me in compatible donor searches</span></span></label><div className="sm:col-span-2"><NoticeBox notice={notice} /><Button className="mt-4 w-full" disabled={busy}><PencilLine />{busy ? "Saving…" : "Save profile"}</Button></div></form><aside className="h-fit rounded-md border border-line bg-primary p-5 text-primary-foreground"><ShieldCheck className="size-6" /><h2 className="mt-4 font-display text-2xl font-semibold">Protected details</h2><p className="mt-2 text-sm opacity-75">Your name and phone stay private until you accept a matching request.</p></aside></div>}</main></Shell>;
}

function RequestList({ items, empty }: { items: BloodRequest[]; empty: string }) {
  return <div className="space-y-5"><RequestMapBoundary items={items} />{!items.length ? <Empty title={empty} text="The network updates as new requests arrive." /> : <div className="grid gap-3">{items.map((item) => <article key={item.id} className="grid gap-4 rounded-md border border-line bg-card p-5 shadow-sm sm:grid-cols-[80px_1fr_auto]"><span className="grid h-16 place-items-center rounded-md bg-brand/10 font-display text-2xl font-semibold text-brand">{item.blood_group}</span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-ink">{item.hospital}</h2><span className="rounded bg-warn/15 px-2 py-0.5 text-xs font-medium uppercase text-ink">{item.urgency}</span></div><p className="mt-2 text-sm text-ink-soft"><MapPin className="mr-1 inline size-3.5" />{item.area}, {item.city} · {item.units} unit{item.units === 1 ? "" : "s"}</p></div><span className="font-mono text-xs uppercase text-ink-soft">{item.status}</span></article>)}</div>}</div>;
}

function RequestMapBoundary({ items }: { items: BloodRequest[] }) {
  const [MapComponent, setMapComponent] = useState<ComponentType<{ items: BloodRequest[] }> | null>(null);
  useEffect(() => {
    let active = true;
    void import("./request-tracking-map").then(({ RequestTrackingMap }) => {
      if (active) setMapComponent(() => RequestTrackingMap);
    });
    return () => { active = false; };
  }, []);

  if (!MapComponent) return <div className="h-72 animate-pulse rounded-md border border-line bg-muted" aria-label="Loading request map" />;
  return <MapComponent items={items} />;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-md border border-dashed border-line bg-card px-6 py-14 text-center"><Droplets className="mx-auto size-8 text-brand" /><h2 className="mt-4 font-display text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm text-ink-soft">{text}</p></div>;
}