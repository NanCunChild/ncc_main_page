/* =============================================================
   PHOSPHOR TERMINAL V2 — NanCunChild
   Fake filesystem, fake processes, fake network, root escalation
   ============================================================= */
const startTime = Date.now();
const S = {
  isOn: false, booting: false, isRoot: false,
  cwd: '/home/guest', user: 'guest',
  history: [], histIdx: 0,
  awaitingInput: null, // {type:'password'|'exploit', cb:Function}
};

/* ── FAKE FILESYSTEM ── */
const FS = {
  '/': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['home','etc','var','tmp','usr','bin','root','proc','dev'] },
  '/home': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['guest'] },
  '/home/guest': { type:'d', perm:'drwxr-xr-x', owner:'guest', children:['.bashrc','.ssh','notes.txt','projects','about.md'] },
  '/home/guest/.bashrc': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'# ~/.bashrc\nexport PS1="\\u@\\h:\\w\\$ "\nalias ll="ls -la"\n# TODO: add more aliases' },
  '/home/guest/.ssh': { type:'d', perm:'drwx------', owner:'guest', children:['id_rsa.pub','known_hosts'] },
  '/home/guest/.ssh/id_rsa.pub': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...(truncated)\nFingerprint: SHA256:xD1AN_3L3cTr0N1C_K3Y_F1NG3RPR1NT\n\n# Hint: the root password is the first 8 chars of this fingerprint\n# (lowercase, no special chars)' },
  '/home/guest/.ssh/known_hosts': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'localhost ssh-rsa AAAAB3...\nphosphor.xidian.edu.cn ssh-ed25519 AAAAC3...' },
  '/home/guest/notes.txt': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'== NCC Dev Notes ==\n- Finish FPGA Tofino pipeline\n- Update vLLM deployment scripts\n- Check auth.log for weird entries (saw something odd)\n- Remember: /etc/motd has the system password hint' },
  '/home/guest/about.md': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'# NanCunChild\nMicroelectronics @ Xidian University\nAI · Security · Systems · FPGA\n\nLanguages: C#, Python, Rust, C++, Go, Flutter, JS, Java/Kotlin, COBOL(lol)\nCurrently: server ops for 2 companies + university' },
  '/home/guest/projects': { type:'d', perm:'drwxr-xr-x', owner:'guest', children:['qualcomm-trust-chain','xiaomi-vuln','fpga-tofino','game-reverse','infra-ops','llm-deploy'] },
  '/home/guest/projects/qualcomm-trust-chain': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'[RESEARCH] Qualcomm secure boot trust chain analysis\nStatus: ongoing\nPBL -> SBL -> UEFI chain of trust inspection' },
  '/home/guest/projects/xiaomi-vuln': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'[RESEARCH] Xiaomi device vulnerability analysis\nFuzzing, IPC inspection, system surface mapping\nResponsible disclosure where applicable' },
  '/home/guest/projects/fpga-tofino': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'[HARDWARE] Tofino-style programmable switch on FPGA\nP4-inspired match-action pipeline\nCustom parser, line-rate forwarding' },
  '/home/guest/projects/game-reverse': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'[LIVE] Game reverse engineering toolkit\nMemory inspection, signature scanning, runtime hooks\nBuilt for understanding, not griefing' },
  '/home/guest/projects/infra-ops': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'[LIVE] Production server ops\n2 companies + 1 university\nLinux, Docker, K8s, monitoring' },
  '/home/guest/projects/llm-deploy': { type:'f', perm:'-rw-r--r--', owner:'guest', content:'[LIVE] Self-hosted LLM deployment\nFine-tuning, quantization, vLLM serving, RAG pipelines\nChasing throughput on consumer hardware' },
  '/etc': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['passwd','shadow','motd','hostname','hosts','resolv.conf','ssh'] },
  '/etc/passwd': { type:'f', perm:'-rw-r--r--', owner:'root', content:'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\nguest:x:1000:1000:Guest User:/home/guest:/bin/bash\nncc:x:1001:1001:NanCunChild:/home/ncc:/bin/zsh' },
  '/etc/shadow': { type:'f', perm:'-rw-------', owner:'root', content:'[permission denied — root only]' },
  '/etc/motd': { type:'f', perm:'-rw-r--r--', owner:'root', content:'╔══════════════════════════════════════════╗\n║  Welcome to Phosphor Linux 2.6          ║\n║  Maintained by NanCunChild              ║\n║                                         ║\n║  "The password is always in plain sight"║\n║   root pw: xd1an3l3                     ║\n║                                         ║\n╚══════════════════════════════════════════╝' },
  '/etc/hostname': { type:'f', perm:'-rw-r--r--', owner:'root', content:'phosphor' },
  '/etc/hosts': { type:'f', perm:'-rw-r--r--', owner:'root', content:'127.0.0.1\tlocalhost\n127.0.1.1\tphosphor\n10.0.0.1\tgateway.xidian.edu.cn\n10.0.0.42\tncc-server.internal' },
  '/etc/resolv.conf': { type:'f', perm:'-rw-r--r--', owner:'root', content:'nameserver 8.8.8.8\nnameserver 1.1.1.1\nsearch xidian.edu.cn' },
  '/etc/ssh': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['sshd_config'] },
  '/etc/ssh/sshd_config': { type:'f', perm:'-rw-r--r--', owner:'root', content:'Port 22\nPermitRootLogin yes\nPasswordAuthentication yes\n# NOTE: root login enabled for maintenance\n# Password hint: check /etc/motd' },
  '/var': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['log','tmp'] },
  '/var/log': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['auth.log','syslog','kern.log'] },
  '/var/log/auth.log': { type:'f', perm:'-rw-r-----', owner:'root', content:'May 24 03:14:07 phosphor sshd[1337]: Failed password for root from 192.168.1.100\nMay 24 03:14:09 phosphor sshd[1337]: Failed password for root from 192.168.1.100\nMay 24 03:15:22 phosphor sudo: guest : TTY=pts/0 ; COMMAND=/bin/su\nMay 24 03:22:41 phosphor kernel: [VULN] CVE-2024-PHSPR: local privilege escalation via /proc/phosphor\nMay 24 03:22:41 phosphor kernel: [VULN] trigger: write "escalate" to /proc/phosphor\nMay 24 03:22:42 phosphor kernel: [WARN] unpatched — exploit available\nMay 24 04:00:00 phosphor CRON[2048]: (root) CMD (/usr/bin/backup.sh)' },
  '/var/log/syslog': { type:'f', perm:'-rw-r-----', owner:'root', content:'May 24 00:00:01 phosphor systemd[1]: Started Daily apt activities.\nMay 24 01:00:00 phosphor systemd[1]: Starting Cleanup of Temporary Directories...\nMay 24 03:00:00 phosphor ntpd[456]: time sync complete' },
  '/var/log/kern.log': { type:'f', perm:'-rw-r-----', owner:'root', content:'[    0.000000] Linux version 2.6.32-phosphor\n[    0.001234] CPU: PhosphorCore @ 33 MHz\n[    3.221000] EXT4-fs (sda1): mounted filesystem\n[   12.440000] phosphor_module: loaded (WARNING: debug interface at /proc/phosphor)' },
  '/var/tmp': { type:'d', perm:'drwxrwxrwt', owner:'root', children:[] },
  '/tmp': { type:'d', perm:'drwxrwxrwt', owner:'root', children:['.X11-unix'] },
  '/tmp/.X11-unix': { type:'d', perm:'drwxrwxrwt', owner:'root', children:[] },
  '/usr': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['bin','share'] },
  '/usr/bin': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['python3','gcc','vim','git','curl','wget'] },
  '/usr/share': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['doc'] },
  '/usr/share/doc': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['README'] },
  '/usr/share/doc/README': { type:'f', perm:'-rw-r--r--', owner:'root', content:'Phosphor Linux — a fake OS for a real portfolio.\nBuilt by NanCunChild with love and sleep deprivation.' },
  '/bin': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['bash','ls','cat','cd','pwd','echo','grep','chmod','su'] },
  '/root': { type:'d', perm:'drwx------', owner:'root', children:['.flag','xinwei.sh','secrets.txt'] },
  '/root/.flag': { type:'f', perm:'-rw-------', owner:'root', content:'FLAG{y0u_g0t_r00t_0n_ph0sph0r_gg_wp}\n\nCongratulations! You found the flag.\nNow try: secret, flag, or ./xinwei.sh' },
  '/root/xinwei.sh': { type:'f', perm:'-rwx------', owner:'root', content:'#!/bin/bash\n# 西电人专属彩蛋\necho ""\necho "  ██╗  ██╗██╗██████╗ ██╗ █████╗ ███╗   ██╗"\necho "  ╚██╗██╔╝██║██╔══██╗██║██╔══██╗████╗  ██║"\necho "   ╚███╔╝ ██║██║  ██║██║███████║██╔██╗ ██║"\necho "   ██╔██╗ ██║██║  ██║██║██╔══██║██║╚██╗██║"\necho "  ██╔╝ ██╗██║██████╔╝██║██║  ██║██║ ╚████║"\necho "  ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝"\necho ""\necho "  厚德 求真 砺学 笃行"\necho "  西安电子科技大学 · Since 1931"\necho "  — NanCunChild was here —"\necho ""' },
  '/root/secrets.txt': { type:'f', perm:'-rw-------', owner:'root', content:'== Root Secrets ==\nGPG: 02959285A9303F1897DA95D89C2A58BAC2CFD595\nYubiKey: keys.nancunchild.me/yubico_ncc_v3.asc\nInfra: 2 companies + Xidian University\nFavorite bug: the one in Xiaomi that took 3 weeks\nCoffee preference: pour-over, dark roast' },
  '/proc': { type:'d', perm:'dr-xr-xr-x', owner:'root', children:['cpuinfo','meminfo','version','uptime','phosphor'] },
  '/proc/cpuinfo': { type:'f', perm:'-r--r--r--', owner:'root', content:'processor\t: 0\nvendor_id\t: PhosphorCore\nmodel name\t: PhosphorCore @ 33 MHz\ncache size\t: 8 KB\nbogomips\t: 66.00' },
  '/proc/meminfo': { type:'f', perm:'-r--r--r--', owner:'root', content:'MemTotal:       16384 kB\nMemFree:         4096 kB\nMemAvailable:    8192 kB\nBuffers:         1024 kB\nCached:          3072 kB' },
  '/proc/version': { type:'f', perm:'-r--r--r--', owner:'root', content:'Linux version 2.6.32-phosphor (ncc@buildhost) (gcc version 4.4.3) #1 SMP' },
  '/proc/uptime': { type:'f', perm:'-r--r--r--', owner:'root', get content(){ const s=Math.floor((Date.now()-startTime)/1000); return s+'.00 '+Math.floor(s*0.8)+'.00'; } },
  '/proc/phosphor': { type:'f', perm:'-rw-rw-rw-', owner:'root', content:'[phosphor debug interface]\nStatus: ACTIVE\nWrite "escalate" to trigger privilege escalation\n\n// This is CVE-2024-PHSPR — an intentional backdoor for the CTF easter egg' },
  '/dev': { type:'d', perm:'drwxr-xr-x', owner:'root', children:['null','zero','random','tty0'] },
  '/dev/null': { type:'f', perm:'crw-rw-rw-', owner:'root', content:'' },
  '/dev/zero': { type:'f', perm:'crw-rw-rw-', owner:'root', content:'\\x00\\x00\\x00\\x00...(infinite zeros)' },
  '/dev/random': { type:'f', perm:'crw-rw-rw-', owner:'root', content:function(){ return Array.from({length:64},()=>Math.floor(Math.random()*16).toString(16)).join(''); } },
  '/dev/tty0': { type:'f', perm:'crw--w----', owner:'root', content:'[current terminal]' },
};

