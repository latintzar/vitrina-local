/**
 * QuoteCanvas — Read-only quote display component.
 *
 * Stub placeholder — the full implementation was removed during the
 * MyProject tracking page rewrite. Components that import QuoteCanvas
 * should migrate to inline rendering or a new component.
 */

interface QuoteCanvasProps {
  scope: Record<string, unknown> | null;
}

export default function QuoteCanvas({ scope }: QuoteCanvasProps) {
  if (!scope) {
    return <div className="p-6 text-center text-stone text-sm">No quote data</div>;
  }

  const title = (scope.title as string) || 'Quote';
  const lineItems = (scope.line_items as Array<{ description?: string; amount?: number }>) || [];
  const total = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0);
  const materialsUpfront = (scope.materials_upfront as number) || 0;
  const feePercent = (scope.service_fee_percent as number) || 5;
  const feeAmount = total * feePercent / 100;
  const grandTotal = total + materialsUpfront + feeAmount;

  return (
    <div className="bg-white rounded-sm border border-border p-5 space-y-4">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>

      {lineItems.length > 0 && (
        <div className="space-y-2">
          {lineItems.map((li, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-stone">{li.description || `Fase ${i + 1}`}</span>
              <span className="font-medium text-ink">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(li.amount || 0)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-3 flex justify-between text-sm font-semibold">
        <span className="text-ink">Total</span>
        <span className="text-ink">
          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotal)}
        </span>
      </div>
    </div>
  );
}
