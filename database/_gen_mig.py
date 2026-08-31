# -*- coding: utf-8 -*-
import openpyxl, datetime, re
XL = r'C:\Users\Adrian\Downloads\Apsol App (1).xlsx'
wb = openpyxl.load_workbook(XL, read_only=True, data_only=True)

def rows_of(s):
    ws = wb[s]; rr = list(ws.iter_rows(values_only=True)); h = [str(x) for x in rr[0]]
    return [{h[i]: (r[i] if i < len(r) else None) for i in range(len(h))}
            for r in rr[1:] if r and r[0] is not None and str(r[0]).strip() != '']

def S(v):
    if v is None: return 'NULL'
    s = str(v).replace("\r", " ").replace("\n", " ")
    return 'NULL' if s.strip() == '' else "'" + s.replace("'", "''") + "'"

def N(v):
    if v is None or str(v).strip() in ('', '-', '--', 'None'): return 'NULL'
    try: return repr(round(float(str(v).replace(',', '')), 4))
    except Exception: return 'NULL'

def D(v):
    if v is None: return 'NULL'
    if isinstance(v, (datetime.datetime, datetime.date)): return "'" + v.strftime('%Y-%m-%d') + "'"
    s = str(v).strip().split(' ')[0]
    return "'" + s + "'" if re.match(r'^\d{4}-\d{2}-\d{2}$', s) else 'NULL'

def BL(v): return 'true' if str(v).strip().lower() == 'true' else 'false'

def U(v):
    if v is None: return 'NULL'
    s = str(v).strip()
    if re.match(r'^[0-9a-fA-F]{8}$', s): return "'" + s.lower() + "-0000-0000-0000-000000000000'::uuid"
    m = re.match(r'^(\d+)(\.0)?$', s)
    return "'00000000-0000-0000-0000-" + m.group(1).zfill(12) + "'::uuid" if m else 'NULL'

def NF(v):
    if v is None: return 'NULL'
    s = str(v).strip()
    if s.endswith('.0'): s = s[:-2]
    return 'NULL' if s in ('', '-', '--', 'None') else "'" + s.replace("'", "''") + "'"

COL = {'1': '38c0cb8a-7e91-443c-8fe4-d16761fed135',
       '2': '00000000-0000-0000-0000-000000000002',
       '4': '00000000-0000-0000-0000-000000000004',
       '405b60ad': '405b60ad-0000-0000-0000-000000000000',
       'db304dbc': 'db304dbc-0000-0000-0000-000000000000',
       '3': '00000003-0000-0000-0000-000000000000',
       'b2e3d434': 'b2e3d434-0000-0000-0000-000000000000',
       'f927515a': 'f927515a-0000-0000-0000-000000000000'}

def COLID(v):
    s = str(v).strip()
    if s.endswith('.0'): s = s[:-2]
    return "'" + COL[s] + "'::uuid" if s in COL else 'NULL'

def CEST(v):
    e = (str(v).strip() if v else '')
    return "'Activo'" if e not in ('Activo', 'Inactivo') else "'" + e + "'"

F = rows_of('Facturaci\u00f3n'); P = rows_of('Pagos')
FC = rows_of('Facturas Colaboradores'); CC = rows_of('Contrato Colaboradores')

o = []
def w(x): o.append(x)

