const BASE_ID = 'appb2j15wK5KPtFF3';
const LEADS_TABLE = 'tbl6YVJ5xGzSRWSa3';
const DIRECTOR_LEADS_TABLE = 'tbl08kVBBTQRtDxVD';
const PEOPLE_TABLE = 'tblX85mK7o9AMp8Uy';
const COMPANIES_TABLE = 'tbla3CGnVGsBQXPhi';

// Fields directly writable via PATCH (key = JSON key, value = Airtable field name)
const WRITABLE = {
  spotTitle:      'Spot Title',
  budget:         'Budget',
  treatmentDue:   'Treatment Due',
  bidDue:         'Bid Due',
  awardDate:      'Award Date',
  shootDate:      'Shoot Date',
  shootLocation:  'Shoot Location',
  deliveryDate:   'Delivery Date',
  airDate:        'Air Date',
  launchCampaign: 'Launch / Previous Campaign',
  references:     'References',
  talent:         'Talent',
  treatmentNotes: 'Treatment Notes',
  client:         'Client',
  specialtyReel:  'Specialty Reel Created',
};
// spotNotes and spotGrid are handled together (spotGrid is embedded as JSON prefix in Spot Notes)

async function atGet(path, token) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Airtable ${res.status}: ${t}`); }
  return res.json();
}

async function atPatch(recordId, fields, token) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${LEADS_TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Airtable ${res.status}: ${t}`); }
  return res.json();
}

async function fetchByIds(tableId, ids, token) {
  if (!ids || ids.length === 0) return [];
  const formula = ids.length === 1
    ? `RECORD_ID()='${ids[0]}'`
    : `OR(${ids.map(id => `RECORD_ID()='${id}'`).join(',')})`;
  const data = await atGet(`${tableId}?filterByFormula=${encodeURIComponent(formula)}`, token);
  return data.records || [];
}

function selectNames(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => (x && typeof x === 'object' && x.name) ? x.name : x).filter(Boolean);
}

