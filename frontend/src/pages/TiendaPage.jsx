// ============================================================
// PawSpa — Tienda
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode.react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const formatMoney = (value) => `Bs. ${Number(value || 0).toFixed(2)}`;

const getVariantPrice = (producto, variante) => {
  const base = Number(producto?.precio_promocional ?? producto?.precio_venta ?? 0);
  const extra = Number(variante?.precio_extra ?? 0);
  return base + extra;
};

const getVariantStock = (producto, variante) => {
  if (variante) return Number(variante.stock || 0);
  return Number(producto?.stock_actual || 0);
};

const emptyForm = {
  id: null,
  categoria_id: '',
  nombre: '',
  descripcion: '',
  marca: '',
  codigo_barras: '',
  precio_compra: '',
  precio_venta: '',
  precio_promocional: '',
  stock_actual: 0,
  stock_minimo: 5,
  unidad_medida: 'unidad',
  imagen_url: '',
  activo: true,
};

const normalizeNumberField = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeIntField = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const leerArchivoComoDataUrl = (archivo) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(archivo);
});

const buildProductPayload = (form) => ({
  categoria_id: form.categoria_id || null,
  nombre: form.nombre.trim(),
  descripcion: form.descripcion.trim() || null,
  marca: form.marca.trim() || null,
  codigo_barras: form.codigo_barras.trim() || null,
  precio_compra: normalizeNumberField(form.precio_compra),
  precio_venta: normalizeNumberField(form.precio_venta) ?? 0,
  precio_promocional: normalizeNumberField(form.precio_promocional),
  stock_actual: normalizeIntField(form.stock_actual, 0),
  stock_minimo: normalizeIntField(form.stock_minimo, 5),
  unidad_medida: form.unidad_medida.trim() || 'unidad',
  imagen_url: form.imagen_url.trim() || null,
  activo: Boolean(form.activo),
});

