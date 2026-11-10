
const db = window.supabase.createClient(
  window.LAVINE_SUPABASE_URL,
  window.LAVINE_SUPABASE_KEY
);

const $ = id => document.getElementById(id);
const loginPanel = $('login-panel');
const dashboard = $('dashboard');

let colorBlocks = [];
let currentImages = [];

function message(id, text, isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#a33d2d' : '#527b55';
}

async function isAdmin(user) {
  if (!user?.email) return false;
  const { data, error } = await db.from('admins')
    .select('email')
    .ilike('email', user.email)
    .maybeSingle();
  return !error && !!data;
}

async function showSession() {
  const { data: { session } } = await db.auth.getSession();

if (session && await isAdmin(session.user)) {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  await loadProducts();
  await loadPromotions();
}
  } else {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    if (session) {
      message('login-message', 'هذا الحساب غير مخوّل لإدارة المتجر.', true);
    }
  }
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  message('login-message', 'جارٍ تسجيل الدخول...');

  const { data, error } = await db.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });

  if (error) {
    message('login-message', 'تعذر تسجيل الدخول: ' + error.message, true);
    return;
  }

  if (!await isAdmin(data.user)) {
    await db.auth.signOut();
    message('login-message', 'هذا البريد غير موجود ضمن مديري المتجر.', true);
    return;
  }

  await showSession();
});

$('logout').addEventListener('click', async () => {
  await db.auth.signOut();
  await showSession();
});

function splitList(value) {
  return value.split(/[,،]/).map(x => x.trim()).filter(Boolean);
}

function resetForm() {
  $('product-form').reset();
  $('product-id').value = '';
  $('active').checked = true;
  $('image').value = '';
  window.currentProductImage = null;
  currentImages = [];
  colorBlocks = [];
  $('colors-container').innerHTML = '';
  addColorBlock();
  message('form-message', '');
}

$('reset-form').addEventListener('click', resetForm);

function addColorBlock(color = null) {
  const id = 'color-' + Math.random().toString(36).slice(2, 10);

  const block = document.createElement('div');
  block.className = 'color-block';
  block.dataset.colorId = id;

  block.innerHTML = `
    <hr>
    <label>اسم اللون
      <input class="color-name" placeholder="مثلاً: بيج" required>
    </label>

    <label>صور هذا اللون (JPG)
      <input class="color-images" type="file" accept="image/jpeg" multiple>
    </label>

    <div class="size-list"></div>

    <button type="button" class="add-size secondary-btn">
      + إضافة مقاس
    </button>

    <button type="button" class="remove-color secondary-btn">
      حذف اللون
    </button>
  `;

  $('colors-container').appendChild(block);

  block.querySelector('.color-name').value = color?.name || '';

  if (color?.sizes) {
    color.sizes.forEach(s => addSizeRow(block, s.size, s.quantity));
  } else {
    addSizeRow(block, 'فري سايز', 0);
  }

  block.querySelector('.add-size').addEventListener('click', () => {
    addSizeRow(block, '', 0);
  });

  block.querySelector('.remove-color').addEventListener('click', () => {
    block.remove();
  });

  if (color?.images) {
    block.dataset.oldImages = JSON.stringify(color.images);
  }

  return block;
}

function addSizeRow(block, size = '', quantity = 0) {
  const row = document.createElement('div');
  row.className = 'size-row';

  row.innerHTML = `
    <input class="size-name" placeholder="المقاس (M أو فري سايز)" required>
    <input class="size-quantity" type="number" min="0" step="1"
      placeholder="الكمية" required>
    <button type="button" class="remove-size secondary-btn">حذف</button>
  `;

  row.querySelector('.size-name').value = size;
  row.querySelector('.size-quantity').value = quantity;

  row.querySelector('.remove-size').addEventListener('click', () => {
    row.remove();
  });

  block.querySelector('.size-list').appendChild(row);
}

$('add-color').addEventListener('click', () => addColorBlock());