w("-- ============================================================================")
w("-- RECONCILIACION FACTURACION -> espejo exacto de la hoja 'Apsol App'")
w("-- Correr COMPLETO en el SQL Editor de Supabase (proyecto kursvmadozcqxoaeaccd).")
w("-- Una sola transaccion. Si la verificacion final no cuadra: ROLLBACK automatico.")
w("-- Doc: database/RECONCILIACION_FACTURACION.md")
w("-- ============================================================================")
w("BEGIN;")
w("")
w("ALTER TABLE apsol_private.facturacion ADD COLUMN IF NOT EXISTS hs_facturadas numeric;")
w("DROP VIEW IF EXISTS public.apsol_facturacion;")
w("CREATE VIEW public.apsol_facturacion WITH (security_invoker = true) AS SELECT * FROM apsol_private.facturacion;")
w("GRANT SELECT,INSERT,UPDATE,DELETE,REFERENCES,TRIGGER,TRUNCATE ON public.apsol_facturacion TO anon,authenticated,service_role;")
w("")
w("-- backups datados (revertibles con INSERT ... SELECT desde zz_bkp_*)")
for t in ['facturacion', 'pagos', 'facturas_colaboradores', 'contratos', 'colaboradores']:
    w("DROP TABLE IF EXISTS apsol_private.zz_bkp_%s_20260828;" % t)
    w("CREATE TABLE apsol_private.zz_bkp_%s_20260828 AS SELECT * FROM apsol_private.%s;" % (t, t))
w("")
w("CREATE TEMP TABLE stg_fact(sid text primary key,fecha date,monto numeric,pdesde date,phasta date,c1 uuid,c2 uuid,prox date,ult date,soloinv boolean,fac1 text,nrofac text,doc text,obs text,prospecto uuid,hs numeric,leyenda text,descuento numeric) ON COMMIT DROP;")
w("CREATE TEMP TABLE stg_pago(fac uuid,fecha date,monto numeric,obs text) ON COMMIT DROP;")
w("CREATE TEMP TABLE stg_fcol(colab uuid,fid uuid,fecha date,nro text,monto numeric,arch text,fpago date,comp text) ON COMMIT DROP;")
w("CREATE TEMP TABLE stg_contr(cid uuid,colab uuid,tipo text,fini date,ffin date,dias numeric,tipohon text,hon numeric,adj text,adj2 text,estado text) ON COMMIT DROP;")
w("")

def block(header, rows, per=100):
    for i in range(0, len(rows), per):
        w(header + " " + ",".join(rows[i:i+per]) + ";")

block("INSERT INTO stg_fact(sid,fecha,monto,pdesde,phasta,c1,c2,prox,ult,soloinv,fac1,nrofac,doc,obs,prospecto,hs,leyenda,descuento) VALUES",
      ["(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)" % (
          S(r['Id_facturaci\u00f3n']), D(r['Fecha']), N(r['Monto']), D(r['Desde']), D(r['Hasta']),
          U(r['Contacto 1']), U(r['Contacto 2']), D(r['Proxima notificaci\u00f3n']), D(r['Ultima notificaci\u00f3n']),
          BL(r['Solo Invoice?']), S(r['FACTURA 1']), NF(r['N\u00b0 de factura']), S(r['DOCUMENTO']), S(r['Observaciones']),
          U(r['Prospecto']), N(r['hs facturadas']), S(r['Leyenda Factura']), N(r['Descuento'])) for r in F])
block("INSERT INTO stg_pago(fac,fecha,monto,obs) VALUES",
      ["(%s,%s,%s,%s)" % (U(r['Id facturaci\u00f3n']), D(r['Fecha']), N(r['Pago']), S(r['Observaciones'])) for r in P])
block("INSERT INTO stg_fcol(colab,fid,fecha,nro,monto,arch,fpago,comp) VALUES",
      ["(%s,%s,%s,%s,%s,%s,%s,%s)" % (
          COLID(r['Id Colaborador']), U(r['ID factura']), D(r['Fecha factura']), NF(r['Nro de Factura']),
          N(r['Monto']), S(r['Factura']), D(r['Fecha de Pago']), S(r['Comprobante de pago'])) for r in FC])
block("INSERT INTO stg_contr(cid,colab,tipo,fini,ffin,dias,tipohon,hon,adj,adj2,estado) VALUES",
      ["(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)" % (
          U(r['Id contrato']), COLID(r['Id Colaborador']), S(r['Tipo de contrato']), D(r['Fecha Inicio']),
          D(r['Fecha Fin']), N(r['D\u00edas libres por mes de trabajo']), S(r['Tipo de honorarios']),
          N(r['Honorarios']), S(r['Adjunto']), S(r['Adjunto 2']), CEST(r['Estado'])) for r in CC])
