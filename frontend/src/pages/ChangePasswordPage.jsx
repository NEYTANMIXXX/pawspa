import React, { useState } from 'react';
import toast from 'react-hot-toast';

import { supabase } from '../services/supabase';

export default function ChangePasswordPage() {

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (password.length < 8) {

      toast.error(
        'La contraseña debe tener mínimo 8 caracteres.'
      );

      return;
    }

    if (password !== confirmar) {

      toast.error(
        'Las contraseñas no coinciden.'
      );

      return;
    }

    setLoading(true);

    try {

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        throw error;
      }

      toast.success(
        'Contraseña actualizada correctamente.'
      );

      setPassword('');
      setConfirmar('');

    } catch (err) {

      toast.error(
        err.message || 'Error al cambiar contraseña.'
      );

    } finally {

      setLoading(false);

    }
  };

  return (

    <div className="card">

      <div className="card-header">
        <h2>
          🔑 Cambiar contraseña
        </h2>
      </div>

      <div className="card-body">

        <form onSubmit={handleSubmit}>

          <div className="form-group">

            <label className="form-label">
              Nueva contraseña
            </label>

            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

          </div>

          <div className="form-group">

            <label className="form-label">
              Confirmar contraseña
            </label>

            <input
              className="form-control"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="••••••••"
              required
            />

          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
          >

            {
              loading
                ? 'Actualizando...'
                : '💾 Guardar contraseña'
            }

          </button>

        </form>

      </div>

    </div>
  );
}