-- Diferencia comissão Fernando por tipo de produto Azul: normais, seguros e consórcios

ALTER TABLE internal_commissions ADD COLUMN IF NOT EXISTS azul_normal_revenue    DECIMAL(10,2) DEFAULT 0;
ALTER TABLE internal_commissions ADD COLUMN IF NOT EXISTS azul_normal_commission  DECIMAL(10,2) DEFAULT 0;

ALTER TABLE internal_commissions ADD COLUMN IF NOT EXISTS seguros_data            JSONB         DEFAULT '[]';
ALTER TABLE internal_commissions ADD COLUMN IF NOT EXISTS seguros_total_revenue   DECIMAL(10,2) DEFAULT 0;
ALTER TABLE internal_commissions ADD COLUMN IF NOT EXISTS seguros_commission      DECIMAL(10,2) DEFAULT 0;

ALTER TABLE internal_commissions ADD COLUMN IF NOT EXISTS consorcios_revenue      DECIMAL(10,2) DEFAULT 0;
ALTER TABLE internal_commissions ADD COLUMN IF NOT EXISTS consorcios_commission   DECIMAL(10,2) DEFAULT 0;

-- Retroativamente preenche azul_normal_revenue/commission com o valor legado
UPDATE internal_commissions
  SET azul_normal_revenue   = azul_revenue,
      azul_normal_commission = azul_commission
  WHERE azul_normal_revenue = 0 AND azul_revenue > 0;
