// Returns only Bueno roster directors (people linked from Director Leads table)
// Sorted alphabetically, with reel link if available
const BASE_ID          = 'appb2j15wK5KPtFF3';
const PEOPLE_TABLE     = 'tblX85mK7o9AMp8Uy';
const DIR_LEADS_TABLE  = 'tbl08kVBBTQRtDxVD';

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
    // Step 1: Collect unique People IDs from Director Leads "Director" field
    const directorIdSet = new Set();
    let offset = null;
    do {
      const params = 'fields[]=Director&pageSize=100' +
        (offset ? '&offset=' + encodeURIComponent(offset) : '');
      const data = await atGet(`${DIR_LEADS_TABLE}?${params}`, token);
      for (const r of (data.records || [])) {
        for (const id of (r.fields['Director'] || [])) {
          directorIdSet.add(id);
        }
      }
      offset = data.offset || null;
    } while (offset);

    if (!directorIdSet.size) return res.status(200).json([]);

    // Step 2: Fetch those People records in batches of 10
    const ids = [...directorIdSet];
    const directors = [];

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const formula = batch.length === 1
        ? `RECORD_ID()='${batch[0]}'`
        : `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(',')})`;
      const params = `fields[]=Name&fields[]=Greatest+Hits+Reel&fields[]=Website+Reel&filterByFormula=${encodeURIComponent(formula)}`;
      const data = await atGet(`${PEOPLE_TABLE}?${params}`, token);
      for (const r of (data.records || [])) {
        const name = (r.fields['Name'] || '').trim();
        if (!name) continue;
        directors.push({
          id:   r.id,
          name,
          reel: r.fields['Greatest Hits Reel'] || r.fields['Website Reel'] || '',
        });
      }
    }

    directors.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(directors);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