/* ── FAKE PROCESS TABLE ── */
const PROCS = [
  { pid:1, user:'root', cpu:'0.0', mem:'0.4', cmd:'/sbin/init' },
  { pid:42, user:'root', cpu:'0.1', mem:'1.2', cmd:'/usr/sbin/sshd -D' },
  { pid:108, user:'root', cpu:'0.0', mem:'0.8', cmd:'/usr/sbin/cron -f' },
  { pid:256, user:'ncc', cpu:'12.4', mem:'34.2', cmd:'python3 vllm_serve.py --model qwen2.5-72b' },
  { pid:257, user:'ncc', cpu:'8.1', mem:'22.0', cmd:'python3 train_lora.py --epochs 10' },
  { pid:512, user:'root', cpu:'0.2', mem:'1.0', cmd:'/usr/sbin/nginx -g daemon off' },
  { pid:666, user:'guest', cpu:'0.0', mem:'0.2', cmd:'-bash' },
  { pid:667, user:'guest', cpu:'0.1', mem:'0.1', cmd:'phosphor-term' },
  { pid:1337, user:'root', cpu:'0.0', mem:'0.5', cmd:'/usr/bin/dockerd' },
  { pid:2048, user:'root', cpu:'0.3', mem:'2.1', cmd:'containerd' },
];

/* ── FAKE NETWORK ── */
const NETSTAT = [
  { proto:'tcp', local:'0.0.0.0:22', remote:'0.0.0.0:*', state:'LISTEN', pid:'42/sshd' },
  { proto:'tcp', local:'0.0.0.0:80', remote:'0.0.0.0:*', state:'LISTEN', pid:'512/nginx' },
  { proto:'tcp', local:'0.0.0.0:443', remote:'0.0.0.0:*', state:'LISTEN', pid:'512/nginx' },
  { proto:'tcp', local:'127.0.0.1:8000', remote:'0.0.0.0:*', state:'LISTEN', pid:'256/python3' },
  { proto:'tcp', local:'10.0.0.42:22', remote:'192.168.1.100:54321', state:'ESTABLISHED', pid:'42/sshd' },
  { proto:'udp', local:'0.0.0.0:68', remote:'0.0.0.0:*', state:'', pid:'--' },
];

const IFCONFIG = `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 10.0.0.42  netmask 255.255.255.0  broadcast 10.0.0.255
        inet6 fe80::1  prefixlen 64  scopeid 0x20<link>
        ether 02:42:0a:00:00:2a  txqueuelen 1000
        RX packets 1048576  bytes 1073741824 (1.0 GB)
        TX packets 524288  bytes 536870912 (512.0 MB)

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        loop  txqueuelen 1000`;

/* ── ROOT PASSWORD ── */
const ROOT_PASSWORD = 'xd1an3l3';

/* ── DOM REFS ── */
const screenEl = document.getElementById('crt-screen');
const contentEl = document.getElementById('crt-content');
const ledEl = document.getElementById('crt-led');
const hintEl = document.getElementById('crt-hint');
const powerBtn = document.getElementById('power-btn');
let currentInput = null;
let activeContent = contentEl;

