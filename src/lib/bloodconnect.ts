export const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

export const DONOR_CONSENT_VERSION = "bloodconnect-donor-v1";
export const DONOR_CONSENT_TEXT = "I consent to BloodConnect coordinators reviewing my donor details and sharing my contact details only with matched request participants.";

export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export type Profile = {
  user_id: string;
  full_name: string;
  blood_group: BloodGroup | null;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  available: boolean;
  last_donation_date: string | null;
};

export type BloodRequest = {
  id: string;
  requester_id: string;
  blood_group: BloodGroup;
  units: number;
  hospital: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  urgency: "standard" | "urgent" | "critical";
  note: string;
  status: "open" | "matched" | "fulfilled" | "closed";
  created_at: string;
};

export type RequestResponse = {
  id: string;
  request_id: string;
  donor_id: string;
  response: "accepted" | "declined";
  message: string;
  created_at: string;
};

export function canDonate(donor: BloodGroup, recipient: BloodGroup) {
  const compatible: Record<BloodGroup, BloodGroup[]> = {
    "O-": [...BLOOD_GROUPS],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A-", "A+", "AB-", "AB+"],
    "A+": ["A+", "AB+"],
    "B-": ["B-", "B+", "AB-", "AB+"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB-", "AB+"],
    "AB+": ["AB+"],
  };
  return compatible[donor].includes(recipient);
}

export function distanceKm(a: Pick<Profile, "latitude" | "longitude">, b: Pick<Profile, "latitude" | "longitude">) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat = radians(b.latitude - a.latitude);
  const lng = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function isEligible(profile: Profile) {
  if (!profile.last_donation_date) return true;
  const last = new Date(`${profile.last_donation_date}T00:00:00`);
  const days = (Date.now() - last.getTime()) / 86_400_000;
  return days >= 90;
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "BC";
}