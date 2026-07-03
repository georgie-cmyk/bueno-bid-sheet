// Returns the predefined choices for the "Assigned To" multipleSelects field in Leads
// These are Bueno internal team + roster companies
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

  const choices = [
    'Ashley', 'Barking Owl', 'Blinkink', 'Bryan', 'Canada',
    'Cartel', 'Framestore', 'Golden', 'Human', 'Kaylen',
    'ManvsMachine', 'Millie', 'Radical', 'RSA'
  ];

  return res.status(200).json(choices.map(name => ({ id: name, name })));
};
