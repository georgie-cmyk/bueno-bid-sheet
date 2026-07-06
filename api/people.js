// Returns People records where Function includes "Director" (for competition director selects)
// Includes company name resolved from linked Company records.
const BASE_ID         = 'appb2j15wK5KPtFF3';
const PEOPLE_TABLE    = 'tblX85mK7o9AMp8Uy';
const COMPANIES_TABLE = 'tbla3CGnVGsBQXPhi';

// Filter: Function multipleSelect contains "DIRECTOR"
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
    // Step 1: Fetch all people with DIRECTOR function, including Company linked IDs
    const people = [];
    let offset = null;
    do {
      const params = 'fields[]=Name&fields[]=Greatest+Hits+Reel&fields[]=Website+Reel&fields[]=Company' +
        '&filterByFormula=' + FILTER +
        '&pageSize=100' +
        (offset ? '&offset=' + encodeURIComponent(offset) : '');
      const data = await atGet(`${PEOPLE_TABLE}?${params}`, token);
      for (const r of (data.records || [])) {
        const name = (r.fields['Name'] || '').trim();
        if (!name) continue;
        people.push({
          id:         r.id,
          name,
          reel:       r.fields['Greatest Hits Reel'] || r.fields['Website Reel'] || '',
          companyIds: r.fields['Company'] || [],
        });
      }
      offset = data.offset || null;
    } while (offset);

    // Step 2: Resolve company names in batches of 10
    const allCompanyIds = [...new Set(people.flatMap(p => p.companyIds))];
    const companyNames = {};
    for (let i = 0; i < allCompanyIds.length; i += 10) {
      const batch = allCompanyIds.slice(i, i + 10);
      const formula = batch.length === 1
        ? `RECORD_ID()='${batch[0]}'`
        : `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(',')})`;
      const data = await atGet(
        `${COMPANIES_TABLE}?fields[]=Company&filterByFormula=${encodeURIComponent(formula)}`, token
      );
      for (const r of (data.records || [])) {
        companyNames[r.id] = r.fields['Company'] || '';
      }
    }

    // Step 3: Attach company name, remove temp field
    people.forEach(p => {
      p.company = p.companyIds.map(id => companyNames[id]).filter(Boolean).join(', ');
      delete p.companyIds;
    });

    people.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json(people);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