async function uploadImage(file) {
  if (file.type !== 'image/jpeg') {
    throw new Error('ارفع الصور بصيغة JPG فقط.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('حجم كل صورة يجب ألا يتجاوز 5 MB.');
  }

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

  const { error } = await db.storage
    .from('product-images')
    .upload(path, file, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (error) throw error;

  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

async function saveProduct(e) {
  e.preventDefault();
  message('form-message', 'جارٍ حفظ المنتج...');

  try {
    const { data: { user } } = await db.auth.getUser();

    if (!await isAdmin(user)) {
      throw new Error('انتهت الجلسة أو لا تملك صلاحية الإدارة.');
    }

    const blocks = [...$('colors-container').querySelectorAll('.color-block')];

    if (!blocks.length) {
      throw new Error('أضف لوناً واحداً على الأقل.');
    }

    const colors = [];
    const variants = [];
    let firstImage = window.currentProductImage || null;

    for (const block of blocks) {
      const name = block.querySelector('.color-name').value.trim();
      if (!name) throw new Error('اكتب اسم كل لون.');

      const oldImages = JSON.parse(block.dataset.oldImages || '[]');
      const files = [...block.querySelector('.color-images').files];
      const images = [...oldImages];

      for (const file of files) {
        images.push(await uploadImage(file));
      }

      if (!firstImage && images.length) firstImage = images[0];

      const rows = [...block.querySelectorAll('.size-row')];

      if (!rows.length) {
        throw new Error(`أضف مقاساً واحداً على الأقل للون ${name}.`);
      }

      const colorSizes = [];

      for (const row of rows) {
        const size = row.querySelector('.size-name').value.trim();
        const quantity = Number(row.querySelector('.size-quantity').value);

        if (!size || !Number.isInteger(quantity) || quantity < 0) {
          throw new Error(`راجع المقاسات والكميات للون ${name}.`);
        }

        colorSizes.push({ size, quantity });

        variants.push({
          color_name: name,
          size,
          quantity
        });
      }

      colors.push({
        name,
        images,
        sizes: colorSizes.map(s => s.size)
      });
    }

    const mainFile = $('image').files[0];
    if (mainFile) firstImage = await uploadImage(mainFile);

    const uniqueSizes = [...new Set(variants.map(v => v.size))];

    const payload = {
      name: $('name').value.trim(),
      price: Number($('price').value),
      description: $('description').value.trim(),
      category: $('category').value.trim(),
      sizes: uniqueSizes,
      colors,
      images: colors.flatMap(c => c.images),
      image_url: firstImage,
      is_active: $('active').checked
    };

    let productId = $('product-id').value;

    if (productId) {
      const { error } = await db.from('products')
        .update(payload)
        .eq('id', productId);

      if (error) throw error;

      const { error: deleteError } = await db.from('product_variants')
        .delete()
        .eq('product_id', productId);

      if (deleteError) throw deleteError;
    } else {
      const { data, error } = await db.from('products')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      productId = data.id;
    }

    const rowsToSave = variants.map(v => ({
      product_id: productId,
      color_name: v.color_name,
      size: v.size,
      quantity: v.quantity
    }));

    const { error: variantError } = await db.from('product_variants')
      .insert(rowsToSave);

    if (variantError) throw variantError;

    resetForm();
    await loadProducts();
    message('form-message', 'تم حفظ المنتج والألوان والمخزون بنجاح.');

  } catch (error) {
    message('form-message', 'تعذر الحفظ: ' + error.message, true);
  }
}

$('product-form').addEventListener('submit', saveProduct);

async function loadProducts() {
  const box = $('admin-products');
  box.textContent = 'جارٍ تحميل المنتجات...';

  const { data, error } = await db.from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    box.textContent = 'تعذر تحميل المنتجات: ' + error.message;
    return;
  }

  if (!data.length) {
    box.textContent = 'لا توجد منتجات حالياً.';
    return;
  }

  box.innerHTML = data.map(p => `
    <article class="admin-product">
      <div>
        ${p.image_url
          ? `<img src="${esc(p.image_url)}" alt="">`
          : '<div class="admin-placeholder">LA</div>'}
      </div>
      <div>
        <h3>${esc(p.name_ar || p.name || p.name_en)}</h3>
        <p>${Number(p.price).toLocaleString('en-US')} د.ع ·
          ${p.is_active ? 'متاح للعرض' : 'مخفي'}</p>
        <p>${esc(Array.isArray(p.sizes) ? p.sizes.join('، ') : '')}</p>
      </div>
      <div class="admin-product-actions">
        <button data-edit="${esc(p.id)}">تعديل</button>
        <button data-delete="${esc(p.id)}">حذف</button>
      </div>
    </article>
  `).join('');

  box.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => {
      editProduct(data.find(p => p.id === button.dataset.edit));
    });
  });

  box.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => deleteProduct(button.dataset.delete));
  });
}

