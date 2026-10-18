// Set window.XARC_MASSAGE_CONFIG.SOCKET_URL in public/config.js for Vercel.
// An empty URL keeps same-origin behavior for local development.
const socket = io(window.XARC_MASSAGE_CONFIG?.SOCKET_URL || undefined, {
  transports: ['websocket', 'polling'],
  reconnection: true
});
const home = document.querySelector('#home');
const chat = document.querySelector('#chat');
const create = document.querySelector('#create');
const copy = document.querySelector('#copy');
const copyCode = document.querySelector('#copyCode');
const barcodeRoom = document.querySelector('#barcodeRoom');
const barcodeServer = document.querySelector('#barcodeServer');
const barcodeRoomModal = document.querySelector('#barcodeRoomModal');
const closeBarcodeRoom = document.querySelector('#closeBarcodeRoom');
const roomQr = document.querySelector('#roomQr');
const roomQrCode = document.querySelector('#roomQrCode');
const shareBarcodeRoom = document.querySelector('#shareBarcodeRoom');
const barcodeScannerModal = document.querySelector('#barcodeScannerModal');
const closeBarcodeScanner = document.querySelector('#closeBarcodeScanner');
const barcodeScannerPreview = document.querySelector('#barcodeScannerPreview');
const barcodeScannerStatus = document.querySelector('#barcodeScannerStatus');
const scanFromGallery = document.querySelector('#scanFromGallery');
const barcodeGalleryInput = document.querySelector('#barcodeGalleryInput');
const menuButton = document.querySelector('#menuButton');
const roomMenu = document.querySelector('#roomMenu');
const deleteRoom = document.querySelector('#deleteRoom');
const changeRoom = document.querySelector('#changeRoom');
const changeCapacity = document.querySelector('#changeCapacity');
const searchRoom = document.querySelector('#searchRoom');
const searchModal = document.querySelector('#searchModal');
const closeSearch = document.querySelector('#closeSearch');
const roomCodeInput = document.querySelector('#roomCodeInput');
const joinByCode = document.querySelector('#joinByCode');
const text = document.querySelector('#text');
const send = document.querySelector('#send');
const file = document.querySelector('#file');
const attach = document.querySelector('#attach');
const galleryInput = document.querySelector('#galleryInput');
const cameraInput = document.querySelector('#cameraInput');
const cameraModal = document.querySelector('#cameraModal');
const closeCamera = document.querySelector('#closeCamera');
const cameraPreview = document.querySelector('#cameraPreview');
const cameraCanvas = document.querySelector('#cameraCanvas');
const cameraCapture = document.querySelector('#cameraCapture');
const cameraModePhoto = document.querySelector('#cameraModePhoto');
const cameraModeVideo = document.querySelector('#cameraModeVideo');
const cameraStatus = document.querySelector('#cameraStatus');
const documentInput = document.querySelector('#documentInput');
const locationModal = document.querySelector('#locationModal');
const closeLocation = document.querySelector('#closeLocation');
const locationMapEl = document.querySelector('#locationMap');
const locationCoords = document.querySelector('#locationCoords');
const sendLocation = document.querySelector('#sendLocation');
const attachmentSheet = document.querySelector('#attachmentSheet');
const closeAttachment = document.querySelector('#closeAttachment');
const messages = document.querySelector('#messages');
const jumpBottom = document.querySelector('#jumpBottom');
const status = document.querySelector('#status');
const typing = document.querySelector('#typing');
const replyPreview = document.querySelector('#replyPreview');
const replyPreviewTitle = document.querySelector('#replyPreviewTitle');
const replyPreviewText = document.querySelector('#replyPreviewText');
const cancelReply = document.querySelector('#cancelReply');
const roomNames = document.querySelector('#roomNames');
const capacityModal = document.querySelector('#capacityModal');
const closeCapacity = document.querySelector('#closeCapacity');
const customCapacity = document.querySelector('#customCapacity');
const customBox = document.querySelector('#customBox');
const customMembers = document.querySelector('#customMembers');
const capacityTitle = document.querySelector('#capacityTitle');
const capacityDescription = document.querySelector('#capacityDescription');
const createCustom = document.querySelector('#createCustom');
const capacityOptions = [...document.querySelectorAll('.capacity-option[data-capacity]')];

const params = new URLSearchParams(location.search);
let roomId = params.get('room');
let inviteCode = String(params.get('code') || '').trim().toUpperCase();
let key;
let b64key = '';
let roomCode = '';
let roomSalt = '';
let keyMode = 'legacy';
let typingTimer;
let maxMembers = 2;
let barcodeScannerStream = null;
let barcodeScanTimer = null;
let barcodeScanning = false;
let currentMembers = 1;
let capacityEditMode = false;
const MAX_FILE = 50 * 1024 * 1024;
const FILE_CHUNK_SIZE = 256 * 1024; // keeps each Socket.IO packet comfortably small
const incomingFiles = new Map();
let replyingTo = null;

