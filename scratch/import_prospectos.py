import re

data = """Id_prospectos	Nombre Prospecto	Estado	Empresa	Contacto	Fecha creación	Fecha proxima tarea	Canal de contacto	Servicios requeridos	Adjuntos	Presupuesto	Necesidad	Proxima tarea	Fecha ultimo cambio de estado	Estado repetido	Inicio de servicio	Proxima factura	Cadena de e-mails	Inicio de secuencia	N° Ultimo e-mail	Tipo de secuencia	Hs mensuales	Mensualidad vigente actual	Moneda de Cobro	Indice a tomar	Base	Ultima actualización tarifa	Frecuencia de actualización	Días entre Reuniones
159ca0e7	El Norte	9	ac9586f8	0780526d	06/10/2022		Conocido	Transformación Digital		***	**		05/19/2025 18:35:40	9	06/11/2023	06/06/2025	Desactivado				60	987100	Pesos			06/09/2024	1	15
3813ab11	DG	9	ae28a0cd	de448f5b	11/10/2022		Conocido	Profesionalización de Pymes , Transformación Digital		**	***		02/11/2025 16:44:48	9	04/12/2022	04/03/2025	Desactivado				24	541000	Pesos	UVA	537	04/12/2024	2	30
e898aae0	Servicios Continuos Amipack	7	4af047dd	272d1518	12/07/2023		Conocido	Transformación Digital									Desactivado											20
aee8ae21	Servicio continuado Amipack	9	4af047dd	a6300ee7	12/07/2023		Conocido	Otras soluciones puntuales		***	***		10/16/2025 08:56:51	9	11/09/2023	11/10/2025	Desactivado				24	596000	Pesos	UVA	567	11/09/2025	1	
2a3c0d8a	Natión	9	81e2411b	3801b3dc	15/08/2023		Conocido	Transformación Digital		***	***		06/29/2025 14:47:52	9	23/08/2023	23/07/2025	Desactivado				40	770000	Pesos	UVA	769	22/09/2025	2	
b93d825d	Hiper Limpieza	9	3d02fb5a	5ebd78ec	22/08/2023		Conocido	Transformación Digital	Prospectos_Files_/b93d825d.Adjuntos.230335.pdf	***	***		05/08/2025 16:27:41	9	15/12/2023	15/04/2025	Desactivado				24	496000	Pesos	UVA	522	15/03/2025	1	
4d66b689	Tablero PBI	9	17558433	96d873b9	26/08/2023		Facebook	Implementación Power Bi					2/8/2024 9:31:04 AM	9			Activo	08/02/2024	9	Transformación								
72995513	Aplicación + Tablero Norte	9	ac9586f8	0780526d	26/08/2023		Conocido	Implementación Power Bi , Aplicaciones									Desactivado											
ed2d9129	Digitalización de partes de producción	9	4af047dd	272d1518	26/08/2023		Conocido	Implementación Power Bi , Aplicaciones									Desactivado											
9978fb7a	Nueva funcionalidad Partes de Producción	9	4af047dd	272d1518	26/08/2023		Conocido	Aplicaciones , Implementación Power Bi									Desactivado											
efef12de	Integración de datos	7	4af047dd	272d1518	26/08/2023		Conocido	Otras soluciones puntuales									Desactivado											
ed72ba99	Chileno	7	3375ff5f	4cfdfa12	26/08/2023		Facebook	Transformación Digital					2/8/2024 9:29:13 AM	7			Activo	08/02/2024	9	Transformación								
61a9e004	Zurschmitten	7	d71499b6	f4b0fad1	26/08/2023		Conocido	Transformación Digital									Desactivado											
01f0e669	Pintureria	6	5b3f3faa	92bc1848	26/08/2023		Recomendación	Otras soluciones puntuales					2/8/2024 9:28:50 AM	6			Activo	08/02/2024	9	Transformación								
15a42ecb	Arquitecto	6	985848f8	0576f541	26/08/2023		Conocido	Transformación Digital									Desactivado											
cedad693	Javier Taixido	7	8bc78391	92446658	26/08/2023		Recomendación	Transformación Digital , Profesionalización de Pymes		**	**		9/4/2023 11:12:46 PM	7			Activo	08/02/2024	9	Profesionalización								
64c36f1e	Adm Global	9	930da870	53ec9f2c	30/08/2023		Recomendación	Otras soluciones puntuales		*	**		8/30/2023 11:24:20 AM	9			Desactivado											15
8aa048fa	Tata	6	de99039a	63b496c2	13/09/2023		Conocido	Transformación Digital , Implementación Power Bi , Aplicaciones	Prospectos_Files_/8aa048fa.Adjuntos.004204.pdf	***	**		10/11/2023 2:42:24 PM	6			Desactivado											15
b91b31c3	RR Proyecto 2	7	930da870	53ec9f2c	27/9/2023		Conocido	Otras soluciones puntuales , Implementación Power Bi	Prospectos_Files_/b91b31c3.Adjuntos.160251.pdf	***	**		10/9/2023 9:31:34 AM	7			Desactivado											
406426cb	Distribuidor de Miel	7	efbc1d02	a4d3f483	3/10/2023		Whatsapp	Transformación Digital , Profesionalización de Pymes , Aplicaciones , Implementación Power Bi	Prospectos_Files_/406426cb.Adjuntos.004357.pdf	**	**		5/2/2024 5:16:34 PM	7			Activo	08/02/2024	9	Transformación								
2cc240f0	Blanco Textil	7	3aab4ba0	10c67885	10/11/2023		Conocido	Transformación Digital , Profesionalización de Pymes	Prospectos_Files_/2cc240f0.Adjuntos.212831.pdf	*	**		1/23/2024 4:43:46 PM	7			Activo	08/02/2024	9	Profesionalización								
af066eff	Nation Marketing	9	81e2411b	970a4f37	13/11/2023		Recomendación	Implementación Power Bi	Prospectos_Files_/af066eff.Adjuntos.160554.pdf	***	**		11/11/2024 15:17:00	9	14/11/2023	14/12/2024	Desactivado				16	369000	Pesos	UVA	317	14/09/2024	1	
508be766	Leandro Tossoni	7	3c9bd67c	e1ac2ddd	15/11/2023		LinkedIn	Implementación Power Bi , Aplicaciones	Prospectos_Files_/508be766.Adjuntos.193946.pdf	**	**		12/21/2023 5:25:18 PM	7			Activo	08/02/2024	9	Transformación								
9c27ba31	Almacen de idiomas	7	744519ee	8a227f93	21/11/2023	05/02/2024	Conocido	Transformación Digital , Implementación Power Bi , Aplicaciones		**	***		11/21/2023 1:47:08 PM	7			Activo	08/02/2024	9	Transformación								20
646ee37d	App distribuidora	7	414a22fc	862f2e1d	23/01/2024	06/02/2024	Google	Aplicaciones	Prospectos_Files_/646ee37d.Adjuntos.113643.pdf	***	**	2da consulta presupuesto	2/6/2024 12:10:40 PM	7			Activo	08/02/2024	9	Transformación								
12de1ffb	Refri Integral	9	6ecab644	50718090	23/01/2024	12/08/2024	Conocido	Profesionalización de Pymes , Transformación Digital	Prospectos_Files_/12de1ffb.Adjuntos.194203.pdf	*	**		08/28/2024 22:58:23	9	26/03/2024	26/08/2024	Activo	08/02/2024	9	Transformación	16							
24620610	Panadería La espiga	7	99227907	e731c7e2	19/02/2024		Google	Profesionalización de Pymes	Prospectos_Files_/24620610.Adjuntos.214144.pdf	**	***		3/5/2024 1:20:45 PM	7			Activo	19/02/2024	9	Profesionalización								
bbe0be2b	Maricré - Mayorista alimenticio	7	e5db3503	c421614e	23/02/2024	18/03/2024	Google	Profesionalización de Pymes	Prospectos_Files_/bbe0be2b.Adjuntos.184451.pdf	***	**	Ultimátum	3/21/2024 2:04:19 PM	7			Activo	23/02/2024	9	Profesionalización								
f9da1233	Supermercado Gluten Free	7	6cdbb434	ba668504	05/03/2024		Google	Profesionalización de Pymes	Prospectos_Files_/f9da1233.Adjuntos.121930.pdf	***	***		4/15/2024 8:55:44 AM	7			Activo	05/03/2024	9	Profesionalización								
d1f8211f	Escuela	7	f51458c2	663be23a	07/03/2024		Google	Transformación Digital , Profesionalización de Pymes	Prospectos_Files_/d1f8211f.Adjuntos.114042.pdf	***	***		3/28/2024 2:12:21 PM	7			Activo	07/03/2024	9	Transformación								
1499c631	App para empresa de Turismo	7	c2d2610d	5f54241d	12/03/2024		Google	Aplicaciones	Prospectos_Files_/1499c631.Adjuntos.143359.pdf	**	***		03/26/2024 12:09:45	7			Activo	12/03/2024	9	Transformación								
5367bb24	Decidido por power bi	5	f1a85ff9	482c8b8a	13/03/2024		Google	Implementación Power Bi , Transformación Digital		***	***						Activo	13/03/2024	9	Transformación								
949d69ed	Mercería La Paloma	9	fbb073ad	a8f8d6d7	28/03/2024		E-mail Marketing	Profesionalización de Pymes , Implementación Power Bi	Prospectos_Files_/949d69ed.Adjuntos.184405.pdf	**	**		03/02/2026 10:36:59	9	06/10/2025	06/02/2026	Activo	28/03/2024	9	Profesionalización	24		Pesos	UVA	407	06/10/2026	3	20
d0c39c82	A todo color	7	30ab20cd	6668f67a	29/03/2024		Conocido	Implementación Power Bi	Prospectos_Files_/d0c39c82.Adjuntos.131335.pdf	***	**		5/24/2024 11:25:41 AM	7			Activo	29/03/2024	9	Transformación								
986b8752	Cotar	7	69fe2461	2c5ca915	12/04/2024		Google	Transformación Digital		***	***		5/18/2024 8:22:50 PM	7			Desactivado	12/04/2024	0									
735c8ed1	Verisue Consultoría Power Bi	7	38fbf5b1	b329ae99	15/04/2024		Google	Implementación Power Bi		***	**		5/2/2024 9:32:24 AM	7			Activo	15/04/2024	9	Transformación								
5a548b0a	Work and travel	7	37654b55	4d6a122e	15/04/2024		Google	Profesionalización de Pymes , Implementación Power Bi	Prospectos_Files_/5a548b0a.Adjuntos.115447.pdf	**	**		5/9/2024 4:40:47 PM	7			Desactivado	15/04/2024	0									
a6ee0d69	Proyecto Nueva Sucursal DG	9	ae28a0cd	de448f5b	17/04/2024		Cliente	Otras soluciones puntuales	Prospectos_Files_/a6ee0d69.Adjuntos.115650.pdf			1ra consulta presupuesto	01/31/2025 18:01:33	9	20/05/2024	16/02/2025	Desactivado	17/04/2024	0		24	541000	Pesos	UVA	488	16/02/2025	2	
342ec7a8	Insuga Gonzalo	9	118b4ee2	79c40232	27/05/2024		Conocido	Transformación Digital , Implementación Power Bi , Aplicaciones		***	***		09/22/2025 19:59:41	9	28/10/2024	28/9/2025	Desactivado	27/05/2024	0		20		Pesos	UVA	441	28/8/2025	1	15
7bb1ba36	Metalurgica HQ	9	e1a52e95	dd0b1847	11/06/2024		E-mail Marketing	Profesionalización de Pymes , Transformación Digital	Prospectos_Files_/7bb1ba36.Adjuntos.181904.pdf	**	***		07/22/2025 14:46:48	9	07/06/2024	07/08/2025	Desactivado	27/05/2024	0		24	493000	Pesos	UVA	429	07/06/2025	1	15
3f88e2ee	IO Distribuidora	7	7e461d1d	496a3bfb	14/06/2024		E-mail Marketing	Profesionalización de Pymes , Transformación Digital	Prospectos_Files_/3f88e2ee.Adjuntos.140206.pdf	**	**		07/01/2024 14:00:10	7			Desactivado	14/06/2024	0									15
513718c3	Metalurgica	11	0567a635	acc0d25c	07/07/2024		E-mail Marketing	Transformación Digital , Implementación Power Bi	Prospectos_Files_/513718c3.Adjuntos.141135.pdf	**	*						Desactivado	07/07/2024	0									
531c0a52	Mecanizados industria del petroleo	7	e6ad2804	7f799756	08/07/2024		E-mail Marketing	Aplicaciones		***	***		08/07/2024 09:56:23	7			Desactivado	08/07/2024	0									
761cd7da	Distribuidora de alimentos	7	84a5d941	f0ac00fc	31/07/2024		Recomendación	Transformación Digital , Profesionalización de Pymes	Prospectos_Files_/761cd7da.Adjuntos.160155.G Distribuidora - Profesionalización y transformación digital de PyMEs.pdf	**	**		09/19/2024 09:28:55	7			Desactivado	31/07/2024	0		16							
1e17ed13	App A todo Color	9	75b92a7d	52fd7926	31/07/2024		Conocido	Aplicaciones	Prospectos_Files_/1e17ed13.Adjuntos.162333.pdf	***	***		06/09/2025 10:22:03	9	04/09/2024	04/06/2025	Desactivado	31/07/2024	0		32	648000	Pesos	UVA	594	04/05/2025	1	
49b91e65	Ruedas RAR	7	126ab385	128008fa	12/08/2024		E-mail Marketing	Profesionalización de Pymes	Prospectos_Files_/49b91e65.Adjuntos.215147.pdf	**	***		08/19/2024 19:50:22	7			Activo	12/08/2024	9									20
26a88f6a	Drumond Pet Shop	9	78f24129	4f00635e	19/08/2024		Google	Profesionalización de Pymes	Prospectos_Files_/26a88f6a.Adjuntos.223948.pdf	*	***		04/04/2025 15:55:31	9	22/08/2024	22/01/2025	Desactivado	19/08/2024	0		16	300000	Pesos	UVA	271	22/11/2024	3	
08ec2769	Idearte Mayorista	9	5d03ca1f	bd6c277d	22/08/2024		E-mail Marketing	Profesionalización de Pymes		**	***		12/06/2024 16:52:39	9	13/09/2024	13/11/2024	Desactivado	22/08/2024	0		16	397000	Pesos	UVA	332	13/11/2024	3	10
6ed244a8	Refri 2da parte App	9	6ecab644	50718090	28/08/2024		Conocido	Aplicaciones		**	**		01/28/2025 17:17:51	9	28/08/2024	28/01/2025	Desactivado	28/08/2024	0		16	340000	Pesos	UVA	290	28/12/2024	1	10
98d8047f	La Francia Panificación SRL	7	8701553e	d256dcda	11/12/2024		E-mail Marketing	Profesionalización de Pymes , Transformación Digital	Prospectos_Files_/98d8047f.Adjuntos.200018.pdf	***	***		10/31/2024 19:46:58	7			Desactivado	28/10/2024	0									20
bfb97300	Mantenimiento Activos Nation Marketing	8	81e2411b	970a4f37	11/12/2024		Conocido	Aplicaciones , Otras soluciones puntuales	Prospectos_Files_/bfb97300.Adjuntos.181844.pdf	**	**		09/03/2025 18:13:15	8	17/7/2025	18/04/2026	Desactivado	11/11/2024	0		0		Pesos	UVA	94	17/04/2026	1	
2adada22	Cordilleranos srl	7	73527a48	435b53c5	11/12/2024	06/01/2025	E-mail Marketing	Transformación Digital , Profesionalización de Pymes	Prospectos_Files_/2adada22.Adjuntos.163557.pdf	***	***	Ultimátum	01/08/2025 11:09:18	7			Desactivado	6/12/2024	0									90
b84051a9	Nation Marketing 3	7	81e2411b	970a4f37	18/12/2024	27/1/2025	Conocido	Transformación Digital		***	**	Ultimátum	01/10/2025 09:10:21	7			Desactivado	18/12/2024	0									
4f93a8c5	Hector Cañadas - App Producción	7	41b2192f	dab7ab01	20/12/2024	06/01/2025	Recomendación	Aplicaciones , Transformación Digital		*	**	1ra consulta presupuesto	01/08/2025 21:06:46	7			Desactivado	20/12/2024	0									
de964d58	Tablero de control Cubiertas Natión MKT	9	81e2411b	970a4f37	30/01/2025		Conocido	Implementación Power Bi		**	**		03/18/2025 15:22:26	9	06/01/2025	10/04/2024	Desactivado	30/01/2025	0		10		Pesos	UVA	22	30/01/2030	30	
555aec7d	APSOL - Proyectos Internos	8	cf6c2ff4	bedcc2de	07/02/2025		Conocido	Transformación Digital		**	**		02/07/2025 11:41:36	8	03/02/2025	07/02/2027	Desactivado	07/02/2025	0		24		Pesos	UVA	1	07/02/2056	12	
4fda9d66	DG 2025	9	ae28a0cd	129bcb6b	11/02/2025		Conocido	Transformación Digital , Implementación Power Bi , Profesionalización de Pymes		***	***		01/06/2026 16:43:07	9	04/02/2025	04/01/2026	Desactivado	11/02/2025	0		48		Pesos	UVA	1074	01/03/2025	3	30
cf0de0c4	Vasquez SRL	7	a3e3e86c	15bafbca	18/02/2025		E-mail Marketing	Otras soluciones puntuales	Prospectos_Files_/cf0de0c4.Adjuntos.145645.docx	***	***		03/26/2025 17:29:42	7			Desactivado	18/02/2025	0									20
a62eb6a1	REMAX	7	a9fc634b	fe078071	20/02/2025	24/04/2025	Recomendación	Aplicaciones	Prospectos_Files_/a62eb6a1.Adjuntos.165140.pdf	***	**	Ultimátum	04/03/2025 11:44:18	7			Desactivado	20/02/2025	0									
bac72ff3	Integración ERP - PURATOS	7	4c543d69	b7e8dfa8	28/02/2025	08/04/2025	LinkedIn	Otras soluciones puntuales , Implementación Power Bi		***	**	Ultimátum	04/18/2025 10:27:52	7			Desactivado	28/02/2025	0									
3aa9c444	Municipalidad De Rawson	7	af6136d5	4bf07c42	10/03/2025		E-mail Marketing	Transformación Digital , Aplicaciones , Otras soluciones puntuales		***	**		04/24/2025 01:35:33	7			Desactivado	10/03/2025	0									
bb95f4ef	Natión Marketing 2025	9	81e2411b	970a4f37	18/03/2025		Conocido	Aplicaciones , Implementación Power Bi		**	**		09/03/2025 18:09:44	9	18/03/2025	18/08/2025	Desactivado	18/03/2025	0		13		Pesos	UVA	22	18/08/2025	3	
ca393add	Marmolería	7	093697de	e3245a3f	26/03/2025	02/06/2025	E-mail Marketing	Transformación Digital , Profesionalización de Pymes		**	***	2da consulta presupuesto	04/29/2025 10:15:31	7			Desactivado	26/03/2025	0									20
c1d59cb3	Amipack 2025	7	4af047dd	272d1518	28/03/2025		Recomendación	Transformación Digital , Profesionalización de Pymes , Implementación Power Bi		***	**		04/21/2025 14:44:06	7			Desactivado	28/03/2025	0									
6d1d33cf	OntheRoad Viajes	9	d193b499	fdf5bc2b	28/03/2025		E-mail Marketing	Aplicaciones		***	**		03/19/2026 14:04:32	9	14/04/2025	14/04/2026	Desactivado	28/03/2025	0		24		Dolar	Dólar	423	14/01/2028	3	
45b8b890	Nossar empresa de transporte	7	97b9fe3e	d7bbbb22	04/04/2025		E-mail Marketing	Transformación Digital , Aplicaciones , Implementación Power Bi		***	***		04/24/2025 01:36:20	7			Desactivado	04/04/2025	0									20
b885c41a	Frigorifico Riosma	7	932e6eec	36ad0381	04/04/2025		E-mail Marketing	Transformación Digital , Implementación Power Bi , Aplicaciones		***	***		04/23/2025 13:24:41	7			Activo	04/04/2025	9	Transformación								
d023bea5	Vertiente del Sur	9	e9e0a3a9	43b3da09	15/04/2025		E-mail Marketing	Transformación Digital , Implementación Power Bi , Aplicaciones		**	**		11/13/2025 10:00:08	9	22/04/2025	22/11/2025	Activo	15/04/2025	9	Transformación	24		Pesos	UVA	436	22/01/2027	3	
7c7aad4f	Aceite Vegetal del llano	7	d1681a26	ce540b0a	21/04/2025		E-mail Marketing	Aplicaciones		***	**		05/19/2025 13:19:46	7			Activo	21/04/2025	9	Transformación								20
d3811c3d	Autopartes Sol	9	34a2cd17	b19d09ff	29/04/2025		E-mail Marketing	Implementación Power Bi		***	**		08/20/2025 10:53:13	9	06/05/2025	06/07/2025	Desactivado	29/04/2025	0		24		Pesos	UVA	490	06/11/2025	3	
727e6ee9	Asistente Laboratorio	9	1c0d5c64	6a13e326	08/05/2025		E-mail Marketing	Otras soluciones puntuales		**	***		02/24/2026 16:56:23	9	11/06/2025	18/03/2026	Activo	08/05/2025	9		18		Pesos	UVA	328	20/01/2026	4	20
a767493e	HL 2025		3d02fb5a	5ebd78ec	08/05/2025		Conocido	Transformación Digital		**	***						Desactivado	08/05/2025	0									15
b254f945	Hiper Limpieza 2025	9	3d02fb5a	5ebd78ec	08/05/2025		Conocido	Transformación Digital		**	***		06/09/2025 14:39:34	9	15/04/2025	15/05/2025	Desactivado	08/05/2025	0		16		Pesos	UVA	331	15/05/2025	1	
ea38b54e	Conexion Market	8	b178e6b9	6537662d	12/05/2025		E-mail Marketing	Asistentes Virtuales		***	***		06/25/2025 13:04:04	8	18/06/2025	18/04/2026	Activo	12/05/2025	9	Transformación	40		Pesos	UVA	660	18/09/2026	3	20
559adcf6	Amipack 2025	8	4af047dd	272d1518	08/09/2025		Recomendación	Transformación Digital	Prospectos_Files_/559adcf6.Adjuntos.171842.pdf	**	**		09/15/2025 12:21:44	8	11/09/2025	11/4/2026	Desactivado	08/09/2025	0		36		Pesos	UVA	713	11/06/2027	3	
5d431273	Norte 2025	8	ac9586f8	0780526d	19/05/2025		Conocido	Transformación Digital		***	***		05/19/2025 18:28:25	8	06/05/2025	06/05/2026	Desactivado	19/05/2025	0		30		Pesos	UVA	408	07/04/2026	1	20
51bf90ab	Logistica Chilena	7	c461f15b	6bd9c5c6	21/05/2025		Instagram	Aplicaciones		***	***		06/09/2025 13:02:52	7			Activo	21/05/2025	9	Transformación								20
a2c8559d	Insuga Producción + Compras	7	118b4ee2	25bc6aac	21/05/2025		Recomendación	Aplicaciones , Implementación Power Bi , Transformación Digital	Prospectos_Files_/a2c8559d.Adjuntos.123807.pdf	***	***	2da consulta presupuesto	06/11/2025 10:18:03	7			Desactivado	21/05/2025	0									
8defa075	Escobar	8	b04dfd0e	24b00c3c	28/05/2025		Recomendación	Implementación Power Bi , Aplicaciones	Prospectos_Files_/8defa075.Adjuntos.160536.pdf	***	***		07/02/2025 15:56:12	8	08/07/2025	08/04/2026	Desactivado	28/05/2025	0		40		Pesos	UVA	835	08/01/2027	3	
34f0b730	Asistente Personal	7	6ecab644	50718090	25/06/2025		Conocido	Asistentes Virtuales	Prospectos_Files_/34f0b730.Adjuntos.163010.pdf	**	*		07/31/2025 08:48:01	7			Desactivado	25/06/2025	0									20
50459ce8	ATC 2025	8	75b92a7d	6668f67a	01/07/2025		Conocido	Transformación Digital , Asistentes Virtuales , Implementación Power Bi , Aplicaciones		***	***		07/01/2025 15:37:50	8	01/07/2025	01/05/2026	Desactivado	01/07/2025	0		32		Pesos	UVA	605	01/10/2027	3	20
340a5560	Refri 2025	8	6ecab644	50718090	08/07/2025		Conocido	Aplicaciones		**	**		07/08/2025 16:41:20	8	13/07/2025	13/04/2026	Desactivado	08/07/2025	0		13		Pesos	UVA	286	01/01/2028	3	20
aaeb3477	Novis	7	da75f410	c5f7de92	11/07/2025		Conocido	Implementación Power Bi	Prospectos_Files_/aaeb3477.Adjuntos.124346.pdf	***	**		08/06/2025 09:19:40	7			Desactivado	11/07/2025	0									20
b0ce67dc	Mantenimiento Nation PostVenta	8	81e2411b	3801b3dc	14/07/2025		Recomendación	Implementación Power Bi , Aplicaciones		***	**		07/14/2025 12:00:31	8	23/06/2025	23/04/2026	Desactivado	14/07/2025	0		0		Pesos	UVA	209	23/06/2027	3	
cbc8da9a	HQ 2025	9	e1a52e95	dd0b1847	22/07/2025		Conocido	Transformación Digital		**	**		01/14/2026 12:25:10	9	07/07/2025	07/02/2026	Desactivado	22/07/2025	0		16		Pesos		286	07/04/2026	3	
7c2d6ebb	HOM Seguros	7	49bfe5a7	afacd6cf	31/07/2025		E-mail Marketing	Asistentes Virtuales , Implementación Power Bi , Transformación Digital , Aplicaciones		**	***		10/22/2025 16:55:38	7			Desactivado	31/07/2025	0									100000
5d600653	LaMotofeca	3	431a396d	e5e8c1b9	31/07/2025	02/02/2026	E-mail Marketing	Transformación Digital , Asistentes Virtuales		**	***	2da consulta presupuesto	08/01/2025 20:32:55	3			Desactivado	31/07/2025	0									15
1720257f	Santiago	7	b057cd12	8415d712	14/08/2025		E-mail Marketing	Implementación Power Bi		**	**	1ra consulta presupuesto	08/25/2025 10:28:36	7			Desactivado	14/08/2025	0									
62eac0c5	Minimercado	7	d0f1acb0	4c1e8466	18/08/2025		Instagram	Asistentes Virtuales		**	**		08/28/2025 19:31:45	7			Desactivado	18/08/2025	0									
e9eeb72d	Red el Colo	7	8e3b2b80	8888e3f3	20/08/2025		Instagram	Asistentes Virtuales , Implementación Power Bi , Aplicaciones		**	**		08/29/2025 09:06:50	7			Desactivado	20/08/2025	0									
ce8bf29c	Beamar Alimentos	9	fc235004	7a0751b4	21/08/2025		Instagram	Asistentes Virtuales		**	**		01/19/2026 12:24:20	9	16/09/2025	16/01/2026	Desactivado	21/08/2025	0		16		Dolar	Dólar	160	03/03/2028	6	
7ea4b04d	Guiller - Edu	7	30ab20cd	b65f31b5	25/08/2025		Conocido	Transformación Digital , Asistentes Virtuales , Implementación Power Bi		**	**		09/15/2025 10:55:24	7			Desactivado	25/08/2025	0									
7d946b2e	GAMA	7	4728be84	5712b7b8	25/08/2025		IA	Transformación Digital		***	***		10/22/2025 16:57:50	7			Desactivado	25/08/2025	0									30
e08b3d21	Taller Autos	7	4b4ab8fb	f52d1c16	01/09/2025		Recomendación	Transformación Digital , Aplicaciones		***	**		10/01/2025 08:55:01	7			Desactivado	01/09/2025	0									
559adcf6	Amipack 2025	8	4af047dd	272d1518	08/09/2025		Recomendación	Transformación Digital	Prospectos_Files_/559adcf6.Adjuntos.171842.pdf	**	**		09/15/2025 12:21:44	8	11/09/2025	11/4/2026	Desactivado	08/09/2025	0		36		Pesos	UVA	713	11/06/2027	3	
54e34fe9	Bavosi	3	5b5b773e	f91dcbaf	08/09/2025		LinkedIn	Implementación Power Bi , Transformación Digital , Profesionalización de Pymes		***	**	Ultimátum	09/08/2025 15:38:43	3			Desactivado	08/09/2025	0									
90478da9	Insuga 2025	8	118b4ee2	79c40232	17/09/2025		Conocido	Implementación Power Bi	Prospectos_Files_/90478da9.Adjuntos.113423.pdf	***	**		09/22/2025 20:04:00	8	28/08/2025	28/3/2026	Desactivado	17/09/2025	0		30		Pesos	UVA	606	28/05/2027	3	20
de13edbd	Nutriar	3	82c28880	d73debf6	17/09/2025	12/01/2026	Conocido	Asistentes Virtuales , Transformación Digital		***	**	2da consulta presupuesto	10/01/2025 09:07:00	3			Desactivado	17/09/2025	0									
56446670	ISAA	9	013ad8e0	29f06d8a	22/09/2025		E-mail Marketing	Transformación Digital		***	**		02/03/2026 16:33:54	9	20/10/2025	20/1/2026	Desactivado	22/09/2025	0		24		Pesos	UVA	433	20/4/2026	3	20
7c08878e	Ingredients Solutions	3	21f58208	7791fa61	20/10/2025	15/1/2026	E-mail Marketing	Otras soluciones puntuales		***	**	Ultimátum	10/20/2025 12:37:02	3			Desactivado	20/10/2025	0									
b8fc9593	Carlos (Hoteles)	7	005870f1	d02733e3	22/10/2025		Instagram	Asistentes Virtuales		***	***		11/10/2025 16:07:24	7			Desactivado	22/10/2025	0									20
7f1470fc	Conflicto entre hermanos	7	5dc46219	e7979ce2			Google	Transformación Digital	Prospectos_Files_/7f1470fc.Adjuntos.192045.pdf	**	**		2/21/2024 7:47:08 PM	7			Activo	08/02/2024	9	Profesionalización								
dfe884cb	CRM ChatWoot	7	6ecab644	50718090	10/11/2025		Conocido	Otras soluciones puntuales		**	**		12/26/2025 13:29:55	7			Desactivado	10/11/2025	0									
681b8aa1	Open Pack	8	c4516150	c7b988ba	14/11/2025		E-mail Marketing	Transformación Digital , Otras soluciones puntuales , Asistentes Virtuales	Prospectos_Files_/681b8aa1.Adjuntos.173453.pdf	***	**		01/19/2026 13:17:10	8	20/01/2026	20/04/2026	Desactivado	14/11/2025	0		24		Pesos	UVA	449	20/07/2026	3	15
cc64a525	Grupo BMH	7	c4e7e704	b27022fb	14/11/2025		E-mail Marketing	Transformación Digital	Prospectos_Files_/cc64a525.Adjuntos.195810.pdf	**	**		12/15/2025 14:24:27	7			Desactivado	14/11/2025	0									
66d55fa5	Vigorita Maderas	3	1ffa5823	4d8e02a7	17/11/2025	1/1/2026	E-mail Marketing	Otras soluciones puntuales		***	***	2da consulta presupuesto	11/17/2025 12:42:25	3			Desactivado	17/11/2025	0									
98cae4d1	Empresa de transporte COOQUITRANS	3	13fe9826	0d570355	18/11/2025	15/1/2026	E-mail Marketing	Transformación Digital		***	***	Ultimátum	11/18/2025 10:16:18	3			Desactivado	18/11/2025	0									
25c837ee	Entrenuts	3	a2285b22	cac0f613	19/11/2025	15/1/2026	E-mail Marketing	Otras soluciones puntuales , Transformación Digital		***	**	Ultimátum	11/19/2025 08:59:51	3			Desactivado	19/11/2025	0									
3134b37f	La Golonicería		c79b70f0	6f203d21	26/11/2025		E-mail Marketing	Transformación Digital		***	***						Desactivado	26/11/2025	0									
eae68570	La Golonisería	3	db7864da	41177137	26/11/2025	22/12/2025	E-mail Marketing	Transformación Digital , Implementación Power Bi	Prospectos_Files_/eae68570.Adjuntos.171908.pdf	***	***	2da consulta presupuesto	11/26/2025 14:19:26	3			Desactivado	26/11/2025	0									
b539fc93	Automatización de cobranzas	3	f76405df	ec9aab79	09/12/2025	19/01/2026	E-mail Marketing	Otras soluciones puntuales	Prospectos_Files_/b539fc93.Adjuntos.163043.pdf	***	**	Contactar 	12/09/2025 13:30:53	3			Desactivado	09/12/2025	0									
1994340f	Tenis Club Argentino	3	a940644b	18d09fcb	22/12/2025	29/12/2025	E-mail Marketing	Otras soluciones puntuales , Asistentes Virtuales	Prospectos_Files_/1994340f.Adjuntos.205806.pdf	***	***	1ra consulta presupuesto	12/22/2025 17:58:18	3			Desactivado	22/12/2025	0									
36bc8eb7	DG 2026	8	ae28a0cd	129bcb6b	06/01/2026		Conocido	Implementación Power Bi , Transformación Digital , Otras soluciones puntuales	Prospectos_Files_/36bc8eb7.Adjuntos.194010.pdf	**	**		01/06/2026 16:16:20	8	04/01/2026	04/05/2026	Desactivado	06/01/2026	0		44		Pesos	UVA	867	04/05/2026	1	20
1ef2f415	Mantenimiento	8	cf6c2ff4	bedcc2de	07/01/2026		Recomendación	Transformación Digital , Asistentes Virtuales , Profesionalización de Pymes , Implementación Power Bi , Aplicaciones , Otras soluciones puntuales		**	**		01/07/2026 16:23:27	8	07/01/2026	07/10/2028	Desactivado	07/01/2026	0		16		Pesos	UVA	1	07/12/2029	1	1000
3162ec60	MD (Futbol y Agencia)	8	ef2d9055	105ac1da	12/01/2026		Conocido	Transformación Digital , Aplicaciones , Profesionalización de Pymes		**	**		02/04/2026 18:50:09	8	04/02/2026	04/05/2026	Desactivado	12/01/2026	0		24		Pesos	UVA	444	04/11/2026	3	15
5e3ca150	ISAA 2026	8	013ad8e0	29f06d8a	03/02/2026		E-mail Marketing	Transformación Digital		**	***		02/03/2026 16:35:50	8	23/01/2026	23/05/2026	Desactivado	03/02/2026	0		24		Pesos	UVA	433	20/10/2025	3	20
030ba187	Insuga Chaco	8	118b4ee2	79c40232	06/02/2026		Conocido	Transformación Digital , Implementación Power Bi	Prospectos_Files_/030ba187.Adjuntos.163214.pdf	***	**		02/12/2026 10:33:15	8	11/02/2026	11/04/2026	Desactivado	06/02/2026	0		20		Pesos	UVA	450	01/08/2026	3	20
b6c00731	Mantenimiento HQ	8	e1a52e95	dd0b1847	13/02/2026		Conocido	Aplicaciones , Implementación Power Bi	Prospectos_Files_/b6c00731.Adjuntos.160746.pdf	*	***		02/13/2026 13:09:19	8	07/02/2026	07/05/2026	Desactivado	13/02/2026	0		0		Pesos	UVA	83	07/04/2026	1	
645c84b0	Mantenimiento BOT Laboratorio	8	1c0d5c64	6a13e326	24/02/2026		Conocido	Asistentes Virtuales	Prospectos_Files_/645c84b0.Adjuntos.202500.pdf	**	**		02/24/2026 17:26:44	8	24/02/2026	24/04/2026	Desactivado	24/02/2026	0		0		Pesos	UVA	71	24/04/2026	1	10000
d27f5d16	CIATI	3	7987a65f	d4ffe829	02/03/2026	05/03/2026	E-mail Marketing	Transformación Digital		***	**	1ra consulta presupuesto	03/02/2026 11:28:56	3			Desactivado	02/03/2026	0									
207f3aa5	Mantenimiento Activos On The Road Viajes	8	d193b499	fdf5bc2b	19/03/2026		E-mail Marketing	Aplicaciones	Prospectos_Files_/207f3aa5.Adjuntos.170544.pdf	**	**		03/19/2026 14:07:16	8	06/06/2026	06/07/2026	Desactivado	19/03/2026	0		0		Dolar	Dólar	110	19/03/2026	24	365
30cd03a1	Estudio Gustavo Echarte	8	58fb63c6	6e8758f2	25/03/2026		Recomendación	Transformación Digital , Asistentes Virtuales , Aplicaciones	Prospectos_Files_/30cd03a1.Adjuntos.142318.pdf	***	***		04/10/2026 16:18:41	8	10/04/2026	10/05/2026	Desactivado	25/03/2026	0		32		Dolar	UVA	645	10/04/2026	3	20
b7a93fc4	Borrar		cf6c2ff4	bedcc2de	25/04/2026		Instagram	Transformación Digital , Asistentes Virtuales , Profesionalización de Pymes , Implementación Power Bi , Aplicaciones , Otras soluciones puntuales		**	**						Desactivado	25/04/2026	0									
"""

