// ============================================================
// PawSpa — Administración de Descuentos (porcentaje)
// ============================================================
import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const empty = { id: null, nombre: '', codigo: '', valor: 10, fecha_inicio: '', fecha_fin: '', activo: true, uso_max: null, uso_por_cliente: 1 };

export default function DescuentosPage() {
  const [descuentos, setDescuentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/descuentos');
      setDescuentos(data.data || []);
    } catch (e) {
      toast.error('No se pudieron cargar los descuentos');
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.nombre) return toast.error('Nombre requerido');
      if (!payload.codigo) return toast.error('Código requerido');
      if (payload.id) {
        const { data } = await api.put(`/descuentos/${payload.id}`, payload);
        toast.success('Descuento actualizado ✅');
      } else {
        const { data } = await api.post('/descuentos', payload);
        toast.success('Descuento creado ✅');
      }
      setForm(empty);
      await cargar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const editar = (d) => setForm({ ...d });

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">🎟️ Descuentos</h1><p className="page-subtitle">Crear y administrar códigos de descuento (porcentaje)</p></div></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div className="card">
          <h3>Lista de descuentos</h3>
          {loading ? <div className="empty-state">Cargando...</div> : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Nombre</th><th>Código</th><th>Valor</th><th>Activo</th><th>Acciones</th></tr></thead>
                <tbody>
                  {descuentos.map(d => (
                    <tr key={d.id}>
                      <td>{d.nombre}</td>
                      <td><code style={{ background: 'transparent' }}>{d.codigo}</code></td>
                      <td>{d.tipo === 'porcentaje' ? `${d.valor}%` : d.valor}</td>
                      <td>{d.activo ? 'Sí' : 'No'}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-tertiary" onClick={() => editar(d)}>✏️ Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>{form.id ? 'Editar' : 'Nuevo'} descuento</h3>
          <form onSubmit={guardar}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-control" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-control" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Valor (%)</label>
              <input className="form-control" type="number" min="0" max="100" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha inicio</label>
              <input className="form-control" type="datetime-local" value={form.fecha_inicio ? form.fecha_inicio.substring(0,16) : ''} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha fin</label>
              <input className="form-control" type="datetime-local" value={form.fecha_fin ? form.fecha_fin.substring(0,16) : ''} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Uso máximo (opcional)</label>
              <input className="form-control" type="number" min="0" value={form.uso_max || ''} onChange={e => setForm(f => ({ ...f, uso_max: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ marginRight: 8 }}>Activo</label>
              <input type="checkbox" checked={Boolean(form.activo)} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : form.id ? 'Actualizar' : 'Crear'}</button>
              <button type="button" className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => setForm(empty)}>Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
