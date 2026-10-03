import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, deleteDoc, updateDoc, setDoc,
  query, orderBy, onSnapshot, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
await setPersistence(auth, browserLocalPersistence);

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n)||0);
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>crypto.randomUUID?.() || Date.now()+"-"+Math.random();
const toast=t=>{const el=$('toast');el.textContent=t;el.style.display='block';setTimeout(()=>el.style.display='none',2600)};
const THM=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

let user=null, txs=[], todos=[], settings={deduction:60000,extraTaxExpense:0}, unsubTx=null, unsubTodo=null;
let currentFile=null, previewUrl="", calDate=new Date();

const EXPENSES=["ค่าอาหาร","ค่าแรงคนงาน","ค่าผ่อนรถ / ค่าเดินทาง","ค่าน้ำมันรถ","ค่าแก๊ส","ค่าไฟฟ้า","ค่าโทรศัพท์มือถือ","ค่าอินเทอร์เน็ต","ค่าของใช้ในบ้าน","ค่าซื้อของใช้ส่วนตัว","ค่าเล่าเรียน / ค่าใช้จ่ายเกี่ยวกับลูก","ค่ารักษาพยาบาล / ค่ายา","ค่าประกันชีวิต / ประกันสุขภาพ / ประกันรถ","ดอกเบี้ย / ชำระหนี้","ค่าซื้อของออนไลน์","ค่าเสื้อผ้า / รองเท้า / เครื่องแต่งกาย","ค่าความบันเทิง / ดูหนัง / ท่องเที่ยว","ค่าสมาชิกแอป / Streaming / Subscription","ค่าเลี้ยงสัตว์","ค่าใช้จ่ายสวน","ค่ากาแฟ","ค่าเซเว่น","โอนระหว่างบัญชี","สมาชิกในบ้าน","ของขวัญลูก","อื่น ๆ"];
const INCOMES=["รายได้จากเกษตรกรรม","เงินปันผล","โอนระหว่างบัญชี","มีคนให้","เงินกู้","รายได้ออนไลน์","ค่าจ้าง / รายได้เสริม","ขายสินค้า / บริการ","ดอกเบี้ยรับ","อื่น ๆ"];

const FIELDS={
"ค่าอาหาร":[["meal","มื้ออาหาร","select",["เช้า","กลางวัน","เย็น","ของว่าง"]],["place","ร้าน/สถานที่","text"]],
"ค่าแรงคนงาน":[["worker","ชื่อ/ทีมคนงาน","text"],["days","จำนวนวัน","number"],["work","ลักษณะงาน","text"]],
"ค่าผ่อนรถ / ค่าเดินทาง":[["vehicle","รถ/พาหนะ","text"],["installment","งวดที่","number"],["route","เส้นทาง/จุดหมาย","text"]],
"ค่าน้ำมันรถ":[["vehicle","รถคันไหน","text"],["station","ปั๊ม","text"],["liters","ลิตร","number"],["mileage","เลขไมล์","number"]],
"ค่าไฟฟ้า":[["meter","บ้าน/มิเตอร์","text"],["period","รอบบิล","text"]],
"ค่าโทรศัพท์มือถือ":[["phone","เบอร์/ชื่อผู้ใช้","text"],["provider","เครือข่าย","text"]],
"ค่าอินเทอร์เน็ต":[["provider","ผู้ให้บริการ","text"],["package","แพ็กเกจ","text"]],
"ค่าเล่าเรียน / ค่าใช้จ่ายเกี่ยวกับลูก":[["child","ชื่อลูก","text"],["school","โรงเรียน/สถาบัน","text"],["purpose","รายการ","text"]],
"ค่ารักษาพยาบาล / ค่ายา":[["person","ของใคร","text"],["place","โรงพยาบาล/ร้านยา","text"],["purpose","รายการ","text"]],
"ค่าประกันชีวิต / ประกันสุขภาพ / ประกันรถ":[["kind","ประเภท","select",["ชีวิต","สุขภาพ","รถ","อื่น ๆ"]],["company","บริษัท","text"],["policy","กรมธรรม์/ทะเบียน","text"]],
"ดอกเบี้ย / ชำระหนี้":[["creditor","เจ้าหนี้/ธนาคาร","text"],["kind","ประเภทหนี้","text"],["principal","เงินต้น","number"],["interest","ดอกเบี้ย","number"]],
"ค่าซื้อของออนไลน์":[["platform","แพลตฟอร์ม","select",["Shopee","Lazada","TikTok Shop","Facebook","อื่น ๆ"]],["item","สินค้า","text"],["order","เลขคำสั่งซื้อ","text"]],
"ค่าสมาชิกแอป / Streaming / Subscription":[["service","บริการ","text"],["cycle","รอบชำระ","select",["รายเดือน","รายปี","อื่น ๆ"]],["renewal","วันต่ออายุ","date"]],
"ค่าใช้จ่ายสวน":[["plot","แปลง/สวน","text"],["kind","ประเภท","select",["ปุ๋ย","ยา","สารบำรุง","อุปกรณ์","ค่าแรง","ค่าน้ำ","ค่าน้ำมัน","ซ่อมบำรุง","อื่น ๆ"]],["item","รายการ","text"],["qty","จำนวน/หน่วย","text"]],
"รายได้จากเกษตรกรรม":[["product","ผลผลิต","text"],["buyer","ผู้ซื้อ/ล้ง","text"],["qty","จำนวน/น้ำหนัก","text"],["unitPrice","ราคาต่อหน่วย","number"],["plot","แปลง/สวน","text"]],
"เงินปันผล":[["source","บริษัท/กองทุน","text"],["units","จำนวนหุ้น/หน่วย","text"]],
"รายได้ออนไลน์":[["platform","แพลตฟอร์ม","select",["Adobe Stock","Etsy","TPT","TikTok","Shopee","Facebook","YouTube","อื่น ๆ"]],["source","รายละเอียด","text"],["currency","สกุลเงิน","text"]],
"เงินกู้":[["lender","ผู้ให้กู้/ธนาคาร","text"],["kind","ประเภทเงินกู้","text"],["term","ระยะเวลา/งวด","text"]],
"โอนระหว่างบัญชี":[["from","จากบัญชี","text"],["to","เข้าบัญชี","text"]],
};

