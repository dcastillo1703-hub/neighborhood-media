export type MobileNavItemKey =
  | "home"
  | "content"
  | "approvals"
  | "campaigns"
  | "calendar"
  | "performance"
  | "web-analytics"
  | "operations"
  | "settings";

export type MobileNavOption = {
  key: MobileNavItemKey;
  href: string;
  label: string;
  description: string;
};

export const mobileNavStorageKey = "nmos-mobile-nav-items";
export const mobileNavUpdatedEvent = "nmos-mobile-nav-updated";
export const maxMobileNavItems = 5;

export const defaultMobileNavItemKeys: MobileNavItemKey[] = [
  "home",
  "content",
  "approvals",
  "campaigns",
  "settings"
];

export const mobileNavOptions: MobileNavOption[] = [
  {
    key: "home",
    href: "/",
    label: "Home",
    description: "Client home and overview"
  },
  {
    key: "content",
    href: "/content",
    label: "My tasks",
    description: "Scheduled content and project-linked work"
  },
  {
    key: "approvals",
    href: "/approvals",
    label: "Inbox",
    description: "Approvals, reviews, and waiting items"
  },
  {
    key: "campaigns",
    href: "/campaigns",
    label: "Projects",
    description: "Campaigns and project workspaces"
  },
  {
    key: "calendar",
    href: "/calendar",
    label: "Calendar",
    description: "Upcoming work by date"
  },
  {
    key: "performance",
    href: "/performance",
    label: "Growth",
    description: "Performance and ROI reads"
  },
  {
    key: "web-analytics",
    href: "/web-analytics",
    label: "Web",
    description: "Website traffic, sources, pages, and campaign attribution"
  },
  {
    key: "operations",
    href: "/operations",
    label: "Ops",
    description: "Operational tasks and activity"
  },
  {
    key: "settings",
    href: "/settings",
    label: "Account",
    description: "Settings and workspace preferences"
  }
];

export function normalizeMobileNavKeys(keys: unknown): MobileNavItemKey[] {
  if (!Array.isArray(keys)) {
    return defaultMobileNavItemKeys;
  }

  const validKeys = new Set(mobileNavOptions.map((option) => option.key));
  const uniqueKeys = keys.filter(
    (key, index): key is MobileNavItemKey =>
      typeof key === "string" &&
      validKeys.has(key as MobileNavItemKey) &&
      keys.indexOf(key) === index
  );

  return uniqueKeys.length
    ? uniqueKeys.slice(0, maxMobileNavItems)
    : defaultMobileNavItemKeys;
}

export function readMobileNavKeys(): MobileNavItemKey[] {
  if (typeof window === "undefined") {
    return defaultMobileNavItemKeys;
  }

  try {
    const storedValue = window.localStorage.getItem(mobileNavStorageKey);
    return normalizeMobileNavKeys(storedValue ? JSON.parse(storedValue) : null);
  } catch {
    return defaultMobileNavItemKeys;
  }
}

export function saveMobileNavKeys(keys: MobileNavItemKey[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedKeys = normalizeMobileNavKeys(keys);
  window.localStorage.setItem(mobileNavStorageKey, JSON.stringify(normalizedKeys));
  window.dispatchEvent(new CustomEvent(mobileNavUpdatedEvent, { detail: normalizedKeys }));
}