function b64(bytes){
  const u=new Uint8Array(bytes);
  let binary='';
  const CHUNK=0x8000;
  for(let i=0;i<u.length;i+=CHUNK) binary+=String.fromCharCode(...u.subarray(i,Math.min(i+CHUNK,u.length)));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
const unb64 = s => { s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); };
async function makeKey(){return crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);}
async function exportKey(k){return b64(await crypto.subtle.exportKey('raw',k));}
async function importKey(s){return crypto.subtle.importKey('raw',unb64(s),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function deriveKeyFromCode(code,salt){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(code),{name:'PBKDF2'},false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(salt),iterations:150000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
}
function normalizeCode(value){return String(value||'').trim().toUpperCase();}
async function encrypt(obj){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify(obj));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data);
  return {iv:b64(iv),ct:b64(ct)};
}
async function decrypt(p){
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(p.iv)},key,unb64(p.ct));
  return JSON.parse(new TextDecoder().decode(data));
}
function showChat(){home.classList.add('hidden');chat.classList.remove('hidden');text.focus();}
function buildInviteLink(){
  // Sertakan roomId + kode. roomId menjadi jalur fallback yang stabil, sedangkan
  // kode tetap dipakai untuk tampilan/Search Private Server. Kode di-encode agar
  // karakter khusus tidak pernah diperlakukan sebagai pemisah query URL.
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', roomId || '');
  url.searchParams.set('code', roomCode || '');
  return url.toString();
}
function setLink(){
  history.replaceState({},'',buildInviteLink());
}
function setCodeLink(){ setLink(); }
function openSearchModal(){searchModal.classList.remove('hidden');setTimeout(()=>roomCodeInput.focus(),30);}
function closeSearchModal(){searchModal.classList.add('hidden');}
searchRoom.onclick=openSearchModal;
closeSearch.onclick=closeSearchModal;
searchModal.querySelector('.modal-backdrop').onclick=closeSearchModal;
roomCodeInput.addEventListener('input',()=>{roomCodeInput.value=roomCodeInput.value.slice(0,6).toUpperCase();});
function formatBytes(bytes){
  if(bytes < 1024) return `${bytes} B`;
  if(bytes < 1024*1024) return `${Math.round(bytes/102.4)/10} KB`;
  return `${Math.round(bytes/1024/102.4)/10} MB`;
}
function formatTime(ts){return new Date(ts || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}
function fileKind(mime,name=''){
  const ext=(name.split('.').pop()||'FILE').toUpperCase();
  if(mime.startsWith('image/')) return ext==='JPG'||ext==='JPEG'?'JPG':ext;
  if(mime.startsWith('video/')) return ext;
  return ext.length<=5?ext:'FILE';
}
function scrollBottom(){messages.scrollTop=messages.scrollHeight; updateJumpButton();}
function isNearBottom(){return messages.scrollHeight - messages.scrollTop - messages.clientHeight < 90;}
function updateJumpButton(){jumpBottom.classList.toggle('hidden',isNearBottom());}
jumpBottom.onclick=()=>scrollBottom();
messages.addEventListener('scroll',updateJumpButton);
function updateRoomHeader(names=[], members=1, limit=maxMembers){
  // roomCode selalu berasal dari server dan merupakan kode acak milik room aktif.
  roomNames.textContent = roomCode ? `Private Room : ${roomCode}` : 'Private Room';
  currentMembers = members;
  status.textContent = `connected ${members}/${limit}`;
  maxMembers = limit || maxMembers;
}

function openCapacityModal(edit=false){
  capacityEditMode = !!edit;
  capacityTitle.textContent = capacityEditMode ? 'Ganti kapasitas Room' : 'Pilih kapasitas room';
  capacityDescription.textContent = capacityEditMode
    ? `Kapasitas saat ini ${maxMembers}. Jumlah baru tidak boleh lebih kecil dari anggota yang sedang terhubung.`
    : 'Tentukan jumlah maksimal anggota yang dapat masuk ke room ini.';
  createCustom.textContent = capacityEditMode ? 'Simpan' : 'Buat Room';
  capacityOptions.forEach(btn => {
    const n = Number(btn.dataset.capacity);
    btn.classList.toggle('current-capacity', capacityEditMode && n === maxMembers);
  });
  customBox.classList.add('hidden');
  capacityModal.classList.remove('hidden');
}
function closeCapacityModal(){
  capacityModal.classList.add('hidden');
  capacityEditMode = false;
  createCustom.textContent = 'Buat Room';
}

create.onclick=()=>openCapacityModal(false);
closeCapacity.onclick=closeCapacityModal;
capacityModal.querySelector('.modal-backdrop').onclick=closeCapacityModal;

function autoCreate(capacity){
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) return;
  if (capacityEditMode) {
    updateRoomCapacity(capacity);
    return;
  }
  closeCapacityModal();
  createRoom(capacity);
}

capacityOptions.forEach(btn=>btn.addEventListener('click',()=>autoCreate(Number(btn.dataset.capacity))));
customCapacity.onclick=()=>{
  customBox.classList.toggle('hidden');
  if(!customBox.classList.contains('hidden')) customMembers.focus();
};
createCustom.onclick=()=>{
  const n=Number(customMembers.value);
  if(!Number.isInteger(n) || n<2 || n>100){alert('Masukkan jumlah anggota antara 2 dan 100.');return;}
  autoCreate(n);
};

async function waitForSocket(timeoutMs=8000){
  if(socket.connected) return true;
  try{ socket.connect(); }catch{}
  return await new Promise(resolve=>{
    let done=false;
    const finish=value=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      socket.off('connect',onConnect);
      socket.off('connect_error',onError);
      resolve(value);
    };
    const onConnect=()=>finish(true);
    const onError=()=>finish(false);
    const timer=setTimeout(()=>finish(false),timeoutMs);
    socket.once('connect',onConnect);
    socket.once('connect_error',onError);
  });
}

async function createRoom(capacity){
  if(!Number.isInteger(capacity) || capacity<2 || capacity>100) return;
  const ready=await waitForSocket();
  if(!ready){
    alert('Tidak dapat terhubung ke server. Pastikan server/Termux masih berjalan, lalu coba lagi.');
    return;
  }
  try{
    socket.timeout(8000).emit('room:create',{maxMembers:capacity},async (err,r)=>{
      if(err){
        alert('Server tidak merespons saat membuat room. Pastikan server/Termux masih aktif.');
        return;
      }
      if(!r || !r.ok){
        alert(r?.error || 'Gagal membuat room.');
        return;
      }
      try{
        roomId=r.roomId;
        roomCode=r.code;
        roomSalt=r.salt;
        keyMode='code';
        key=await deriveKeyFromCode(roomCode,roomSalt);
        b64key=await exportKey(key);
      maxMembers=r.maxMembers;
        inviteCode=roomCode;
        setCodeLink();
        showChat();
        updateRoomHeader(r.names,r.members,r.maxMembers);
        updateCodeButton();
      }catch(err){
        console.error('Room crypto setup failed:',err);
        alert('Room berhasil dibuat, tetapi enkripsi gagal disiapkan. Muat ulang halaman dan coba lagi.');
      }
    });
  }catch(err){
    alert('Gagal membuat room. Coba lagi.');
    console.error(err);
  }
}

