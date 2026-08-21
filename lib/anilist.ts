const ANILIST_API_URL = process.env.ANILIST_API_URL ?? "https://graphql.anilist.co";
const REQUEST_TIMEOUT_MS = 8000;
const MIN_PER_PAGE = 1;
const MAX_PER_PAGE = 50;
// Fixed product decision, not a user-selectable filter: AniList's "format" field
// (MANGA/NOVEL) only distinguishes medium, not country of origin — without this,
// trending results mix in Korean manhwa and Chinese manhua alongside Japanese manga.
const JAPAN_COUNTRY_CODE = "JP";

const TRENDING_MEDIA_QUERY = `
  query TrendingMedia($page: Int!, $perPage: Int!, $format: [MediaFormat], $countryOfOrigin: CountryCode) {
    Page(page: $page, perPage: $perPage) {
      media(type: MANGA, format_in: $format, countryOfOrigin: $countryOfOrigin, sort: TRENDING_DESC) {
        id
        title {
          romaji
          english
        }
        coverImage {
          large
        }
        format
        genres
        description
        popularity
      }
    }
  }
`;

const MEDIA_BY_ID_QUERY = `
  query MediaById($id: Int!) {
    Media(id: $id, type: MANGA) {
      id
      title {
        romaji
        english
      }
      coverImage {
        large
      }
      format
      genres
      description
      popularity
    }
  }
`;

export interface AniListMediaTitle {
  romaji: string | null;
  english: string | null;
}

export interface AniListMedia {
  id: number;
  title: AniListMediaTitle;
  coverImage: { large: string | null };
  // AniList puts manga and light novels under type MANGA; this is what tells them apart.
  format: string;
  genres: string[];
  description: string | null;
  popularity: number;
}

interface AniListGraphQLResponse {
  data?: { Page: { media: AniListMedia[] } };
  errors?: { message: string }[];
}

interface AniListMediaByIdResponse {
  data?: { Media: AniListMedia | null };
  errors?: { message: string }[];
}

export type MediaFormatFilter = "MANGA" | "NOVEL";

export async function fetchTrendingMedia(
  page: number,
  perPage: number,
  format?: MediaFormatFilter,
): Promise<AniListMedia[]> {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("page phải là số nguyên >= 1");
  }
  if (!Number.isInteger(perPage) || perPage < MIN_PER_PAGE || perPage > MAX_PER_PAGE) {
    throw new Error(`perPage phải là số nguyên trong khoảng ${MIN_PER_PAGE}-${MAX_PER_PAGE}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: TRENDING_MEDIA_QUERY,
        // AniList filters (format_in) and paginates in the same step, so passing the
        // format here — instead of slicing the response afterward — is what keeps
        // perPage accurate for a filtered request. countryOfOrigin is always "JP",
        // never taken from the caller — see JAPAN_COUNTRY_CODE above.
        variables: { page, perPage, format: format ? [format] : undefined, countryOfOrigin: JAPAN_COUNTRY_CODE },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Yêu cầu tới AniList quá thời gian chờ (timeout)");
    }
    throw new Error("Không thể kết nối tới AniList");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`AniList trả về lỗi (status ${response.status})`);
  }

  const json = (await response.json()) as AniListGraphQLResponse;

  if (json.errors?.length) {
    throw new Error(`AniList trả về lỗi: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("AniList trả về dữ liệu không hợp lệ");
  }

  return json.data.Page.media;
}

export async function fetchMediaById(anilistId: number): Promise<AniListMedia | null> {
  if (!Number.isInteger(anilistId) || anilistId < 1) {
    throw new Error("anilistId phải là số nguyên dương");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: MEDIA_BY_ID_QUERY,
        variables: { id: anilistId },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Yêu cầu tới AniList quá thời gian chờ (timeout)");
    }
    throw new Error("Không thể kết nối tới AniList");
  } finally {
    clearTimeout(timeoutId);
  }

  // AniList responds with HTTP 404 (plus a "Not Found." GraphQL error alongside
  // data.Media: null) for an id that doesn't exist — verified against the live API.
  // That's this function's legitimate "doesn't exist" case, not a failure to throw for.
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`AniList trả về lỗi (status ${response.status})`);
  }

  const json = (await response.json()) as AniListMediaByIdResponse;

  if (json.errors?.length && !json.data?.Media) {
    throw new Error(`AniList trả về lỗi: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("AniList trả về dữ liệu không hợp lệ");
  }

  return json.data.Media;
}
