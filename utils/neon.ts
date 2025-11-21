
// API Client for Neon / AttentioCloud

const API_BASE = "https://attentiocloud-api.vercel.app";

// FALLBACK CREDENTIALS FOR TESTING/PREVIEW (When Memberstack is not active)
const TEST_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjZmNjU3ZGRiYWJmYmZkOTVhNGVkNjZjMjMyNDExZWFhNjE5OGQ4NGMxYmJkOGEyYTI5M2I4MTVmYjRhOTlhYjEifQ.eyJpZCI6Im1lbV9zYl9jbWk0bnk0NDgwMDltMHNyNGV3M2hkZ2UxIiwidHlwZSI6Im1lbWJlciIsImlhdCI6MTc2MzU1MzcyMiwiZXhwIjoxNzY0NzYzMzIyLCJhdWQiOiJhcHBfY21odnpyMTBhMDBicTBzczM5c3pwOW96aiIsImlzcyI6Imh0dHBzOi8vYXBpLm1lbWJlcnN0YWNrLmNvbSJ9.lUpQ8viAZi0Mjz9BADOdpejFST3vDggO1ctO6Sg4ivKWMGumZPMDLyvk85NjYgknTNaMxiMTqhay726Z9XBUpsBHKPLV85miz7Sd59KYc3560ozp3Mz9UlaAv6QoHOYVRTjOKVi7yq68F1B0YsE9UQmAmg4Zg38JulX8AiBEIU1MvNI8OrsxVK_hpyjc2FTIzAbCF4cdTXETJqIC7lGKlCy9wwF1fBn3Azzfa4eMWKMFIbWK0HmJSXNaDhDqNU1iWrCNmV1qm8MmiChZNvfLWeJEFQCtFlziztT_SDdmWp1K_rdSIIdu43L_wm8tAXVUBiDGjRG7kTMOv0uZruDNWw";
const TEST_PLAN_ID = "pln_konsernkontroll-ebfc06oh";

function getToken() {
  return (
    localStorage.getItem("_ms-mid") ||
    document.cookie
      .split("; ")
      .find((r) => r.startsWith("_ms-mid="))
      ?.split("=")[1] ||
    TEST_TOKEN // Fallback to test token
  );
}

function getPlans() {
  const raw = localStorage.getItem("_ms-mem");
  if (!raw) return [TEST_PLAN_ID]; // Fallback to test plan
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-MS-Plans"] = getPlans().join(",");
  }
  
  return headers;
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
    Object.entries(where).forEach(([k, v]) => params.set(k, String(v)));
  }

  if (cache) params.set("cache", "1");

  if (pagination) {
    if (pagination.limit != null) params.set("limit", String(pagination.limit));
    if (pagination.offset != null) params.set("offset", String(pagination.offset));
  }

  if ([...params].length > 0) url += `?${params.toString()}`;

  const options = isPublic ? {} : { headers: buildHeaders() };

  try {
    const res = await fetch(url, options);
    const json = await res.json();
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
  } catch (e) {
      console.error("GET NEON Error", e);
      return { rows: [] };
  }
}

/* ------------------ POST ------------------ */
export async function postNEON({ table, data, responsId, public: isPublic = false }: { table: string, data: any, responsId?: string, public?: boolean }) {
  const url = `${API_BASE}/api/${table}`;

  const bodyToSend = Array.isArray(data) ? data : [data];

  const options = {
      method: "POST",
      headers: isPublic ? { "Content-Type": "application/json" } : buildHeaders(),
      body: JSON.stringify(bodyToSend)
  };

  const res = await fetch(url, options);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`POST failed: ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  return apiresponse(json, responsId);
}


/* ----------------- PATCH ------------------ */
export async function patchNEON({
  table,
  data,
  responsId,
  public: isPublic = false
}: { table: string, data: any, responsId?: string, public?: boolean }) {
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

  const options = {
    method: "PATCH",
    headers: isPublic ? { "Content-Type": "application/json" } : buildHeaders(),
    body: JSON.stringify(payload),
  };

  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);

  const json = await res.json();
  return apiresponse(json, responsId);
}

/* ------------------ DELETE ------------------ */
export async function deleteNEON({ table, data, responsId }: { table: string, data: any, responsId?: string }) {
  if (data === undefined || data === null) {
    throw new Error("deleteNEON requires 'data' to be an ID or array of IDs");
  }

  const ids = Array.isArray(data) ? data : [data];
  const value = ids.join(",");

  const url = `${API_BASE}/api/${table}?field=id&value=${value}`;

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
}