async function joinByRoomCode(code, closeModal=true){
  const ready=await waitForSocket();
  if(!ready){alert('Tidak dapat terhubung ke server. Pastikan server/Termux masih berjalan.');return false;}
  const normalized = normalizeCode(code);
  if(normalized.length!==6){alert('Kode room harus 6 karakter.');return false;}
  joinByCode.disabled=true;
  try{
    const result = await new Promise(resolve=>{
      socket.timeout(8000).emit('room:lookup',{code:normalized},(err,r)=>resolve(err ? {ok:false,error:'Server tidak merespons.'} : r));
    });
    if(!result?.ok){alert(result?.error || 'Room tidak ditemukan atau sudah kedaluwarsa.');return false;}

    const derivedKey = await deriveKeyFromCode(result.code,result.salt);
    const joined = await new Promise(resolve=>{
      socket.timeout(8000).emit('room:join',{roomId:result.roomId},(err,r)=>resolve(err ? {ok:false,error:'Server tidak merespons saat masuk room.'} : r));
    });
    if(!joined?.ok){alert(joined?.error || 'Gagal masuk ke room.');return false;}

    roomId=result.roomId;
    roomCode=result.code;
    roomSalt=result.salt;
    keyMode='code';
    key=derivedKey;
    b64key=await exportKey(key);
    maxMembers=joined.maxMembers;
    inviteCode=roomCode;
    history.replaceState({},'',buildInviteLink());
    if(closeModal) closeSearchModal();
    showChat();
    updateRoomHeader(joined.names,joined.members,joined.maxMembers);
    updateCodeButton();
    return true;
  }catch(err){
    console.error('Join by code failed:',err);
    alert('Gagal masuk ke room.');
    return false;
  }finally{
    joinByCode.disabled=false;
  }
}

async function join(){
  // Link undangan baru berbasis kode room: ?code=XXXXXX
  if(inviteCode) {
    await joinByRoomCode(inviteCode,false);
    return;
  }
  // Kompatibilitas dengan link lama yang masih memakai ?room=...#key
  if(!roomId)return;
  const hash=location.hash.slice(1);
  if(!hash){alert('Link lama tidak memiliki encryption key. Gunakan Copy Link terbaru atau kode room.');return;}
  try{
    b64key=hash;
    key=await importKey(hash);
    keyMode='legacy';
    socket.timeout(8000).emit('room:join',{roomId},(err,r)=>{
      if(err){alert('Server tidak merespons saat masuk room.');return;}
      if(!r.ok){alert(r.error);return;}
      maxMembers=r.maxMembers;
      roomCode=r.code||'';
      roomSalt=r.salt||'';
      showChat();
      updateRoomHeader(r.names,r.members,r.maxMembers);
      updateCodeButton();
    });
  }catch(err){
    alert('Encryption key tidak valid.');
  }
}
async function joinRoomByCode(){
  await joinByRoomCode(roomCodeInput.value,true);
}
joinByCode.onclick=joinRoomByCode;
roomCodeInput.addEventListener('keydown',e=>{if(e.key==='Enter')joinRoomByCode();});

if(inviteCode || (roomId && location.hash)) join();

function closeRoomMenu(){
  roomMenu.classList.add('hidden');
  menuButton.setAttribute('aria-expanded','false');
}
menuButton.onclick=e=>{
  e.stopPropagation();
  const open=roomMenu.classList.toggle('hidden');
  menuButton.setAttribute('aria-expanded',String(!open));
};
document.addEventListener('click',e=>{
  if(!roomMenu.contains(e.target) && e.target!==menuButton) closeRoomMenu();
});

async function updateCodeButton(){
  if(!copyCode)return;
  copyCode.textContent = roomCode ? `Copy Code: ${roomCode}` : 'Copy Code';
}
copy.onclick=async()=>{
  try{
    await navigator.clipboard.writeText(buildInviteLink());
    copy.textContent='Copied';
    setTimeout(()=>copy.textContent='Copy Link',1200);
  }catch{alert('Tidak bisa menyalin link otomatis.');}
  closeRoomMenu();
};
copyCode.onclick=async()=>{
  if(!roomCode){alert('Kode room belum tersedia.');return;}
  try{
    await navigator.clipboard.writeText(roomCode);
    copyCode.textContent='Code Copied';
    setTimeout(()=>updateCodeButton(),1200);
  }catch{alert(`Kode room: ${roomCode}`);}
  closeRoomMenu();
};

