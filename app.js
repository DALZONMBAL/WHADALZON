
const app=document.querySelector("#app"),modal=document.querySelector("#modal"),modalContent=document.querySelector("#modalContent"),toast=document.querySelector("#toast");
let session=null,profile=null;

const pages={
 spaces:["Espaces","Les communautés de WHADALZON."],
 discover:["Découvrir","Trouve des membres et des idées dans la ville."],
 events:["Événements","Les activités et rencontres à venir."],
 channels:["Canaux","Les sources publiques que tu veux suivre."],
 messages:["Messages","Discute directement avec les membres."],
 saved:["Enregistrés","Tes contenus importants."],
 notifications:["Notifications","Tes dernières interactions."],
 profile:["Mon profil","Gère ton identité et ton activité."]
};

function toastMsg(t){toast.textContent=t;toast.classList.add("show");clearTimeout(window.tm);window.tm=setTimeout(()=>toast.classList.remove("show"),2500)}
function initials(n="WH"){return n.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"WH"}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function ago(d){const m=Math.max(1,Math.floor((Date.now()-new Date(d).getTime())/60000));return m<60?m+" min":m<1440?Math.floor(m/60)+" h":Math.floor(m/1440)+" j"}
function active(p){document.querySelectorAll(".nav,.mobile-nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===p))}
function updateIdentity(){const n=profile?.full_name||profile?.username||session?.user.email.split("@")[0]||"Membre",i=initials(n);["topAvatar","sideAvatar"].forEach(id=>{const x=document.getElementById(id);if(x)x.innerHTML=profile?.avatar_url?'<img src="'+esc(profile.avatar_url)+'" alt="Photo de profil">' : i});const a=document.getElementById("sideName"),b=document.getElementById("sideCity");if(a)a.textContent=n;if(b)b.textContent=(profile?.city||"Goma")+" · membre"}
async function loadProfile(){
 if(!session)return null;
 const r=await db.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
 if(r.error){console.error("loadProfile",r.error);profile=null;return null}
 if(!r.data){
  const p={id:session.user.id,full_name:session.user.user_metadata?.full_name||"",city:"Goma",bio:""};
  const x=await db.from("profiles").insert(p).select("*").single();
  if(x.error){console.error("createProfile",x.error);profile=null;return null}
  profile=x.data
 }else profile=r.data;
 updateIdentity();
 return profile
}
function showApp(show=true){const shell=document.querySelector("#appShell"),auth=document.querySelector("#authRoot");if(shell)shell.hidden=!show;if(auth)auth.hidden=show}
function authMessage(r){const m=(r?.message||"").toLowerCase();if(m.includes("invalid login credentials"))return "E-mail ou mot de passe incorrect.";if(m.includes("user already registered"))return "Cet e-mail possède déjà un compte. Connecte-toi.";if(m.includes("email not confirmed"))return "Confirme d’abord ton adresse e-mail.";if(m.includes("password"))return "Le mot de passe doit contenir au moins 6 caractères.";return r?.message||"Une erreur est survenue."}
function authModal(){
 showApp(false);
 const root=document.querySelector("#authRoot");
 root.innerHTML='<div class="auth-screen"><div class="auth-glow"></div><div class="auth-panel"><div class="auth-brand"><span>W</span><div><b>WHADALZON</b><small>La ville numérique qui nous connecte.</small></div></div><span class="kicker">ESPACE MEMBRE</span><h2>Bienvenue</h2><p>Connecte-toi pour accéder à toute l’application WHADALZON.</p><div class="auth-tabs"><button class="auth-tab active" data-auth="login">Connexion</button><button class="auth-tab" data-auth="signup">Créer un compte</button></div><div id="authForm"></div></div></div>';
 root.hidden=false;
 let mode="login";
 const render=()=>{document.querySelectorAll(".auth-tab").forEach(x=>x.classList.toggle("active",x.dataset.auth===mode));document.querySelector("#authForm").innerHTML=(mode==="signup"?'<input class="field" id="authName" placeholder="Nom complet">':"")+'<input class="field" id="authEmail" type="email" placeholder="Adresse e-mail"><input class="field" id="authPassword" type="password" placeholder="Mot de passe (6 caractères minimum)"><button class="submit" id="authSubmit">'+(mode==="login"?"Se connecter":"Créer mon compte")+"</button>";
 document.querySelector("#authSubmit").onclick=async()=>{const email=document.querySelector("#authEmail").value.trim(),password=document.querySelector("#authPassword").value,name=document.querySelector("#authName")?.value.trim()||"";if(!email||password.length<6){toastMsg("E-mail et mot de passe : 6 caractères minimum.");return}const redirect=window.location.origin+window.location.pathname;const r=mode==="login"?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:redirect}});if(r.error){toastMsg(authMessage(r.error));return}
 if(mode==="signup"&&!r.data.session){showEmailConfirmation(email);return}
 session=r.data.session;await loadProfile();showApp(true);home()}};
 document.querySelectorAll(".auth-tab").forEach(x=>x.onclick=()=>{mode=x.dataset.auth;render()});render();
}
function showEmailConfirmation(email){
 const root=document.querySelector("#authRoot");
 root.hidden=false;
 root.innerHTML='<div class="auth-screen"><div class="auth-glow"></div><section class="auth-panel auth-confirmation"><div class="auth-brand"><span>W</span><div><b>WHADALZON</b><small>La ville numérique qui nous connecte.</small></div></div><div class="confirmation-icon"><i class="fa-regular fa-envelope"></i></div><span class="kicker">UNE DERNIÈRE ÉTAPE</span><h2>Vérifie ta boîte mail</h2><p>Ton compte a bien été créé. Nous avons envoyé un lien de confirmation à :</p><strong class="confirmation-email">'+esc(email)+'</strong><p>Ouvre cet e-mail et clique sur le lien pour confirmer ton adresse et activer ton compte. Pense à vérifier le dossier spam ou courrier indésirable.</p><button class="submit" id="confirmationBack">J’ai confirmé, revenir à la connexion</button><button class="auth-resend" id="resendConfirmation">Renvoyer l’e-mail</button><small class="confirmation-note" id="confirmationStatus">Tu ne peux pas encore te connecter tant que ton adresse n’est pas confirmée.</small></section></div>';
 document.querySelector("#confirmationBack").onclick=()=>{authModal();const field=document.querySelector("#authEmail");if(field)field.value=email};
 document.querySelector("#resendConfirmation").onclick=async()=>{const btn=document.querySelector("#resendConfirmation"),status=document.querySelector("#confirmationStatus");btn.disabled=true;btn.textContent="Envoi en cours…";const redirect=window.location.origin+window.location.pathname;const r=await db.auth.resend({type:"signup",email,options:{emailRedirectTo:redirect}});btn.disabled=false;btn.textContent="Renvoyer l’e-mail";status.textContent=r.error?authMessage(r.error):"Un nouvel e-mail de confirmation vient d’être envoyé. Vérifie aussi tes courriers indésirables.";};
}
function requireAuth(){if(!session){authModal();return false}return true}