async function editProduct(p) {
  $('product-id').value = p.id;
  $('name').value = p.name_ar || p.name || p.name_en || '';
  $('price').value = p.price;
  $('description').value = p.description || p.description_ar || '';
  $('category').value = p.category || '';
  $('active').checked = p.is_active !== false;
  $('image').value = '';
  window.currentProductImage = p.image_url || null;

  $('colors-container').innerHTML = '';

  const { data, error } = await db.from('product_variants')
    .select('*')
    .eq('product_id', p.id);

  if (error) {
    message('form-message', 'تعذر تحميل مخزون المنتج: ' + error.message, true);
    return;
  }

  const savedColors = Array.isArray(p.colors) ? p.colors : [];

  if (data.length) {
    const names = [...new Set(data.map(v => v.color_name))];

    names.forEach(name => {
      const color = savedColors.find(c => c.name === name) || {};
      const rows = data.filter(v => v.color_name === name);

      addColorBlock({
        name,
        images: color.images || [],
        sizes: rows.map(v => ({ size: v.size, quantity: v.quantity }))
      });
    });
  } else {
    savedColors.forEach(c => addColorBlock({
      name: typeof c === 'string' ? c : c.name,
      images: c.images || [],
      sizes: [{ size: 'فري سايز', quantity: 0 }]
    }));
  }

  if (!$('colors-container').children.length) addColorBlock();

  window.scrollTo({ top: 0, behavior: 'smooth' });
  message('form-message', 'تعديل المنتج: ' + (p.name_ar || p.name || ''));
}

async function deleteProduct(id) {
  if (!confirm('هل تريد حذف هذا المنتج نهائياً؟')) return;

  const { error } = await db.from('products').delete().eq('id', id);

  if (error) {
    alert('تعذر الحذف: ' + error.message);
    return;
  }

  await loadProducts();
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

db.auth.onAuthStateChange(() => {
  setTimeout(showSession, 0);
});

resetForm();
showSession();

// LA Vine Promotions Management

const promotionForm = $('promotion-form');

if (promotionForm) {
  promotionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    message('promotion-message', 'جارٍ رفع العرض...');

    try {
      const { data: { user } } = await db.auth.getUser();

      if (!await isAdmin(user)) {
        throw new Error('ليس لديك صلاحية الإدارة.');
      }

      const file = $('promotion-image').files[0];

      if (!file) throw new Error('اختر صورة العرض.');

      if (file.type !== 'image/jpeg') {
        throw new Error('ارفع الصورة بصيغة JPG فقط.');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('حجم الصورة يجب ألا يتجاوز 5 MB.');
      }

      const path = `promotions/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadError } = await db.storage
        .from('product-images')
        .upload(path, file, {
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const imageUrl = db.storage
        .from('product-images')
        .getPublicUrl(path).data.publicUrl;

      const { error } = await db.from('promotions').insert({
        title: $('promotion-title').value.trim(),
        description: $('promotion-description').value.trim(),
        image_url: imageUrl,
        link_url: $('promotion-link').value.trim(),
        sort_order: Number($('promotion-order').value) || 0,
        is_active: $('promotion-active').checked
      });

      if (error) throw error;

      promotionForm.reset();
      $('promotion-order').value = 0;
      $('promotion-active').checked = true;

      message('promotion-message', 'تمت إضافة العرض بنجاح.');
      await loadPromotions();

    } catch (error) {
      message('promotion-message', 'تعذر إضافة العرض: ' + error.message, true);
    }
  });
}

async function loadPromotions() {
  const box = $('admin-promotions');
  if (!box) return;

  const { data, error } = await db.from('promotions')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    box.textContent = 'تعذر تحميل العروض: ' + error.message;
    return;
  }

  if (!data.length) {
    box.textContent = 'لا توجد عروض حالياً.';
    return;
  }

  box.innerHTML = data.map(p => `
    <article class="admin-product">
      <img src="${esc(p.image_url)}" alt="">
      <div>
        <h3>${esc(p.title)}</h3>
        <p>${p.is_active ? 'العرض مفعّل' : 'العرض متوقف'}</p>
      </div>
      <div class="admin-product-actions">
        <button type="button" data-promo-toggle="${esc(p.id)}" data-active="${p.is_active}">
          ${p.is_active ? 'إيقاف' : 'تفعيل'}
        </button>
        <button type="button" data-promo-delete="${esc(p.id)}">حذف</button>
      </div>
    </article>
  `).join('');

  box.querySelectorAll('[data-promo-toggle]').forEach(button => {
    button.addEventListener('click', async () => {
      const { error } = await db.from('promotions')
        .update({ is_active: button.dataset.active !== 'true' })
        .eq('id', button.dataset.promoToggle);

      if (error) {
        alert('تعذر تغيير حالة العرض: ' + error.message);
        return;
      }

      await loadPromotions();
    });
  });

  box.querySelectorAll('[data-promo-delete]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('هل تريد حذف هذا العرض؟')) return;

      const { error } = await db.from('promotions')
        .delete()
        .eq('id', button.dataset.promoDelete);

      if (error) {
        alert('تعذر حذف العرض: ' + error.message);
        return;
      }

      await loadPromotions();
    });
  });
}
