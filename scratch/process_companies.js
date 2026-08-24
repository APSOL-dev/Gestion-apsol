const dbCompanies = [
  {"id":"d8e3423e-dd19-44bd-8e1c-0ab44aa412af","nombre":"Amipack"},
  {"id":"70e32e93-bd73-42df-a7b4-cdb9dd2079c5","nombre":"El Norte"},
  {"id":"f67278c3-67ea-4d1e-ab0a-dc4ac39d2470","nombre":"Dg Distribuciones"},
  {"id":"163af7bb-eff1-4e61-b78a-fc948849214a","nombre":"Natión"},
  {"id":"c2625954-6843-46ff-ba4c-ab2060a8a070","nombre":"Zinma"},
  {"id":"3b603f5f-d2c5-4a0d-a711-f6866e38784c","nombre":"Almacén de Idiomas"},
  {"id":"7ce8283a-88d0-4970-858e-f89d549b8756","nombre":"RR escapes"},
  {"id":"77403ca3-d595-4b5d-a4fd-2894c1c58ed0","nombre":"Transporte Chileno"},
  {"id":"84ce96c5-fc9a-4663-b97a-116489972794","nombre":"Zurschmitten"},
  {"id":"aee1b455-a97c-40ca-b8d5-1eda7c51d738","nombre":"Nea Color"},
  {"id":"2a95c835-9c75-4f4d-8f2f-7c4b21c1326c","nombre":"Juan Jose Puppo"},
  {"id":"90aa77c1-0d85-496a-8820-c0a9e029d054","nombre":"Teixido Repuestos"},
  {"id":"cb357211-4a2f-4a14-95dc-6c2492338675","nombre":"Hiper Limpieza"},
  {"id":"aae8568b-9f94-4a5a-9729-a0a1918d009e","nombre":"Tata Rapido"},
  {"id":"7510ba35-2a96-4bd7-a051-3130fdaa26eb","nombre":"Bracco Lucas Gabriel"},
  {"id":"b32acb60-791e-4fcc-95c4-b9641f68fc5a","nombre":"Nova"},
  {"id":"333e8323-bb2c-44b6-97e8-8525fd25ea3c","nombre":"Blanco Textil"},
  {"id":"e533095a-200d-4dea-81a9-d41081bfe0b2","nombre":"Carolina Faveiro"},
  {"id":"da0961c5-7b09-4f44-95e1-501680075aa2","nombre":"Apsol"},
  {"id":"8e55f1d5-1b18-4970-834f-143900c3779c","nombre":"Neumen"},
  {"id":"ddd21d41-4bee-4d7a-8fa3-d38de1de8c06","nombre":"Refri Integral"},
  {"id":"81532517-a69a-4cb9-8af6-5c49358e5fe5","nombre":"Couce"},
  {"id":"b266892a-38d5-447b-9b95-418f9ebede2c","nombre":"La Espiga"},
  {"id":"cb9f5c5a-6948-4a4a-a45f-e89e22452863","nombre":"Maricré"},
  {"id":"badba1f7-d5cf-445a-8a0a-5d0bdf656ead","nombre":"Rojas Gluten Free"},
  {"id":"f37d4b93-214d-4f13-9810-c6471624d338","nombre":"Colegio LIncoln"},
  {"id":"7a25f900-5593-4c50-ac1f-e8056dfc4f2b","nombre":"Viajeros en Rio"},
  {"id":"8759d119-d115-4de5-9568-cc806f5bcea7","nombre":"Delico"},
  {"id":"fb42586b-433d-41e1-b2a5-ea7354170987","nombre":"Mercería La Paloma"},
  {"id":"904b6966-6a62-4cc9-a644-1718f78b4303","nombre":"Precixo"},
  {"id":"f73e9402-5519-4673-81f7-d15b3b82fb10","nombre":"Ultracongelados canalsenses"},
  {"id":"ca993aef-cb1c-4bd6-b32a-0ddc6727e46e","nombre":"COTAR"},
  {"id":"c71a387b-dded-488d-adbe-9b4be0415bf6","nombre":"Verisue"},
  {"id":"6b74dc25-4082-40f6-9ed8-65b57929c628","nombre":"Xchange Bridge"},
  {"id":"9069b88d-a4f9-4fcc-8286-7f14a32bad4b","nombre":"Bolciti SRL"},
  {"id":"a7bcf0fd-e3ef-4db1-98f8-a2b96a2995c5","nombre":"Bassegraf"},
  {"id":"675446d8-9360-4292-a1ad-521fd2f4cfcd","nombre":"Eliho Textil"},
  {"id":"595928cc-7703-4aad-b698-e9dcffdfd65e","nombre":"Insuga"},
  {"id":"11ff3103-702c-4fbb-9b62-6202b67fe70b","nombre":"Metalurgica HQ"},
  {"id":"b280e369-8b53-423a-83a3-c6b84cc971f3","nombre":"IO Distribuidora"},
  {"id":"61e4ebce-93df-430a-a74b-dc609f6505d1","nombre":"Fiore"},
  {"id":"3f4558ff-1249-4a0e-a683-42076181c0f6","nombre":"GrupoAISA Mecanizados"},
  {"id":"c1832934-f75b-45ee-8c43-4d7f072399a3","nombre":"P.C.G Distribuidora"},
  {"id":"2f867254-321d-4765-a354-db24611c70cd","nombre":"Ruedas R.A.R"},
  {"id":"5e551e4b-5f75-46e7-9226-e2fb4634544f","nombre":"Drumond Pet Shop"},
  {"id":"808a806d-f71e-4b60-bf7f-8018a9ad1568","nombre":"Idearte Mayorista"},
  {"id":"c9b93c2a-043f-47e7-87f7-5bf267caecdc","nombre":"A todo Color"},
  {"id":"275646fa-580c-4d70-97ca-05d76bd1c716","nombre":"La Francia Panificación SRL"},
  {"id":"a898bcd9-44db-4f34-8b1d-bb3e820efa36","nombre":"Cordilleranos srl"},
  {"id":"6532f074-80b6-422a-89d5-e5e591129bc4","nombre":"Hector Cañadas"},
  {"id":"0e211dfe-eebe-4fd5-a149-040b25d31e50","nombre":"VASQUEZ SRL"},
  {"id":"7a6a49d6-9762-45ea-aa72-ca6786c30451","nombre":"REMAX"},
  {"id":"d308703c-779e-4b81-894a-07f7633e563c","nombre":"PURATOS"},
  {"id":"f455576a-0c6b-4025-9369-a0ae2af37c64","nombre":"Municipalidad de Rawson"},
  {"id":"a4222e34-a0e7-4163-8af6-956c45f18025","nombre":"Bernardis"},
  {"id":"bf67d7a8-a293-46fb-a6cb-6444caff4f02","nombre":"OnTheRoad viajes"},
  {"id":"d5a1b265-64b2-4636-8758-ac12ae541677","nombre":"Nossar"},
  {"id":"59131d00-4c11-4ba6-8fe5-d69a5fe4d38d","nombre":"Riosma"},
  {"id":"23c3501e-595e-4c9d-b640-549e05e00bcf","nombre":"Vertiente del Sur"},
  {"id":"58af89a9-fd59-45e0-9fc4-ce931f5d7f70","nombre":"Del llano"},
  {"id":"0ab60b02-fe7d-4b34-ba74-4f45ca9f397d","nombre":"Autopartes Sol"},
  {"id":"3fcc2835-49a0-4e3d-a50e-3c09c9e44e00","nombre":"Laboratorío Roca"},
  {"id":"1c4617b5-6e72-4eca-8f11-9ef8eafc8480","nombre":"Conexion Market"},
  {"id":"f4762272-6225-46de-a166-66b5ef2024c5","nombre":"Terra Logistica"},
  {"id":"4451954a-534b-40fb-a0fe-892d242a6727","nombre":"Escobar"},
  {"id":"b109160d-0030-4fdd-93d1-d6951b3c42da","nombre":"Novis"},
  {"id":"ece8bdeb-4ae5-4257-9fb2-64f268f46790","nombre":"HOM Seguros"},
  {"id":"27fc8f05-a0f3-416c-b72b-482361e85eda","nombre":"La Motofeca"},
  {"id":"9fabb9b5-996d-4476-842b-3a16241eb956","nombre":"Distribuidora mayorista Saphirus"},
  {"id":"1a653f6d-0d0a-44be-b07f-6be6c348d0e8","nombre":"Fulanos"},
  {"id":"2cd9b7e5-df1d-417f-9d1b-814eed963831","nombre":"Red el Colo"},
  {"id":"fb3b640e-bad7-49f1-9389-8238b31c7b41","nombre":"Beamar Alimentos"},
  {"id":"d0cf91c6-638c-476e-bbd2-07c0cdec2aac","nombre":"Gama italy"},
  {"id":"f0e0dc25-7cf6-4911-ba2f-581b2ae0330f","nombre":"Nicola Chapa y Pintura"},
  {"id":"90ab6de1-dbd1-4fb0-904a-21fec1817140","nombre":"Bavosi"},
  {"id":"8fb4192c-a199-4257-841b-a5f819bf086a","nombre":"Nutriar"},
  {"id":"139058ed-1fd8-4d0f-824c-0d38bde12bf8","nombre":"ISAA"},
  {"id":"67cd6c67-78b0-4282-9fd0-8bbd96292f77","nombre":"Ingredients Solutions"},
  {"id":"70cb0d85-e6ed-4101-8163-3b1945975823","nombre":"Hotel Faraon"},
  {"id":"c1ed2eb7-7fb3-4af1-b76c-64be29a917dd","nombre":"Open Pack"},
  {"id":"b651c6f1-d8e3-4710-8c01-c3b243568699","nombre":"Grupo BMH"},
  {"id":"33681469-0dde-49ce-84cf-6c2638f7cb13","nombre":"Vigorita Maderas"},
  {"id":"7d57f5bb-7e02-4321-a2ec-6e4e7bf179aa","nombre":"COOQUITRANS"},
  {"id":"501d6249-ddc6-4ec8-9a1a-a6dcfd35f353","nombre":"Entrenuts"},
  {"id":"4063c5f1-a20a-4420-9fd6-15f7df8ceb1c","nombre":"La Golonisería"},
  {"id":"05e15742-edb2-43eb-9bbb-233027c61bdf","nombre":"La Golonisería"},
  {"id":"7284ad77-1913-4191-b819-a23e0ab7d671","nombre":"Otamendi y Cía"},
  {"id":"90f2ffcf-c3ae-45cc-805e-c7f201196a54","nombre":"Tenis club argentino"},
  {"id":"c543eef5-3196-4f27-b6b1-0d4b9da5c8be","nombre":"Marcelo Duran"},
  {"id":"d9cc3e32-b133-4fdb-ab42-a7e685d81de6","nombre":"CIATI"},
  {"id":"a68a113d-fe2e-4a22-9425-8aa3711888b3","nombre":"Estudio Gustavo Echarte"}
];