async function getPosts(userId=""){let q=db.from("posts").select("id,content,image_url,location,created_at,user_id,profiles(id,username,full_name,avatar_url,city)").order("created_at",{ascending:false}).limit(50);if(userId)q=q.eq("user_id",userId);const r=await q;if(r.error){console.error(r.error);return []}return r.data||[]}
function postCard(p){
 const u=p.profiles||{},n=u.full_name||u.username||"Membre";
 return '<article class="post card"><div class="post-head"><span class="avatar">'+initials(n)+'</span><div><strong>'+esc(n)+'</strong><small>'+esc(u.city||p.location||"Goma")+" · "+ago(p.created_at)+'</small></div>'+(session&&p.user_id===session.user.id?'<button class="icon-btn" data-action="delete-post" data-post="'+p.id+'"><i class="fa-solid fa-trash"></i></button>':"")+'</div><p>'+esc(p.content)+'</p>'+(p.image_url?'<img class="post-image" src="'+esc(p.image_url)+'" alt="Publication">':"")+'<div class="post-actions"><button data-action="like" data-post="'+p.id+'"><i class="fa-regular fa-heart"></i> J’aime</button><button data-action="comment" data-post="'+p.id+'"><i class="fa-regular fa-comment"></i> Commenter</button><button data-action="save-post" data-post="'+p.id+'"><i class="fa-regular fa-bookmark"></i> Enregistrer</button><button data-action="share"><i class="fa-solid fa-share-nodes"></i> Partager</button></div></article>'
}
async function home(){
 active("home");app.innerHTML='<div class="loading card">Chargement de ta ville…</div>';const posts=await getPosts();
 app.innerHTML='<section class="hero"><div><span class="kicker">WHADALZON · GOMA</span><h1>La ville numérique qui nous connecte.</h1><p>Communautés, événements, discussions et projets réunis dans une seule expérience.</p><div class="actions"><button class="primary" data-page="spaces"><i class="fa-solid fa-layer-group"></i> Explorer les espaces</button><button class="secondary" data-page="create"><i class="fa-solid fa-plus"></i> Créer</button></div></div></section><div class="section-head"><div><span class="kicker">TON QUARTIER NUMÉRIQUE</span><h2>Qu’est-ce qui se passe ?</h2></div></div><div class="features"><button class="feature card" data-page="spaces"><i class="fa-solid fa-layer-group"></i><strong>Espaces</strong><small>Crée ou rejoins des communautés.</small></button><button class="feature card" data-page="events"><i class="fa-regular fa-calendar"></i><strong>Événements</strong><small>Les activités de la ville.</small></button><button class="feature card" data-page="discover"><i class="fa-solid fa-compass"></i><strong>Découvrir</strong><small>Des membres et des idées.</small></button></div><section class="composer card"><div class="compose-row"><span class="avatar">'+initials(profile?.full_name||"SM")+'</span><button class="compose-button" data-page="create">Partager une idée avec la ville...</button></div><div class="tools"><button data-page="create"><i class="fa-regular fa-image"></i>Photo</button><button data-page="create"><i class="fa-regular fa-lightbulb"></i>Idée</button><button data-page="events"><i class="fa-regular fa-calendar-plus"></i>Événement</button></div></section>'+(posts.length?posts.map(postCard).join(""):'<article class="post card"><div class="city-card"><span class="city-icon"><i class="fa-solid fa-city"></i></span><div><strong>GOMA</strong><small>Aucune publication. Sois le premier à partager.</small></div></div></article>')
}
async function create(){
 if(!requireAuth())return;
 modalContent.innerHTML='<span class="kicker">CRÉER</span><h2>Partager avec la ville</h2><p>Publie une idée, une annonce ou une actualité.</p><textarea class="field" id="postContent" rows="6" placeholder="Qu’est-ce que tu veux partager ?"></textarea><input class="field" id="postLocation" placeholder="Lieu (facultatif)" value="Goma"><button class="submit" id="publish"><i class="fa-solid fa-paper-plane"></i> Publier</button>';modal.classList.add("open");
 document.querySelector("#publish").onclick=async()=>{const content=document.querySelector("#postContent").value.trim(),location=document.querySelector("#postLocation").value.trim();if(!content)return toastMsg("Écris d’abord ta publication.");const r=await db.from("posts").insert({user_id:session.user.id,content,location:location||null});if(r.error)return toastMsg(r.error.message);modal.classList.remove("open");toastMsg("Publication publiée.");home()}
}
async function likePost(id){if(!requireAuth())return;const q=await db.from("likes").select("id").eq("post_id",id).eq("user_id",session.user.id).maybeSingle();if(q.error)return toastMsg(q.error.message);if(q.data){const d=await db.from("likes").delete().eq("id",q.data.id);if(d.error)return toastMsg(d.error.message);toastMsg("J’aime retiré")}else{const r=await db.from("likes").insert({post_id:id,user_id:session.user.id});if(r.error)return toastMsg(r.error.message);toastMsg("J’aime ajouté")}await home()}
async function comments(id){
 const r=await db.from("comments").select("id,content,created_at,profiles(full_name,username)").eq("post_id",id).order("created_at",{ascending:true});if(r.error)return toastMsg(r.error.message);
 modalContent.innerHTML='<span class="kicker">DISCUSSION</span><h2>Commentaires</h2><div class="comments-list">'+((r.data||[]).map(c=>'<div class="comment"><b>'+esc(c.profiles?.full_name||c.profiles?.username||"Membre")+'</b><p>'+esc(c.content)+'</p><small>'+ago(c.created_at)+'</small></div>').join("")||"<p>Aucun commentaire.</p>")+'</div>'+(session?'<textarea class="field" id="commentText" rows="3" placeholder="Écrire un commentaire…"></textarea><button class="submit" id="commentSend">Commenter</button>':"");modal.classList.add("open");
 if(session)document.querySelector("#commentSend").onclick=async()=>{const content=document.querySelector("#commentText").value.trim();if(!content)return;const x=await db.from("comments").insert({post_id:id,user_id:session.user.id,content});if(x.error)return toastMsg(x.error.message);comments(id)}
}
async function discover(){
 active("discover");app.innerHTML='<div class="loading card">Recherche des membres…</div>';const r=await db.from("profiles").select("id,username,full_name,city,bio").neq("id",session?.user.id||"00000000-0000-0000-0000-000000000000").limit(30);if(r.error)return toastMsg(r.error.message);
 app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">DÉCOUVRIR</span><h1>Les membres de la ville</h1><p>Découvre les personnes présentes sur WHADALZON.</p></div><div class="people-grid">'+((r.data||[]).map(u=>'<article class="person card"><span class="avatar">'+initials(u.full_name||u.username||"M")+'</span><strong>'+esc(u.full_name||u.username||"Membre")+'</strong><small>'+esc(u.city||"Goma")+'</small><p>'+esc(u.bio||"Membre de WHADALZON.")+'</p><button data-action="view-profile" data-user="'+u.id+'">Voir le profil</button><button data-action="message-user" data-user="'+u.id+'">Message</button></article>').join("")||"<p>Aucun autre membre.</p>")+'</div></section>'
}
async function viewProfile(id){
 const r=await db.from("profiles").select("*").eq("id",id).single();if(r.error)return toastMsg("Profil introuvable.");const u=r.data,posts=await getPosts(id);const f=session?await db.from("follows").select("id").eq("follower_id",session.user.id).eq("following_id",id).maybeSingle():{data:null};active("discover");
 app.innerHTML='<section class="page"><div class="profile-cover card"><span class="avatar avatar-large">'+initials(u.full_name||u.username||"M")+'</span><div><span class="kicker">PROFIL</span><h1>'+esc(u.full_name||u.username||"Membre")+'</h1><p>'+esc(u.city||"Goma")+" · "+esc(u.bio||"")+'</p></div>'+(session&&id!==session.user.id?'<button class="primary follow-btn" data-action="follow" data-user="'+id+'">'+(f.data?"Ne plus suivre":"Suivre")+'</button>':"")+'</div>'+(posts.length?posts.map(postCard).join(""):'<div class="tile card">Aucune publication.</div>')+'</section>'
}
async function followUser(id){if(!requireAuth())return;const q=await db.from("follows").select("id").eq("follower_id",session.user.id).eq("following_id",id).maybeSingle();if(q.data)await db.from("follows").delete().eq("id",q.data.id);else await db.from("follows").insert({follower_id:session.user.id,following_id:id});viewProfile(id)}
async function profilePage(){
 if(!requireAuth())return;active("profile");const p=await loadProfile();
 const posts=await getPosts(session.user.id),avatar=p?.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="Photo de profil">':initials(p?.full_name||"M");
 app.innerHTML='<section class="page profile-page"><div class="profile-cover card"><span class="avatar avatar-large profile-avatar">'+avatar+'</span><div><span class="kicker">MON PROFIL</span><h1>'+esc(p?.full_name||p?.username||"Membre")+'</h1><p>'+esc(p?.city||"Goma")+' · '+esc(session.user.email)+'</p></div></div><div class="card profile-edit"><h3>Mon identité</h3><label class="upload-label" for="avatarFile"><i class="fa-regular fa-image"></i> Changer ma photo de profil</label><input class="field" id="avatarFile" type="file" accept="image/*"><small class="profile-help">Image JPG, PNG ou WebP, 5 Mo maximum.</small><input class="field" id="editName" value="'+esc(p?.full_name||"")+'" placeholder="Nom complet"><input class="field" id="editUsername" value="'+esc(p?.username||"")+'" placeholder="Nom d’utilisateur"><input class="field" id="editCity" value="'+esc(p?.city||"Goma")+'" placeholder="Ville"><textarea class="field" id="editBio" rows="3" placeholder="À propos de moi">'+esc(p?.bio||"")+'</textarea><button class="submit" id="saveProfile">Enregistrer le profil</button><button class="danger-btn" id="logout">Se déconnecter</button></div></section>';
 document.querySelector("#avatarFile").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){toastMsg("Choisis une image de 5 Mo maximum.");e.target.value="";return}if(!file.type.startsWith("image/")){toastMsg("Choisis un fichier image.");e.target.value="";return}const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg",path=session.user.id+"/avatar-"+Date.now()+"."+ext;const up=await db.storage.from("whadalzon-media").upload(path,file,{contentType:file.type});if(up.error){console.error(up.error);return toastMsg("Envoi impossible. Vérifie le stockage Supabase.")}const url=db.storage.from("whadalzon-media").getPublicUrl(path).data.publicUrl;const saved=await db.from("profiles").update({avatar_url:url}).eq("id",session.user.id);if(saved.error){console.error(saved.error);return toastMsg("Photo envoyée, mais le profil n’a pas été mis à jour.")}await loadProfile();toastMsg("Photo de profil mise à jour.");profilePage()};
 document.querySelector("#saveProfile").onclick=async()=>{const r=await db.from("profiles").update({full_name:document.querySelector("#editName").value.trim(),username:document.querySelector("#editUsername").value.trim()||null,city:document.querySelector("#editCity").value.trim()||"Goma",bio:document.querySelector("#editBio").value.trim()}).eq("id",session.user.id);if(r.error){console.error(r.error);return toastMsg(r.error.message)}await loadProfile();toastMsg("Profil mis à jour.");profilePage()};
 document.querySelector("#logout").onclick=()=>db.auth.signOut();
}
async function notifications(){if(!requireAuth())return;active("notifications");const r=await db.from("notifications").select("id,type,is_read,created_at,profiles(full_name,username)").eq("user_id",session.user.id).order("created_at",{ascending:false}).limit(50);app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">NOTIFICATIONS</span><h1>Activité</h1><p>'+((r.data||[]).length)+' notification(s).</p></div><div class="card list-box">'+((r.data||[]).map(n=>'<div class="list-row"><i class="fa-regular fa-bell"></i><div><strong>'+esc(n.profiles?.full_name||"WHADALZON")+'</strong><small>'+esc(n.type)+" · "+ago(n.created_at)+'</small></div></div>').join("")||"<p>Aucune notification.</p>")+'</div></section>'}
async function startChat(id){
  if(!requireAuth()||id===session.user.id)return;
  modal.classList.remove("open");
  const r=await db.rpc("create_direct_conversation",{target_user:id});
  if(r.error){console.error("create_direct_conversation",r.error);return toastMsg("Impossible de démarrer la conversation. Vérifie la migration Supabase.")}
  await messages(r.data);
}
async function chat(id){return messages(id)}
async function messages(selectedId=""){
  if(!requireAuth())return;
  active("messages");
  const mine=await db.from("conversation_members").select("conversation_id").eq("user_id",session.user.id);
  if(mine.error){console.error(mine.error);return toastMsg("Impossible de charger les conversations. Vérifie les règles Supabase.")}
  const ids=[...new Set((mine.data||[]).map(x=>x.conversation_id))];
  let rows=[];
  if(ids.length){
    const [members,last]=await Promise.all([
      db.from("conversation_members").select("conversation_id,user_id,profiles(id,full_name,username,city,avatar_url)").in("conversation_id",ids).neq("user_id",session.user.id),
      db.from("messages").select("conversation_id,content,created_at,sender_id").in("conversation_id",ids).order("created_at",{ascending:false}).limit(100)
    ]);
    if(members.error||last.error){console.error(members.error||last.error);return toastMsg("Erreur lors du chargement des discussions.")}
    const people={};(members.data||[]).forEach(x=>{if(!people[x.conversation_id])people[x.conversation_id]=x.profiles||{}});
    const latest={};(last.data||[]).forEach(m=>{if(!latest[m.conversation_id])latest[m.conversation_id]=m});
    rows=ids.map(id=>({id,person:people[id]||{},last:latest[id]||null})).sort((a,b)=>new Date(b.last?.created_at||0)-new Date(a.last?.created_at||0));
  }
  app.innerHTML='<section class="messenger-page"><header class="messenger-heading"><div><span class="kicker">WHADALZON · PRIVÉ</span><h1>Messages</h1><p>Des conversations simples, en temps réel.</p></div><button class="primary" data-page="discover"><i class="fa-solid fa-plus"></i> Nouvelle discussion</button></header><div class="messenger-layout card"><aside class="messenger-list"><div class="messenger-list-title"><strong>Discussions</strong><span>'+rows.length+'</span></div><div class="messenger-rows">'+(rows.map(x=>'<button class="messenger-row '+(x.id===selectedId?'selected':'')+'" data-action="open-chat" data-conversation="'+x.id+'"><span class="avatar">'+initials(x.person.full_name||x.person.username||"M")+'</span><span class="messenger-row-copy"><strong>'+esc(x.person.full_name||x.person.username||"Membre")+'</strong><small>'+esc(x.last?.content||(x.person.city||"WHADALZON"))+'</small></span><span class="messenger-row-meta">'+(x.last?'<small>'+ago(x.last.created_at)+'</small>':"")+'</span></button>').join("")||'<div class="messenger-empty-list"><i class="fa-regular fa-comments"></i><p>Aucune discussion pour le moment.</p><small>Choisis un membre pour envoyer ton premier message.</small></div>')+'</div></aside><section class="messenger-chat" id="chatPanel"><div class="chat-welcome"><span class="chat-welcome-icon"><i class="fa-regular fa-paper-plane"></i></span><h2>Ta messagerie</h2><p>Sélectionne une discussion ou commence à écrire à un membre.</p><button class="primary" data-page="discover">Trouver un membre</button></div></section></div></section>';
  if(selectedId)await renderChat(selectedId,true);
}
async function renderChat(id,subscribe=true){
  if(!session)return;
  const access=await db.from("conversation_members").select("conversation_id").eq("conversation_id",id).eq("user_id",session.user.id).maybeSingle();
  if(access.error||!access.data){toastMsg("Conversation inaccessible.");return}
  const [other,messagesResult]=await Promise.all([
    db.from("conversation_members").select("user_id,profiles(full_name,username,city,avatar_url)").eq("conversation_id",id).neq("user_id",session.user.id).limit(1).maybeSingle(),
    db.from("messages").select("id,content,created_at,sender_id,profiles(full_name,username)").eq("conversation_id",id).order("created_at",{ascending:true}).limit(500)
  ]);
  if(messagesResult.error){console.error(messagesResult.error);return toastMsg("Impossible de lire les messages.")}
  const person=other.data?.profiles||{},name=person.full_name||person.username||"Conversation";
  const panel=document.querySelector("#chatPanel");if(!panel)return;
  panel.innerHTML='<header class="chat-header"><span class="avatar">'+initials(name)+'</span><div><strong>'+esc(name)+'</strong><small><i class="fa-solid fa-lock"></i> Conversation privée</small></div><button class="chat-back" data-page="messages" aria-label="Retour aux discussions"><i class="fa-solid fa-arrow-left"></i></button></header><div class="chat-messages" id="chatMessages">'+((messagesResult.data||[]).map(m=>'<article class="message-bubble '+(m.sender_id===session.user.id?'mine':'')+'"><p>'+esc(m.content)+'</p><time>'+new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})+'</time></article>').join("")||'<div class="chat-first-message">Dis bonjour 👋</div>')+'</div><form class="chat-composer" id="chatComposer"><textarea id="msgText" rows="1" maxlength="5000" placeholder="Écrire un message…" aria-label="Écrire un message"></textarea><button type="submit" aria-label="Envoyer le message"><i class="fa-solid fa-paper-plane"></i></button></form>';
  const box=document.querySelector("#chatMessages");if(box)box.scrollTop=box.scrollHeight;
  if(subscribe){
    if(window.chatChannel)await db.removeChannel(window.chatChannel);
    window.chatChannel=db.channel("private-chat-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+id},()=>renderChat(id,false)).subscribe();
  }
  document.querySelector("#chatComposer").onsubmit=async e=>{
    e.preventDefault();
    const field=document.querySelector("#msgText"),content=field.value.trim();
    if(!content)return;
    field.disabled=true;
    const sent=await db.from("messages").insert({conversation_id:id,sender_id:session.user.id,content});
    if(sent.error){field.disabled=false;console.error(sent.error);return toastMsg("Message non envoyé. Réessaie.")}
    await messages(id);
  };
  document.querySelector("#msgText").addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();document.querySelector("#chatComposer")?.requestSubmit()}
  });
}
async function spaces(){
  if(!requireAuth())return;
  active("spaces");
  const r=await db.from("spaces").select("id,name,description,city,owner_id,created_at").order("created_at",{ascending:false}).limit(50);
  if(r.error)return toastMsg(r.error.message);
  const rows=r.data||[];
  app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">ESPACES</span><h1>Les communautés de la ville</h1><p>Écoles, quartiers, associations, projets et centres d’intérêt.</p><button class="primary" data-action="create-space"><i class="fa-solid fa-plus"></i> Créer un espace</button></div><div class="grid">'+(rows.map(s=>'<article class="tile card"><i class="fa-solid fa-people-group"></i><strong>'+esc(s.name)+'</strong><small>'+esc(s.city)+' · '+esc(s.description||"Communauté WHADALZON")+'</small><button data-action="join-space" data-space="'+s.id+'">Rejoindre</button></article>').join("")||'<div class="tile card">Aucun espace pour le moment.</div>')+'</div></section>';
}
async function createSpace(){
  if(!requireAuth())return;
  modalContent.innerHTML='<span class="kicker">ESPACE</span><h2>Créer une communauté</h2><input class="field" id="spaceName" placeholder="Nom de l’espace"><textarea class="field" id="spaceDesc" rows="4" placeholder="Description"></textarea><input class="field" id="spaceCity" value="Goma" placeholder="Ville"><button class="submit" id="saveSpace">Créer l’espace</button>';
  modal.classList.add("open");
  document.querySelector("#saveSpace").onclick=async()=>{const name=document.querySelector("#spaceName").value.trim(),description=document.querySelector("#spaceDesc").value.trim(),city=document.querySelector("#spaceCity").value.trim()||"Goma";if(!name)return toastMsg("Donne un nom à l’espace.");const r=await db.from("spaces").insert({name,description,city,owner_id:session.user.id}).select("id").single();if(r.error)return toastMsg(r.error.message);await db.from("space_members").insert({space_id:r.data.id,user_id:session.user.id});modal.classList.remove("open");toastMsg("Espace créé.");spaces()};
}
async function joinSpace(id){
  if(!requireAuth())return;
  const q=await db.from("space_members").select("space_id").eq("space_id",id).eq("user_id",session.user.id).maybeSingle();
  if(q.data){const r=await db.from("space_members").delete().eq("space_id",id).eq("user_id",session.user.id);if(r.error)return toastMsg(r.error.message);toastMsg("Tu as quitté l’espace.");}
  else{const r=await db.from("space_members").insert({space_id:id,user_id:session.user.id});if(r.error)return toastMsg(r.error.message);toastMsg("Tu as rejoint l’espace.");}
  spaces();
}
async function events(){
  if(!requireAuth())return;
  active("events");
  const r=await db.from("events").select("id,title,description,location,starts_at,creator_id,profiles(full_name,username)").gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}).limit(50);
  if(r.error)return toastMsg(r.error.message);
  app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">ÉVÉNEMENTS</span><h1>Ce qui arrive dans la ville</h1><p>Rencontres, ateliers, activités et projets.</p><button class="primary" data-action="create-event"><i class="fa-solid fa-calendar-plus"></i> Créer un événement</button></div><div class="grid">'+((r.data||[]).map(e=>'<article class="tile card"><i class="fa-regular fa-calendar"></i><strong>'+esc(e.title)+'</strong><small>'+new Date(e.starts_at).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"})+'</small><small>'+esc(e.location)+'</small><p>'+esc(e.description||"")+'</p><small>Par '+esc(e.profiles?.full_name||e.profiles?.username||"Membre")+'</small></article>').join("")||'<div class="tile card">Aucun événement à venir.</div>')+'</div></section>';
}
async function createEvent(){
  if(!requireAuth())return;
  modalContent.innerHTML='<span class="kicker">ÉVÉNEMENT</span><h2>Créer un événement</h2><input class="field" id="eventTitle" placeholder="Titre"><textarea class="field" id="eventDesc" rows="3" placeholder="Description"></textarea><input class="field" id="eventLocation" value="Goma" placeholder="Lieu"><input class="field" id="eventDate" type="datetime-local"><button class="submit" id="saveEvent">Publier l’événement</button>';
  modal.classList.add("open");
  document.querySelector("#saveEvent").onclick=async()=>{const title=document.querySelector("#eventTitle").value.trim(),description=document.querySelector("#eventDesc").value.trim(),location=document.querySelector("#eventLocation").value.trim()||"Goma",date=document.querySelector("#eventDate").value;if(!title||!date)return toastMsg("Titre et date sont obligatoires.");const r=await db.from("events").insert({title,description,location,starts_at:new Date(date).toISOString(),creator_id:session.user.id});if(r.error)return toastMsg(r.error.message);modal.classList.remove("open");toastMsg("Événement publié.");events()};
}
async function channels(){
  if(!requireAuth())return;
  active("channels");
  const r=await db.from("channels").select("id,name,description,owner_id,created_at,profiles(full_name,username)").order("created_at",{ascending:false}).limit(50);
  if(r.error)return toastMsg(r.error.message);
  app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">CANAUX</span><h1>Les voix de la ville</h1><p>Sources publiques, projets, médias et communautés.</p><button class="primary" data-action="create-channel"><i class="fa-solid fa-bullhorn"></i> Créer un canal</button></div><div class="grid">'+((r.data||[]).map(c=>'<article class="tile card"><i class="fa-solid fa-broadcast-tower"></i><strong>'+esc(c.name)+'</strong><small>'+esc(c.description||"Canal public")+'</small><small>Par '+esc(c.profiles?.full_name||c.profiles?.username||"Membre")+'</small></article>').join("")||'<div class="tile card">Aucun canal pour le moment.</div>')+'</div></section>';
}
async function createChannel(){
  if(!requireAuth())return;
  modalContent.innerHTML='<span class="kicker">CANAL</span><h2>Créer un canal public</h2><input class="field" id="channelName" placeholder="Nom du canal"><textarea class="field" id="channelDesc" rows="4" placeholder="Description"></textarea><button class="submit" id="saveChannel">Créer le canal</button>';
  modal.classList.add("open");
  document.querySelector("#saveChannel").onclick=async()=>{const name=document.querySelector("#channelName").value.trim(),description=document.querySelector("#channelDesc").value.trim();if(!name)return toastMsg("Donne un nom au canal.");const r=await db.from("channels").insert({name,description,owner_id:session.user.id});if(r.error)return toastMsg(r.error.message);modal.classList.remove("open");toastMsg("Canal créé.");channels()};
}
async function saved(){
  if(!requireAuth())return;
  active("saved");
  const r=await db.from("saved_posts").select("post_id,posts(id,content,image_url,location,created_at,user_id,profiles(id,username,full_name,avatar_url,city))").eq("user_id",session.user.id).order("created_at",{ascending:false});
  if(r.error)return toastMsg(r.error.message);
  const posts=(r.data||[]).map(x=>x.posts).filter(Boolean);
  app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">ENREGISTRÉS</span><h1>Tes contenus importants</h1><p>Retrouve les publications que tu veux garder.</p></div>'+(posts.length?posts.map(postCard).join(""):'<div class="tile card">Aucune publication enregistrée.</div>')+'</section>';
}
async function toggleSave(id){
  if(!requireAuth())return;
  const q=await db.from("saved_posts").select("post_id").eq("user_id",session.user.id).eq("post_id",id).maybeSingle();
  if(q.error)return toastMsg(q.error.message);
  if(q.data){const r=await db.from("saved_posts").delete().eq("user_id",session.user.id).eq("post_id",id);if(r.error)return toastMsg(r.error.message);toastMsg("Publication retirée des enregistrés.");}
  else{const r=await db.from("saved_posts").insert({user_id:session.user.id,post_id:id});if(r.error)return toastMsg(r.error.message);toastMsg("Publication enregistrée.");}
  saved();
}