/* ── STATUS BAR ── */
function pad(n){ return n.toString().padStart(2,'0'); }
function updateStatusBar(){
  const now = new Date();
  document.getElementById('sb-utc').textContent = pad(now.getUTCHours())+':'+pad(now.getUTCMinutes())+':'+pad(now.getUTCSeconds());
  const u = Math.floor((Date.now()-startTime)/1000);
  document.getElementById('sb-uptime').textContent = pad(Math.floor(u/3600))+':'+pad(Math.floor((u%3600)/60))+':'+pad(u%60);
  document.getElementById('sb-load').textContent = (0.2+Math.random()*0.6).toFixed(2);
}
setInterval(updateStatusBar,1000); updateStatusBar();
document.getElementById('footer-year').textContent = new Date().getFullYear();

/* ── POWER ── */
powerBtn.addEventListener('click', ()=>{ if(!S.booting){ S.isOn ? powerOff() : powerOn(); }});

function powerOn(){
  if(S.isOn||S.booting) return;
  S.booting=true;
  screenEl.classList.remove('off');
  screenEl.classList.add('powering-on');
  setTimeout(()=>{ screenEl.classList.add('on'); ledEl.classList.add('on'); bootSequence(); },300);
  setTimeout(()=> screenEl.classList.remove('powering-on'),1200);
}
function powerOff(){
  S.isOn=false; S.booting=false;
  screenEl.classList.add('off'); screenEl.classList.remove('on');
  ledEl.classList.remove('on'); contentEl.innerHTML='';
}

/* ── BOOT SEQUENCE ── */
const bootLines = [
  {t:'PHOSPHOR BIOS v4.2.86 — (c) Phosphor Industries 1989-1993',cls:'bright',d:200},
  {t:'Memory Test : 640K OK ...............',cls:'dim',d:150},
  {t:'Detecting IDE drives ............... [OK]',cls:'dim',d:150},
  {t:'Detecting CDROM .................... [NONE]',cls:'dim',d:120},
  {t:'Detecting AT keyboard .............. [OK]',cls:'dim',d:120},
  {t:'Booting from drive C: ...',cls:'dim',d:200},
  {t:'',d:100},
  {t:'GRUB version 0.97 — booting phosphor-linux 2.6.32',cls:'amber',d:300},
  {t:'[    0.000000] Linux version 2.6.32-phosphor (ncc@buildhost)',cls:'dim',d:60},
  {t:'[    0.001234] CPU: PhosphorCore @ 33 MHz',cls:'dim',d:60},
  {t:'[    0.002001] Memory: 8192k/16384k available',cls:'dim',d:60},
  {t:'[    0.012005] PCI: Probing PCI hardware',cls:'dim',d:50},
  {t:'[    0.045221] usbcore: registered new device driver usb',cls:'dim',d:50},
  {t:'[    0.067100] sda: sda1 sda2 sda3',cls:'dim',d:60},
  {t:'[    0.083102] EXT4-fs (sda1): mounted filesystem',cls:'dim',d:60},
  {t:'[    0.120044] Freeing unused kernel memory: 384k freed',cls:'dim',d:80},
  {t:'',d:80},
  {t:'Welcome to Phosphor Linux 2.6 (tty1)',cls:'bright',d:200},
  {t:'',d:50},
  {t:'    Type "help" for available commands.',cls:'dim',d:80},
  {t:'    Type "cli" to take over the whole site.',cls:'dim',d:80},
  {t:'    Hint: there\'s a way to become root... dig around.',cls:'dim',d:80},
  {t:'',d:100},
];

