
const menuButton = document.querySelector('.menu');
const nav = document.querySelector('nav');

menuButton?.addEventListener('click', () => nav.classList.toggle('open'));
nav?.querySelectorAll('a').forEach(link =>
  link.addEventListener('click', () => nav.classList.remove('open'))
);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

(async function loadProducts() {
  const container = document.getElementById('products');
  if (!container) return;

  if (!window.supabase || !window.LAVINE_SUPABASE_URL || !window.LAVINE_SUPABASE_KEY) {
    container.innerHTML = '<p class="loading-products">تعذر الاتصال بالمتجر حالياً.</p>';
    return;
  }

  const db = window.supabase.createClient(
    window.LAVINE_SUPABASE_URL,
    window.LAVINE_SUPABASE_KEY
  );

  const { data, error } = await db
    .from('products')
    .select('id,name,description,price,image_url,sizes,colors,category')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = '<p class="loading-products">تعذر تحميل المنتجات.</p>';
    return;
  }

  if (!data?.length) {
    container.innerHTML = '<p class="loading-products">قريباً… نجهّز لكم تشكيلتنا الجديدة.</p>';
    return;
  }

  container.innerHTML = data.map(p => {
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    const colors = Array.isArray(p.colors) ? p.colors : [];

    const details = [
      sizes.length ? 'المقاسات: ' + sizes.join('، ') : '',
      colors.length ? 'الألوان: ' + colors.map(c => c.name).join('، ') : ''
    ].filter(Boolean).join(' · ');

    const image = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy">`
      : '<span>LA VINE</span>';

    return `<article class="product"
      data-product-id="${p.id}"
      onclick="location.href='product.html?id=${encodeURIComponent(p.id)}'">

      <div class="product-image dynamic-image">${image}</div>

      <div class="product-info">
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || 'أناقة تختارينها')}</p>
        </div>
        <strong>${Number(p.price).toLocaleString('en-US')} د.ع</strong>
      </div>

      <a class="product-link" href="product.html?id=${encodeURIComponent(p.id)}">
        اضغط لرؤية باقي الألوان
      </a>
    </article>`;
  }).join('');
})();

// قائمة التواصل
const contactMenu = document.querySelector('.contact-menu');
const contactToggle = document.querySelector('.contact-toggle');

if (contactMenu && contactToggle) {
  contactToggle.setAttribute('aria-expanded', 'false');

  contactToggle.addEventListener('click', e => {
    e.stopPropagation();
    const opened = contactMenu.classList.toggle('open');
    contactToggle.setAttribute('aria-expanded', String(opened));
  });

  document.addEventListener('click', e => {
    if (!contactMenu.contains(e.target)) {
      contactMenu.classList.remove('open');
      contactToggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      contactMenu.classList.remove('open');
      contactToggle.setAttribute('aria-expanded', 'false');
    }
  });
}
