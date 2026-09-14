-- ============================================================
-- Secciones dentro de un sprint
-- ------------------------------------------------------------
-- Una sección es un apsol_sprint_items más, marcado con es_seccion =
-- true: mismo `orden` que los puntos normales, así que arrastrar/
-- reordenar reutiliza toda la lógica existente (dnd-kit, flechitas).
-- La agrupación visual se calcula en el cliente (agruparPorSeccion en
-- sprints-utils.js): cada punto "pertenece" a la sección más cercana
-- que lo precede en el orden. Sin sección creada, se ve como antes
-- (lista plana) — no hace falta migrar sprints existentes.
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el 2026-09-14
-- vía MCP de Supabase, como migración `sprint_items_secciones`.
-- ============================================================

ALTER TABLE public.apsol_sprint_items
  ADD COLUMN IF NOT EXISTS es_seccion boolean NOT NULL DEFAULT false;
