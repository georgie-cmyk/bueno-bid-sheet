const BASE_ID = 'appb2j15wK5KPtFF3';
const PEOPLE_TABLE = 'tblX85mK7o9AMp8Uy';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: 'AIRTABLE_TOKEN not set' });

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  try {
    let all = [], offset = '';
    do {
      const params = new URLSearchParams({
        filterByFormula: '{Function}="DIRECTOR"',
        'sort[0][field]': 'Name',
        'sort[0][direction]': 'asc'
      });
      params.append('fields[]', 'Name');
      if (offset) params.append('offset', offset);
      const url = 'https://api.airtable.com/v0/' + BASE_ID + '/' + PEOPLE_TABLE + '?' + params.toString();
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) { const t = await r.text(); throw new Error('Airtable ' + r.status + ': ' + t); }
      const data = await r.json();
      all = all.concat(data.records || []);
      offset = data.offset || '';
    } while (offset);
    const directors = all
      .map(r => ({ id: r.id, name: (r.fields['Name'] || '').trim() }))
      .filter(d => d.name);
    return res.status(200).json(directors);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