w("")
w("-- ===== FACTURACION: espejo =====")
w("-- NOTA: prospecto_id / contacto_cobro_id / contacto_cobro2_id NO se tocan en el UPDATE.")
w("-- El sheet solo tiene los ids hex viejos; la DB ya resolvio esas FKs en la import original")
w("-- (0 huerfanos). Solo se escriben los campos que el sheet manda de verdad.")
w("DELETE FROM apsol_private.pagos WHERE facturacion_id NOT IN (SELECT (sid||'-0000-0000-0000-000000000000')::uuid FROM stg_fact);")
w("DELETE FROM apsol_private.facturacion WHERE id NOT IN (SELECT (sid||'-0000-0000-0000-000000000000')::uuid FROM stg_fact);")
w("UPDATE apsol_private.facturacion f SET")
w("  fecha_emision=s.fecha, monto=s.monto, periodo_desde=s.pdesde, periodo_hasta=s.phasta,")
w("  proxima_notificacion=s.prox, ultima_notificacion=s.ult, solo_invoice=s.soloinv,")
w("  archivo_factura=s.fac1, numero_factura=s.nrofac, documento_general=s.doc,")
w("  notas=s.obs, leyenda=s.leyenda, porcentaje_descuento=COALESCE(s.descuento,0), hs_facturadas=s.hs")
w("FROM stg_fact s WHERE f.id=(s.sid||'-0000-0000-0000-000000000000')::uuid;")
w("-- INSERT de facturas del sheet que no existan en la DB (FKs con guarda EXISTS -> si no resuelve, NULL)")
w("INSERT INTO apsol_private.facturacion")
w(" (id,fecha_emision,monto,periodo_desde,periodo_hasta,contacto_cobro_id,contacto_cobro2_id,prospecto_id,")
w("  proxima_notificacion,ultima_notificacion,solo_invoice,archivo_factura,numero_factura,documento_general,")
w("  notas,leyenda,porcentaje_descuento,hs_facturadas)")
w("SELECT (s.sid||'-0000-0000-0000-000000000000')::uuid,s.fecha,s.monto,s.pdesde,s.phasta,")
w("  (SELECT c.id FROM apsol_private.contactos c WHERE c.id=s.c1),")
w("  (SELECT c.id FROM apsol_private.contactos c WHERE c.id=s.c2),")
w("  (SELECT p.id FROM apsol_private.prospectos p WHERE p.id=s.prospecto),")
w("  s.prox,s.ult,s.soloinv,s.fac1,s.nrofac,s.doc,s.obs,s.leyenda,COALESCE(s.descuento,0),s.hs")
w("FROM stg_fact s")
w("WHERE NOT EXISTS (SELECT 1 FROM apsol_private.facturacion f WHERE f.id=(s.sid||'-0000-0000-0000-000000000000')::uuid);")
w("")
w("-- ===== PAGOS: recarga total desde la hoja (espejo exacto) =====")
w("DELETE FROM apsol_private.pagos;")
w("INSERT INTO apsol_private.pagos(id,facturacion_id,fecha,monto,observaciones)")
w("SELECT gen_random_uuid(),s.fac,s.fecha,s.monto,s.obs FROM stg_pago s")
w("WHERE EXISTS (SELECT 1 FROM apsol_private.facturacion f WHERE f.id=s.fac);")
w("")
w("-- ===== colaboradores placeholder (ids del sheet sin identificar: 3, b2e3d434, f927515a) =====")
w("INSERT INTO apsol_private.colaboradores(id,nombre_manual,apellido_manual,puesto,estado) VALUES")
w("  ('00000003-0000-0000-0000-000000000000','(sheet id 3)','','Sin identificar - conciliar','Inactivo'),")
w("  ('b2e3d434-0000-0000-0000-000000000000','(sheet id b2e3d434)','','Sin identificar - conciliar','Inactivo'),")
w("  ('f927515a-0000-0000-0000-000000000000','(sheet id f927515a)','','Sin identificar - conciliar','Inactivo')")
w("ON CONFLICT (id) DO NOTHING;")
w("")
w("-- ===== FACTURAS COLABORADORES: espejo =====")
w("DELETE FROM apsol_private.facturas_colaboradores;")
w("INSERT INTO apsol_private.facturas_colaboradores(id,colaborador_id,fecha_factura,numero_factura,monto,archivo_factura,fecha_pago,comprobante_pago)")
w("SELECT fid,colab,fecha,nro,monto,arch,fpago,comp FROM stg_fcol;")
w("")
w("-- ===== CONTRATOS: espejo =====")
w("DELETE FROM apsol_private.contratos;")
w("INSERT INTO apsol_private.contratos(id,colaborador_id,tipo_contrato,fecha_inicio,fecha_fin,dias_libres_por_mes,tipo_honorarios,honorarios,adjunto,adjunto2,estado)")
w("SELECT cid,colab,tipo,fini,ffin,dias,tipohon,hon,adj,adj2,estado::apsol_private.estado_general FROM stg_contr;")
w("")
w("-- ===== recalcular estado =====")
w("UPDATE apsol_private.facturacion f SET estado = CASE")
w("  WHEN COALESCE(p.pagado,0) >= f.monto THEN 'Cobrada total'")
w("  WHEN COALESCE(p.pagado,0) > 0 THEN 'Cobrada parcial'")
w("  ELSE 'Pendiente' END::apsol_private.estado_factura")
w("FROM (SELECT facturacion_id,SUM(monto) pagado FROM apsol_private.pagos GROUP BY 1) p WHERE p.facturacion_id=f.id;")
w("UPDATE apsol_private.facturacion SET estado='Pendiente' WHERE id NOT IN (SELECT facturacion_id FROM apsol_private.pagos);")
w("")
w("-- ===== VERIFICACION (RAISE -> ROLLBACK) =====")
w("DO $$")
w("DECLARE nf int; np int; sp numeric; nfc int; nc int; np_sheet int;")
w("BEGIN")
w("  SELECT count(*) INTO nf FROM apsol_private.facturacion;")
w("  IF nf<>364 THEN RAISE EXCEPTION 'facturacion=% esperado 364 -> ROLLBACK', nf; END IF;")
w("  SELECT count(*), round(coalesce(sum(monto),0),2) INTO np, sp FROM apsol_private.pagos;")
w("  SELECT count(*) INTO np_sheet FROM stg_pago;")
w("  SELECT count(*) INTO nfc FROM apsol_private.facturas_colaboradores;")
w("  IF nfc<>56 THEN RAISE EXCEPTION 'facturas_colab=% esperado 56 -> ROLLBACK', nfc; END IF;")
w("  SELECT count(*) INTO nc FROM apsol_private.contratos;")
w("  IF nc<>21 THEN RAISE EXCEPTION 'contratos=% esperado 21 -> ROLLBACK', nc; END IF;")
w("  RAISE NOTICE 'RESULTADO: facturacion=% (esp 364) | pagos=% de % en la hoja (suma %) | facturas_colab=% (esp 56) | contratos=% (esp 21)', nf, np, np_sheet, sp, nfc, nc;")
w("  IF np <> np_sheet THEN")
w("    RAISE NOTICE 'ATENCION: % pagos de la hoja no entraron (factura destino inexistente). Revisar.', np_sheet - np;")
w("  END IF;")
w("END $$;")
w("")
w("COMMIT;")

txt = "\n".join(o)
open('database/reconciliacion_facturacion_generado.sql', 'w', encoding='utf-8', newline='\n').write(txt)
print("archivo:", len(txt), "bytes ,", txt.count("\n"), "lineas")
print("F=%d P=%d FC=%d CC=%d" % (len(F), len(P), len(FC), len(CC)))
