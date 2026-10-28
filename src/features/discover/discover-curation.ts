import {
  campaigns,
  collectionById,
  collections,
  creatorProfiles,
  networkById,
} from "@/data/catalog";
import type { Campaign, Collection, CollectionCategory } from "@/data/types";

type Exhibition = {
  id: string;
  title: string;
  subtitle: string;
  room: string;
  statement: string;
  leadId: string;
  supportIds: string[];
};

/**
 * Editorial + derived fixtures for the Discovery expansion.
 * Everything here references existing catalog ids; nothing is fetched or live.
 */

/* ------------------------------- Launches --------------------------------- */

/**
 * Recently closed launches. The catalog only carries one ended campaign, so a few
 * illustrative records round out the "Recently launched" view. They use the real
 * Campaign type, reference real collections and carry demo schedule labels only.
 */
function closedLaunch(
  id: string,
  title: string,
  subtitle: string,
  collectionId: string,
  when: string,
): Campaign | null {
  const parent = collectionById[collectionId];
  if (!parent) return null;

  return {
    id,
    title,
    subtitle,
    startsAt: `${when} · demo schedule`,
    status: "ended",
    collectionId,
    cover: parent.banner,
    networkId: parent.networkId,
    creatorId: parent.creatorId,
    supply: parent.items,
    isIllustrative: true,
    eligibilitySummary:
      "Illustrative closed launch. No wallet, mint or reward is available.",
  };
}

export const recentLaunches: Campaign[] = [
  ...campaigns.filter((c) => c.status === "ended"),
  closedLaunch(
    "dx-obsidian-first-light",
    "First Light",
    "Obsidian Choir · Opening edition",
    "obsidian-choir",
    "Closed Oct 04",
  ),
  closedLaunch(
    "dx-aether-frame-run",
    "Frame Run 01",
    "Aether Frames · Colour study",
    "aether-frames",
    "Closed Sep 28",
  ),
  closedLaunch(
    "dx-tideform-low-tide",
    "Low Tide Survey",
    "Tideform · Photography edition",
    "tideform",
    "Closed Sep 19",
  ),
].filter((c): c is Campaign => Boolean(c));

export const launchesByStatus = {
  live: campaigns.filter((c) => c.status === "live"),
  upcoming: campaigns.filter((c) => c.status === "upcoming"),
  recent: recentLaunches,
};

/* ------------------------------- Emerging --------------------------------- */

/** Collections with the smallest holder base in the demo catalog (discovery lens only). */
export function emergingCollections(count = 6): Collection[] {
  return [...collections].sort((a, b) => a.owners - b.owners).slice(0, count);
}

/** Median holder count; used to label cards as established vs emerging. */
export const medianOwners = (() => {
  const sorted = collections.map((c) => c.owners).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
})();

export const isEmerging = (collection: Collection) =>
  collection.owners < medianOwners;

/* ------------------------------- Categories ------------------------------- */

export const categoryCopy: Record<
  CollectionCategory,
  { title: string; blurb: string }
> = {
  art: {
    title: "Art",
    blurb: "Sculptural light, generative studies and gallery-minded editions.",
  },
  identity: {
    title: "Identity",
    blurb: "Avatars and portraits with a point of view.",
  },
  gaming: {
    title: "Gaming",
    blurb: "Relics, guardians and worlds you could step into.",
  },
  photography: {
    title: "Photography",
    blurb: "Coastal surveys and atmospheric studies.",
  },
  membership: {
    title: "Membership",
    blurb: "Passes and keepsakes for small communities.",
  },
};

/* -------------------------------- Creators -------------------------------- */

export function featuredCreators(count = 7) {
  return creatorProfiles
    .map((profile) => {
      const owned = profile.collectionIds
        .map((id) => collectionById[id])
        .filter((c): c is Collection => Boolean(c));

      return {
        profile,
        collections: owned,
        items: owned.reduce((sum, c) => sum + c.items, 0),
        holders: owned.reduce((sum, c) => sum + c.owners, 0),
        networks: profile.networkIds
          .map((id) => networkById[id])
          .filter(Boolean),
      };
    })
    .filter((entry) => entry.collections.length > 0)
    .sort(
      (a, b) =>
        b.collections.length - a.collections.length || b.holders - a.holders,
    )
    .slice(0, count);
}

export const creatorKindLabel: Record<string, string> = {
  studio: "Studio",
  dao: "Community",
  protocol: "Protocol",
  "fictional-studio": "Demo studio",
};

/* ------------------------------ Exhibitions ------------------------------- */

export const exhibitions: Exhibition[] = [
  {
    id: "generative-frontiers",
    title: "Generative Frontiers",
    subtitle: "Where code becomes a canvas",
    room: "The Generative Wing",
    statement: "Explore the intersection of code, form, and digital art.",
    leadId: "aether-frames",
    supportIds: ["obsidian-choir", "tideform"],
  },
  {
    id: "digital-identities",
    title: "Digital Identities",
    subtitle: "Portraits, presence and belonging",
    room: "The Identity Gallery",
    statement:
      "Discover portraits and digital identities shaped by creative communities.",
    leadId: "obsidian-choir",
    supportIds: ["aether-frames", "tideform"],
  },
  {
    id: "living-landscapes",
    title: "Living Landscapes",
    subtitle: "Studies of light, nature and motion",
    room: "The Landscape Gallery",
    statement: "Experience atmospheric studies of nature, light, and motion.",
    leadId: "tideform",
    supportIds: ["aether-frames", "obsidian-choir"],
  },
];