function simple(p){active(p);const v=pages[p];if(p==="discover")return discover();if(p==="messages")return messages();if(p==="notifications")return notifications();if(p==="spaces")return spaces();if(p==="events")return events();if(p==="channels")return channels();if(p==="saved")return saved();app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">WHADALZON</span><h1>'+v[0]+'</h1><p>'+v[1]+'</p></div><div class="grid"><div class="tile card"><i class="fa-solid fa-users"></i><strong>Communautés</strong><small>Cette section est prête pour les prochaines données de la ville.</small></div><div class="tile card"><i class="fa-solid fa-bolt"></i><strong>Supabase connecté</strong><small>Les comptes, profils, publications et interactions sont réels.</small></div></div></section>'}
async function newChat(){
 if(!requireAuth())return;
 modalContent.innerHTML='<span class="kicker">NOUVELLE DISCUSSION</span><h2>Écrire à un membre</h2><input class="field" id="memberSearch" type="search" placeholder="Rechercher un nom ou un nom d’utilisateur"><div id="memberResults" class="people-grid"><p>Chargement des membres…</p></div>';
 modal.classList.add("open");
 const r=await db.from("profiles").select("id,username,full_name,city,avatar_url").neq("id",session.user.id).order("full_name",{ascending:true}).limit(100);
 if(r.error){document.querySelector("#memberResults").innerHTML='<p>Impossible de charger les membres.</p>';return}
 const people=r.data||[];
 const render=()=>{const q=document.querySelector("#memberSearch").value.trim().toLowerCase(),rows=people.filter(u=>(u.full_name||"").toLowerCase().includes(q)||(u.username||"").toLowerCase().includes(q));document.querySelector("#memberResults").innerHTML=rows.map(u=>'<article class="person card"><span class="avatar">'+(u.avatar_url?'<img src="'+esc(u.avatar_url)+'" alt="">':initials(u.full_name||u.username||"M"))+'</span><strong>'+esc(u.full_name||u.username||"Membre")+'</strong><small>'+esc(u.city||"Goma")+'</small><button data-action="message-user" data-user="'+u.id+'"><i class="fa-regular fa-comments"></i> Envoyer un message</button></article>').join("")||'<p>Aucun membre trouvé.</p>'};
 document.querySelector("#memberSearch").addEventListener("input",render);render();
}
async function statuses(){
 if(!requireAuth())return;active("statuses");
 const r=await db.from("statuses").select("id,user_id,content,image_url,created_at,expires_at,profiles(full_name,username,avatar_url,city)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(100);
 if(r.error){console.error(r.error);app.innerHTML='<section class="page"><div class="page-head card"><h1>Statuts</h1><p>Pour activer les statuts, exécute le fichier supabase/migrations/20261012_whadalzon_statuses.sql dans Supabase → SQL Editor. Aucune donnée existante n’est supprimée.</p></div></section>';return}
 const rows=r.data||[];
 app.innerHTML='<section class="page status-page"><div class="page-head card status-title"><div><span class="kicker">WHADALZON · 24 HEURES</span><h1>Statuts</h1><p>Partage un moment avec tes contacts. Les statuts expirent après 24 heures.</p></div><button class="primary" data-action="new-status"><i class="fa-solid fa-plus"></i> Mon statut</button></div><div class="status-composer card"><div class="status-me-avatar">'+(profile?.avatar_url?'<img src="'+esc(profile.avatar_url)+'" alt="">':initials(profile?.full_name||"M"))+'</div><div><strong>'+esc(profile?.full_name||profile?.username||"Mon profil")+'</strong><small>Quoi de neuf ?</small></div><button class="status-add" data-action="new-status" aria-label="Créer un statut"><i class="fa-solid fa-plus"></i></button></div><div class="status-list">'+(rows.map(s=>'<article class="status-card card"><div class="status-person"><span class="avatar">'+(s.profiles?.avatar_url?'<img src="'+esc(s.profiles.avatar_url)+'" alt="">':initials(s.profiles?.full_name||s.profiles?.username||"M"))+'</span><div><strong>'+esc(s.profiles?.full_name||s.profiles?.username||"Membre")+'</strong><small>'+ago(s.created_at)+' · expire '+new Date(s.expires_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})+'</small></div></div>'+(s.content?'<p>'+esc(s.content)+'</p>':"")+(s.image_url?'<img class="status-image" src="'+esc(s.image_url)+'" alt="Photo de statut">':"")+(s.user_id===session.user.id?'<button class="status-delete" data-action="delete-status" data-status="'+s.id+'"><i class="fa-regular fa-trash-can"></i> Supprimer</button>':"")+'</article>').join("")||'<div class="card status-empty"><i class="fa-regular fa-circle-check"></i><h3>Aucun statut récent</h3><p>Sois le premier à partager un moment.</p><button class="primary" data-action="new-status">Créer un statut</button></div>')+'</div></section>';
}
async function createStatus(){
 if(!requireAuth())return;
 modalContent.innerHTML='<span class="kicker">MON STATUT</span><h2>Partager un moment</h2><p>Ton statut sera visible pendant 24 heures.</p><textarea class="field" id="statusContent" rows="4" maxlength="700" placeholder="Quoi de neuf ? (facultatif si tu ajoutes une photo)"></textarea><label class="upload-label" for="statusFile"><i class="fa-regular fa-image"></i> Ajouter une photo (facultatif)</label><input class="field" id="statusFile" type="file" accept="image/*"><button class="submit" id="publishStatus">Publier mon statut</button>';
 modal.classList.add("open");
 document.querySelector("#publishStatus").onclick=async()=>{const btn=document.querySelector("#publishStatus"),content=document.querySelector("#statusContent").value.trim(),file=document.querySelector("#statusFile").files?.[0];if(!content&&!file)return toastMsg("Écris un message ou choisis une photo.");if(file&&file.size>5*1024*1024)return toastMsg("La photo doit faire 5 Mo maximum.");btn.disabled=true;btn.textContent="Publication…";let image_url=null;
 if(file){if(!file.type.startsWith("image/")){btn.disabled=false;btn.textContent="Publier mon statut";return toastMsg("Choisis un fichier image.")}const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg",path=session.user.id+"/status-"+Date.now()+"."+ext;const up=await db.storage.from("whadalzon-media").upload(path,file,{contentType:file.type});if(up.error){console.error(up.error);btn.disabled=false;btn.textContent="Publier mon statut";return toastMsg("Envoi de la photo impossible.")}image_url=db.storage.from("whadalzon-media").getPublicUrl(path).data.publicUrl}
 const r=await db.from("statuses").insert({user_id:session.user.id,content,image_url});if(r.error){console.error(r.error);btn.disabled=false;btn.textContent="Publier mon statut";return toastMsg("Statut non publié. Vérifie la migration Supabase.")}modal.classList.remove("open");toastMsg("Statut publié.");statuses()};
}
async function deleteStatus(id){if(!requireAuth()||!confirm("Supprimer ce statut ?"))return;const r=await db.from("statuses").delete().eq("id",id).eq("user_id",session.user.id);if(r.error)return toastMsg("Impossible de supprimer le statut.");toastMsg("Statut supprimé.");statuses()}
function go(p){if(p==="home"||p==="messages")messages();else if(p==="statuses")statuses();else if(p==="profile")profilePage();else if(p==="discover")newChat();else messages()}

document.addEventListener("click",async e=>{const b=e.target.closest("[data-page]");if(b){e.preventDefault();go(b.dataset.page);return}const a=e.target.closest("[data-action]");if(!a)return;const x=a.dataset.action;if(x==="like")likePost(a.dataset.post);else if(x==="comment")comments(a.dataset.post);else if(x==="view-profile")viewProfile(a.dataset.user);else if(x==="follow")followUser(a.dataset.user);else if(x==="message-user")startChat(a.dataset.user);else if(x==="open-chat")chat(a.dataset.conversation);else if(x==="new-status")createStatus();else if(x==="delete-status")deleteStatus(a.dataset.status);else if(x==="create-space")createSpace();else if(x==="join-space")joinSpace(a.dataset.space);else if(x==="create-event")createEvent();else if(x==="create-channel")createChannel();else if(x==="save-post")toggleSave(a.dataset.post);else if(x==="delete-post"&&confirm("Supprimer cette publication ?")){await db.from("posts").delete().eq("id",a.dataset.post).eq("user_id",session.user.id);home()}else if(x==="share"){try{await navigator.clipboard.writeText(location.href);toastMsg("Lien copié")}catch{toastMsg("Lien prêt à partager")}}});
document.querySelector("#close").onclick=()=>modal.classList.remove("open");modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
document.querySelector("#search").addEventListener("keydown",async e=>{if(e.key!=="Enter"||!e.target.value.trim())return;const q=e.target.value.trim();const [a1,a2]=await Promise.all([db.from("profiles").select("id,username,full_name,city,bio").ilike("full_name","%"+q+"%").limit(30),db.from("profiles").select("id,username,full_name,city,bio").ilike("username","%"+q+"%").limit(30)]);const seen=new Set(),rows=[...(a1.data||[]),...(a2.data||[])].filter(u=>!seen.has(u.id)&&seen.add(u.id)).slice(0,30);const r={error:a1.error||a2.error,data:rows};if(r.error)return toastMsg(r.error.message);active("discover");app.innerHTML='<section class="page"><div class="page-head card"><span class="kicker">RECHERCHE</span><h1>Résultats pour « '+esc(q)+' »</h1></div><div class="people-grid">'+((r.data||[]).map(u=>'<article class="person card"><span class="avatar">'+initials(u.full_name||u.username||"M")+'</span><strong>'+esc(u.full_name||u.username||"Membre")+'</strong><small>'+esc(u.city||"Goma")+'</small><button data-action="view-profile" data-user="'+u.id+'">Voir le profil</button><button data-action="message-user" data-user="'+u.id+'">Message</button></article>').join("")||"<p>Aucun résultat.</p>")+'</div></section>'});

async function boot(){const r=await db.auth.getSession();session=r.data.session;if(session){showApp(true);await loadProfile();updateIdentity();messages()}else{showApp(false);authModal()}db.auth.onAuthStateChange(async(_,s)=>{session=s;if(session){showApp(true);await loadProfile();updateIdentity();messages()}else{profile=null;updateIdentity();showApp(false);authModal()}})}
let deferredInstallPrompt=null;
const installButton=document.querySelector("#installApp");
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;if(installButton)installButton.hidden=false});
window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;if(installButton)installButton.hidden=true;toastMsg("WHADALZON est installée.")});
if(installButton)installButton.onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();const choice=await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;if(choice?.outcome==="accepted")toastMsg("Installation lancée.");return}if(window.matchMedia("(display-mode: standalone)").matches){toastMsg("WHADALZON est déjà installée.");return}if(/iphone|ipad|ipod/i.test(navigator.userAgent)){toastMsg("Sur iPhone : Partager, puis « Sur l’écran d’accueil ».");return}toastMsg("Dans le menu du navigateur, choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».")};
boot();if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