async function bootSequence(){
  contentEl.innerHTML=''; hintEl.style.display='none';
  for(const line of bootLines){
    appendLine(line.t, line.cls);
    activeContent.scrollTop = activeContent.scrollHeight;
    await sleep(line.d);
  }
  S.isOn=true; S.booting=false;
  showPrompt();
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

/* ── OUTPUT HELPERS ── */
function appendLine(text, cls){
  const d=document.createElement('div');
  d.className='term-line'+(cls?' '+cls:'');
  d.textContent=text;
  activeContent.appendChild(d);
  activeContent.scrollTop=activeContent.scrollHeight;
}
function appendHTML(html, cls){
  const d=document.createElement('div');
  d.className='term-line'+(cls?' '+cls:'');
  d.innerHTML=html;
  activeContent.appendChild(d);
  activeContent.scrollTop=activeContent.scrollHeight;
}
function escapeHTML(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── PROMPT ── */
function getPromptHTML(){
  const u=S.user, isR=S.isRoot;
  const uCls=isR?'user root':'user';
  const sym=isR?'#':'$';
  const symCls=isR?'sym root':'sym';
  const shortCwd=S.cwd==='/home/'+S.user?'~':S.cwd==='/home/'+S.user?'~':S.cwd.replace('/home/'+S.user,'~');
  return `<span class="${uCls}">${u}</span><span class="at">@</span><span class="host">phosphor</span><span class="at">:</span><span class="path">${shortCwd}</span><span class="${symCls}">${sym}</span>`;
}

function showPrompt(){
  const line=document.createElement('div');
  line.className='term-input-line';
  line.innerHTML='<span class="term-prompt">'+getPromptHTML()+'</span>';
  const inp=document.createElement('input');
  inp.className='term-input';
  inp.setAttribute('spellcheck','false');
  inp.setAttribute('autocomplete','off');
  inp.setAttribute('autocapitalize','off');
  if(S.awaitingInput && S.awaitingInput.type==='password') inp.classList.add('password');
  const cur=document.createElement('span');
  cur.className='term-cursor';
  line.appendChild(inp); line.appendChild(cur);
  activeContent.appendChild(line);
  inp.focus();
  currentInput=inp;
  inp.addEventListener('keydown', onKey);
  activeContent.scrollTop=activeContent.scrollHeight;
}

function freezePrompt(val){
  if(!currentInput) return;
  const line=currentInput.parentElement;
  const display = S.awaitingInput&&S.awaitingInput.type==='password' ? '••••••••' : escapeHTML(val);
  line.innerHTML='<span class="term-prompt">'+getPromptHTML()+'</span><span style="color:var(--green)">'+display+'</span>';
  currentInput=null;
}

/* ── KEYBOARD ── */
function onKey(e){
  if(e.key==='Enter'){
    const val=currentInput.value;
    freezePrompt(val);
    if(S.awaitingInput){ S.awaitingInput.cb(val); S.awaitingInput=null; return; }
    if(val.trim()){ S.history.push(val); S.histIdx=S.history.length; }
    handleCommand(val.trim());
    return;
  }
  if(e.key==='ArrowUp'){ e.preventDefault(); if(!S.history.length)return; S.histIdx=Math.max(0,S.histIdx-1); currentInput.value=S.history[S.histIdx]||''; }
  if(e.key==='ArrowDown'){ e.preventDefault(); S.histIdx=Math.min(S.history.length,S.histIdx+1); currentInput.value=S.history[S.histIdx]||''; }
  if(e.key==='Tab'){ e.preventDefault(); tabComplete(); }
  if(e.key==='l'&&e.ctrlKey){ e.preventDefault(); activeContent.innerHTML=''; showPrompt(); }
}
contentEl.addEventListener('click',()=>{ if(currentInput) currentInput.focus(); });

function tabComplete(){
  const val=currentInput.value;
  const parts=val.split(/\s+/);
  if(parts.length<=1){
    const match=Object.keys(CMDS).find(c=>c.startsWith(val));
    if(match) currentInput.value=match;
  } else {
    // file completion
    const partial=parts[parts.length-1];
    const dir=resolvePath(S.cwd);
    const node=FS[dir];
    if(node&&node.type==='d'){
      const match=node.children.find(c=>c.startsWith(partial));
      if(match){ parts[parts.length-1]=match; currentInput.value=parts.join(' '); }
    }
  }
}

/* ── PATH RESOLUTION ── */
function resolvePath(p){
  if(!p) return S.cwd;
  if(p.startsWith('~')) p='/home/'+S.user+p.slice(1);
  if(!p.startsWith('/')) p=S.cwd+'/'+p;
  // normalize
  const parts=p.split('/').filter(Boolean);
  const stack=[];
  for(const part of parts){
    if(part==='..') stack.pop();
    else if(part!=='.') stack.push(part);
  }
  return '/'+stack.join('/');
}

function canRead(path){
  const node=FS[path];
  if(!node) return false;
  if(S.isRoot) return true;
  // check read permission for 'others' (simplified)
  const perm=node.perm;
  if(node.owner===S.user) return perm[1]==='r';
  return perm[7]==='r';
}

/* ── COMMAND DISPATCHER ── */
function handleCommand(raw){
  if(!raw){ showPrompt(); return; }
  const parts=raw.match(/(?:[^\s"]+|"[^"]*")+/g)||[raw];
  const cmd=parts[0].replace(/^\.\//,'');
  const args=parts.slice(1).map(a=>a.replace(/^"|"$/g,''));
  const arg=args.join(' ');

  if(CMDS[cmd]) return CMDS[cmd](arg, args, raw);
  // fallback: fake "command not found" like real Linux
  appendLine(`bash: ${cmd}: command not found`,'red');
  appendLine(`Try 'help' for a list of available commands.`,'dim');
  showPrompt();
}

/* ── COMMANDS ── */
const CMDS = {};

CMDS.help = ()=>{
  const groups = [
    ['NAVIGATION',['ls','cd','pwd','cat','head','tail','find','grep']],
    ['SYSTEM',['whoami','id','uname','hostname','uptime','date','ps','top','kill','free','df','ifconfig','netstat','ping','ssh','w']],
    ['INFO',['about','projects','skills','contact','neofetch']],
    ['FILES',['touch','mkdir','rm','cp','mv','chmod','echo','wc']],
    ['CONTROL',['theme','open','goto','cli','clear','reboot','shutdown','exit']],
    ['FUN',['matrix','sl','cowsay','fortune','figlet','history','env','export','alias','sudo','su']],
  ];
  appendLine('PHOSPHOR TERMINAL v2.0 — Available Commands:','bright');
  appendLine('');
  for(const [g,cmds] of groups){
    appendHTML(`  <span style="color:var(--amber)">${g}</span>`);
    appendHTML(`    <span style="color:var(--green)">${cmds.join(', ')}</span>`);
  }
  appendLine('');
  appendLine('Hint: there are hidden paths to root. Explore the filesystem.','dim');
  appendLine('Arrow keys = history, Tab = autocomplete, Ctrl-L = clear','dim');
  showPrompt();
};

CMDS.ls = (arg, args)=>{
  const flags = args.filter(a=>a.startsWith('-')).join('');
  const target = args.find(a=>!a.startsWith('-')) || S.cwd;
  const path = resolvePath(target);
  const node = FS[path];
  if(!node){ appendLine(`ls: cannot access '${target}': No such file or directory`,'red'); return showPrompt(); }
  if(node.type==='f'){ appendLine(target); return showPrompt(); }
  if(!canRead(path)){ appendLine(`ls: cannot open directory '${target}': Permission denied`,'red'); return showPrompt(); }
  const items = node.children||[];
  if(flags.includes('l')||flags.includes('a')){
    appendLine(`total ${items.length*4}`);
    if(flags.includes('a')){ appendLine('drwxr-xr-x  . '); appendLine('drwxr-xr-x  .. '); }
    for(const name of items){
      const cp=path==='/'?'/'+name:path+'/'+name;
      const cn=FS[cp];
      const perm=cn?cn.perm:'----------';
      const own=cn?cn.owner:'?';
      const size=cn&&cn.content?String(cn.content).length:'4096';
      const color=cn&&cn.type==='d'?'var(--cyan)':'var(--fg-0)';
      appendHTML(`${perm} ${own.padEnd(6)} ${String(size).padStart(6)} <span style="color:${color}">${name}</span>`);
    }
  } else {
    const colored = items.map(name=>{
      const cp=path==='/'?'/'+name:path+'/'+name;
      const cn=FS[cp];
      if(cn&&cn.type==='d') return `<span style="color:var(--cyan)">${name}/</span>`;
      if(name.startsWith('.')) return `<span style="color:var(--fg-2)">${name}</span>`;
      return name;
    });
    appendHTML(colored.join('  '));
  }
  showPrompt();
};

CMDS.cd = (arg)=>{
  const target = arg || '/home/'+S.user;
  const path = resolvePath(target);
  const node = FS[path];
  if(!node){ appendLine(`bash: cd: ${target}: No such file or directory`,'red'); return showPrompt(); }
  if(node.type!=='d'){ appendLine(`bash: cd: ${target}: Not a directory`,'red'); return showPrompt(); }
  if(!S.isRoot && node.owner==='root' && !node.perm.includes('r-x',7)){
    // check other execute
    if(node.perm[9]!=='x'){ appendLine(`bash: cd: ${target}: Permission denied`,'red'); return showPrompt(); }
  }
  S.cwd=path;
  showPrompt();
};

CMDS.pwd = ()=>{ appendLine(S.cwd); showPrompt(); };

CMDS.cat = (arg, args)=>{
  if(!arg){ appendLine('cat: missing operand','red'); return showPrompt(); }
  for(const file of args){
    const path=resolvePath(file);
    const node=FS[path];
    if(!node){ appendLine(`cat: ${file}: No such file or directory`,'red'); continue; }
    if(node.type==='d'){ appendLine(`cat: ${file}: Is a directory`,'red'); continue; }
    if(!canRead(path)){ appendLine(`cat: ${file}: Permission denied`,'red'); continue; }
    const content = typeof node.content==='function'?node.content():node.content;
    content.split('\n').forEach(l=>appendLine(l));
  }
  showPrompt();
};

CMDS.head = (arg,args)=>{
  const file=args.find(a=>!a.startsWith('-'))||'';
  const n=parseInt(args.find(a=>a.startsWith('-n'))?.slice(2))||10;
  const path=resolvePath(file);
  const node=FS[path];
  if(!node||!canRead(path)){ appendLine(`head: cannot open '${file}'`,'red'); return showPrompt(); }
  const lines=(typeof node.content==='function'?node.content():node.content||'').split('\n');
  lines.slice(0,n).forEach(l=>appendLine(l));
  showPrompt();
};

CMDS.tail = (arg,args)=>{
  const file=args.find(a=>!a.startsWith('-'))||'';
  const path=resolvePath(file);
  const node=FS[path];
  if(!node||!canRead(path)){ appendLine(`tail: cannot open '${file}'`,'red'); return showPrompt(); }
  const lines=(typeof node.content==='function'?node.content():node.content||'').split('\n');
  lines.slice(-10).forEach(l=>appendLine(l));
  showPrompt();
};

CMDS.find = (arg)=>{
  const target=arg||'.';
  const base=resolvePath(target);
  const results=[];
  for(const p of Object.keys(FS)){
    if(p.startsWith(base)) results.push(p);
  }
  results.sort().forEach(r=>appendLine(r));
  showPrompt();
};

CMDS.grep = (arg,args)=>{
  if(args.length<2){ appendLine('Usage: grep PATTERN FILE','red'); return showPrompt(); }
  const pattern=args[0], file=args[1];
  const path=resolvePath(file);
  const node=FS[path];
  if(!node||!canRead(path)){ appendLine(`grep: ${file}: No such file or directory`,'red'); return showPrompt(); }
  const content=typeof node.content==='function'?node.content():node.content||'';
  content.split('\n').forEach(l=>{
    if(l.toLowerCase().includes(pattern.toLowerCase())) appendHTML(`<span style="color:var(--red)">${escapeHTML(l)}</span>`);
  });
  showPrompt();
};

CMDS.whoami = ()=>{ appendLine(S.user); showPrompt(); };
CMDS.id = ()=>{
  if(S.isRoot) appendLine('uid=0(root) gid=0(root) groups=0(root)');
  else appendLine('uid=1000(guest) gid=1000(guest) groups=1000(guest)');
  showPrompt();
};
CMDS.hostname = ()=>{ appendLine('phosphor'); showPrompt(); };
CMDS.uname = (arg)=>{
  if(arg==='-a') appendLine('Linux phosphor 2.6.32-phosphor #1 SMP i386 GNU/Linux');
  else appendLine('Linux');
  showPrompt();
};
CMDS.uptime = ()=>{
  const u=Math.floor((Date.now()-startTime)/1000);
  const h=Math.floor(u/3600),m=Math.floor((u%3600)/60);
  appendLine(` ${new Date().toTimeString().slice(0,8)} up ${h}:${pad(m)}, 1 user, load average: ${(0.2+Math.random()*0.5).toFixed(2)}, ${(0.1+Math.random()*0.3).toFixed(2)}, ${(0.1+Math.random()*0.2).toFixed(2)}`);
  showPrompt();
};
CMDS.date = ()=>{ appendLine(new Date().toString()); showPrompt(); };

CMDS.ps = (arg)=>{
  appendHTML(`<span style="color:var(--amber)">  PID USER      %CPU %MEM COMMAND</span>`);
  for(const p of PROCS){
    appendLine(`${String(p.pid).padStart(5)} ${p.user.padEnd(9)} ${p.cpu.padStart(4)} ${p.mem.padStart(4)} ${p.cmd}`);
  }
  showPrompt();
};

CMDS.top = ()=>{
  appendLine('top - '+new Date().toTimeString().slice(0,8),'bright');
  appendLine('Tasks: '+PROCS.length+' total, 1 running, '+(PROCS.length-1)+' sleeping');
  appendLine('%Cpu(s): 21.2 us, 3.1 sy, 0.0 ni, 75.7 id');
  appendLine('MiB Mem: 16384.0 total, 4096.0 free, 8192.0 used, 4096.0 buff/cache');
  appendLine('');
  CMDS.ps();
};

CMDS.kill = (arg)=>{
  if(!arg){ appendLine('kill: usage: kill pid','red'); return showPrompt(); }
  const pid=parseInt(arg);
  const proc=PROCS.find(p=>p.pid===pid);
  if(!proc){ appendLine(`bash: kill: (${pid}) - No such process`,'red'); }
  else if(proc.user==='root'&&!S.isRoot){ appendLine(`bash: kill: (${pid}) - Operation not permitted`,'red'); }
  else appendLine(`[1]+ Terminated (pid ${pid})`);
  showPrompt();
};

CMDS.free = ()=>{
  appendLine('              total        used        free      shared  buff/cache   available');
  appendLine('Mem:          16384        8192        4096         256        4096        8192');
  appendLine('Swap:          4096         128        3968');
  showPrompt();
};

CMDS.df = ()=>{
  appendLine('Filesystem     1K-blocks    Used Available Use% Mounted on');
  appendLine('/dev/sda1       20971520 8388608  12582912  40% /');
  appendLine('tmpfs             819200       0    819200   0% /tmp');
  appendLine('/dev/sda2       10485760 4194304   6291456  40% /home');
  showPrompt();
};

CMDS.ifconfig = ()=>{ IFCONFIG.split('\n').forEach(l=>appendLine(l)); showPrompt(); };
CMDS.ip = (arg)=>{
  if(arg==='addr'||arg==='a') CMDS.ifconfig();
  else { appendLine('Usage: ip addr'); showPrompt(); }
};

CMDS.netstat = ()=>{
  appendHTML('<span style="color:var(--amber)">Proto Local Address          Foreign Address        State       PID/Program</span>');
  for(const n of NETSTAT){
    appendLine(`${n.proto.padEnd(5)} ${n.local.padEnd(22)} ${n.remote.padEnd(22)} ${n.state.padEnd(12)} ${n.pid}`);
  }
  showPrompt();
};

CMDS.ping = async (arg)=>{
  if(!arg){ appendLine('ping: usage: ping destination','red'); return showPrompt(); }
  appendLine(`PING ${arg} (10.0.0.${Math.floor(Math.random()*255)}) 56(84) bytes of data.`);
  for(let i=0;i<4;i++){
    await sleep(300);
    const ms=(1+Math.random()*20).toFixed(1);
    appendLine(`64 bytes from ${arg}: icmp_seq=${i+1} ttl=64 time=${ms} ms`);
  }
  appendLine(`\n--- ${arg} ping statistics ---`);
  appendLine('4 packets transmitted, 4 received, 0% packet loss');
  showPrompt();
};

CMDS.ssh = (arg)=>{
  if(!arg){ appendLine('usage: ssh [user@]hostname','red'); return showPrompt(); }
  if(arg==='root@localhost'||arg==='root@phosphor'){
    appendLine(`Connecting to ${arg}...`);
    appendLine('root@phosphor\'s password:','dim');
    S.awaitingInput = { type:'password', cb:(pw)=>{
      if(pw===ROOT_PASSWORD){ grantRoot('ssh'); }
      else { appendLine('Permission denied, please try again.','red'); appendLine('Hint: check /etc/motd or ~/.ssh/id_rsa.pub','dim'); showPrompt(); }
    }};
    showPrompt();
  } else {
    appendLine(`ssh: connect to host ${arg} port 22: Connection refused`,'red');
    showPrompt();
  }
};

CMDS.w = ()=>{
  appendLine(' '+new Date().toTimeString().slice(0,8)+' up 0:'+pad(Math.floor((Date.now()-startTime)/60000))+', 1 user');
  appendLine('USER     TTY      FROM             LOGIN@   IDLE   WHAT');
  appendLine('guest    pts/0    browser          '+new Date().toTimeString().slice(0,5)+'    0.00s  phosphor-term');
  showPrompt();
};

/* ── INFO COMMANDS ── */
CMDS.about = ()=>{
  appendLine('── ABOUT ──','amber');
  appendLine('Name      : NanCunChild');
  appendLine('School    : Xidian University — Microelectronic Science & Engineering');
  appendLine('Focus     : AI · Security · FPGA · Reverse Engineering');
  appendLine('Infra     : sysadmin for 2 companies + university');
  appendLine('Languages : C#, Python, Rust, C++, Go, Flutter, JS, Java/Kotlin, COBOL*');
  appendLine('Fuel      : coffee + curiosity + kernel panics');
  showPrompt();
};

CMDS.projects = ()=>{
  appendLine('── PROJECTS ──','amber');
  const ps=[
    ['qualcomm-trust-chain','RESEARCH','Qualcomm secure boot trust chain analysis'],
    ['xiaomi-vuln-analysis','RESEARCH','Xiaomi device vulnerability analysis & fuzzing'],
    ['fpga-tofino-switch','HARDWARE','Tofino-style programmable switch on FPGA'],
    ['game-reverse-toolkit','LIVE','Game reverse engineering — memory, hooks, sigs'],
    ['infra-ops','LIVE','Production server ops (2 companies + university)'],
    ['llm-deployment','LIVE','Self-hosted LLM: fine-tune, quantize, vLLM serve'],
  ];
  for(const [name,status,desc] of ps){
    appendHTML(`  <span style="color:var(--green)">${name}</span> <span style="color:var(--amber)">[${status}]</span>`);
    appendHTML(`     <span style="color:var(--fg-1)">${desc}</span>`);
  }
  showPrompt();
};

CMDS.skills = ()=>{
  appendLine('── SKILLS ──','amber');
  const skills=[
    ['C# / Unity',90],['Python',92],['Rust',72],['C++',84],['Go',74],
    ['JS/TS',82],['Java/Kotlin',76],['Flutter',78],['COBOL',12],
    ['LLM Deploy',88],['PyTorch',86],['Linux Admin',90],['Reverse Eng.',82],
    ['FPGA/Verilog',74],['Docker/K8s',82],['Networking',78],
  ];
  for(const [name,val] of skills){
    const blocks=Math.round(val/5);
    const bar='█'.repeat(blocks)+'░'.repeat(20-blocks);
    appendHTML(`  ${name.padEnd(14)} <span style="color:var(--green)">${bar}</span> ${val}`);
  }
  showPrompt();
};

CMDS.contact = ()=>{
  appendLine('── CONTACT ──','amber');
  appendLine('email    : nancunchild@gmail.com / admin@nancunchild.me');
  appendLine('github   : github.com/NanCunChild');
  appendLine('x        : x.com/NanCunChild');
  appendLine('telegram : t.me/NanCunChild');
  appendLine('discord  : @NanCunChild');
  appendLine('gpg      : 02959285A9303F1897DA95D89C2A58BAC2CFD595');
  appendLine('yubikey  : keys.nancunchild.me/yubico_ncc_v3.asc');
  showPrompt();
};

CMDS.neofetch = ()=>{
  const art=['       .--.       ','      |o_o |      ','      |:_/ |      ','     //   \\ \\     ','    (|     | )    ',"   /'\\_   _/`\\   ",'   \\___)=(___/    '];
  const info=[
    S.user+'@phosphor','──────────────────',
    'OS: Phosphor Linux 2.6','Kernel: 2.6.32-phosphor','Shell: phosh 2.0',
    'Resolution: 640x480','Terminal: phosphor-term','CPU: PhosphorCore @ 33 MHz',
    'GPU: RTX (for the models)','Memory: 12M / 16M','Uptime: ~22 years',
    'Caffeine: 3 cups / kernel-panic',
  ];
  for(let i=0;i<Math.max(art.length,info.length);i++){
    const a=(art[i]||'').padEnd(20);
    const inf=info[i]||'';
    appendHTML(`<span style="color:var(--green)">${escapeHTML(a)}</span><span style="color:var(--fg-0)">${escapeHTML(inf)}</span>`);
  }
  showPrompt();
};

/* ── FILE OPERATIONS ── */
CMDS.touch = (arg)=>{
  if(!arg){ appendLine('touch: missing operand','red'); return showPrompt(); }
  const path=resolvePath(arg);
  if(!FS[path]) FS[path]={type:'f',perm:'-rw-r--r--',owner:S.user,content:''};
  appendLine(`touched: ${arg}`,'dim');
  showPrompt();
};
CMDS.mkdir = (arg)=>{
  if(!arg){ appendLine('mkdir: missing operand','red'); return showPrompt(); }
  const path=resolvePath(arg);
  if(FS[path]){ appendLine(`mkdir: cannot create '${arg}': File exists`,'red'); }
  else { FS[path]={type:'d',perm:'drwxr-xr-x',owner:S.user,children:[]}; appendLine(`created: ${arg}`,'dim'); }
  showPrompt();
};
CMDS.rm = (arg,args,raw)=>{
  if(raw.includes('-rf')&&(raw.includes(' /')||raw.includes(' *'))){
    appendLine('rm: it is dangerous to operate recursively on \'/\'','red');
    appendLine('rm: use --no-preserve-root to override this failsafe.','red');
    appendLine('(nice try.)','dim');
  } else if(!arg){ appendLine('rm: missing operand','red'); }
  else { appendLine(`rm: cannot remove '${arg}': Permission denied`,'red'); }
  showPrompt();
};
CMDS.cp = ()=>{ appendLine('cp: omitting arguments','red'); showPrompt(); };
CMDS.mv = ()=>{ appendLine('mv: omitting arguments','red'); showPrompt(); };
CMDS.chmod = (arg)=>{
  if(!S.isRoot){ appendLine('chmod: changing permissions: Operation not permitted','red'); }
  else appendLine(`chmod: mode changed`,'dim');
  showPrompt();
};
CMDS.wc = (arg)=>{
  if(!arg){ appendLine('wc: missing operand','red'); return showPrompt(); }
  const path=resolvePath(arg);
  const node=FS[path];
  if(!node||!canRead(path)){ appendLine(`wc: ${arg}: No such file`,'red'); return showPrompt(); }
  const c=typeof node.content==='function'?node.content():node.content||'';
  const lines=c.split('\n').length, words=c.split(/\s+/).length, bytes=c.length;
  appendLine(`  ${lines}  ${words} ${bytes} ${arg}`);
  showPrompt();
};

CMDS.echo = (arg,args,raw)=>{
  const idx=raw.indexOf(' ');
  appendLine(idx>=0?raw.slice(idx+1):'');
  showPrompt();
};

/* ── CONTROL COMMANDS ── */
CMDS.clear = ()=>{ activeContent.innerHTML=''; showPrompt(); };
CMDS.reboot = async ()=>{
  appendLine('Broadcast message: rebooting...','amber');
  await sleep(600); powerOff(); await sleep(400); powerOn();
};
CMDS.shutdown = async ()=>{
  appendLine('System is going down NOW!','red');
  await sleep(800); powerOff();
};
CMDS.exit = ()=>{
  if(document.body.classList.contains('cli-mode')){ exitCLIMode(); return; }
  appendLine('logout','dim'); setTimeout(powerOff,400);
};
CMDS.gui = CMDS.exit;

CMDS.theme = (arg)=>{
  const valid=['green','amber','ice','blood'];
  if(!arg||!valid.includes(arg)){ appendLine('usage: theme <green|amber|ice|blood>','red'); return showPrompt(); }
  document.body.classList.remove('theme-amber','theme-ice','theme-blood');
  if(arg!=='green') document.body.classList.add('theme-'+arg);
  appendLine('theme set to: '+arg,'bright');
  showPrompt();
};

CMDS.open = (arg)=>{
  if(!arg){ appendLine('usage: open <project-name>','red'); return showPrompt(); }
  const target=document.querySelector('.project[data-name="'+arg+'"]');
  if(target){
    target.scrollIntoView({behavior:'smooth',block:'center'});
    target.style.borderColor='var(--green)'; target.style.boxShadow='0 0 30px var(--green-glow)';
    setTimeout(()=>{target.style.borderColor='';target.style.boxShadow='';},2000);
    appendLine('navigating to '+arg+'...','cyan');
  } else appendLine(`open: no project named "${arg}"`,'red');
  showPrompt();
};

CMDS.goto = (arg)=>{
  if(!arg){ appendLine('usage: goto <hero|about|projects|skills|crt|contact>','red'); return showPrompt(); }
  const el=document.getElementById(arg);
  if(el){ el.scrollIntoView({behavior:'smooth'}); appendLine('jumping to #'+arg,'cyan'); }
  else appendLine(`goto: no section "${arg}"`,'red');
  showPrompt();
};

CMDS.cli = ()=>{
  appendLine('entering full CLI mode...','amber');
  setTimeout(enterCLIMode,400);
};

/* ── FUN COMMANDS ── */
CMDS.matrix = ()=>{
  appendLine('entering the matrix... (press any key to exit)','cyan');
  setTimeout(startMatrix,300);
  showPrompt();
};
CMDS.cmatrix = CMDS.matrix;

CMDS.fortune = ()=>{
  const f=['There is no place like 127.0.0.1.','rm -rf / is not a haiku, but it feels like one.',
    'It works on my machine — ship it.','The cloud is just someone else\'s computer.',
    '99 little bugs in the code... take one down, patch it around... 117 little bugs.',
    'Premature optimization is the root of all evil. Late optimization is also evil.',
    'In theory, theory and practice are the same. In practice, they are not.',
    'A SQL query walks into a bar, sees two tables, and asks: "Can I JOIN you?"',
    'There are 10 kinds of people: those who get binary and those who don\'t.'];
  appendLine(f[Math.floor(Math.random()*f.length)],'cyan');
  showPrompt();
};

CMDS.cowsay = (arg)=>{
  const msg=arg||'moo';
  appendLine(' '+'_'.repeat(msg.length+2));
  appendLine('< '+msg+' >');
  appendLine(' '+'-'.repeat(msg.length+2));
  appendLine('        \\   ^__^');
  appendLine('         \\  (oo)\\_______');
  appendLine('            (__)\\       )\\/\\');
  appendLine('                ||----w |');
  appendLine('                ||     ||');
  showPrompt();
};

CMDS.figlet = (arg)=>{
  if(!arg) arg='NCC';
  // simple block letters
  appendLine('  _   _  ____ ____ ','green');
  appendLine(' | \\ | |/ ___/ ___|','green');
  appendLine(' |  \\| | |  | |    ','green');
  appendLine(' | |\\  | |__| |___ ','green');
  appendLine(' |_| \\_|\\____\\____|','green');
  appendLine(`  (figlet: "${arg}")`,'dim');
  showPrompt();
};

CMDS.sl = async ()=>{
  const train=['      ====        ________                ___________','  _D _|  |_______/        \\__I_I_____===__|_________|','   |(_)---  |   H\\________/ |   |        =|___ ___|','   /     |  |   H  |  |     |   |         ||_| |_||','  |      |  |   H  |__--------------------| [___] |','  | ________|___H__/__|_____/[][]~\\_______|       |','  |/ |   |-----------I_____I [][] []  D   |=======|__'];
  for(let shift=40;shift>-50;shift-=5){
    for(const l of train){ appendLine(' '.repeat(Math.max(0,shift))+l); }
    await sleep(60);
    for(let i=0;i<train.length;i++) activeContent.lastChild.remove();
  }
  appendLine('🚂 woo woo!','amber');
  showPrompt();
};

CMDS.history = ()=>{
  S.history.forEach((h,i)=>appendLine(`  ${String(i+1).padStart(4)}  ${h}`));
  showPrompt();
};
CMDS.env = ()=>{
  appendLine('USER='+S.user); appendLine('HOME=/home/'+S.user);
  appendLine('SHELL=/bin/bash'); appendLine('PATH=/usr/local/bin:/usr/bin:/bin');
  appendLine('TERM=phosphor-256color'); appendLine('LANG=en_US.UTF-8');
  appendLine('EDITOR=nvim'); appendLine('PWD='+S.cwd);
  showPrompt();
};
CMDS.export = ()=>{ appendLine('export: updated environment','dim'); showPrompt(); };
CMDS.alias = ()=>{ appendLine("alias ll='ls -la'"); appendLine("alias la='ls -A'"); appendLine("alias ..='cd ..'"); showPrompt(); };
CMDS.snake = ()=>{ appendLine('snake: not yet implemented — try matrix or sl','amber'); showPrompt(); };

/* =============================================================
   ROOT ESCALATION — 3 PATHS
   ============================================================= */

/* Path 1 (Easy): sudo su → password prompt → password from /etc/motd */
CMDS.sudo = (arg)=>{
  if(S.isRoot){ appendLine('you are already root.','amber'); return showPrompt(); }
  if(arg==='su'||arg==='bash'||arg==='-i'||arg==='su -'){
    appendLine('[sudo] password for '+S.user+':');
    S.awaitingInput = { type:'password', cb:(pw)=>{
      if(pw===ROOT_PASSWORD){ grantRoot('sudo'); }
      else { appendLine('Sorry, try again.','red'); appendLine('Hint: cat /etc/motd','dim'); showPrompt(); }
    }};
    showPrompt();
  } else {
    appendLine(`[sudo] password for ${S.user}: `);
    S.awaitingInput = { type:'password', cb:(pw)=>{
      if(pw===ROOT_PASSWORD){
        appendLine(`executing: ${arg}`,'dim');
        // run the command as root temporarily
        const wasRoot=S.isRoot; S.isRoot=true;
        handleCommand(arg);
        if(!wasRoot) S.isRoot=false;
      } else { appendLine('Sorry, incorrect password.','red'); showPrompt(); }
    }};
    showPrompt();
  }
};

/* Path 2 (Medium): ssh root@localhost → password from ~/.ssh/id_rsa.pub hint */
// (handled in CMDS.ssh above)

CMDS.su = (arg)=>{
  if(S.isRoot){ appendLine('you are already root.','amber'); return showPrompt(); }
  const target=arg||'root';
  if(target==='root'||target==='-'){
    appendLine('Password:');
    S.awaitingInput = { type:'password', cb:(pw)=>{
      if(pw===ROOT_PASSWORD){ grantRoot('su'); }
      else { appendLine('su: Authentication failure','red'); appendLine('Hint: the password is hidden in the system. Try exploring /etc/ or ~/.ssh/','dim'); showPrompt(); }
    }};
    showPrompt();
  } else {
    appendLine(`su: user '${target}' does not exist`,'red');
    showPrompt();
  }
};

/* Path 3 (Hard): exploit CVE-2024-PHSPR via /proc/phosphor */
CMDS.exploit = (arg)=>{
  if(S.isRoot){ appendLine('already root.','amber'); return showPrompt(); }
  if(arg&&arg.toLowerCase().includes('cve-2024-phspr')){
    appendLine('[*] Targeting CVE-2024-PHSPR...','amber');
    appendLine('[*] Writing to /proc/phosphor...','amber');
    setTimeout(()=>{
      appendLine('[*] Triggering privilege escalation...','amber');
      setTimeout(()=>{
        appendLine('[+] Exploit successful!','bright');
        grantRoot('exploit');
      },600);
    },800);
  } else {
    appendLine('exploit: usage: exploit CVE-XXXX-XXXX','red');
    appendLine('Hint: check /var/log/auth.log for known vulnerabilities','dim');
    showPrompt();
  }
};

// Also allow: echo escalate > /proc/phosphor
const origEcho = CMDS.echo;
CMDS.echo = (arg,args,raw)=>{
  if(raw.includes('/proc/phosphor')&&raw.toLowerCase().includes('escalate')){
    if(S.isRoot){ appendLine('already root.','amber'); return showPrompt(); }
    appendLine('[*] Writing "escalate" to /proc/phosphor...','amber');
    setTimeout(()=>{
      appendLine('[+] Privilege escalation triggered!','bright');
      grantRoot('exploit');
    },800);
    return;
  }
  origEcho(arg,args,raw);
};

/* ── GRANT ROOT ── */
function grantRoot(method){
  S.isRoot=true; S.user='root'; S.cwd='/root';
  document.body.classList.add('is-root');
  document.getElementById('sb-userk').textContent='root@';
  document.getElementById('sb-host').textContent='phosphor';

  appendLine('','');
  appendLine('╔══════════════════════════════════════════╗','gold');
  appendLine('║       ROOT ACCESS GRANTED                ║','gold');
  appendLine('║       uid=0(root) gid=0(root)           ║','gold');
  appendLine('╚══════════════════════════════════════════╝','gold');
  appendLine('');
  appendLine(`Method: ${method}`,'dim');
  appendLine('Unlocked: secret, flag, ./xinwei.sh','dim');
  appendLine('');

  // trigger celebration
  showCelebration();
  setTimeout(showPrompt, 2000);
}

/* ── ROOT-ONLY COMMANDS ── */
CMDS.secret = ()=>{
  if(!S.isRoot){ appendLine('bash: secret: command not found','red'); return showPrompt(); }
  appendLine('🔐 ROOT SECRETS UNLOCKED','gold');
  appendLine('');
  appendLine('You found the easter egg! Here\'s what\'s behind the curtain:');
  appendLine('• This terminal is 100% client-side JavaScript');
  appendLine('• The filesystem is fake but the vibes are real');
  appendLine('• Built by NanCunChild @ Xidian University');
  appendLine('• GPG: 02959285A9303F1897DA95D89C2A58BAC2CFD595');
  appendLine('• Try: ./xinwei.sh for the 西电 easter egg');
  showPrompt();
};

CMDS.flag = ()=>{
  if(!S.isRoot){ appendLine('bash: flag: command not found','red'); return showPrompt(); }
  appendLine('','');
  appendLine('  FLAG{y0u_g0t_r00t_0n_ph0sph0r_gg_wp}','gold');
  appendLine('','');
  appendLine('  Congratulations! You\'ve pwned this portfolio.','bright');
  appendLine('  Now go build something cool.','dim');
  showPrompt();
};

// ./xinwei.sh handler (also triggered by just typing xinwei.sh)
CMDS['xinwei.sh'] = ()=>{
  if(!S.isRoot){ appendLine('bash: ./xinwei.sh: Permission denied','red'); return showPrompt(); }
  appendLine('');
  appendLine('  ██╗  ██╗██╗██████╗ ██╗ █████╗ ███╗   ██╗','magenta');
  appendLine('  ╚██╗██╔╝██║██╔══██╗██║██╔══██╗████╗  ██║','magenta');
  appendLine('   ╚███╔╝ ██║██║  ██║██║███████║██╔██╗ ██║','magenta');
  appendLine('   ██╔██╗ ██║██║  ██║██║██╔══██║██║╚██╗██║','magenta');
  appendLine('  ██╔╝ ██╗██║██████╔╝██║██║  ██║██║ ╚████║','magenta');
  appendLine('  ╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝','magenta');
  appendLine('');
  appendLine('  厚德 求真 砺学 笃行','amber');
  appendLine('  西安电子科技大学 · Since 1931','amber');
  appendLine('  — NanCunChild was here —','dim');
  appendLine('');
  showPrompt();
};

/* =============================================================
   CELEBRATION ANIMATION
   ============================================================= */
function showCelebration(){
  const overlay = document.getElementById('root-overlay');
  overlay.classList.add('active');
  launchFireworks();
  setTimeout(()=>{ overlay.classList.remove('active'); }, 4500);
}

function launchFireworks(){
  const canvas = document.getElementById('fireworks-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#ffd86b','#ffb454','#ff6cb8','#4af07a','#6cd1ff','#fff'];

  // Create burst particles
  for(let burst=0; burst<5; burst++){
    const cx = Math.random()*canvas.width;
    const cy = Math.random()*canvas.height*0.6;
    for(let i=0; i<40; i++){
      const angle = (Math.PI*2/40)*i;
      const speed = 2+Math.random()*4;
      particles.push({
        x:cx, y:cy,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        life: 1,
        decay: 0.015+Math.random()*0.01,
        color: colors[Math.floor(Math.random()*colors.length)],
        size: 2+Math.random()*2,
        delay: burst*300,
        born: Date.now(),
      });
    }
  }

  let raf;
  function draw(){
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const now = Date.now();
    let alive = false;
    for(const p of particles){
      if(now - p.born < p.delay) { alive=true; continue; }
      p.life -= p.decay;
      if(p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if(alive) raf = requestAnimationFrame(draw);
    else { ctx.clearRect(0,0,canvas.width,canvas.height); }
  }
  draw();
}

/* =============================================================
   CLI FULLSCREEN MODE
   ============================================================= */
const cliEl = document.getElementById('cli-content');

function enterCLIMode(){
  document.body.classList.add('cli-mode');
  cliEl.innerHTML='';
  activeContent = cliEl;
  appendLine('Phosphor CLI 2.0 — full screen mode','amber');
  appendLine('Type "exit" or "gui" to return to the page.','dim');
  appendLine('All commands work here.','dim');
  appendLine('');
  showPrompt();
}
function exitCLIMode(){
  document.body.classList.remove('cli-mode');
  activeContent = contentEl;
  appendLine('returned to GUI mode.','dim');
  showPrompt();
}

document.querySelector('.cli-overlay').addEventListener('click',()=>{ if(currentInput) currentInput.focus(); });

/* =============================================================
   MATRIX RAIN
   ============================================================= */
const mxCanvas = document.getElementById('matrix-canvas');
const mxCtx = mxCanvas.getContext('2d');
let mxRaf = null, mxDrops = [], mxCols = 0;

function startMatrix(){
  document.body.classList.add('matrix-on');
  mxCanvas.width = window.innerWidth;
  mxCanvas.height = window.innerHeight;
  mxCols = Math.floor(mxCanvas.width/16);
  mxDrops = Array.from({length:mxCols},()=>Math.random()*-50);
  mxRaf = requestAnimationFrame(drawMatrix);
}
function stopMatrix(){
  if(!document.body.classList.contains('matrix-on')) return;
  document.body.classList.remove('matrix-on');
  cancelAnimationFrame(mxRaf);
}
const mxChars='アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン01ABCDEFXYZ';
function drawMatrix(){
  mxCtx.fillStyle='rgba(0,0,0,0.06)';
  mxCtx.fillRect(0,0,mxCanvas.width,mxCanvas.height);
  mxCtx.font='16px JetBrains Mono, monospace';
  for(let i=0;i<mxCols;i++){
    const ch=mxChars[Math.floor(Math.random()*mxChars.length)];
    const x=i*16, y=mxDrops[i]*16;
    mxCtx.fillStyle='#cfffd6';
    mxCtx.fillText(ch,x,y);
    if(mxDrops[i]>1){ mxCtx.fillStyle='rgba(74,240,122,0.7)'; mxCtx.fillText(mxChars[Math.floor(Math.random()*mxChars.length)],x,y-16); }
    if(y>mxCanvas.height&&Math.random()>0.975) mxDrops[i]=0;
    mxDrops[i]+=1;
  }
  mxRaf=requestAnimationFrame(drawMatrix);
}

/* =============================================================
   GLOBAL EVENT LISTENERS
   ============================================================= */
document.addEventListener('keydown',(e)=>{
  if(e.key==='Escape'){
    if(document.body.classList.contains('matrix-on')) stopMatrix();
  }
  // any key exits matrix
  if(document.body.classList.contains('matrix-on')&&e.key!=='Escape') stopMatrix();
});

// Click on matrix exits it
mxCanvas.addEventListener('click', stopMatrix);