def parse_date(d):
    if not d or d.strip() == "": return "NULL"
    # DD/MM/YYYY
    parts = d.split("/")
    if len(parts) == 3:
        return f"'{parts[2]}-{parts[1]}-{parts[0]}'"
    return "NULL"

def parse_num(n):
    if not n or n.strip() == "": return "0"
    try:
        return str(float(n.replace(".", "").replace(",", ".")))
    except:
        return "0"

lines = data.strip().split("\n")
header = lines[0].split("\t")
rows = lines[1:]

sql_updates = []

for row in rows:
    cols = row.split("\t")
    if len(cols) < 2: continue
    
    nombre = cols[1].strip()
    # Mapeo de campos segun el orden de la tabla:
    # 0: Id_prospectos, 1: Nombre, 2: Estado, 15: Inicio servicio, 16: Proxima factura, 
    # 21: Hs mensuales, 22: Mensualidad vigente, 23: Moneda, 24: Indice, 25: Base, 
    # 26: Ultima act tarifa, 27: Frecuencia act, 28: Dias reuniones
    
    # Asegurar que hay suficientes columnas
    while len(cols) < 30: cols.append("")
    
    # Mapeo de estado numerico a descriptivo
    estado_num = cols[2].strip()
    estado_final = estado_num
    if estado_num in ['8', '9']: estado_final = '6A - En producción'
    elif estado_num == '7': estado_final = '3A - Seguimiento'
    elif estado_num == '6': estado_final = '4A - Presupuesto'
    elif estado_num == '5': estado_final = '2A - Reunión'
    elif estado_num == '3': estado_final = '5A - Negociación'
    
    updates = [
        f"estado = '{estado_final}'",
        f"inicio_servicio = {parse_date(cols[15])}",
        f"proxima_factura = {parse_date(cols[16])}",
        f"hs_mensuales = {parse_num(cols[21])}",
        f"mensualidad_vigente_actual = {parse_num(cols[22])}",
        f"moneda_cobro = '{cols[23] if cols[23] else 'Pesos'}'",
        f"indice_cobro = '{cols[24] if cols[24] else ''}'",
        f"base_indice_valor = {parse_num(cols[25])}",
        f"ultima_actualizacion_tarifa = {parse_date(cols[26])}",
        f"frecuencia_actualizacion = {parse_num(cols[27]) if cols[27] else '1'}",
        f"dias_entre_reuniones = {parse_num(cols[28]) if cols[28] else '0'}"
    ]
    
    # También actualizar campos de marketing si hay
    if cols[17]: updates.append(f"cadena_emails = '{cols[17]}'")
    if cols[18]: updates.append(f"inicio_secuencia = '{cols[18]}'")
    if cols[19]: updates.append(f"n_ultimo_email = {parse_num(cols[19])}")
    if cols[20]: updates.append(f"tipo_secuencia = '{cols[20]}'")

    sql = f"UPDATE apsol.prospectos SET {', '.join(updates)} WHERE nombre = '{nombre.replace("'", "''")}';"
    sql_updates.append(sql)

print("\n".join(sql_updates))