const userData = `4af047dd	Amipack	Santa fe	Argentina	Papelera	100	8	AMIPACK ENVASES S. A.	30674273300				
ac9586f8	El Norte	Santa Fe	Argentina	Transporte de pasajeros	400	7	EMPRESA DE TRANSPORTES EL NORTE SA	30546263483	EMPRESA EL NORTE BIS SRL	30546234246	EMPRESA SAN CRISTOBAL S R L	30546231964
ae28a0cd	Dg Distribuciones	Santa fe	Argentina	Distribuidora	10	5	GIAGNONI DARIO GERARDO	20170072074				
81e2411b	Natión	Santa fe	Argentina	consecionario	700	8	NATION SA	30581697488	NATION LITORAL S.A.	30712525742	NATION MOTORS  S. A.	30717391264
17558433	Zinma	Buenos Aires	Argentina	Agricultura	20	5						
744519ee	Almacén de Idiomas		Argentina	Educación	17	5						
930da870	RR escapes	Santa fe	Argentina	Producción de Repuestos	7	5						
3375ff5f	Transporte Chileno		Chile	Transporte de carga	10	5						
d71499b6	Zurschmitten	Santa fe	Argentina	Muebles	70	5						
5b3f3faa	Nea Color	Corrientes	Argentina	Comercio	3	5						
985848f8	Juan Jose Puppo		Uruguay	Arquitectura	3	5						
8bc78391	Teixido Repuestos	Corrientes	Argentina	Venta de Repuestos	10	5						
3d02fb5a	Hiper Limpieza		Argentina	Comercio	13	2	FIGUEROA ELIZABETH CARLA	27260748071				
de99039a	Tata Rapido	Santa Fe	Argentina	Transporte de pasajeros	150	5						
efbc1d02	Bracco Lucas Gabriel	Cordoba	Argentina	Distribuidora	5	5						
3c9bd67c	Nova	Santa fe	Argentina	Consultoría	2	5						
3aab4ba0	Blanco Textil	Cordoba	Argentina	Comercio	8	5						
53d4a35e	Carolina Faveiro	Buenos Aires	Argentina	Arquitectura	1	5						
cf6c2ff4	Apsol	Santa fe	Argentina	consultora	2	5						
414a22fc	Neumen	Buenos Aires	Argentina	Distribuidora	450	5						
6ecab644	Refri Integral	Buenos Aires	Argentina	Servicios	6	5	BIELEWICH MARTIN PABLO	20349222494				
5dc46219	Couce	Buenos Aires	Argentina	Calzado	15	5						
99227907	La Espiga	Entre Ríos	Argentina	Distribuidora	4	5						
e5db3503	Maricré	Bs As	Argentina	Distribuidora	40	4						
6cdbb434	Rojas Gluten Free	Buenos Aires	Argentina	Supermercados	25	4						
f51458c2	Colegio LIncoln	Buenos Aires	Argentina	Educación	100	4						
c2d2610d	Viajeros en Rio	Santa fe	Argentina	Turismo	2	4						
f1a85ff9	Delico	Buenos Aires	Argentina	Industria Alimenticia	50	4						
fbb073ad	Mercería La Paloma	Buenos Aires	Argentina	Distribuidora	6	4						
30ab20cd	Precixo	Santa fe	Argentina	Informatica	3	4						
4b278dbc	Ultracongelados canalsenses	Cordoba	Argentina	Distribuidora	50	4						
69fe2461	COTAR	Santa fe	Argentina	Industria Alimenticia	127	4						
38fbf5b1	Verisue	Santa fe	Argentina	Servicios	1700	4						
37654b55	Xchange Bridge	Buenos Aires	Argentina	Turismo	12	4						
785a53df	Bolciti SRL	Buenos Aires	Argentina	Papelera		20						
fefd5d26	Bassegraf	Buenos Aires	Argentina	Distribuidora	10	4						
c177625d	Eliho Textil	Buenos Aires	Argentina	textil	30	4						
118b4ee2	Insuga	Santa fe	Argentina	Industria Alimenticia	200	7	INSUGA SA	30540367120	INSUGA CHACO S.A.	33711217679		
e1a52e95	Metalurgica HQ	Cordoba	Argentina	Metalurgica	13	5	METALURGICA HUGO QUERO S.R.L	30709816221				
7e461d1d	IO Distribuidora	Santa fe	Argentina	Distribuidora	4	4						
0567a635	Fiore	Santa fe	Argentina	Metalurgica	9	4						
e6ad2804	GrupoAISA Mecanizados	Buenos Aires	Argentina	Metalurgica	8	4						
84a5d941	P.C.G Distribuidora	Santa Fe	Argentina	Distribuidora	6	4						
126ab385	Ruedas R.A.R	Santa fe	Argentina	Metalurgica	6	4						
78f24129	Drumond Pet Shop	Buenos Aires	Argentina	Distribuidora	2	4	LA MASTRA NICOLAS BERNARDINO	20349069858				
5d03ca1f	Idearte Mayorista	Buenos Aires	Argentina	Distribuidora	5	1	CHADE ROBERTO MARIO - Monotributo	20145189668				
75b92a7d	A todo Color	Santa Fe	Argentina	Pinturería	400	5	A TODO COLOR SRL	30708385073				
8701553e	La Francia Panificación SRL	Santa fe	Argentina	Panificación	15	5	La Francia Panificación SRL					
73527a48	Cordilleranos srl	Neuquen	Argentina	Supermercados	60	5	Cordilleranos srl	30714223131				
41b2192f	Hector Cañadas	Santa Fe	Argentina	Consultoría	1	4						
a3e3e86c	VASQUEZ SRL	Rio Negro	Argentina	Madera	10	5						
a9fc634b	REMAX	Santa fe	Argentina	Inmobiliaria	30	7						
4c543d69	PURATOS	Buenos Aires	Argentina	Panificación	250	6						
af6136d5	Municipalidad de Rawson	Chubut	Argentina	Sector Publico	200	6						
093697de	Bernardis	Santa fe	Argentina	Marmolería	20	4						
d193b499	OnTheRoad viajes	Buenos Aires	Argentina	Agencia de Viajes	3	4						
97b9fe3e	Nossar	-	Uruguay	Transporte de pasajeros	100	4						
932e6eec	Riosma	Buenos Aires	Argentina	Frigorifico	200	4						
e9e0a3a9	Vertiente del Sur	Santa Fe	Argentina	Agua Mineral	10	6						
d1681a26	Del llano	-	Colombia	Industria Alimenticia	50	4						
34a2cd17	Autopartes Sol	Misiones	Argentina	Venta de Repuestos	40	4	Autopartes sol SRL	30708427450				
1c0d5c64	Laboratorío Roca	Buenos Aires	Argentina	Laboratorio	6	4	Laboratorio Roca SRL	30715059874				
b178e6b9	Conexion Market	Santa fe	Argentina	Logistica	20	6	CONEXION MARKET SAS	30717078434				
c461f15b	Terra Logistica		Chile	Logistica	10	4						
b04dfd0e	Escobar	Santa fe	Argentina	consecionario	200	6	Escobar Automotores S.A.	30711061327	Escobar Santa Fe	30518849634		
da75f410	Novis	Buenos Aires	Argentina	Agricultura	25	4						
49bfe5a7	HOM Seguros	Buenos aires	Argentina	Seguros	10	4						
431a396d	La Motofeca	Buenos Aires	Argentina	Comercio	10	4						
b057cd12	Distribuidora mayorista Saphirus	Buenos Aires	Argentina	Distribuidora	10	4						
d0f1acb0	Fulanos	Minimercado	Argentina	Supermercados	2	4						
8e3b2b80	Red el Colo	Corrientes	Argentina	Muebles	6	4						
fc235004	Beamar Alimentos	San Luis	Argentina	Supermercados		4						
4728be84	Gama italy	BS AS	Argentina	Distribuidora	200	4						
4b4ab8fb	Nicola Chapa y Pintura	Santa fe	Argentina	Automotor	30	4						
5b5b773e	Bavosi	Buenos Aires	Argentina	Industria Alimenticia	50	4						
82c28880	Nutriar	Santa fe	Argentina	Industria Alimenticia		4						
013ad8e0	ISAA	BS AS	Argentina	Educación	10	4	ASTRO ISAA	30717565017				
21f58208	Ingredients Solutions	Buenos Aires	Argentina	Industria Alimenticia	50	4						
005870f1	Hotel Faraon	Bs As	Argentina	Hotelería	200	4						
c4516150	Open Pack	Buenos Aires	Argentina	Papelera	50	4	LABEL GROUP S.R.L.	30709991112				
c4e7e704	Grupo BMH	Buenos Aires	Argentina	Servicios		4						
1ffa5823	Vigorita Maderas	Santa fe	Argentina	Madera	100	4						
13fe9826	COOQUITRANS		Colombia	Transporte de carga	10	4						
a2285b22	Entrenuts	Buenos Aires	Argentina	Industria Alimenticia	50	4						
c79b70f0	La Golonisería	Buenos Aires	Argentina	Comercio	20	4						
db7864da	La Golonisería	Buenos Aires	Argentina	Comercio	15	4						
f76405df	Otamendi y Cía	Santa Cruz	Argentina	Distribuidora	200	4						
a940644b	Tenis club argentino	Buenos Aires	Argentina	Club	50	4						
ef2d9055	Marcelo Duran	Santa fe	Argentina	Automotor	5	4	NUTRYNOR S.A	30707878718				
7987a65f	CIATI	Rio Negro	Argentina	Laboratorio	100	4						
58fb63c6	Estudio Gustavo Echarte	Santa fe	Argentina	Legal	5	4						
`;

