const BASE_ID      = 'appb2j15wK5KPtFF3';
const COMPANIES_TABLE = 'tbla3CGnVGsBQXPhi';

async function atGet(path, token) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Airtable ${res.status}: ${t}`); }
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: 'AIRTABLE_TOKEN not set' });

  try {
    const agencies = [];
    let offset = null;

    do {
      const params = 'fields[]=Company&fields[]=Full+Address&fields[]=Main+Office+Number&pageSize=100' +
        (offset ? '&offset=' + encodeURIComponent(offset) : '');
      const data = await atGet(`${COMPANIES_TABLE}?${params}`, token);

      for (const r of (data.records || [])) {
        const name = (r.fields['Company'] || '').trim();
        if (!name) continue;
        agencies.push({
          id:      r.id,
          name,
          address: (r.fields['Full Address'] || '').trim(),
          phone:   (r.fields['Main Office Number'] || '').trim(),
        });
      }
      offset = data.offset || null;
    } while (offset);

    agencies.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(agencies);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