function configured(){
  return firebaseConfig && !Object.values(firebaseConfig).some(v=>String(v).includes("YOUR_"));
}
if(!configured()){
  $('authMsg').innerHTML='⚠️ ยังไม่ได้ใส่ Firebase Config กรุณาแก้ไฟล์ <b>firebase-config.js</b> ตาม README ก่อนใช้งาน';
  ['loginBtn','registerBtn','googleBtn'].forEach(id=>$(id).disabled=true);
}

function authValues(){
  const email=$('authEmail').value.trim();
  const password=$('authPassword').value;
  if(!email){$('authMsg').textContent='กรุณากรอกอีเมล';$('authEmail').focus();return null;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('authMsg').textContent='รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com';$('authEmail').focus();return null;}
  if(!password){$('authMsg').textContent='กรุณากรอกรหัสผ่าน';$('authPassword').focus();return null;}
  return {email,password};
}
function friendlyAuthMessage(e,mode='login'){
  const code=e?.code||'';
  const map={
    'auth/invalid-email':'รูปแบบอีเมลไม่ถูกต้อง',
    'auth/missing-password':'กรุณากรอกรหัสผ่าน',
    'auth/invalid-credential':'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    'auth/user-not-found':'ยังไม่พบบัญชีนี้ ลองกด “สร้างบัญชี” ก่อน',
    'auth/wrong-password':'รหัสผ่านไม่ถูกต้อง',
    'auth/email-already-in-use':'อีเมลนี้มีบัญชีอยู่แล้ว กรุณากด “เข้าสู่ระบบ” หรือใช้ Google',
    'auth/weak-password':'รหัสผ่านไม่ผ่านเงื่อนไข กรุณาใช้รหัสผ่านที่ยาวและเดายากขึ้น',
    'auth/operation-not-allowed':'Firebase ยังไม่ได้เปิดวิธีเข้าสู่ระบบนี้ — กรุณาเปิด Authentication > Sign-in method ก่อน',
    'auth/admin-restricted-operation':'Firebase ยังไม่อนุญาตให้สร้างบัญชีด้วยวิธีนี้',
    'auth/popup-closed-by-user':'ยกเลิกการเข้าสู่ระบบด้วย Google',
    'auth/popup-blocked':'Safari บล็อกหน้าต่าง Google กรุณาเปิดเว็บใน Safari โดยตรง แล้วลองใหม่',
    'auth/cancelled-popup-request':'มีหน้าต่างเข้าสู่ระบบ Google เปิดอยู่แล้ว',
    'auth/unauthorized-domain':'โดเมน capusin0.github.io ยังไม่ได้รับอนุญาตใน Firebase Authentication',
    'auth/network-request-failed':'เชื่อมต่อ Firebase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่',
    'auth/too-many-requests':'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
    'auth/web-storage-unsupported':'เบราว์เซอร์นี้ไม่อนุญาตการเก็บสถานะล็อกอิน กรุณาเปิดใน Safari โดยตรง',
    'auth/internal-error':'Firebase มีข้อผิดพลาดภายใน กรุณาลองใหม่'
  };
  const base=map[code] || (mode==='register'?'สร้างบัญชีไม่สำเร็จ':'เข้าสู่ระบบไม่สำเร็จ');
  return `${base}${code?`\nรหัส: ${code}`:''}`;
}
$('loginBtn').onclick=async()=>{const v=authValues();if(!v)return;$('authMsg').textContent='กำลังเข้าสู่ระบบ…';try{await signInWithEmailAndPassword(auth,v.email,v.password)}catch(e){$('authMsg').textContent=friendlyAuthMessage(e,'login')}};
$('registerBtn').onclick=async()=>{const v=authValues();if(!v)return;if(v.password.length<6){$('authMsg').textContent='รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';$('authPassword').focus();return;}$('authMsg').textContent='กำลังสร้างบัญชี…';try{await createUserWithEmailAndPassword(auth,v.email,v.password);toast('สร้างบัญชีแล้ว ✓')}catch(e){$('authMsg').textContent=friendlyAuthMessage(e,'register')}};
$('googleBtn').onclick=async()=>{$('authMsg').textContent='กำลังเปิด Google…';try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){$('authMsg').textContent=friendlyAuthMessage(e,'google')}};
$('logoutBtn').onclick=()=>signOut(auth);
$('authEmail').addEventListener('input',()=>{if($('authMsg').textContent.includes('อีเมล'))$('authMsg').textContent='กรอกอีเมลและรหัสผ่าน หรือเลือกเข้าสู่ระบบด้วย Google'});
$('authPassword').addEventListener('input',()=>{if($('authMsg').textContent.includes('รหัสผ่าน'))$('authMsg').textContent='กรอกอีเมลและรหัสผ่าน หรือเลือกเข้าสู่ระบบด้วย Google'});

