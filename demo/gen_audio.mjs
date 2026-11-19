import fs from 'node:fs';
const S = JSON.parse(fs.readFileSync('C:/Users/RONIT/pr_secrets.json', 'utf8'));
const clips = {
  deduct: ['priya', 'ZipDrop మీ వారపు చెల్లింపులో 580 రూపాయలను అడ్జస్ట్‌మెంట్స్ పేరుతో ఎలాంటి కారణం చెప్పకుండా కట్ చేసింది. తెలంగాణ గిగ్ వర్కర్ల చట్టం, సెక్షన్ 15(1) ప్రకారం, ప్రతి కోతకు కారణం తప్పనిసరిగా చెప్పాలి. ఇది న్యాయ సలహా కాదు, మీ యూనియన్‌తో నిర్ధారించుకోండి.'],
  block: ['priya', 'మీ జిప్‌డ్రాప్ ఖాతాను 17 నవంబర్ నాడు బ్లాక్ చేశారు, కారణం చాలా మంది కస్టమర్ ఫిర్యాదులు అని చెప్పారు. తెలంగాణ ప్లాట్‌ఫామ్ ఆధారిత గిగ్ వర్కర్ల చట్టం 2026, సెక్షన్ 14 ప్రకారం, బ్లాక్ చేసే ముందు 7 రోజుల ముందస్తు నోటీసు, సరైన కారణాలతో రాతపూర్వకంగా ఇవ్వాలి, కానీ మీ స్క్రీన్‌షాట్లలో అలాంటి నోటీసు కనిపించలేదు. ఫిర్యాదు చేయడానికి చివరి తేదీ 25 నవంబర్ కావచ్చు, అందుకే త్వరగా చేయడం మంచిది.'],
  q1: ['priya', 'మీ కేసును బలంగా చేయడానికి నేను నాలుగు చిన్న ప్రశ్నలు అడుగుతాను. మీ ఐడి ఏ రోజు బ్లాక్ అయింది?'],
  a1: ['rahul', 'నా ఐడి 17 నవంబర్ నాడు బ్లాక్ అయింది.'],
  q2: ['priya', 'బ్లాక్ అయ్యే ముందు మీకు ఏదైనా నోటీసు లేదా మెసేజ్ వచ్చిందా?'],
  a2: ['rahul', 'లేదు, నాకు ఎలాంటి నోటీసు రాలేదు. సీదా బ్లాక్ చేశారు.'],
  done: ['priya', 'ధన్యవాదాలు. నేను మీ ఫిర్యాదు లేఖను సిద్ధం చేస్తున్నాను.'],
  rate: ['priya', 'జిప్‌డ్రాప్ మాదాపూర్‌లో బేస్ పే 25 రూపాయల నుండి 20 రూపాయలకు, 14 రోజుల నోటీసు లేకుండా మార్చారు. తెలంగాణ చట్టం సెక్షన్ 13(2) ప్రకారం, 14 రోజుల ముందుగా నోటీసు ఇవ్వాలి. మీరు ఒంటరి కాదు, 41 మంది రైడర్లు ప్రభావితమయ్యారు. మేము యూనియన్‌కు తెలియజేశాం.'],
};
const out = {};
await Promise.all(Object.entries(clips).map(async ([k, [speaker, text]]) => {
  const r = await fetch('https://api.sarvam.ai/text-to-speech', { method: 'POST', headers: { 'api-subscription-key': S.SARVAM_API_KEY.trim(), 'content-type': 'application/json' },
    body: JSON.stringify({ text, language_code: 'te-IN', model: 'bulbul:v3', speaker, output_audio_codec: 'mp3' }) });
  const j = await r.json();
  if (!r.ok) throw new Error(k + ' ' + JSON.stringify(j).slice(0, 200));
  out[k] = 'data:audio/mpeg;base64,' + j.audios[0];
  console.log(k, Math.round(j.audios[0].length * 0.75 / 1024) + ' KB');
}));
const html = fs.readFileSync('index.html', 'utf8').replace(/const AUDIO=\{[^\n]*\};/, 'const AUDIO=' + JSON.stringify(out) + ';');
fs.writeFileSync('index.html', html);
console.log('embedded', Object.keys(out).length, 'clips');
