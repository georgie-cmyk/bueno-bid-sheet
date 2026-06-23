// Bueno internal sales reps — shown in the Sales Rep dropdown on the bid sheet.
// To add someone: create a People record in Airtable, then add them here.
const BUENO_STAFF = [
  { id: 'reck0FheqIPklq5WT', name: 'Ashley' },
  { id: 'recXeTb08TMQivLwv', name: 'Millie' },
];

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=3600');
  return res.status(200).json(BUENO_STAFF);
};
