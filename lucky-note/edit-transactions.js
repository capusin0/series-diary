import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, collection, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let items = [];
let editingId = null;
let unsubscribe = null;

function notify(text){
  const el=$('toast');
  if(el){
    el.textContent=text;el.style.display='block';
    setTimeout(()=>el.style.display='none',2600);
  }else alert(text);
}

function setModalMode(editing){
  const modal=$('txModal');
  if(!modal) return;
  const title=modal.querySelector('.modalbox > .row > b');
  if(title) title.textContent=editing?'แก้ไขรายการ':'เพิ่มรายการเงิน';
  const btn=$('saveTxBtn');
  if(btn) btn.textContent=editing?'บันทึกการแก้ไข':'บันทึกขึ้น Cloud';
}

const originalOpenTx = window.openTx;
window.openTx = (...args)=>{
  editingId=null;
  setModalMode(false);
  return originalOpenTx?.(...args);
};

const originalCloseM=window.closeM;
window.closeM=id=>{
  if(id==='txModal'){
    editingId=null;
    setModalMode(false);
  }
  return originalCloseM?.(id);
};

function fillExtras(extras={}){
  document.querySelectorAll('#extraFields [data-extra]').forEach(el=>{
    el.value = extras[el.dataset.extra] ?? '';
  });
}

window.editTx = id=>{
  const x=items.find(t=>t.id===id);
  if(!x){notify('กำลังซิงก์ข้อมูล กรุณาลองกดแก้ไขอีกครั้ง');return;}
  editingId=id;
  $('txType').value=x.type||'expense';
  $('txDate').value=x.date||'';
  $('txAmount').value=x.amount??'';
  $('txAccount').value=x.account||'ส่วนตัว/บ้าน';
  window.updateCats?.();

  if(x.category){
    const exists=[...$('txCategory').options].some(o=>o.value===x.category);
    if(!exists){
      const opt=document.createElement('option');
      opt.value=x.category;opt.textContent=x.category;
      $('txCategory').appendChild(opt);
    }
    $('txCategory').value=x.category;
  }

  window.renderExtras?.();
  fillExtras(x.extras||{});
  $('txWithheld').value=x.withheld||0;
  $('txNote').value=x.note||'';
  $('taxDeductible').checked=!!x.taxDeductible;
  setModalMode(true);
  $('txModal').classList.add('show');
};

window.deleteTxFromList = async id=>{
  if(!confirm('ลบรายการนี้หรือไม่?')) return;
  const u=auth.currentUser;
  if(!u)return notify('กรุณาเข้าสู่ระบบก่อน');
  try{
    await deleteDoc(doc(db,'users',u.uid,'transactions',id));
    notify('ลบรายการแล้ว');
  }catch(e){
    notify('ลบไม่สำเร็จ: '+e.message);
  }
};

const originalSaveTx = window.saveTx;
window.saveTx = async()=>{
  if(!editingId) return originalSaveTx?.();
  const u=auth.currentUser;
  if(!u)return notify('กรุณาเข้าสู่ระบบก่อน');
  const amount=+$('txAmount').value;
  if(!amount){ notify('กรุณาใส่จำนวนเงิน'); return; }
  const btn=$('saveTxBtn');
  btn.disabled=true;
  btn.textContent='กำลังบันทึก…';
  try{
    await updateDoc(doc(db,'users',u.uid,'transactions',editingId),{
      type:$('txType').value,
      date:$('txDate').value,
      amount,
      account:$('txAccount').value,
      category:$('txCategory').value,
      note:$('txNote').value,
      withheld:+$('txWithheld').value||0,
      taxDeductible:$('txType').value==='expense'&&$('taxDeductible').checked,
      extras:Object.fromEntries([...document.querySelectorAll('#extraFields [data-extra]')].map(x=>[x.dataset.extra,x.value])),
      updatedAt:serverTimestamp()
    });
    editingId=null;
    $('txModal').classList.remove('show');
    setModalMode(false);
    notify('แก้ไขและซิงก์แล้ว ✓');
  }catch(e){
    notify('แก้ไขไม่สำเร็จ: '+e.message);
  }finally{
    btn.disabled=false;
    btn.textContent=editingId?'บันทึกการแก้ไข':'บันทึกขึ้น Cloud';
  }
};

function actionCell(id){
  const td=document.createElement('td');
  td.className='tx-actions';
  td.innerHTML=`<div class="tx-action-wrap"><button type="button" class="btn soft tx-edit" onclick="editTx('${id}')">แก้ไข</button><button type="button" class="btn danger" onclick="deleteTxFromList('${id}')">ลบ</button></div>`;
  return td;
}

function decorate(){
  const recentRows=[...document.querySelectorAll('#recent tbody tr')];
  recentRows.forEach((tr,i)=>{
    if(!items[i]) return;
    const existing=tr.querySelector('.tx-actions');
    if(existing){
      if(existing.dataset.id===items[i].id)return;
      existing.remove();
    }
    const cell=actionCell(items[i].id);cell.dataset.id=items[i].id;tr.appendChild(cell);
  });

  const historyRows=[...document.querySelectorAll('#txHistory tbody tr')];
  historyRows.forEach((tr,i)=>{
    if(!items[i]) return;
    const old=tr.lastElementChild;
    if(old?.querySelector('button')&&!old.classList.contains('tx-actions')) old.remove();
    const existing=tr.querySelector('.tx-actions');
    if(existing){
      if(existing.dataset.id===items[i].id)return;
      existing.remove();
    }
    const cell=actionCell(items[i].id);cell.dataset.id=items[i].id;tr.appendChild(cell);
  });
}

const observer=new MutationObserver(()=>requestAnimationFrame(decorate));
['recent','txHistory'].forEach(id=>{const el=$(id); if(el) observer.observe(el,{childList:true,subtree:true});});

function start(u){
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  items=[];
  if(!u) return;
  unsubscribe=onSnapshot(query(collection(db,'users',u.uid,'transactions'),orderBy('date','desc')),snap=>{
    items=snap.docs.map(d=>({id:d.id,...d.data()}));
    requestAnimationFrame(decorate);
  },e=>console.error('edit sync error',e));
}

onAuthStateChanged(auth,u=>start(u));

const style=document.createElement('style');
style.textContent='.tx-action-wrap{display:flex;gap:6px;justify-content:flex-end;white-space:nowrap}.tx-actions .btn{padding:7px 10px;font-size:12px}@media(max-width:620px){.tx-action-wrap{flex-direction:column}.tx-actions .btn{padding:6px 8px}}';
document.head.appendChild(style);
