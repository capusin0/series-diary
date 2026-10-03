import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, collection, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let items = [];
let editingId = null;
let unsubscribe = null;

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

function fillExtras(extras={}){
  document.querySelectorAll('[data-extra]').forEach(el=>{
    el.value = extras[el.dataset.extra] ?? '';
  });
}

window.editTx = id=>{
  const x=items.find(t=>t.id===id);
  if(!x) return;
  editingId=id;
  $('txType').value=x.type||'expense';
  $('txDate').value=x.date||'';
  $('txAmount').value=x.amount??'';
  $('txAccount').value=x.account||'ส่วนตัว/บ้าน';
  window.updateCats?.();
  if([...$('txCategory').options].some(o=>o.value===x.category)) $('txCategory').value=x.category;
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
  try{
    await deleteDoc(doc(db,'users',auth.currentUser.uid,'transactions',id));
  }catch(e){
    alert('ลบไม่สำเร็จ: '+e.message);
  }
};

const originalSaveTx = window.saveTx;
window.saveTx = async()=>{
  if(!editingId) return originalSaveTx?.();
  const amount=+$('txAmount').value;
  if(!amount){ alert('กรุณาใส่จำนวนเงิน'); return; }
  const btn=$('saveTxBtn');
  btn.disabled=true;
  btn.textContent='กำลังบันทึก…';
  try{
    await updateDoc(doc(db,'users',auth.currentUser.uid,'transactions',editingId),{
      type:$('txType').value,
      date:$('txDate').value,
      amount,
      account:$('txAccount').value,
      category:$('txCategory').value,
      note:$('txNote').value,
      withheld:+$('txWithheld').value||0,
      taxDeductible:$('txType').value==='expense'&&$('taxDeductible').checked,
      extras:Object.fromEntries([...document.querySelectorAll('[data-extra]')].map(x=>[x.dataset.extra,x.value])),
      updatedAt:serverTimestamp()
    });
    editingId=null;
    $('txModal').classList.remove('show');
    setModalMode(false);
  }catch(e){
    alert('แก้ไขไม่สำเร็จ: '+e.message);
  }finally{
    btn.disabled=false;
    btn.textContent='บันทึกขึ้น Cloud';
  }
};

function actionCell(id){
  const td=document.createElement('td');
  td.className='tx-actions';
  td.innerHTML=`<div class="tx-action-wrap"><button class="btn tx-edit" onclick="editTx('${id}')">แก้ไข</button><button class="btn danger" onclick="deleteTxFromList('${id}')">ลบ</button></div>`;
  return td;
}

function decorate(){
  const recentRows=[...document.querySelectorAll('#recent tbody tr')];
  recentRows.forEach((tr,i)=>{
    if(tr.querySelector('.tx-actions')||!items[i]) return;
    tr.appendChild(actionCell(items[i].id));
  });

  const historyRows=[...document.querySelectorAll('#txHistory tbody tr')];
  historyRows.forEach((tr,i)=>{
    if(!items[i]) return;
    const old=tr.lastElementChild;
    if(old?.querySelector('button')) old.remove();
    if(!tr.querySelector('.tx-actions')) tr.appendChild(actionCell(items[i].id));
  });
}

const observer=new MutationObserver(()=>decorate());
['recent','txHistory'].forEach(id=>{const el=$(id); if(el) observer.observe(el,{childList:true,subtree:true});});

function start(){
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  const u=auth.currentUser;
  if(!u) return;
  unsubscribe=onSnapshot(query(collection(db,'users',u.uid,'transactions'),orderBy('date','desc')),snap=>{
    items=snap.docs.map(d=>({id:d.id,...d.data()}));
    requestAnimationFrame(decorate);
  });
}

auth.onAuthStateChanged(()=>start());
