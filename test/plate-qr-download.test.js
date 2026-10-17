const {test}=require('node:test');
const assert=require('node:assert/strict');
const {unzipSync,strFromU8}=require('fflate');
const {plateQrSvg}=require('../modules/plate-qr');
const {plateQrZip,validCodes}=require('../modules/plate-qr-download');

test('QR ZIP accepts only 1–50 unique plate codes and keeps every original SVG and serial',async()=>{
 const plates=Array.from({length:50},(_,i)=>({code:'PL-'+String(i+1).padStart(6,'0'),serialNumber:1000+i,destinationUrl:'https://never-encode.example.test/changed'}));
 assert.equal(validCodes(plates.map(p=>p.code)),true);
 for(const codes of [null,{},[],['../escape.svg'],['PL-000001','PL-000001'],[1],[['PL-000001']],Array.from({length:51},(_,i)=>'PL-'+String(i).padStart(6,'0'))])assert.equal(validCodes(codes),false);
 const permanent=code=>`https://public.example.test/r/${code}`;
 const zip=await plateQrZip(plates,permanent);
 assert.equal(zip.readUInt32LE(0),0x04034b50);
 const files=unzipSync(zip);assert.equal(Object.keys(files).length,50);
 for(const plate of plates){
  const svg=strFromU8(files[`${plate.code}-${plate.serialNumber}.svg`]);
  assert.equal(svg,await plateQrSvg(permanent(plate.code),plate.serialNumber));
  assert.ok(!svg.includes(plate.destinationUrl));
 }
 await assert.rejects(plateQrZip([{...plates[0],serialNumber:null}],permanent));
});
