const BASE_ID = 'appb2j15wK5KPtFF3';
const LEADS_TABLE = 'tbl6YVJ5xGzSRWSa3';
const DIRECTOR_LEADS_TABLE = 'tbl08kVBBTQRtDxVD';
const PEOPLE_TABLE = 'tblX85mK7o9AMp8Uy';
const COMPANIES_TABLE = 'tbla3CGnVGsBQXPhi';

async function atGet(path, token) {
  const res = await fetch('https://api.airtable.com/v0/' + BASE_ID + '/' + path, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) { const t = await res.text(); throw new Error('Airtable ' + res.status + ': ' + t); }
  return res.json();
}

async function fetchByIds(tableId, ids, token) {
  if (!ids || ids.length === 0) return [];
  const formula = ids.length === 1
    ? "RECORD_ID()='" + ids[0] + "'"
    : 'OR(' + ids.map(id => "RECORD_ID()='" + id + "'").join(',') + ')';
  const data = await atGet(tableId + '?filterByFormula=' + encodeURIComponent(formula), token);
  return data.records || [];
}

function selectNames(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => (x && typeof x === 'object' && x.name) ? x.name : x).filter(Boolean);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  const { id } = req.query;
  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(id)) return res.status(400).json({ error: 'Invalid record ID' });
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: 'AIRTABLE_TOKEN not set' });
  try {
    const lead = await atGet(LEADS_TABLE + '/' + id, token);
    const f = lead.fields;
    const [agencyRecs, producerRecs, creativeRecs, directorLeadRecs, competitionRecs] = await Promise.all([
      fetchByIds(COMPANIES_TABLE, f['Agency'] || [], token),
      fetchByIds(PEOPLE_TABLE, f['Agency Producer'] || [], token),
      fetchByIds(PEOPLE_TABLE, f['Creatives'] || [], token),
      fetchByIds(DIRECTOR_LEADS_TABLE, f['Director Leads'] || [], token),
      fetchByIds(PEOPLE_TABLE, f['Competition'] || [], token),
    ]);
    const directorPeopleIds = [...new Set(directorLeadRecs.flatMap(r => r.fields['Director'] || []))];
    const directorPeopleRecs = directorPeopleIds.length ? await fetchByIds(PEOPLE_TABLE, directorPeopleIds, token) : [];
    const directors = directorLeadRecs.map(dlr => {
      const names = (dlr.fields['Director'] || []).map(pid => directorPeopleRecs.find(p => p.id === pid)?.fields?.Name).filter(Boolean);
      const company = Array.isArray(dlr.fields['Production Company']) ? dlr.fields['Production Company'].filter(Boolean).join(', ') : (dlr.fields['Production Company'] || '');
      return { name: names.join(', '), company };
    }).filter(d => d.name);
    const producerEmail = f['Producer Email'] || (Array.isArray(f['Producer Emails']) ? f['Producer Emails'].filter(Boolean).join(', ') : '') || producerRecs.map(r => r.fields['Email']).filter(Boolean).join(', ');
    return res.status(200).json({
      id: lead.id, client: f['Client'] || '', date: f['Bid Sheet Date'] || f['Date'] || '',
      assignedTo: selectNames(f['Assigned To']).join(', '),
      agency: agencyRecs.map(r => r.fields['Company']).filter(Boolean).join(', '),
      agencyAddress: agencyRecs.map(r => r.fields['Full Address']).filter(Boolean).join('\n'),
      agencyPhone: agencyRecs.map(r => r.fields['Main Office Number']).filter(Boolean).join(', '),
      producerName: producerRecs.map(r => r.fields['Name']).filter(Boolean).join(', '),
      producerDirectLine: producerRecs.map(r => r.fields['Phone (Cell)']).filter(Boolean).join(', '),
      producerMobile: producerRecs.map(r => r.fields['Mobile']).filter(Boolean).join(', '),
      producerEmail,
      creatives: creativeRecs.map(r => ({ name: r.fields['Name'] || '', linkedin: r.fields['LinkedIn'] || '' })),
      directors, competition: competitionRecs.map(r => r.fields['Name']).filter(Boolean),
      spotTitle: f['Spot Title'] || '', spotLength: selectNames(f['Spot Length']),
      spotDeliverables: selectNames(f['Spot Deliverables']), spotNotes: f['Spot Notes'] || '',
      budget: f['Budget'] || '', treatmentDue: f['Treatment Due'] || '', bidDue: f['Bid Due'] || '',
      awardDate: f['Award Date'] || '', shootDate: f['Shoot Date'] || '', shootLocation: f['Shoot Location'] || '',
      deliveryDate: f['Delivery Date'] || '', airDate: f['Air Date'] || '',
      launchCampaign: f['Launch / Previous Campaign'] || '', references: f['References'] || '',
      talent: f['Talent'] || '', specialtyReel: f['Specialty Reel Created'] || '',
      treatmentNotes: f['Treatment Notes'] || '', link: f['Link'] || '',
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};
