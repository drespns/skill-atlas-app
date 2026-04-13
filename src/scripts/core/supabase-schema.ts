type SupabaseLike = {
  from: (table: string) => any;
};

const KEY_TECH_KIND = "skillatlas_db_has_technologies_kind_v1";

export async function supportsTechnologiesKindColumn(supabase: SupabaseLike): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(KEY_TECH_KIND);
    if (cached === "1") return true;
    if (cached === "0") return false;
  } catch {
    // ignore
  }

  let ok = false;
  try {
    // If column doesn't exist, Supabase returns an error.
    const res = await supabase.from("technologies").select("kind").limit(1);
    ok = !res?.error;
  } catch {
    ok = false;
  }

  try {
    sessionStorage.setItem(KEY_TECH_KIND, ok ? "1" : "0");
  } catch {
    // ignore
  }
  return ok;
}

const KEY_TECH_PARENT = "skillatlas_db_has_technologies_parent_v1";

export async function supportsTechnologiesParentColumn(supabase: SupabaseLike): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(KEY_TECH_PARENT);
    if (cached === "1") return true;
    if (cached === "0") return false;
  } catch {
    // ignore
  }

  let ok = false;
  try {
    const res = await supabase.from("technologies").select("parent_technology_id").limit(1);
    ok = !res?.error;
  } catch {
    ok = false;
  }

  try {
    sessionStorage.setItem(KEY_TECH_PARENT, ok ? "1" : "0");
  } catch {
    // ignore
  }
  return ok;
}

