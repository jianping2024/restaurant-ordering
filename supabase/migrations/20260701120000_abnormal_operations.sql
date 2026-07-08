-- Abnormal operations audit log (discount, void item, unpaid table close). Owner read/update via RLS; inserts via service role only.

CREATE TABLE public.abnormal_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  type text NOT NULL,
  risk_level text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.table_sessions (id) ON DELETE SET NULL,
  table_id uuid REFERENCES public.restaurant_tables (id) ON DELETE SET NULL,
  table_name text,
  operator_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  operator_name text NOT NULL,
  operator_role text NOT NULL,
  amount_impact numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  reason_detail text,
  before_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_note text,
  confirmed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT abnormal_operations_type_check CHECK (
    type = ANY (
      ARRAY[
        'DISCOUNT_APPLIED'::text,
        'ITEM_DELETED'::text,
        'UNPAID_TABLE_CLOSED'::text
      ]
    )
  ),
  CONSTRAINT abnormal_operations_risk_level_check CHECK (
    risk_level = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text])
  ),
  CONSTRAINT abnormal_operations_status_check CHECK (
    status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'IGNORED'::text])
  ),
  CONSTRAINT abnormal_operations_amount_impact_nonneg CHECK (amount_impact >= 0)
);
CREATE INDEX idx_abnormal_operations_restaurant_created
  ON public.abnormal_operations (restaurant_id, created_at DESC);
CREATE INDEX idx_abnormal_operations_restaurant_status
  ON public.abnormal_operations (restaurant_id, status);
CREATE TRIGGER abnormal_operations_updated_at
  BEFORE UPDATE ON public.abnormal_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.abnormal_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY abnormal_operations_owner_select ON public.abnormal_operations
  FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY abnormal_operations_owner_update ON public.abnormal_operations
  FOR UPDATE TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
