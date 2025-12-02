

// API Client for Neon / AttentioCloud

const API_BASE = "https://attentiocloud-api.vercel.app";

// --- CREDENTIALS MANAGEMENT ---

// Hardcoded keys removed for security. 
// Keys must be provided via Vite Environment Variables (VITE_NEON_APP_ID, VITE_NEON_API_KEY)
// or set in LocalStorage for development.

function getApiCredentials() {
  // Check Vercel/Vite environment variables.
  const envAppId = (import.meta as any).env.VITE_NEON_APP_ID;
  const envApiKey = (import.meta as any).env.VITE_NEON_API_KEY;

  const creds = {
    appId: localStorage.getItem("neon_appId") || envAppId || "",
    apiKey: localStorage.getItem("neon_apiKey") || envApiKey || "",
  };
  
  if (!creds.appId || !creds.apiKey) {
      console.warn("Mangler API-nøkler! Sørg for at VITE_NEON_APP_ID og VITE_NEON_API_KEY er satt i miljøvariabler.");
  }
  
  return creds;
}

// --- HEADERS ---

function buildHeaders() {
  const { appId, apiKey } = getApiCredentials();
  
  return {
    "Content-Type": "application/json",
    "X-APP-ID": appId,
    "Authorization": `Bearer ${apiKey}`,
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

  // Add cache buster timestamp to FORCE fresh data from server
  params.set("_t", Date.now().toString());

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

  const headers = isPublic ? {} : buildHeaders();
  const options: RequestInit = isPublic ? {} : { headers };

  // DEBUG LOGGING
  console.groupCollapsed(`[NEON] GET ${table}`);
  console.log(`URL:`, url);
  console.log(`Headers:`, headers);
  console.log(`Params:`, { where, fields, pagination });
  console.groupEnd();
  
  // ROBUST RETRY LOGIC (3 attempts, 1000ms delay)
  let lastError;
  for (let i = 0; i < 3; i++) {
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
  
  const headers = isPublic ? { "Content-Type": "application/json" } : buildHeaders();
  
  // DEBUG LOGGING
  console.group(`[NEON] POST ${table}`);
  console.log(`URL:`, url);
  console.log(`Headers:`, headers);
  console.log(`Payload:`, bodyToSend);
  console.groupEnd();

  const options: RequestInit = {
      method: "POST",
      headers: headers as any,
      body: JSON.stringify(bodyToSend)
  };

  try {
      const res = await fetch(url, options);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`POST failed: ${res.status} - ${errorText}`);
      }

      const json = await res.json();
      return apiresponse({
        inserted: json.inserted,
        insertedCount: json.insertedCount,
        user: json.user
      }, responsId);
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

  const headers = isPublic ? { "Content-Type": "application/json" } : buildHeaders();

  // DEBUG LOGGING
  console.group(`[NEON] PATCH ${table}`);
  console.log(`URL:`, url);
  console.log(`Headers:`, headers);
  console.log(`Payload:`, payload);
  console.groupEnd();

  const options: RequestInit = {
    method: "PATCH",
    headers: headers as any,
    body: JSON.stringify(payload)
  };

  try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);

      const json = await res.json();
      return apiresponse({
        rows: json.rows,
        updatedCount: json.updatedCount,
        mode: json.mode
      }, responsId);
  } catch (error: any) {
      console.error(`[NEON] PATCH Network Error:`, error);
      throw error;
  }
}

/* ------------------ DELETE ------------------ */
export async function deleteNEON({ 
  table, 
  data, 
  responsId,
  field = 'id' // Added optional field parameter, defaults to 'id'
}: { 
  table: string, 
  data: any, 
  responsId?: string,
  field?: string
}) {
  if (data === undefined || data === null) {
    throw new Error("deleteNEON requires 'data' to be an ID or array of IDs/values");
  }

  const ids = Array.isArray(data) ? data : [data];
  // Encode value for URL safety and handle potential multiple values
  const value = encodeURIComponent(ids.join(","));

  const url = `${API_BASE}/api/${table}?field=${field}&value=${value}`;
  const headers = buildHeaders();

  // DEBUG LOGGING
  console.group(`[NEON] DELETE ${table}`);
  console.log(`URL:`, url);
  console.log(`Headers:`, headers);
  console.log(`Data (Body):`, ids); // Log the body data being sent
  console.groupEnd();

  try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: headers as any,
        body: JSON.stringify(ids) // Send IDs in body as well to support bulk delete on supported backends
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