function openBarcodeRoom(){
  if(!roomId || !roomCode){alert('Kode room belum tersedia.');return;}
  closeRoomMenu();
  roomQr.innerHTML='';
  const link=buildInviteLink();
  if(typeof QRCode==='undefined'){alert('Pembuat QR belum tersedia. Pastikan koneksi internet aktif lalu coba lagi.');return;}
  new QRCode(roomQr,{text:link,width:240,height:240,colorDark:'#111113',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  roomQrCode.textContent=roomCode;
  barcodeRoomModal.classList.remove('hidden');
}
function closeBarcodeRoomModal(){barcodeRoomModal.classList.add('hidden');}
barcodeRoom.onclick=openBarcodeRoom;
closeBarcodeRoom.onclick=closeBarcodeRoomModal;
barcodeRoomModal.querySelector('.modal-backdrop').onclick=closeBarcodeRoomModal;

async function shareRoomBarcode(){
  if(!roomCode)return;
  const link=buildInviteLink();
  try{
    if(navigator.share){
      await navigator.share({title:'Xarc Massage Room',text:`Private Room ${roomCode}`,url:link});
    }else{
      await navigator.clipboard.writeText(link);
      alert('Link room berhasil disalin.');
    }
  }catch(err){
    if(err?.name!=='AbortError') alert('Barcode siap dipindai.');
  }
}
shareBarcodeRoom.onclick=shareRoomBarcode;

function extractRoomCodeFromScan(raw){
  const value=String(raw||'').trim();
  if(!value)return '';
  try{
    const url=new URL(value);
    const code=normalizeCode(url.searchParams.get('code')||'');
    if(code.length===6)return code;
  }catch{}
  const code=normalizeCode(value);
  return /^[A-Z0-9_-]{6}$/.test(code) ? code : '';
}
async function handleBarcodeResult(raw){
  const code=extractRoomCodeFromScan(raw);
  if(!code){
    barcodeScannerStatus.textContent='QR bukan Barcode Room yang valid';
    return false;
  }
  barcodeScannerStatus.textContent=`Barcode ditemukan: ${code}`;
  stopBarcodeScanner();
  return await joinByRoomCode(code,true);
}

function stopBarcodeScanner(){
  barcodeScanning=false;
  if(barcodeScanTimer){cancelAnimationFrame(barcodeScanTimer);barcodeScanTimer=null;}
  if(barcodeScannerStream){barcodeScannerStream.getTracks().forEach(t=>t.stop());barcodeScannerStream=null;}
  barcodeScannerPreview.srcObject=null;
  barcodeScannerModal.classList.add('hidden');
}
function scanBarcodeFrame(){
  if(!barcodeScanning)return;
  if(barcodeScannerPreview.readyState>=2 && barcodeScannerPreview.videoWidth){
    const canvas=document.createElement('canvas');
    canvas.width=barcodeScannerPreview.videoWidth;
    canvas.height=barcodeScannerPreview.videoHeight;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(barcodeScannerPreview,0,0,canvas.width,canvas.height);
    const image=ctx.getImageData(0,0,canvas.width,canvas.height);
    if(typeof jsQR==='function'){
      const result=jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'});
      if(result?.data){handleBarcodeResult(result.data);return;}
    }
  }
  barcodeScanTimer=requestAnimationFrame(scanBarcodeFrame);
}
async function openBarcodeScanner(){
  if(!window.isSecureContext){alert('Scanner kamera membutuhkan HTTPS. Jika membuka dari HP lain, gunakan HTTPS.');return;}
  if(!navigator.mediaDevices?.getUserMedia){alert('Browser ini tidak mendukung scanner kamera.');return;}
  barcodeServer.disabled=true;
  try{
    stopBarcodeScanner();
    barcodeScannerModal.classList.remove('hidden');
    barcodeScannerStatus.textContent='Meminta akses kamera…';
    const attempts=[
      {video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false},
      {video:{facingMode:{ideal:'user'}},audio:false},
      {video:true,audio:false}
    ];
    let stream=null,lastErr=null;
    for(const constraints of attempts){
      try{stream=await navigator.mediaDevices.getUserMedia(constraints);break;}catch(err){lastErr=err;console.warn('Barcode scanner camera attempt failed',err);}
    }
    if(!stream)throw lastErr||new Error('Camera unavailable');
    barcodeScannerStream=stream;
    barcodeScannerPreview.srcObject=stream;
    await barcodeScannerPreview.play();
    barcodeScanning=true;
    barcodeScannerStatus.textContent='Arahkan Barcode Room ke dalam kotak';
    barcodeScanTimer=requestAnimationFrame(scanBarcodeFrame);
  }catch(err){
    console.error('Barcode scanner error:',err);
    stopBarcodeScanner();
    const name=err?.name||'';
    alert(name==='NotAllowedError'?'Akses kamera scanner ditolak. Izinkan Kamera untuk situs ini lalu coba lagi.':name==='NotFoundError'?'Kamera tidak ditemukan pada perangkat.':name==='NotReadableError'?'Kamera sedang dipakai aplikasi lain.':'Scanner kamera tidak dapat dibuka. Pastikan HTTPS dan izin kamera aktif.');
  }finally{barcodeServer.disabled=false;}
}
barcodeServer.onclick=openBarcodeScanner;
closeBarcodeScanner.onclick=stopBarcodeScanner;
barcodeScannerModal.querySelector('.barcode-scanner-backdrop').onclick=stopBarcodeScanner;
scanFromGallery.onclick=()=>barcodeGalleryInput.click();

async function decodeQrFromCanvas(canvas){
  if(typeof jsQR!=='function') return null;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return null;

  const tries=[];
  const maxSide=2400;
  const longest=Math.max(canvas.width,canvas.height);
  if(longest>maxSide){
    const scale=maxSide/longest;
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(canvas.width*scale));
    c.height=Math.max(1,Math.round(canvas.height*scale));
    c.getContext('2d',{willReadFrequently:true}).drawImage(canvas,0,0,c.width,c.height);
    tries.push(c);
  }else tries.push(canvas);

  // Also try enlarged versions. This helps when the QR occupies only a small
  // part of a screenshot/photo.
  const base=tries[0];
  for(const factor of [1.5,2]){
    const w=Math.min(3000,Math.round(base.width*factor));
    const h=Math.min(3000,Math.round(base.height*factor));
    if(w>base.width || h>base.height){
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      c.getContext('2d',{willReadFrequently:true}).drawImage(base,0,0,w,h);
      tries.push(c);
    }
  }

  for(const c of tries){
    const ctx2=c.getContext('2d',{willReadFrequently:true});
    const image=ctx2.getImageData(0,0,c.width,c.height);
    let result=jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'});
    if(result?.data)return result;

    // Try common center crops so a QR surrounded by lots of UI/background
    // pixels has a better chance of being decoded.
    const crops=[0.85,0.65,0.5];
    for(const ratio of crops){
      const cw=Math.max(1,Math.round(c.width*ratio));
      const ch=Math.max(1,Math.round(c.height*ratio));
      const sx=Math.round((c.width-cw)/2), sy=Math.round((c.height-ch)/2);
      const crop=document.createElement('canvas');
      crop.width=cw;crop.height=ch;
      crop.getContext('2d',{willReadFrequently:true}).drawImage(c,sx,sy,cw,ch,0,0,cw,ch);
      const ci=crop.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cw,ch);
      result=jsQR(ci.data,ci.width,ci.height,{inversionAttempts:'attemptBoth'});
      if(result?.data)return result;
    }
  }
  return null;
}

async function loadGalleryImage(file){
  if('createImageBitmap' in window){
    try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch{}
  }
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('image-load-failed'));};
    img.src=url;
  });
}

barcodeGalleryInput.onchange=async()=>{
  const f=barcodeGalleryInput.files?.[0];
  barcodeGalleryInput.value='';
  if(!f)return;
  try{
    if(typeof jsQR!=='function'){alert('Scanner gambar belum tersedia. Pastikan koneksi internet aktif.');return;}
    if(!f.type.startsWith('image/')){alert('Pilih file gambar yang berisi Barcode Room.');return;}
    const image=await loadGalleryImage(f);
    const w=image.width||image.naturalWidth;
    const h=image.height||image.naturalHeight;
    if(!w||!h)throw new Error('invalid-image-size');
    const canvas=document.createElement('canvas');
    const max=2400;
    const scale=Math.min(1,max/Math.max(w,h));
    canvas.width=Math.max(1,Math.round(w*scale));
    canvas.height=Math.max(1,Math.round(h*scale));
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0,canvas.width,canvas.height);
    image.close?.();

    const result=await decodeQrFromCanvas(canvas);
    if(!result?.data){
      alert('QR Code tidak ditemukan pada gambar. Pastikan Barcode Room terlihat jelas, tidak terpotong, lalu coba lagi.');
      return;
    }
    await handleBarcodeResult(result.data);
  }catch(err){
    console.error('Gallery QR scan failed',err);
    alert('Gambar QR tidak dapat dipindai. Coba pilih foto/screenshot Barcode Room yang lebih jelas.');
  }
};

