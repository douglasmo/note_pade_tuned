export type QuickAction = "note" | "google" | "wikipedia" | "translate" | "chatgpt" | "youtube" | "definition" | "synonyms" | "maps" | "copy";

const QUICK_SEARCH_BASE_URL: Record<Exclude<QuickAction, "note" | "copy">, string> = {
  google: "https://www.google.com/search?q=",
  wikipedia: "https://pt.wikipedia.org/wiki/Especial:Pesquisar?search=",
  translate: "https://translate.google.com/?sl=auto&tl=pt&text=",
  chatgpt: "https://chatgpt.com/?q=Explique%20",
  youtube: "https://www.youtube.com/results?search_query=",
  definition: "https://www.google.com/search?q=defini%C3%A7%C3%A3o%20de%20",
  synonyms: "https://www.google.com/search?q=sin%C3%B4nimos%20de%20",
  maps: "https://www.google.com/maps/search/"
};

export const getQuickSearchUrl = (action: Exclude<QuickAction, "note" | "copy">, query: string) =>
  `${QUICK_SEARCH_BASE_URL[action]}${encodeURIComponent(query)}`;