onAuthStateChanged(auth, async u=>{
  user=u;
  if(!u){
    $('authView').classList.remove('hidden');$('appView').classList.add('hidden');
    unsubTx?.();unsubTodo?.();return;
  }
  $('authView').classList.add('hidden');$('appView').classList.remove('hidden');
  $('userEmail').textContent=u.email||'';
  $('userAvatar').src=u.photoURL||'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#efd0d0"/><text x="40" y="50" text-anchor="middle" font-size="34">☺</text></svg>');
  await loadSettings();
  startSync();
});

async function loadSettings(){
  const r=doc(db,'users',user.uid,'settings','main'), s=await getDoc(r);
  if(s.exists()) settings={...settings,...s.data()};
  $('deduction').value=settings.deduction||0;$('extraTaxExpense').value=settings.extraTaxExpense||0;
}
async function saveSettings(){
  settings={deduction:+$('deduction').value||0,extraTaxExpense:+$('extraTaxExpense').value||0};
  await setDoc(doc(db,'users',user.uid,'settings','main'),settings,{merge:true});render();
}
$('deduction').addEventListener('change',saveSettings);$('extraTaxExpense').addEventListener('change',saveSettings);

function startSync(){
  $('syncState').textContent='● กำลังซิงก์';
  unsubTx?.();unsubTodo?.();
  unsubTx=onSnapshot(query(collection(db,'users',user.uid,'transactions'),orderBy('date','desc')),snap=>{
    txs=snap.docs.map(d=>({id:d.id,...d.data()}));$('syncState').textContent='● ซิงก์แล้ว';render();
  },()=>{$('syncState').textContent='● ซิงก์มีปัญหา'});
  unsubTodo=onSnapshot(query(collection(db,'users',user.uid,'todos'),orderBy('date','asc')),snap=>{
    todos=snap.docs.map(d=>({id:d.id,...d.data()}));render();
  });
}

window.switchPage=id=>{document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));$(id).classList.add('active');window.scrollTo(0,0)};
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
window.closeM=id=>$(id).classList.remove('show');