changeRoom.onclick=()=>{
  closeRoomMenu();
  if(!roomId) return;
  if(!confirm('Ganti Private Room? Kamu akan keluar dari room ini dan kembali ke halaman utama.')) return;
  socket.timeout(5000).emit('room:leave',{roomId},(err,r)=>{
    if(err || !r?.ok){alert(r?.error || 'Gagal keluar dari room.');return;}
    cleanupLocalRoom();
  });
};

changeCapacity.onclick=()=>{
  closeRoomMenu();
  if(!roomId) return;
  openCapacityModal(true);
};

async function updateRoomCapacity(capacity){
  if(!roomId) return;
  if(!Number.isInteger(capacity) || capacity < 2 || capacity > 100) return;
  if(capacity < currentMembers){
    alert(`Tidak bisa mengurangi kapasitas di bawah jumlah anggota saat ini (${currentMembers}).`);
    return;
  }
  changeCapacity.disabled=true;
  createCustom.disabled=true;
  try{
    socket.timeout(5000).emit('room:update-capacity',{roomId,maxMembers:capacity},(err,r)=>{
      changeCapacity.disabled=false;
      createCustom.disabled=false;
      if(err || !r?.ok){alert(r?.error || 'Gagal mengganti kapasitas room.');return;}
      maxMembers=r.maxMembers;
      updateRoomHeader([],r.members,r.maxMembers);
      closeCapacityModal();
    });
  }catch(err){
    changeCapacity.disabled=false;
    createCustom.disabled=false;
    alert('Gagal mengganti kapasitas room.');
  }
}

deleteRoom.onclick=()=>{
  closeRoomMenu();
  if(!roomId)return;
  if(!confirm('Hapus room untuk semua orang dan keluar?'))return;
  deleteRoom.disabled=true;
  socket.timeout(5000).emit('room:delete',{roomId},(err,r)=>{
    deleteRoom.disabled=false;
    if(err || !r?.ok){alert(r?.error || 'Gagal menghapus room.');return;}
    cleanupLocalRoom();
  });
};
function cleanupLocalRoom(){
  stopBarcodeScanner();
  closeBarcodeRoomModal();
  roomId=null; inviteCode=''; roomCode=''; roomSalt=''; key=null; b64key=''; currentMembers=0;
  history.replaceState({},'',location.pathname);
  messages.innerHTML='';
  closeRoomMenu();
  chat.classList.add('hidden');
  home.classList.remove('hidden');
}

socket.on('connect',()=>{
  if(!chat.classList.contains('hidden')) status.textContent=`connected ${currentMembers}/${maxMembers}`;
});
socket.on('disconnect',()=>{
  if(!chat.classList.contains('hidden')) status.textContent='Reconnecting…';
});
socket.on('connect_error',err=>{
  console.error('Socket connection error:',err);
  if(!roomId && !chat.classList.contains('hidden')) status.textContent='Server tidak terhubung';
});
socket.on('room:state',({members,maxMembers:limit,names})=>updateRoomHeader(names,members,limit));
socket.on('room:deleted',()=>{ alert('Room telah dihapus.'); cleanupLocalRoom(); });
socket.on('typing',({active})=>{
  typing.classList.toggle('show',!!active);
  if(active) scrollBottom();
});
socket.on('message:encrypted',async p=>{
  try{
    const msg=await decrypt(p);
    if(msg?.type==='file-chunk'){
      await receiveFileChunk(msg);
      return;
    }
    render(msg,false);
  }catch(err){
    console.error('Gagal mendekripsi pesan:',err);
  }
});

function bytesFromB64(s){ return unb64(s); }
function blobUrlFromB64(mime,data){
  try{
    const bytes=bytesFromB64(data);
    return URL.createObjectURL(new Blob([bytes],{type:mime||'application/octet-stream'}));
  }catch(err){
    console.error('Gagal membuat Blob URL:',err);
    return '';
  }
}

function makeMessageId(){
  try{return crypto.randomUUID();}catch{return 'm_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);}
}
function messagePreview(m){
  if(!m)return '';
  if(m.type==='text') return String(m.text||'Pesan').replace(/\s+/g,' ').slice(0,140);
  if(m.type==='location') return '📍 Lokasi';
  if(m.type==='file') return `📎 ${m.name||'File'}`;
  return 'Pesan';
}
function setReplyTarget(m, mine=false){
  if(!m)return;
  if(!m.id)m.id=makeMessageId();
  replyingTo={id:m.id,type:m.type,text:messagePreview(m),mine:!!mine};
  replyPreviewTitle.textContent=mine?'Membalas pesanmu':'Membalas pesan';
  replyPreviewText.textContent=messagePreview(m);
  replyPreview.classList.remove('hidden');
  text.focus();
}
function clearReply(){
  replyingTo=null;
  replyPreview.classList.add('hidden');
  replyPreviewText.textContent='';
}
cancelReply.onclick=clearReply;
function scrollToMessage(id){
  if(!id)return;
  const row=messages.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
  if(row){row.scrollIntoView({behavior:'smooth',block:'center'});const bubble=row.querySelector('.msg');bubble?.classList.add('reply-highlight');setTimeout(()=>bubble?.classList.remove('reply-highlight'),950);}
}
function addReplyBlock(el,m){
  if(!m.reply)return;
  const r=document.createElement('div');
  r.className='message-reply';
  r.title='Buka pesan yang dibalas';
  const accent=document.createElement('div');accent.className='message-reply-accent';
  const content=document.createElement('div');content.className='message-reply-content';
  const who=document.createElement('strong');who.textContent=m.reply.mine?'Pesanmu':'Pesan';
  const preview=document.createElement('span');preview.textContent=m.reply.text||'Pesan';
  content.append(who,preview);r.append(accent,content);
  r.onclick=()=>scrollToMessage(m.reply.id);
  el.appendChild(r);
}
function enableSwipeReply(row,el,m,mine){
  const hint=document.createElement('span');hint.className='reply-swipe-hint';hint.innerHTML='<i class="bi bi-reply-fill"></i>';
  el.appendChild(hint);
  let startX=0,startY=0,dx=0,tracking=false;
  const reset=()=>{el.style.transform='';el.classList.remove('swiping');tracking=false;dx=0;};
  row.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    const t=e.touches[0];startX=t.clientX;startY=t.clientY;tracking=true;dx=0;
  },{passive:true});
  row.addEventListener('touchmove',e=>{
    if(!tracking)return;
    const t=e.touches[0];const x=t.clientX,y=t.clientY;
    const diffX=x-startX,diffY=y-startY;
    if(Math.abs(diffY)>Math.abs(diffX)+8){reset();return;}
    if(diffX>0){dx=Math.min(diffX,92);el.style.transform=`translateX(${dx}px)`;el.classList.toggle('swiping',dx>10);}
  },{passive:true});
  row.addEventListener('touchend',()=>{
    if(!tracking)return;
    if(dx>=68)setReplyTarget(m,mine);
    reset();
  });
  row.addEventListener('touchcancel',reset);
}

