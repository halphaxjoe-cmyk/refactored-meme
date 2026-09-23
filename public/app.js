const q=s=>document.querySelector(s);
const state={history:[],wake:false,listening:false};
const add=(role,text)=>{state.history.push({role,content:text});const d=document.createElement("div");d.className="msg "+role;d.textContent=text;q("#messages").appendChild(d);q("#messages").scrollTop=q("#messages").scrollHeight};
async function health(){try{const r=await fetch("/api/health");q("#connection").textContent=r.ok?"ONLINE":"OFFLINE";q("#connection").classList.toggle("online",r.ok)}catch{q("#connection").textContent="OFFLINE"}}health();
function speak(t){if(!q("#autoSpeak").checked)return;const u=new SpeechSynthesisUtterance(t);u.lang=q("#lang").value;u.rate=Number(q("#rate").value);speechSynthesis.speak(u)}
async function ask(t){if(!t)return;add("user",t);q("#status").textContent="ANALIZE...";try{const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:t,history:state.history.slice(-12),locale:q("#lang").value})});const j=await r.json();if(!r.ok)throw Error(j.error||"server error");if(j.text){add("assistant",j.text);speak(j.text)}if(j.tool)add("tool","TOOL: "+j.tool.name)}catch(e){add("assistant","JARVIS backend la pa pare oswa API key la poko mete.");}q("#status").textContent="DÒMI"}
let recognition=null;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
q("#micBtn").onclick=()=>{if(!SR){alert("Navigatè a pa sipòte Speech Recognition.");return}recognition=new SR();recognition.lang=q("#lang").value;recognition.interimResults=false;recognition.onstart=()=>{q("#status").textContent="ESKOUTE..."};recognition.onresult=e=>ask(e.results[0][0].transcript);recognition.onend=()=>q("#status").textContent="DÒMI";recognition.start()};
q("#wakeBtn").onclick=()=>{state.wake=!state.wake;q("#wakeBtn").textContent="WAKE: "+(state.wake?"ON":"OFF")};
q("#clearBtn").onclick=()=>q("#messages").innerHTML="";
q("#settingsBtn").onclick=()=>q("#settings").showModal();q("#closeSettings").onclick=()=>q("#settings").close();
q("#testVoice").onclick=()=>speak("Mwen se JARVIS. Sistèm vwa a fonksyone.");
