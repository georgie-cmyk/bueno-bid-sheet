// Builds an agency's mailing address from its OG office only.
// Companies records keep the OG street in Address and tag every office in
// City/State, so the Full Address formula lists all offices. This uses
// Address + Zip, plus the state: CA when a California tag exists (OG rule),
// otherwise the state only when there is exactly one tag.
const US = Object.fromEntries(('alabama AL,alaska AK,arizona AZ,arkansas AR,colorado CO,connecticut CT,delaware DE,' +
  'district of columbia DC,florida FL,georgia GA,hawaii HI,idaho ID,illinois IL,indiana IN,iowa IA,kansas KS,' +
  'kentucky KY,louisiana LA,maine ME,maryland MD,massachusetts MA,michigan MI,minnesota MN,mississippi MS,' +
  'missouri MO,montana MT,nebraska NE,nevada NV,new hampshire NH,new jersey NJ,new mexico NM,new york NY,' +
  'north carolina NC,north dakota ND,ohio OH,oklahoma OK,oregon OR,pennsylvania PA,rhode island RI,' +
  'south carolina SC,south dakota SD,tennessee TN,texas TX,utah UT,vermont VT,virginia VA,washington WA,' +
  'west virginia WV,wisconsin WI,wyoming WY').split(',').map(s => { const i = s.lastIndexOf(' '); return [s.slice(0, i), s.slice(i + 1)]; }));

module.exports = function ogAddress(fields) {
  const f = fields || {};
  const name = String(f['Company'] || '').trim().toLowerCase();
  let street = String(f['Address'] || '').trim();
  if (street.split('\n')[0].trim().toLowerCase() === name) {
    street = street.split('\n').slice(1).join('\n').trim();
  }
  const states = [].concat(f['State'] || []).map(s => String(s).trim()).filter(Boolean);
  let state = '';
  if (states.some(s => /^California/i.test(s))) state = 'CA';
  else if (states.length === 1) state = US[states[0].toLowerCase()] || states[0];
  const zip = String(f['Zip'] || '').trim();
  const tail = [state, zip].filter(Boolean).join(' ');
  return [street, tail].filter(Boolean).join(', ');
};
