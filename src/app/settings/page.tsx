import Link from "next/link";
import { one } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";
import type { ProfileConfig } from "@/lib/rank/config";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  name: string;
  version: number;
  resume_md: string;
  config_json: string;
  updated_at: string;
}

export default async function Settings() {
  const profile = await one<ProfileRow>(`SELECT * FROM profiles WHERE id = 'me'`);

  if (!profile) {
    return (
      <main className="mx-auto max-w-[820px] px-5 pb-24 pt-8">
        <p className="text-[14px]">
          No profile named &quot;me&quot; yet. Seed one with <code className="mono">npm run db:seed</code>.
        </p>
      </main>
    );
  }

  const config: ProfileConfig = JSON.parse(profile.config_json);

  return (
    <main className="mx-auto max-w-[820px] px-5 pb-24 pt-8">
      <Link href="/inbox" className="text-[13px] text-[color:var(--ink2)] hover:underline">
        Back to inbox
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.03em]">Settings</h1>
          <p className="mt-2 text-[14px] text-[color:var(--ink2)]">
            This is the search intent every posting is scored against. Saving bumps the
            profile version, which invalidates every cached score and re-ranks the corpus.
          </p>
        </div>
        <p className="mono text-[12px] text-[color:var(--ink2)]">
          v{profile.version} · updated {profile.updated_at}
        </p>
      </header>

      <ProfileForm resumeMd={profile.resume_md} config={config} />
    </main>
  );
}
