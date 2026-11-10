const menuButton=document.querySelector('.menu');
const nav=document.querySelector('nav');
menuButton?.addEventListener('click',()=>nav.classList.toggle('open'));
nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>nav.classList.remove('open')));

(async function loadProducts(){
  const container=document.getElementById('products');
  if(!container) return;
  if(!window.supabase || !window.LAVINE_SUPABASE_URL || !window.LAVINE_SUPABASE_KEY){
    container.innerHTML='<p class="loading-products">تعذر الاتصال بالمتجر حالياً.</p>'; return;
  }
  const db=window.supabase.createClient(window.LAVINE_SUPABASE_URL,window.LAVINE_SUPABASE_KEY);
  const {data,error}=await db.from('products').select('id,name,description,price,image_url,sizes,colors,category').eq('is_active',true).order('created_at',{ascending:false});
  if(error){ console.error(error); container.innerHTML='<p class="loading-products">تعذر تحميل المنتجات. يرجى المحاولة لاحقاً.</p>'; return; }
  if(!data?.length){ container.innerHTML='<p class="loading-products">قريباً… نجهّز لكم تشكيلتنا الجديدة.</p>'; return; }
  container.innerHTML=data.map(p=>{
    const sizes=Array.isArray(p.sizes)?p.sizes:[];
    const colors=Array.isArray(p.colors)?p.colors:[];
    const details=[sizes.length?'المقاسات: '+sizes.join('، '):'',colors.length?'الألوان: '+colors.join('، '):''].filter(Boolean).join(' · ');
    const msg=encodeURIComponent('مرحباً، أرغب بطلب: '+p.name+' | السعر: '+Number(p.price).toLocaleString('en-US')+' د.ع');
    const image=p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy">`:'<span>LA VINE</span>';
    return `<article class="product"><div class="product-image dynamic-image">${image}</div><div class="product-info"><div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description||details||'أناقة تختارينها')}</p></div><strong>${Number(p.price).toLocaleString('en-US')} د.ع</strong></div>${details?`<p class="product-details">${escapeHtml(details)}</p>`:''}<a class="product-link" href="https://wa.me/9647744040441?text=${msg}" target="_blank" rel="noopener">اطلبي عبر واتساب</a></article>`;
  }).join('');
})();
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
