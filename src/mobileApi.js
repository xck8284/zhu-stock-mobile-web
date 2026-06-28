const API_BASE = "https://zhu-stock-mobile-api.onrender.com";

export async function adminFetch(url, token) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Mobile": "true",
    },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return await res.json();
}