export default function TiendaPage() {
  const { esAdmin, esRecepcion, usuario } = useAuth();
  const canManageProducts = esAdmin || esRecepcion;
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [pagoConfig, setPagoConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [variantSelection, setVariantSelection] = useState({});
  const [carrito, setCarrito] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [productForm, setProductForm] = useState(emptyForm);
  const [metodoCobro, setMetodoCobro] = useState('efectivo');
  const [qrForm, setQrForm] = useState({ qr_imagen_url: '', qr_descripcion: '' });
  const [qrSaving, setQrSaving] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [createdPedido, setCreatedPedido] = useState(null);
  const [createdPago, setCreatedPago] = useState(null);

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      setLoading(true);
      try {
        if (!mounted) return;

        const { data: productosData } = await api.get('/productos');
        if (!mounted) return;
        setProductos(productosData.data || []);

        try {
          const { data: categoriasData } = await api.get('/categorias');
          if (mounted) setCategorias(categoriasData.data || []);
        } catch (categoriasError) {
          console.warn('No se pudieron cargar las categorías de tienda:', categoriasError);
        }

        try {
          const { data: configData } = await api.get('/tienda/configuracion');
          if (mounted) {
            setPagoConfig(configData.data || null);
            setQrForm({
              qr_imagen_url: configData.data?.qr_imagen_url || '',
              qr_descripcion: configData.data?.qr_descripcion || '',
            });
          }
        } catch (configError) {
          console.warn('No se pudo cargar la configuración de cobro:', configError);
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'No se pudo cargar la tienda.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    cargar();
    return () => { mounted = false; };
  }, []);

  const recargarProductos = async () => {
    const { data } = await api.get('/productos');
    setProductos(data.data || []);
  };

  const recargarConfiguracionPago = async () => {
    const { data } = await api.get('/tienda/configuracion');
    setPagoConfig(data.data || null);
    setQrForm({
      qr_imagen_url: data.data?.qr_imagen_url || '',
      qr_descripcion: data.data?.qr_descripcion || '',
    });
  };

  const resetForm = () => {
    setProductForm(emptyForm);
    setFormError('');
    setFormOpen(false);
  };

  const abrirNuevoProducto = () => {
    setProductForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  const abrirEdicionProducto = (producto) => {
    setProductForm({
      id: producto.id,
      categoria_id: producto.categoria_id || '',
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      marca: producto.marca || '',
      codigo_barras: producto.codigo_barras || '',
      precio_compra: producto.precio_compra ?? '',
      precio_venta: producto.precio_venta ?? '',
      precio_promocional: producto.precio_promocional ?? '',
      stock_actual: producto.stock_actual ?? 0,
      stock_minimo: producto.stock_minimo ?? 5,
      unidad_medida: producto.unidad_medida || 'unidad',
      imagen_url: producto.imagen_url || '',
      activo: Boolean(producto.activo),
    });
    setFormError('');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const actualizarForm = (campo, valor) => {
    setProductForm((actual) => ({ ...actual, [campo]: valor }));
  };

  const actualizarQrForm = (campo, valor) => {
    setQrForm((actual) => ({ ...actual, [campo]: valor }));
  };

  const manejarImagenLocal = async (archivo) => {
    if (!archivo) return;
    try {
      const dataUrl = await leerArchivoComoDataUrl(archivo);
      actualizarForm('imagen_url', dataUrl);
      setFormError('');
    } catch (error) {
      setFormError('No se pudo leer la imagen seleccionada.');
    }
  };

  const manejarQrLocal = async (archivo) => {
    if (!archivo) return;
    try {
      const dataUrl = await leerArchivoComoDataUrl(archivo);
      actualizarQrForm('qr_imagen_url', dataUrl);
    } catch (error) {
      toast.error('No se pudo leer la imagen QR.');
    }
  };

  const guardarQrConfig = async (e) => {
    e.preventDefault();
    try {
      setQrSaving(true);
      const { data } = await api.put('/tienda/configuracion', {
        qr_imagen_url: qrForm.qr_imagen_url || null,
        qr_descripcion: qrForm.qr_descripcion || 'Escanea el QR para completar tu pago.',
      });
      setPagoConfig(data.data || null);
      toast.success('QR de cobro actualizado ✅');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo actualizar el QR.');
    } finally {
      setQrSaving(false);
    }
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!productForm.nombre.trim()) {
      setFormError('El nombre del producto es obligatorio.');
      return;
    }

    if (!productForm.categoria_id) {
      setFormError('Selecciona una categoría.');
      return;
    }

    if (normalizeNumberField(productForm.precio_venta) === null) {
      setFormError('El precio de venta es obligatorio.');
      return;
    }

    const payload = buildProductPayload(productForm);

    try {
      setFormSaving(true);
      if (productForm.id) {
        await api.put(`/productos/${productForm.id}`, payload);
        toast.success('Producto actualizado ✅');
      } else {
        await api.post('/productos', payload);
        toast.success('Producto creado ✅');
      }

      await recargarProductos();
      resetForm();
    } catch (err) {
      setFormError(err.response?.data?.error || 'No se pudo guardar el producto.');
      toast.error(err.response?.data?.error || 'No se pudo guardar el producto.');
    } finally {
      setFormSaving(false);
    }
  };

  const categoriaOptions = useMemo(() => categorias, [categorias]);

  const productosVisibles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return productos.filter((producto) => {
      const coincideCategoria = !categoria || producto.categoria?.id === categoria;
      const coincideTexto = !term
        || `${producto.nombre} ${producto.descripcion || ''} ${producto.marca || ''}`.toLowerCase().includes(term);
      return coincideCategoria && coincideTexto;
    });
  }, [productos, search, categoria]);

  const subtotal = useMemo(() => carrito.reduce((acc, item) => acc + item.precio_unitario * item.cantidad, 0), [carrito]);

  // Detect coupon from URL and prefill
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const c = params.get('coupon') || params.get('codigo');
      if (c) setCouponCode(c);
    } catch (e) {
      // ignore
    }
  }, []);

  // Auto-apply coupon when present and cart has items
  useEffect(() => {
    const tryApply = async () => {
      if (!couponCode || applyingCoupon || appliedPromo) return;
      if (!carrito.length || subtotal <= 0) return;
      try {
        setApplyingCoupon(true);
        const items = carrito.map(it => ({ product_id: it.producto_id, cantidad: it.cantidad, precio_unitario: it.precio_unitario }));
        const payload = { codigo: couponCode.trim(), cliente_id: usuario?.id || null, items, total: subtotal };
        const { data } = await api.post('/promociones/apply', payload);
        setAppliedPromo(data.promocion || null);
        setDiscountAmount(data.descuento || 0);
        toast.success('Promoción aplicada ✅');
      } catch (err) {
        toast.error(err.response?.data?.error || 'No se pudo aplicar la promoción.');
        setAppliedPromo(null);
        setDiscountAmount(0);
      } finally {
        setApplyingCoupon(false);
      }
    };
    tryApply();
  }, [couponCode, carrito, subtotal]);

  useEffect(() => {
    // invalidate applied promotion when cart changes
    setAppliedPromo(null);
    setDiscountAmount(0);
  }, [subtotal]);

  const totalConDescuento = useMemo(() => Math.max(0, subtotal - (Number(discountAmount) || 0)), [subtotal, discountAmount]);

  const mensajePedido = useMemo(() => {
    if (!carrito.length) return '';
    const lines = carrito.map((item) => {
      const variante = item.variante?.nombre ? ` (${item.variante.nombre})` : '';
      return `- ${item.nombre}${variante} x${item.cantidad} = ${formatMoney(item.precio_unitario * item.cantidad)}`;
    });

    return [
      'Hola, quisiera realizar este pedido en PawSpa:',
      '',
      ...lines,
      '',
      `Subtotal: ${formatMoney(subtotal)}`,
      '',
      'Quedo atento(a) para coordinar el pago y la entrega.',
    ].join('\n');
  }, [carrito, subtotal]);

  const agregarAlCarrito = (producto) => {
    const variantes = producto.variante_producto || [];
    const varianteId = variantSelection[producto.id] || variantes[0]?.id || null;
    const variante = variantes.find((item) => item.id === varianteId) || null;
    const stockDisponible = getVariantStock(producto, variante);

    if (stockDisponible <= 0) {
      toast.error('Este producto no tiene stock disponible.');
      return;
    }

    const key = `${producto.id}:${variante?.id || 'base'}`;
    const precioUnitario = getVariantPrice(producto, variante);

    setCarrito((actual) => {
      const existente = actual.find((item) => item.key === key);
      if (existente) {
        return actual.map((item) => {
          if (item.key !== key) return item;
          const siguienteCantidad = Math.min(item.cantidad + 1, stockDisponible);
          return { ...item, cantidad: siguienteCantidad };
        });
      }

      return [
        ...actual,
        {
          key,
          producto_id: producto.id,
          variante_id: variante?.id || null,
          nombre: producto.nombre,
          variante,
          cantidad: 1,
          precio_unitario: precioUnitario,
          stock_disponible: stockDisponible,
        },
      ];
    });

    toast.success('Agregado al carrito ✅');
  };

  const cambiarCantidad = (key, cantidad) => {
    const nuevaCantidad = Number(cantidad || 1);
    setCarrito((actual) => actual.map((item) => {
      if (item.key !== key) return item;
      const limite = Number(item.stock_disponible || 0);
      return { ...item, cantidad: Math.max(1, Math.min(nuevaCantidad, limite)) };
    }));
  };

  const eliminarItem = (key) => {
    setCarrito((actual) => actual.filter((item) => item.key !== key));
  };

  const abrirCompartir = (tipo) => {
    if (!carrito.length) {
      toast.error('Agrega productos al carrito primero.');
      return;
    }

    const text = encodeURIComponent(mensajePedido);
    const url = tipo === 'telegram'
      ? `https://t.me/share/url?url=${encodeURIComponent(window.location.origin + '/tienda')}&text=${text}`
      : `https://wa.me/?text=${text}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const crearPedido = async () => {
    if (!carrito.length) {
      toast.error('El carrito está vacío.');
      return;
    }

    try {
      setCreatingOrder(true);
      const items = carrito.map(it => ({ producto_id: it.producto_id, variante_id: it.variante_id, cantidad: it.cantidad, precio_unitario: it.precio_unitario }));
      const payload = {
        items,
        subtotal,
        descuento: Number(discountAmount || 0),
        impuestos: 0,
        total: totalConDescuento,
        notas: '',
        crear_pago: true,
        payment: { tipo_pago: metodoCobro, estado: 'pagado' },
        promocion_id: appliedPromo?.id || null,
        promocion_codigo: appliedPromo?.codigo || null,
      };

      const { data } = await api.post('/tienda/pedidos', payload);
      const respPedido = data.data?.pedido || data.data?.pedido || data.pedido || data.data;
      const respPago = data.data?.pago || data.pago;
      setCreatedPedido(respPedido || data.data?.pedido || data.data);
      setCreatedPago(respPago || null);
      setCarrito([]);
      setAppliedPromo(null);
      setCouponCode('');
      setDiscountAmount(0);
      toast.success('Pedido creado y pago registrado ✅');
    } catch (err) {
      console.error('crearPedido error', err);
      toast.error(err.response?.data?.error || 'No se pudo crear el pedido.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const qrFallback = useMemo(() => `PAWSPA-TIENDA-${new Date().getFullYear()}-${carrito.length}`, [carrito.length]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛍️ Tienda</h1>
          <p className="page-subtitle">Compra productos, arma tu carrito y comparte el pedido por WhatsApp o Telegram.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {productosVisibles.length} producto(s)
          </div>
          {canManageProducts ? (
            <button className="btn btn-primary btn-sm" onClick={abrirNuevoProducto}>+ Nuevo producto</button>
          ) : null}
        </div>
      </div>

      {canManageProducts ? (
        <div className="card" style={{ marginBottom: 18, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'Sora,sans-serif' }}>{productForm.id ? 'Editar producto' : 'Nuevo producto'}</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Administra catálogo, precios y stock desde la misma tienda.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setFormOpen((value) => !value)}>
              {formOpen ? 'Ocultar formulario' : 'Mostrar formulario'}
            </button>
          </div>

          {formOpen ? (
            <form onSubmit={guardarProducto} style={{ display: 'grid', gap: 12 }}>
              {formError ? (
                <div style={{ padding: 12, borderRadius: 12, background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                  {formError}
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label">Nombre</label>
                  <input className="form-control" value={productForm.nombre} onChange={(e) => actualizarForm('nombre', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Categoría</label>
                  <select className="form-control" value={productForm.categoria_id} onChange={(e) => actualizarForm('categoria_id', e.target.value)}>
                    <option value="">Selecciona una categoría</option>
                    {categoriaOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label">Marca</label>
                  <input className="form-control" value={productForm.marca} onChange={(e) => actualizarForm('marca', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Código de barras</label>
                  <input className="form-control" value={productForm.codigo_barras} onChange={(e) => actualizarForm('codigo_barras', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="form-label">Descripción</label>
                <textarea className="form-control" rows="3" value={productForm.descripcion} onChange={(e) => actualizarForm('descripcion', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label">Precio compra</label>
                  <input className="form-control" type="number" min="0" step="0.01" value={productForm.precio_compra} onChange={(e) => actualizarForm('precio_compra', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Precio venta</label>
                  <input className="form-control" type="number" min="0" step="0.01" value={productForm.precio_venta} onChange={(e) => actualizarForm('precio_venta', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Precio promo</label>
                  <input className="form-control" type="number" min="0" step="0.01" value={productForm.precio_promocional} onChange={(e) => actualizarForm('precio_promocional', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Unidad</label>
                  <input className="form-control" value={productForm.unidad_medida} onChange={(e) => actualizarForm('unidad_medida', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label">Stock actual</label>
                  <input className="form-control" type="number" min="0" value={productForm.stock_actual} onChange={(e) => actualizarForm('stock_actual', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Stock mínimo</label>
                  <input className="form-control" type="number" min="0" value={productForm.stock_minimo} onChange={(e) => actualizarForm('stock_minimo', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Imagen desde el computador</label>
                  <input className="form-control" type="file" accept="image/*" onChange={(e) => manejarImagenLocal(e.target.files?.[0] || null)} />
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Se guarda como imagen interna del producto.</div>
                </div>
                <div>
                  <label className="form-label">Imagen URL (opcional)</label>
                  <input className="form-control" value={productForm.imagen_url} onChange={(e) => actualizarForm('imagen_url', e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input type="checkbox" checked={productForm.activo} onChange={(e) => actualizarForm('activo', e.target.checked)} />
                    Activo
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {productForm.id ? (
                  <button type="button" className="btn btn-secondary" onClick={abrirNuevoProducto}>Nuevo producto</button>
                ) : null}
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={formSaving}>
                  {formSaving ? 'Guardando...' : (productForm.id ? 'Actualizar producto' : 'Crear producto')}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Activa el formulario para crear o editar productos.</div>
          )}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 18, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
          <input
            className="form-control"
            placeholder="Buscar productos, marcas o descripciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((item) => (
              <option key={item.id} value={item.id}>{item.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(300px, 0.9fr)', gap: 18, alignItems: 'start' }}>
        <div>
          {loading ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>Cargando tienda...</div>
          ) : productosVisibles.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🛒</div>No hay productos para mostrar.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {productosVisibles.map((producto) => {
                const variantes = producto.variante_producto || [];
                const selectedVariantId = variantSelection[producto.id] || variantes[0]?.id || '';
                const selectedVariant = variantes.find((item) => item.id === selectedVariantId) || null;
                const precio = getVariantPrice(producto, selectedVariant);
                const stock = getVariantStock(producto, selectedVariant);

                return (
                  <div key={producto.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', minHeight: 160 }}>
                      {producto.imagen_url ? (
                        <img src={producto.imagen_url} alt={producto.nombre} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '2rem' }}>🧴</div>
                      )}
                      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">{producto.categoria?.nombre || 'Sin categoría'}</span>
                        {producto.precio_promocional ? <span className="badge badge-green">Promo</span> : null}
                      </div>
                      {canManageProducts ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ position: 'absolute', top: 10, right: 10 }}
                          onClick={() => abrirEdicionProducto(producto)}
                        >
                          ✎ Editar
                        </button>
                      ) : null}
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>{producto.nombre}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>{producto.descripcion || 'Sin descripción.'}</div>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      {variantes.length > 0 && (
                        <select
                          className="form-control"
                          value={selectedVariantId}
                          onChange={(e) => setVariantSelection((actual) => ({ ...actual, [producto.id]: e.target.value }))}
                        >
                          {variantes.map((variante) => (
                            <option key={variante.id} value={variante.id}>
                              {variante.nombre} {variante.precio_extra ? `(+${formatMoney(variante.precio_extra)})` : ''}
                            </option>
                          ))}
                        </select>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Precio</div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand)' }}>{formatMoney(precio)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Stock</div>
                          <div style={{ fontWeight: 700 }}>{stock}</div>
                        </div>
                      </div>

                      <button className="btn btn-primary" onClick={() => agregarAlCarrito(producto)} disabled={stock <= 0}>
                        Agregar al carrito
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16, position: 'sticky', top: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'Sora,sans-serif' }}>Carrito</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{carrito.length} item(s)</div>
            </div>
            <div style={{ fontWeight: 800, color: 'var(--brand)' }}>{formatMoney(subtotal)}</div>
          </div>

          {carrito.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Todavía no agregaste productos.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {carrito.map((item) => (
                <div key={item.key} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg-input)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.nombre}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.variante?.nombre || 'Sin variante'}</div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => eliminarItem(item.key)}>✕</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10, alignItems: 'center' }}>
                    <input
                      className="form-control"
                      type="number"
                      min="1"
                      max={item.stock_disponible}
                      value={item.cantidad}
                      onChange={(e) => cambiarCantidad(item.key, e.target.value)}
                    />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Subtotal</div>
                      <div style={{ fontWeight: 800 }}>{formatMoney(item.precio_unitario * item.cantidad)}</div>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-control" placeholder="Código promocional" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
                    <button className="btn btn-secondary" disabled={applyingCoupon || !couponCode} onClick={async () => {
                      try {
                        setApplyingCoupon(true);
                        const items = carrito.map(it => ({ product_id: it.producto_id, cantidad: it.cantidad, precio_unitario: it.precio_unitario }));
                        const payload = { codigo: couponCode.trim(), cliente_id: usuario?.id || null, items, total: subtotal };
                        const { data } = await api.post('/promociones/apply', payload);
                        setAppliedPromo(data.promocion || null);
                        setDiscountAmount(data.descuento || 0);
                        toast.success('Promoción aplicada ✅');
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'No se pudo aplicar la promoción.');
                        setAppliedPromo(null);
                        setDiscountAmount(0);
                      } finally {
                        setApplyingCoupon(false);
                      }
                    }}>{applyingCoupon ? 'Aplicando...' : 'Aplicar'}</button>
                    {appliedPromo ? (
                      <button className="btn btn-danger" onClick={() => { setAppliedPromo(null); setDiscountAmount(0); setCouponCode(''); }}>Quitar</button>
                    ) : null}
                  </div>

                  {appliedPromo ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        <strong>{appliedPromo.nombre}</strong>
                        <div style={{ color: 'var(--text-muted)' }}>{appliedPromo.codigo}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--brand)' }}>- {formatMoney(discountAmount)}</div>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total</span>
                    <strong>{formatMoney(totalConDescuento)}</strong>
                  </div>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg-input)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Punto de cobro</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                    {[
                      { value: 'efectivo', icon: '💵', label: 'Efectivo' },
                      { value: 'qr', icon: '📱', label: 'QR' },
                      { value: 'transferencia', icon: '🏦', label: 'Transferencia' },
                      { value: 'otros', icon: '💳', label: 'Otros' },
                    ].map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMetodoCobro(item.value)}
                        style={{
                          borderColor: metodoCobro === item.value ? 'var(--brand)' : 'var(--border)',
                          background: metodoCobro === item.value ? 'rgba(0,0,0,0.08)' : undefined,
                        }}
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>

                  {metodoCobro === 'efectivo' && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Cobro en caja con confirmación manual.
                    </div>
                  )}

                  {metodoCobro === 'transferencia' && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Transferencia bancaria. Se puede validar con comprobante.
                    </div>
                  )}

                  {metodoCobro === 'otros' && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Otro medio acordado con el cliente.
                    </div>
                  )}

                  {metodoCobro === 'qr' && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {pagoConfig?.qr_imagen_url ? (
                        <img
                          src={pagoConfig.qr_imagen_url}
                          alt="QR de cobro"
                          style={{ width: '100%', maxWidth: 260, margin: '0 auto', borderRadius: 12, background: '#fff', padding: 10, objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ background: '#fff', width: 'fit-content', margin: '0 auto', padding: 10, borderRadius: 12 }}>
                          <QRCode value={qrFallback} size={200} level="H" includeMargin />
                        </div>
                      )}
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {pagoConfig?.qr_descripcion || 'Escanea el QR para completar el pago.'}
                      </div>
                    </div>
                  )}

                  {canManageProducts && (
                    <form onSubmit={guardarQrConfig} style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>QR administrable</div>
                      <input
                        className="form-control"
                        type="file"
                        accept="image/*"
                        onChange={(e) => manejarQrLocal(e.target.files?.[0] || null)}
                      />
                      <input
                        className="form-control"
                        placeholder="Texto para mostrar junto al QR"
                        value={qrForm.qr_descripcion}
                        onChange={(e) => actualizarQrForm('qr_descripcion', e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={recargarConfiguracionPago}>Recargar</button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={qrSaving}>{qrSaving ? 'Guardando...' : 'Guardar QR'}</button>
                      </div>
                    </form>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => abrirCompartir('whatsapp')}>Enviar por WhatsApp</button>
                  <button className="btn btn-secondary" onClick={() => abrirCompartir('telegram')}>Enviar por Telegram</button>
                  <button className="btn btn-success" disabled={creatingOrder || carrito.length === 0} onClick={crearPedido}>
                    {creatingOrder ? 'Procesando...' : 'Confirmar y pagar'}
                  </button>
                </div>

                {createdPedido ? (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div style={{ fontWeight: 800 }}>Pedido creado</div>
                    <div style={{ color: 'var(--text-muted)' }}>ID: {createdPedido.id || createdPedido}</div>
                    {createdPago ? <div style={{ marginTop: 6 }}>Pago: {createdPago.id}</div> : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}