function render(m,mine){
  if(!m.id)m.id=makeMessageId();
  const row=document.createElement('div');
  row.dataset.messageId=m.id;
  row.className='msg-row'+(mine?' mine':'');
  const el=document.createElement('div');
  el.className='msg';

  addReplyBlock(el,m);
  if(m.type==='text'){
    const body=document.createElement('span');
    body.className='msg-text';
    body.textContent=m.text;
    const meta=document.createElement('span');
    meta.className='msg-meta';
    meta.textContent=formatTime(m.ts);
    el.append(body,meta);
  }else if(m.type==='location'){
    const locationCard=document.createElement('a');
    locationCard.className='location-card';
    locationCard.href=`https://www.google.com/maps?q=${encodeURIComponent(m.lat+','+m.lon)}`;
    locationCard.target='_blank';
    locationCard.rel='noopener noreferrer';
    locationCard.innerHTML=`<span class="location-card-icon"><i class="bi bi-geo-alt-fill"></i></span><span class="location-card-info"><strong>Lokasi</strong><small>${m.lat}, ${m.lon}</small></span><i class="bi bi-box-arrow-up-right"></i>`;
    el.appendChild(locationCard);
    const meta=document.createElement('div');
    meta.className='msg-meta';
    meta.textContent=formatTime(m.ts);
    el.appendChild(meta);
  }else{
    const wrap=document.createElement('div');
    wrap.className='file-card';
    const icon=document.createElement('div');
    icon.className='file-icon';
    const iconLabel=document.createElement('span');
    iconLabel.textContent=fileKind(m.mime,m.name);
    icon.appendChild(iconLabel);
    const info=document.createElement('div');
    info.className='file-info';
    const name=document.createElement('div');
    name.className='file-name';
    name.textContent=m.name || 'file';
    const sub=document.createElement('div');
    sub.className='file-sub';
    sub.textContent=`${formatBytes(m.size||0)} • ${fileKind(m.mime,m.name)}`;
    info.append(name,sub);
    const a=document.createElement('a');
    a.className='file-download';
    a.title='Download';
    a.innerHTML='<i class="bi bi-download" aria-hidden="true"></i>';
    a.download=m.name||'download';
    const objectUrl=m.objectUrl || (m.data ? blobUrlFromB64(m.mime,m.data) : '');
    a.href=objectUrl || `data:${m.mime};base64,${m.data}`;
    wrap.append(icon,info,a);
    el.appendChild(wrap);
    if(m.mime.startsWith('image/')){
      const preview=document.createElement('img');
      preview.className='file-preview';
      preview.src=objectUrl || `data:${m.mime};base64,${m.data}`;
      preview.alt=m.name||'image';
      preview.loading='lazy';
      el.insertBefore(preview,wrap);
    }else if(m.mime.startsWith('video/')){
      const video=document.createElement('video');
      video.className='file-video';
      video.controls=true;
      video.playsInline=true;
      video.preload='metadata';
      video.src=objectUrl || `data:${m.mime};base64,${m.data}`;
      el.insertBefore(video,wrap);
    }
    const meta=document.createElement('div');
    meta.className='msg-meta';
    meta.textContent=formatTime(m.ts);
    el.appendChild(meta);
  }
  row.appendChild(el);
  messages.appendChild(row);
  enableSwipeReply(row,el,m,mine);
  scrollBottom();
}

async function sendText(){
  const v=text.value.trim();
  if(!v || !roomId || !key)return;
  const ts=Date.now();
  const msg={id:makeMessageId(),type:'text',text:v,ts,reply:replyingTo?{...replyingTo}:null};
  const p=await encrypt(msg);
  render(msg,true);
  socket.emit('message:encrypted',{roomId,payload:p}, ack=>{
    if(ack && !ack.ok) console.error('Message rejected:', ack.error);
  });
  text.value='';
  clearReply();
  socket.emit('typing',{roomId,active:false});
}

send.onclick=sendText;
text.addEventListener('keydown',e=>{
  // Enter now creates a new line instead of immediately sending.
  // Send with the button; Ctrl/Cmd+Enter is also supported as a shortcut.
  if(e.key==='Enter' && (e.ctrlKey || e.metaKey)){
    e.preventDefault();
    sendText();
  }
});
text.addEventListener('input',()=>{
  text.style.height='auto';
  text.style.height=Math.min(text.scrollHeight,120)+'px';
});
text.addEventListener('input',()=>{
  if(!roomId)return;
  socket.emit('typing',{roomId,active:!!text.value});
  clearTimeout(typingTimer);
  typingTimer=setTimeout(()=>socket.emit('typing',{roomId,active:false}),900);
});

function openAttachmentSheet(){
  attachmentSheet.classList.remove('hidden');
  document.body.classList.add('sheet-open');
}
function closeAttachmentSheet(){
  attachmentSheet.classList.add('hidden');
  document.body.classList.remove('sheet-open');
}
attach.onclick=openAttachmentSheet;
closeAttachment.onclick=closeAttachmentSheet;
attachmentSheet.querySelector('.attachment-backdrop').onclick=closeAttachmentSheet;

function pickFile(input){
  closeAttachmentSheet();
  input.click();
}
let locationMap = null;
let locationMarker = null;
let selectedLocation = null;

function closeLocationPicker(){
  locationModal.classList.add('hidden');
  selectedLocation = null;
  sendLocation.disabled = true;
  if(locationMap){ locationMap.remove(); locationMap = null; locationMarker = null; }
}

