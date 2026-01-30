import { useState } from 'react';

type Props = {
  role: 'admin' | 'gerente' | 'cajero' | null;
  onSelect: (view: string) => void;
};

function RoleMenu({ role, onSelect }: Props) {
  const [active, setActive] = useState<string | null>(null);

  if (!role) return null;

  const Item = ({ label }: { label: string }) => (
    <li
      onClick={() => {
        setActive(label);
        onSelect(label);
      }}
      style={{
        cursor: 'pointer',
        fontWeight: active === label ? 'bold' : 'normal',
      }}
    >
      {label}
    </li>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <strong>Menú</strong>

      {role === 'admin' && (
        <ul>
          <Item label="Dashboard" />
          <Item label="Usuarios" />
          <Item label="Inventario" />
          <Item label="Ventas" />
          <Item label="Configuración" />
        </ul>
      )}

      {role === 'gerente' && (
        <ul>
          <Item label="Dashboard" />
          <Item label="Inventario" />
          <Item label="Ventas" />
        </ul>
      )}

      {role === 'cajero' && (
        <ul>
          <Item label="Punto de Venta" />
          <Item label="Ventas del día" />
        </ul>
      )}
    </div>
  );
}

export default RoleMenu;
