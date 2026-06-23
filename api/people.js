const BASE_ID = 'appb2j15wK5KPtFF3';
const PEOPLE_TABLE = 'tblX85mK7o9AMp8Uy';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: 'AIRTABLE_TOKEN not set' });

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  try {
    const fields = encodeURIComponent('Name') + '&fields=' + encodeURIComponent('Email') + '&fields=' + encodeURIComponent('LinkedIn') + '&fields=' + encodeURIComponent('Work Email');
    let all = [], offset = '';
    do {
      const url = 'https://api.airtable.com/v0/' + BASE_ID + '/' + PEOPLE_TABLE + '?fields=' + fields + (offset ? '&offset=' + offset : '') + '&sort[0][field]=Name&sort[0][direction]=asc';
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) { const t = await r.text(); throw new Error('Airtable ' + r.status + ': ' + t); }
      const data = await r.json();
      all = all.concat(data.records || []);
      offset = data.offset || '';
    } while (offset);

    const people = all.map(r => ({
      id: r.id,
      name: r.fields['Name'] || '',
      email: r.fields['Email'] || r.fields['Work Email'] || '',
      linkedin: r.fields['LinkedIn'] || '',
    })).filter(p => p.name);

    return res.status(200).json(people);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