function openLocationPicker(){
  closeAttachmentSheet();
  if(!window.L){
    alert('Peta belum siap. Pastikan koneksi internet aktif lalu coba lagi.');
    return;
  }
  locationModal.classList.remove('hidden');
  locationCoords.textContent='Ketuk peta untuk memilih lokasi.';
  sendLocation.disabled=true;
  requestAnimationFrame(()=>{
    locationMap = L.map(locationMapEl,{zoomControl:true}).setView([-2.5489,118.0149],5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'© OpenStreetMap contributors'
    }).addTo(locationMap);
    locationMap.on('click',e=>selectLocation(e.latlng.lat,e.latlng.lng));
    setTimeout(()=>locationMap.invalidateSize(),100);

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        if(!locationMap) return;
        const lat=pos.coords.latitude, lon=pos.coords.longitude;
        locationMap.setView([lat,lon],16);
        selectLocation(lat,lon);
      },()=>{}, {enableHighAccuracy:true,timeout:8000,maximumAge:60000});
    }
  });
}

function selectLocation(lat,lon){
  if(!locationMap)return;
  selectedLocation={lat:Number(lat.toFixed(6)),lon:Number(lon.toFixed(6))};
  if(locationMarker) locationMarker.setLatLng([lat,lon]);
  else locationMarker=L.marker([lat,lon]).addTo(locationMap);
  locationCoords.textContent=`Lokasi dipilih: ${selectedLocation.lat}, ${selectedLocation.lon}`;
  sendLocation.disabled=false;
}

closeLocation.onclick=closeLocationPicker;
locationModal.querySelector('.location-backdrop').onclick=closeLocationPicker;
document.querySelector('#pickLocation').onclick=openLocationPicker;

sendLocation.onclick=async()=>{
  if(!selectedLocation||!roomId||!key)return;
  const {lat,lon}=selectedLocation;
  const ts=Date.now();
  const msg={id:makeMessageId(),type:'location',lat,lon,ts,reply:replyingTo?{...replyingTo}:null};
  try{
    const p=await encrypt(msg);
    render(msg,true);
    socket.emit('message:encrypted',{roomId,payload:p},ack=>{
      if(ack && !ack.ok) alert(ack.error||'Lokasi ditolak server.');
    });
    clearReply();
    closeLocationPicker();
  }catch(err){
    console.error(err);
    alert('Gagal mengirim lokasi.');
  }
};

document.querySelector('#pickGallery').onclick=()=>pickFile(galleryInput);
document.querySelector('#pickCamera').onclick=()=>openCamera();
document.querySelector('#pickDocument').onclick=()=>pickFile(documentInput);

let cameraStream=null;
let cameraMode='photo';
let cameraRecorder=null;
let cameraChunks=[];

function setCameraMode(mode){
  cameraMode=mode;
  cameraModePhoto.classList.toggle('active',mode==='photo');
  cameraModeVideo.classList.toggle('active',mode==='video');
  cameraStatus.textContent=mode==='photo'?'Siap mengambil foto':'Siap merekam video';
  cameraCapture.classList.remove('recording');
  cameraCapture.innerHTML='<i class="bi bi-camera"></i>';
}

async function openCamera(){
  closeAttachmentSheet();
  if(!window.isSecureContext){
    alert('Kamera membutuhkan koneksi aman (HTTPS). Jika membuka dari HP lain, gunakan HTTPS; HTTP hanya aman di localhost/127.0.0.1.');
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    alert('Browser ini tidak menyediakan akses kamera. Gunakan Chrome/Firefox terbaru melalui HTTPS.');
    return;
  }
  try{
    let stream=null;
    const attempts=[
      {video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false},
      {video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720}},audio:false},
      {video:true,audio:false}
    ];
    let lastErr=null;
    for(const constraints of attempts){
      try{
        stream=await navigator.mediaDevices.getUserMedia(constraints);
        break;
      }catch(err){
        lastErr=err;
        console.warn('Camera attempt failed:',constraints,err);
      }
    }
    if(!stream) throw lastErr || new Error('Camera unavailable');

    cameraStream=stream;
    cameraPreview.srcObject=cameraStream;
    cameraModal.classList.remove('hidden');
    document.body.classList.add('camera-open');
    setCameraMode('photo');
    await cameraPreview.play();
  }catch(err){
    console.error('Camera permission/error:',err);
    const name=err?.name || 'UnknownError';
    const message = name==='NotAllowedError'
      ? 'Browser masih menolak kamera. Pastikan izin Kamera untuk situs ini = Izinkan, lalu tutup dan buka ulang tab.'
      : name==='NotFoundError'
        ? 'Kamera tidak ditemukan pada perangkat.'
        : name==='NotReadableError'
          ? 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera/video lain lalu coba lagi.'
          : name==='SecurityError'
            ? 'Akses kamera diblokir oleh keamanan browser. Gunakan HTTPS dan jangan buka situs di iframe.'
            : 'Kamera tidak dapat dibuka. Pastikan HTTPS aktif dan izin Kamera sudah diizinkan.';
    alert(message);
    stopCamera();
  }
}

async function ensureCameraAudio(){
  if(cameraStream?.getAudioTracks?.().length) return true;
  try{
    const audioOnly=await navigator.mediaDevices.getUserMedia({audio:true});
    audioOnly.getAudioTracks().forEach(track=>cameraStream.addTrack(track));
    return true;
  }catch(err){
    console.warn('Microphone unavailable; recording video without audio:',err);
    return false;
  }
}

function stopCamera(){
  if(cameraRecorder && cameraRecorder.state!=='inactive'){
    try{cameraRecorder.stop();}catch{}
  }
  cameraRecorder=null;
  cameraChunks=[];
  if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}
  cameraPreview.srcObject=null;
  cameraModal.classList.add('hidden');
  document.body.classList.remove('camera-open');
}
closeCamera.onclick=stopCamera;
cameraModal.querySelector('.camera-backdrop').onclick=stopCamera;
cameraModePhoto.onclick=()=>{if(!cameraRecorder)setCameraMode('photo');};
cameraModeVideo.onclick=()=>{if(!cameraRecorder)setCameraMode('video');};

