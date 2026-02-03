import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Item = {
  product_name: string;
  quantity: number;
  price: number;
};

type Sale = {
  id: string;
  folio: string;
  created_at: string;
  user_name: string;
  payment_method: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
};

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    if (!id) return;

    setLoading(true);

    const { data: saleData } = await supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .single();

    setSale(saleData);

    const { data: itemsData } = await supabase
      .from("sales_items")
      .select(`
        quantity,
        price,
        products (name)
      `)
      .eq("sale_id", id);

    const mapped =
      itemsData?.map((i: any) => ({
        product_name: i.products?.name,
        quantity: i.quantity,
        price: i.price,
      })) || [];

    setItems(mapped);
    setLoading(false);
  }

  function imprimir() {
    window.print();
  }

  if (loading) return <p>Cargando ticket...</p>;
  if (!sale) return <p>No encontrado</p>;

  return (
    <div className="max-w-xl mx-auto bg-white shadow rounded p-6 print:shadow-none print:p-0">
      
      {/* CABECERA */}
      <div className="text-center border-b pb-3 mb-3">
        <h2 className="text-xl font-bold">PUNTO CLARO</h2>
        <p className="text-sm text-gray-500">Ticket de venta</p>
      </div>

      {/* INFO GENERAL */}
      <div className="text-sm mb-4 space-y-1">
        <p><strong>Folio:</strong> {sale.folio}</p>
        <p><strong>Fecha:</strong> {new Date(sale.created_at).toLocaleString()}</p>
        <p><strong>Cajero:</strong> {sale.user_name}</p>
        <p><strong>Método:</strong> {sale.payment_method}</p>
      </div>

      {/* PRODUCTOS */}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="border-b">
            <th className="text-left">Producto</th>
            <th className="text-center">Cant</th>
            <th className="text-right">Precio</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>

        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b">
              <td>{it.product_name}</td>
              <td className="text-center">{it.quantity}</td>
              <td className="text-right">
                ${it.price.toFixed(2)}
              </td>
              <td className="text-right">
                ${(it.price * it.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALES */}
      <div className="text-right space-y-1 text-sm border-t pt-2">
        <p>Subtotal: ${sale.subtotal.toFixed(2)}</p>
        <p>Impuesto: ${sale.tax.toFixed(2)}</p>

        <p className="font-bold text-base">
          TOTAL: ${sale.total.toFixed(2)}
        </p>
      </div>

      {/* DESGLOSE DE PAGOS */}
      <div className="mt-3 text-sm border-t pt-2">
        <p className="font-semibold mb-1">Pagos:</p>

        {sale.payment_cash > 0 && (
          <p>Efectivo: ${sale.payment_cash.toFixed(2)}</p>
        )}

        {sale.payment_card > 0 && (
          <p>Tarjeta: ${sale.payment_card.toFixed(2)}</p>
        )}

        {sale.payment_usd > 0 && (
          <p>USD: ${sale.payment_usd.toFixed(2)}</p>
        )}
      </div>

      {/* PIE */}
      <div className="text-center text-xs text-gray-500 mt-4 border-t pt-3">
        <p>Gracias por su compra</p>
        <p>Conserve este ticket</p>
      </div>

      {/* BOTONES (NO SE IMPRIMEN) */}
      <div className="mt-4 flex gap-2 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="border px-3 py-2 rounded w-full"
        >
          Volver
        </button>

        <button
          onClick={imprimir}
          className="bg-gray-900 text-white px-3 py-2 rounded w-full"
        >
          Imprimir ticket
        </button>
      </div>

    </div>
  );
}
