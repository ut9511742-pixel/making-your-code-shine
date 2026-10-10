import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, HeartPulse, ShieldCheck, Scale, UserRound } from "lucide-react";
import { Shell } from "@/components/bloodconnect";
import { Button } from "@/components/ui/button";

const guidanceSource = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/transactions/bbpublicindex.html";
const faqSource = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/eraktkoshfaq.cnt";

const criteria = [
  { icon: UserRound, title: "Age", value: "18–65 years", text: "General whole-blood donor age range in India. The blood centre confirms eligibility for your circumstances." },
  { icon: Scale, title: "Weight", value: "At least 45 kg", text: "Donation volume depends on your weight and the blood centre’s assessment." },
  { icon: Clock3, title: "Donation interval", value: "90 / 120 days", text: "For whole blood: at least 90 days for male donors and 120 days for female donors. Other donation types have different intervals." },
  { icon: HeartPulse, title: "Health", value: "Feel well today", text: "Be in good general health. The blood centre checks your haemoglobin, vital signs and medical history before donation." },
];

export function EligibilityPage() {
  return <Shell>
    <main>
      <section className="border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-brand"><HeartPulse className="size-4" /> Donor wellbeing</p>
          <h1 className="mt-4 font-display text-5xl font-normal leading-tight text-ink sm:text-6xl">Donation eligibility</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">A little preparation. A life-changing contribution. Check these general guidelines before volunteering to give blood.</p>
          <p className="mt-5 max-w-2xl border-l-2 border-avail pl-4 text-sm leading-relaxed text-ink-soft">Guidance for whole-blood donation in India, not a medical clearance. A qualified blood-centre professional makes the final decision.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-12">
        <h2 className="font-display text-3xl text-ink">The starting criteria</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {criteria.map(({ icon: Icon, title, value, text }, index) => <article key={title} className={`rounded-lg border border-line border-t-4 bg-card p-5 ${index % 2 === 0 ? "border-t-trust" : "border-t-brand"}`}>
            <Icon className={`size-5 ${index % 2 === 0 ? "text-trust" : "text-brand"}`} />
            <h3 className="mt-5 text-sm font-medium text-ink-soft">{title}</h3>
            <p className="mt-1 font-display text-3xl text-ink">{value}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{text}</p>
          </article>)}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">Source: Ministry of Health & Family Welfare, e-RaktKosh <a href={guidanceSource} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-4">whole-blood donation guidance [3]</a>.</p>
        <div className="mt-12 grid gap-10 border-t border-line pt-10 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-3xl text-ink">When to pause and ask</h2>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-ink-soft">
              <li><strong className="text-ink">Illness or medication.</strong> If you feel unwell, have an infection or take antibiotics, discuss the reason and treatment with the blood-centre clinician before donating.</li>
              <li><strong className="text-ink">Pregnancy, recent procedures or exposure.</strong> Tell staff about pregnancy, breastfeeding, recent surgery, tattoos or piercings, vaccination and travel. They will decide whether you need to wait and for how long.</li>
              <li><strong className="text-ink">Alcohol or other substances.</strong> Do not donate while under the influence of alcohol. You must be able to understand and answer the donor questionnaire.</li>
              <li><strong className="text-ink">Medical conditions.</strong> Disclose your health history honestly. Do not stop prescribed medication just to donate; ask your clinician instead.</li>
            </ul>
            <a href={faqSource} target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs text-brand underline underline-offset-4">e-RaktKosh donor FAQs [2]</a>
          </section>
          <section>
            <h2 className="font-display text-3xl text-ink">Before and after donation</h2>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-ink-soft">
              {[
                "Eat your usual meal or a light snack beforehand; do not arrive fasting. Drink water and get adequate rest.",
                "Bring identification and tell the blood-centre team about your last donation and any medication or health concerns.",
                "Complete the centre’s questionnaire and health screening. Matching a blood group does not replace clinical testing or cross-matching.",
                "After donating, rest as directed and follow the centre’s aftercare advice. Tell staff immediately if you feel faint or unwell.",
              ].map((text) => <li key={text} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-avail" /><span>{text}</span></li>)}
            </ul>
          </section>
        </div>
        <section className="mt-10 border-y border-line bg-secondary/50 px-5 py-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><ShieldCheck className="size-5 text-brand" /> A match is not medical approval</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">BloodConnect currently uses a 90-day last-donation check in its matching system. That does not cover every requirement, including the 120-day interval for female whole-blood donors. An “available” or “eligible” result is only a preliminary match; always obtain blood-centre clearance.</p>
        </section>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link to="/profile">My donor profile <ArrowRight /></Link></Button>
          <Button asChild variant="outline"><Link to="/terms">Read Terms & Conditions</Link></Button>
        </div>
      </div>
    </main>
  </Shell>;
}

const terms = [
  { title: "1. About BloodConnect", text: "BloodConnect is a community platform for finding potential donors and coordinating blood requests. It is not a blood bank, hospital, medical provider or emergency-response service. It does not collect, test, store, sell or transfuse blood." },
  { title: "2. Medical decisions and emergencies", text: "Eligibility guidance and matching results are general information, not medical advice or clearance. A licensed blood centre must assess donors and perform the required screening, testing and cross-matching. For urgent care, contact your hospital or local emergency services immediately; do not rely on a platform response." },
  { title: "3. Accounts and accurate information", text: "Keep your profile, availability, location and request details truthful and up to date. Protect your sign-in details, use only an account you are authorised to use, and never impersonate a donor, patient or healthcare professional. Do not post unnecessary patient identifiers or sensitive medical records in request notes." },
  { title: "4. Voluntary participation", text: "Donation and responding to requests are voluntary. Donors may decline, and a response is not a promise that donation will occur. No member may pressure another person to donate, pay for blood or take part in an unsafe collection. Coordinate donations through a licensed blood centre." },
  { title: "5. Privacy and location consent", text: "Donor searches show limited, pseudonymous information rather than raw names, phone numbers or exact coordinates. Contact disclosure is restricted to authorised participants after an accepted blood request. Exact donor location requires separate, explicit donor approval and is visible only to the approved requester. Requesting access or accepting a blood request alone does not authorise exact-location disclosure. Do not copy, publish or reuse another member’s details without permission." },
  { title: "6. Imported demo records", text: "Imported demo donor records are not signed-in members and cannot approve location requests. Demo records and sample matches must not be treated as confirmed, reachable donors or verified commitments to donate." },
  { title: "7. Acceptable use", text: "Do not submit false emergencies, harass members, scrape donor information, attempt unauthorised access, distribute spam or use the service for unlawful activity. Never use shared location or contact information to track, threaten or discriminate against someone." },
  { title: "8. Availability and limitations", text: "Donor availability, distances and request statuses may change or be incomplete. BloodConnect does not guarantee a match, a response, blood availability, location accuracy or uninterrupted access. Independently confirm all arrangements with the donor and hospital. Nothing on this page excludes rights or responsibilities that cannot lawfully be excluded." },
  { title: "9. Changes to these terms", text: "Any final terms should identify the operator, an effective date and a contact for questions or concerns. Material changes should be communicated clearly before they take effect. This draft does not create a new consent record or change how existing accounts work." },
];

export function TermsPage() {
  return <Shell>
    <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-brand"><ShieldCheck className="size-4" /> Community trust</p>
      <h1 className="mt-4 font-display text-5xl font-normal leading-tight text-ink sm:text-6xl">Terms & Conditions</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">Respectful participation. Responsible coordination. Privacy at every step.</p>
      <div role="note" className="mt-6 max-w-3xl border-l-2 border-warn bg-secondary/50 px-5 py-4 text-sm leading-relaxed text-ink-soft"><strong className="text-ink">Draft for review.</strong> These proposed terms need the platform owner’s approval and qualified legal review before being treated as final. Operator details, a support contact and an effective date have not yet been supplied.</div>
      <div className="mt-10 grid gap-10 border-t border-line pt-10 lg:grid-cols-[220px_1fr]">
        <aside><p className="text-xs font-semibold uppercase text-ink-soft">On this page</p><nav aria-label="Terms sections" className="mt-4 space-y-3">{terms.map((section, index) => <a key={section.title} href={`#term-${index + 1}`} className="block text-sm text-ink-soft underline-offset-4 hover:text-brand hover:underline">{section.title}</a>)}</nav></aside>
        <div className="max-w-3xl space-y-8">{terms.map((section, index) => <section key={section.title} id={`term-${index + 1}`} className="scroll-mt-40 border-b border-line pb-8"><h2 className="font-display text-2xl text-ink">{section.title}</h2><p className="mt-3 text-sm leading-7 text-ink-soft">{section.text}</p></section>)}
          <Button asChild variant="outline"><Link to="/eligibility">View donation eligibility <ArrowRight /></Link></Button>
        </div>
      </div>
    </main>
  </Shell>;
}