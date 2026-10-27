/** The navigation the current user may see: groups with their allowed screens and resources. */
import { useMemo } from "react";

import type { ResourceIndexEntry } from "@/api/types";
import { useSession } from "@/auth/session";
import { routeFor, useResourceIndex } from "@/meta/hooks";

import { HIDDEN_ROUTES, NAV, type NavGroup, type NavLink } from "./modules";

export interface NavResource {
  route: string;        // "/fleet/travel-orders"
  path: string;         // "fleet/travel-orders"
  title: string;
  entry: ResourceIndexEntry;
}

export interface VisibleGroup {
  group: NavGroup;
  links: NavLink[];
  primary: NavResource[];
  more: NavResource[];
  /** Where the rail button goes: the overview, else the first screen or resource. */
  landing: string;
}

export function useNav() {
  const index = useResourceIndex();
  const { can } = useSession();
  const groups = useMemo<VisibleGroup[]>(() => {
    const entries = (index.data ?? []).filter((e) => e.permissions.view);
    const byGroup = new Map<string, NavResource[]>();
    for (const e of entries) {
      const route = routeFor(e.endpoint);
      const path = route.slice(1);
      if (HIDDEN_ROUTES.has(path)) continue;
      const seg = path.split("/")[0];
      const g = NAV.find((x) => x.primary.includes(path)) ?? NAV.find((x) => x.segments.includes(seg)) ?? NAV[NAV.length - 1];
      const list = byGroup.get(g.key) ?? [];
      list.push({ route, path, title: e.title, entry: e });
      byGroup.set(g.key, list);
    }
    const out: VisibleGroup[] = [];
    for (const g of NAV) {
      const resources = byGroup.get(g.key) ?? [];
      const links = g.links.filter((l) => (l.code ? can(l.code) : resources.length > 0));
      if (!links.length && !resources.length) continue;
      const primary = g.primary.map((p) => resources.find((r) => r.path === p)).filter(Boolean) as NavResource[];
      const more = resources.filter((r) => !g.primary.includes(r.path)).sort((a, b) => a.title.localeCompare(b.title, "mk"));
      const landing = links.find((l) => l.overview)?.to ?? links[0]?.to ?? primary[0]?.route ?? more[0]?.route ?? "/";
      out.push({ group: g, links, primary, more, landing });
    }
    return out;
  }, [index.data, can]);

  const resources = useMemo(() => groups.flatMap((g) => [...g.primary, ...g.more]), [groups]);
  return { groups, resources, loading: index.isLoading };
}
