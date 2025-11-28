// API Client for Neon / AttentioCloud

const API_BASE = "https://attentiocloud-api.vercel.app";

function getToken() {
  return (
    localStorage.getItem("_ms-mid") ||
    document.cookie
      .split("; ")
      .find((r) => r.startsWith("_ms-mid="))
      ?.split("=")[1] ||
    null
  );
}

function getPlans() {
  const raw = localStorage.getItem("_ms-mem");
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw);
    // @ts-ignore
    return (obj.planConnections || []).map(p => p.planId);
  } catch (e) {
    console.warn("Invalid _ms-mem JSON", e);
    return [];
  }
}

function buildHeaders() {
  const token = getToken();
  // Allow execution without token for robustness, warning logged
  if (!token) console.warn("Missing Memberstack token (_ms-mid), request may fail.");

  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token || ''}`,
    "X-MS-Plans": getPlans().join(","),
  };
}

function apiresponse(data: any, responsId?: string) {
  // @ts-ignore
  if (responsId && window[responsId]) window[responsId](data);
  return data;
}

/* ------------------ GET ------------------ */
export async function getNEON({
  table,
  fields = null,
  where = null,
  responsId,
  cache = false,
  public: isPublic = false,
  pagination = null
}: {
  table: string;
  fields?: string[] | null;
  where?: Record<string, any> | null;
  responsId?: string;
  cache?: boolean;
  public?: boolean;
  pagination?: { limit?: number; offset?: number } | null;
}) {
  let url = `${API_BASE}/api/${table}`;
  const params = new URLSearchParams();

  if (fields?.length) params.set("fields", fields.join(","));

  if (where) {
    Object.entries(where).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
            params.set(k, String(v));
        }
    });
  }

  if (cache) params.set("cache", "1");

  if (pagination) {
    if (pagination.limit != null) params.set("limit", String(pagination.limit));
    if (pagination.offset != null) params.set("offset", String(pagination.offset));
  }

  if (params.toString() !== "") url += `?${params.toString()}`;

  const options: RequestInit = isPublic ? {} : { headers: buildHeaders() };

  console.log(`[NEON] GET Construction:`, { table, where, url });
  console.log(`[NEON] GET Options:`, options);

  // ROBUST RETRY LOGIC (5 attempts, 1000ms delay)
  let lastError;
  for (let i = 0; i < 5; i++) {
    try {
        const res = await fetch(url, options);
        
        if (!res.ok) {
           throw new Error(`GET failed: ${res.status} ${res.statusText}`);
        }

        const text = await res.text();
        
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            throw new Error(`Invalid JSON response from ${url}`);
        }
        
        return apiresponse(
          {
            rows: json.rows || [],
            cached: json.cached,
            limit: json.limit,
            offset: json.offset,
            count: json.count,
            total: json.total,
            hasMore: json.hasMore
          },
          responsId
        );

    } catch (error: any) {
        console.warn(`[NEON] Attempt ${i+1} failed:`, error.message);
        lastError = error;
        // Wait 1000ms before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error(`[NEON] All fetch attempts failed for ${url}`);
  throw lastError;
}

/* ------------------ POST ------------------ */
export async function postNEON({ 
  table, 
  data, 
  responsId, 
  public: isPublic = false 
}: { 
  table: string, 
  data: any, 
  responsId?: string, 
  public?: boolean 
}) {
  const url = `${API_BASE}/api/${table}`;
  const bodyToSend = Array.isArray(data) ? data : [data];
  
  const options: RequestInit = {
      method: "POST",
      headers: isPublic ? { "Content-Type": "application/json" } : buildHeaders(),
      body: JSON.stringify(bodyToSend)
  };

  try {
      const res = await fetch(url, options);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`POST failed: ${res.status} - ${errorText}`);
      }

      const json = await res.json();
      return apiresponse(json, responsId);
  } catch (error: any) {
      console.error(`[NEON] POST Network Error:`, error);
      throw error;
  }
}


/* ----------------- PATCH ------------------ */
export async function patchNEON({
  table,
  data,
  responsId,
  public: isPublic = false
}: { 
  table: string, 
  data: any, 
  responsId?: string, 
  public?: boolean 
}) {
  const url = `${API_BASE}/api/${table}`;

  let payload;

  if (!Array.isArray(data)) {
    if (data.id && data.fields) {
      payload = { id: data.id, data: data.fields };
    } else {
      const { id, ...rest } = data;
      payload = { id, data: rest };
    }
  } else {
    payload = data.map((item: any) => {
      if (item.fields) {
        return { id: item.id, fields: item.fields };
      }
      const { id, ...rest } = item;
      return { id, fields: rest };
    });
  }

  const options: RequestInit = {
    method: "PATCH",
    headers: isPublic ? { "Content-Type": "application/json" } : buildHeaders(),
    body: JSON.stringify(payload)
  };

  try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);

      const json = await res.json();
      return apiresponse(json, responsId);
  } catch (error: any) {
      console.error(`[NEON] PATCH Network Error:`, error);
      throw error;
  }
}

/* ------------------ DELETE ------------------ */
export async function deleteNEON({ 
  table, 
  data, 
  responsId 
}: { 
  table: string, 
  data: any, 
  responsId?: string 
}) {
  if (data === undefined || data === null) {
    throw new Error("deleteNEON requires 'data' to be an ID or array of IDs");
  }

  const ids = Array.isArray(data) ? data : [data];
  const value = ids.join(",");

  const url = `${API_BASE}/api/${table}?field=id&value=${value}`;

  try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: buildHeaders()
      });

      if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);

      const json = await res.json();

      return apiresponse(
        {
          deleted: json.deleted,
          ids
        },
        responsId
      );
  } catch (error: any) {
      console.error(`[NEON] DELETE Network Error:`, error);
      throw error;
  }
}