const lines = userData.trim().split('\n');
const updates = [];
const reasons = [];

lines.forEach(line => {
  const parts = line.split('\t');
  if (parts.length < 7) return;

  const [id_excel, nombre, provincia, pais, industria, tamanio, dias_espera] = parts;
  
  // Find existing company by name
  const existing = dbCompanies.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
  
  if (existing) {
    updates.push({
      id: existing.id,
      nombre,
      provincia: provincia || null,
      pais: pais || 'Argentina',
      industria: industria || null,
      tamanio: parseInt(tamanio) || 0,
      dias_espera: parseInt(dias_espera) || 4
    });

    // Reasons
    for (let i = 7; i < parts.length; i += 2) {
      const rs = parts[i];
      const cuit = parts[i+1];
      if (rs && rs.trim()) {
        reasons.push({
          empresa_id: existing.id,
          razon_social: rs.trim(),
          cuit: cuit ? cuit.trim() : null
        });
      }
    }
  } else {
    console.log(`Company not found in DB: ${nombre}`);
  }
});

let sql = '';

// Update empresas
updates.forEach(u => {
  sql += `UPDATE apsol.empresas SET provincia = '${u.provincia}', pais = '${u.pais}', industria = '${u.industria}', tamanio = ${u.tamanio}, dias_espera_facturacion = ${u.dias_espera} WHERE id = '${u.id}';\n`;
});

// For razones sociales, I'll delete existing ones for these companies and re-insert
const companyIdsToRefresh = [...new Set(reasons.map(r => r.empresa_id))];
if (companyIdsToRefresh.length > 0) {
  sql += `DELETE FROM apsol.razones_sociales WHERE empresa_id IN (${companyIdsToRefresh.map(id => `'${id}'`).join(',')});\n`;
  reasons.forEach(r => {
    sql += `INSERT INTO apsol.razones_sociales (empresa_id, razon_social, cuit) VALUES ('${r.empresa_id}', '${r.razon_social}', '${r.cuit}');\n`;
  });
}

console.log(sql);
