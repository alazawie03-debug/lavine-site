
const db = window.supabase.createClient(
  window.LAVINE_SUPABASE_URL,
  window.LAVINE_SUPABASE_KEY
);

const container = document.getElementById('product-details');
const productId = new URLSearchParams(window.location.search).get('id');

let selectedColor = '';
let selectedSize = '';

async function loadProduct() {
  if (!productId) {
    container.textContent = 'المنتج غير موجود';
    return;
  }

  const { data: product, error } = await db
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    container.textContent = 'تعذر العثور على المنتج';
    return;
  }

  const colors = Array.isArray(product.colors) ? product.colors : [];

  container.innerHTML = `
    <div class="product-detail-card">
      <div class="product-detail-image" id="detail-image">
        ${product.image_url
          ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">`
          : '<span>LA VINE</span>'}
      </div>

      <div class="product-detail-info">
        <h1>${escapeHtml(product.name)}</h1>
        <strong class="detail-price">
          ${Number(product.price).toLocaleString('en-US')} د.ع
        </strong>

        <p>${escapeHtml(product.description || '')}</p>

        ${colors.length ? `
          <label>اختاري اللون</label>
          <div class="detail-colors">
            ${colors.map((color, index) => `
              <button type="button" class="detail-color"
                data-index="${index}">
                ${escapeHtml(color.name)}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div id="detail-sizes"></div>
        <p id="detail-stock"></p>

        <a id="detail-whatsapp" class="product-link" href="https://wa.me/9647744040441" target="_blank">
          اطلبي عبر واتساب
        </a>
      </div>
    </div>
  `;

  document.querySelectorAll('.detail-color').forEach(button => {
    button.addEventListener('click', () => {
      const color = colors[Number(button.dataset.index)];
      selectedColor = color.name;
      selectedSize = '';

      document.querySelectorAll('.detail-color').forEach(item => {
        item.classList.toggle('active', item === button);
      });

      const images = Array.isArray(color.images) ? color.images : [];

      if (images.length) {
        document.getElementById('detail-image').innerHTML = `
          <img src="${escapeHtml(images[0])}" alt="${escapeHtml(color.name)}">
        `;
      }

      loadSizes(product, color);
    });
  });

  if (colors.length) {
    document.querySelector('.detail-color')?.click();
  } else {
    loadSizes(product, null);
  }

  updateWhatsApp(product);
}

async function loadSizes(product, color) {
  const sizesBox = document.getElementById('detail-sizes');
  const stockText = document.getElementById('detail-stock');

  sizesBox.innerHTML = '';
  stockText.textContent = '';

  const { data, error } = await db
    .from('product_variants')
    .select('size, quantity')
    .eq('product_id', product.id)
    .eq('color_name', color?.name || '')
    .gt('quantity', 0);

if (error) {
  console.error('Stock Error:', error);
  stockText.textContent = 'سبب المشكلة: ' + error.message;
  return;
}

  if (!data?.length) {
    stockText.textContent = 'غير متوفر حالياً';
    return;
  }

  sizesBox.innerHTML = `
    <label>اختاري المقاس</label>
    <div class="detail-sizes">
      ${data.map((item, index) => `
        <button type="button" class="detail-size"
          data-index="${index}">
          ${escapeHtml(item.size)}
        </button>
      `).join('')}
    </div>
  `;

  sizesBox.querySelectorAll('.detail-size').forEach(button => {
    button.addEventListener('click', () => {
      const item = data[Number(button.dataset.index)];
      selectedSize = item.size;

      sizesBox.querySelectorAll('.detail-size').forEach(sizeButton => {
        sizeButton.classList.toggle('active', sizeButton === button);
      });

      stockText.textContent = `الكمية المتوفرة: ${item.quantity} قطعة`;
      updateWhatsApp(product);
    });
  });
}

function updateWhatsApp(product) {
  const message = [
    'مرحباً، أرغب بطلب:',
    product.name,
    selectedColor ? 'اللون: ' + selectedColor : '',
    selectedSize ? 'المقاس: ' + selectedSize : '',
    'السعر: ' + Number(product.price).toLocaleString('en-US') + ' د.ع'
  ].filter(Boolean).join(' | ');

  document.getElementById('detail-whatsapp').href =
    'https://wa.me/9647744040441?text=' + encodeURIComponent(message);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

loadProduct();
