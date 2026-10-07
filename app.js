const toast=document.getElementById('toast');
function showToast(m){toast.textContent=m;toast.classList.add('show');clearTimeout(window.t);window.t=setTimeout(()=>toast.classList.remove('show'),2200)}
function activate(section){document.querySelectorAll('[data-section]').forEach(x=>x.classList.toggle('active',x.dataset.section===section));showToast(section==='home'?'Ma ville':section[0].toUpperCase()+section.slice(1)+' — bientôt connecté à Supabase')}
document.querySelectorAll('[data-section]').forEach(x=>x.addEventListener('click',()=>activate(x.dataset.section)));
document.querySelectorAll('[data-action]').forEach(x=>x.addEventListener('click',()=>showToast(x.dataset.action==='join'?'Espace ajouté à tes découvertes.':'Cette fonction sera connectée à Supabase.')));
document.getElementById('composerButton').addEventListener('click',()=>showToast('Création de publication — prochaine étape.'));
document.getElementById('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.value.trim())showToast('Recherche : '+e.target.value.trim())});