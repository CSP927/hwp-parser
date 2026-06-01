const express = require('express');

const app = express();

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
res.set('Access-Control-Allow-Origin', '*');
res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.set('Access-Control-Allow-Headers', 'Content-Type');

if (req.method === 'OPTIONS') {
return res.sendStatus(204);
}

next();
});

let rhwpInitialized = false;
let rhwpModule = null;

async function initRhwp() {
if (rhwpInitialized) return rhwpModule;

const path = require('path');
const fs = require('fs');

const rhwp = await import('@rhwp/core');

const wasmPath = path.join(
require.resolve('@rhwp/core'),
'../rhwp_bg.wasm'
);

const wasmBuffer = fs.readFileSync(wasmPath);

globalThis.measureTextWidth = function(font, text) {
return text.length * 8;
};

await rhwp.default(wasmBuffer);

rhwpModule = rhwp;
rhwpInitialized = true;

console.log('RHWP 초기화 완료');

return rhwpModule;
}

async function extractTextFromHwp(fileBuffer) {

const rhwp = await initRhwp();

let doc = null;

try {


doc = new rhwp.HwpDocument(
  new Uint8Array(fileBuffer)
);

let text = '';

const sectionCount = doc.getSectionCount();

for (let s = 0; s < sectionCount; s++) {

  const paraCount = doc.getParagraphCount(s);

  for (let p = 0; p < paraCount; p++) {

    const paraLen = doc.getParagraphLength(s, p);

    if (paraLen > 0) {

      const paraText = doc.getTextRange(
        s,
        p,
        0,
        paraLen
      );

      if (paraText) {
        text += paraText + '\n';
      }

    } else {

      text += '\n';

    }
  }
}

return text
  .replace(/\n{3,}/g, '\n\n')
  .trim();


} finally {


if (doc) {
  try {
    doc.free();
  } catch(e) {}
}


}
}

app.post('/extract-hwp', async (req, res) => {

try {


const { fileBase64 } = req.body;

if (!fileBase64) {
  return res.status(400).json({
    error: '파일 데이터 없음'
  });
}

const buffer = Buffer.from(
  fileBase64,
  'base64'
);

const text = await extractTextFromHwp(buffer);

res.json({
  success: true,
  text
});


} catch(e) {


console.error(e);

res.status(500).json({
  success: false,
  error: e.message
});


}
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log('서버 시작:', PORT);
});