window.openTx=()=>{$('txDate').value=today();clearFile();updateCats();$('txModal').classList.add('show')};
window.updateCats=()=>{const arr=$('txType').value==='expense'?EXPENSES:INCOMES;$('txCategory').innerHTML=arr.map(x=>`<option>${x}</option>`).join('');$('taxDeductible').disabled=$('txType').value!=='expense';renderExtras()};
window.renderExtras=()=>{const f=FIELDS[$('txCategory').value]||[["detail","รายละเอียดเพิ่มเติม","text"]];$('extraFields').innerHTML=f.map(([k,l,t,o])=>`<div class="field"><label>${l}</label>${t==='select'?`<select data-extra="${k}">${o.map(v=>`<option>${v}</option>`).join('')}</select>`:`<input data-extra="${k}" type="${t}" placeholder="${l}">`}</div>`).join('')};

window.previewFile=e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/'))return toast('กรุณาเลือกรูปภาพ');if(f.size>8*1024*1024)return toast('รูปใหญ่เกิน 8 MB');currentFile=f;previewUrl=URL.createObjectURL(f);$('receiptPreview').src=previewUrl;$('receiptBox').classList.remove('hidden')};
window.clearFile=()=>{currentFile=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl="";$('receiptFile').value='';$('receiptBox').classList.add('hidden');$('ocrRaw').value='';$('ocrRawWrap').classList.add('hidden');$('ocrStatus').textContent=''};
function parseOCR(text){
  const th='๐๑๒๓๔๕๖๗๘๙';
  text=(text||'').replace(/[๐-๙]/g,d=>String(th.indexOf(d))).replace(/\r/g,'');
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const lines=text.split('\n').map(clean).filter(Boolean);

  let amount=null;
  const amountPatterns=[
    /(?:ยอดสุทธิ|ยอดรวมทั้งสิ้น|ยอดรวม|รวมเงิน|จำนวนเงิน|ยอดชำระ|total\s*amount|grand\s*total|total|amount)[^\d]{0,30}([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+\.\d{2})\s*(?:บาท|THB|฿)/i
  ];
  for(const p of amountPatterns){const m=text.match(p);if(m){const n=parseFloat(m[1].replace(/,/g,''));if(Number.isFinite(n)){amount=n;break}}}
  if(!amount){
    const candidates=[...text.matchAll(/(?:^|\s)(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})(?=\s|$|บาท|฿)/gm)]
      .map(m=>parseFloat(m[1].replace(/,/g,''))).filter(n=>Number.isFinite(n)&&n>0&&n<100000000);
    if(candidates.length) amount=Math.max(...candidates);
  }

  let date='';
  let m=text.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if(m) date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  else{
    m=text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if(m){let y=+m[3];if(y<100)y+=2000;if(y>2400)y-=543;date=`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
  }

  const skip=/(ใบเสร็จ|receipt|tax invoice|เลขที่|ref|reference|วันที่|date|เวลา|time|ยอด|รวม|total|amount|บาท|thb|vat|ภาษี|เงินทอน|change|เงินสด|cash|qr|promptpay|พร้อมเพย์|บัญชี|account|สาขา|branch|tel|โทร)/i;
  const merchant=lines.find(x=>x.length>=3&&x.length<=70&&!skip.test(x)&&!/^[-\d\s.,:/]+$/.test(x))||'';

  const itemLines=lines.filter(x=>{
    if(skip.test(x)||x===merchant||x.length<3||x.length>100)return false;
    return /[ก-๙A-Za-z]/.test(x) && /\d/.test(x);
  }).slice(0,8);
  const details=itemLines.join(' • ');
  return {amount,date,merchant,details,raw:text};
}
window.scanReceipt=async()=>{
  if(!currentFile)return toast('เลือกรูปก่อน');$('ocrStatus').innerHTML='<span class="spinner"></span> กำลังอ่านข้อความ';
  try{
    const r=await Tesseract.recognize(currentFile,'tha+eng',{logger:m=>{if(m.status==='recognizing text')$('ocrStatus').textContent=`อ่านข้อความ ${Math.round((m.progress||0)*100)}%`}});
    const p=parseOCR(r.data.text);
    const raw=(p.raw||'').trim();
    const thaiCount=(raw.match(/[ก-๙]/g)||[]).length;
    const latinCount=(raw.match(/[A-Za-z]/g)||[]).length;
    const digitCount=(raw.match(/[0-9]/g)||[]).length;
    const useful=thaiCount+latinCount+digitCount;
    $('ocrRaw').value=raw;
    $('ocrRawWrap').classList.remove('hidden');
    // Auto-fill only high-confidence structured values. Never copy a guessed merchant/nonsense text into note.
    if(p.amount && p.amount>0)$('txAmount').value=p.amount.toFixed(2);
    if(p.date)$('txDate').value=p.date;
    const autoDetail=[p.merchant,p.details].filter(Boolean).join(' — ');
    if(autoDetail)$('txNote').value=autoDetail;
    if(useful<8){
      $('ocrStatus').textContent='อ่านข้อความได้ไม่ชัด กรุณากรอกข้อมูลเอง หรือใช้รูปใบเสร็จ/สลิปที่ตัวพิมพ์ชัดเจน';
    }else if(thaiCount>0 && digitCount>0){
      $('ocrStatus').textContent='กรอกข้อมูลจากสลิปให้อัตโนมัติแล้ว ✓ ตรวจสอบก่อนบันทึก';
    }else{
      $('ocrStatus').textContent='กรอกยอดเงิน วันที่ และรายละเอียดจากสลิปให้อัตโนมัติแล้ว ✓';
    }
  }catch(e){$('ocrStatus').textContent='อ่านไม่สำเร็จ ลองถ่ายใหม่ให้ชัดขึ้น'}
};

window.saveTx=async()=>{
  const amount=+$('txAmount').value;if(!amount)return toast('กรุณาใส่จำนวนเงิน');
  const btn=$('saveTxBtn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span> กำลังบันทึก';
  try{
    let receiptURL='',receiptPath='';
    if(currentFile){
      receiptPath=`users/${user.uid}/receipts/${Date.now()}-${currentFile.name.replace(/[^\w.\-]+/g,'_')}`;
      const sr=ref(storage,receiptPath);await uploadBytes(sr,currentFile,{contentType:currentFile.type});receiptURL=await getDownloadURL(sr);
    }
    await addDoc(collection(db,'users',user.uid,'transactions'),{
      type:$('txType').value,date:$('txDate').value||today(),amount,
      account:$('txAccount').value,category:$('txCategory').value,note:$('txNote').value,
      withheld:+$('txWithheld').value||0,taxDeductible:$('txType').value==='expense'&&$('taxDeductible').checked,
      extras:Object.fromEntries([...document.querySelectorAll('[data-extra]')].map(x=>[x.dataset.extra,x.value])),
      receiptURL,receiptPath,ocrText:$('ocrRaw').value||'',createdAt:serverTimestamp()
    });
    closeM('txModal');clearFile();$('txAmount').value='';$('txNote').value='';toast('บันทึกและซิงก์แล้ว ✓');
  }catch(e){console.error(e);toast('บันทึกไม่สำเร็จ: '+e.message)}
  finally{btn.disabled=false;btn.textContent='บันทึกขึ้น Cloud'}
};
window.deleteTx=async id=>{
  const x=txs.find(t=>t.id===id);if(!confirm('ลบรายการนี้หรือไม่?'))return;
  try{if(x?.receiptPath)await deleteObject(ref(storage,x.receiptPath)).catch(()=>{});await deleteDoc(doc(db,'users',user.uid,'transactions',id));toast('ลบแล้ว')}catch(e){toast(e.message)}
};
window.showImg=url=>{$('bigImg').src=url;$('imgModal').classList.add('show')};

window.openTodo=()=>{$('todoDate').value=today();$('todoModal').classList.add('show')};
window.saveTodo=async()=>{const text=$('todoText').value.trim();if(!text)return toast('ใส่งานก่อน');await addDoc(collection(db,'users',user.uid,'todos'),{text,date:$('todoDate').value||today(),category:$('todoCat').value,done:false,createdAt:serverTimestamp()});$('todoText').value='';closeM('todoModal')};
window.toggleTodo=async(id,done)=>updateDoc(doc(db,'users',user.uid,'todos',id),{done});
window.deleteTodo=async id=>deleteDoc(doc(db,'users',user.uid,'todos',id));

function calcTax(net){net=Math.max(0,net);let left=net,tax=0;for(const [w,r] of[[150000,0],[150000,.05],[200000,.1],[250000,.15],[250000,.2],[1000000,.25],[3000000,.3],[Infinity,.35]]){if(left<=0)break;const take=Math.min(left,w);tax+=take*r;left-=take}return tax}
function taxData(){
  const y=new Date().getFullYear(), a=txs.filter(x=>String(x.date||'').startsWith(String(y))), income=a.filter(x=>x.type==='income').reduce((s,x)=>s+(+x.amount||0),0),
  expense=a.filter(x=>x.type==='expense'&&x.taxDeductible).reduce((s,x)=>s+(+x.amount||0),0), withheld=a.reduce((s,x)=>s+(+x.withheld||0),0),
  net=Math.max(0,income-expense-(settings.extraTaxExpense||0)-(settings.deduction||0)),gross=calcTax(net);return{income,expense,withheld,net,gross,due:gross-withheld};
}
function extraText(x){return x.extras?Object.values(x.extras).filter(Boolean).join(' • '):''}
function receipt(x){return x.receiptURL?`<img class="thumb" src="${x.receiptURL}" onclick="showImg('${x.receiptURL.replace(/'/g,"%27")}')">`:''}
function rows(list,compact=false){
  if(!list.length)return'<div class="empty">ยังไม่มีรายการ</div>';
  return `<table><tbody>${list.map(x=>`<tr><td>${x.date||''}</td><td><b>${x.category||''}</b><div class="sub">${x.note||''}</div><div class="sub">${extraText(x)}</div>${receipt(x)}</td><td><span class="tag">${x.account||''}</span></td><td class="amount ${x.type}">${x.type==='income'?'+':'-'}${money(x.amount)}</td>${compact?'':`<td><button class="btn danger" onclick="deleteTx('${x.id}')">ลบ</button></td>`}</tr>`).join('')}</tbody></table>`;
}
function render(){
  if(!user)return;
  const now=new Date(), ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,m=txs.filter(x=>String(x.date||'').startsWith(ym)),inc=m.filter(x=>x.type==='income').reduce((s,x)=>s+(+x.amount||0),0),exp=m.filter(x=>x.type==='expense').reduce((s,x)=>s+(+x.amount||0),0),td=taxData();
  $('kInc').textContent=money(inc);$('kExp').textContent=money(exp);$('kBal').textContent=money(inc-exp);$('kTax').textContent=money(td.gross);
  $('recent').innerHTML=rows(txs.slice(0,5),true);$('txHistory').innerHTML=rows(txs,false);
  $('taxDue').textContent=money(Math.max(0,td.due));$('taxDetails').innerHTML=`<table><tbody><tr><td>รายรับปีนี้</td><td class="amount">${money(td.income)}</td></tr><tr><td>ค่าใช้จ่ายที่เลือกหัก</td><td class="amount">${money(td.expense)}</td></tr><tr><td>เงินได้สุทธิโดยประมาณ</td><td class="amount"><b>${money(td.net)}</b></td></tr><tr><td>ภาษีตามขั้น</td><td class="amount">${money(td.gross)}</td></tr><tr><td>ภาษีหัก ณ ที่จ่าย</td><td class="amount">${money(td.withheld)}</td></tr></tbody></table>`;
  $('todoList').innerHTML=todos.length?todos.map(t=>`<div class="todo ${t.done?'done':''}"><input style="width:auto" type="checkbox" ${t.done?'checked':''} onchange="toggleTodo('${t.id}',this.checked)"><div style="flex:1"><b class="todotxt">${t.text}</b><div class="sub">${t.date} • ${t.category}</div></div><button class="btn danger" onclick="deleteTodo('${t.id}')">ลบ</button></div>`).join(''):'<div class="empty">ยังไม่มีงาน</div>';
  renderCal();
}
window.moveCal=n=>{calDate.setMonth(calDate.getMonth()+n);renderCal()};
function renderCal(){
  const y=calDate.getFullYear(),m=calDate.getMonth();$('calTitle').textContent=`${THM[m]} ${y+543}`;$('calHead').innerHTML=['อา','จ','อ','พ','พฤ','ศ','ส'].map(x=>`<div class="sub" style="text-align:center">${x}</div>`).join('');
  const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),out=[];for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=d.toISOString().slice(0,10),ct=todos.filter(t=>t.date===iso&&!t.done).length,cx=txs.filter(t=>t.date===iso).length;out.push(`<div class="day ${d.getMonth()!==m?'muted':''} ${iso===today()?'today':''}"><b>${d.getDate()}</b><div class="sub">${ct?'✅ '+ct:''}</div><div class="sub">${cx?'💰 '+cx:''}</div></div>`)}$('calGrid').innerHTML=out.join('');
}
updateCats();