// Parse the SPOTGRID: prefix out of Spot Notes.
// Format: "SPOTGRID:[...json...]\nActual notes text"
function parseSpotNotes(raw) {
  const prefix = 'SPOTGRID:';
  if (!raw || !raw.startsWith(prefix)) return { spotGrid: null, spotNotes: raw || '' };
  const nl = raw.indexOf('\n');
  const jsonLine = nl >= 0 ? raw.slice(0, nl) : raw;
  const rest = nl >= 0 ? raw.slice(nl + 1) : '';
  try {
    return { spotGrid: JSON.parse(jsonLine.slice(prefix.length)), spotNotes: rest };
  } catch(e) {
    return { spotGrid: null, spotNotes: raw };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const qid = req.query && req.query.id;
  if (!qid || !/^rec[A-Za-z0-9]{14}$/.test(qid)) return res.status(400).json({ error: 'Invalid record ID' });
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: 'AIRTABLE_TOKEN not set' });

  // ── PATCH ──────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    try {
      const updates = req.body || {};
      const fields = {};

      // spotGrid + spotNotes must be stored together in Airtable "Spot Notes" field
      const hasGrid  = updates.spotGrid  !== undefined;
      const hasNotes = updates.spotNotes !== undefined;
      if (hasGrid || hasNotes) {
        const notesText = hasNotes ? (updates.spotNotes || '') : '';
        const grid = hasGrid ? updates.spotGrid : null;
        if (grid && Array.isArray(grid) && grid.length) {
          fields['Spot Notes'] = 'SPOTGRID:' + JSON.stringify(grid) + '\n' + notesText;
        } else {
          fields['Spot Notes'] = notesText;
        }
      }

      // All other writable fields
      for (const [key, val] of Object.entries(updates)) {
        if (key === 'spotGrid' || key === 'spotNotes') continue;
        if (WRITABLE[key] !== undefined) fields[WRITABLE[key]] = val || null;
      }

      if (!Object.keys(fields).length) return res.status(200).json({ ok: true });
      await atPatch(qid, fields, token);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET ────────────────────────────────────────────────────────────
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  try {
    const lead = await atGet(`${LEADS_TABLE}/${qid}`, token);
    const f = lead.fields;

    const [agencyRecs, producerRecs, creativeRecs, directorLeadRecs, competitionRecs] = await Promise.all([
      fetchByIds(COMPANIES_TABLE,      f['Agency']          || [], token),
      fetchByIds(PEOPLE_TABLE,         f['Agency Producer'] || [], token),
      fetchByIds(PEOPLE_TABLE,         f['Creatives']       || [], token),
      fetchByIds(DIRECTOR_LEADS_TABLE, f['Director Leads']  || [], token),
      fetchByIds(PEOPLE_TABLE,         f['Competition']     || [], token),
    ]);

    const directorPeopleIds = [...new Set(directorLeadRecs.flatMap(r => r.fields['Director'] || []))];
    const directorPeopleRecs = directorPeopleIds.length
      ? await fetchByIds(PEOPLE_TABLE, directorPeopleIds, token)
      : [];

    const directors = directorLeadRecs.map(dlr => {
      const names = (dlr.fields['Director'] || [])
        .map(pid => directorPeopleRecs.find(p => p.id === pid)?.fields?.Name)
        .filter(Boolean);
      const companyRaw = dlr.fields['Production Company'];
      const company = Array.isArray(companyRaw) ? companyRaw.filter(Boolean).join(', ') : (companyRaw || '');
      return { name: names.join(', '), company };
    }).filter(d => d.name);

    const producerEmail =
      f['Producer Email'] ||
      (Array.isArray(f['Producer Emails']) ? f['Producer Emails'].filter(Boolean).join(', ') : '') ||
      producerRecs.map(r => r.fields['Email']).filter(Boolean).join(', ');

    const { spotGrid, spotNotes } = parseSpotNotes(f['Spot Notes'] || '');

    return res.status(200).json({
      id: lead.id,
      client:      f['Client'] || '',
      date:        f['Bid Sheet Date'] || f['Date'] || '',
      assignedTo:  selectNames(f['Assigned To']).join(', '),

      agency:        agencyRecs.map(r => r.fields['Company']).filter(Boolean).join(', '),
      agencyAddress: agencyRecs.map(r => r.fields['Full Address']).filter(Boolean).join('\n'),
      agencyPhone:   agencyRecs.map(r => r.fields['Main Office Number']).filter(Boolean).join(', '),

      producerName:       producerRecs.map(r => r.fields['Name']).filter(Boolean).join(', '),
      producerDirectLine: producerRecs.map(r => r.fields['Phone (Cell)']).filter(Boolean).join(', '),
      producerMobile:     producerRecs.map(r => r.fields['Mobile']).filter(Boolean).join(', '),
      producerEmail,
      producerIds:        producerRecs.map(r => r.id),

      creatives: creativeRecs.map(r => ({
        id:       r.id,
        name:     r.fields['Name']     || '',
        linkedin: r.fields['LinkedIn'] || '',
        email:    r.fields['Email']    || '',
      })),

      directors,
      competition: competitionRecs.map(r => r.fields['Name']).filter(Boolean),

      spotTitle:        f['Spot Title']        || '',
      spotLength:       selectNames(f['Spot Length']),
      spotDeliverables: selectNames(f['Spot Deliverables']),
      spotNotes,
      spotGrid,

      budget:        f['Budget']        || '',
      treatmentDue:  f['Treatment Due'] || '',
      bidDue:        f['Bid Due']       || '',
      awardDate:     f['Award Date']    || '',
      shootDate:     f['Shoot Date']    || '',
      shootLocation: f['Shoot Location']|| '',
      deliveryDate:  f['Delivery Date'] || '',
      airDate:       f['Air Date']      || '',

      launchCampaign: f['Launch / Previous Campaign'] || '',
      references:     f['References']     || '',
      talent:         f['Talent']         || '',
      specialtyReel:  f['Specialty Reel Created'] || '',
      treatmentNotes: f['Treatment Notes']|| '',
      link:           f['Link']           || '',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