async function captureCameraPhoto(){
  if(!cameraPreview.videoWidth || !cameraPreview.videoHeight){
    alert('Kamera belum siap. Coba lagi.'); return;
  }
  cameraCanvas.width=cameraPreview.videoWidth;
  cameraCanvas.height=cameraPreview.videoHeight;
  const ctx=cameraCanvas.getContext('2d',{alpha:false});
  if(!ctx)return;
  ctx.drawImage(cameraPreview,0,0,cameraCanvas.width,cameraCanvas.height);
  const blob=await new Promise(resolve=>cameraCanvas.toBlob(resolve,'image/jpeg',0.92));
  if(!blob){alert('Gagal mengambil foto.');return;}
  const f=new File([blob],`Foto-${Date.now()}.jpg`,{type:'image/jpeg'});
  stopCamera();
  await handleSelectedFileObject(f);
}

async function startCameraVideo(){
  if(!cameraStream)return;
  await ensureCameraAudio();
  const preferred=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];
  const mime=preferred.find(t=>window.MediaRecorder?.isTypeSupported?.(t))||'';
  try{
    cameraChunks=[];
    cameraRecorder=new MediaRecorder(cameraStream,mime?{mimeType:mime}:undefined);
    cameraRecorder.ondataavailable=e=>{if(e.data?.size)cameraChunks.push(e.data);};
    cameraRecorder.onerror=e=>{console.error(e);cameraStatus.textContent='Gagal merekam';cameraRecorder=null;};
    cameraRecorder.onstop=async()=>{
      const type=cameraRecorder?.mimeType || mime || 'video/webm';
      const blob=new Blob(cameraChunks,{type});
      const ext=type.includes('mp4')?'mp4':'webm';
      const f=new File([blob],`Video-${Date.now()}.${ext}`,{type});
      cameraRecorder=null;
      cameraChunks=[];
      stopCamera();
      await handleSelectedFileObject(f);
    };
    cameraRecorder.start(250);
    cameraStatus.textContent='Merekam... tekan tombol untuk berhenti';
    cameraCapture.classList.add('recording');
    cameraCapture.innerHTML='<i class="bi bi-stop-fill"></i>';
  }catch(err){
    console.error(err);
    cameraRecorder=null;
    alert('Browser tidak mendukung perekaman video.');
  }
}

cameraCapture.onclick=async()=>{
  if(cameraMode==='photo') return captureCameraPhoto();
  if(cameraRecorder && cameraRecorder.state==='recording') return cameraRecorder.stop();
  await startCameraVideo();
};

function emitEncrypted(payload){
  return new Promise(resolve=>{
    socket.timeout(30000).emit('message:encrypted',{roomId,payload},(err,ack)=>{
      if(err) return resolve({ok:false,error:'Server tidak merespons.'});
      resolve(ack || {ok:false,error:'Server tidak memberikan konfirmasi.'});
    });
  });
}

async function sendFileInChunks(f){
  const transferId=crypto.randomUUID();
  const total=Math.ceil(f.size/FILE_CHUNK_SIZE);
  const ts=Date.now();
  const messageId=makeMessageId();
  const reply=replyingTo?{...replyingTo}:null;
  const mime=f.type||'application/octet-stream';
  for(let index=0;index<total;index++){
    const start=index*FILE_CHUNK_SIZE;
    const end=Math.min(f.size,start+FILE_CHUNK_SIZE);
    const chunk=new Uint8Array(await f.slice(start,end).arrayBuffer());
    const msg={
      type:'file-chunk',transferId,index,total,
      id:messageId, name:f.name,mime,size:f.size,ts,reply,
      data:b64(chunk)
    };
    const payload=await encrypt(msg);
    const result=await emitEncrypted(payload);
    if(!result.ok) throw new Error(result.error||`Gagal mengirim bagian ${index+1}/${total}`);
  }
  // Render from the original file after all chunks were accepted by the server.
  const originalBytes=new Uint8Array(await f.arrayBuffer());
  const msg={id:messageId,type:'file',name:f.name,mime,size:f.size,objectUrl:URL.createObjectURL(f),ts,reply};
  render(msg,true);
  clearReply();
}

async function receiveFileChunk(m){
  if(!m.transferId || !Number.isInteger(m.index) || !Number.isInteger(m.total) || !m.data) return;
  if(m.total<1 || m.total>1000 || m.index<0 || m.index>=m.total) return;
  let transfer=incomingFiles.get(m.transferId);
  if(!transfer){
    transfer={id:m.id||makeMessageId(),name:m.name,mime:m.mime,size:m.size,ts:m.ts,reply:m.reply||null,total:m.total,chunks:new Array(m.total),received:0,createdAt:Date.now()};
    incomingFiles.set(m.transferId,transfer);
  }
  if(!transfer.chunks[m.index]){
    transfer.chunks[m.index]=unb64(m.data);
    transfer.received++;
  }
  if(transfer.received!==transfer.total) return;
  try{
    const parts=transfer.chunks;
    let totalBytes=0;
    for(const part of parts) totalBytes+=part.byteLength;
    if(totalBytes!==transfer.size) throw new Error('Ukuran file tidak cocok.');
    const merged=new Uint8Array(totalBytes);
    let offset=0;
    for(const part of parts){merged.set(part,offset);offset+=part.byteLength;}
    const msg={id:transfer.id,type:'file',name:transfer.name,mime:transfer.mime,size:transfer.size,objectUrl:URL.createObjectURL(new Blob([merged],{type:transfer.mime||'application/octet-stream'})),ts:transfer.ts,reply:transfer.reply};
    render(msg,false);
  }catch(err){
    console.error('Gagal menyusun file:',err);
    alert(`File ${transfer.name||''} gagal disusun.`);
  }finally{
    incomingFiles.delete(m.transferId);
  }
}

setInterval(()=>{
  const cutoff=Date.now()-5*60*1000;
  for(const [id,t] of incomingFiles) if(t.createdAt<cutoff) incomingFiles.delete(id);
},60*1000);

async function handleSelectedFileObject(f){
  if(!f)return;
  if(f.size>MAX_FILE){alert(`File terlalu besar. Maksimum ${formatBytes(MAX_FILE)}.`);return;}
  if(!roomId||!key){alert('Kamu belum berada di room.');return;}
  try{
    await sendFileInChunks(f);
  }catch(err){
    alert(err.message||'Gagal mengirim file.');
    console.error(err);
  }
}
async function handleSelectedFile(input){
  const f=input.files[0];
  try{ await handleSelectedFileObject(f); }
  finally{ input.value=''; }
}
file.onchange=()=>handleSelectedFile(file);
galleryInput.onchange=()=>handleSelectedFile(galleryInput);
cameraInput.onchange=()=>handleSelectedFile(cameraInput);
documentInput.onchange=()=>handleSelectedFile(documentInput);
