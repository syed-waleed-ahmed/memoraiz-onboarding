import { getPool } from "./client";
import type { CompanyProfile } from "../store/profileStore";

export async function getProfileById(profileId: string) {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    "select id, name, industry, description, ai_maturity_level, ai_usage, goals from company_profiles where id = $1",
    [profileId],
  );
  return result.rows[0] ?? null;
}

export async function upsertProfile(
  profileId: string,
  userId: string,
  profile: CompanyProfile,
) {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `insert into company_profiles (id, user_id, name, industry, description, ai_maturity_level, ai_usage, goals)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set
       name = excluded.name,
       industry = excluded.industry,
       description = excluded.description,
       ai_maturity_level = excluded.ai_maturity_level,
       ai_usage = excluded.ai_usage,
       goals = excluded.goals,
       updated_at = now()
     returning id, name, industry, description, ai_maturity_level, ai_usage, goals`,
    [
      profileId,
      userId,
      profile.name,
      profile.industry,
      profile.description,
      profile.aiMaturityLevel,
      profile.aiUsage,
      profile.goals,
    ],
  );
  return result.rows[0] ?? null;
}
