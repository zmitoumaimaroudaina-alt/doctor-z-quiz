export function pageMetadata(title: string, description: string) {
  return { meta: [
    { title: `${title} — Z QCM GAME` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Z QCM GAME` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}