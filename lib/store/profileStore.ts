export interface CompanyProfile {
  name: string;
  industry: string;
  description: string;
  aiMaturityLevel: string;
  aiUsage: string;
  goals: string;
}

const DEFAULT_PROFILE: CompanyProfile = {
  name: "",
  industry: "",
  description: "",
  aiMaturityLevel: "",
  aiUsage: "",
  goals: "",
};

const profileStore = new Map<string, CompanyProfile>();

export function getProfile(sessionId: string): CompanyProfile {
  return profileStore.get(sessionId) ?? { ...DEFAULT_PROFILE };
}

export function setProfile(sessionId: string, profile: CompanyProfile) {
  profileStore.set(sessionId, { ...DEFAULT_PROFILE, ...profile });
}

export function updateProfileField(
  sessionId: string,
  field: keyof CompanyProfile,
  value: string,
) {
  const current = getProfile(sessionId);
  const next = { ...current, [field]: value };
  profileStore.set(sessionId, next);
  return next;
}
