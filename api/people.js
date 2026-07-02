// Returns People records where Function includes "Director" (for competition director selects)
const BASE_ID      = 'appb2j15wK5KPtFF3';
const PEOPLE_TABLE = 'tblX85mK7o9AMp8Uy';

// Filter: Function multipleSelect contains "Director"
const FILTER = encodeURIComponent('FIND("DIRECTOR",ARRAYJOIN({Function},","))>0');

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
    const people = [];
    let offset = null;
    do {
      const params = 'fields[]=Name&fields[]=Greatest+Hits+Reel&fields[]=Website+Reel' +
        '&filterByFormula=' + FILTER +
        '&pageSize=100' +
        (offset ? '&offset=' + encodeURIComponent(offset) : '');
      const data = await atGet(`${PEOPLE_TABLE}?${params}`, token);
      for (const r of (data.records || [])) {
        const name = (r.fields['Name'] || '').trim();
        if (!name) continue;
        people.push({
          id:   r.id,
          name,
          reel: r.fields['Greatest Hits Reel'] || r.fields['Website Reel'] || '',
        });
      }
      offset = data.offset || null;
    } while (offset);
    people.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(people);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
