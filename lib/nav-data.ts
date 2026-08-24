export type NavItem = {
  label: string;
  href: string;
};

export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Work", href: "/work" },
  { label: "Insights", href: "/insights" },
];

export type Service = {
  slug: string;
  name: string;
  description: string;
  category: "Growth" | "Creative" | "Digital";
  built: boolean;
};

export const services: Service[] = [
  {
    slug: "performance-marketing",
    name: "Performance Marketing",
    description: "Paid media systems built around measurable growth.",
    category: "Growth",
    built: true,
  },
  {
    slug: "lead-generation",
    name: "Lead Generation",
    description: "Full-funnel systems that turn traffic into qualified pipeline.",
    category: "Growth",
    built: false,
  },
  {
    slug: "seo",
    name: "SEO",
    description: "Technical, content and authority work that compounds.",
    category: "Growth",
    built: false,
  },
  {
    slug: "social-media-marketing",
    name: "Social Media Marketing",
    description: "Platform-native strategy, content and community growth.",
    category: "Creative",
    built: false,
  },
  {
    slug: "content-creative",
    name: "Content & Creative",
    description: "Ideas, design and copy built to stop the scroll.",
    category: "Creative",
    built: false,
  },
  {
    slug: "video-production",
    name: "Video Production",
    description: "Brand films, product video and campaign content.",
    category: "Creative",
    built: false,
  },
  {
    slug: "web-development",
    name: "Website Development",
    description: "Digital experiences engineered to convert.",
    category: "Digital",
    built: false,
  },
  {
    slug: "influencer-marketing",
    name: "Influencer Marketing",
    description: "Creator partnerships matched to real audience intent.",
    category: "Digital",
    built: false,
  },
];

export const serviceCategories = ["Growth", "Creative", "Digital"] as const;

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
