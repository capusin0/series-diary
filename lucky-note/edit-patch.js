import { getApps } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
const app=getApps()[0];
const auth=getAuth(app);
const db=getFirestore(app);
let editingId=null;
let txItems=[];
let unsub=null;

const toast=t=>{
  const el=$('toast');
  if(!el)return;
  el.textContent=t;el.style.display='block';
  setTimeout(()=>el.style.display='none',2600);
};

function resetEditMode(){
  editingId=null;
  const title=document.querySelector('#txModal .modalbox > .row b');
  if(title)title.textContent='เพิ่มรายการเงิน';
  const btn=$('saveTxBtn');
  if(btn)btn.textContent='บันทึกขึ้น Cloud';
}

const originalOpenTx=window.openTx;
window.openTx=()=>{
  resetEditMode();
  if($('txType'))$('txType').value='income';
  if($('txAmount'))$('txAmount').value='';
  if($('txNote'))$('txNote').value='';
  if($('txWithheld'))$('txWithheld').value='0';
  if($('taxDeductible'))$('taxDeductible').checked=false;
  originalOpenTx?.();
};

const originalCloseM=window.closeM;
window.closeM=id=>{
  if(id==='txModal')resetEditMode();
  originalCloseM?.(id);
};

window.editTx=async id=>{
  const u=auth.currentUser;
  if(!u)return toast('กรุณาเข้าสู่ระบบก่อน');
  try{
    const snap=await getDoc(doc(db,'users',u.uid,'transactions',id));
    if(!snap.exists())return toast('ไม่พบรายการนี้');
    const x=snap.data();
    editingId=id;

    $('txType').value=x.type||'expense';
    $('txDate').value=x.date||'';
    $('txAmount').value=x.amount??'';
    $('txAccount').value=x.account||'ส่วนตัว/บ้าน';
    $('txNote').value=x.note||'';
    $('txWithheld').value=x.withheld||0;
    $('taxDeductible').checked=!!x.taxDeductible;

    window.updateCats?.();
    if(x.category){
      const exists=[...$('txCategory').options].some(o=>o.value===x.category);
      if(!exists){
        const opt=document.createElement('option');opt.value=x.category;opt.textContent=x.category;$('txCategory').appendChild(opt);
      }
      $('txCategory').value=x.category;
    }
    window.renderExtras?.();
    Object.entries(x.extras||{}).forEach(([k,v])=>{
      const el=document.querySelector(`[data-extra="${CSS.escape(k)}"]`);
      if(el)el.value=v??'';
    });

    const title=document.querySelector('#txModal .modalbox > .row b');
    if(title)title.textContent='แก้ไขรายการเงิน';
    $('saveTxBtn').textContent='บันทึกการแก้ไข';
    $('txModal').classList.add('show');
  }catch(e){
    console.error(e);toast('เปิดรายการเพื่อแก้ไขไม่สำเร็จ');
  }
};

const originalSaveTx=window.saveTx;
window.saveTx=async()=>{
  if(!editingId)return originalSaveTx?.();
  const u=auth.currentUser;
  const amount=+$('txAmount').value;
  if(!amount)return toast('กรุณาใส่จำนวนเงิน');
  const btn=$('saveTxBtn');
  btn.disabled=true;btn.textContent='กำลังบันทึก…';
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
    $('txModal').classList.remove('show');
    resetEditMode();
    toast('แก้ไขและซิงก์แล้ว ✓');
  }catch(e){
    console.error(e);toast('แก้ไขไม่สำเร็จ: '+e.message);
  }finally{
    btn.disabled=false;
    if(editingId)btn.textContent='บันทึกการแก้ไข';
  }
};

function actionButton(label,cls,handler){
  const b=document.createElement('button');
  b.type='button';b.className=`btn ${cls}`;b.textContent=label;b.onclick=handler;
  return b;
}

function decorateRows(){
  [['recent',txItems.slice(0,5)],['txHistory',txItems]].forEach(([id,list])=>{
    const box=$(id);if(!box)return;
    [...box.querySelectorAll('tbody tr')].forEach((tr,i)=>{
      const x=list[i];if(!x)return;
      let cell=[...tr.children].find(td=>td.classList?.contains('tx-actions'));
      if(!cell){
        const oldDelete=tr.querySelector('button[onclick^="deleteTx("]');
        cell=oldDelete?.closest('td')||document.createElement('td');
        if(!cell.parentNode)tr.appendChild(cell);
        cell.classList.add('tx-actions');
      }
      if(cell.dataset.forId===x.id)return;
      cell.dataset.forId=x.id;cell.innerHTML='';
      const wrap=document.createElement('div');wrap.className='tx-action-wrap';
      wrap.appendChild(actionButton('แก้ไข','soft',()=>window.editTx(x.id)));
      wrap.appendChild(actionButton('ลบ','danger',()=>window.deleteTx(x.id)));
      cell.appendChild(wrap);
    });
  });
}

const obs=new MutationObserver(()=>requestAnimationFrame(decorateRows));
['recent','txHistory'].forEach(id=>{const el=$(id);if(el)obs.observe(el,{childList:true,subtree:true});});

onAuthStateChanged(auth,u=>{
  unsub?.();txItems=[];
  if(!u)return;
  unsub=onSnapshot(query(collection(db,'users',u.uid,'transactions'),orderBy('date','desc')),snap=>{
    txItems=snap.docs.map(d=>({id:d.id,...d.data()}));
    setTimeout(decorateRows,0);
  });
});

const style=document.createElement('style');
style.textContent='.tx-action-wrap{display:flex;gap:6px;justify-content:flex-end;white-space:nowrap}.tx-actions .btn{padding:7px 10px;font-size:12px}@media(max-width:620px){.tx-action-wrap{flex-direction:column}.tx-actions .btn{padding:6px 8px}}';
document.head.appendChild(style);
